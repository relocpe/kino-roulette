// Мост к чужому iframe. Каждый балансер говорит на своём postMessage.
// Протоколы сверены с тем, как живая комната реально читает Kodik, Alloha, Vibix и YouTube.

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

const DIRECT = /kodik|aniqit|cloudcache|alloha|toramp|apbugall|vibix|kinescopecdn|collaps|hdvb|videocdn|bazon|iframe\.cloud|playerjs|cdnmovies|voidboost|ustore|lumex|kinobox|youtube|youtu\.be/i;

export function playerKind(url) {
  let host = '';
  try { host = new URL(url, 'https://relocpe.github.io').hostname; } catch { return 'unknown'; }
  if (/youtube\.com$|youtube-nocookie\.com$|youtu\.be$/.test(host)) return 'youtube';
  if (/kodik|aniqit|cloudcache/.test(host)) return 'kodik';
  if (/alloha|toramp|apbugall/.test(host)) return 'alloha';
  if (/vibix|kinescopecdn/.test(host)) return 'vibix';
  if (/collaps|hdvb|videocdn|bazon|iframe\.cloud|playerjs|cdnmovies|voidboost|ustore|lumex|kinobox/.test(host)) return 'playerjs';
  return 'unknown';
}

export function preferEmbeds(urls) {
  const list = [...new Set((urls || []).filter(Boolean))];
  return list.sort((a, b) => Number(DIRECT.test(b)) - Number(DIRECT.test(a)));
}

// Alloha молчит, пока в адресе нет api=1. YouTube не принимает команды без enablejsapi.
// Kodik стартует с start_from, Alloha со start, и оба ждут autoplay=1 в адресе.
// postMessage «play» чужой плеер часто молча игнорирует, пока его сам не ткнут.
export function playbackUrl(url, { at = 0, playing = false } = {}) {
  const prepared = prepareEmbedUrl(url);
  try {
    const u = new URL(prepared);
    const sec = Math.max(0, Math.floor(Number(at) || 0));
    const kind = playerKind(u.href);
    if (playing) u.searchParams.set('autoplay', '1');
    if (sec > 0) {
      if (kind === 'kodik') u.searchParams.set('start_from', String(sec));
      else if (kind === 'youtube' || kind === 'alloha' || kind === 'vibix') u.searchParams.set('start', String(sec));
      else if (kind === 'playerjs') u.searchParams.set('time', String(sec));
      else {
        u.searchParams.set('start', String(sec));
        u.searchParams.set('start_from', String(sec));
      }
    }
    return u.href;
  } catch {
    return prepared;
  }
}

export function prepareEmbedUrl(url) {
  try {
    const u = new URL(url, 'https://relocpe.github.io');
    const kind = playerKind(u.href);
    if (kind === 'alloha' && !u.searchParams.has('api')) u.searchParams.set('api', '1');
    if (kind === 'youtube') {
      u.searchParams.set('enablejsapi', '1');
      let origin = '';
      try { origin = location.origin; } catch { /* нет окна */ }
      if (origin && !u.searchParams.has('origin')) u.searchParams.set('origin', origin);
    }
    return u.href;
  } catch {
    return url;
  }
}

const playState = (o) => (o?.paused === true ? false : o?.paused === false ? true : o?.playing === false ? false : o?.playing === true ? true : undefined);

function parseKodikEvent(d) {
  const v = d.value;
  const time = typeof v === 'number' ? v : (num(v?.time) ?? num(v?.seconds));
  const duration = v && typeof v === 'object' ? num(v.duration) : null;
  if (d.key === 'kodik_player_play' || d.key === 'kodik_player_video_started') return { playing: true, at: time, explicit: true };
  if (d.key === 'kodik_player_pause' || d.key === 'kodik_player_video_ended') return { playing: false, at: time, explicit: true };
  if (d.key === 'kodik_player_seek') return time == null ? null : { at: time, explicit: true };
  if (d.key === 'kodik_player_time_update') return time == null ? null : { at: time, duration, playing: undefined };
  return null;
}

export function parsePlayerMessage(raw) {
  const d = typeof raw === 'string' ? tryJson(raw) : raw;
  if (!d || typeof d !== 'object') return null;

  if (typeof d.key === 'string' && d.key.startsWith('kodik_player_') && d.key !== 'kodik_player_api') return parseKodikEvent(d);

  if (d.event === 'time' && num(d.time) != null) return { at: d.time, duration: num(d.duration), playing: playState(d) };
  if (d.event === 'play' || d.event === 'playing' || d.event === 'started' || d.event === 'start' || d.event === 'resumed' || d.event === 'userplay' || d.type === 'play' || d.method === 'play' || d.api === 'play') return { playing: true, at: num(d.time) ?? num(d.seconds), explicit: true };
  if (d.event === 'pause' || d.event === 'paused' || d.event === 'userpause' || d.type === 'pause' || d.method === 'pause' || d.api === 'pause') return { playing: false, at: num(d.time) ?? num(d.seconds), explicit: true };
  const seekAt = num(d.time) ?? num(d.seconds) ?? num(d.set);
  if ((d.event === 'seek' || d.event === 'seeked' || d.type === 'seek' || d.method === 'seek' || d.api === 'seek') && seekAt != null) return { at: seekAt, explicit: true };
  if ((d.api === 'time' || d.api === 'timeupdate' || d.event === 'timeupdate') && (num(d.time) ?? num(d.value) ?? num(d.answer)) != null) {
    return { at: num(d.time) ?? num(d.value) ?? num(d.answer), duration: num(d.duration), playing: playState(d) };
  }

  const v = d.value;
  if (d.key === 'kodik_player_api' && v && typeof v === 'object') {
    if (v.method === 'time_update' || v.method === 'time' || v.method === 'get_time') return { at: num(v.time) ?? num(v.seconds), duration: num(v.duration), playing: playState(v) };
    if (v.method === 'play') return { playing: true, at: num(v.time) ?? num(v.seconds), explicit: true };
    if (v.method === 'pause') return { playing: false, at: num(v.time) ?? num(v.seconds), explicit: true };
    if (v.method === 'seek' && (num(v.time) ?? num(v.seconds)) != null) return { at: num(v.time) ?? num(v.seconds), explicit: true };
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

export function shouldSnapGuest({ snap = false, force = false, playEdge = false, jump = false, first = false, playing = false } = {}) {
  return !!(force || snap || playEdge || jump || (first && playing));
}

function tryJson(s) {
  try { return JSON.parse(s); } catch { return null; }
}

const KIND_HOST = {
  kodik: /kodik|aniqit|cloudcache/,
  alloha: /alloha|toramp|apbugall/,
  vibix: /vibix|kinescopecdn/,
  playerjs: /collaps|hdvb|videocdn|bazon|iframe\.cloud|playerjs|cdnmovies|voidboost|ustore|lumex|kinobox/,
  youtube: /youtube|youtu\.be|google/,
};

export function bindEmbed(iframe, { onTick, onReady } = {}) {
  let at = 0;
  let duration = 0;
  let playing = false;
  let heard = false;
  let ignoreUntil = 0;

  const kind = () => playerKind(iframe.src || '');
  const post = (data) => {
    const win = iframe.contentWindow;
    if (!win) return;
    try { win.postMessage(data, '*'); } catch {}
    try { win.postMessage(JSON.stringify(data), '*'); } catch {}
  };

  const subscribe = () => {
    const k = kind();
    if (k === 'kodik' || k === 'unknown') post({ key: 'kodik_player_api', value: { method: 'get_time' } });
    if (k === 'alloha' || k === 'unknown') post({ api: 'time' });
    if (k === 'playerjs' || k === 'unknown') {
      post({ context: 'player.js', version: '0.0.11', method: 'addEventListener', value: 'timeupdate' });
      post({ context: 'player.js', version: '0.0.11', method: 'addEventListener', value: 'play' });
      post({ context: 'player.js', version: '0.0.11', method: 'addEventListener', value: 'pause' });
    }
    if (k === 'youtube' || k === 'unknown') post({ event: 'listening', id: 'kr', channel: 'widget' });
  };

  const sendCommand = (nextPlaying, seconds) => {
    const t = Math.max(0, Number(seconds) || 0);
    const k = kind();
    ignoreUntil = Date.now() + 1200;
    at = t;
    playing = !!nextPlaying;
    if (k === 'kodik' || k === 'unknown') {
      post({ key: 'kodik_player_api', value: { method: 'seek', seconds: t } });
      post({ key: 'kodik_player_api', value: { method: nextPlaying ? 'play' : 'pause' } });
    }
    if (k === 'alloha' || k === 'unknown') {
      post({ api: 'seek', value: t });
      post({ api: nextPlaying ? 'play' : 'pause' });
    }
    if (k === 'vibix' || k === 'unknown') {
      post({ type: 'playerCommand', command: 'seek', value: t, timestamp: Date.now() });
      post({ type: 'playerCommand', command: nextPlaying ? 'play' : 'pause', timestamp: Date.now() });
    }
    if (k === 'playerjs' || k === 'unknown') {
      post({ context: 'player.js', version: '0.0.11', method: 'setCurrentTime', value: t });
      post({ context: 'player.js', version: '0.0.11', method: nextPlaying ? 'play' : 'pause' });
      post({ api: 'seek', set: t });
      post({ api: nextPlaying ? 'play' : 'pause' });
    }
    if (k === 'youtube' || k === 'unknown') {
      post({ event: 'command', func: 'seekTo', args: [t, true] });
      post({ event: 'command', func: nextPlaying ? 'playVideo' : 'pauseVideo', args: [] });
    }
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
    if (mine && mine !== 'null' && origin === mine) return true;
    const k = kind();
    const re = KIND_HOST[k];
    if (!re || !origin) return false;
    try { return re.test(new URL(origin).hostname); } catch { return false; }
  };

  const foreignPlayer = (origin) => {
    try {
      const host = new URL(origin).hostname;
      return !!host && host !== location.hostname;
    } catch { return false; }
  };
  const onMessage = (ev) => {
    const tick = parsePlayerMessage(ev.data);
    if (!tick) return;
    if (!fromThisPlayer(ev.source, ev.origin) && !foreignPlayer(ev.origin)) return;
    heard = true;
    if (tick.duration) duration = tick.duration;
    if (tick.at != null) at = tick.at;
    if (tick.playing != null) playing = tick.playing;
    if (Date.now() < ignoreUntil) return;
    if (tick.at == null && tick.playing == null) return;
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
    const k = kind();
    if (k === 'kodik' || k === 'unknown') post({ key: 'kodik_player_api', value: { method: 'get_time' } });
    if (k === 'alloha' || k === 'unknown') post({ api: 'time' });
    if (k === 'playerjs' || k === 'unknown') post({ context: 'player.js', version: '0.0.11', method: 'getCurrentTime' });
    if (k === 'youtube' || k === 'unknown') post({ event: 'command', func: 'getCurrentTime', args: [] });
  }, 1000);

  return {
    command: sendCommand,
    heard: () => heard,
    destroy() {
      clearInterval(poll);
      iframe.removeEventListener('load', kick);
      window.removeEventListener('message', onMessage);
    },
  };
}
