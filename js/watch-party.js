// Комната совместного просмотра (как Watch2Gether): чат + синхро по таймлайну ведущего.
import { me, loggedIn } from './store.js?v=14';
import { BASE } from './views.js?v=39';

export const WATCH_PARTY_API = 'https://kino-roulette-watch-party.samevamp.workers.dev';

const UID_KEY = 'kr:watchUid';
const KEY_KEY = 'kr:watchKey';
const NICK_KEY = 'kr:watchNick';
const mem = {};
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return mem[k] || null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { mem[k] = v; } },
};
const rnd = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now());

// uid публичный (виден всем в комнате), key — секрет, по нему сервер узнаёт ведущего
export function watchIdentity() {
  let uid = store.get(UID_KEY) || mem[UID_KEY];
  if (!uid) { uid = rnd(); store.set(UID_KEY, uid); }
  let key = store.get(KEY_KEY) || mem[KEY_KEY];
  if (!key) { key = rnd() + rnd(); store.set(KEY_KEY, key); }
  const user = me();
  const nick = (user?.nickname || store.get(NICK_KEY) || '').trim()
    || `Гость-${uid.slice(0, 4)}`;
  return { uid, key, nick, auth: loggedIn() };
}

export function saveWatchNick(nick) {
  const t = String(nick || '').trim().slice(0, 24);
  if (t) store.set(NICK_KEY, t);
}

export async function createWatchRoom() {
  const who = watchIdentity();
  const r = await fetch(`${WATCH_PARTY_API}/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostId: who.uid, hostKey: who.key }),
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

export function openWatchPanel(root, { onOpenPlayer, onToast, onHello, onStatus, onSync, onChat, onGo, onHost } = {}) {
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
    const seek = id('[data-wp-seek]');
    if (seek && document.activeElement !== seek) {
      const max = Math.max(dur || 0, now, 1);
      seek.max = String(Math.ceil(max));
      seek.value = String(Math.min(Math.floor(now), Math.ceil(max)));
    }
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

  const paintSync = () => {
    const el = id('#wpSync');
    if (!el) return;
    el.hidden = true;
    el.replaceChildren();
  };

  const pushChat = (entry, quiet) => {
    const box = id('#wpMsgs');
    if (!box) return;
    const row = document.createElement('p');
    row.className = 'wp-msg';
    row.innerHTML = `<span class="wp-who">${esc(entry.nick)}</span><span class="wp-text">${esc(entry.text)}</span>`;
    box.appendChild(row);
    box.scrollTop = box.scrollHeight;
    while (box.children.length > 100) box.firstChild.remove();
    if (!quiet) onChat?.(entry);
  };

  const paintMembers = (members) => {
    const el = id('#wpMembers');
    if (!el) return;
    if (!members?.length) { el.innerHTML = '<p class="wp-wait">Подключаемся…</p>'; return; }
    const letter = (nick) => { const s = String(nick || '').trim(); return s ? [...s][0].toUpperCase() : '?'; };
    el.innerHTML = `<ul class="wp-users">${members.map((m) => `<li class="wp-user${m.host ? ' host' : ''}"><span class="wp-ava" aria-hidden="true">${esc(letter(m.nick))}</span><span class="wp-uname">${esc(m.nick)}</span>${m.host ? '<span class="wp-role">ведущий</span>' : ''}</li>`).join('')}</ul>`;
  };

  // ведущий пропал из комнаты (закрыл вкладку): через несколько секунд кто-то из гостей занимает его место, сервер пускает только одного
  let claimT = 0;
  const watchForHost = (list) => {
    clearTimeout(claimT);
    if (host || !list?.length || list.some((x) => x.host)) return;
    claimT = setTimeout(() => send({ type: 'claim_host' }), 6000 + Math.random() * 2500);
  };
  const connect = (rid) => {
    gone = false;
    roomId = rid;
    const who = watchIdentity();
    const url = `${WATCH_PARTY_API.replace(/^http/, 'ws')}/watch/${roomId}`;
    try { ws?.close(); } catch {}
    ws = new WebSocket(url);
    ws.onopen = () => { reconnect = 0; send({ type: 'join', uid: who.uid, key: who.key, nick: who.nick, auth: who.auth }); paintMembers([{ nick: who.nick, host: false }]); };
    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.type === 'hello') {
        host = !!m.host;
        hostId = m.room?.hostId || '';
        sync = m.room?.sync || sync;
        film = m.room?.film || film;
        const box = id('#wpMsgs');
        if (box) box.innerHTML = '';
        (m.room?.chat || []).forEach((entry) => pushChat(entry, true));
        paintMembers(m.room?.members);
        watchForHost(m.room?.members);
        paintSync();
        const codeEl = id('#wpCode');
        if (codeEl) codeEl.textContent = roomId;
        onHello?.({ host, film, roomId, sync });
        onSync?.(sync, { snap: false });
        return;
      }
      if (m.type === 'presence') { const list = m.members?.map((x) => ({ ...x, host: x.host ?? (!!hostId && x.uid === hostId) })); paintMembers(list); watchForHost(list); return; }
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
      if (m.type === 'go') { onGo?.(m.at | 0); return; }
      if (m.type === 'host') {
        hostId = m.hostId || hostId;
        host = !!hostId && hostId === watchIdentity().uid;
        clearTimeout(claimT);
        paintSync();
        onHost?.({ host, nick: m.nick });
        onToast?.(`Ведущий: ${m.nick}`, null, 2000);
      }
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
    const btn = e.currentTarget;
    const prev = btn.dataset.label || btn.textContent;
    btn.dataset.label = prev;
    const link = watchRoomLink(roomId);
    try { await navigator.clipboard.writeText(link); btn.textContent = 'Скопировано'; setTimeout(() => { btn.textContent = prev; }, 1500); } catch { prompt('Ссылка на комнату', link); }
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
      gone = true; clearTimeout(claimT);
      clearInterval(clockTick); clockTick = 0;
      try { ws?.close(); } catch {}
      ws = null;
      root.hidden = true;
      root.closest('.tm-box')?.classList.remove('has-party');
    },
    publishFilm(meta) { if (!host) return; send({ type: 'film', film: meta }); film = meta; },
    startTogether(at) { if (!host) return; send({ type: 'go', at: Math.max(0, Number(at) || 0) }); },
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