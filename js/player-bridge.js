// Мост к чужому iframe-плееру. Разные балансеры говорят на разных postMessage.
// Шлём несколько известных команд и читаем любой ответ, где есть время.

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// Прямой iframe балансера отвечает на postMessage. Страница киносайта прячет плеер внутри себя, и время до нас не доходит.
const DIRECT = /kodik|alloha|collaps|hdvb|videocdn|bazon|iframe\.cloud|playerjs|cdnmovies|voidboost|ustore|lumex|vibix|kinobox/i;
export function preferEmbeds(urls) {
  const list = [...new Set((urls || []).filter(Boolean))];
  return list.sort((a, b) => Number(DIRECT.test(b)) - Number(DIRECT.test(a)));
}

export function parsePlayerMessage(raw) {
  const d = typeof raw === 'string' ? tryJson(raw) : raw;
  if (!d || typeof d !== 'object') return null;

  const playState = (o) => (o?.paused === true ? false : o?.paused === false ? true : o?.playing === false ? false : o?.playing === true ? true : undefined);
  if (d.event === 'time' && num(d.time) != null) return { at: d.time, duration: num(d.duration), playing: playState(d) };
  if (d.event === 'play' || d.event === 'playing' || d.type === 'play' || d.method === 'play' || d.api === 'play') return { playing: true, at: num(d.time) ?? num(d.seconds), explicit: true };
  if (d.event === 'pause' || d.event === 'paused' || d.type === 'pause' || d.method === 'pause' || d.api === 'pause') return { playing: false, at: num(d.time) ?? num(d.seconds), explicit: true };
  const seekAt = num(d.time) ?? num(d.seconds) ?? num(d.set);
  if ((d.event === 'seek' || d.event === 'seeked' || d.type === 'seek' || d.method === 'seek' || d.api === 'seek') && seekAt != null) return { at: seekAt };

  const v = d.value;
  if (d.key === 'kodik_player_api' && v && typeof v === 'object') {
    if (v.method === 'time_update' || v.method === 'time' || v.method === 'get_time') return { at: num(v.time) ?? num(v.seconds), duration: num(v.duration), playing: playState(v) };
    if (v.method === 'play') return { playing: true, at: num(v.time) ?? num(v.seconds), explicit: true };
    if (v.method === 'pause') return { playing: false, at: num(v.time) ?? num(v.seconds), explicit: true };
    if (v.method === 'seek' && (num(v.time) ?? num(v.seconds)) != null) return { at: num(v.time) ?? num(v.seconds) };
  }

  if (d.event === 'timeupdate' || d.type === 'timeupdate' || d.type === 'timeUpdate') {
    const seconds = num(d.value?.seconds) ?? num(d.data?.seconds) ?? num(d.data?.currentTime) ?? num(d.currentTime) ?? num(d.value) ?? num(d.time);
    const duration = num(d.value?.duration) ?? num(d.data?.duration) ?? num(d.duration);
    if (seconds != null) return { at: seconds, duration, playing: playState(d) };
  }
  if (d.method === 'getCurrentTime' && num(d.value) != null) return { at: d.value };
  if (d.event === 'infoDelivery' && d.info && num(d.info.currentTime) != null) {
    return { at: d.info.currentTime, duration: num(d.info.duration), playing: d.info.playerState == null ? undefined : d.info.playerState === 1 };
  }
  if (num(d.currentTime) != null && (d.event || d.type === 'timeupdate' || d.type === 'time')) {
    return { at: d.currentTime, duration: num(d.duration), playing: d.paused === false ? true : d.paused === true ? false : undefined };
  }
  return null;
}

// Гость перематывает плеер только в эти моменты. Тихий пульс времени кнопку не жмёт.
export function shouldSnapGuest({ snap = false, force = false, playEdge = false, jump = false, first = false, playing = false } = {}) {
  return !!(force || snap || playEdge || jump || (first && playing));
}

function tryJson(s) {
  try { return JSON.parse(s); } catch { return null; }
}

export function bindEmbed(iframe, { onTick, onReady } = {}) {
  let at = 0;
  let reported = null;
  let duration = 0;
  let playing = false;
  let heard = false;
  let ignoreUntil = 0;

  const post = (data) => {
    const win = iframe.contentWindow;
    if (!win) return;
    try { win.postMessage(data, '*'); } catch {}
    try { win.postMessage(JSON.stringify(data), '*'); } catch {}
  };

  const subscribe = () => {
    post({ context: 'player.js', version: '0.0.11', method: 'addEventListener', value: 'timeupdate' });
    post({ context: 'player.js', version: '0.0.11', method: 'addEventListener', value: 'play' });
    post({ context: 'player.js', version: '0.0.11', method: 'addEventListener', value: 'pause' });
    post({ event: 'listening', id: 'kr' });
    post({ key: 'kodik_player_api', value: { method: 'get_time' } });
  };

  const sendCommand = (nextPlaying, seconds) => {
    const t = Math.max(0, Number(seconds) || 0);
    ignoreUntil = Date.now() + 1200;
    at = t;
    playing = !!nextPlaying;
    post({ api: 'seek', set: t });
    post({ api: 'seek', value: t });
    post({ method: 'seek', time: t });
    post({ method: 'seek', value: t });
    post({ method: 'setCurrentTime', time: t });
    post({ key: 'kodik_player_api', value: { method: 'seek', seconds: t } });
    post({ context: 'player.js', version: '0.0.11', method: 'setCurrentTime', value: t });
    post({ event: 'command', func: 'seekTo', args: [t, true] });
    post({ type: 'seek', time: t });
    if (nextPlaying) {
      post({ api: 'play' });
      post({ method: 'play' });
      post({ key: 'kodik_player_api', value: { method: 'play' } });
      post({ context: 'player.js', version: '0.0.11', method: 'play' });
      post({ event: 'command', func: 'playVideo', args: [] });
      post({ type: 'play' });
    } else {
      post({ api: 'pause' });
      post({ method: 'pause' });
      post({ key: 'kodik_player_api', value: { method: 'pause' } });
      post({ context: 'player.js', version: '0.0.11', method: 'pause' });
      post({ event: 'command', func: 'pauseVideo', args: [] });
      post({ type: 'pause' });
    }
  };

  const command = (nextPlaying, seconds) => {
    sendCommand(nextPlaying, seconds);
  };

  const frameOrigin = () => {
    try { return new URL(iframe.src, location.href).origin; } catch { return ''; }
  };
  const fromThisPlayer = (source, origin) => {
    const top = iframe.contentWindow;
    if (source && top) {
      if (source === top) return true;
      try {
        let w = source;
        for (let i = 0; i < 4 && w; i += 1) {
          if (w === top) return true;
          const parent = w.parent;
          if (!parent || parent === w) break;
          w = parent;
        }
      } catch { /* чужой origin */ }
    }
    const mine = frameOrigin();
    return !!mine && mine !== 'null' && origin === mine;
  };

  const onMessage = (ev) => {
    if (!fromThisPlayer(ev.source, ev.origin)) return;
    const tick = parsePlayerMessage(ev.data);
    if (!tick) return;
    heard = true;
    if (tick.duration) duration = tick.duration;
    if (tick.at != null) { at = tick.at; reported = tick.at; }
    if (tick.playing != null) playing = tick.playing;
    if (Date.now() < ignoreUntil) return;
    onTick?.({ at, duration, playing: tick.playing != null ? tick.playing : undefined, explicit: !!tick.explicit, heard: true });
  };

  let readySent = false;
  const kick = () => {
    subscribe();
    if (readySent) return;
    readySent = true;
    onReady?.();
  };
  window.addEventListener('message', onMessage);
  iframe.addEventListener('load', kick);
  subscribe();
  setTimeout(kick, 700);
  const poll = setInterval(() => {
    post({ key: 'kodik_player_api', value: { method: 'get_time' } });
    post({ context: 'player.js', version: '0.0.11', method: 'getCurrentTime' });
    post({ api: 'getCurrentTime' });
  }, 1000);

  return {
    command,
    heard: () => heard,
    destroy() {
      clearInterval(poll);
      iframe.removeEventListener('load', kick);
      window.removeEventListener('message', onMessage);
    },
  };
}
