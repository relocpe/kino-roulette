const LORD_FILM_ORIGIN = 'https://1.2026-lord.pics';
const ALLOWED_HOSTS = new Set(['1.2026-lord.pics', 'www.2026-lord.pics']);
const ALLOWED_ORIGINS = new Set(['https://relocpe.github.io']);
const MAX_CANDIDATES = 20;

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
    const response = await fetcher(url.href, {
      headers: { Accept: 'text/html, text/css;q=0.9' },
      redirect: 'manual',
    });
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

function unescapeCss(value) {
  return value.replace(/\\([0-9a-f]{1,6})\s?|\\(.)/gi, (_, hex, escaped) => {
    if (!hex) return escaped || '';
    const point = parseInt(hex, 16);
    return point <= 0x10ffff ? String.fromCodePoint(point) : '';
  });
}

function cssContents(css) {
  const map = new Map();
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = /([^{}]+)\{([^{}]*)\}/g;
  const contentRule = /(?:^|;)\s*content\s*:\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/i;
  for (const [, selectors, declarations] of source.matchAll(rules)) {
    const content = declarations.match(contentRule);
    if (!content) continue;
    const value = unescapeCss(content[1].slice(1, -1));
    if (!value) continue;
    for (const selector of selectors.split(',')) {
      const match = selector.match(/\.([a-z0-9_-]+)\s*:{1,2}(?:before|after)\b/i);
      if (match) map.set(match[1], value);
    }
  }
  return map;
}

function iconText(markup, contents) {
  let text = '';
  for (const match of markup.matchAll(/<i\b[^>]*class=(["'])([^"']+)\1[^>]*>\s*<\/i>/gi)) {
    for (const className of match[2].split(/\s+/)) {
      text += contents.get(className) || '';
    }
  }
  return decodeHtml(text).trim();
}

function resultItems(html) {
  const marker = html.indexOf('id="Teasers-search"');
  if (marker < 0) return [];
  const listStart = html.indexOf('<ul', marker);
  const listEnd = html.indexOf('</ul>', listStart);
  if (listStart < 0 || listEnd < 0) return [];
  const list = html.slice(listStart, listEnd);
  const items = [];
  for (const [, item] of list.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
    const link = item.match(/\bhref=(["'])\/(\d+)\1/i);
    const bold = item.match(/<b\b[^>]*>([\s\S]*?)<\/b>/i);
    if (!link || !bold) continue;
    const spanStart = bold[1].search(/<span\b/i);
    const titleMarkup = spanStart < 0 ? bold[1] : bold[1].slice(0, spanStart);
    const yearMarkup = spanStart < 0 ? '' : (bold[1].slice(spanStart).match(/<span\b[^>]*>([\s\S]*?)<\/span>/i) || [])[1] || '';
    items.push({ id: link[2], titleMarkup, yearMarkup });
  }
  return items;
}

function stylesheetUrl(html, baseUrl) {
  for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
    const attrs = attributes(tag);
    if (!attrs.rel?.toLowerCase().split(/\s+/).includes('stylesheet') || !attrs.href) continue;
    const url = new URL(attrs.href, baseUrl);
    if (isAllowedUrl(url) && url.pathname.startsWith('/assets/') && /\.css$/i.test(url.pathname)) {
      return url;
    }
  }
  return null;
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
  const yearMatch = releaseDate.match(/\b(18|19|20)\d{2}\b/)
    || title.match(/\b(18|19|20)\d{2}\b/);
  const ogType = (meta.get('og:type') || '').toLowerCase();
  const type = ogType === 'video.movie' ? 'movie'
    : ['video.tv_show', 'video.episode'].includes(ogType) ? 'tv'
      : '';
  return {
    titles: [title, originalTitle].map(normalizedTitle).filter(Boolean),
    year: yearMatch ? Number(yearMatch[0]) : null,
    type,
  };
}

function fallbackResult(searchUrl, reason) {
  return { url: searchUrl.href, matched: false, reason };
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
    const styles = new Map();
    let pageBase;

    for (const queryTitle of queryTitles) {
      const queryUrl = new URL('/search', LORD_FILM_ORIGIN);
      queryUrl.searchParams.set('q', `${queryTitle} (${year})`);
      const { response, url } = await fetchLordFilm(queryUrl, fetcher);
      if (!response.ok) continue;
      const html = (await response.text()).slice(0, 1_500_000);
      const rawItems = resultItems(html);
      if (!rawItems.length) continue;

      const cssUrl = stylesheetUrl(html, url);
      if (!cssUrl) continue;
      let styleMap = styles.get(cssUrl.href);
      if (!styleMap) {
        const cssResponse = await fetchLordFilm(cssUrl, fetcher);
        if (!cssResponse.response.ok) continue;
        styleMap = cssContents((await cssResponse.response.text()).slice(0, 2_000_000));
        styles.set(cssUrl.href, styleMap);
      }
      pageBase = url;
      for (const item of rawItems) {
        const cardTitle = normalizedTitle(iconText(item.titleMarkup, styleMap));
        const cardYearText = iconText(item.yearMarkup, styleMap);
        const cardYear = Number((cardYearText.match(/\b(?:18|19|20)\d{2}\b/) || [])[0]);
        if (wantedTitles.has(cardTitle) && (!cardYear || cardYear === year)) {
          cardsById.set(item.id, item);
        }
      }
    }

    if (!cardsById.size) return fallbackResult(search, 'no-exact-title');
    if (cardsById.size > MAX_CANDIDATES) return fallbackResult(search, 'too-many-matches');

    const matches = [];
    for (const item of cardsById.values()) {
      const detailUrl = new URL(`/${item.id}`, pageBase || LORD_FILM_ORIGIN);
      if (!isAllowedUrl(detailUrl)) continue;
      const { response } = await fetchLordFilm(detailUrl, fetcher);
      if (!response.ok) continue;
      const details = pageDetails((await response.text()).slice(0, 1_500_000));
      if (details.year !== year || details.type !== type) continue;
      if (details.titles.some((candidate) => wantedTitles.has(candidate))) {
        matches.push(item.id);
      }
    }

    if (matches.length !== 1) {
      return fallbackResult(search, matches.length ? 'ambiguous-match' : 'no-exact-match');
    }
    return { url: `${LORD_FILM_ORIGIN}/${matches[0]}`, matched: true, reason: 'exact-match' };
  } catch (error) {
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
    return json(await resolveLordFilm(input), 200, request);
  },
};
