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
  // пауза и play ведущего уходят сразу, даже сразу после своей команды
  if (explicit && now !== sentPlaying) return { at, playing: now };
  // тишина после своей команды глушит эхо плеера, но не новую перемотку
  if (sinceSentMs < HOST_QUIET_MS && !jumped) return null;
  if (!explicit && playing === true && !sentPlaying) return { at, playing: true };
  if (jumped) return { at, playing: now };
  return null;
}

// Гость сам себя подтягивает только при заметном уходе от комнаты и не чаще раза в 8 секунд.
export function guestNeedsSeek({ expected, local, roomPlaying = false, localPlaying = null, sinceSeekMs = Infinity } = {}) {
  if (!Number.isFinite(expected) || !Number.isFinite(local)) return false;
  if (sinceSeekMs < GUEST_COOLDOWN_MS) return false;
  if (localPlaying != null && !!localPlaying !== !!roomPlaying) return true;
  return Math.abs(expected - local) > GUEST_DRIFT;
}

// Позиция плеера по последнему тику с поправкой на прошедшее время.
export function localPosition(tick, nowMs = Date.now()) {
  if (!tick || !Number.isFinite(tick.at)) return null;
  return tick.playing ? tick.at + Math.max(0, nowMs - tick.wall) / 1000 : tick.at;
}

const freshHost = () => ({ tick: null, stallSince: 0, sentAt: 0, sentPlaying: false, sentWall: 0 });

// Ведущий: пачка сообщений плеера → что отправить комнате.
// Первый замер времени без флага play/pause ещё ничего не значит: игра это или пауза,
// видно только по следующему замеру. Иначе гостю уходит ложная пауза и он не стартует.
export function noteHostTick(state = freshHost(), tick = {}, nowMs = Date.now()) {
  const prev = state.tick;
  const at = Number.isFinite(tick.at) ? tick.at : (prev && Number.isFinite(prev.at) ? localPosition(prev, nowMs) : state.sentAt);
  let playing = tick.playing == null ? (prev ? prev.playing : null) : !!tick.playing;
  let explicit = !!tick.explicit;
  let stallSince = state.stallSince || 0;
  if (tick.playing == null && prev && Number.isFinite(tick.at) && Number.isFinite(prev.at)) {
    const delta = tick.at - prev.at;
    const wall = Math.max(0.001, (nowMs - prev.wall) / 1000);
    if (delta > 0.35 && delta < wall + 2.5) {
      playing = true;
      if (!prev.playing) explicit = true;
      stallSince = 0;
    } else if (prev.playing && Math.abs(delta) < 0.35) {
      if (!stallSince) stallSince = nowMs;
      if (nowMs - stallSince > 2200) { playing = false; explicit = true; }
    } else stallSince = 0;
  } else if (tick.playing != null) stallSince = 0;
  if (tick.explicit && tick.playing == null && Number.isFinite(tick.at)) playing = prev ? !!prev.playing : !!state.sentPlaying;
  const nextTick = { at, wall: nowMs, playing };
  let emit = hostChange({
    at,
    playing: playing == null ? undefined : playing,
    explicit: explicit && playing != null,
    expected: state.sentAt ?? 0,
    sentPlaying: !!state.sentPlaying,
    sinceSentMs: nowMs - (state.sentWall || 0),
  });
  // один голый таймкод не объявляем паузой
  if (emit && !emit.playing && playing == null) emit = null;
  if (!prev && tick.playing == null && !tick.explicit) emit = null;
  const base = { tick: nextTick, stallSince, sentAt: state.sentAt ?? 0, sentPlaying: !!state.sentPlaying, sentWall: state.sentWall || 0 };
  if (!emit) return { state: base, emit: null };
  return { state: { ...base, sentAt: emit.at, sentPlaying: emit.playing, sentWall: nowMs }, emit };
}

// Гость: комната играет, а локальный плеер ещё нет — это команда «старт», даже с нуля.
export function guestCommand({ roomPlaying = false, roomAt = 0, localPlaying = null, localAt = null, snap = false, sinceSeekMs = Infinity } = {}) {
  if (!Number.isFinite(roomAt)) return null;
  const room = !!roomPlaying;
  const local = localPlaying == null ? null : !!localPlaying;
  if (local === null && !room) return null;
  if (local !== room) {
    if (local === null || snap || sinceSeekMs >= 1500) return { playing: room, at: roomAt };
    return null;
  }
  if (Number.isFinite(localAt) && Math.abs(localAt - roomAt) > GUEST_DRIFT && sinceSeekMs >= GUEST_COOLDOWN_MS) {
    return { playing: room, at: roomAt };
  }
  if (snap && sinceSeekMs >= 1500) return { playing: room, at: roomAt };
  return null;
}
