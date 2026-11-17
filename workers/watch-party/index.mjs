import { WatchPartyRoom } from './room.mjs';
import { CODE, newRoomId } from './codec.mjs';

export { WatchPartyRoom };

const ORIGINS = new Set(['https://relocpe.github.io', 'http://127.0.0.1:4173', 'http://localhost:4173']);

function cors(request) {
  const origin = request.headers.get('Origin') || '';
  const ok = ORIGINS.has(origin);
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

    if (url.pathname === '/create' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const id = newRoomId();
      const stub = env.WATCH.get(env.WATCH.idFromName(id));
      const init = await stub.fetch(new Request('https://do/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, hostId: body.hostId ? String(body.hostId).slice(0, 64) : null }),
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