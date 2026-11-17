const SITE_ORIGIN = 'https://filmy-pro-zombi.com';
const ALLOWED_HOSTS = new Set(['filmy-pro-zombi.com']);
const ALLOWED_ORIGINS = new Set(['https://relocpe.github.io']);
const MAX_CANDIDATES = 16;
const FETCH_HEADERS = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
  Referer: `${SITE_ORIGIN}/`,
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};

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

const noContent = (request) => new Response(null, { status: 204, headers: corsHeaders(request) });

function isAllowedUrl(url) {
  return url.protocol === 'https:' && ALLOWED_HOSTS.has(url.hostname);
}

async function fetchSite(input, fetcher) {
  const url = new URL(input);
  if (!isAllowedUrl(url)) throw new Error('Unapproved host');
  return fetcher(url.href, { headers: FETCH_HEADERS, redirect: 'follow' });
}

function decodeHtml(text) {
  return String(text || '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function normalizedTitle(title) {
  return String(title || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s*\((?:фильм|сериал)?\s*(?:18|19|20)\d{2}\)\s*$/i, '')
    .replace(/[\s\p{P}\p{S}]+/gu, '');
}

function searchLinks(html) {
  const byId = new Map();
  for (const m of html.matchAll(/href="(https:\/\/filmy-pro-zombi\.com\/(\d+)-[^"?#]+\.html)"/gi)) {
    byId.set(m[2], { id: m[2], url: m[1] });
  }
  return [...byId.values()].slice(0, MAX_CANDIDATES);
}

export function extractEmbedUrls(html, pageUrl) {
  const base = String(pageUrl || SITE_ORIGIN);
  const pick = (raw) => {
    const text = decodeHtml(String(raw || '').trim());
    if (!text || /^javascript:/i.test(text)) return null;
    try {
      const url = new URL(text, base);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
      if (url.protocol === 'http:') url.protocol = 'https:';
      if (url.hostname === 'filmy-pro-zombi.com') return null;
      return url.href;
    } catch {
      return null;
    }
  };
  const seen = new Set();
  const out = [];
  const note = (raw) => {
    const url = pick(raw);
    if (url && !seen.has(url)) {
      seen.add(url);
      out.push(url);
    }
  };
  const player = html.match(/<div[^>]*class="[^"]*tabs-block__content[^"]*video[^"]*"[^>]*>[\s\S]{0,80000}/i)?.[0]
    || html.match(/<div[^>]*class="[^"]*player[^"]*"[^>]*>[\s\S]{0,80000}/i)?.[0]
    || '';
  for (const m of player.matchAll(/<iframe\b[^>]*\b(?:data-src|src)\s*=\s*(["'])([\s\S]*?)\1/gi)) note(m[2]);
  if (!out.length) {
    for (const m of html.matchAll(/<iframe\b[^>]*\b(?:data-src|src)\s*=\s*(["'])([\s\S]*?)\1/gi)) note(m[2]);
  }
  return out.slice(0, 6);
}

export function extractEmbedUrl(html, pageUrl) {
  return extractEmbedUrls(html, pageUrl)[0] || null;
}

function pageDetails(html, pageUrl) {
  const og = html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/i)?.[1] || '';
  const titleTag = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '';
  const title = decodeHtml(og || titleTag);
  const slugYear = String(pageUrl).match(/_(\d{4})\.html/)?.[1];
  const yearMatch = title.match(/\b(18|19|20)\d{2}\b/) || (slugYear ? [slugYear] : null);
  const isSeries = /сериал|сезон|эпизод/iu.test(title);
  return {
    titles: [title.replace(/\s*—.*$/, '').replace(/\s*\(\d{4}\).*/, '')].map(normalizedTitle).filter(Boolean),
    year: yearMatch ? Number(yearMatch[0] || yearMatch) : null,
    type: isSeries ? 'tv' : 'movie',
  };
}

function typeMatches(detailsType, wantedType) {
  if (!detailsType) return true;
  return detailsType === wantedType;
}

function titlesOverlap(detailsTitles, wantedTitles) {
  const wanted = [...wantedTitles];
  return detailsTitles.some((candidate) => wanted.some((needle) => (
    candidate && needle && (candidate === needle || candidate.includes(needle) || needle.includes(candidate))
  )));
}

function matchScore(details, wantedTitles, year, wantedType) {
  let score = 0;
  if (details.year === year) score += 2;
  if (typeMatches(details.type, wantedType)) score += 1;
  if (titlesOverlap(details.titles, wantedTitles)) score += 3;
  return score;
}

export async function resolveZombiFilm(input, fetcher = fetch) {
  const title = String(input.title || '').trim();
  const originalTitle = String(input.originalTitle || '').trim();
  const imdbId = /^tt\d+$/.test(String(input.imdbId || '').trim()) ? String(input.imdbId).trim() : '';
  const year = Number(input.year);
  const type = input.type;
  const search = new URL('/index.php', SITE_ORIGIN);
  search.searchParams.set('do', 'search');
  search.searchParams.set('subaction', 'search');
  search.searchParams.set('story', `${title}${Number.isInteger(year) ? ` (${year})` : ''}`);

  if (!title || title.length > 180 || !Number.isInteger(year) || year < 1880 || year > 2100
      || !['movie', 'tv'].includes(type)) {
    return { url: search.href, matched: false, reason: 'invalid-input', source: 'zombi' };
  }

  try {
    const queryTitles = [...new Set([title, originalTitle, imdbId].filter(Boolean))];
    const wantedTitles = new Set(queryTitles.map(normalizedTitle).filter(Boolean));
    let cards = [];
    const searchStatuses = [];
    let hadSearch = false;

    for (const queryTitle of queryTitles) {
      for (const query of [...new Set([`${queryTitle} (${year})`, queryTitle])]) {
        const queryUrl = new URL('/index.php', SITE_ORIGIN);
        queryUrl.searchParams.set('do', 'search');
        queryUrl.searchParams.set('subaction', 'search');
        queryUrl.searchParams.set('story', query);
        const response = await fetchSite(queryUrl, fetcher);
        if (!response.ok) {
          searchStatuses.push(response.status);
          continue;
        }
        hadSearch = true;
        const html = (await response.text()).slice(0, 800_000);
        const found = searchLinks(html);
        if (found.length) {
          cards = found;
          break;
        }
      }
      if (cards.length) break;
    }

    if (!cards.length) {
      return hadSearch
        ? { url: search.href, matched: false, reason: 'no-exact-title', source: 'zombi' }
        : { url: search.href, matched: false, reason: 'search-unavailable', source: 'zombi', upstreamStatuses: searchStatuses };
    }

    const ranked = [];
    for (const card of cards.slice(0, 8)) {
      const response = await fetchSite(card.url, fetcher);
      if (!response.ok) continue;
      const html = (await response.text()).slice(0, 1_200_000);
      const details = pageDetails(html, card.url);
      ranked.push({ ...card, score: matchScore(details, wantedTitles, year, type), details, html });
    }

    ranked.sort((a, b) => b.score - a.score);
    const best = ranked[0];
    const strong = ranked.filter((row) => row.score >= 5);
    if (strong.length > 1) {
      return { url: search.href, matched: false, reason: 'ambiguous-match', source: 'zombi' };
    }

    let chosen = ranked.filter((row) => row.score >= 5 && typeMatches(row.details.type, type))[0];
    if (!chosen && best?.score >= 4 && typeMatches(best.details.type, type)) chosen = best;

    if (!chosen) {
      return {
        url: best ? best.url : search.href,
        matched: false,
        reason: 'no-exact-match',
        lead: Boolean(best?.score >= 3),
        source: 'zombi',
      };
    }

    const embedUrls = extractEmbedUrls(chosen.html, chosen.url);
    const embedUrl = embedUrls[0] || null;
    return {
      url: chosen.url,
      matched: true,
      reason: 'exact-match',
      embedUrl,
      embedUrls,
      source: 'zombi',
    };
  } catch (error) {
    console.error('Zombi resolver failed.', error);
    return { url: search.href, matched: false, reason: 'upstream-unavailable', source: 'zombi' };
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
    return json(await resolveZombiFilm(input), 200, request);
  },
};