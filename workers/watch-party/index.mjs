import { WatchPartyRoom } from './room.mjs';
import { CODE, newRoomId } from './codec.mjs';

export { WatchPartyRoom };

const ORIGINS = new Set([
  'https://relocpe.github.io',
  'http://127.0.0.1:4173',
  'http://localhost:4173',
  'http://127.0.0.1:3000',
  'http://localhost:3000',
]);

function originOk(origin) {
  if (!origin) return false;
  if (ORIGINS.has(origin)) return true;
  return /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin);
}

function cors(request) {
  const origin = request.headers.get('Origin') || '';
  const ok = originOk(origin);
  return {
    ...(ok ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(data, status, request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors(request), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

const preflight = (request) => new Response(null, { status: 204, headers: cors(request) });

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return preflight(request);
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const isWs = request.headers.get('Upgrade') === 'websocket';
    if ((isWs || (url.pathname === '/create' && request.method === 'POST')) && !originOk(origin || '')) return json({ error: 'forbidden' }, 403, request);

    if (url.pathname === '/create' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const id = newRoomId();
      const stub = env.WATCH.get(env.WATCH.idFromName(id));
      const init = await stub.fetch(new Request('https://do/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, hostId: body.hostId ? String(body.hostId).slice(0, 64) : null, hostKey: body.hostKey ? String(body.hostKey).slice(0, 80) : null }),
      }));
      if (!init.ok) return json({ error: 'init_failed' }, 500, request);
      const base = url.origin;
      return json({
        roomId: id,
        wsUrl: `${base.replace(/^http/, 'ws')}/watch/${id}`,
        httpUrl: `${base}/watch/${id}`,
      }, 200, request);
    }

    const m = url.pathname.match(/^\/watch\/([A-Za-z0-9]{6,10})$/);
    if (!m || !CODE.test(m[1])) return json({ error: 'not_found' }, 404, request);
    const stub = env.WATCH.get(env.WATCH.idFromName(m[1]));
    return stub.fetch(request);
  },
};