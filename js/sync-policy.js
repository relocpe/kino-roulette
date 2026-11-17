// Правила синхронизации комнаты. Время в секундах, паузы в мс.
// Управляет только ведущий: его перемотка и пауза едут всем, у гостя — подстройка при большом уходе.

export const HOST_SEEK_PLAYING = 3;
export const HOST_SEEK_PAUSED = 1.5;
export const HOST_QUIET_MS = 2000;
export const GUEST_DRIFT = 4;
export const GUEST_COOLDOWN_MS = 8000;

// Ведущий двигает плеер сам (клик по полосе, пауза, play) — комната должна это увидеть.
// expected — где ведущий должен быть по последней отправленной синхронизации.
export function hostChange({ at, playing, explicit = false, expected = 0, sentPlaying = false, sinceSentMs = Infinity } = {}) {
  if (!Number.isFinite(at)) return null;
  const now = playing == null ? sentPlaying : !!playing;
  const limit = now ? HOST_SEEK_PLAYING : HOST_SEEK_PAUSED;
  const jumped = Math.abs(at - expected) > limit;
  // тишина после своей команды глушит эхо плеера, но не новую перемотку
  if (sinceSentMs < HOST_QUIET_MS && !jumped) return null;
  if (explicit && now !== sentPlaying) return { at, playing: now };
  if (!explicit && playing === true && !sentPlaying) return { at, playing: true };
  if (jumped) return { at, playing: now };
  return null;
}

// Гость сам себя подтягивает только при заметном уходе от комнаты и не чаще раза в 8 секунд.
export function guestNeedsSeek({ expected, local, roomPlaying = false, sinceSeekMs = Infinity } = {}) {
  if (!Number.isFinite(expected) || !Number.isFinite(local)) return false;
  if (sinceSeekMs < GUEST_COOLDOWN_MS) return false;
  return Math.abs(expected - local) > GUEST_DRIFT;
}

// Позиция плеера по последнему тику с поправкой на прошедшее время.
export function localPosition(tick, nowMs = Date.now()) {
  if (!tick) return null;
  return tick.playing ? tick.at + Math.max(0, nowMs - tick.wall) / 1000 : tick.at;
}
