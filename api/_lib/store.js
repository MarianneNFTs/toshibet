// Petition storage on Upstash Redis (Vercel Marketplace), spoken over its REST API so the
// project needs no dependencies. Vercel's integration sets KV_REST_API_*; a direct Upstash
// connection sets UPSTASH_REDIS_REST_*. Either works.
import { createHash, timingSafeEqual } from 'node:crypto';

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const KEY = { petition: id => `tsc:p:${id}`, index: 'tsc:idx', rate: (k, ip) => `tsc:rl:${k}:${ip}` };
export const STATUSES = ['pending', 'approved', 'declined'];
export const ARCHETYPES = ['shogun', 'ronin', 'ambassador', 'alchemist', 'phantom', 'patron'];
export const STYLES = ['obsidian', 'gold', 'platinum', 'rose', 'titanium', 'crimson', 'toshiblue', 'dojo', 'navy', 'pearl', 'genesis', 'vault'];
export const MAX_PETITIONS = 5000;

export function configured() { return Boolean(URL_ && TOKEN); }

async function call(path, body) {
  const r = await fetch(URL_ + path, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`store ${r.status}`);
  return r.json();
}
export async function cmd(...args) {
  const j = await call('', args);
  if (j.error) throw new Error(j.error);
  return j.result;
}
export async function pipeline(cmds) {
  const out = await call('/pipeline', cmds);
  return out.map(o => { if (o.error) throw new Error(o.error); return o.result; });
}

export function clientIp(req) {
  const f = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return f || req.socket?.remoteAddress || 'unknown';
}

// Fixed-window counter: true while `ip` has made fewer than `max` hits on `bucket` this window.
export async function allow(bucket, ip, max, windowSec) {
  const key = KEY.rate(bucket, createHash('sha256').update(ip).digest('hex').slice(0, 16));
  const [, n] = await pipeline([['SET', key, '0', 'EX', String(windowSec), 'NX'], ['INCR', key]]);
  return n <= max;
}

export function passwordOk(given) {
  const want = process.env.REGISTRY_PASSWORD || '';
  if (!want || typeof given !== 'string') return false;
  const a = createHash('sha256').update(given).digest(), b = createHash('sha256').update(want).digest();
  return timingSafeEqual(a, b);
}

export function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (raw.length > 20000) throw new Error('too large'); }
  return raw ? JSON.parse(raw) : {};
}
