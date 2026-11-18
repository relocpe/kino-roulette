export const isBeta = (v) => v === true;

export function betaFromQuery(search) {
  const v = new URLSearchParams(search || '').get('beta');
  if (v === '1') return true;
  if (v === '0') return false;
  return null;
}

export const betaAttr = (on) => (on ? '1' : '');

/* Жесты жанра. Вспышка боевика и триллера — три пика и не дольше 400 мс. */
export const GESTURES = {
  ghost: { ms: 900 },
  flash: { ms: 400, count: 3 },
  warm: { ms: 720 },
  scan: { ms: 640 },
  dust: { ms: 800 },
  edge: { ms: 180, count: 1 },
};

const GENRE_GESTURE = [
  ['horror', 'ghost'],
  ['action', 'flash'],
  ['thriller', 'flash'],
  ['romance', 'warm'],
  ['scifi', 'scan'],
  ['fantasy', 'dust'],
];

export function gestureFor(ids) {
  const list = [].concat(ids || []).filter((id) => id && id !== 'none');
  for (const [id, kind] of GENRE_GESTURE) if (list.includes(id)) return kind;
  return 'edge';
}

export function gesturesAllowed({ beta, reduce, effects } = {}) {
  return beta === true && reduce !== true && effects === true;
}

let layer = null;
let timer = 0;

export function playGenreGesture(ids) {
  if (typeof document === 'undefined') return '';
  const beta = document.documentElement.dataset.beta === '1';
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fxBtn = document.getElementById('fxBtn');
  const effects = !!(fxBtn && fxBtn.getAttribute('aria-checked') === 'true');
  if (!gesturesAllowed({ beta, reduce, effects })) return '';
  const kind = gestureFor(ids);
  const spec = GESTURES[kind];
  const host = document.getElementById('reel');
  if (!host || !spec) return '';
  if (!layer || layer.parentNode !== host) {
    layer = document.createElement('div');
    layer.className = 'bgest';
    layer.setAttribute('aria-hidden', 'true');
    host.append(layer);
  }
  layer.replaceChildren();
  const dots = kind === 'ghost' ? 2 : kind === 'dust' ? 10 : kind === 'scan' ? 1 : 0;
  for (let i = 0; i < dots; i++) layer.append(document.createElement('i'));
  layer.dataset.g = '';
  void layer.offsetWidth;
  layer.dataset.g = kind;
  clearTimeout(timer);
  timer = setTimeout(() => { if (layer) layer.dataset.g = ''; }, spec.ms + 40);
  return kind;
}
