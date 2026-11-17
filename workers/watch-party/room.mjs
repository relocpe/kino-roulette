import { sanitizeChat, sanitizeNick, syncNow, publicRoom } from './codec.mjs';

const MAX_CHAT = 120;
const MAX_MEMBERS = 24;

export class WatchPartyRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    /** @type {Map<WebSocket, { uid: string, nick: string, auth: boolean }>} */
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

  drop(ws) {
    if (!this.live.has(ws)) return;
    this.live.delete(ws);
    this.broadcast({ type: 'presence', members: this.membersList() });
  }

  membersList() {
    return [...this.live.values()].map((m) => ({ uid: m.uid, nick: m.nick, auth: m.auth }));
  }

  async membersListAsync(room) {
    const ms = [...this.live.values()];
    return ms.map((m) => ({ uid: m.uid, nick: m.nick, auth: m.auth, host: m.uid === room?.hostId }));
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
      this.live.set(ws, { uid, nick, auth });
      if (!room.hostId) {
        room.hostId = uid;
        await this.saveRoom(room);
      }
      const pub = publicRoom(room, await this.membersListAsync(room));
      this.send(ws, { type: 'hello', you: uid, host: room.hostId === uid, room: pub });
      this.broadcast({ type: 'presence', members: pub.members }, ws);
      return;
    }

    const me = this.live.get(ws);
    if (!me) return;

    if (m.type === 'chat') {
      const text = sanitizeChat(m.text);
      if (!text) return;
      const entry = { uid: me.uid, nick: me.nick, text, ts: Date.now() };
      room.chat = [...(room.chat || []), entry].slice(-MAX_CHAT);
      await this.saveRoom(room);
      this.broadcast({ type: 'chat', ...entry });
      return;
    }

    const isHost = me.uid === room.hostId;
    if (m.type === 'film' && isHost) {
      room.film = {
        id: String(m.film?.id || '').slice(0, 32),
        title: String(m.film?.title || '').slice(0, 200),
        year: m.film?.year | 0 || undefined,
        embedUrl: m.film?.embedUrl ? String(m.film.embedUrl).slice(0, 500) : undefined,
        pageUrl: m.film?.pageUrl ? String(m.film.pageUrl).slice(0, 500) : undefined,
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
      this.broadcast({ type: 'sync', sync: room.sync, now: syncNow(room.sync) });
      return;
    }

    if (m.type === 'claim_host') {
      if (!room.hostId || !this.liveHas(room.hostId)) {
        room.hostId = me.uid;
        await this.saveRoom(room);
        this.broadcast({ type: 'host', hostId: room.hostId, nick: me.nick });
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