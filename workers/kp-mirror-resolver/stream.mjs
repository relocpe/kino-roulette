// Прямой адрес потока с того же каталога, что и плеер iframe.cloud.
// Сам плеер наружу play/pause не отдаёт, поэтому комнате нужен файл, которым управляем мы.
// Запрашиваем только gogo.iframe.cloud. Чужие адреса из ответа не открываем.

const GOGO = 'https://gogo.iframe.cloud';
const SOURCES = ['veoveo', 'collaps', 'hdvb'];
const SKIP_SOURCES = new Set(['pidtor', 'rutubemovie', 'vkmovie', 'filmix']);
const RU = /рус|дубл|многоголос|\bdub\b|дуб/i;
const FETCH_PROFILES = [
  { Accept: 'application/json,text/plain,*/*', Referer: 'https://iframe.cloud/' },
  {
    Accept: 'application/json,text/plain,*/*',
    'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
    Origin: 'https://iframe.cloud',
    Referer: 'https://iframe.cloud/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  },
];

export function streamQuery(meta = {}) {
  const id = String(meta.kinopoiskId || '').replace(/\D/g, '');
  if (!id) return null;
  const q = new URLSearchParams({
    id: `kp${id}`,
    kinopoisk_id: id,
    serial: meta.type === 'tv' ? '1' : '0',
    rjson: 'true',
  });
  const title = String(meta.title || '').trim().slice(0, 180);
  const original = String(meta.originalTitle || '').trim().slice(0, 180);
  const year = String(meta.year || '').replace(/\D/g, '').slice(0, 4);
  const imdb = /^tt\d{5,}$/.test(String(meta.imdbId || '')) ? String(meta.imdbId) : '';
  if (title) q.set('title', title);
  if (original) q.set('original_title', original);
  if (year) q.set('year', year);
  if (imdb) q.set('imdb_id', imdb);
  return q;
}

export function httpsPlayUrl(value) {
  if (typeof value !== 'string' || !value.startsWith('https://')) return '';
  try {
    const u = new URL(value);
    if (u.username || u.password) return '';
    if (/\.m4s$/i.test(u.pathname)) return '';
    return u.href;
  } catch {
    return '';
  }
}

function labelOf(item) {
  return String(item?.translate || item?.name || item?.title || '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

function rank(item) {
  const label = item?.label || labelOf(item);
  if (RU.test(label)) return 0;
  if (/оригинал|original/i.test(label)) return 2;
  return 1;
}

export function collectStreams(groups) {
  const seen = new Set();
  const items = [];
  for (const group of groups || []) {
    const list = Array.isArray(group?.data) ? group.data : [];
    for (const item of list) {
      if (!item || item.method !== 'play') continue;
      const url = httpsPlayUrl(item.url);
      if (!url || seen.has(url)) continue;
      seen.add(url);
      items.push({ url, label: labelOf(item) || group.source || 'Плеер', source: group.source || '' });
    }
  }
  const onGogo = (url) => { try { return new URL(url).hostname === 'gogo.iframe.cloud' ? 1 : 0; } catch { return 1; } };
  items.sort((a, b) => (onGogo(a.url) - onGogo(b.url)) || (rank(a) - rank(b)));
  return items.slice(0, 6);
}

function playRows(json) {
  const list = Array.isArray(json?.data) ? json.data.slice() : [];
  if (json && json.method === 'play' && json.url) list.unshift(json);
  return list;
}

export function pickPlayable(json) {
  const list = playRows(json);
  const plays = list.filter((item) => item && item.method === 'play' && httpsPlayUrl(item.url));
  plays.sort((a, b) => rank(a) - rank(b));
  if (!plays.length) return null;
  return { url: httpsPlayUrl(plays[0].url), label: labelOf(plays[0]) };
}

export function pickSeasonUrl(json) {
  const list = Array.isArray(json?.data) ? json.data : [];
  const link = list.find((item) => item && item.method === 'link' && typeof item.url === 'string' && item.url.startsWith(`${GOGO}/lite/`));
  return link ? itemHref(link.url) : '';
}

function numbered(label, word) {
  const text = String(label || '');
  const ahead = text.match(new RegExp(`(\\d+)\\s*${word}`, 'i'));
  if (ahead) return Number(ahead[1]);
  const behind = text.match(new RegExp(`${word}\\s*(\\d+)`, 'i'));
  if (behind) return Number(behind[1]);
  const bare = text.trim().match(/^(\d+)$/);
  return bare ? Number(bare[1]) : 0;
}

export function seasonLinks(json) {
  const list = Array.isArray(json?.data) ? json.data : [];
  const out = [];
  const seen = new Set();
  for (const item of list) {
    if (!item || item.method !== 'link') continue;
    const url = itemHref(item.url);
    if (!url || seen.has(url)) continue;
    const name = labelOf(item);
    if (name && !/сезон|season/i.test(name) && !numbered(name, 'сезон')) continue;
    seen.add(url);
    const n = numbered(name, 'сезон') || numbered(name, 'season') || out.length + 1;
    out.push({ n, name: name || `${n} сезон`, url });
  }
  return out;
}

function episodeLinks(json) {
  const list = Array.isArray(json?.data) ? json.data : [];
  const out = [];
  const seen = new Set();
  for (const item of list) {
    if (!item || item.method !== 'link') continue;
    const url = itemHref(item.url);
    const name = labelOf(item);
    if (!url || seen.has(url) || !/сери|episode/i.test(name)) continue;
    seen.add(url);
    const n = numbered(name, 'сери') || numbered(name, 'episode') || out.length + 1;
    out.push({ n, name: name || `${n} серия`, url });
  }
  return out;
}

function episodeOf(item) {
  return numbered(labelOf(item), 'сери') || numbered(item?.name, 'сери') || numbered(item?.title, 'сери');
}

function episodesFromRows(rows) {
  const map = new Map();
  for (const item of rows || []) {
    const n = episodeOf(item);
    if (!n || map.has(n)) continue;
    map.set(n, { n, name: `${n} серия` });
  }
  return [...map.values()].sort((a, b) => a.n - b.n);
}

function rowsForEpisode(rows, episode) {
  const list = Array.isArray(rows) ? rows : [];
  const tagged = list.filter((item) => episodeOf(item) > 0);
  if (!tagged.length) return list;
  const want = Number(episode) || episodeOf(tagged[0]);
  const hit = list.filter((item) => episodeOf(item) === want);
  return hit.length ? hit : list;
}

function itemHref(value) {
  try {
    const u = new URL(value);
    if (u.origin !== GOGO || !u.pathname.startsWith('/lite/')) return '';
    return u.href;
  } catch {
    return '';
  }
}

export function allowedMediaUrl(raw) {
  try {
    const u = new URL(String(raw));
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return '';
    if (u.hostname !== 'gogo.iframe.cloud' || !u.pathname.startsWith('/proxy/')) return '';
    return u.href;
  } catch {
    return '';
  }
}

export function rewritePlaylist(text, playlistUrl, mediaBase) {
  const mapRef = (ref) => {
    let abs = '';
    try { abs = new URL(ref, playlistUrl).href; } catch { return ref; }
    const ok = allowedMediaUrl(abs);
    return ok ? mediaBase + encodeURIComponent(ok) : ref;
  };
  return String(text || '').split('\n').map((line) => {
    const raw = line.trim();
    if (!raw) return line;
    if (raw.startsWith('#')) {
      return line.replace(/URI="([^"]+)"/g, (all, uri) => {
        const next = mapRef(uri);
        return next === uri ? all : `URI="${next}"`;
      });
    }
    const next = mapRef(raw);
    return next === raw ? line : next;
  }).join('\n');
}

async function readJson(url, fetcher) {
  let status = 0;
  for (const headers of FETCH_PROFILES) {
    try {
      const response = await fetcher(url, { headers, redirect: 'follow' });
      status = response?.status || status;
      if (!response?.ok) continue;
      return { status, json: await response.json() };
    } catch { /* следующий профиль запроса */ }
  }
  return { status, json: null };
}

function callUrls(json) {
  const list = Array.isArray(json?.data) ? json.data : [];
  return list
    .filter((item) => item?.method === 'call' && typeof item.url === 'string')
    .map((item) => itemHref(item.url))
    .filter(Boolean)
    .slice(0, 2);
}

async function sourceNames(q, fetcher) {
  const got = await readJson(`${GOGO}/lite/events?${q}`, fetcher);
  const rows = Array.isArray(got.json) ? got.json : [];
  const names = rows
    .filter((item) => item?.show && !item.rch && item.balanser && !SKIP_SOURCES.has(item.balanser))
    .map((item) => item.balanser);
  const listed = names.filter((name) => !SKIP_SOURCES.has(name));
  const rest = SOURCES.filter((name) => !listed.includes(name));
  const all = [...listed, ...rest];
  return all.length ? all.slice(0, 8) : SOURCES;
}

async function pullCalls(source, json, fetcher) {
  const groups = [];
  if (pickPlayable(json)) groups.push({ source, data: playRows(json) });
  for (const call of callUrls(json)) {
    const next = await readJson(call, fetcher);
    if (pickPlayable(next?.json)) groups.push({ source, data: playRows(next.json) });
  }
  return groups;
}

async function streamsForSeason(source, seasons, meta, fetcher) {
  const wantS = Number(meta?.season) || seasons[0].n || 1;
  const season = seasons.find((item) => item.n === wantS) || seasons[0];
  const page = await readJson(season.url, fetcher);
  const json = page?.json;
  if (!json) return null;
  const links = episodeLinks(json);
  const catalog = {
    season: season.n,
    episode: Number(meta?.episode) || 0,
    seasons: seasons.map((item) => ({ n: item.n, name: item.name })),
    episodes: [],
  };
  if (links.length) {
    catalog.episodes = links.map((item) => ({ n: item.n, name: item.name }));
    const wantE = Number(meta?.episode) || links[0].n || 1;
    const episode = links.find((item) => item.n === wantE) || links[0];
    catalog.episode = episode.n;
    const got = await readJson(episode.url, fetcher);
    const groups = got?.json ? await pullCalls(source, got.json, fetcher) : [];
    return { groups, series: catalog };
  }
  const rows = Array.isArray(json.data) ? json.data : [];
  const known = episodesFromRows(rows);
  const wantE = Number(meta?.episode) || known[0]?.n || 1;
  catalog.episode = known.length ? (known.find((item) => item.n === wantE)?.n || known[0].n) : 1;
  catalog.episodes = known.length ? known : [{ n: catalog.episode, name: `${catalog.episode} серия` }];
  const sliced = { ...json, data: rowsForEpisode(rows, catalog.episode) };
  return { groups: await pullCalls(source, sliced, fetcher), series: known.length > 1 || seasons.length > 1 ? catalog : null };
}

async function resolveOnce(meta, fetcher) {
  const q = streamQuery(meta);
  if (!q) return null;
  let status = 0;
  const groups = [];
  let series = null;
  for (const source of await sourceNames(q, fetcher)) {
    const got = await readJson(`${GOGO}/lite/${source}?${q}`, fetcher);
    status = got?.status || status;
    const json = got?.json;
    if (!json) continue;
    const seasons = seasonLinks(json);
    if (seasons.length) {
      const picked = await streamsForSeason(source, seasons, meta, fetcher);
      if (picked?.groups?.length) {
        groups.push(...picked.groups);
        if (picked.series && !series) series = picked.series;
        continue;
      }
    }
    groups.push(...await pullCalls(source, json, fetcher));
  }
  const options = collectStreams(groups);
  if (!options.length) return status ? { status } : null;
  return series ? { ...options[0], options, series } : { ...options[0], options };
}

export async function resolveVeoStream(meta, fetcher = fetch) {
  const found = await resolveOnce(meta, fetcher);
  if (found || meta?.type === 'tv') return found;
  return resolveOnce({ ...meta, type: 'tv' }, fetcher);
}
