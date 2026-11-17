import { corsHeaders, resolveEmbed } from '../lib/embed-resolve.mjs';

function parseOrigins(envValue) {
  return String(envValue || '')
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export default async function handler(req, res) {
  const extra = parseOrigins(process.env.CORS_ORIGINS);
  const origin = req.headers.origin || '';
  const allow = (() => {
    const headers = corsHeaders({ headers: { get: (k) => (k.toLowerCase() === 'origin' ? origin : '') } }, extra);
    return headers['Access-Control-Allow-Origin'] || '';
  })();

  if (req.method === 'OPTIONS') {
    Object.entries(corsHeaders({ headers: { get: (k) => (k.toLowerCase() === 'origin' ? origin : '') } }, extra)).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    if (allow) res.setHeader('Access-Control-Allow-Origin', allow);
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    if (allow) res.setHeader('Access-Control-Allow-Origin', allow);
    return res.status(400).json({ error: 'invalid_json' });
  }

  const data = await resolveEmbed(body, process.env);
  Object.entries(corsHeaders({ headers: { get: (k) => (k.toLowerCase() === 'origin' ? origin : '') } }, extra)).forEach(([k, v]) => res.setHeader(k, v));
  return res.status(200).json(data);
}