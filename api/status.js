// GET /api/status?id=… — an applicant's own decision. Reveals nothing but the status.
import { KEY, configured, cmd, allow, clientIp, send } from './_lib/store.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return send(res, 405, { error: 'Use GET.' }); }
  if (!configured()) return send(res, 503, { error: 'The registry is not connected yet.' });
  const id = String(new URL(req.url, 'http://x').searchParams.get('id') || '');
  if (!/^[a-f0-9]{32,64}$/.test(id)) return send(res, 400, { error: 'Missing petition id.' });
  try {
    if (!(await allow('status', clientIp(req), 120, 3600))) return send(res, 429, { error: 'Slow down.' });
    const raw = await cmd('GET', KEY.petition(id));
    if (!raw) return send(res, 404, { error: 'No petition with that id.' });
    return send(res, 200, { status: JSON.parse(raw).status });
  } catch (e) {
    console.error('status failed', e);
    return send(res, 500, { error: 'The registry is unavailable.' });
  }
}
