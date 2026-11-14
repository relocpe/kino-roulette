// Русские названия и ID Кинопоиска пачками из Wikidata (SPARQL, без ключей), с кэшем в localStorage.
// cache[id] = [русское название | '', kinopoisk id | ''] ; id — tt… (IMDb) или al… (AniList)
const KEY = 'kr:ru2', EP = 'https://query.wikidata.org/sparql?format=json&query=';
let cache = {};
try { cache = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch {}
const save = () => { try { const k = Object.keys(cache); if (k.length > 6000) k.slice(0, k.length - 6000).forEach((x) => delete cache[x]); localStorage.setItem(KEY, JSON.stringify(cache)); } catch {} };
const cyr = (s) => /[А-Яа-яЁё]/.test(s || '');
const clean = (s) => s.replace(/\s*\((фильм|телесериал|сериал|мини-сериал|мультфильм|мультсериал|аниме|аниме-сериал|документальный фильм)[^)]*\)\s*$/i, '').replace(/\s*\(\d+\s*сезон\)\s*$/i, '').trim();
export const ruCached = (id) => cache[id]?.[0] || '';
export const kpCached = (id) => cache[id]?.[1] || '';
export const known = (id) => id in cache;
const queue = new Map(); let timer = 0;
export function ruTitles(ids) {
  const want = [...new Set(ids)].filter((id) => /^(tt\d+|al\d+)$/.test(id || '') && !(id in cache));
  if (!want.length) return Promise.resolve();
  const ps = want.map((id) => {
    if (!queue.has(id)) { let res; const p = new Promise((r) => (res = r)); queue.set(id, { p, res }); }
    return queue.get(id).p;
  });
  clearTimeout(timer); timer = setTimeout(flush, 40);
  return Promise.all(ps);
}
async function flush() {
  const ids = [...queue.keys()].filter((id) => !queue.get(id).sent);
  for (let i = 0; i < ids.length; i += 60) batch(ids.slice(i, i + 60));
}
async function batch(ids) {
  ids.forEach((id) => (queue.get(id).sent = true));
  const vals = ids.map((id) => `"${id.startsWith('al') ? id.slice(2) : id}"`).join(' ');
  const q = `SELECT ?k ?l ?kp WHERE { VALUES ?k { ${vals} } { ?i wdt:P345 ?k } UNION { ?i wdt:P8729 ?k } OPTIONAL { ?i rdfs:label ?l FILTER(lang(?l) = "ru") } OPTIONAL { ?i wdt:P2603 ?kp } }`;
  let rows = null;
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
    ids.forEach((id) => (cache[id] = found[id] || ['', '']));
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
