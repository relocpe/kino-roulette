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