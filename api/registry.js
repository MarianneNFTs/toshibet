// /api/registry — committee only, behind REGISTRY_PASSWORD (sent as a Bearer token).
//   GET  → every petition, newest first
//   POST { id, status } → approve / decline / reset to pending
import { KEY, STATUSES, configured, cmd, pipeline, allow, clientIp, passwordOk, send, readJson } from './_lib/store.js';

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) { res.setHeader('Allow', 'GET, POST'); return send(res, 405, { error: 'Use GET or POST.' }); }
  if (!configured()) return send(res, 503, { error: 'The registry database is not connected. Add Upstash Redis from the Vercel project Storage tab, then redeploy.' });
  if (!process.env.REGISTRY_PASSWORD) return send(res, 503, { error: 'Set REGISTRY_PASSWORD in the Vercel project settings, then redeploy.' });
  try {
    const ip = clientIp(req);
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!passwordOk(token)) {
      const ok = await allow('login-fail', ip, 10, 900);
      return send(res, ok ? 401 : 429, { error: ok ? 'That password is not right.' : 'Too many wrong passwords. Wait 15 minutes.' });
    }

    if (req.method === 'GET') {
      const ids = await cmd('ZREVRANGE', KEY.index, '0', '-1');
      if (!ids.length) return send(res, 200, { petitions: [] });
      const raws = await cmd('MGET', ...ids.map(KEY.petition));
      return send(res, 200, { petitions: raws.filter(Boolean).map(r => JSON.parse(r)) });
    }

    const b = await readJson(req);
    const id = String(b.id || ''), status = String(b.status || '');
    if (!/^[a-f0-9]{32,64}$/.test(id) || !STATUSES.includes(status)) return send(res, 400, { error: 'Need a petition id and a status of pending, approved or declined.' });
    const key = KEY.petition(id);
    const raw = await cmd('GET', key);
    if (!raw) return send(res, 404, { error: 'That petition no longer exists.' });
    const rec = { ...JSON.parse(raw), status, decidedAt: status === 'pending' ? null : Date.now() };
    await pipeline([['SET', key, JSON.stringify(rec)]]);
    return send(res, 200, { ok: true, petition: rec });
  } catch (e) {
    console.error('registry failed', e);
    return send(res, 500, { error: 'The registry is unavailable. Try again in a moment.' });
  }
}
