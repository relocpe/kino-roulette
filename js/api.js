import { byId, LISTS } from './chips.js';

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

function okLocal(t, f, chip) {
  if (!t.i) return false;
  if (!(chip?.forceType) && !KIND[f.mode].includes(t.k)) return false;
  if (f.from && t.y && t.y < f.from) return false;
  if (f.to && t.y && t.y > f.to) return false;
  if (f.minRating && (t.r || 0) < f.minRating) return false;
  return true;
}

// Случайное окно лет внутри диапазона, чтобы каждый спин давал другие 50 тайтлов.
function yearWindow(from, to) {
  const lo = from || 1960, hi = to || new Date().getFullYear();
  if (hi - lo <= 8 || Math.random() < 0.3) return [from, to];
  // чуть чаще новые годы
  const u = Math.pow(Math.random(), 0.7);
  const span = 4 + rnd(8);
  const mid = Math.round(hi - u * (hi - lo));
  return [Math.max(lo, mid - span), Math.min(hi, mid + span)];
}

async function queryChip(chip, f) {
  if (chip?.list) {
    const s = await snap();
    return (s.chips[chip.id] || []).map((id) => s.titles[id]).filter((t) => okLocal(t, f, chip));
  }
  const variant = chip ? (chip.alt ? pick(chip.alt) : chip.q) : {};
  const [from, to] = yearWindow(f.from, f.to);
  const sorts = [['SORT_BY_POPULARITY', 'ASC'], ['SORT_BY_USER_RATING_COUNT', 'DESC'], ['SORT_BY_USER_RATING', 'DESC']];
  const [sortBy, sortOrder] = pick(sorts);
  const p = {
    types: TYPES[f.mode], minVoteCount: f.minVotes, minAggregateRating: f.minRating || undefined,
    startYear: from || undefined, endYear: to || undefined, sortBy, sortOrder, ...variant,
  };
  if (chip?.forceType) p.types = variant.types;
  if (variant.endYear && to) p.endYear = Math.min(variant.endYear, to);
  if (variant.startYear && from) p.startYear = Math.max(variant.startYear, from);
  let d = await getJSON(`${B}/titles?${qs(p)}`);
  // если окно лет оказалось пустым, берём весь диапазон
  if (!d.titles?.length && (from !== f.from || to !== f.to)) {
    d = await getJSON(`${B}/titles?${qs({ ...p, startYear: f.from || undefined, endYear: variant.endYear || f.to || undefined })}`);
  }
  let list = (d.titles || []).map(norm);
  if (d.nextPageToken && Math.random() < 0.45) {
    try {
      const d2 = await getJSON(`${B}/titles?${qs(p)}&pageToken=${encodeURIComponent(d.nextPageToken)}`);
      list = list.concat((d2.titles || []).map(norm));
    } catch {}
  }
  return list.filter((t) => okLocal(t, f, chip));
}

async function fallbackChip(chip, f) {
  const s = await snap();
  const ids = chip ? s.chips[chip.id] || [] : Object.keys(s.titles);
  return ids.map((id) => s.titles[id]).filter((t) => okLocal(t, f, chip));
}

// Возвращает пул: [{title, chipId}], и флаг offline, если пришлось брать встроенную базу.
export async function getPool(chipIds, f) {
  const chosen = chipIds.length ? [...chipIds].sort(() => Math.random() - 0.5).slice(0, 3) : [null];
  let offline = false;
  const parts = await Promise.all(chosen.map(async (id) => {
    const chip = id ? byId[id] : null;
    let list;
    try { list = await queryChip(chip, f); } catch { offline = true; list = await fallbackChip(chip, f); }
    return list.map((t) => ({ t, chip: id }));
  }));
  const seen = new Set();
  const pool = [];
  for (const part of parts) for (const x of part) if (!seen.has(x.t.id)) { seen.add(x.t.id); pool.push(x); }
  return { pool, offline };
}

export async function seedPosters() {
  const s = await snap();
  return s.seed.map((id) => s.titles[id]);
}

// Детали: русское название, сезоны, описание из русской Википедии.
export async function details(t) {
  const tasks = [
    getJSON(`${B}/titles/${t.id}`).catch(() => null),
    getJSON(`${B}/titles/${t.id}/akas`).catch(() => null),
    /tvSeries|tvMiniSeries/.test(t.k) ? getJSON(`${B}/titles/${t.id}/seasons`).catch(() => null) : null,
    wiki(t.id).catch(() => null),
  ];
  const [full, akas, seasons, w] = await Promise.all(tasks);
  const out = { ...t };
  if (full) Object.assign(out, norm(full), {
    directors: (full.directors || []).map((d) => d.displayName),
    stars: (full.stars || []).slice(0, 3).map((d) => d.displayName),
    meta: full.metacritic?.score,
  });
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
