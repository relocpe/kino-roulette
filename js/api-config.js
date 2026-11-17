const CF_EMBED = 'https://kino-roulette-embed-resolver.samevamp.workers.dev/resolve';
const KP_MIRROR = 'https://kino-roulette-kp-mirror-resolver.samevamp.workers.dev/resolve';
const ZOMBI = 'https://kino-roulette-zombi-resolver.samevamp.workers.dev/resolve';
const WATCH_PARTY = 'https://kino-roulette-watch-party.samevamp.workers.dev';

function readOverride(key) {
  try { return String(localStorage.getItem(key) || '').trim(); } catch { return ''; }
}

function embedResolverUrl() {
  const direct = readOverride('kr:embed');
  if (direct) return direct;
  if (readOverride('kr:embedResolver') !== '1') return '';
  const host = location.hostname;
  const origin = location.origin;
  if (host === 'localhost' || host === '127.0.0.1') return 'http://127.0.0.1:8788/resolve';
  if (/\.vercel\.app$/i.test(host)) return `${origin}/api/resolve`;
  return CF_EMBED;
}

export function apiConfig() {
  const watchParty = readOverride('kr:party') || WATCH_PARTY;
  return { embedResolver: embedResolverUrl(), kpMirror: KP_MIRROR, zombi: ZOMBI, watchParty };
}