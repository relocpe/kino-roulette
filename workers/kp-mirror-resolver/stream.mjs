// Прямой адрес потока с того же каталога, что и плеер iframe.cloud.
// Сам плеер наружу play/pause не отдаёт, поэтому комнате нужен файл, которым управляем мы.
// Запрашиваем только gogo.iframe.cloud. Чужие адреса из ответа не открываем.

const GOGO = 'https://gogo.iframe.cloud';
const SOURCES = ['veoveo', 'collaps', 'hdvb'];
const RU = /рус|дубл|многоголос|\bdub\b|дуб/i;

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
    return u.href;
  } catch {
    return '';
  }
}

function labelOf(item) {
  return String(item?.translate || item?.name || item?.title || '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

function rank(item) {
  return RU.test(labelOf(item)) ? 0 : 1;
}

export function pickPlayable(json) {
  const list = Array.isArray(json?.data) ? json.data : [];
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

function itemHref(value) {
  try {
    const u = new URL(value);
    if (u.origin !== GOGO || !u.pathname.startsWith('/lite/')) return '';
    return u.href;
  } catch {
    return '';
  }
}

async function readJson(url, fetcher) {
  const response = await fetcher(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    },
    redirect: 'follow',
  });
  if (!response?.ok) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function resolveOnce(meta, fetcher) {
  const q = streamQuery(meta);
  if (!q) return null;
  for (const source of SOURCES) {
    const json = await readJson(`${GOGO}/lite/${source}?${q}`, fetcher);
    if (!json) continue;
    const direct = pickPlayable(json);
    if (direct) return { ...direct, source };
    const season = pickSeasonUrl(json);
    if (!season) continue;
    const episodes = await readJson(season, fetcher);
    const episode = pickPlayable(episodes);
    if (episode) return { ...episode, source };
  }
  return null;
}

export async function resolveVeoStream(meta, fetcher = fetch) {
  const found = await resolveOnce(meta, fetcher);
  if (found || meta?.type === 'tv') return found;
  return resolveOnce({ ...meta, type: 'tv' }, fetcher);
}
