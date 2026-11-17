import { corsHeaders, jsonResponse, resolveEmbed } from '../../lib/embed-resolve.mjs';

function extraOrigins(env) {
  return String(env.CORS_ORIGINS || '')
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request, extraOrigins(env)) });
    }
    const url = new URL(request.url);
    if (url.pathname !== '/resolve') return jsonResponse({ error: 'not_found' }, 404, request, extraOrigins(env));
    if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405, request, extraOrigins(env));

    let body;
    try {
      const text = await request.text();
      if (text.length > 4096) return jsonResponse({ error: 'too_large' }, 413, request, extraOrigins(env));
      body = JSON.parse(text);
    } catch {
      return jsonResponse({ error: 'invalid_json' }, 400, request, extraOrigins(env));
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return jsonResponse({ error: 'invalid_body' }, 400, request, extraOrigins(env));
    }
    const data = await resolveEmbed(body, env);
    return jsonResponse(data, 200, request, extraOrigins(env));
  },
};