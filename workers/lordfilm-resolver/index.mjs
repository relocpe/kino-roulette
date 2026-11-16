const LORD_FILM_ORIGIN = 'https://1.2026-lord.pics';
const LORD_HOSTS = ['1.2026-lord.pics', 'www.2026-lord.pics'];
const ALLOWED_HOSTS = new Set(LORD_HOSTS);
const LORD_FETCH_HEADERS = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
  'Cache-Control': 'no-cache',
  Referer: `${LORD_FILM_ORIGIN}/`,
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};
const ALLOWED_ORIGINS = new Set(['https://relocpe.github.io']);
const MAX_CANDIDATES = 20;
const NEGATIVE_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_NEGATIVE_CACHE_ENTRIES = 128;
const negativeCache = new Map();

class LordFilmNetworkError extends Error {
  constructor() {
    super('LordFilm network request failed');
    this.name = 'LordFilmNetworkError';
  }
}

function corsHeaders(request) {
  const origin = request.headers.get('Origin');
  return {
  ...(ALLOWED_ORIGINS.has(origin) ? { 'Access-Control-Allow-Origin': origin } : {}),
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin',
  };
}

function json(data, status = 200, request) {
  return new Response(JSON.stringify(data), {
  status,
  headers: {
    ...corsHeaders(request),
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
  },
  });
}

const noContent = (request) => new Response(null, {
  status: 204,
  headers: corsHeaders(request),
});

/*
 * The resolver only fetches the fixed LordFilm hosts. Redirects are checked
 * before following so an upstream redirect cannot turn it into an open proxy.
 */

function isAllowedUrl(url) {
  return url.protocol === 'https:' && ALLOWED_HOSTS.has(url.hostname);
}

async function fetchLordFilm(input, fetcher) {
  let url = new URL(input);
  for (let hop = 0; hop < 4; hop += 1) {
    if (!isAllowedUrl(url)) throw new Error('Unapproved LordFilm host');
    let response;
    try {
      response = await fetcher(url.href, {
        headers: { ...LORD_FETCH_HEADERS, Referer: `${url.origin}/` },
        redirect: 'manual',
      });
    } catch {
      throw new LordFilmNetworkError();
    }
    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return { response, url };
    }
    const location = response.headers.get('location');
    if (!location) return { response, url };
    url = new URL(location, url);
  }
  throw new Error('Too many LordFilm redirects');
}

function attributes(tag) {
  const found = {};
  const pattern = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  for (const match of tag.matchAll(pattern)) {
    found[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return found;
}

function decodeHtml(text) {
  return String(text || '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

function resultItems(html) {
  const marker = html.match(/\bid\s*=\s*(["'])Teasers-search\1/i);
  if (!marker) return [];
  const listStart = html.indexOf('<ul', marker.index);
  const listEnd = html.indexOf('</ul>', listStart);
  if (listStart < 0 || listEnd < 0) return [];
  const list = html.slice(listStart, listEnd);
  const items = [];
  for (const [, item] of list.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
    for (const [anchor] of item.matchAll(/<a\b[^>]*>/gi)) {
      const href = attributes(anchor).href;
      if (!href) continue;
      let url;
      try {
        url = new URL(href, LORD_FILM_ORIGIN);
      } catch {
        continue;
      }
      if (!isAllowedUrl(url)) continue;
      const id = url.pathname.match(/^\/(\d+)\/?$/)?.[1];
      if (id) items.push({ id });
    }
  }
  const deduped = [...new Map(items.map((item) => [item.id, item])).values()];
  if (deduped.length) return deduped;
  const fallback = [];
  for (const [anchor] of html.matchAll(/<a\b[^>]*>/gi)) {
    const href = attributes(anchor).href;
    if (!href) continue;
    let url;
    try {
      url = new URL(href, LORD_FILM_ORIGIN);
    } catch {
      continue;
    }
    if (!isAllowedUrl(url)) continue;
    const id = url.pathname.match(/^\/(\d+)\/?$/)?.[1];
    if (id) fallback.push({ id });
  }
  return [...new Map(fallback.map((item) => [item.id, item])).values()].slice(0, MAX_CANDIDATES);
}

export function extractEmbedUrl(html, pageUrl) {
  const base = String(pageUrl || LORD_FILM_ORIGIN);
  const pick = (raw) => {
    const text = decodeHtml(String(raw || '').trim());
    if (!text || /^javascript:/i.test(text) || /^data:/i.test(text)) return null;
    try {
      const url = new URL(text, base);
      if (url.protocol !== 'https:') return null;
      return url.href;
    } catch {
      return null;
    }
  };
  const candidates = [];
  const note = (raw) => { const url = pick(raw); if (url) candidates.push(url); };
  const playerChunk = (html.match(/<div[^>]*(?:id|class)=["'][^"']*(?:pleer|player|video|iframe)[^"']*["'][^>]*>[\s\S]{0,12000}?<\/div>/gi) || []);
  for (const chunk of [...playerChunk, html]) {
    for (const m of chunk.matchAll(/<iframe\b[^>]*\bsrc\s*=\s*(["'])([\s\S]*?)\1/gi)) note(m[2]);
    for (const m of chunk.matchAll(/\bdata-url\s*=\s*(["'])([\s\S]*?)\1/gi)) note(m[2]);
  }
  for (const m of html.matchAll(/["']file["']\s*:\s*["']([^"']+)["']/gi)) {
    if (/\.(?:m3u8|mp4)(?:\?|$)/i.test(m[1])) note(m[1]);
  }
  const hostBlock = /^(?:1\.2026-lord\.pics|www\.2026-lord\.pics)$/;
  const preferred = candidates.find((url) => {
    try {
      const host = new URL(url).hostname;
      return !hostBlock.test(host);
    } catch {
      return false;
    }
  });
  return preferred || candidates[0] || null;
}

function typeMatches(detailsType, wantedType) {
  if (!detailsType) return true;
  return detailsType === wantedType;
}

function normalizedTitle(title) {
  return String(title || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s*\((?:фильм|сериал)?\s*(?:18|19|20)\d{2}\)\s*$/i, '')
    .replace(/[\s\p{P}\p{S}]+/gu, '');
}

function metaValues(html) {
  const values = new Map();
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = attributes(tag);
    const key = (attrs.property || attrs.name || '').toLowerCase();
    if (key && attrs.content) values.set(key, decodeHtml(attrs.content));
  }
  return values;
}

function pageDetails(html) {
  const meta = metaValues(html);
  const title = meta.get('og:title') || '';
  const originalTitle = meta.get('ya:original_name') || '';
  const releaseDate = meta.get('video:release_date') || '';
  const pageTitleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const pageTitle = pageTitleMatch ? decodeHtml(pageTitleMatch[1]) : '';
  const yearMatch = releaseDate.match(/\b(18|19|20)\d{2}\b/)
    || title.match(/\b(18|19|20)\d{2}\b/);
  const ogType = (meta.get('og:type') || '').toLowerCase();
  const titleIdentifiesSeries = /(?:сериал|телесериал|tv\s*show|tv\s*series)/iu.test(pageTitle);
  const type = ['video.tv_show', 'video.episode'].includes(ogType) || titleIdentifiesSeries ? 'tv'
    : ogType === 'video.movie' ? 'movie' : '';
  return {
    titles: [title, originalTitle].map(normalizedTitle).filter(Boolean),
    year: yearMatch ? Number(yearMatch[0]) : null,
    type,
  };
}

function fallbackResult(searchUrl, reason) {
  return { url: searchUrl.href, matched: false, reason };
}

function unavailableResult(searchUrl, statuses = []) {
  const result = fallbackResult(searchUrl, 'search-unavailable');
  if (statuses.length) result.upstreamStatuses = statuses;
  return result;
}

async function negativeCacheKey(input) {
  const keyMaterial = JSON.stringify([
    normalizedTitle(input.title),
    normalizedTitle(input.originalTitle),
    Number(input.year),
    input.type,
  ]);
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(keyMaterial),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function getNegativeCache(key, now = Date.now()) {
  const entry = negativeCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    negativeCache.delete(key);
    return null;
  }
  return entry.result;
}

function setNegativeCache(key, result, now = Date.now()) {
  for (const [cachedKey, entry] of negativeCache) {
    if (entry.expiresAt <= now) negativeCache.delete(cachedKey);
  }
  while (negativeCache.size >= MAX_NEGATIVE_CACHE_ENTRIES) {
    negativeCache.delete(negativeCache.keys().next().value);
  }
  negativeCache.set(key, { result, expiresAt: now + NEGATIVE_CACHE_TTL_MS });
}

export async function resolveLordFilm(input, fetcher = fetch) {
  const title = String(input.title || '').trim();
  const originalTitle = String(input.originalTitle || '').trim();
  const year = Number(input.year);
  const type = input.type;
  const search = new URL('/search', LORD_FILM_ORIGIN);
  search.searchParams.set('q', `${title}${Number.isInteger(year) ? ` (${year})` : ''}`);
  if (!title || title.length > 180 || !Number.isInteger(year) || year < 1880 || year > 2100
      || !['movie', 'tv'].includes(type)) {
    return fallbackResult(search, 'invalid-input');
  }

  try {
    const queryTitles = [...new Set([title, originalTitle].filter(Boolean))];
    const wantedTitles = new Set(queryTitles.map(normalizedTitle).filter(Boolean));
    const cardsById = new Map();
    let pageBase;
    const searchStatuses = [];
    let hadSuccessfulSearch = false;

    outer: for (const queryTitle of queryTitles) {
      for (const query of [`${queryTitle} (${year})`, queryTitle]) {
        for (const host of LORD_HOSTS) {
          const queryUrl = new URL('/search', `https://${host}`);
          queryUrl.searchParams.set('q', query);
          const { response, url } = await fetchLordFilm(queryUrl, fetcher);
          if (!response.ok) {
            console.warn('LordFilm search returned a non-success status.', JSON.stringify({
              status: response.status,
              host: url.hostname,
              contentType: response.headers.get('content-type'),
              server: response.headers.get('server'),
              cfRay: response.headers.get('cf-ray'),
              cfMitigated: response.headers.get('cf-mitigated'),
            }));
            searchStatuses.push(response.status);
            continue;
          }
          hadSuccessfulSearch = true;
          const html = (await response.text()).slice(0, 1_500_000);
          const rawItems = resultItems(html);
          if (!rawItems.length) continue;
          pageBase = url;
          for (const item of rawItems) cardsById.set(item.id, item);
          break outer;
        }
      }
    }

    if (!cardsById.size) {
      return hadSuccessfulSearch
        ? fallbackResult(search, 'no-exact-title')
        : unavailableResult(search, searchStatuses);
    }
    if (cardsById.size > MAX_CANDIDATES) return fallbackResult(search, 'too-many-matches');

    const matches = [];
    let matchHtml = '';
    for (const item of cardsById.values()) {
      const detailUrl = new URL(`/${item.id}`, pageBase || LORD_FILM_ORIGIN);
      if (!isAllowedUrl(detailUrl)) continue;
      const { response } = await fetchLordFilm(detailUrl, fetcher);
      if (!response.ok) continue;
      const html = (await response.text()).slice(0, 1_500_000);
      const details = pageDetails(html);
      if (details.year !== year || !typeMatches(details.type, type)) continue;
      if (details.titles.some((candidate) => wantedTitles.has(candidate))) {
        matches.push(item.id);
        matchHtml = html;
      }
    }

    if (matches.length !== 1) {
      return fallbackResult(search, matches.length ? 'ambiguous-match' : 'no-exact-match');
    }
    const pageUrl = `${new URL(pageBase || LORD_FILM_ORIGIN).origin}/${matches[0]}`;
    const embedUrl = extractEmbedUrl(matchHtml, pageUrl);
    return { url: pageUrl, matched: true, reason: 'exact-match', embedUrl };
  } catch (error) {
    if (error instanceof LordFilmNetworkError) {
      return unavailableResult(search);
    }
    console.error('LordFilm resolver failed; falling back to search.', error);
    return fallbackResult(search, 'upstream-unavailable');
  }
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return noContent(request);
    if (url.pathname !== '/resolve') return json({ error: 'Not found' }, 404, request);
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, request);

    let input;
    try {
      const body = await request.text();
      if (body.length > 4096) return json({ error: 'Request too large' }, 413, request);
      input = JSON.parse(body);
    } catch {
      return json({ error: 'Invalid JSON' }, 400, request);
    }
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return json({ error: 'Invalid request' }, 400, request);
    }
    const cacheKey = await negativeCacheKey(input);
    const cached = getNegativeCache(cacheKey);
    if (cached) return json(cached, 200, request);

    const result = await resolveLordFilm(input);
    if (result.reason === 'search-unavailable') setNegativeCache(cacheKey, result);
    return json(result, 200, request);
  },
};
