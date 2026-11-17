// Комната совместного просмотра (как Watch2Gether): чат + синхро по таймлайну ведущего.
import { me, loggedIn } from './store.js?v=13';

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
  const r = await fetch(`${WATCH_PARTY_API}/create`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'create_failed');
  return d;
}

export function watchRoomLink(roomId, basePath) {
  const base = (basePath || '/').replace(/\/?$/, '/');
  return `${location.origin}${base}watch/${roomId}`;
}

function fmtClock(sec) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const x = s % 60;
  if (h) return `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`;
  return `${m}:${String(x).padStart(2, '0')}`;
}

export function openWatchPanel(root, { onOpenPlayer, onToast } = {}) {
  if (!root) return () => {};
  const id = (sel) => root.querySelector(sel);

  let ws = null;
  let roomId = '';
  let host = false;
  let hostId = '';
  let sync = { at: 0, playing: false, wall: 0 };
  let film = null;
  let reconnect = 0;

  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const send = (msg) => { try { ws?.send(JSON.stringify(msg)); } catch {} };

  const paintSync = () => {
    const el = id('#wpSync');
    if (!el) return;
    const now = sync.playing && sync.wall ? sync.at + (Date.now() - sync.wall) / 1000 : sync.at || 0;
    const drift = host ? 0 : (window.__wpDrift || 0);
    el.innerHTML = `<div class="wp-sync-line"><span class="wp-led${sync.playing ? ' on' : ''}"></span><span>${sync.playing ? 'Идёт' : 'Пауза'} · <b>${fmtClock(now)}</b></span>${!host && Math.abs(drift) > 4 ? `<span class="wp-drift">${drift > 0 ? 'отстаёшь' : 'опережаешь'} ~${Math.abs(Math.round(drift))}с</span>` : ''}</div>
      ${host ? `<div class="wp-host-ctl" role="group" aria-label="Управление для всех">
        <button type="button" data-wp-play>▶ Старт</button>
        <button type="button" data-wp-pause>⏸ Пауза</button>
        <input type="range" data-wp-seek min="0" max="7200" value="${Math.floor(now)}" aria-label="Время">
      </div>` : `<p class="wp-hint muted">Ведущий задаёт темп. Запусти плеер у себя в тот же момент — смотри таймер и чат.</p>`}`;
    if (host) {
      const play = id('[data-wp-play]');
      const pause = id('[data-wp-pause]');
      const seek = id('[data-wp-seek]');
      play?.addEventListener('click', () => {
        const at = seek ? +seek.value : now;
        sync = { at, playing: true, wall: Date.now() };
        send({ type: 'sync', at, playing: true });
        paintSync();
      });
      pause?.addEventListener('click', () => {
        const at = sync.playing && sync.wall ? sync.at + (Date.now() - sync.wall) / 1000 : sync.at;
        sync = { at, playing: false, wall: 0 };
        send({ type: 'sync', at, playing: false });
        paintSync();
      });
      seek?.addEventListener('input', () => {
        const at = +seek.value;
        sync = { at, playing: false, wall: 0 };
        send({ type: 'sync', at, playing: false });
        paintSync();
      });
    }
  };

  const pushChat = (entry) => {
    const box = id('#wpMsgs');
    if (!box) return;
    const row = document.createElement('p');
    row.className = 'wp-msg';
    row.innerHTML = `<b>${esc(entry.nick)}</b> ${esc(entry.text)}`;
    box.appendChild(row);
    box.scrollTop = box.scrollHeight;
    while (box.children.length > 100) box.firstChild.remove();
  };

  const paintMembers = (members) => {
    const el = id('#wpMembers');
    if (!el) return;
    el.textContent = members?.length ? members.map((m) => `${m.nick}${m.host ? ' ★' : ''}${m.auth ? ' ✓' : ''}`).join(' · ') : '…';
  };

  const connect = (rid) => {
    roomId = rid;
    const who = watchIdentity();
    const url = `${WATCH_PARTY_API.replace(/^http/, 'ws')}/watch/${roomId}`;
    try { ws?.close(); } catch {}
    ws = new WebSocket(url);
    ws.onopen = () => { reconnect = 0; send({ type: 'join', uid: who.uid, nick: who.nick, auth: who.auth }); };
    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.type === 'hello') {
        host = !!m.host;
        hostId = m.room?.hostId || '';
        sync = m.room?.sync || sync;
        film = m.room?.film || film;
        (m.room?.chat || []).forEach(pushChat);
        paintMembers(m.room?.members);
        paintSync();
        const codeEl = id('#wpCode');
        if (codeEl) codeEl.textContent = roomId;
        if (film?.title && onOpenPlayer && id('#wpFilm')) {
          id('#wpFilm').textContent = film.title;
        }
        return;
      }
      if (m.type === 'presence') { paintMembers(m.members); return; }
      if (m.type === 'chat') { pushChat(m); return; }
      if (m.type === 'sync') {
        sync = m.sync || sync;
        if (!host) {
          const now = sync.playing && sync.wall ? sync.at + (Date.now() - sync.wall) / 1000 : sync.at;
          window.__wpLocalAt = window.__wpLocalAt || 0;
          window.__wpDrift = now - window.__wpLocalAt;
        }
        paintSync();
        return;
      }
      if (m.type === 'film') {
        film = m.film;
        if (id('#wpFilm')) id('#wpFilm').textContent = film?.title || '';
        onOpenPlayer?.(film);
        onToast?.(`Ведущий выбрал: ${film?.title || 'фильм'}`, null, 2600);
        return;
      }
      if (m.type === 'host') onToast?.(`Ведущий: ${m.nick}`, null, 2000);
    };
    ws.onclose = () => {
      if (++reconnect < 6) setTimeout(() => connect(roomId), 1200 * reconnect);
    };
  };

  id('#wpCopy')?.addEventListener('click', async (e) => {
    const link = watchRoomLink(roomId, root.dataset.base || '/');
    try { await navigator.clipboard.writeText(link); e.target.textContent = 'Скопировано'; setTimeout(() => (e.target.textContent = 'Ссылка'), 1500); } catch { prompt('Ссылка', link); }
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
    join(rid) { root.hidden = false; root.closest('.tm-box')?.classList.add('has-party'); connect(rid); },
    leave() { try { ws?.close(); } catch {} ws = null; root.hidden = true; root.closest('.tm-box')?.classList.remove('has-party'); },
    publishFilm(meta) { if (!host) return; send({ type: 'film', film: meta }); film = meta; if (id('#wpFilm')) id('#wpFilm').textContent = meta.title || ''; },
    isHost() { return host; },
    setLocalPlayhead(sec) { window.__wpLocalAt = sec; },
    roomId: () => roomId,
  };
}