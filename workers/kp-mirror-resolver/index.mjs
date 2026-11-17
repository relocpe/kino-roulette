import { resolveVeoStream } from './stream.mjs';

const ALLOWED_ORIGINS = new Set([
  'https://relocpe.github.io',
  'http://127.0.0.1:4173',
  'http://localhost:4173',
]);
const FETCH_HEADERS = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
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

function decodeHtml(text) {
  return String(text || '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

export function embedFromKinopoiskId(id) {
  const digits = String(id || '').replace(/\D/g, '');
  if (!digits) return null;
  return `https://iframe.cloud/iframe/${digits}`;
}

export function extractMirrorEmbeds(html) {
  const found = new Set();
  const text = decodeHtml(html || '');
  for (const m of text.matchAll(/https?:\/\/iframe\.cloud\/iframe\/(\d+)/gi)) {
    found.add(`https://iframe.cloud/iframe/${m[1]}`);
  }
  for (const m of text.matchAll(/(?:^|["'=\s])iframe\.cloud\/iframe\/(\d+)/gi)) {
    found.add(`https://iframe.cloud/iframe/${m[1]}`);
  }
  return [...found];
}

export function mirrorPageUrls(kinopoiskId, type) {
  const id = String(kinopoiskId || '').replace(/\D/g, '');
  if (!id) return [];
  const kind = type === 'tv' ? 'series' : 'film';
  return [
    `https://www.kinopoisk.run/${kind}/${id}/`,
    `https://ggpoisk.ru/${kind}/${id}/`,
  ];
}

async function attachStream(result, body, fetcher) {
  if (!body?.stream || !result?.matched) return result;
  try {
    const stream = await resolveVeoStream(body, fetcher);
    if (stream?.url) result.stream = { url: stream.url, label: stream.label || '', source: stream.source || '' };
  } catch {
    /* страница плеера всё равно остаётся */
  }
  return result;
}

export async function resolveKinopoiskMirror(body, fetcher = fetch) {
  const kinopoiskId = body?.kinopoiskId;
  const type = body?.type;
  const id = String(kinopoiskId || '').replace(/\D/g, '');
  if (!id) {
    return { matched: false, reason: 'no-kinopoisk-id', source: 'kp-mirror' };
  }
  const mirrors = mirrorPageUrls(id, type);
  const fallback = embedFromKinopoiskId(id);
  let lastUrl = mirrors[0] || '';

  for (const startUrl of mirrors) {
    lastUrl = startUrl;
    try {
      const response = await fetcher(startUrl, { headers: FETCH_HEADERS, redirect: 'follow' });
      if (!response.ok) continue;
      const html = await response.text();
      const embedUrls = extractMirrorEmbeds(html);
      const pageUrl = response.url || startUrl;
      if (embedUrls.length) {
        return attachStream({
          matched: true,
          source: 'kp-mirror',
          url: pageUrl,
          embedUrl: embedUrls[0],
          embedUrls,
          mirror: startUrl,
        }, body, fetcher);
      }
    } catch {
      /* try next mirror */
    }
  }

  if (fallback) {
    return attachStream({
      matched: true,
      source: 'kp-mirror',
      url: lastUrl || mirrors[0],
      embedUrl: fallback,
      embedUrls: [fallback],
      mirror: 'direct',
    }, body, fetcher);
  }
  return { matched: false, reason: 'mirror-unavailable', source: 'kp-mirror', url: lastUrl };
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return noContent(request);
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/resolve') {
      return json({ error: 'not-found' }, 404, request);
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'bad-json' }, 400, request);
    }
    const result = await resolveKinopoiskMirror(body);
    return json(result, result.matched ? 200 : 200, request);
  },
};