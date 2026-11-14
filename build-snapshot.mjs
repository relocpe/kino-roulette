import { ALL, LISTS } from './js/chips.js';
import { writeFileSync } from 'node:fs';
const B = 'https://api.tiffara.com';
const H = { 'User-Agent': 'Mozilla/5.0 kino-roulette snapshot' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function j(url) { for (let i = 0; i < 4; i++) { const r = await fetch(url, { headers: H }); if (r.ok) return r.json(); await sleep(800 * (i + 1)); } throw new Error('fail ' + url); }
const qs = (o) => Object.entries(o).flatMap(([k, v]) => [].concat(v).map((x) => `${k}=${encodeURIComponent(x)}`)).join('&');
const img = (u) => (u ? u.replace('https://m.media-amazon.com/images/M/', '').replace(/\._V1_.*$/, '') : null);
const compact = (t) => ({ id: t.id, t: t.primaryTitle, o: t.originalTitle !== t.primaryTitle ? t.originalTitle : undefined, k: t.type, y: t.startYear, e: t.endYear, r: t.rating?.aggregateRating, v: t.rating?.voteCount, g: t.genres, i: img(t.primaryImage?.url), s: t.runtimeSeconds });
const out = { chips: {}, titles: {} };
const add = (arr) => arr.filter((t) => t.primaryImage).map((t) => { out.titles[t.id] = compact(t); return t.id; });
for (const c of ALL) {
  let ids = [];
  if (c.list) {
    const L = LISTS[c.list];
    for (let i = 0; i < L.length; i += 5) { const d = await j(`${B}/titles:batchGet?${L.slice(i, i + 5).map((x) => 'titleIds=' + x).join('&')}`); ids.push(...add(d.titles || [])); }
  } else {
    const variants = c.alt || [c.q];
    for (const v of variants) {
      const base = { types: ['MOVIE', 'TV_SERIES', 'TV_MINI_SERIES'], minVoteCount: 5000, ...v };
      let d = await j(`${B}/titles?${qs(base)}`); ids.push(...add(d.titles || []));
      if (d.nextPageToken && variants.length < 3) { d = await j(`${B}/titles?${qs(base)}&pageToken=${encodeURIComponent(d.nextPageToken)}`); ids.push(...add(d.titles || [])); }
    }
  }
  out.chips[c.id] = [...new Set(ids)];
  console.log(c.id, out.chips[c.id].length);
}
const seed = await j(`${B}/titles?${qs({ types: ['MOVIE', 'TV_SERIES'], minVoteCount: 100000 })}`);
out.seed = add(seed.titles);
writeFileSync('data/snapshot.json', JSON.stringify(out));
console.log('titles', Object.keys(out.titles).length);
