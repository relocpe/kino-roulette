// Аккаунт и списки. Без входа «Любимые» и «Просмотрено» живут только в этой вкладке (sessionStorage),
// после входа уходят на сервер. «Недавние» — локально.
export const API = 'https://kino-roulette-api.samevamp.workers.dev';
const TOK = 'kr:tok', USR = 'kr:user', SESS = 'kr:sess:lists';
let token = localStorage.getItem(TOK) || '';
let user = (() => { try { return JSON.parse(localStorage.getItem(USR)); } catch { return null; } })();
const empty = () => ({ favorites: [], watched: [] });
let lists = empty();
const loadSess = () => { try { return Object.assign(empty(), JSON.parse(sessionStorage.getItem(SESS))); } catch { return empty(); } };
const saveSess = () => { try { sessionStorage.setItem(SESS, JSON.stringify(lists)); } catch {} };
const emit = () => dispatchEvent(new CustomEvent('kr:lists'));
const emitAuth = () => dispatchEvent(new CustomEvent('kr:auth'));

export async function api(method, path, body, extra = {}) {
  const h = { ...(extra.headers || {}) };
  if (body !== undefined) h['Content-Type'] = 'application/json';
  if (token) h.Authorization = 'Bearer ' + token;
  let r;
  try { r = await fetch(API + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'include' }); }
  catch { const e = new Error('Сервер не отвечает'); e.code = 'network'; throw e; }
  let d = null; try { d = await r.json(); } catch {}
  if (!r.ok) { const e = new Error(d?.message || 'Ошибка ' + r.status); e.code = d?.error || String(r.status); e.status = r.status; throw e; }
  return d;
}

export const me = () => user;
export const loggedIn = () => !!(user && token);
export const getLists = () => lists;
export const has = (list, id) => lists[list].some((x) => x.titleId === id);
export const count = () => lists.favorites.length + lists.watched.length;
export const watchedIds = () => new Set(lists.watched.map((x) => x.titleId));

// снимок тайтла для списка
export function snap(t, posterUrl) {
  const o = { titleId: t.id, title: (t.ru || t.t || '').slice(0, 200) };
  if (t.t && t.ru && t.t !== t.ru) o.originalTitle = t.t.slice(0, 200);
  if (t.y) o.year = Number(t.y) | 0;
  if (posterUrl && /^https:/.test(posterUrl)) o.poster = posterUrl.slice(0, 500);
  o.type = t.src === 'al' ? 'anime' : /tvSeries|tvMiniSeries/.test(t.k || '') ? 'tv' : 'movie';
  if (t.r) o.rating = Math.max(0, Math.min(10, Number(t.r)));
  return o;
}

// переключить тайтл в списке; вернёт новое состояние
export async function toggle(list, item) {
  const on = !has(list, item.titleId);
  if (on) lists[list] = [{ ...item, addedAt: Math.floor(Date.now() / 1000) }, ...lists[list].filter((x) => x.titleId !== item.titleId)];
  else lists[list] = lists[list].filter((x) => x.titleId !== item.titleId);
  emit();
  if (!loggedIn()) { saveSess(); return on; }
  const { titleId, addedAt, ...snapshot } = item;
  try {
    if (on) await api('PUT', `/lists/${list}/${encodeURIComponent(titleId)}`, snapshot);
    else await api('DELETE', `/lists/${list}/${encodeURIComponent(titleId)}`);
  } catch (e) { if (e.status === 401) { logoutLocal(); } throw e; }
  return on;
}

async function pull() {
  try { const d = await api('GET', '/lists'); lists = { favorites: d.favorites || [], watched: d.watched || [] }; emit(); }
  catch (e) { if (e.status === 401) logoutLocal(); }
}
function setSession(d) {
  token = d.token; user = d.user;
  try { localStorage.setItem(TOK, token); localStorage.setItem(USR, JSON.stringify(user)); } catch {}
}
// вход / регистрация, затем перенос списков этой вкладки в аккаунт
export async function auth(kind, nickname, password) {
  const d = await api('POST', kind === 'register' ? '/auth/register' : '/auth/login', { nickname, password });
  setSession(d);
  const local = lists; let merged = 0;
  if (local.favorites.length || local.watched.length) {
    try { const m = await api('POST', '/lists/merge', { favorites: local.favorites, watched: local.watched }); merged = m.merged || 0; } catch {}
  }
  try { sessionStorage.removeItem(SESS); } catch {}
  await pull(); emitAuth();
  return { user, merged };
}
export const checkNick = (nick) => api('GET', `/auth/check?nick=${encodeURIComponent(nick)}`);
function logoutLocal() { token = ''; user = null; localStorage.removeItem(TOK); localStorage.removeItem(USR); lists = loadSess(); emit(); emitAuth(); }
export async function changePassword(current, password) { const d = await api('POST', '/auth/password', { current, password }); setSession(d); emitAuth(); return d; }
export async function deleteAccount(password) { await api('POST', '/auth/delete', { password }); try { sessionStorage.removeItem(SESS); } catch {} logoutLocal(); }
export async function logout() { try { await api('POST', '/auth/logout'); } catch {} logoutLocal(); }

export async function init() {
  if (loggedIn()) {
    try { const d = await api('GET', '/auth/me'); user = d.user; localStorage.setItem(USR, JSON.stringify(user)); await pull(); }
    catch (e) { if (e.status === 401) logoutLocal(); }
  } else { lists = loadSess(); emit(); }
  emitAuth();
}

