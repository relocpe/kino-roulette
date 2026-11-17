// Комната совместного просмотра (как Watch2Gether): чат + синхро по таймлайну ведущего.
import { me, loggedIn } from './store.js?v=13';
import { BASE } from './views.js?v=29';

export const WATCH_PARTY_API = 'https://kino-roulette-watch-party.samevamp.workers.dev';

const UID_KEY = 'kr:watchUid';
const NICK_KEY = 'kr:watchNick';

export function watchIdentity() {
  let uid = localStorage.getItem(UID_KEY);
  if (!uid) {
    uid = crypto.randomUUID();
    localStorage.setItem(UID_KEY, uid);
  }
  const user = me();
  const nick = (user?.nickname || localStorage.getItem(NICK_KEY) || '').trim()
    || `Гость-${uid.slice(0, 4)}`;
  return { uid, nick, auth: loggedIn() };
}

export function saveWatchNick(nick) {
  const t = String(nick || '').trim().slice(0, 24);
  if (t) localStorage.setItem(NICK_KEY, t);
}

export async function createWatchRoom() {
  const who = watchIdentity();
  const r = await fetch(`${WATCH_PARTY_API}/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostId: who.uid }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'create_failed');
  return d;
}

export function watchRoomLink(roomId) {
  return `${location.origin}${BASE}watch/${roomId}`;
}

function fmtClock(sec) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const x = s % 60;
  if (h) return `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`;
  return `${m}:${String(x).padStart(2, '0')}`;
}

export function openWatchPanel(root, { onOpenPlayer, onToast, onHello, onStatus, onSync, onTransport, onSnap } = {}) {
  if (!root) return () => {};
  const id = (sel) => root.querySelector(sel);

  let ws = null;
  let roomId = '';
  let host = false;
  let hostId = '';
  let sync = { at: 0, playing: false, wall: 0 };
  let film = null;
  let dur = 0;
  let reconnect = 0;
  let clockTick = 0;
  let gone = false;

  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const send = (msg) => { try { ws?.send(JSON.stringify(msg)); } catch {} };

  const clockNow = () => (sync.playing && sync.wall ? sync.at + (Date.now() - sync.wall) / 1000 : sync.at || 0);
  const paintClock = () => {
    const el = id('[data-wp-clock]');
    if (!el) return;
    const now = clockNow();
    el.textContent = fmtClock(now);
    const state = id('[data-wp-state]');
    if (state) state.textContent = sync.playing ? 'Идёт' : 'Пауза';
    const led = id('.wp-led');
    if (led) led.classList.toggle('on', !!sync.playing);
  };
  const ensureTick = () => { if (!clockTick) clockTick = setInterval(paintClock, 1000); };

  const broadcast = (at, playing, snap) => {
    sync = { at: Math.max(0, Number(at) || 0), playing: !!playing, wall: playing ? Date.now() : 0 };
    send({ type: 'sync', at: sync.at, playing: sync.playing, snap: !!snap });
    paintClock();
  };

  let syncBuilt = '';
  const paintSync = () => {
    const el = id('#wpSync');
    if (!el) return;
    const key = host ? 'host' : 'guest';
    if (syncBuilt === key && id('[data-wp-clock]')) { paintClock(); ensureTick(); return; }
    syncBuilt = key;
    const now = clockNow();
    const icon = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M20 12a8 8 0 0 1-13.6 5.7L4 16M4 12a8 8 0 0 1 13.6-5.7L20 8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M4 16v-4h4M20 8v4h-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    el.innerHTML = `<div class="wp-remote">
      <span class="wp-led${sync.playing ? ' on' : ''}" aria-hidden="true"></span>
      <b data-wp-clock>${fmtClock(now)}</b>
      <span data-wp-state>${sync.playing ? 'Идёт' : 'Пауза'}</span>
      ${host ? `<span class="wp-actions" role="group" aria-label="Воспроизведение"><button type="button" data-wp-play>Воспроизвести</button><button type="button" data-wp-pause>Пауза</button></span>` : ''}
      <button type="button" class="wp-syncbtn" data-wp-sync>${icon}<span>Синхронизировать</span></button>
    </div>`;
    ensureTick();
    id('[data-wp-play]')?.addEventListener('click', () => onTransport?.('play'));
    id('[data-wp-pause]')?.addEventListener('click', () => onTransport?.('pause'));
    id('[data-wp-sync]')?.addEventListener('click', () => onSnap?.());
  };

  const pushChat = (entry) => {
    const box = id('#wpMsgs');
    if (!box) return;
    const row = document.createElement('p');
    row.className = 'wp-msg';
    row.innerHTML = `<span class="wp-who">${esc(entry.nick)}</span><span class="wp-text">${esc(entry.text)}</span>`;
    box.appendChild(row);
    box.scrollTop = box.scrollHeight;
    while (box.children.length > 100) box.firstChild.remove();
  };

  const paintMembers = (members) => {
    const el = id('#wpMembers');
    if (!el) return;
    if (!members?.length) { el.innerHTML = '<p class="wp-wait">Подключаемся…</p>'; return; }
    const letter = (nick) => { const s = String(nick || '').trim(); return s ? [...s][0].toUpperCase() : '?'; };
    el.innerHTML = `<ul class="wp-users">${members.map((m) => `<li class="wp-user${m.host ? ' host' : ''}"><span class="wp-ava" aria-hidden="true">${esc(letter(m.nick))}</span><span class="wp-uname">${esc(m.nick)}</span>${m.host ? '<span class="wp-role">ведущий</span>' : ''}</li>`).join('')}</ul>`;
  };

  const connect = (rid) => {
    gone = false;
    roomId = rid;
    const who = watchIdentity();
    const url = `${WATCH_PARTY_API.replace(/^http/, 'ws')}/watch/${roomId}`;
    try { ws?.close(); } catch {}
    ws = new WebSocket(url);
    ws.onopen = () => { reconnect = 0; send({ type: 'join', uid: who.uid, nick: who.nick, auth: who.auth }); paintMembers([{ nick: who.nick, host: false }]); };
    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.type === 'hello') {
        host = !!m.host;
        hostId = m.room?.hostId || '';
        sync = m.room?.sync || sync;
        film = m.room?.film || film;
        const box = id('#wpMsgs');
        if (box) box.innerHTML = '';
        (m.room?.chat || []).forEach(pushChat);
        paintMembers(m.room?.members);
        paintSync();
        const codeEl = id('#wpCode');
        if (codeEl) codeEl.textContent = roomId;
        onHello?.({ host, film, roomId, sync });
        onSync?.(sync, { snap: false });
        return;
      }
      if (m.type === 'presence') { paintMembers(m.members); return; }
      if (m.type === 'chat') { pushChat(m); return; }
      if (m.type === 'sync') {
        sync = m.sync || sync;
        paintSync();
        onSync?.(sync, { snap: !!m.snap });
        return;
      }
      if (m.type === 'film') {
        film = m.film;
        onOpenPlayer?.(film);
        onToast?.(`Ведущий выбрал: ${film?.title || 'фильм'}`, null, 2600);
        return;
      }
      if (m.type === 'host') onToast?.(`Ведущий: ${m.nick}`, null, 2000);
    };
    ws.onclose = (ev) => {
      if (gone) return;
      const el = id('#wpMembers');
      if (ev.code === 4000 || ev.code === 4003) {
        if (el) el.innerHTML = `<p class="wp-wait">${ev.code === 4003 ? 'Комната полная' : 'Комнаты нет'}</p>`;
        onStatus?.(ev.code === 4003 ? 'full' : 'missing');
        return;
      }
      if (el) el.innerHTML = '<p class="wp-wait">Переподключение…</p>';
      onStatus?.('down');
      if (++reconnect < 6) setTimeout(() => connect(roomId), 1200 * reconnect);
      else onToast?.('Чат недоступен — обнови страницу', null, 4000);
    };
  };

  id('#wpCopy')?.addEventListener('click', async (e) => {
    const link = watchRoomLink(roomId);
    try { await navigator.clipboard.writeText(link); e.target.textContent = 'Скопировано'; setTimeout(() => (e.target.textContent = 'Пригласить'), 1500); } catch { prompt('Ссылка на комнату', link); }
  });

  id('#wpForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const inp = id('#wpInput');
    const text = inp?.value?.trim();
    if (!text) return;
    send({ type: 'chat', text });
    inp.value = '';
  });

  id('#wpNick')?.addEventListener('change', (e) => {
    saveWatchNick(e.target.value);
    send({ type: 'join', ...watchIdentity() });
  });

  return {
    join(rid) {
      root.hidden = false;
      root.closest('.tm-box')?.classList.add('has-party');
      if (roomId === rid && ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
      connect(rid);
    },
    leave() {
      gone = true;
      clearInterval(clockTick); clockTick = 0;
      try { ws?.close(); } catch {}
      ws = null;
      root.hidden = true;
      root.closest('.tm-box')?.classList.remove('has-party');
    },
    publishFilm(meta) { if (!host) return; send({ type: 'film', film: meta }); film = meta; },
    pushSync(at, playing, snap = false) { broadcast(at, !!playing, !!snap); },
    setDuration(n) { if (n > dur + 1) dur = n; },
    isHost() { return host; },
    playing() { return !!sync.playing; },
    clock: clockNow,
    syncState: () => sync,
    setLocalPlayhead(sec) { window.__wpLocalAt = sec; },
    roomId: () => roomId,
  };
}