// Разделы: Каталог, подборки, /title/:id, На двоих, Мои списки, вход. Роутинг по путям (на GitHub Pages — через 404.html).
import { GENRES, GENRE_RU, genreOk } from './chips.js?v=10';
import { getJSON, norm, normAnime, poster, animeReady, isAnime, isIndianTitle, searchSnapTitles } from './api.js?v=14';
import * as S from './store.js?v=11';
import { ruCached, localize, ruTitles } from './ru.js?v=2';
import { mountYearRange, YEAR_RANGE_MAX } from './year-range.js?v=1';
import { clearProgress } from './watch-progress.js?v=1';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const B = 'https://api.tiffara.com';
const mobile = () => matchMedia('(max-width: 760px)').matches;
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
export const BASE = /^\/kino-roulette(\/|$)/.test(location.pathname) ? '/kino-roulette/' : '/';
const view = $('#view');
let H = {}; // крючки из app.js

// ---------- иконки ----------
export const IC = {
  heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7.5-4.6-9.2-9.3C1.7 7.6 3.6 4.5 7 4.5c2 0 3.7 1.2 5 3 1.3-1.8 3-3 5-3 3.4 0 5.3 3.1 4.2 6.2C19.5 15.4 12 20 12 20z" fill="var(--hf, none)" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  eye: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" stroke-linejoin="round"/><circle cx="12" cy="12" r="3"/><path class="eyeok" d="M8.5 12.2l2.3 2.3 4.7-4.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" fill="currentColor"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  l: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  r: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
  eyeOpen: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>',
};

// ---------- тост ----------
let toastT = 0;
export function toast(msg, btn, ms = 2400) {
  const t = $('#toast'); $('#status').textContent = msg || '';
  const b = $('#toastBtn'); b.hidden = !btn; if (btn) { b.textContent = btn[0]; b.onclick = () => { t.hidden = true; btn[1](); }; }
  t.hidden = !msg; clearTimeout(toastT);
  if (msg && ms) toastT = setTimeout(() => { if ($('#status').textContent === msg) t.hidden = true; }, ms);
}

// ---------- ♡ и «просмотрено» ----------
const items = new Map(); // id → снимок для списков
export function remember(t) { const s = S.snap(t, t.i ? poster(t.i, 300) : t.poster); items.set(t.id, s); return s; }
let likes = 0, nudged = false;
export async function act(list, id, btn) {
  const item = items.get(id); if (!item) return;
  let on;
  try { on = await S.toggle(list, item); } catch (e) { toast(e.message || 'Не получилось сохранить'); syncButtons(); return; }
  syncButtons();
  if (btn && on && list === 'favorites' && !reduce.matches) btn.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.2)' }, { transform: 'scale(1)' }], { duration: 280, easing: 'cubic-bezier(.16,1,.3,1)' });
  const undo = ['Отменить', () => act(list, id)];
  if (!on) return toast(list === 'favorites' ? 'Убрали из любимых' : 'Убрали из просмотренного', null);
  if (list === 'watched' && on) clearProgress(id);
  if (!S.loggedIn()) {
    if (list === 'favorites') likes++;
    if (!nudged || likes % 5 === 0) { nudged = true; return toast('Без входа не сохранится, только до закрытия вкладки. Войди, чтобы сохранить', ['Войти', () => openAuth('login')], 5000); }
  }
  toast(list === 'favorites' ? 'Добавлено в любимые' : 'Отмечено как просмотренное', undo);
}
export function syncButtons(root = document) {
  root.querySelectorAll('[data-fav]').forEach((b) => { const on = S.has('favorites', b.dataset.fav); b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); b.title = on ? 'Убрать из любимых' : 'В любимые'; });
  root.querySelectorAll('[data-seen]').forEach((b) => { const on = S.has('watched', b.dataset.seen); b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); b.title = on ? 'Не смотрел' : 'Просмотрено'; });
  const n = S.count(), badge = $('#listBadge'); if (badge) { badge.textContent = n > 99 ? '99+' : String(n); badge.hidden = !n; }
}
export const iconBtns = (id, cls = 'ib2') => `<button class="${cls} fav" type="button" data-fav="${esc(id)}" aria-pressed="false" aria-label="В любимые">${IC.heart}</button><button class="${cls} seen" type="button" data-seen="${esc(id)}" aria-pressed="false" aria-label="Просмотрено">${IC.eye}</button>`;
document.addEventListener('click', (e) => {
  const f = e.target.closest('[data-fav]'), w = e.target.closest('[data-seen]');
  if (f || w) { e.preventDefault(); e.stopPropagation(); act(f ? 'favorites' : 'watched', (f || w).dataset[f ? 'fav' : 'seen'], f || w); }
}, true);
addEventListener('kr:lists', () => { syncButtons(); if (route.name === 'me') renderMe(route.tab, true); });

// ---------- данные ----------
const TYPES = { all: ['MOVIE', 'TV_SERIES', 'TV_MINI_SERIES'], movie: ['MOVIE'], series: ['TV_SERIES', 'TV_MINI_SERIES'] };
const qs = (o) => Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length)).flatMap(([k, v]) => [].concat(v).map((x) => `${k}=${encodeURIComponent(x)}`)).join('&');
const AL = 'https://graphql.anilist.co';
const ALF = 'id idMal title{romaji english native} format episodes startDate{year} endDate{year} averageScore popularity genres tags{name rank} coverImage{extraLarge large} trailer{id site} description(asHtml:false) duration';
async function alq(query, variables) {
  const key = 'alv:' + JSON.stringify(variables) + query.length;
  try { const c = sessionStorage.getItem(key); if (c) return JSON.parse(c); } catch {}
  const r = await fetch(AL, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ query, variables }) });
  if (!r.ok) throw new Error('AniList ' + r.status);
  const d = (await r.json()).data; try { sessionStorage.setItem(key, JSON.stringify(d)); } catch {}
  return d;
}
const AFMT = { movie: ['MOVIE'], series: ['TV', 'TV_SHORT', 'ONA', 'OVA'], all: ['TV', 'TV_SHORT', 'MOVIE', 'ONA', 'OVA'] };
AFMT.anime = AFMT.all;
// жанры каталога → жанры/теги AniList (режим «Аниме»)
const alOf = (f, k) => { const a = [...new Set((f.genres || []).flatMap((id) => GENRES.find((g) => g.id === id)?.al?.[k] || []))]; return a.length ? a : undefined; };
async function alPage(page, f) {
  const d = await alq(`query($p:Int,$f:[MediaFormat],$s:[MediaSort],$sc:Int,$a:FuzzyDateInt,$b:FuzzyDateInt,$g:[String],$tg:[String]){Page(page:$p,perPage:40){pageInfo{total hasNextPage} media(type:ANIME,isAdult:false,format_in:$f,sort:$s,genre_in:$g,tag_in:$tg,minimumTagRank:60,averageScore_greater:$sc,startDate_greater:$a,startDate_lesser:$b){${ALF}}}}`,
    { g: alOf(f, 'g'), tg: alOf(f, 'tag'), p: page, f: AFMT[f.mode || 'all'], s: [f.sort === 'year' ? 'START_DATE_DESC' : f.sort === 'pop' ? 'POPULARITY_DESC' : 'SCORE_DESC'], sc: f.rating ? Math.round(f.rating * 10) - 1 : undefined, a: f.from ? f.from * 10000 : undefined, b: f.to ? (f.to + 1) * 10000 : undefined });
  return { list: d.Page.media.map(normAnime), total: d.Page.pageInfo.total, next: d.Page.pageInfo.hasNextPage ? page + 1 : null };
}
const SORTS = { rating: ['SORT_BY_USER_RATING', 'DESC'], pop: ['SORT_BY_POPULARITY', 'ASC'], year: ['SORT_BY_RELEASE_DATE', 'DESC'] };
// страница каталога: f = {q, mode, genres[], from, to, rating, sort, votes}
async function fetchPage(f, tok) {
  if (f.q) {
    if (tok) return { list: [], next: null };
    const q = f.q.trim();
    const mode = f.mode || 'all';
  const dedup = new Map();
  const add = (arr) => { for (const t of arr || []) if (t?.id && t.i && !dedup.has(t.id)) dedup.set(t.id, t); };
    const jobs = [
      getJSON(`${B}/search/titles?query=${encodeURIComponent(q)}&limit=50`).then((d) => add(
        (d.titles || []).filter((x) => /movie|tvSeries|tvMiniSeries/.test(x.type)).map(norm).filter((t) => !isIndianTitle(t)),
      )).catch(() => {}),
      searchSnapTitles(q, mode).then((rows) => add(rows)),
    ];
    if (mode === 'anime' || mode === 'all') {
      jobs.push(alq(`query($q:String){Page(page:1,perPage:40){media(search:$q,type:ANIME,isAdult:false){${ALF}}}}`, { q }).then((d) => add((d?.Page?.media || []).map(normAnime))).catch(() => {}));
    }
    await Promise.all(jobs);
    const list = [...dedup.values()].sort((a, b) => (b.v || 0) - (a.v || 0));
    return { list, total: list.length, next: null };
  }
  if (f.genres?.includes('anime')) f = { ...f, mode: 'anime', genres: f.genres.filter((x) => x !== 'anime') }; // старые ссылки и комнаты
  if (f.mode === 'anime') return alPage(tok || 1, f);
  await animeReady;
  const gq = [...new Set((f.genres || []).flatMap((id) => [].concat(GENRES.find((g) => g.id === id)?.q?.genres || []).slice(0, 1)))];
  const [sortBy, sortOrder] = SORTS[f.sort || 'rating'];
  const p = { types: TYPES[f.mode || 'all'], genres: gq, startYear: f.from, endYear: f.to, minAggregateRating: f.rating || undefined, minVoteCount: f.votes || (f.sort === 'year' ? 2000 : 15000), sortBy, sortOrder, excludeCountryCodes: 'IN', excludePrimaryLanguageCodes: 'hi,ta,te,ml,kn,bn,mr,pa,gu' };
  const d = await getJSON(`${B}/titles?${qs(p)}${tok ? '&pageToken=' + encodeURIComponent(tok) : ''}`);
  // аниме с IMDb в «Фильмах» и «Сериалах» не показываем — для него есть режим «Аниме»
  return { list: (d.titles || []).map(norm).filter((t) => !isAnime(t) && !isIndianTitle(t)), total: d.totalCount, next: d.nextPageToken || null };
}
export async function getTitle(id) {
  if (/^al\d+$/.test(id)) { const d = await alq(`query($id:Int){Media(id:$id,type:ANIME){${ALF}}}`, { id: +id.slice(2) }); return normAnime(d.Media); }
  return norm(await getJSON(`${B}/titles/${id}`));
}

// ---------- плитки и сетка ----------
const yr = (t) => (t.y ? String(t.y) : '');
function tile(t) {
  remember(t);
  const title = t.ru || ruCached(t.id) || t.t || t.title || '';
  const meta = [yr(t), t.r ? `${Number(t.r).toFixed(1)}★` : ''].filter(Boolean).join(' · ');
  const src = t.i ? poster(t.i, 300) : t.poster || '';
  return `<a class="tile" href="title/${esc(t.id)}" data-nav data-id="${esc(t.id)}"><div class="tp">${src ? `<img src="${esc(src)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : ''}<span class="tph">${esc(title)}</span><div class="tacts">${iconBtns(t.id, 'tb')}</div></div><b>${esc(title)}</b><small>${esc(meta)}</small></a>`;
}
const skel = (n) => Array.from({ length: n }, () => '<div class="tile sk"><div class="tp"></div><b></b><small></small></div>').join('');
const tileKey = (t) => `${(t.ru || ruCached(t.id) || t.t || '').trim().toLowerCase()}|${t.y || ''}`;
function grid(el, f, { onTotal } = {}) {
  let next = undefined, busy = false, done = false, seenIds = new Set(), seenTitles = new Set(), my = {};
  el.innerHTML = skel(mobile() ? 12 : 16); el.dataset.state = 'load';
  const sent = document.createElement('div'); sent.className = 'sent';
  const io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) more(); }, { rootMargin: '800px' });
  async function more() {
    if (busy || done) return; busy = true;
    if (next !== undefined) el.insertAdjacentHTML('beforeend', skel(8));
    try {
      const r = await fetchPage(f, next);
      if (el.my !== my) return;
      el.querySelectorAll('.sk').forEach((x) => x.remove());
      const add = r.list.filter((t) => {
        if (!t.i || seenIds.has(t.id)) return false;
        const k = tileKey(t);
        if (seenTitles.has(k)) return false;
        seenIds.add(t.id); seenTitles.add(k);
        return true;
      });
      el.insertAdjacentHTML('beforeend', add.map(tile).join('')); localize(el);
      if (next === undefined) { onTotal?.(r.total ?? add.length); if (!add.length) el.innerHTML = '<p class="empty">Ничего не нашлось. Попробуй убрать фильтры или поискать иначе.</p>'; }
      next = r.next; done = !next; syncButtons(el);
      if (!done) el.after(sent); else sent.remove();
    } catch { el.querySelectorAll('.sk').forEach((x) => x.remove()); if (next === undefined) { el.innerHTML = `<div class="empty err"><p>${navigator.onLine === false ? 'Нет интернета. Проверь связь.' : 'Сервер с данными не ответил.'}</p><button class="btn" type="button" data-retry>Повторить</button></div>`; el.querySelector('[data-retry]').onclick = () => { el.innerHTML = skel(mobile() ? 12 : 16); done = false; more(); }; } else { done = false; sent.remove(); el.insertAdjacentHTML('beforeend', '<div class="empty err more"><button class="btn" type="button" data-retry>Не загрузилось. Повторить</button></div>'); el.querySelector('.more [data-retry]').onclick = (e) => { e.currentTarget.parentNode.remove(); el.after(sent); more(); }; } }
    finally { busy = false; el.dataset.state = ''; }
  }
  el.my = my; io.observe(sent); el.after(sent); more();
  return () => { io.disconnect(); sent.remove(); el.my = null; };
}

// ---------- подборки ----------
export const MOODS = [
  { slug: 'plakat', title: 'Поплакать', sub: 'Драмы, после которых нужен чай', f: { mode: 'movie', genres: ['drama', 'romance'], rating: 7.4, votes: 40000, sort: 'rating' }, spin: { sel: ['drama', 'romance'], rating: 7.5 } },
  { slug: 'mozg', title: 'Выключить мозг', sub: 'Ничего не надо понимать', f: { mode: 'movie', genres: ['comedy', 'action'], votes: 100000, sort: 'pop' }, spin: { sel: ['comedy', 'action'], rating: 6 } },
  { slug: 'strashno', title: 'На ночь страшное', sub: 'Ужасы и триллеры с хорошим рейтингом', f: { mode: 'movie', genres: ['horror'], rating: 6.8, votes: 40000, sort: 'rating' }, spin: { sel: ['horror', 'thriller'], rating: 7 } },
  { slug: 'roditeli', title: 'С родителями', sub: 'Без неловких сцен', f: { mode: 'movie', genres: ['family'], rating: 7, votes: 30000, sort: 'rating' }, spin: { sel: ['family', 'animation'], rating: 7 } },
  { slug: 'golova', title: 'Сломать голову', sub: 'Сюжет, который не отпускает до титров', f: { mode: 'movie', genres: ['mystery', 'thriller'], rating: 7.4, votes: 80000, sort: 'rating' }, spin: { sel: ['mystery', 'thriller'], rating: 7.5 } },
  { slug: 'kult', title: 'Культовое', sub: 'То, что все цитируют', f: { mode: 'movie', votes: 900000, sort: 'rating' }, spin: { sel: [], rating: 8, known: true } },
];
const collage = new Map();
async function moodPosters(m) {
  if (collage.has(m.slug)) return collage.get(m.slug);
  const p = fetchPage({ ...m.f, sort: m.f.sort }, undefined).then((r) => r.list.filter((t) => t.i).slice(0, 5).map((t) => poster(t.i, 300))).catch(() => []);
  collage.set(m.slug, p); return p;
}
const collHTML = (urls, n = 3) => urls.slice(0, n).map((u) => `<img src="${esc(u)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">`).join('');
function moodCards() {
  return `<div class="moods" role="list">${MOODS.map((m) => `<a class="mood" role="listitem" href="catalog/mood/${m.slug}" data-nav data-slug="${m.slug}"><div class="mcol"></div><b>${esc(m.title)}</b></a>`).join('')}</div>`;
}
function fillMoods(root) {
  root.querySelectorAll('.mood').forEach((a) => { const m = MOODS.find((x) => x.slug === a.dataset.slug); moodPosters(m).then((u) => { a.querySelector('.mcol').innerHTML = collHTML(u); }); });
}

// ---------- фильтры каталога ----------
const DECS = [[0, 1969, 'до 70-х'], [1970, 1979, '70-е'], [1980, 1989, '80-е'], [1990, 1999, '90-е'], [2000, 2009, '00-е'], [2010, 2019, '10-е'], [2020, YEAR_RANGE_MAX, '20-е']];
const cat = { q: '', mode: 'all', genres: [], from: undefined, to: undefined, rating: 0, sort: 'rating' };
const yearLabel = (f) => {
  if (!f.from && !f.to) return 'Любые';
  const decade = DECS.find((d) => d[0] === (f.from || 0) && d[1] === (f.to || YEAR_RANGE_MAX));
  if (decade) return decade[2];
  if (f.from && f.to && Number(f.from) === Number(f.to)) return String(f.from);
  return `${f.from || '…'}–${f.to || '…'}`;
};
const fieldVals = (f) => ({
  type: { all: 'Фильмы и сериалы', movie: 'Фильмы', series: 'Сериалы', anime: 'Аниме' }[f.mode],
  genre: f.genres.length ? f.genres.map((id) => GENRES.find((g) => g.id === id)?.label).slice(0, 2).join(', ') + (f.genres.length > 2 ? ` +${f.genres.length - 2}` : '') : 'Любой',
  years: yearLabel(f),
  rate: f.rating ? `от ${f.rating}` : 'Любой',
});
const nFilters = (f) => (f.mode !== 'all') + !!f.genres.length + !!(f.from || f.to) + !!f.rating;
function filterRow(f, { onChange, readonly = false, sort = true } = {}) {
  const v = fieldVals(f);
  let yearInputsChanged = false;
  const fld = (k, lbl) => `<button class="cf" type="button" data-k="${k}"${readonly ? ' disabled' : ''}><small>${lbl}</small><span>${esc(v[k])}</span></button>`;
  const wrap = document.createElement('div'); wrap.className = 'crow';
  wrap.innerHTML = `<div class="cfs">${fld('type', 'Что')}${fld('genre', 'Жанр')}${fld('years', 'Годы')}${fld('rate', 'Рейтинг')}</div>
    <button class="cfsum" type="button"${readonly ? ' disabled aria-label="Фильтры задаёт создатель комнаты"' : ''}>${readonly ? esc([v.type, v.genre, v.years, v.rate].join(' · ')) : nFilters(f) ? `Фильтры · ${nFilters(f)}` : 'Фильтры'}<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg></button>
    ${sort ? `<div class="cmeta"><label class="csort"><span class="sr">Сортировка</span><select><option value="rating">По рейтингу</option><option value="pop">По популярности</option><option value="year">Сначала новые</option></select></label><span class="ccount"></span></div>` : ''}`;
  const sel = wrap.querySelector('select'); if (sel) { sel.value = f.sort; sel.onchange = () => { f.sort = sel.value; onChange(); }; }
  wrap.querySelectorAll('.cf').forEach((b) => (b.onclick = () => pop(b, b.dataset.k)));
  wrap.querySelector('.cfsum').onclick = (e) => pop(e.currentTarget, 'all');
  function pop(anchor, k) {
    const d = $('#cpop'); d.dataset.k = k; d.classList.toggle('sheet', mobile() || k === 'all');
    const secs = k === 'all' ? ['type', 'genre', 'years', 'rate'] : [k];
    const H2 = { type: 'Что', genre: 'Жанры', years: 'Годы', rate: 'Рейтинг' };
    d.innerHTML = `<div class="cpin">${secs.map((s) => `<section data-s="${s}"><h3 class="slabel">${H2[s]}${s === 'genre' ? ` <span class="cnt">${f.genres.length ? f.genres.length + ' из 3' : ''}</span>` : ''}</h3>${body(s)}</section>`).join('')}
      <div class="pfoot"><button class="ghost" type="button" data-x="reset">Сбросить</button><button class="ok" type="button" data-x="done">${k === 'all' ? 'Показать' : 'Готово'}</button></div></div>`;
    const yearRangeHost = d.querySelector('[data-year-range-host]');
    if (yearRangeHost) {
      mountYearRange(yearRangeHost, {
        from: f.from,
        to: f.to,
        onInput: ({ from, to }) => {
          f.from = from;
          f.to = to;
          yearInputsChanged = true;
          const low = from || 0, high = to || YEAR_RANGE_MAX;
          yearRangeHost.parentElement.querySelectorAll('.dec [data-a]').forEach((chip) => {
            chip.setAttribute('aria-pressed', String(+chip.dataset.a === low && +chip.dataset.b === high));
          });
          refresh();
        },
        onChange: () => {
          if (yearInputsChanged) onChange?.();
          yearInputsChanged = false;
        },
      });
    }
    function body(s) {
      if (s === 'type') return `<div class="opts">${[['all', 'Фильмы и сериалы'], ['movie', 'Фильмы'], ['series', 'Сериалы'], ['anime', 'Аниме']].map(([m, l]) => `<button type="button" role="radio" data-mode="${m}" aria-checked="${f.mode === m}">${l}</button>`).join('')}</div>`;
      if (s === 'genre') return `<div class="glist">${GENRES.filter((g) => genreOk(g, f.mode)).map((g) => `<div class="grp${f.genres.length >= 3 && !f.genres.includes(g.id) ? ' off' : ''}"><div class="grow"><button type="button" class="gopt" data-g="${g.id}" aria-checked="${f.genres.includes(g.id)}"><i class="cb"><svg viewBox="0 0 24 24" width="12" height="12"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg></i><span>${esc(g.label)}</span></button></div></div>`).join('')}</div>`;
      if (s === 'years') return `<div class="dec">${DECS.map(([a, b, l]) => `<button type="button" class="chip" data-a="${a}" data-b="${b}" aria-pressed="${(f.from || 0) === a && (f.to || YEAR_RANGE_MAX) === b}">${l}</button>`).join('')}</div><div data-year-range-host></div>`;
      return `<div class="opts">${[[0, 'Любой'], [6, 'от 6'], [7, 'от 7'], [7.5, 'от 7.5'], [8, 'от 8']].map(([r, l]) => `<button type="button" role="radio" data-r="${r}" aria-checked="${(f.rating || 0) === r}">${l}</button>`).join('')}</div>`;
    }
    d.onclick = (e) => {
      const b = e.target.closest('button'); if (!b) { if (e.target === d) d.close(); return; }
      if (b.dataset.mode) { f.mode = b.dataset.mode; f.genres = f.genres.filter((id) => genreOk(GENRES.find((g) => g.id === id), f.mode)); }
      else if (b.dataset.g) { const g = b.dataset.g; f.genres = f.genres.includes(g) ? f.genres.filter((x) => x !== g) : f.genres.length < 3 ? [...f.genres, g] : f.genres; }
      else if (b.dataset.a) { const a = +b.dataset.a, z = +b.dataset.b; const on = (f.from || 0) === a && f.to === z; f.from = on ? undefined : a || 1900; f.to = on ? undefined : z; if (!on && a === 0) f.from = undefined; }
      else if (b.dataset.r) f.rating = +b.dataset.r;
      else if (b.dataset.x === 'reset') { if (k === 'all' || k === 'type') f.mode = 'all'; if (k === 'all' || k === 'genre') f.genres = []; if (k === 'all' || k === 'years') f.from = f.to = undefined; if (k === 'all' || k === 'rate') f.rating = 0; }
      else if (b.dataset.x === 'done') { d.close(); return; }
      const k2 = d.dataset.k; pop.redraw?.(); onChange(); refresh(); if ((k2 === 'type' || k2 === 'rate') && !d.classList.contains('sheet') && !b.dataset.x) d.close(); else pop(anchor, k2);
    };
    if (!d.open) d.showModal();
    if (!d.classList.contains('sheet')) {
      const r = anchor.getBoundingClientRect(), w = k === 'genre' ? 560 : k === 'years' ? 520 : 300;
      d.style.width = w + 'px'; d.style.left = Math.max(12, Math.min(innerWidth - w - 12, r.left)) + 'px'; d.style.top = r.bottom + 8 + 'px'; d.style.bottom = 'auto';
    } else { d.style.width = d.style.left = d.style.top = d.style.bottom = ''; }
  }
  function refresh() { const v2 = fieldVals(f); wrap.querySelectorAll('.cf').forEach((b) => (b.querySelector('span').textContent = v2[b.dataset.k])); const n = nFilters(f); wrap.querySelector('.cfsum').firstChild.textContent = n ? `Фильтры · ${n}` : 'Фильтры'; }
  wrap.refresh = refresh;
  return wrap;
}

// ---------- роутер ----------
export let route = { name: 'roulette' };
function parse(path) {
  const p = path.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (!p.length) return { name: 'roulette' };
  if (p[0] === 'catalog') return p[1] === 'mood' && p[2] ? { name: 'mood', slug: p[2] } : { name: 'catalog' };
  if (p[0] === 'title' && p[1]) return { name: 'title', id: p[1] };
  if (p[0] === 'together') return p[1] ? { name: 'room', code: p[1].toUpperCase().slice(0, 4) } : { name: 'together' };
  if (p[0] === 'about') return { name: 'about' };
  if (p[0] === 'me') return { name: 'me', tab: ['favorites', 'watched', 'recent'].includes(p[1]) ? p[1] : 'favorites' };
  return { name: 'roulette' };
}
const rel = () => location.pathname.slice(BASE.length - 1);
export function navigate(path, { replace = false, keepScroll = false } = {}) {
  const url = BASE + path.replace(/^\//, '');
  if (url !== location.pathname + location.search) history[replace ? 'replaceState' : 'pushState']({}, '', url);
  show(parse(path), keepScroll);
}
// результат рулетки получает свой адрес, но остаётся на месте
export function setUrl(path) { history.replaceState({}, '', BASE + path.replace(/^\//, '')); }
let cleanup = null;
function show(r, keepScroll) {
  cleanup?.(); cleanup = null;
  const prev = route; route = r;
  document.body.dataset.route = r.name;
  H.fxRoute?.();
  $('#cpop')?.open && $('#cpop').close();
  document.querySelectorAll('[data-sec-link]').forEach((a) => { const on = a.dataset.secLink === secOf(r.name); a.classList.toggle('on', on); on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'); });
  moveDot();
  const isRoulette = r.name === 'roulette', isTitle = r.name === 'title';
  view.hidden = isRoulette || isTitle;
  if (isRoulette) { H.roulette?.(prev.name); document.title = 'Кинорулетка'; return; }
  if (isTitle) { H.title?.(r.id); return; }
  H.leave?.();
  if (!keepScroll) scrollTo(0, 0);
  if (r.name === 'catalog') renderCatalog();
  else if (r.name === 'mood') renderMood(r.slug);
  else if (r.name === 'me') renderMe(r.tab);
  else if (r.name === 'together') renderTogether();
  else if (r.name === 'room') renderRoom(r.code);
  else if (r.name === 'about') renderAbout();
}
const secOf = (n) => ({ roulette: 'roulette', title: 'roulette', catalog: 'catalog', mood: 'catalog', together: 'together', room: 'together', me: 'me' })[n];
function moveDot() {
  const a = document.querySelector('.nav a.on'), dot = $('#navDot');
  if (!dot) return;
  if (!a) { dot.style.opacity = '0'; return; }
  const n = a.parentNode.getBoundingClientRect(), r = a.getBoundingClientRect();
  dot.style.opacity = '1'; dot.style.transform = `translateX(${(r.left - n.left + r.width / 2 - 2).toFixed(1)}px)`;
}
addEventListener('resize', moveDot, { passive: true });
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-nav]'); if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
  e.preventDefault(); navigate(a.getAttribute('href'));
});
addEventListener('popstate', () => show(parse(rel())));
addEventListener('offline', () => toast('Нет интернета. Покажу то, что уже загружено', null, 4000));
addEventListener('online', () => toast('Связь вернулась', null, 2000));

// ---------- О сайте ----------
function renderAbout() {
  document.title = 'О сайте · Кинорулетка';
  const li = (n, u, t) => `<li><a href="${u}" target="_blank" rel="noopener">${n}</a> — ${t}</li>`;
  view.innerHTML = `<div class="wrap about"><h1 class="vh">О сайте</h1>
    <p class="lead">Кинорулетка подбирает случайный фильм, сериал или аниме по жанру, годам и рейтингу. Можно крутить одному или вдвоём: каждый листает карточки, а сайт показывает совпадения.</p>
    <h2>Откуда данные</h2><ul class="src">
      ${li('IMDb', 'https://www.imdb.com/', 'названия, рейтинги, постеры; через открытый API api.tiffara.com')}
      ${li('AniList', 'https://anilist.co/', 'аниме: рейтинги, постеры, описания')}
      ${li('Wikidata', 'https://www.wikidata.org/', 'русские названия и ссылки на Кинопоиск (CC0)')}
      ${li('Русская Википедия', 'https://ru.wikipedia.org/', 'описания и сюжеты (CC BY-SA 4.0)')}
      ${li('YouTube', 'https://www.youtube.com/', 'трейлеры, встроенный плеер youtube-nocookie')}
    </ul>
    <h2>Где посмотреть</h2><p>Ссылки ведут только на легальные сервисы: Кинопоиск, Okko, Иви, JustWatch, а для справки на IMDb, AniList и MyAnimeList. Сайт сам ничего не показывает и не хранит видео.</p>
    <h2>Аккаунт</h2><p>Без входа «Любимые» и «Просмотрено» живут только в этой вкладке. С аккаунтом списки хранятся на сервере. Почту не спрашиваем, поэтому пароль восстановить нельзя. Сменить пароль или удалить аккаунт можно в меню аккаунта.</p>
    <h2>Спасибо</h2><p>Шрифт Golos Text (Paratype, SIL OFL). Постеры и названия принадлежат правообладателям и показаны для справки.</p>
    <p class="muted">Исходный код: <a href="https://github.com/relocpe/kino-roulette" target="_blank" rel="noopener">github.com/relocpe/kino-roulette</a></p>
  </div>`;
}

// ---------- Каталог ----------
function renderCatalog() {
  document.title = 'Каталог · Кинорулетка';
  view.innerHTML = `<div class="wrap cat"><h1 class="sr">Каталог</h1>
    <label class="search">${IC.search}<input id="q" type="search" placeholder="Название фильма, сериала или аниме" autocomplete="off" enterkeyhint="search" value="${esc(cat.q)}"><kbd>/</kbd></label>
    <h2 class="hcap">Подборки</h2>${moodCards()}<div id="frow"></div><div class="grid" id="grid"></div></div>`;
  fillMoods(view);
  let stop = null;
  const run = () => { stop?.(); stop = grid($('#grid'), { ...cat }, { onTotal: (n) => { const c = view.querySelector('.ccount'); if (c) c.textContent = n ? `${n.toLocaleString('ru-RU')} ${plural(n, 'название', 'названия', 'названий')}` : ''; } }); };
  const row = filterRow(cat, { onChange: run }); $('#frow').replaceWith(row);
  const q = $('#q'); let deb = 0;
  q.oninput = () => { clearTimeout(deb); deb = setTimeout(() => { cat.q = q.value.trim(); row.classList.toggle('dim', !!cat.q); run(); }, 250); };
  row.classList.toggle('dim', !!cat.q);
  if (focusSearch) { focusSearch = false; requestAnimationFrame(() => q.focus()); }
  run();
  cleanup = () => stop?.();
}
let focusSearch = false;
export function openSearch() { focusSearch = true; if (route.name === 'catalog') { $('#q')?.focus(); focusSearch = false; } else navigate('catalog'); }
addEventListener('keydown', (e) => { if (e.key === '/' && !e.target.closest('input,textarea,select,[contenteditable]') && !document.querySelector('dialog[open]')) { e.preventDefault(); openSearch(); } });
const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 12 || h > 14) ? b : c; };

function renderMood(slug) {
  const m = MOODS.find((x) => x.slug === slug); if (!m) return navigate('catalog', { replace: true });
  document.title = `${m.title} · Кинорулетка`;
  view.innerHTML = `<div class="wrap"><header class="mhead"><div class="mcol mc5"></div><div class="mtxt"><a class="back" href="catalog" data-nav>${IC.l}Каталог</a><h1>${esc(m.title)}</h1><p>${esc(m.sub)}</p></div><button class="mspin" type="button">Крутить по подборке</button></header><div class="grid" id="grid"></div></div>`;
  moodPosters(m).then((u) => { const c = view.querySelector('.mcol.mc5'); if (c) c.innerHTML = collHTML(u, 5); });
  view.querySelector('.mspin').onclick = () => { navigate(''); H.spinWith?.(m.spin); };
  const stop = grid($('#grid'), { mode: 'all', ...m.f });
  cleanup = stop;
}

// ---------- Мои списки ----------
function renderMe(tab, keep) {
  document.title = 'Мои списки · Кинорулетка';
  const TABS = [['favorites', 'Любимые'], ['watched', 'Просмотрено'], ['recent', 'Недавние']];
  const L = S.getLists(), rec = H.recent?.() || [];
  const data = tab === 'recent' ? rec : L[tab].map((x) => ({ id: x.titleId, t: x.title, ru: x.title, y: x.year, r: x.rating, poster: x.poster }));
  const nOf = (k) => (k === 'recent' ? rec.length : L[k].length);
  const plaque = !S.loggedIn() && tab !== 'recent' ? `<div class="plaque"><p><b>Без входа списки не сохраняются.</b> Они живут, пока открыта эта вкладка.</p><button class="tlink" type="button" data-auth="login">Войти</button></div>` : '';
  const emptyTxt = { favorites: 'Здесь будут фильмы, которые ты отметишь ♡.', watched: 'Попадёт сюда после досмотра (~90%) в плеере или если отметишь глазом.', recent: 'Здесь появятся фильмы, которые выпадали в рулетке.' }[tab];
  view.innerHTML = `<div class="wrap me"><h1 class="vh">Мои списки</h1>
    <div class="tabs" role="tablist">${TABS.map(([k, l]) => `<a role="tab" href="me/${k}" data-nav aria-selected="${k === tab}" class="${k === tab ? 'on' : ''}">${l}<span>${nOf(k) || ''}</span></a>`).join('')}</div>
    ${plaque}
    ${data.length ? `<div class="grid">${data.map(tile).join('')}</div>` : `<p class="empty big">${emptyTxt}</p>`}
    ${tab === 'recent' && data.length ? '<button class="tlink clr" type="button" id="recClear">Очистить недавние</button>' : ''}
    <p class="mefoot">${S.loggedIn() ? '<button class="tlink" type="button" data-acct>Аккаунт: пароль, выход, удаление</button><span aria-hidden="true">·</span>' : ''}<a class="tlink" href="about" data-nav>О сайте</a></p></div>`;
  syncButtons(view);
  const c = $('#recClear'); if (c) c.onclick = () => { H.clearRecent?.(); renderMe('recent'); };
}

// ---------- Вход и регистрация ----------
const dlg = $('#auth');
let mode = 'login';
export function openAuth(m = 'login') {
  mode = m; drawAuth(); if (!dlg.open) dlg.showModal();
  requestAnimationFrame(() => $('#aNick')?.focus());
}
function drawAuth() {
  const reg = mode === 'register';
  dlg.innerHTML = `<form class="af" novalidate>
    <div class="ahead"><h2>${reg ? 'Регистрация' : 'Вход'}</h2><button class="px" type="button" data-close aria-label="Закрыть">${IC.x}</button></div>
    <label class="fl" for="aNick">Ник</label><input class="fi" id="aNick" name="nick" autocomplete="username" autocapitalize="off" spellcheck="false" maxlength="20" required>
    <p class="ferr" id="eNick"></p>
    <label class="fl" for="aPass">Пароль</label><div class="pw"><input class="fi" id="aPass" name="pass" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}" minlength="8" required><button class="eyeb" type="button" aria-label="Показать пароль" aria-pressed="false">${IC.eyeOpen}</button></div>
    <p class="ferr" id="ePass"></p>
    <button class="abtn" type="submit"><span>${reg ? 'Создать аккаунт' : 'Войти'}</span></button>
    <p class="anote">Восстановить пароль нельзя, почты мы не спрашиваем. Запиши пароль.</p>
    <p class="aswitch">${reg ? 'Уже есть аккаунт? <button type="button" class="tlink" data-m="login">Войти</button>' : 'Нет аккаунта? <button type="button" class="tlink" data-m="register">Создать</button>'}</p>
  </form>`;
  const f = dlg.querySelector('form'), nick = $('#aNick'), pass = $('#aPass'), eN = $('#eNick'), eP = $('#ePass');
  dlg.querySelector('[data-close]').onclick = () => close();
  dlg.querySelector('[data-m]').onclick = (e) => { const v = nick.value; mode = e.target.dataset.m; drawAuth(); $('#aNick').value = v; $('#aNick').focus(); };
  dlg.querySelector('.eyeb').onclick = (e) => { const on = pass.type === 'password'; pass.type = on ? 'text' : 'password'; e.currentTarget.setAttribute('aria-pressed', String(on)); e.currentTarget.setAttribute('aria-label', on ? 'Скрыть пароль' : 'Показать пароль'); };
  const okNick = (v) => /^[a-zA-Z0-9_]{3,20}$/.test(v);
  nick.onblur = async () => {
    const v = nick.value.trim(); if (!reg || !v) return;
    if (!okNick(v)) { eN.textContent = '3–20 символов: латиница, цифры и _'; return; }
    try { const r = await S.checkNick(v); eN.textContent = r.available ? '' : 'Ник занят'; } catch {}
  };
  nick.oninput = () => { eN.textContent = ''; eP.textContent = ''; };
  pass.oninput = () => { eP.textContent = ''; };
  f.onsubmit = async (e) => {
    e.preventDefault();
    const v = nick.value.trim(), p = pass.value;
    if (reg) {
      if (!okNick(v)) { eN.textContent = '3–20 символов: латиница, цифры и _'; nick.focus(); return; }
      if (p.length < 8) { eP.textContent = 'Минимум 8 символов'; pass.focus(); return; }
    } else if (!v || !p) { eP.textContent = 'Неверный ник или пароль'; return; }
    const b = f.querySelector('.abtn'); b.disabled = true; b.classList.add('load');
    try {
      const r = await S.auth(mode, v, p);
      close();
      toast(r.merged ? `Списки перенесли в аккаунт: ${r.merged} ${plural(r.merged, 'название', 'названия', 'названий')}` : reg ? `Аккаунт создан. Привет, ${r.user.nickname}!` : `Привет, ${r.user.nickname}!`, null, 3200);
    } catch (err) {
      if (err.code === 'nickname_taken') eN.textContent = 'Ник занят';
      else if (err.code === 'bad_nickname') eN.textContent = '3–20 символов: латиница, цифры и _';
      else if (err.code === 'bad_password') eP.textContent = 'Минимум 8 символов';
      else if (err.code === 'bad_credentials') eP.textContent = 'Неверный ник или пароль';
      else if (err.code === 'rate_limited') eP.textContent = 'Слишком много попыток. Подожди 15 минут';
      else eP.textContent = err.message || 'Не получилось. Попробуй ещё раз';
    } finally { b.disabled = false; b.classList.remove('load'); }
  };
}
// ---------- Аккаунт: пароль, удаление, выход ----------
export function openAccount() { if (!S.loggedIn()) return openAuth('login'); drawAcct(); if (!dlg.open) dlg.showModal(); }
function drawAcct() {
  const u = S.me();
  const pw = (id, lbl, ac) => `<label class="fl" for="${id}">${lbl}</label><div class="pw"><input class="fi" id="${id}" type="password" autocomplete="${ac}" minlength="8" required><button class="eyeb" type="button" aria-label="Показать пароль" aria-pressed="false">${IC.eyeOpen}</button></div>`;
  dlg.innerHTML = `<div class="af acct">
    <div class="ahead"><h2>Аккаунт</h2><button class="px" type="button" data-close aria-label="Закрыть">${IC.x}</button></div>
    <p class="anick2">Ник: <b>${esc(u.nickname)}</b></p>
    <form class="asec" id="fPw" novalidate><h3>Сменить пароль</h3>
      <input type="text" autocomplete="username" value="${esc(u.nickname)}" hidden>
      ${pw('pCur', 'Текущий пароль', 'current-password')}${pw('pNew', 'Новый пароль', 'new-password')}
      <p class="ferr" id="ePw" role="alert"></p>
      <button class="abtn" type="submit"><span>Сохранить пароль</span></button>
      <p class="anote">Остальные устройства выйдут из аккаунта.</p></form>
    <div class="asec"><h3>Выход</h3><button class="btn ghost" type="button" id="aOut">Выйти из аккаунта</button></div>
    <form class="asec danger" id="fDel" novalidate><h3>Удалить аккаунт</h3>
      <p class="anote">Удалятся аккаунт, все входы и списки «Любимые» и «Просмотрено». Вернуть их не получится.</p>
      <input type="text" autocomplete="username" value="${esc(u.nickname)}" hidden>
      ${pw('pDel', 'Пароль для подтверждения', 'current-password')}
      <p class="ferr" id="eDel" role="alert"></p>
      <button class="abtn del" type="submit"><span>Удалить навсегда</span></button></form>
  </div>`;
  dlg.querySelector('[data-close]').onclick = () => close();
  dlg.querySelectorAll('.eyeb').forEach((b) => (b.onclick = () => { const i = b.previousElementSibling, on = i.type === 'password'; i.type = on ? 'text' : 'password'; b.setAttribute('aria-pressed', String(on)); }));
  const errText = (err) => err.code === 'bad_password' ? (err.status === 403 ? 'Текущий пароль неверный' : 'Минимум 8 символов') : err.code === 'rate_limited' ? 'Слишком много попыток. Подожди 15 минут' : err.status ? err.message || 'Не получилось' : 'Нет связи с сервером. Попробуй ещё раз';
  const busy = (b, on) => { b.disabled = on; b.classList.toggle('load', on); };
  $('#fPw').onsubmit = async (e) => {
    e.preventDefault(); const c = $('#pCur').value, n = $('#pNew').value, er = $('#ePw'), b = e.target.querySelector('.abtn');
    if (!c) { er.textContent = 'Введи текущий пароль'; return; }
    if (n.length < 8) { er.textContent = 'Новый пароль: минимум 8 символов'; return; }
    busy(b, true); er.textContent = '';
    try { await S.changePassword(c, n); close(); toast('Пароль изменён'); } catch (err) { er.textContent = errText(err); } finally { busy(b, false); }
  };
  $('#aOut').onclick = async () => { close(); await S.logout(); toast('Вышли из аккаунта'); };
  let armed = false;
  $('#fDel').onsubmit = async (e) => {
    e.preventDefault(); const p = $('#pDel').value, er = $('#eDel'), b = e.target.querySelector('.abtn');
    if (!p) { er.textContent = 'Введи пароль'; return; }
    if (!armed) { armed = true; b.firstElementChild.textContent = 'Точно удалить? Нажми ещё раз'; return; }
    busy(b, true); er.textContent = '';
    try { await S.deleteAccount(p); close(); toast('Аккаунт удалён'); } catch (err) { er.textContent = errText(err); armed = false; b.firstElementChild.textContent = 'Удалить навсегда'; } finally { busy(b, false); }
  };
}
function close() { if (!dlg.open) return; if (reduce.matches) return dlg.close(); dlg.classList.add('out'); setTimeout(() => { dlg.classList.remove('out'); dlg.close(); }, 180); }
dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
document.addEventListener('click', (e) => { if (e.target.closest('[data-acct]')) { e.preventDefault(); openAccount(); return; } const a = e.target.closest('[data-auth]'); if (a) { e.preventDefault(); openAuth(a.dataset.auth); } });

// аватар: «Войти» или круг с буквой и меню
function drawAvatar() {
  const box = $('#avatar'), u = S.me();
  if (!S.loggedIn()) { box.innerHTML = '<button class="login" type="button" data-auth="login">Войти</button>'; document.body.classList.remove('authed'); }
  else {
    document.body.classList.add('authed');
    box.innerHTML = `<button class="ava" type="button" aria-haspopup="menu" aria-expanded="false" aria-label="Аккаунт ${esc(u.nickname)}">${esc(u.nickname[0].toUpperCase())}</button>
      <div class="amenu" role="menu" hidden><p class="anick">${esc(u.nickname)}</p><button type="button" role="menuitemcheckbox" data-x="fx"></button><a role="menuitem" href="me/favorites" data-nav>Мои списки</a><button type="button" role="menuitem" data-x="acct">Аккаунт</button><a role="menuitem" href="about" data-nav>О сайте</a><button type="button" role="menuitem" data-x="out">Выйти</button></div>`;
    const b = box.querySelector('.ava'), m = box.querySelector('.amenu');
    const fxLbl = () => { const on = $('#fxBtn').getAttribute('aria-checked') === 'true'; const x = m.querySelector('[data-x="fx"]'); x.textContent = on ? 'Эффекты: вкл' : 'Эффекты: выкл'; x.setAttribute('aria-checked', String(on)); };
    b.onclick = (e) => { e.stopPropagation(); fxLbl(); m.hidden = !m.hidden; b.setAttribute('aria-expanded', String(!m.hidden)); };
    m.onclick = async (e) => { const x = e.target.closest('[data-x]'); if (!x) { m.hidden = true; return; } if (x.dataset.x === 'fx') { $('#fxBtn').click(); fxLbl(); } else if (x.dataset.x === 'acct') { m.hidden = true; openAccount(); } else { m.hidden = true; await S.logout(); toast('Вышли из аккаунта'); } };
    document.addEventListener('click', () => { m.hidden = true; b.setAttribute('aria-expanded', 'false'); });
  }
}
addEventListener('kr:auth', () => { drawAvatar(); syncButtons(); if (route.name === 'me') renderMe(route.tab); });

// ---------- Похожее ----------
export async function similar(t) {
  if (t.src === 'al') {
    const d = await alq(`query($id:Int){Media(id:$id,type:ANIME){recommendations(perPage:16,sort:RATING_DESC){nodes{mediaRecommendation{${ALF}}}}}}`, { id: t.al });
    return (d.Media?.recommendations?.nodes || []).map((n) => n.mediaRecommendation).filter(Boolean).map(normAnime).filter((x) => x.i);
  }
  const g = (t.g || []).filter((x) => x !== 'Drama' || (t.g || []).length === 1).slice(0, 1);
  const y = Number(t.y) || 2000;
  const p = { types: /tvSeries|tvMiniSeries/.test(t.k) ? TYPES.series : TYPES.movie, genres: g.length ? g : t.g?.slice(0, 1), startYear: y - 8, endYear: y + 8, minVoteCount: 20000, sortBy: 'SORT_BY_POPULARITY', sortOrder: 'ASC' };
  const d = await getJSON(`${B}/titles?${qs(p)}`).catch(() => ({ titles: [] }));
  const want = new Set(t.g || []);
  return (d.titles || []).map(norm).filter((x) => x.id !== t.id && x.i)
    .map((x) => ({ x, s: (x.g || []).filter((z) => want.has(z)).length * 2 - Math.abs((x.y || y) - y) / 6 + (x.r || 6) / 4 }))
    .sort((a, b) => b.s - a.s).slice(0, 16).map((o) => o.x);
}
export function simHTML() { return `<section class="sim" aria-label="Похожее"><div class="shd"><h3>Похожее</h3><div class="sarr"><button type="button" class="sa" data-d="-1" aria-label="Назад">${IC.l}</button><button type="button" class="sa" data-d="1" aria-label="Вперёд">${IC.r}</button></div></div><div class="srow">${Array.from({ length: 6 }, () => '<div class="stile sk"><div class="tp"></div><b></b></div>').join('')}</div></section>`; }
export function fillSim(sec, list, onPick) {
  if (list.length < 4) { sec.remove(); return; }
  const row = sec.querySelector('.srow');
  row.innerHTML = list.map((t) => { remember(t); return `<a class="stile" href="title/${esc(t.id)}" data-id="${esc(t.id)}"><div class="tp"><img src="${esc(poster(t.i, 300))}" alt="" loading="lazy" onerror="this.remove()"></div><b>${esc(t.ru || ruCached(t.id) || t.t)}</b></a>`; }).join('');
  localize(row);
  const map = new Map(list.map((t) => [t.id, t]));
  row.onclick = (e) => { const a = e.target.closest('.stile'); if (!a || e.metaKey || e.ctrlKey) return; e.preventDefault(); onPick(map.get(a.dataset.id), a.querySelector('.tp').getBoundingClientRect()); };
  sec.querySelectorAll('.sa').forEach((b) => (b.onclick = () => row.scrollBy({ left: +b.dataset.d * row.clientWidth * 0.8, behavior: reduce.matches ? 'auto' : 'smooth' })));
}

// ---------- На двоих ----------
const room = { code: '', ws: null, poll: 0, st: null, deck: [], i: 0, ping: 0, stopped: false };
function leaveRoom() { room.stopped = true; try { room.ws?.close(); } catch {} room.ws = null; clearInterval(room.poll); clearInterval(room.ping); document.body.classList.remove('inroom'); }
function renderTogether() {
  leaveRoom();
  document.title = 'На двоих · Кинорулетка';
  view.innerHTML = `<div class="tog"><h1>Выбрать фильм вдвоём</h1><p class="tsub">Свайпайте постеры, совпадения появятся сразу</p>
    <button class="big amber" type="button" id="mk">Создать комнату</button>
    <button class="big line" type="button" id="hv" aria-expanded="false">У меня есть код</button>
    <form class="codes" id="codes" hidden autocomplete="off">${[0, 1, 2, 3].map((i) => `<input inputmode="text" maxlength="1" aria-label="Символ ${i + 1}" autocapitalize="characters" spellcheck="false">`).join('')}</form>
    <p class="ferr" id="tErr"></p>
    <p class="tfoot">Без аккаунта: комната живёт сутки, второй человек заходит по коду или ссылке.</p></div>`;
  const err = $('#tErr');
  $('#mk').onclick = async (e) => {
    const b = e.currentTarget; b.disabled = true; err.textContent = '';
    try { const d = await S.roomCreate({ mode: 'all', genres: [] }, (Math.random() * 2 ** 32) >>> 0); navigate('together/' + d.code); }
    catch (x) { err.textContent = x.message || 'Не получилось создать комнату'; b.disabled = false; }
  };
  const box = $('#codes'), ins = [...box.querySelectorAll('input')];
  $('#hv').onclick = (e) => { box.hidden = !box.hidden; e.currentTarget.setAttribute('aria-expanded', String(!box.hidden)); if (!box.hidden) ins[0].focus(); };
  const OK = /[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]/;
  ins.forEach((inp, i) => {
    inp.oninput = () => {
      const v = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (v.length > 1) { [...v].slice(0, 4 - i).forEach((c, k) => (ins[i + k].value = c)); }
      else inp.value = v;
      const nx = ins.findIndex((x) => !x.value); if (nx >= 0) ins[nx].focus(); else go();
    };
    inp.onkeydown = (e) => { if (e.key === 'Backspace' && !inp.value && i) { ins[i - 1].value = ''; ins[i - 1].focus(); } };
  });
  async function go() {
    const code = ins.map((x) => x.value).join('');
    if (![...code].every((c) => OK.test(c))) { err.textContent = 'В кодах нет букв O, I и цифр 0, 1'; return; }
    err.textContent = '';
    try { await S.roomJoin(code); navigate('together/' + code); }
    catch (x) { err.textContent = x.code === 'room_full' ? 'В комнате уже двое' : x.code === 'room_not_found' ? 'Такой комнаты нет или она истекла' : x.message; ins.forEach((y) => (y.value = '')); ins[0].focus(); }
  }
}
async function renderRoom(code) {
  leaveRoom(); room.stopped = false; room.code = code; room.deck = []; room.i = 0; room.matches = [];
  document.body.classList.add('inroom');
  document.title = `Комната ${code} · Кинорулетка`;
  view.innerHTML = `<div class="room"><div class="rtop"><a class="rexit" href="together" data-nav>${IC.x}Выйти</a><span class="rcode-s">${code}</span><button class="rmatch" type="button" id="rMatches" hidden>Совпадения · <b>0</b></button></div><div class="rbody" id="rbody"><p class="empty">Подключаемся…</p></div></div>`;
  let st;
  try { st = S.roomPid(code) ? await S.roomJoin(code) : await S.roomJoin(code); }
  catch (x) { $('#rbody').innerHTML = `<div class="tog"><h1>${x.code === 'room_full' ? 'В комнате уже двое' : 'Комнаты нет'}</h1><p class="tsub">${x.code === 'room_full' ? 'Эта комната занята. Создай свою.' : 'Код неверный или комната истекла: они живут сутки.'}</p><a class="big amber" href="together" data-nav>Создать новую</a></div>`; return; }
  apply(st);
  connect();
  $('#rMatches').onclick = () => showMatches();
  cleanup = leaveRoom;
}
function connect() {
  const code = room.code;
  try {
    const ws = S.roomWS(code); room.ws = ws;
    ws.onmessage = (e) => { if (e.data === 'pong') return; let m; try { m = JSON.parse(e.data); } catch { return; } onMsg(m); };
    ws.onopen = () => { clearInterval(room.poll); room.ping = setInterval(() => { try { ws.send('ping'); } catch {} }, 30000); };
    ws.onclose = (e) => { clearInterval(room.ping); if (room.stopped || room.code !== code) return; if (e.code === 4000) { $('#rbody').innerHTML = '<div class="tog"><h1>Комната истекла</h1><a class="big amber" href="together" data-nav>Создать новую</a></div>'; return; } startPoll(); };
    ws.onerror = () => {};
  } catch { startPoll(); }
}
function startPoll() { clearInterval(room.poll); room.poll = setInterval(async () => { if (room.stopped) return; try { apply(await S.roomState(room.code)); } catch {} }, 2500); }
function onMsg(m) {
  const st = room.st || {};
  if (m.type === 'hello') return apply(m.state || m);
  if (m.type === 'presence') { (st.participants || []).forEach((p) => (p.online = (m.online || []).includes(p.index))); return apply(st); }
  if (m.type === 'joined') { apply({ ...st, bothJoined: Number(m.participants) >= 2 }); S.roomState(room.code).then(apply).catch(() => {}); return; }
  if (m.type === 'filters') return apply({ ...st, filters: m.filters });
  if (m.type === 'started') return apply({ ...st, started: true, seed: m.seed, filters: m.filters });
  if (m.type === 'progress') { room.progress = m.swipes; drawProgress(); return; }
  if (m.type === 'match') { const mt = m.match; if (!(st.matches || []).some((x) => x.titleId === mt.titleId)) { st.matches = [...(st.matches || []), mt]; drawMatchCount(); matchPop(mt); } return; }
  if (m.type === 'unmatch') { st.matches = (st.matches || []).filter((x) => x.titleId !== m.titleId); drawMatchCount(); }
}
function apply(st) {
  const was = room.st; room.st = st;
  drawMatchCount();
  if (!st.started) return drawWait(st);
  if (!was?.started || !room.deck.length) startDeck(st);
  else drawProgress();
}
function drawMatchCount() { const b = $('#rMatches'); if (!b) return; const n = (room.st?.matches || []).length; b.hidden = !n; b.querySelector('b').textContent = n; }
function drawWait(st) {
  const body = $('#rbody'); if (!body) return;
  const both = !!st.bothJoined, me = st.isCreator;
  const link = location.origin + BASE + 'together/' + st.code;
  const f = { mode: st.filters?.mode || 'all', genres: st.filters?.genres || [], from: st.filters?.from, to: st.filters?.to, rating: st.filters?.rating || 0, sort: 'pop' };
  if (!body.querySelector('.wait')) {
    body.innerHTML = `<div class="wait"><p class="wlbl">Код комнаты</p><p class="rcode">${esc(st.code)}</p>
      <div class="wbtns"><button class="btn" type="button" id="cp">Скопировать ссылку</button>${navigator.share && matchMedia('(pointer: coarse)').matches ? '<button class="btn" type="button" id="sh">Поделиться</button>' : ''}</div>
      <p class="wlbl f">${me ? 'Что смотрим' : 'Фильтры задаёт создатель комнаты'}</p><div id="wf"></div>
      <p class="wstat" id="wst"><i></i><span></span></p><button class="big amber" type="button" id="go" hidden>Начать</button></div>`;
    $('#cp').onclick = async (e) => { try { await navigator.clipboard.writeText(link); e.target.textContent = 'Ссылка скопирована'; setTimeout(() => (e.target.textContent = 'Скопировать ссылку'), 1800); } catch { prompt('Ссылка на комнату', link); } };
    const sh = $('#sh'); if (sh) sh.onclick = () => navigator.share({ title: 'Кинорулетка: выберем фильм вдвоём', text: `Код комнаты ${st.code}`, url: link }).catch(() => {});
    $('#go').onclick = async (e) => { e.target.disabled = true; try { apply(await S.roomStart(st.code)); } catch (x) { toast(x.message); e.target.disabled = false; } };
  }
  const row = filterRow(f, { readonly: !me, sort: false, onChange: async () => { try { await S.roomFilters(st.code, { mode: f.mode, genres: f.genres, from: f.from, to: f.to, rating: f.rating }); } catch (x) { toast(x.message); } } });
  if (!$('#cpop').open) $('#wf').replaceChildren(row);
  const s = $('#wst span'); $('#wst').classList.toggle('ok', both);
  s.textContent = both ? (me ? 'Вы оба здесь' : 'Вы оба здесь. Ждём, когда создатель нажмёт «Начать»') : me ? 'Ждём второго…' : 'Подключаемся…';
  $('#go').hidden = !(both && me);
}
// одинаковая колода у обоих: seed + фильтры, перемешивание mulberry32
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
async function startDeck(st) {
  const body = $('#rbody'); body.innerHTML = '<div class="swipe"><div class="deck sk"></div></div>';
  const f = { mode: st.filters?.mode || 'all', genres: st.filters?.genres || [], from: st.filters?.from, to: st.filters?.to, rating: st.filters?.rating || 0, sort: 'pop', votes: 30000 };
  let all = [];
  try { let tok; for (let k = 0; k < 3; k++) { const r = await fetchPage(f, tok); all = all.concat(r.list.filter((t) => t.i)); if (!r.next) break; tok = r.next; } } catch {}
  const R = rng(st.seed || 1); const deck = all.slice();
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  const done = new Set((st.mySwipes || []).map((x) => x.titleId));
  room.deck = deck.filter((t) => !done.has(t.id)); room.i = 0; room.total = deck.length;
  ruTitles(room.deck.slice(0, 60).map((t) => t.id)).then(() => { const h = document.querySelector('.stitle'), t = room.deck[room.i]; if (h && t && ruCached(t.id)) h.textContent = ruCached(t.id); });
  if (!room.deck.length) { body.innerHTML = '<div class="tog"><h1>Колода пуста</h1><p class="tsub">Под такие фильтры ничего не нашлось или вы всё пролистали.</p></div>'; return; }
  drawCard();
}
function drawProgress() { const p = $('#rprog'); if (!p || !room.progress) return; const me = room.st?.you ?? 0; p.textContent = `Ты ${room.progress[me] ?? 0} · партнёр ${room.progress[1 - me] ?? 0}`; }
function drawCard() {
  const body = $('#rbody'), t = room.deck[room.i];
  if (!t) { body.innerHTML = `<div class="tog"><h1>Карточки кончились</h1><p class="tsub">${(room.st?.matches || []).length ? 'Совпадения ждут вас выше.' : 'Совпадений пока нет. Подождите партнёра или создайте комнату с другими фильтрами.'}</p></div>`; return; }
  const meta = [yr(t), t.r ? `${t.r.toFixed(1)}★` : ''].filter(Boolean).join(' · ');
  body.innerHTML = `<div class="swipe"><div class="deck"><div class="scard" id="sc"><img src="${esc(poster(t.i, 600))}" alt="Постер: ${esc(ruCached(t.id) || t.t)}" draggable="false"><span class="stamp like">Смотрим</span><span class="stamp nope">Мимо</span></div>${room.deck[room.i + 1] ? `<div class="scard under"><img src="${esc(poster(room.deck[room.i + 1].i, 600))}" alt=""></div>` : ''}</div>
    <h2 class="stitle">${esc(ruCached(t.id) || t.t)}</h2><p class="smeta">${esc(meta)}</p>
    <div class="sbtns"><button class="sb no" type="button" aria-label="Мимо">${IC.x}</button><button class="sb yes" type="button" aria-label="Смотрим">${IC.heart}</button></div><p class="rprog" id="rprog"></p></div>`;
  drawProgress();
  const c = $('#sc');
  const swipe = async (like) => {
    if (c.dataset.gone) return; c.dataset.gone = '1';
    const dir = like ? 1 : -1;
    if (!reduce.matches) await c.animate([{ transform: c.style.transform || 'none' }, { transform: `translateX(${dir * innerWidth * 0.9}px) rotate(${dir * 18}deg)`, opacity: 0 }], { duration: 260, easing: 'ease-in', fill: 'forwards' }).finished;
    room.i++; drawCard();
    try { const r = await S.roomSwipe(room.code, t.id, like, { title: ruCached(t.id) || t.t, year: Number(t.y) || undefined, poster: poster(t.i, 300), type: /tv/.test(t.k) ? 'tv' : 'movie', rating: t.r }); if (r.match) { const st = room.st; const mt = { titleId: t.id, title: t.t, year: t.y, poster: poster(t.i, 300) }; if (!(st.matches || []).some((x) => x.titleId === t.id)) { st.matches = [...(st.matches || []), mt]; drawMatchCount(); matchPop(mt); } } }
    catch (x) { toast(x.message); }
  };
  body.querySelector('.no').onclick = () => swipe(false);
  body.querySelector('.yes').onclick = () => swipe(true);
  let x0 = 0, y0 = 0, dx = 0, drag = false;
  c.onpointerdown = (e) => { drag = true; x0 = e.clientX; y0 = e.clientY; dx = 0; c.setPointerCapture(e.pointerId); c.style.transition = 'none'; };
  c.onpointermove = (e) => { if (!drag) return; dx = e.clientX - x0; const dy = e.clientY - y0; c.style.transform = `translate(${dx}px,${dy * 0.2}px) rotate(${dx / 18}deg)`; c.style.setProperty('--like', Math.max(0, Math.min(1, dx / 110))); c.style.setProperty('--nope', Math.max(0, Math.min(1, -dx / 110))); };
  c.onpointerup = c.onpointercancel = () => { if (!drag) return; drag = false; if (Math.abs(dx) > 110) swipe(dx > 0); else { c.style.transition = 'transform .25s cubic-bezier(.16,1,.3,1)'; c.style.transform = ''; c.style.setProperty('--like', 0); c.style.setProperty('--nope', 0); } };
  const kd = (e) => { if (route.name !== 'room' || document.querySelector('dialog[open]')) return document.removeEventListener('keydown', kd); if (e.key === 'ArrowLeft') swipe(false); if (e.key === 'ArrowRight') swipe(true); };
  document.addEventListener('keydown', kd, { once: true });
}
function matchPop(mt) {
  const d = $('#matchDlg');
  d.innerHTML = `<div class="mp"><p class="wlbl">Совпадение</p>${mt.poster ? `<img src="${esc(mt.poster)}" alt="">` : ''}<h2>${esc(mt.title || '')}</h2><p class="smeta">${esc(mt.year || '')}</p><div class="wbtns"><a class="btn primary" href="title/${esc(mt.titleId)}" data-nav>Смотрим это</a><button class="btn" type="button" data-close>Дальше</button></div></div>`;
  d.querySelector('[data-close]').onclick = () => d.close();
  d.querySelector('a').addEventListener('click', () => { d.close(); leaveRoom(); });
  if (!d.open) d.showModal();
}
function showMatches() {
  const d = $('#matchDlg'), ms = room.st?.matches || [];
  d.innerHTML = `<div class="mp list"><div class="ahead"><h2>Совпадения</h2><button class="px" type="button" data-close aria-label="Закрыть">${IC.x}</button></div><div class="mlist">${ms.map((m) => `<a href="title/${esc(m.titleId)}" data-nav class="hitem">${m.poster ? `<img src="${esc(m.poster)}" alt="">` : '<span class="ph"></span>'}<span><b>${esc(m.title || m.titleId)}</b><small>${esc(m.year || '')}</small></span></a>`).join('')}</div></div>`;
  d.querySelector('[data-close]').onclick = () => d.close();
  d.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => { d.close(); leaveRoom(); }));
  if (!d.open) d.showModal();
}
$('#matchDlg').addEventListener('click', (e) => { if (e.target.id === 'matchDlg') e.target.close(); });
$('#cpop').addEventListener('click', (e) => { if (e.target.id === 'cpop') e.target.close(); });

// ---------- старт ----------
export function initViews(hooks) {
  H = hooks;
  drawAvatar(); syncButtons();
  S.init();
  // ссылки «Поделиться» вида ?t=tt123 открываются с кодом 200 (у глубоких путей на Pages статус 404, и Telegram может не показать превью)
  const sp = new URLSearchParams(location.search), tq = sp.get('t');
  if (tq && /^(tt\d+|al\d+)$/.test(tq)) history.replaceState({}, '', BASE + 'title/' + tq);
  show(parse(rel()));
  requestAnimationFrame(moveDot);
}
