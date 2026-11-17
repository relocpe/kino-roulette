import { sanitizeChat, sanitizeNick, syncNow, publicRoom } from './codec.mjs';

const MAX_CHAT = 120;
const MAX_MEMBERS = 24;
const MAX_FRAME = 8192;
const CHAT_GAP_MS = 350;
const httpsUrl = (v) => { try { const u = new URL(String(v)); return u.protocol === 'https:' ? u.href.slice(0, 500) : undefined; } catch { return undefined; } };

export class WatchPartyRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    /** @type {Map<WebSocket, { uid: string, nick: string, auth: boolean, key: string, host: boolean, lastChat: number }>} */
    this.live = new Map();
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (request.headers.get('Upgrade') === 'websocket') return this.onWs(request);
    if ((url.pathname === '/init' || url.pathname.endsWith('/init')) && request.method === 'POST') {
      let room = await this.state.storage.get('room');
      if (!room) {
        const body = await request.json().catch(() => ({}));
        room = {
          id: body.id,
          created: Date.now(),
          hostId: body.hostId ? String(body.hostId).slice(0, 64) : null,
          hostKey: body.hostKey ? String(body.hostKey).slice(0, 80) : null,
          film: null,
          sync: { at: 0, playing: false, wall: 0 },
          chat: [],
        };
        await this.state.storage.put('room', room);
      }
      return new Response('ok');
    }
    if (request.method === 'GET') {
      const room = await this.state.storage.get('room');
      if (!room) return this.json({ error: 'room_not_found' }, 404, request);
      return this.json({ room: publicRoom(room, [...this.live.values()]) }, 200, request);
    }
    return new Response('bad', { status: 400 });
  }

  async onWs(request) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    server.addEventListener('message', (ev) => this.onMsg(server, ev));
    server.addEventListener('close', () => this.drop(server));
    server.addEventListener('error', () => this.drop(server));
    return new Response(null, { status: 101, webSocket: client });
  }

  async loadRoom() {
    return (await this.state.storage.get('room')) || null;
  }

  async saveRoom(room) {
    await this.state.storage.put('room', room);
    return room;
  }

  async drop(ws) {
    if (!this.live.has(ws)) return;
    this.live.delete(ws);
    const room = await this.loadRoom();
    this.broadcast({ type: 'presence', members: await this.membersListAsync(room) });
  }

  async membersListAsync(room) {
    const ms = [...this.live.values()];
    return ms.map((m) => ({ uid: m.uid, nick: m.nick, auth: m.auth, host: !!m.host }));
  }

  send(ws, msg) {
    try { ws.send(JSON.stringify(msg)); } catch {}
  }

  broadcast(msg, except) {
    const raw = JSON.stringify(msg);
    for (const [ws] of this.live) {
      if (ws === except) continue;
      try { ws.send(raw); } catch {}
    }
  }

  async onMsg(ws, ev) {
    if (typeof ev.data !== 'string' || ev.data.length > MAX_FRAME) return;
    let m;
    try { m = JSON.parse(ev.data); } catch { return; }
    const room = await this.loadRoom();
    if (!room) { try { ws.close(4000, 'gone'); } catch {} return; }

    if (m.type === 'join') {
      const uid = String(m.uid || '').slice(0, 64);
      if (!uid) return;
      const nick = sanitizeNick(m.nick);
      const auth = !!m.auth;
      if (this.live.size >= MAX_MEMBERS && !this.live.has(ws)) {
        this.send(ws, { type: 'error', code: 'room_full' });
        try { ws.close(4003, 'full'); } catch {}
        return;
      }
      const key = String(m.key || '').slice(0, 80);
      if (!room.hostId) {
        room.hostId = uid;
        room.hostKey = key || null;
        await this.saveRoom(room);
      } else if (room.hostId === uid && !room.hostKey && key) {
        room.hostKey = key;
        await this.saveRoom(room);
      }
      const host = room.hostId === uid && (room.hostKey ? key === room.hostKey : true);
      this.live.set(ws, { uid, nick, auth, key, host, lastChat: 0 });
      const pub = publicRoom(room, await this.membersListAsync(room));
      this.send(ws, { type: 'hello', you: uid, host, room: pub });
      this.broadcast({ type: 'presence', members: pub.members }, ws);
      return;
    }

    const me = this.live.get(ws);
    if (!me) return;

    if (m.type === 'chat') {
      const text = sanitizeChat(m.text);
      if (!text) return;
      const nowMs = Date.now();
      if (nowMs - me.lastChat < CHAT_GAP_MS) return;
      me.lastChat = nowMs;
      const entry = { uid: me.uid, nick: me.nick, text, ts: Date.now() };
      room.chat = [...(room.chat || []), entry].slice(-MAX_CHAT);
      await this.saveRoom(room);
      this.broadcast({ type: 'chat', ...entry });
      return;
    }

    const isHost = !!me.host;
    if (m.type === 'film' && isHost) {
      room.film = {
        id: String(m.film?.id || '').slice(0, 32),
        title: String(m.film?.title || '').slice(0, 200),
        year: m.film?.year | 0 || undefined,
        embedUrl: httpsUrl(m.film?.embedUrl),
        pageUrl: httpsUrl(m.film?.pageUrl),
        mode: m.film?.mode === 'trailer' ? 'trailer' : 'stream',
        ytId: m.film?.ytId ? String(m.film.ytId).slice(0, 20) : undefined,
      };
      await this.saveRoom(room);
      this.broadcast({ type: 'film', film: room.film, from: me.nick });
      return;
    }

    if (m.type === 'sync' && isHost) {
      const at = Math.max(0, Number(m.at) || 0);
      const playing = !!m.playing;
      room.sync = { at, playing, wall: playing ? Date.now() : 0 };
      await this.saveRoom(room);
      this.broadcast({ type: 'sync', sync: room.sync, now: syncNow(room.sync), snap: !!m.snap });
      return;
    }

    if (m.type === 'claim_host') {
      if (me.key && ![...this.live.values()].some((v) => v.host)) {
        room.hostId = me.uid;
        room.hostKey = me.key;
        await this.saveRoom(room);
        for (const v of this.live.values()) v.host = v === me;
        this.broadcast({ type: 'host', hostId: room.hostId, nick: me.nick });
        this.broadcast({ type: 'presence', members: await this.membersListAsync(room) });
      }
      return;
    }
  }

  liveHas(uid) {
    for (const v of this.live.values()) if (v.uid === uid) return true;
    return false;
  }

  json(data, status, request) {
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        ...cors(request),
      },
    });
  }
}

function cors(request) {
  const origin = request.headers.get('Origin');
  const allow = origin === 'https://relocpe.github.io' || origin === 'http://127.0.0.1:4173' || origin === 'http://localhost:4173';
  return allow ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {};
}