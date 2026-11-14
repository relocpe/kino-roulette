// Трейлер без ключей: Wikidata (P1651) → поиск через публичные Piped/Invidious с CORS → ссылка на поиск YouTube.
import { getJSON } from './api.js?v=8';

const W = 'https://www.wikidata.org/w/api.php?format=json&origin=*';
const PIPED = ['https://api.piped.private.coffee'];
const INV = ['https://yt.chocolatemoo53.com'];
let invList = null;
const RU_LANG = 'Q7737';

const norm = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const cache = new Map();

async function invInstances() {
  if (!invList) invList = getJSON('https://api.invidious.io/instances.json?sort_by=health', 5000)
    .then((d) => d.filter(([, x]) => x.cors && x.api && x.type === 'https').map(([h]) => 'https://' + h).slice(0, 4))
    .catch(() => []);
  return [...new Set([...INV, ...(await invList)])];
}

async function wikidataIds(imdb) {
  const s = await getJSON(`${W}&action=query&list=search&srlimit=1&srsearch=haswbstatement:P345=${imdb}`, 6000);
  const q = s?.query?.search?.[0]?.title; if (!q) return [];
  const c = await getJSON(`${W}&action=wbgetclaims&entity=${q}&property=P1651`, 6000);
  return (c?.claims?.P1651 || []).filter((x) => x.rank !== 'deprecated').map((x) => ({
    id: x.mainsnak?.datavalue?.value,
    ru: (x.qualifiers?.P407 || []).some((l) => l.datavalue?.value?.id === RU_LANG),
  })).filter((x) => /^[\w-]{11}$/.test(x.id || ''));
}

// ищем по нескольким зеркалам, отдаём [{id, title, len}]
async function search(q) {
  const tries = [
    ...PIPED.map((h) => () => getJSON(`${h}/search?q=${encodeURIComponent(q)}&filter=videos`, 6000)
      .then((d) => (d.items || []).filter((x) => x.url).map((x) => ({ id: x.url.split('v=')[1], title: x.title, len: x.duration, ch: x.uploaderName })))),
  ];
  for (const h of await invInstances()) tries.push(() => getJSON(`${h}/api/v1/search?q=${encodeURIComponent(q)}&type=video`, 6000)
    .then((d) => (Array.isArray(d) ? d : []).map((x) => ({ id: x.videoId, title: x.title, len: x.lengthSeconds, ch: x.author }))));
  for (const f of tries) { try { const r = await f(); if (r.length) return r; } catch {} }
  return null;
}

function best(list, names, year, ru) {
  const keys = names.filter(Boolean).map(norm);
  let top = null, tops = -1;
  for (const v of list || []) {
    const n = norm(v.title);
    if (!v.id || !/(трейлер|trailer|тизер|teaser)/.test(n)) continue;
    if (!(v.len > 15 && v.len < 330)) continue;
    if (/(reaction|реакция|review|обзор|разбор|breakdown|fan made|fanmade|фанатск|parody|пародия|explained|ending|все трейлеры|compilation)/.test(n)) continue;
    const hit = keys.some((k) => k && (n.includes(k) || k.split(' ').filter((w) => w.length > 3).every((w) => n.includes(w)) && k.split(' ').some((w) => w.length > 3)));
    if (!hit) continue;
    let s = 1;
    if (year && n.includes(String(year))) s += 2;
    if (/(official|официальн)/.test(n)) s += 1;
    if (ru && /(русск|дубл|на русском)/.test(n)) s += 2;
    if (!ru && /(русск|russian|дубл)/.test(n)) s -= 3;
    if (/\b(hd|4k)\b/.test(n)) s += .3;
    if (s > tops) { tops = s; top = v; }
  }
  return top;
}

// lang: 'ru' | 'en'. Возвращает {id, title} или null.
export function findTrailer(t, lang) {
  const key = `${t.id}:${lang}`;
  if (cache.has(key)) return cache.get(key);
  const y = t.y || '';
  const p = (async () => {
    try { const s = sessionStorage.getItem('tr:' + key); if (s) return JSON.parse(s); } catch {}
    let out = null;
    const wd = String(t.id).startsWith('tt') ? await wikidataIds(t.id).catch(() => []) : t.yt ? [{ id: t.yt, ru: false }] : [];
    if (lang === 'en' && wd.length) out = { id: (wd.find((x) => !x.ru) || wd[0]).id, src: 'wikidata' };
    if (lang === 'ru' && wd.some((x) => x.ru)) out = { id: wd.find((x) => x.ru).id, src: 'wikidata' };
    if (!out) {
      const names = lang === 'ru' ? [t.ru, t.t, t.o] : [t.o, t.t];
      const kind = t.src === 'al' ? (lang === 'ru' ? ' аниме' : ' anime') : /tvSeries|tvMiniSeries/.test(t.k) ? (lang === 'ru' ? ' сериал' : ' series') : '';
      const q = lang === 'ru' ? `${t.ru || t.t} ${y}${kind} трейлер на русском` : `${t.o || t.t} ${y}${kind} official trailer`;
      let v = best(await search(q), names, t.y, lang === 'ru');
      if (!v && kind) v = best(await search(q.replace(kind, '')), names, t.y, lang === 'ru');
      if (v) out = { id: v.id, src: 'search', title: v.title };
    }
    if (!out && lang === 'en' && wd.length) out = { id: wd[0].id, src: 'wikidata' };
    try { if (out) sessionStorage.setItem('tr:' + key, JSON.stringify(out)); } catch {}
    return out;
  })();
  cache.set(key, p);
  p.then((r) => { if (!r) cache.delete(key); });
  return p;
}
export const ytSearch = (t) => `https://www.youtube.com/results?search_query=${encodeURIComponent(`${t.ru || t.t} ${t.y || ''} трейлер`)}`;
