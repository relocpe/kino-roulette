const CF_EMBED = 'https://kino-roulette-embed-resolver.samevamp.workers.dev/resolve';
const KP_MIRROR = 'https://kino-roulette-kp-mirror-resolver.samevamp.workers.dev/resolve';
const ZOMBI = 'https://kino-roulette-zombi-resolver.samevamp.workers.dev/resolve';
const WATCH_PARTY = 'https://kino-roulette-watch-party.samevamp.workers.dev';

function readOverride(key) {
  try { return String(localStorage.getItem(key) || '').trim(); } catch { return ''; }
}

export function apiConfig() {
  const host = location.hostname;
  const origin = location.origin;
  let embedResolver = readOverride('kr:embed') || CF_EMBED;
  if (!readOverride('kr:embed') && (host === 'localhost' || host === '127.0.0.1')) {
    embedResolver = 'http://127.0.0.1:8788/resolve';
  } else if (!readOverride('kr:embed') && /\.vercel\.app$/i.test(host)) {
    embedResolver = `${origin}/api/resolve`;
  }
  const watchParty = readOverride('kr:party') || WATCH_PARTY;
  return { embedResolver, kpMirror: KP_MIRROR, zombi: ZOMBI, watchParty };
}