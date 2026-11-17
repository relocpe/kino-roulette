const SYNC_HOST = /kodik|aniqit|cloudcache|alloha|toramp|apbugall|vibix|kinescopecdn/i;

const DEFAULT_ORIGINS = [
  'https://relocpe.github.io',
  'http://127.0.0.1:4173',
  'http://localhost:4173',
  'http://127.0.0.1:3000',
  'http://localhost:3000',
];

export function corsOrigin(request, extra = []) {
  const origin = request.headers.get('Origin') || '';
  const list = new Set([...DEFAULT_ORIGINS, ...extra]);
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) list.add(origin);
  return list.has(origin) ? origin : '';
}

export function corsHeaders(request, extra = []) {
  const allow = corsOrigin(request, extra);
  return {
    ...(allow ? { 'Access-Control-Allow-Origin': allow } : {}),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function jsonResponse(data, status, request, extraOrigins = []) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(request, extraOrigins),
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function absLink(link) {
  const raw = String(link || '').trim();
  if (!raw) return '';
  if (/^https:\/\//i.test(raw)) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  return '';
}

function syncable(url) {
  try {
    const host = new URL(url).hostname;
    return SYNC_HOST.test(host) && !/iframe\.cloud$/i.test(host);
  } catch {
    return false;
  }
}

function pickKodikResult(results, season, episode) {
  const list = Array.isArray(results) ? results : [];
  if (!list.length) return null;
  const s = Number(season);
  const e = Number(episode);
  if (Number.isFinite(s) && Number.isFinite(e)) {
    const exact = list.find((row) => Number(row?.season) === s && Number(row?.episode) === e);
    if (exact?.link) return exact;
    const seasonRow = list.find((row) => Number(row?.season) === s && row?.link);
    if (seasonRow) return seasonRow;
  }
  return list.find((row) => row?.link) || null;
}

export async function lookupKodik({ kinopoiskId, season, episode, token, fetcher = fetch }) {
  if (!token) return { matched: false, reason: 'no-token', source: 'kodik' };
  const id = String(kinopoiskId || '').replace(/\D/g, '');
  if (!id) return { matched: false, reason: 'no-id', source: 'kodik' };
  const q = new URLSearchParams({
    token,
    kinopoisk_id: id,
    with_seasons: 'true',
    with_episodes: 'true',
    limit: '100',
  });
  if (season != null) q.set('season', String(season));
  if (episode != null) q.set('episode', String(episode));
  const url = `https://kodikapi.com/search?${q}`;
  let data;
  try {
    const r = await fetcher(url, { headers: { Accept: 'application/json' } });
    if (!r.ok) return { matched: false, reason: 'upstream', source: 'kodik', status: r.status };
    data = await r.json();
  } catch {
    return { matched: false, reason: 'network', source: 'kodik' };
  }
  const row = pickKodikResult(data?.results, season, episode);
  const embedUrl = absLink(row?.link);
  if (!embedUrl || !syncable(embedUrl)) {
    return { matched: false, reason: 'no-embed', source: 'kodik' };
  }
  return {
    matched: true,
    source: 'kodik',
    embedUrl,
    embedUrls: [embedUrl],
    title: row?.title || '',
    year: row?.year || null,
    season: row?.season ?? season ?? null,
    episode: row?.episode ?? episode ?? null,
  };
}

function allohaIframe(payload) {
  if (!payload || typeof payload !== 'object') return '';
  const direct = payload.iframe || payload.iframe_url || payload.link;
  if (direct) return absLink(direct);
  const data = payload.data;
  if (data && typeof data === 'object') {
    return absLink(data.iframe || data.iframe_url || data.link);
  }
  return '';
}

export async function lookupAlloha({ kinopoiskId, season, episode, token, fetcher = fetch }) {
  if (!token) return { matched: false, reason: 'no-token', source: 'alloha' };
  const id = String(kinopoiskId || '').replace(/\D/g, '');
  if (!id) return { matched: false, reason: 'no-id', source: 'alloha' };
  const q = new URLSearchParams({ token, kp: id });
  if (season != null) q.set('season', String(season));
  if (episode != null) q.set('episode', String(episode));
  const url = `https://api.apbugall.org/?${q}`;
  let data;
  try {
    const r = await fetcher(url, { headers: { Accept: 'application/json' } });
    if (!r.ok) return { matched: false, reason: 'upstream', source: 'alloha', status: r.status };
    data = await r.json().catch(() => ({}));
  } catch {
    return { matched: false, reason: 'network', source: 'alloha' };
  }
  const embedUrl = allohaIframe(data);
  if (!embedUrl || !syncable(embedUrl)) {
    return { matched: false, reason: 'no-embed', source: 'alloha' };
  }
  return {
    matched: true,
    source: 'alloha',
    embedUrl,
    embedUrls: [embedUrl],
  };
}

export async function resolveEmbed(input, env = {}) {
  const kinopoiskId = String(input?.kinopoiskId || '').replace(/\D/g, '');
  const season = input?.season != null ? Number(input.season) : undefined;
  const episode = input?.episode != null ? Number(input.episode) : undefined;
  if (!kinopoiskId) {
    return { matched: false, reason: 'no-id', source: 'embed' };
  }
  const kodikToken = env.KODIK_TOKEN || env.kodik_token || '';
  const allohaToken = env.ALLOHA_TOKEN || env.alloha_token || '';
  const prefer = String(env.EMBED_PROVIDER || 'kodik,alloha').toLowerCase().split(/[,\s]+/).filter(Boolean);
  const order = prefer.length ? prefer : ['kodik', 'alloha'];
  const attempts = [];
  for (const name of order) {
    if (name === 'kodik') attempts.push(lookupKodik({ kinopoiskId, season, episode, token: kodikToken }));
    if (name === 'alloha') attempts.push(lookupAlloha({ kinopoiskId, season, episode, token: allohaToken }));
  }
  const out = await Promise.all(attempts);
  const hit = out.find((row) => row.matched) || out[out.length - 1] || { matched: false, reason: 'no-provider', source: 'embed' };
  if (!hit.matched) {
    const configured = Boolean(kodikToken || allohaToken);
    return {
      matched: false,
      reason: configured ? (hit.reason || 'no-embed') : 'no-token',
      source: 'embed',
      providers: out.map((row) => ({ source: row.source, reason: row.reason || '' })),
    };
  }
  return hit;
}