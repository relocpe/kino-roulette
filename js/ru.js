// Русские названия и ID Кинопоиска пачками из Wikidata (SPARQL, без ключей), с кэшем в localStorage.
// Для аниме русское название берём с Шикимори (официальный открытый API, по MAL id) — там оно есть почти всегда.
// cache[id] = [русское название | '', kinopoisk id | ''] ; id — tt… (IMDb), nm… (люди IMDb) или al… (AniList)
const KEY = 'kr:ru3', EP = 'https://query.wikidata.org/sparql?format=json&query=';
let cache = {};
try { cache = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch {}
const save = () => { try { const k = Object.keys(cache); if (k.length > 6000) k.slice(0, k.length - 6000).forEach((x) => delete cache[x]); localStorage.setItem(KEY, JSON.stringify(cache)); } catch {} };
const cyr = (s) => /[А-Яа-яЁё]/.test(s || '');
const clean = (s) => s.replace(/\s*\((фильм|телесериал|сериал|мини-сериал|мультфильм|мультсериал|аниме|аниме-сериал|документальный фильм)[^)]*\)\s*$/i, '').replace(/\s*\(\d+\s*сезон\)\s*$/i, '').trim();
export const ruCached = (id) => cache[id]?.[0] || '';
export const kpCached = (id) => cache[id]?.[1] || '';
export const known = (id) => id in cache;
// AniList id → MAL id (= id Шикимори); заполняется при разборе ответов AniList
const MAL = new Map();
export const noteMal = (alId, mal) => { if (mal) MAL.set(alId, +mal); };
const SHIKI = 'https://shikimori.io/api';
// BB-коды Шикимори: [anime=1]Название[/anime] → Название; спойлеры убираем целиком
export const cleanShiki = (s) => String(s || '').replace(/\[spoiler[^\]]*\][\s\S]*?\[\/spoiler\]/gi, '').replace(/\[\/?[a-z_]+(=[^\]]*)?\]/gi, '').replace(/\n{3,}/g, '\n\n').trim();
async function shikiNames(ids) {
  const m = ids.filter((id) => MAL.has(id));
  if (!m.length) return {};
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
    const q = `{ animes(ids: "${m.map((id) => MAL.get(id)).join(',')}", limit: 50) { id russian } }`;
    const r = await fetch(SHIKI + '/graphql', { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q }) });
    clearTimeout(t); if (!r.ok) return {};
    const by = {}; for (const a of (await r.json()).data?.animes || []) by[a.id] = a.russian;
    return Object.fromEntries(m.map((id) => [id, by[MAL.get(id)] || '']));
  } catch { return {}; }
}
// одно аниме целиком: русское название и описание
export async function shikiAnime(mal) {
  if (!mal) return null;
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 7000);
    const r = await fetch(`${SHIKI}/animes/${mal}`, { signal: ctl.signal }); clearTimeout(t);
    if (!r.ok) return null;
    const d = await r.json();
    return { ru: cyr(d.russian) ? d.russian : null, plot: cyr(d.description) ? cleanShiki(d.description) : null };
  } catch { return null; }
}
const queue = new Map(); let timer = 0;
const triedWiki = (id) => cache[id]?.[2] === 4;
export function ruTitles(ids) {
  const want = [...new Set(ids)].filter((id) => /^(tt\d+|nm\d+|al\d+)$/.test(id || '') && !(cache[id]?.[0] || triedWiki(id)));
  if (!want.length) return Promise.resolve();
  const ps = want.map((id) => {
    if (!queue.has(id)) { let res; const p = new Promise((r) => (res = r)); queue.set(id, { p, res }); }
    return queue.get(id).p;
  });
  clearTimeout(timer); timer = setTimeout(flush, 40);
  return Promise.all(ps);
}
async function wikiNames(ids) {
  const vals = ids.map((id) => `"${id.startsWith('al') ? id.slice(2) : id}"`).join(' ');
  const q = `SELECT ?k ?wiki WHERE { VALUES ?k { ${vals} } { ?i wdt:P345 ?k } UNION { ?i wdt:P8729 ?k } ?article schema:about ?i ; schema:isPartOf <https://ru.wikipedia.org/> ; schema:name ?wiki }`;
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 9000);
    const r = await fetch(EP + encodeURIComponent(q), { signal: ctl.signal, headers: { Accept: 'application/sparql-results+json' } });
    clearTimeout(t);
    if (!r.ok) return { ok: false, map: {} };
    const map = {};
    for (const b of (await r.json()).results.bindings || []) {
      const k = b.k.value, id = /^\d+$/.test(k) ? 'al' + k : k;
      const name = clean(b.wiki?.value || '');
      if (cyr(name) && !map[id]) map[id] = name;
    }
    return { ok: true, map };
  } catch { return { ok: false, map: {} }; }
}
async function flush() {
  const ids = [...queue.keys()].filter((id) => !queue.get(id).sent);
  for (let i = 0; i < ids.length; i += 50) batch(ids.slice(i, i + 50));
}
async function batch(ids) {
  ids.forEach((id) => (queue.get(id).sent = true));
  const vals = ids.map((id) => `"${id.startsWith('al') ? id.slice(2) : id}"`).join(' ');
  const q = `SELECT ?k ?l ?kp WHERE { VALUES ?k { ${vals} } { ?i wdt:P345 ?k } UNION { ?i wdt:P8729 ?k } OPTIONAL { ?i rdfs:label ?l FILTER(lang(?l) = "ru") } OPTIONAL { ?i wdt:P2603 ?kp } }`;
  let rows = null;
  const shiki = shikiNames(ids.filter((id) => id.startsWith('al')));
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 9000);
    const r = await fetch(EP + encodeURIComponent(q), { signal: ctl.signal, headers: { Accept: 'application/sparql-results+json' } });
    clearTimeout(t); if (r.ok) rows = (await r.json()).results.bindings;
  } catch {}
  if (rows) {
    const found = {};
    for (const b of rows) {
      const k = b.k.value, id = /^\d+$/.test(k) ? 'al' + k : k;
      const f = (found[id] ||= ['', '']);
      if (!f[0] && cyr(b.l?.value)) f[0] = clean(b.l.value);
      if (!f[1] && b.kp?.value) f[1] = b.kp.value;
    }
    const sh = await shiki;
    for (const id in sh) if (cyr(sh[id])) (found[id] ||= ['', ''])[0] = sh[id];
    const missing = ids.filter((id) => !found[id]?.[0]);
    const wiki = missing.length ? await wikiNames(missing) : { ok: true, map: {} };
    for (const id in wiki.map) (found[id] ||= ['', ''])[0] = wiki.map[id];
    ids.forEach((id) => {
      const f = found[id] || ['', ''];
      if (f[0] || wiki.ok) cache[id] = [f[0], f[1] || '', 4];
    });
    save();
  }
  ids.forEach((id) => { const e = queue.get(id); queue.delete(id); e?.res(); });
}
// подставить русские названия в уже нарисованные плитки: [data-id] с <b> внутри
export function localize(root) {
  const els = [...root.querySelectorAll('a[data-id]')].filter((e) => !e.dataset.ru);
  const ids = els.map((e) => e.dataset.id);
  const apply = () => els.forEach((e) => { const ru = ruCached(e.dataset.id); if (!ru) return; e.dataset.ru = '1'; const b = e.querySelector('b'); if (b && b.textContent !== ru) { b.title = b.textContent; b.textContent = ru; } const ph = e.querySelector('.tph'); if (ph) ph.textContent = ru; });
  apply();
  return ruTitles(ids).then(apply);
}
