// Офлайн-каталог: node build-catalog.mjs → data/catalog.json (компактные строки) + data/seed.json
import { GENRES, MOODS } from './js/chips.js';
import { readFileSync, writeFileSync } from 'node:fs';
const B = 'https://api.tiffara.com';
const H = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) Chrome/130 Safari/537.36' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function j(url, o = {}) { for (let i = 0; i < 5; i++) { try { const r = await fetch(url, { ...o, headers: { ...H, ...(o.headers || {}) } }); if (r.ok) return r.json(); if (r.status === 429) await sleep(4000 * (i + 1)); } catch {} await sleep(800 * (i + 1)); } throw new Error('fail ' + url); }
const qs = (o) => Object.entries(o).filter(([, v]) => v !== undefined).flatMap(([k, v]) => [].concat(v).map((x) => `${k}=${encodeURIComponent(x)}`)).join('&');
const img = (u) => (u ? u.replace('https://m.media-amazon.com/images/M/', '').replace(/\._V1_.*$/, '') : null);
const T = new Map();
// прошлый каталог: из него берутся проверенные списки поджанров (интересы IMDb проверялись по карточкам)
let old = { titles: {}, chips: {}, seed: [] };
try { const c = JSON.parse(readFileSync('data/catalog.json')); old.chips = c.chips; old.seed = JSON.parse(readFileSync('data/seed.json')).filter((x) => x.id.startsWith('tt')).map((x) => x.id); for (const r of c.titles) if (r[0].startsWith('tt')) old.titles[r[0]] = { id: r[0], t: r[1], o: r[2] || undefined, k: c.kinds[r[3]], y: r[4], e: r[5] || undefined, r: r[6] / 10, v: r[7], g: r[8] ? r[8].split(',').map((x) => c.genres[x]) : [], i: r[9], s: r[10] || undefined }; } catch {}
for (const t of Object.values(old.titles)) if (t.i) T.set(t.id, t);
const SER = ['tvSeries', 'tvMiniSeries'];
const okVotes = (t) => (t.v || 0) >= (SER.includes(t.k) ? 500 : 1000);
const addI = (arr) => { let n = 0; for (const t of arr || []) { if (!t.primaryImage) continue; const c = { id: t.id, t: t.primaryTitle, o: t.originalTitle !== t.primaryTitle ? t.originalTitle : undefined, k: t.type, y: t.startYear, e: t.endYear, r: t.rating?.aggregateRating, v: t.rating?.voteCount, g: t.genres, i: img(t.primaryImage.url), s: t.runtimeSeconds }; if (!okVotes(c)) continue; if (!T.has(c.id)) n++; T.set(c.id, c); } return n; };
async function walk(p, pages) {
  let tok = null, n = 0;
  for (let k = 0; k < pages; k++) {
    const d = await j(`${B}/titles?${qs(p)}${tok ? '&pageToken=' + encodeURIComponent(tok) : ''}`);
    n += addI(d.titles); tok = d.nextPageToken; if (!tok) break;
  }
  return n;
}
const types = ['MOVIE', 'TV_SERIES', 'TV_MINI_SERIES'];
const tasks = [];
for (const g of GENRES) {
  if (g.src) continue;
  const gv = g.alt ? g.alt : [g.q];
  for (const v of gv) {
    const base = { types, minVoteCount: 500, ...v };
    tasks.push([{ ...base, sortBy: 'SORT_BY_POPULARITY', sortOrder: 'ASC' }, 6]);
    tasks.push([{ ...base, sortBy: 'SORT_BY_USER_RATING_COUNT', sortOrder: 'DESC' }, 2]);
    tasks.push([{ ...base, sortBy: 'SORT_BY_USER_RATING', sortOrder: 'DESC', minVoteCount: 3000 }, 2]);
    tasks.push([{ ...base, sortBy: 'SORT_BY_POPULARITY', sortOrder: 'ASC', maxVoteCount: 30000 }, 3]);
    for (const [a, b] of [[1930, 1959], [1960, 1979], [1980, 1989], [1990, 1999], [2000, 2009], [2010, 2016], [2017, 2021], [2022, 2026]])
      tasks.push([{ ...base, sortBy: 'SORT_BY_POPULARITY', sortOrder: 'ASC', startYear: a, endYear: b }, 2]);
  }
}
console.log('imdb tasks', tasks.length);
for (let i = 0; i < tasks.length; i += 4) {
  await Promise.all(tasks.slice(i, i + 4).map(([p, n]) => walk(p, n).catch((e) => console.log('ERR', e.message))));
  if (i % 40 === 0) console.log(i, T.size);
}
console.log('imdb titles', T.size);
// аниме из AniList
const ALQ = `query($page:Int,$sort:[MediaSort]){Page(page:$page,perPage:50){media(type:ANIME,isAdult:false,sort:$sort,popularity_greater:1500,format_in:[TV,TV_SHORT,MOVIE,ONA,OVA]){id idMal title{romaji english native} format episodes startDate{year} endDate{year} averageScore popularity genres tags{name rank} coverImage{extraLarge} duration}}}`;
const A = new Map();
for (const [sort, pages] of [['POPULARITY_DESC', 50], ['SCORE_DESC', 12], ['START_DATE_DESC', 8]]) {
  for (let p = 1; p <= pages; p++) {
    const d = await j('https://graphql.anilist.co', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ query: ALQ, variables: { page: p, sort: [sort] } }) });
    for (const m of d.data?.Page?.media || []) if (m.coverImage?.extraLarge) A.set(m.id, m);
    await sleep(2200);
  }
  console.log('anime', sort, A.size);
}
// компактная упаковка
const kinds = ['movie', 'tvMovie', 'tvSeries', 'tvMiniSeries', 'tvSpecial', 'video', 'short', 'tvShort', 'tvEpisode', 'videoGame'];
const fmts = ['TV', 'TV_SHORT', 'MOVIE', 'ONA', 'OVA', 'SPECIAL', 'MUSIC'];
const genres = [], tags = [];
const gi = (x) => { let k = genres.indexOf(x); if (k < 0) { genres.push(x); k = genres.length - 1; } return k; };
const ti = (x) => { let k = tags.indexOf(x); if (k < 0) { tags.push(x); k = tags.length - 1; } return k; };
const AL_IMG = 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/';
const rows = [];
for (const t of T.values()) {
  let k = kinds.indexOf(t.k); if (k < 0) { kinds.push(t.k); k = kinds.length - 1; }
  rows.push([t.id, t.t, t.o || 0, k, t.y || 0, t.e || 0, t.r ? Math.round(t.r * 10) : 0, t.v || 0, (t.g || []).map(gi).join(','), t.i, t.s || 0]);
}
const WANT = new Set(['Shounen', 'Seinen', 'Isekai']);
for (const m of A.values()) {
  const im = m.coverImage.extraLarge;
  if (!im.startsWith(AL_IMG)) continue;
  const tg = (m.tags || []).filter((x) => x.rank >= 60 && WANT.has(x.name)).map((x) => ti(x.name)).join(',');
  rows.push(['al' + m.id, m.title.english || m.title.romaji, (m.title.english && m.title.romaji !== m.title.english ? m.title.romaji : m.title.native) || 0, fmts.indexOf(m.format), m.startDate?.year || 0, m.format === 'MOVIE' ? 0 : m.endDate?.year || 0, m.averageScore || 0, m.popularity || 0, (m.genres || []).map(gi).join(','), im.slice(AL_IMG.length), m.format === 'MOVIE' && m.duration ? m.duration * 60 : 0, tg, m.episodes || 0]);
}
const chips = {};
for (const c of MOODS) if (old.chips[c.id] && !c.al) chips[c.id] = old.chips[c.id];
writeFileSync('data/catalog.json', JSON.stringify({ kinds, fmts, genres, tags, alImg: AL_IMG, titles: rows, chips }));
// посев для барабана при загрузке: популярное IMDb + немного аниме
const seed = [...old.seed.map((id) => old.titles[id])].filter((t) => t?.i).map((t) => ({ id: t.id, t: t.t, i: t.i }));
const topA = [...A.values()].sort((a, b) => b.popularity - a.popularity).slice(0, 12).map((m) => ({ id: 'al' + m.id, t: m.title.english || m.title.romaji, i: m.coverImage.extraLarge }));
for (let i = 0; i < topA.length; i++) seed.splice(3 + i * 4, 0, topA[i]);
writeFileSync('data/seed.json', JSON.stringify(seed));
console.log('rows', rows.length, 'imdb', T.size, 'anime', A.size);
