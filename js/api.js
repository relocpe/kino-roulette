import { LISTS, byId } from './chips.js?v=8';
const ANIME = byId.anime;

const B = 'https://api.tiffara.com';
const IMG = 'https://m.media-amazon.com/images/M/';
const rnd = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rnd(a.length)];
const qs = (o) => Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '')
  .flatMap(([k, v]) => [].concat(v).map((x) => `${k}=${encodeURIComponent(x)}`)).join('&');

// офлайн-каталог грузится лениво — только если API не ответил
let snapshot = null;
async function snap() {
  if (!snapshot) snapshot = fetch('data/catalog.json?v=8').then((r) => r.json()).then((d) => {
    const T = {};
    for (const row of d.titles) {
      const [id, t, o, k, y, e, r10, v, g, i, sec, tg, ep] = row;
      const al = id.startsWith('al');
      T[id] = { id, t, o: o || undefined, k: d.kinds[k], fmt: al ? d.fmts[k] : undefined, y, e: e || undefined, r: r10 ? r10 / 10 : undefined, v, g: g ? g.split(',').map((x) => d.genres[x]) : [], i: al ? d.alImg + i : i, s: sec || undefined, tags: tg ? tg.split(',').map((x) => d.tags[x]) : undefined, ep: ep || undefined, src: al ? 'al' : undefined, al: al ? +id.slice(2) : undefined };
    }
    return { titles: T, chips: d.chips };
  });
  return snapshot;
}
let seeds = null;
export async function seedPosters() {
  if (!seeds) seeds = fetch('data/seed.json?v=8').then((r) => r.json());
  return seeds;
}

// кэш ответов: память (до 400 записей) + sessionStorage только для маленьких ответов; при переполнении чистим старое
const mem = new Map();
function remember(key, d, txt) {
  mem.set(key, d); if (mem.size > 400) mem.delete(mem.keys().next().value);
  if (txt.length > 24000) return;
  try { sessionStorage.setItem(key, txt); } catch {
    try { const ks = []; for (let i = 0; i < sessionStorage.length; i++) { const k = sessionStorage.key(i); if (k.startsWith('k:')) ks.push(k); } ks.slice(0, Math.ceil(ks.length / 2)).forEach((k) => sessionStorage.removeItem(k)); sessionStorage.setItem(key, txt); } catch {}
  }
}
export async function getJSON(url, ms = 9000) {
  const key = 'k:' + url;
  if (mem.has(key)) return mem.get(key);
  try { const c = sessionStorage.getItem(key); if (c) return JSON.parse(c); } catch {}
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const txt = await r.text(), d = JSON.parse(txt);
    remember(key, d, txt);
    return d;
  } finally { clearTimeout(timer); }
}

export const poster = (path, w = 400) => (!path ? '' : /^https?:/.test(path) ? (w <= 200 ? path.replace('/cover/large/', '/cover/medium/') : path) : `${IMG}${path}._V1_QL80_UX${w}_.jpg`);
const imgPath = (u) => (u ? u.replace(IMG, '').replace(/\._V1_.*$/, '') : null);

export function norm(t) {
  return {
    id: t.id, t: t.primaryTitle, o: t.originalTitle && t.originalTitle !== t.primaryTitle ? t.originalTitle : undefined,
    k: t.type, y: t.startYear, e: t.endYear, r: t.rating?.aggregateRating, v: t.rating?.voteCount,
    g: t.genres || [], i: imgPath(t.primaryImage?.url), s: t.runtimeSeconds, p: t.plot,
  };
}

const TYPES = { movie: ['MOVIE'], series: ['TV_SERIES', 'TV_MINI_SERIES'], all: ['MOVIE', 'TV_SERIES', 'TV_MINI_SERIES'] };
const KIND = { movie: ['movie', 'tvMovie'], series: ['tvSeries', 'tvMiniSeries'], all: ['movie', 'tvMovie', 'tvSeries', 'tvMiniSeries'] };
const SERIES = ['tvSeries', 'tvMiniSeries'];
const gNames = (g) => [].concat(g.q?.genres || g.alt?.flatMap((x) => [].concat(x.genres)) || []);
const meet = (arr, want) => !want || want.some((x) => arr.includes(x));

// Проверка по данным из списка: тип, годы, рейтинг, жанр из группы «Жанры», базовые требования поджанра.
export function matchLocal(t, g, s, f) {
  if (!t || !t.i) return false;
  if (g?.src === 'anilist' || t.src === 'al') return g?.src === 'anilist' || !g ? matchAnime(t, g, s, f) : false;
  const kinds = s?.kinds || (s?.series ? SERIES : null);
  if (!KIND[f.mode].includes(t.k)) return false;
  if (kinds && !kinds.includes(t.k)) return false;
  if (f.from && (!t.y || t.y < f.from)) return false;
  if (f.to && (!t.y || t.y > f.to)) return false;
  if (f.minRating && (t.r || 0) < f.minRating) return false;
  const floor = SERIES.includes(t.k) ? f.vs : f.vm;
  if (floor && (t.v || 0) < floor) return false;
  const gs = t.g || [];
  if (g && !meet(gs, gNames(g))) return false;
  if (s) {
    if (s.need && !meet(gs, s.need)) return false;
    if (s.noG && s.noG.some((x) => gs.includes(x))) return false;
    if (s.minV && (t.v || 0) < s.minV) return false;
    if (s.maxY && (!t.y || t.y > s.maxY)) return false;
    if (s.list && !LISTS[s.list].includes(t.id)) return false;
  }
  return true;
}
// Полная проверка по карточке тайтла (с интересами IMDb и страной).
export function matchFull(d, g, s, f) {
  if (!matchLocal(d, g, s, f)) return false;
  if (!s || !d.interests) return true;
  const ids = d.interests;
  if (s.noI && s.noI.some((x) => ids.includes(x))) return false;
  if (s.anyI && !meet(ids, s.anyI) && !(s.orCountry && (d.countries || []).includes(s.orCountry))) return false;
  return true;
}

// ---------- IMDb: случайные срезы по всему каталогу ----------
// Токены страниц подписаны, поэтому «случайное смещение» = случайная сортировка × узкое окно лет × полоса голосов × глубина 0–3 страницы.
const SORTS = [
  ['SORT_BY_POPULARITY', 'ASC', 3], ['SORT_BY_USER_RATING_COUNT', 'DESC', 2], ['SORT_BY_USER_RATING', 'DESC', 2],
  ['SORT_BY_RELEASE_DATE', 'DESC', 2], ['SORT_BY_RELEASE_DATE', 'ASC', 1], ['SORT_BY_YEAR', 'ASC', 1], ['SORT_BY_YEAR', 'DESC', 1],
  ['SORT_BY_POPULARITY', 'DESC', 1], ['SORT_BY_USER_RATING_COUNT', 'ASC', 1], ['SORT_BY_USER_RATING', 'ASC', 1],
];
const wpick = (a) => { let n = Math.random() * a.reduce((s, x) => s + x[2], 0); for (const x of a) if ((n -= x[2]) < 0) return x; return a[0]; };
function yearWindow(from, to) {
  const lo = from || 1920, hi = to || new Date().getFullYear();
  if (hi - lo <= 3 || Math.random() < 0.15) return [from, to];
  // в последние десятилетия тайтлов больше — смещаем вероятность к ним
  const span = rnd(4), mid = Math.round(hi - Math.pow(Math.random(), 1.6) * (hi - lo));
  return [Math.max(lo, mid - span), Math.min(hi, mid + span)];
}
function merge(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b || {})) out[k] = out[k] !== undefined && (k === 'genres' || k === 'interestIds') ? [...new Set([].concat(out[k], v))] : v;
  return out;
}

async function queryPair(g, s, f) {
  if (s?.list) {
    const sn = await snap();
    return LISTS[s.list].map((id) => sn.titles[id]).filter(Boolean);
  }
  const gv = g ? (g.alt ? pick(g.alt) : g.q) : {};
  const sv = s ? (s.alt ? pick(s.alt) : s.q) : {};
  const [from, to] = yearWindow(f.from, f.to);
  const [sortBy, sortOrder] = wpick(SORTS);
  const floor = f.mode === 'movie' ? f.vm : Math.min(f.vm, f.vs);
  const p = merge(merge({ types: TYPES[f.mode], minVoteCount: floor, minAggregateRating: f.minRating || undefined, sortBy, sortOrder }, gv), sv);
  // полоса голосов: хиты, крепкие середнячки или малоизвестные
  const band = Math.random();
  if (!f.known && band < 0.3) p.maxVoteCount = pick([8000, 20000, 50000]);
  else if (band > 0.85) p.minVoteCount = Math.max(p.minVoteCount, 80000);
  if (s?.kinds) p.types = ['TV_MINI_SERIES'];
  else if (s?.series) p.types = TYPES[f.mode].filter((x) => x !== 'MOVIE');
  if (s?.minV) p.minVoteCount = Math.max(p.minVoteCount, s.minV);
  const end = (y) => (s?.maxY ? Math.min(s.maxY, y || s.maxY) : y);
  p.startYear = from; p.endYear = end(to);
  let d = await getJSON(`${B}/titles?${qs(p)}`);
  if ((d.titles?.length || 0) < 10) {
    const q2 = { ...p, startYear: f.from, endYear: end(f.to) }; delete q2.maxVoteCount;
    const d2 = await getJSON(`${B}/titles?${qs(q2)}`); d = { titles: [...(d.titles || []), ...(d2.titles || [])], nextPageToken: d2.nextPageToken };
  }
  let list = (d.titles || []).map(norm);
  // глубже в выдачу: 0–3 страницы
  const depth = d.nextPageToken ? wpick([[0, 0, 3], [1, 0, 3], [2, 0, 2], [3, 0, 1]])[0] : 0;
  for (let k = 0, tok = d.nextPageToken; k < depth && tok; k++) {
    try { const dn = await getJSON(`${B}/titles?${qs(p)}&pageToken=${encodeURIComponent(tok)}`); list = list.concat((dn.titles || []).map(norm)); tok = dn.nextPageToken; } catch { break; }
  }
  return list;
}

// ---------- Аниме: AniList GraphQL (без ключа, CORS, лимит ~30 запросов/мин) ----------
const AL = 'https://graphql.anilist.co';
const ALQ = `query($page:Int,$sort:[MediaSort],$fmt:[MediaFormat],$g:[String],$tag:[String],$pop:Int,$sc:Int,$from:FuzzyDateInt,$to:FuzzyDateInt){
Page(page:$page,perPage:50){pageInfo{lastPage hasNextPage}
media(type:ANIME,isAdult:false,sort:$sort,format_in:$fmt,genre_in:$g,tag_in:$tag,minimumTagRank:60,popularity_greater:$pop,averageScore_greater:$sc,startDate_greater:$from,startDate_lesser:$to){
id idMal title{romaji english native} format episodes startDate{year} endDate{year} averageScore popularity genres tags{name rank} coverImage{extraLarge} trailer{id site} description(asHtml:false) duration}}}`;
let alNext = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function alFetch(vars) {
  const key = 'al:' + JSON.stringify(vars);
  try { const c = sessionStorage.getItem(key); if (c) return JSON.parse(c); } catch {}
  for (let k = 0; k < 2; k++) {
    const wait = alNext - Date.now(); alNext = Math.max(Date.now(), alNext) + 2100; if (wait > 0) await sleep(wait);
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 9000);
    try {
      const r = await fetch(AL, { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ query: ALQ, variables: vars }) });
      if (r.status === 429) { await sleep(Math.min(8000, (+r.headers.get('Retry-After') || 3) * 1000)); continue; }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = (await r.json()).data?.Page;
      try { sessionStorage.setItem(key, JSON.stringify(d)); } catch {}
      return d;
    } finally { clearTimeout(timer); }
  }
  throw new Error('anilist rate');
}
const stripHtml = (s) => String(s || '').replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '').replace(/\(Source:[^)]*\)/gi, '').replace(/\n{2,}/g, '\n').trim();
export function normAnime(m) {
  return {
    id: 'al' + m.id, src: 'al', al: m.id, mal: m.idMal || undefined,
    t: m.title.english || m.title.romaji, o: m.title.english && m.title.romaji !== m.title.english ? m.title.romaji : m.title.native,
    k: m.format === 'MOVIE' ? 'movie' : 'tvSeries', fmt: m.format, y: m.startDate?.year, e: m.format === 'MOVIE' ? undefined : m.endDate?.year,
    r: m.averageScore ? m.averageScore / 10 : undefined, v: m.popularity, g: m.genres || [],
    tags: (m.tags || []).filter((x) => x.rank >= 60).map((x) => x.name), i: m.coverImage?.extraLarge, ep: m.episodes || undefined,
    s: m.format === 'MOVIE' && m.duration ? m.duration * 60 : undefined, p: stripHtml(m.description), yt: m.trailer?.site === 'youtube' ? m.trailer.id : undefined,
  };
}
const AFMT = { movie: ['MOVIE'], series: ['TV', 'TV_SHORT', 'ONA', 'OVA'], all: ['TV', 'TV_SHORT', 'MOVIE', 'ONA', 'OVA'] };
const ASORT = [['POPULARITY_DESC', 0, 3], ['SCORE_DESC', 0, 2], ['START_DATE_DESC', 0, 2], ['START_DATE', 0, 1], ['TRENDING_DESC', 0, 1], ['FAVOURITES_DESC', 0, 1], ['ID', 0, 1], ['ID_DESC', 0, 1]];
const lastPages = load('kr:alpages');
function load(k) { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch { return {}; } }
export function matchAnime(t, g, s, f) {
  if (t.src !== 'al' || !t.i) return false;
  if (!AFMT[f.mode].includes(t.fmt || (t.k === 'movie' ? 'MOVIE' : 'TV'))) return false;
  if (f.from && (!t.y || t.y < f.from)) return false;
  if (f.to && (!t.y || t.y > f.to)) return false;
  if (f.minRating && (t.r || 0) < f.minRating) return false;
  if ((t.v || 0) < (f.known ? 30000 : 1500)) return false;
  const a = s?.al;
  if (a?.g && !a.g.some((x) => (t.g || []).includes(x))) return false;
  if (a?.tag && !a.tag.some((x) => (t.tags || []).includes(x))) return false;
  if (a?.fmt && !a.fmt.includes(t.fmt || (t.k === 'movie' ? 'MOVIE' : 'TV'))) return false;
  return true;
}
async function queryAnime(s, f) {
  const a = s?.al || {};
  const fmt = a.fmt ? a.fmt.filter((x) => AFMT[f.mode].includes(x)) : AFMT[f.mode];
  const vars = { sort: [wpick(ASORT)[0]], fmt, pop: f.known ? 30000 : 1500 };
  if (a.g) vars.g = a.g; if (a.tag) vars.tag = a.tag;
  if (f.minRating) vars.sc = Math.round(f.minRating * 10) - 1;
  if (f.from) vars.from = f.from * 10000; if (f.to) vars.to = (f.to + 1) * 10000;
  const key = JSON.stringify({ ...vars, sort: 0 });
  // pageInfo.total у AniList условный (≤5000), поэтому реальную глубину узнаём сами: пустая страница — сужаем окно
  let lp = lastPages[key] || 12, d = null;
  for (let k = 0; k < 3; k++) {
    vars.page = 1 + rnd(lp);
    d = await alFetch(vars);
    const n = d?.media?.length || 0;
    if (n && (n < 50 || !d.pageInfo?.hasNextPage)) lp = vars.page;
    else if (n && vars.page === lp) lp = Math.min(100, lp * 2);
    if (!n) lp = Math.max(1, Math.floor(vars.page / 2));
    if (n || vars.page === 1) break;
  }
  lastPages[key] = lp; try { localStorage.setItem('kr:alpages', JSON.stringify(lastPages)); } catch {}
  return (d?.media || []).map(normAnime);
}

async function fallbackPair(g, s) {
  const sn = await snap();
  const ids = s && sn.chips[s.id] ? sn.chips[s.id] : s?.list ? LISTS[s.list] : Object.keys(sn.titles);
  return ids.map((id) => sn.titles[id]).filter(Boolean);
}

// Банк: всё, что пришло по этой комбинации за сессию, копится — пул растёт с каждым спином.
const banks = new Map();
// Логика: ИЛИ между выбранными жанрами; поджанр сужает только свой жанр.
// pairs: [[жанр|null, поджанр|null], ...]. Возвращает пул [{t, g, s}].
export async function getPool(P, f) {
  let pairs = P.length ? P.slice() : [[null, null]];
  if (f.mode === 'movie') {
    const ok = pairs.filter(([, s]) => !s?.series);
    if (!ok.length) return { pool: [], conflict: 'Мини-сериалы и ситкомы бывают только среди сериалов. Переключи на «Сериалы» или «Всё».' };
    pairs = ok;
  }
  if (f.mode === 'series') {
    const ok = pairs.filter(([, s]) => !s?.movie);
    if (!ok.length) return { pool: [], conflict: 'Аниме-фильмы бывают только среди фильмов. Переключи на «Фильмы» или «Всё».' };
    pairs = ok;
  }
  // без жанра — крутим по всему каталогу, иногда и по аниме
  if (!P.length && f.anyAnime !== false && Math.random() < 0.2) pairs = [[null, null], [ANIME, null]];
  if (pairs.length === 1) pairs.push(pairs[0]);
  pairs.sort(() => Math.random() - 0.5);
  let offline = false;
  const pool = [], seen = new Set();
  const fk = JSON.stringify([f.mode, f.from, f.to, f.minRating, f.known]);
  const run = async (batch) => {
    const parts = await Promise.all(batch.map(async ([g, s]) => {
      const isA = g?.src === 'anilist';
      let list, snapF = !!s?.list;
      // общий дедлайн 8 с: дальше — встроенный каталог, а не бесконечное «Крутим…»
      const deadline = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 6500));
      try { list = await Promise.race([isA ? queryAnime(s, f) : queryPair(g, s, f), deadline]); } catch { offline = true; snapF = true; list = await fallbackPair(g, s); }
      const bk = `${g?.id}|${s?.id}|${fk}`;
      if (!banks.has(bk)) banks.set(bk, new Map());
      const bank = banks.get(bk);
      const fresh = list.filter((t) => matchLocal(t, g, s, f)).map((t) => ({ t, g: g?.id || null, s: s?.id || null, snap: snapF }));
      for (const x of fresh) if (!bank.has(x.t.id)) bank.set(x.t.id, x);
      // свежая выдача + накопленный банк
      return [...fresh, ...bank.values()];
    }));
    for (const part of parts) for (const x of part) if (!seen.has(x.t.id)) { seen.add(x.t.id); pool.push(x); }
  };
  await run(pairs.slice(0, 3));
  // мало вариантов — добираем остальные пары
  for (let i = 3; pool.length < 12 && i < pairs.length; i += 3) await run(pairs.slice(i, i + 3));
  return { pool, offline };
}

export async function core(id) {
  if (String(id).startsWith('al')) return null;
  const full = await getJSON(`${B}/titles/${id}`, 4500);
  return Object.assign(norm(full), {
    interests: (full.interests || []).map((x) => x.id),
    countries: (full.originCountries || []).map((x) => x.code),
    directors: (full.directors || []).map((d) => d.displayName),
    stars: (full.stars || []).map((d) => d.displayName),
    meta: full.metacritic?.score,
  });
}

// Детали: русское название, сезоны, описание из русской Википедии.
export async function details(t) {
  if (t.src === 'al') {
    const w = await wiki('P8729', t.al).catch(() => null);
    const cyr = (x) => /[а-яё]/i.test(x || '');
    return { ...t, ru: cyr(w?.label) ? w.label : null, wiki: w?.extract || null, plotRu: w?.plot || null, wikiUrl: w?.url || null };
  }
  const [full, akas, seasons, w] = await Promise.all([
    t.interests ? t : core(t.id).catch(() => null),
    getJSON(`${B}/titles/${t.id}/akas`).catch(() => null),
    /tvSeries|tvMiniSeries/.test(t.k) ? getJSON(`${B}/titles/${t.id}/seasons`).catch(() => null) : null,
    wiki('P345', t.id).catch(() => null),
  ]);
  const out = { ...t, ...(full || {}) };
  const cyr = (a) => /[а-яё]/i.test(a?.text || '');
  const A = akas?.akas || [];
  const ru = A.find((a) => a.country?.code === 'RU' && cyr(a)) || A.find((a) => a.language?.code === 'ru' && cyr(a));
  out.ru = ru?.text || (cyr({ text: w?.label }) ? w.label : null) || null;
  if (seasons?.seasons) out.seasons = seasons.seasons.filter((s) => /^\d+$/.test(s.season)).length;
  out.wiki = w?.extract || null;
  out.plotRu = w?.plot || null;
  out.wikiUrl = w?.url || null;
  return out;
}

async function wiki(prop, val) {
  const W = 'https://www.wikidata.org/w/api.php?format=json&origin=*';
  const s = await getJSON(`${W}&action=query&list=search&srlimit=1&srsearch=haswbstatement:${prop}=${val}`, 6000);
  const q = s?.query?.search?.[0]?.title;
  if (!q) return null;
  const e = await getJSON(`${W}&action=wbgetentities&ids=${q}&props=labels|sitelinks&languages=ru&sitefilter=ruwiki`, 6000);
  const ent = e?.entities?.[q];
  const label = ent?.labels?.ru?.value || null;
  const page = ent?.sitelinks?.ruwiki?.title;
  if (!page) return { label };
  const [sum, plot] = await Promise.all([
    getJSON(`https://ru.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page.replace(/ /g, '_'))}`, 6000),
    wikiPlot(page).catch(() => null),
  ]);
  return { label, extract: sum?.extract || null, plot, url: sum?.content_urls?.desktop?.page || null };
}
// раздел «Сюжет» из ру-вики: первые абзацы, до ~700 знаков по границе предложения
async function wikiPlot(page) {
  const d = await getJSON(`https://ru.wikipedia.org/w/api.php?format=json&origin=*&action=query&prop=extracts&explaintext=1&exsectionformat=wiki&redirects=1&titles=${encodeURIComponent(page)}`, 6000);
  const txt = Object.values(d?.query?.pages || {})[0]?.extract || '';
  const m = txt.match(/\n==\s*(Сюжет|Синопсис|Содержание|Фабула)\s*==\s*\n([\s\S]*?)(?=\n==[^=]|$)/);
  if (!m) return null;
  let body = m[2].replace(/\n===[^\n]*===\n/g, '\n').replace(/\n{2,}/g, '\n').trim();
  if (body.length < 60) return null;
  if (body.length > 700) { const cut = body.slice(0, 700); const i = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? ')); body = i > 200 ? cut.slice(0, i + 1) : cut + '…'; }
  return body.replace(/\n/g, ' ');
}
