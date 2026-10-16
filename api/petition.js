// POST /api/petition — file or update a petition. The id is a random 144-bit token the
// applicant's browser generates and keeps; knowing it is what lets them update their own
// petition. Applicants can never set their own status.
import { KEY, ARCHETYPES, STYLES, MAX_PETITIONS, configured, cmd, pipeline, allow, clientIp, send, readJson } from './_lib/store.js';

const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);

export function validate(b) {
  const p = {
    id: clean(b.id, 64),
    name: clean(b.name, 60),
    email: clean(b.email, 120).toLowerCase(),
    x: clean(b.x, 16).replace(/^@/, ''),
    toshiUser: clean(b.toshiUser, 40),
    archetype: ARCHETYPES.includes(b.archetype) ? b.archetype : null,
    card: { name: clean(b.card?.name, 22).toUpperCase(), style: STYLES.includes(b.card?.style) ? b.card.style : 'obsidian' }
  };
  if (!/^[a-f0-9]{32,64}$/.test(p.id)) return [null, 'Missing petition id.'];
  if (p.name.length < 2) return [null, 'Write your name as you would sign it.'];
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(p.email)) return [null, 'That email address will not reach you.'];
  if (!/^[A-Za-z0-9_]{1,15}$/.test(p.x)) return [null, 'X usernames use letters, numbers and underscores, up to 15.'];
  return [p, null];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(res, 405, { error: 'Use POST.' }); }
  if (!configured()) return send(res, 503, { error: 'The registry is not connected yet.' });
  try {
    if (!(await allow('petition', clientIp(req), 40, 3600))) return send(res, 429, { error: 'Too many petitions from this connection. Try again in an hour.' });
    const [p, err] = validate(await readJson(req));
    if (err) return send(res, 400, { error: err });

    const key = KEY.petition(p.id);
    const prevRaw = await cmd('GET', key);
    const prev = prevRaw ? JSON.parse(prevRaw) : null;
    if (!prev && (await cmd('ZCARD', KEY.index)) >= MAX_PETITIONS) return send(res, 503, { error: 'The registry is full.' });

    const now = Date.now();
    const rec = { ...p, filedAt: prev?.filedAt || now, updatedAt: now, status: prev?.status || 'pending', decidedAt: prev?.decidedAt || null };
    await pipeline([['SET', key, JSON.stringify(rec)], ['ZADD', KEY.index, String(rec.filedAt), p.id]]);
    return send(res, prev ? 200 : 201, { ok: true, status: rec.status });
  } catch (e) {
    console.error('petition failed', e);
    return send(res, 500, { error: 'The registry could not save this petition. Try again in a moment.' });
  }
}
