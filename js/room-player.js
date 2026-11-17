// Свой плеер комнаты. iframe.cloud рисует кино, но play и паузу родителю не сообщает,
// поэтому гости не стартуют. Здесь тот же поток, а кнопки уже наши.

export function kpFromFilm(film) {
  const direct = String(film?.kinopoiskId || '').replace(/\D/g, '');
  if (direct) return direct;
  const match = String(film?.embedUrl || '').match(/iframe\.cloud\/iframe\/(\d+)/);
  return match ? match[1] : '';
}

let hlsPromise = null;

function loadHls() {
  if (typeof window !== 'undefined' && window.Hls) return Promise.resolve(window.Hls);
  if (!hlsPromise) {
    hlsPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL('hls.min.js?v=1', import.meta.url).href;
      script.onload = () => resolve(window.Hls || null);
      script.onerror = () => reject(new Error('hls'));
      document.head.appendChild(script);
    });
  }
  return hlsPromise;
}

export async function mountRoomVideo(frame, streamUrl, title) {
  frame.classList.remove('lord-browse');
  frame.replaceChildren();
  const video = document.createElement('video');
  video.className = 'room-video';
  video.controls = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.setAttribute('title', title || 'Фильм');
  frame.appendChild(video);
  const Hls = await loadHls();
  if (Hls?.isSupported?.()) {
    const hls = new Hls({ maxBufferLength: 24, capLevelToPlayerSize: true });
    hls.loadSource(streamUrl);
    hls.attachMedia(video);
    video.__hls = hls;
  } else {
    video.src = streamUrl;
  }
  return video;
}

export function bindLocalVideo(video, { onReady, onTick } = {}) {
  let heard = false;
  let queued = null;

  const emit = (explicit, playing) => {
    heard = true;
    const duration = Number.isFinite(video.duration) ? video.duration : null;
    onTick?.({
      at: Number.isFinite(video.currentTime) ? video.currentTime : 0,
      duration,
      playing,
      explicit,
      heard: true,
    });
  };

  const applyQueued = () => {
    if (!queued || video.readyState < 1) return;
    const { playing, at } = queued;
    queued = null;
    const target = Math.max(0, Number(at) || 0);
    if (Number.isFinite(video.currentTime) && Math.abs(video.currentTime - target) > 1.2) {
      try { video.currentTime = target; } catch { /* метаданные ещё едут */ }
    }
    if (playing) {
      const attempt = video.play();
      if (attempt?.catch) {
        attempt.catch(() => {
          video.muted = true;
          video.play()?.then?.(() => { video.muted = false; })?.catch?.(() => {});
        });
      }
    } else {
      video.pause();
    }
  };

  const onPlay = () => emit(true, true);
  const onPause = () => { if (!video.ended) emit(true, false); };
  const onSeeked = () => emit(true, !video.paused);
  const onTime = () => emit(false, !video.paused);
  const onMeta = () => applyQueued();

  video.addEventListener('play', onPlay);
  video.addEventListener('pause', onPause);
  video.addEventListener('seeked', onSeeked);
  video.addEventListener('timeupdate', onTime);
  video.addEventListener('loadedmetadata', onMeta);
  // После return, иначе команда гостю приходит, когда мост ещё не записан.
  queueMicrotask(() => onReady?.());

  return {
    command(playing, at) {
      queued = { playing: !!playing, at };
      applyQueued();
    },
    heard: () => heard,
    destroy() {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('loadedmetadata', onMeta);
      try { video.__hls?.destroy(); } catch { /* уже снят */ }
    },
  };
}
