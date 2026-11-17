const BASE_ORIGINS = new Set([
  'https://relocpe.github.io',
  'http://127.0.0.1:4173',
  'http://localhost:4173',
  'http://127.0.0.1:3000',
  'http://localhost:3000',
]);

export function originAllowed(origin, extras = []) {
  if (!origin) return false;
  if (BASE_ORIGINS.has(origin)) return true;
  if (extras.includes(origin)) return true;
  return /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin);
}

export function pickCorsOrigin(request, extras = []) {
  const origin = request.headers.get('Origin') || '';
  return originAllowed(origin, extras) ? origin : '';
}