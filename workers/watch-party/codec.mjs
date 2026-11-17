/** @typedef {{ uid: string, nick: string, auth?: boolean, host?: boolean }} Member */

export const CODE = /^[A-Za-z0-9]{6,10}$/;

export function newRoomId() {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  const b = crypto.getRandomValues(new Uint8Array(8));
  for (let i = 0; i < 8; i++) s += a[b[i] % a.length];
  return s;
}

export function sanitizeNick(nick) {
  const t = String(nick || '').trim().replace(/[<>`]/g, '').slice(0, 24);
  return t || 'Гость';
}

export function sanitizeChat(text) {
  return String(text || '').trim().replace(/[<>`]/g, '').slice(0, 400);
}

/** Текущая позиция по модели «стена + секунды» */
export function syncNow(sync) {
  if (!sync?.playing || !sync.wall) return sync?.at || 0;
  return Math.max(0, (sync.at || 0) + (Date.now() - sync.wall) / 1000);
}

const httpsUrl = (value) => {
  try {
    const u = new URL(String(value));
    return u.protocol === 'https:' ? u.href.slice(0, 500) : undefined;
  } catch {
    return undefined;
  }
};

export function sanitizeFilm(film) {
  const season = film?.season | 0;
  const episode = film?.episode | 0;
  const imdb = String(film?.imdbId || '');
  return {
    id: String(film?.id || '').slice(0, 32),
    title: String(film?.title || '').slice(0, 200),
    year: film?.year | 0 || undefined,
    embedUrl: httpsUrl(film?.embedUrl),
    pageUrl: httpsUrl(film?.pageUrl),
    streamUrl: httpsUrl(film?.streamUrl),
    voice: String(film?.voice || '').replace(/\s+/g, ' ').trim().slice(0, 80) || undefined,
    kinopoiskId: String(film?.kinopoiskId || '').replace(/\D/g, '').slice(0, 12) || undefined,
    originalTitle: String(film?.originalTitle || '').replace(/\s+/g, ' ').trim().slice(0, 180) || undefined,
    imdbId: /^tt\d{5,}$/.test(imdb) ? imdb : undefined,
    type: film?.type === 'tv' ? 'tv' : 'movie',
    season: season > 0 && season < 200 ? season : undefined,
    episode: episode > 0 && episode < 500 ? episode : undefined,
    mode: film?.mode === 'trailer' ? 'trailer' : 'stream',
    ytId: film?.ytId ? String(film.ytId).slice(0, 20) : undefined,
  };
}

export function publicRoom(room, members = []) {
  return {
    id: room.id,
    hostId: room.hostId,
    film: room.film,
    sync: { ...room.sync, now: syncNow(room.sync) },
    members: members.map((m) => ({ uid: m.uid, nick: m.nick, auth: !!m.auth, host: m.host ?? m.uid === room.hostId })),
    chat: (room.chat || []).slice(-80),
  };
}