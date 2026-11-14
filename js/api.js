import { LISTS } from './chips.js?v=3';

const B = 'https://api.tiffara.com';
const IMG = 'https://m.media-amazon.com/images/M/';
const rnd = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rnd(a.length)];
const qs = (o) => Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '')
  .flatMap(([k, v]) => [].concat(v).map((x) => `${k}=${encodeURIComponent(x)}`)).join('&');

let snapshot = null;
async function snap() {
  if (!snapshot) snapshot = fetch('data/snapshot.json').then((r) => r.json());
  return snapshot;
}

async function getJSON(url, ms = 9000) {
  const key = 'k:' + url;
  try { const c = sessionStorage.getItem(key); if (c) return JSON.parse(c); } catch {}
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    try { sessionStorage.setItem(key, JSON.stringify(d)); } catch {}
    return d;
  } finally { clearTimeout(timer); }
}

export const poster = (path, w = 400) => (path ? `${IMG}${path}._V1_QL80_UX${w}_.jpg` : '');
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
  const kinds = s?.kinds || (s?.series ? SERIES : null);
  if (!KIND[f.mode].includes(t.k)) return false;
  if (kinds && !kinds.includes(t.k)) return false;
  if (f.from && (!t.y || t.y < f.from)) return false;
  if (f.to && (!t.y || t.y > f.to)) return false;
  if (f.minRating && (t.r || 0) < f.minRating) return false;
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

// Случайное окно лет внутри диапазона, чтобы каждый спин давал другие тайтлы.
function yearWindow(from, to) {
  const lo = from || 1960, hi = to || new Date().getFullYear();
  if (hi - lo <= 8 || Math.random() < 0.35) return [from, to];
  const u = Math.pow(Math.random(), 0.7), span = 4 + rnd(8), mid = Math.round(hi - u * (hi - lo));
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
  const [sortBy, sortOrder] = pick([['SORT_BY_POPULARITY', 'ASC'], ['SORT_BY_USER_RATING_COUNT', 'DESC'], ['SORT_BY_USER_RATING', 'DESC']]);
  const p = merge(merge({ types: TYPES[f.mode], minVoteCount: f.minVotes, minAggregateRating: f.minRating || undefined, sortBy, sortOrder }, gv), sv);
  if (s?.kinds) p.types = ['TV_MINI_SERIES'];
  else if (s?.series) p.types = TYPES[f.mode].filter((x) => x !== 'MOVIE');
  if (s?.minV) p.minVoteCount = Math.max(f.minVotes, s.minV);
  const end = (y) => (s?.maxY ? Math.min(s.maxY, y || s.maxY) : y);
  p.startYear = from; p.endYear = end(to);
  let d = await getJSON(`${B}/titles?${qs(p)}`);
  if (!d.titles?.length && (from !== f.from || to !== f.to)) d = await getJSON(`${B}/titles?${qs({ ...p, startYear: f.from, endYear: end(f.to) })}`);
  let list = (d.titles || []).map(norm);
  if (d.nextPageToken && Math.random() < 0.45) {
    try { const d2 = await getJSON(`${B}/titles?${qs(p)}&pageToken=${encodeURIComponent(d.nextPageToken)}`); list = list.concat((d2.titles || []).map(norm)); } catch {}
  }
  return list;
}
async function fallbackPair(g, s) {
  const sn = await snap();
  const ids = s ? sn.chips[s.id] || [] : g ? sn.chips[g.id] || [] : Object.keys(sn.titles);
  return ids.map((id) => sn.titles[id]).filter(Boolean);
}

// Логика: ИЛИ внутри «Жанров», ИЛИ внутри «Поджанров», И между группами.
// Возвращает пул [{t, g, s}] — каждый тайтл с парой чипов, которой он соответствует.
export async function getPool(G, S, f) {
  if (f.mode === 'movie' && S.length && S.every((s) => s.series)) return { pool: [], conflict: true };
  const Sx = f.mode === 'movie' ? S.filter((s) => !s.series) : S;
  const pairs = [];
  for (const g of G.length ? G : [null]) for (const s of Sx.length ? Sx : [null]) pairs.push([g, s]);
  pairs.sort(() => Math.random() - 0.5);
  let offline = false;
  const pool = [], seen = new Set();
  const run = async (batch) => {
    const parts = await Promise.all(batch.map(async ([g, s]) => {
      let list;
      try { list = await queryPair(g, s, f); } catch { offline = true; list = await fallbackPair(g, s); }
      return list.filter((t) => matchLocal(t, g, s, f)).map((t) => ({ t, g: g?.id || null, s: s?.id || null }));
    }));
    for (const part of parts) for (const x of part) if (!seen.has(x.t.id)) { seen.add(x.t.id); pool.push(x); }
  };
  await run(pairs.slice(0, 3));
  // мало вариантов — добираем остальные пары
  for (let i = 3; pool.length < 12 && i < pairs.length; i += 3) await run(pairs.slice(i, i + 3));
  return { pool, offline };
}

export async function core(id) {
  const full = await getJSON(`${B}/titles/${id}`, 6000);
  return Object.assign(norm(full), {
    interests: (full.interests || []).map((x) => x.id),
    countries: (full.originCountries || []).map((x) => x.code),
    directors: (full.directors || []).map((d) => d.displayName),
    meta: full.metacritic?.score,
  });
}

export async function seedPosters() {
  const s = await snap();
  return s.seed.map((id) => s.titles[id]);
}

// Детали: русское название, сезоны, описание из русской Википедии.
export async function details(t) {
  const [full, akas, seasons, w] = await Promise.all([
    t.interests ? t : core(t.id).catch(() => null),
    getJSON(`${B}/titles/${t.id}/akas`).catch(() => null),
    /tvSeries|tvMiniSeries/.test(t.k) ? getJSON(`${B}/titles/${t.id}/seasons`).catch(() => null) : null,
    wiki(t.id).catch(() => null),
  ]);
  const out = { ...t, ...(full || {}) };
  const ru = akas?.akas?.find((a) => a.country?.code === 'RU') || akas?.akas?.find((a) => a.language?.code === 'ru');
  out.ru = ru?.text || w?.label || null;
  if (seasons?.seasons) out.seasons = seasons.seasons.filter((s) => /^\d+$/.test(s.season)).length;
  out.wiki = w?.extract || null;
  out.wikiUrl = w?.url || null;
  return out;
}

async function wiki(imdb) {
  const W = 'https://www.wikidata.org/w/api.php?format=json&origin=*';
  const s = await getJSON(`${W}&action=query&list=search&srlimit=1&srsearch=haswbstatement:P345=${imdb}`, 6000);
  const q = s?.query?.search?.[0]?.title;
  if (!q) return null;
  const e = await getJSON(`${W}&action=wbgetentities&ids=${q}&props=labels|sitelinks&languages=ru&sitefilter=ruwiki`, 6000);
  const ent = e?.entities?.[q];
  const label = ent?.labels?.ru?.value || null;
  const page = ent?.sitelinks?.ruwiki?.title;
  if (!page) return { label };
  const sum = await getJSON(`https://ru.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page.replace(/ /g, '_'))}`, 6000);
  return { label, extract: sum?.extract || null, url: sum?.content_urls?.desktop?.page || null };
}
