// Киношные жанровые эффекты по спеке VFX-дизайнера (/workspace/kino-vfx: l0.frag, l2.frag, presets.js).
// Слои снизу вверх: L0 #gl — атмосфера под барабаном (WebGL, непрозрачный фон); L1 #strip — грейд CSS filter + камера transform;
// L2 #fxo — тинт/зерно/виньетка/ореол/лучи/экспозиция (WebGL, mix-blend-mode: overlay, только над барабаном);
// .fxdim — чистый чёрный (ирис, кашетирование); L3 — пульт и текст, эффекты их не трогают.
import { GENRES, resolvePreset, phaseVal, hex, E } from './fxpresets.js?v=1';

const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const root = document.documentElement;
const $ = (s) => document.querySelector(s);
const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const mixV = (a, b, k) => a.map((x, i) => lerp(x, b[i], k));

// ---------- кривые: cubic-bezier и пружина ----------
function bezier(x1, y1, x2, y2) {
  const A = (a, b) => 1 - 3 * b + 3 * a, B = (a, b) => 3 * b - 6 * a, C = (a) => 3 * a;
  const at = (t, a, b) => ((A(a, b) * t + B(a, b)) * t + C(a)) * t;
  const slope = (t, a, b) => 3 * A(a, b) * t * t + 2 * B(a, b) * t + C(a);
  return (x) => {
    if (x <= 0) return 0; if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) { const s = slope(t, x1, x2); if (Math.abs(s) < 1e-6) break; t -= (at(t, x1, x2) - x) / s; }
    t = clamp(t); return at(t, y1, y2);
  };
}
const EZ = new Map();
function ease(css) {
  if (!EZ.has(css)) {
    const m = /cubic-bezier\(([^)]+)\)/.exec(css || '');
    EZ.set(css, m ? bezier(...m[1].split(',').map(Number)) : css === 'linear' ? (x) => x : bezier(0, 0, 0.58, 1));
  }
  return EZ.get(css);
}
const eOut = ease(E.out), eInOut = ease(E.inOut), ePunch = ease(E.punch), eSettle = ease(E.settle), eFall = ease(E.fall);
const eRamp = ease('cubic-bezier(.4,0,.2,1)'), eEaseOut = bezier(0, 0, 0.58, 1);
// пружина k180 d12, m1: x(t) от 1 к 0 (перелёт есть)
const spring = (t) => { const w = Math.sqrt(180), z = 12 / (2 * w), wd = w * Math.sqrt(1 - z * z); return Math.exp(-z * w * t) * (Math.cos(wd * t) + (z * w / wd) * Math.sin(wd * t)); };
// участок таймлайна: значение a→b на [t0,t1] мс с кривой e
const seg = (t, t0, t1, a, b, e = (x) => x) => (t <= t0 ? a : t >= t1 ? b : lerp(a, b, e((t - t0) / (t1 - t0))));

// ---------- жанры сайта → пресеты ----------
const MAP = { music: 'musical', mystery: 'thriller', shonen: 'anime', seinen: 'anime', isekai: 'anime', mecha: 'anime', slice: 'anime', sports: 'anime' };
export const presetId = (id) => (GENRES[id] ? id : MAP[id] || null);
// совместимость со старым API: «главный» = первый выбранный (правило спеки), пары разруливает resolvePreset
export const top1 = (ids) => ids;

// ---------- шейдеры (без правок, из kino-vfx) ----------
const L0_FS = `precision mediump float;
// L0: атмосфера ПОД барабаном. Непрозрачный, заменяет фон. vUv: (0,0) = низ-лево (GL).
uniform vec2  uRes;      // размер канваса в px (0.5x CSS)
uniform float uTime;     // сек
uniform float uMode;     // 0..8, см. presets.js
uniform float uDensity;  // итоговая плотность (lerp idle→spin по uI делаем в JS)
uniform float uSpeed, uScale, uAngle, uWidth;
uniform float uBeamPos;  // смещение луча/прожектора/жалюзи (анимируется в JS)
uniform float uClear;    // 0..1 радиальное «расхождение» вокруг постера (фантастика)
uniform vec3  uBg, uAtmo;
uniform vec4  uRect;     // постер в GL-uv: x0,y0,x1,y1 (y перевёрнут относительно DOM!)
varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h(i), h(i+vec2(1.0,0.0)), f.x), mix(h(i+vec2(0.0,1.0)), h(i+1.0), f.x), f.y); }
float fbm(vec2 p){ return 0.65*n(p) + 0.35*n(p*2.03 + 7.1); }
void main(){
  vec2 uv = vUv; float asp = uRes.x/uRes.y; vec2 p = vec2(uv.x*asp, uv.y);
  float t = uTime; float a = 0.0;
  vec2 c = vec2((uRect.x+uRect.z)*0.5*asp, (uRect.y+uRect.w)*0.5);
  vec2 d = vec2(cos(uAngle), sin(uAngle));
  if (uMode < 0.5) { a = 0.0; }
  else if (uMode < 1.5) { a = fbm(p*uScale*3.0 + vec2(-t*uSpeed*10.0, 0.0)) * (1.0 - smoothstep(0.0, 0.55, uv.y)); }  // туман снизу
  else if (uMode < 2.5) { a = fbm(p*uScale*2.0 + vec2(t*uSpeed*10.0, t*uSpeed*3.0)) * (0.6 + 0.4*uv.y); }              // дымка/дым
  else if (uMode < 3.5) { a = n(vec2(p.x*1.5 - t*uSpeed*10.0, p.y*8.0)) * n(vec2(p.x*0.7 - t*uSpeed*6.0, p.y*3.0)) * 1.6; } // пыль-штрихи
  else if (uMode < 4.5) { float x = dot(p, d) - uBeamPos - t*uSpeed; a = exp(-x*x/(uWidth*uWidth)); }                  // диагональный луч
  else if (uMode < 5.5) { float x = dot(p, d)*6.0; a = pow(0.5+0.5*sin(x + fbm(vec2(x*0.3, t*uSpeed))*3.0 + uBeamPos), 6.0) * smoothstep(0.0, 1.0, uv.y); } // шафты
  else if (uMode < 6.5) { vec2 q = p - vec2(c.x + uBeamPos, c.y); q.y *= 0.6; a = 1.0 - smoothstep(uWidth*0.4, uWidth, length(q)); } // прожектор
  else if (uMode < 7.5) { float x = dot(p, d)*14.0 + uBeamPos; float f = fract(x); a = smoothstep(0.2,0.35,f)*(1.0 - smoothstep(0.6,0.75,f)); } // жалюзи
  else { a = (1.0 - smoothstep(0.0, 0.5, length(p - vec2(asp*0.2 + 0.05*sin(t*0.1), 0.75))))
           + (1.0 - smoothstep(0.0, 0.45, length(p - vec2(asp*0.85, 0.6 + 0.05*sin(t*0.13))))); }                     // пятна фонарей
  if (uClear > 0.001) a *= smoothstep(uClear*0.45, uClear*0.45 + 0.3, length(p - c));
  a = clamp(a*uDensity, 0.0, 1.0);
  gl_FragColor = vec4(mix(uBg, uAtmo, a), 1.0);
}`;
const L2_FS = `precision mediump float;
// L2: НАД барабаном, CSS mix-blend-mode: overlay. 0.5 серого = нейтрально. Чистый чёрный — только через DOM .fx-dim.
uniform vec2  uRes;
uniform float uTime;       // для зерна: JS перестаёт его двигать = «стоп-кадр»
uniform vec3  uTint;  uniform float uTintAmt;
uniform float uGrain, uGrainSize;           // амплитуда, размер зерна в px канваса
uniform float uVig, uVigR;
uniform float uExpo;                        // вспышка/провал экспозиции, -0.3..+0.3
uniform vec4  uRect;                        // постер в GL-uv
uniform vec3  uHaloCol; uniform float uHalo, uHaloR; // ореол вокруг постера, uHaloR в px канваса
uniform vec4  uBeam;                        // x: позиция, y: угол (рад), z: ширина, w: сила
uniform vec3  uBeamCol;
varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float sdBox(vec2 p, vec2 b){ vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
void main(){
  vec2 px = vUv*uRes; float asp = uRes.x/uRes.y;
  vec2 rc = (uRect.xy + uRect.zw)*0.5*uRes; vec2 rb = (uRect.zw - uRect.xy)*0.5*uRes;
  float sd = sdBox(px - rc, rb);
  float inP = 1.0 - smoothstep(-2.0, 2.0, sd);                 // 1 внутри постера
  float tq = floor(uTime*24.0)/24.0;                           // зерно 24 к/с
  float g = (h(floor(px/uGrainSize) + fract(tq*0.618)*731.0) - 0.5) * mix(1.0, 0.5, inP);
  vec2 q = (vUv - 0.5)*vec2(asp, 1.0);
  float v = smoothstep(uVigR - 0.45, uVigR, length(q)) * uVig * (1.0 - inP);
  float halo = exp(-max(sd, 0.0)/uHaloR) * uHalo * (1.0 - 0.5*inP);
  vec2 d = vec2(cos(uBeam.y), sin(uBeam.y));
  float bx = dot(vec2(vUv.x*asp, vUv.y), d) - uBeam.x;
  float beam = exp(-bx*bx/(uBeam.z*uBeam.z)) * uBeam.w;
  vec3 col = vec3(0.5)
           + (uTint - 0.5)*uTintAmt*(1.0 - 0.5*inP)
           - v*0.5
           + g*uGrain
           + halo*(uHaloCol - 0.5)
           + beam*(uBeamCol - 0.5)
           + uExpo;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;
const VS = 'attribute vec2 p; varying vec2 vUv; void main(){ vUv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }';
const L0_U = ['uRes', 'uTime', 'uMode', 'uDensity', 'uSpeed', 'uScale', 'uAngle', 'uWidth', 'uBeamPos', 'uClear', 'uBg', 'uAtmo', 'uRect'];
const L2_U = ['uRes', 'uTime', 'uTint', 'uTintAmt', 'uGrain', 'uGrainSize', 'uVig', 'uVigR', 'uExpo', 'uRect', 'uHaloCol', 'uHalo', 'uHaloR', 'uBeam', 'uBeamCol'];
export const SHADERS = { L0_FS, L2_FS, VS };
function makeGL(canvas, fs, names) {
  const gl = canvas?.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'low-power' });
  if (!gl) return null;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  try {
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    gl.useProgram(pr);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = {}; for (const n of names) U[n] = gl.getUniformLocation(pr, n);
    return { gl, U, canvas };
  } catch (e) { console.warn('fx shader', e); return null; }
}

// ---------- сцена ----------
const NOADAPT = /[?&]noadapt/.test(location.search);
const LOW = matchMedia('(pointer: coarse)').matches || /iP(hone|ad|od)/.test(navigator.userAgent);
const RS0 = LOW ? 0.35 : 0.5, RS2 = 0.5, SLOW_N = LOW ? 20 : 30;
const reel = $('#reel'), strip = $('#strip'), gate = $('#gate');
const cv0 = $('#gl');
const cv2 = document.createElement('canvas'); cv2.id = 'fxo'; cv2.setAttribute('aria-hidden', 'true');
const dim = document.createElement('div'); dim.className = 'fxdim'; dim.innerHTML = '<i class="iris"></i><i class="lb t"></i><i class="lb b"></i>';
reel?.querySelector('.vig')?.before(cv2, dim);
const iris = dim.querySelector('.iris'), lbT = dim.querySelector('.lb.t'), lbB = dim.querySelector('.lb.b');
const G0 = makeGL(cv0, L0_FS, L0_U), G2 = makeGL(cv2, L2_FS, L2_U);
document.body.classList.toggle('nogl', !G0);
document.body.classList.toggle('nofxo', !G2);
// SVG-призрак ленты (комедия: вип-пэн, мелодрама: ступенчатая печать) — только десктоп
if (!LOW) {
  const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  svg.innerHTML = `<defs><filter id="fxG2" x="-3%" y="0" width="106%" height="100%" color-interpolation-filters="sRGB">
    <feOffset in="SourceGraphic" dx="-16" result="b"/><feComponentTransfer in="b" result="b2"><feFuncA type="linear" slope=".12"/></feComponentTransfer>
    <feOffset in="SourceGraphic" dx="-8" result="a"/><feComponentTransfer in="a" result="a2"><feFuncA type="linear" slope=".25"/></feComponentTransfer>
    <feMerge><feMergeNode in="b2"/><feMergeNode in="a2"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="fxG1" x="-3%" y="0" width="106%" height="100%" color-interpolation-filters="sRGB">
    <feOffset in="SourceGraphic" dx="-10" result="a"/><feComponentTransfer in="a" result="a2"><feFuncA type="linear" slope=".3"/></feComponentTransfer>
    <feMerge><feMergeNode in="a2"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
  document.body.prepend(svg);
}

// ---------- состояние ----------
const NONE = { filter: 'none', bg: '#0C0B0A', tint: '#808080', tintAmt: 0, grain: 0, grainSize: 1, vig: 0, vigR: 0.8, halo: { col: '#808080', a: 0, r: 40 }, weave: 0,
  atmo: { mode: 0, col: '#0C0B0A', density: 0, speed: 0, scale: 1, angle: 0, width: 0.2 }, spin: { density: 0, vig: 0, halo: 0, shake: 0, shakeHz: 0, ghost: false, stepFps: 0 },
  wow: { id: 'none', ms: 260, ease: E.out }, result: { scale: 1, ms: 0 } };
let gid = 'none', P = NONE, on = true, still = false, slow = false;
let fromB = null, toB = null, xf0 = -1;            // кроссфейд uniform'ов 600 мс
let ph = 'idle', ph0 = performance.now(), uI = 0.35, uIfrom = 0.35;
let vel = 0, velMax = 1;
let W = null;                                      // активное «вау»: { id, t0, ms, fn, k }
let blinds = 0, lastT = 0, tFrozen = 0, freezeUntil = 0, tOff = 0;
let flickerAt = 0, flickerEnd = 0, lightsAt = 0;
const T0 = performance.now();
const animate = () => on && !still && !reduce.matches && !document.hidden;
const motionOK = () => on && !still && !reduce.matches;

// числовая база пресета (то, что можно смешивать)
function base(p) {
  const a = p.atmo, s = p.spin;
  return { mode: a.mode, dens: a.density, sDens: s.density, speed: a.speed, sSpeed: s.speed ?? a.speed, scale: a.scale, angle: a.angle, width: a.width,
    bg: hex(p.bg), atmo: hex(a.col), tint: hex(p.tint), tintAmt: p.tintAmt, grain: p.grain, gs: p.grainSize, vig: p.vig, sVig: s.vig, vigR: p.vigR,
    haloCol: hex(p.halo.col), haloA: p.halo.a, sHalo: s.halo, haloR: p.halo.r, weave: p.weave || 0 };
}
function mixB(a, b, k) {
  const o = {};
  for (const key in b) o[key] = Array.isArray(b[key]) ? mixV(a[key], b[key], k) : lerp(a[key], b[key], k);
  // режим атмосферы не смешивается: старая гаснет за первую половину, новая проявляется во второй
  o.mode = k < 0.5 ? a.mode : b.mode; o.dens = k < 0.5 ? a.dens * (1 - 2 * k) : b.dens * (2 * k - 1); o.sDens = k < 0.5 ? a.sDens * (1 - 2 * k) : b.sDens * (2 * k - 1);
  if (a.mode !== b.mode) { o.speed = k < 0.5 ? a.speed : b.speed; o.angle = k < 0.5 ? a.angle : b.angle; o.width = k < 0.5 ? a.width : b.width; o.scale = k < 0.5 ? a.scale : b.scale; }
  return o;
}
let cur = base(NONE);

// грейд L1: один и тот же список функций, чтобы CSS-переход 600 мс шёл плавно
function canon(f) {
  const v = { contrast: 1, saturate: 1, brightness: 1, sepia: 0, 'hue-rotate': 0, grayscale: 0 };
  for (const m of String(f || '').matchAll(/([a-z-]+)\(([-\d.]+)/g)) if (m[1] in v) v[m[1]] = +m[2];
  return v;
}
const fstr = (v, k = 1) => `contrast(${lerp(1, v.contrast, k).toFixed(3)}) saturate(${lerp(1, v.saturate, k).toFixed(3)}) brightness(${lerp(1, v.brightness, k).toFixed(3)}) sepia(${(v.sepia * k).toFixed(3)}) hue-rotate(${(v['hue-rotate'] * k).toFixed(1)}deg) grayscale(${(v.grayscale * k).toFixed(3)})`;
let gradeStr = fstr(canon('none')), ghostOn = '';
function applyStripFilter() { if (strip) strip.style.filter = (ghostOn ? `url(#${ghostOn}) ` : '') + gradeStr; }

// геометрия: центральный постер (рамка #gate) в координатах L2 (барабан) и L0 (экран)
let geo = null;
function measure() {
  if (!reel) return;
  const R = reel.getBoundingClientRect(), g = gate?.getBoundingClientRect();
  if (!R.width) return;
  const c = g && g.width ? { l: g.left + 6, t: g.top + 6, w: g.width - 12, h: g.height - 12 } : { l: R.left + R.width / 2 - 80, t: R.top + 40, w: 160, h: 240 };
  geo = { R, c,
    r2: [(c.l - R.left) / R.width, 1 - (c.t - R.top + c.h) / R.height, (c.l - R.left + c.w) / R.width, 1 - (c.t - R.top) / R.height],
    r0: [c.l / innerWidth, 1 - (c.t + c.h) / innerHeight, (c.l + c.w) / innerWidth, 1 - c.t / innerHeight] };
  iris.style.cssText = `left:${c.l - R.left}px;top:${c.t - R.top}px;width:${c.w}px;height:${c.h}px`;
  const w0 = Math.max(1, Math.round(innerWidth * RS0)), h0 = Math.max(1, Math.round(innerHeight * RS0));
  if (G0 && (cv0.width !== w0 || cv0.height !== h0)) { cv0.width = w0; cv0.height = h0; }
  const w2 = Math.max(1, Math.round(R.width * RS2)), h2 = Math.max(1, Math.round(R.height * RS2));
  if (G2 && (cv2.width !== w2 || cv2.height !== h2)) { cv2.width = w2; cv2.height = h2; }
  kick();
}
addEventListener('resize', () => { geo = null; measure(); }, { passive: true });
// барабан снова на экране (вернулись из каталога, закрыли результат) — перемерить и продолжить
if (reel && 'ResizeObserver' in window) new ResizeObserver(() => { geo = null; measure(); }).observe(reel);
addEventListener('scroll', () => { geo = null; }, { passive: true });

// ---------- «вау»: таймлайны по спеке; fn(t мс) → переопределения кадра ----------
// ключи: expo, halo, haloCol, beam[x,a,w,s], beamCol, beam0 (L0 uBeamPos), clear, dens, vig, tintK, grainK, scale, ty, sx, sy, dimA, bars, origin
function posterPt(fracY = 0.5, L = 2) {
  // точка постера в координатах шейдера (x уже умножен на aspect)
  const r = L === 2 ? geo.r2 : geo.r0, asp = L === 2 ? geo.R.width / geo.R.height : innerWidth / innerHeight;
  return [((r[0] + r[2]) / 2) * asp, r[3] - (r[3] - r[1]) * fracY, asp];
}
const along = (pt, ang) => pt[0] * Math.cos(ang) + pt[1] * Math.sin(ang);
const WOWS = {
  eclipse: (t) => ({ dimA: t < 120 ? eFall(t / 120) : seg(t, 380, 880, 1, 0.6, eOut), expo: t < 120 ? 0 : seg(t, 380, 880, -0.3, 0, eOut), vig: 0.6 }),
  rackFocus: () => ({}), // соседей размывает CSS-класс .rack, центр — WAAPI (см. cardFx)
  hazeBreak: (t) => ({ clear: seg(t, 0, 750, 0, 1, eOut), halo: t < 400 ? seg(t, 0, 400, 0.05, 0.35, eOut) : seg(t, 400, 750, 0.35, 0.2, eOut) }),
  punch: (t) => ({ scale: t < 90 ? lerp(1, 1.06, ePunch(t / 90)) : seg(t, 90, 490, 1.06, 1.02, eSettle), expo: seg(t, 0, 60, 0.18, 0),
    shakeX: 8 * Math.exp(-t / 90) * Math.sin(t / 14), shakeY: 5 * Math.exp(-t / 90) * Math.cos(t / 17), dens: t < 200 ? seg(t, 0, 200, 0.22, 0.35) : seg(t, 200, 600, 0.35, 0.12) }),
  goldenHour: (t) => { const k = eInOut(clamp(t / 900)); return { beam0: lerp(-0.6, 0.6, k), beamRel: true, beam: [lerp(-0.6, 0.6, k), P.atmo.angle, 0.18, 0.12], beamRel2: true, beamCol: hex('#E9B97A'), halo: t < 450 ? seg(t, 0, 450, 0.12, 0.3, eInOut) : seg(t, 450, 900, 0.3, 0.18, eInOut) }; },
  snapZoom: (t) => ({ scale: t < 100 ? 1 : t < 220 ? lerp(1, 1.06, ease('cubic-bezier(.2,.8,.2,1)')((t - 100) / 120)) : t < 620 ? 1.06 : seg(t, 620, 820, 1.06, 1.03, eEaseOut) }),
  headlights: (t) => ({ beam: [seg(t, 0, 450, -0.4, 1.4, eInOut), 0, 0.3, t < 450 ? 0.3 * Math.sin(Math.PI * t / 450) : 0], beamRelX: true, beamCol: hex('#FFD9A0'), halo: t < 450 ? seg(t, 0, 450, 0.06, 0.25, eInOut) : seg(t, 450, 700, 0.25, 0.18, eInOut) }),
  stepPrint: (t) => ({ halo: t < 300 ? seg(t, 0, 300, 0.1, 0.35, eOut) : seg(t, 300, 800, 0.35, 0.22, eOut) }),
  shafts: (t) => ({ shaftK: eOut(clamp(t / 900)), dens: seg(t, 0, 900, 0.14, 0.35, ease('cubic-bezier(.33,1,.68,1)')), halo: seg(t, 0, 900, 0.08, 0.25, ease('cubic-bezier(.33,1,.68,1)')) }),
  dollyIn: (t) => { const e = ease('cubic-bezier(.33,0,.15,1)'); return { scale: seg(t, 0, 900, 1.02, 1.05, e), ty: -6, dens: seg(t, 0, 900, 0.1, 0.3, e), halo: seg(t, 0, 900, 0.06, 0.2, e) }; },
  leone: (t) => ({ bars: seg(t, 0, 350, 0, 1, eInOut), scale: seg(t, 350, 850, 1, 1.08, eInOut), origin: '50% 35%' }),
  concussion: (t) => ({ expo: t < 70 ? seg(t, 0, 70, 0, -0.25) : seg(t, 70, 500, -0.25, 0, eSettle), shakeX: 6 * Math.exp(-t / 150) * Math.sin(t / 11), shakeY: 6 * Math.exp(-t / 150) * Math.cos(t / 13),
    dens: seg(t, 0, 800, 0.28, 0.4), tintK: t < 300 ? seg(t, 0, 300, 1, 0) : seg(t, 300, 800, 0, 1, eSettle), grainK: t < 300 ? seg(t, 0, 300, 1, 0) : seg(t, 300, 800, 0, 1, eSettle) }),
  kubrickZoomOut: (t) => { const e = ease('cubic-bezier(.25,.1,.25,1)'); return { scale: seg(t, 0, 1000, 1.1, 1, e), halo: seg(t, 0, 1000, 0.15, 0.3, e), candle: seg(t, 0, 1000, 0.03, 0.05) }; },
  freeze: (t) => ({ expo: seg(t, 0, 40, 0.08, 0) * (t < 40 ? 1 : 0) + (t < 40 ? 0 : seg(t, 40, 300, 0.04, 0)), freeze: t < 300 }),
  squash: () => ({}),   // деформация постера — WAAPI на карточке
  backlight: (t) => { const e = ease('cubic-bezier(.5,1,.89,1)'), k = e(clamp(t / 800)); return { halo: lerp(0.05, 0.4, k), haloCol: mixV(hex('#9FC4FF'), hex('#FFD08A'), k), haloR: 70 }; },
  spotlight: (t) => ({ dimA: t < 150 ? seg(t, 0, 150, 0, 0.85) : t < 470 ? 0.85 : seg(t, 470, 870, 0.85, 0.4, eOut), spot0: 1, halo: 0.2 }),
  blinds: (t) => ({ beam: [0, P.atmo.angle, 0.06, seg(t, 0, 700, 0, 0.25, ease('cubic-bezier(.65,0,.35,1)'))], blindsBeam: true, beamCol: hex('#FFFFFF') }),
  lampOn: (t) => ({ expo: t < 150 ? seg(t, 0, 150, 0, 0.1) : seg(t, 150, 750, 0.1, 0.03, eSettle), halo: t < 300 ? seg(t, 0, 300, 0.12, 0.3, eSettle) : seg(t, 300, 750, 0.3, 0.18, eSettle) }),
};
// эффекты на самой карточке (не на слоях): WAAPI по отдельным свойствам scale/translate, чтобы не спорить с transform барабана
function cardFx(id, card, k) {
  if (!card) return;
  const ms = k ? 0 : 1;
  if (id === 'rackFocus') {
    reel.classList.add('rack');
    if (ms) card.animate([{ filter: 'blur(4px)', scale: '1.012' }, { filter: 'blur(0px)', scale: '1' }], { duration: 380, easing: 'cubic-bezier(.25,1,.5,1)' });
  } else if (id === 'squash' && ms) {
    const f = []; for (let i = 0; i <= 12; i++) { const t = i / 12 * 0.5, x = spring(t); f.push({ offset: 0.14 + 0.86 * (i / 12), scale: `${(1 + 0.04 * x).toFixed(4)} ${(1 - 0.06 * x).toFixed(4)}` }); }
    card.animate([{ scale: '1 1', offset: 0 }, ...f], { duration: 580, easing: 'linear' });
  } else if (id === 'backlight' && ms) {
    card.animate([{ translate: '0 6px' }, { translate: '0 0' }], { duration: 800, easing: 'cubic-bezier(.5,1,.89,1)' });
  } else if (id === 'lampOn' && ms) {
    card.animate([{ scale: '1' }, { scale: '1.02', offset: 0.3 }, { scale: '1.01' }], { duration: 750, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards' });
  }
}

// ---------- кадр ----------
let raf = 0, last = 0, slowN = 0, fastN = 0, thr = false, idleT = 0;
function frame(now) {
  raf = 0;
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
  // сторож: N кадров подряд дольше 36 мс — гасим атмосферу L0 (грейд и зерно остаются); кадры после нашей паузы 30 к/с не считаем
  const wasThr = thr; thr = false;
  if (animate() && !NOADAPT && !wasThr) {
    if (dt > 0.036) { fastN = 0; if (++slowN >= SLOW_N && !slow) slow = true; }
    else { slowN = 0; if (dt < 0.024 && slow && ++fastN > 180) { slow = false; fastN = 0; } }
  }
  if (!geo) measure();
  if (!geo) return; // барабана нет на экране (другой раздел): ждём kick() от resize/phase
  // время шейдеров: стоп-кадр документалки замораживает его
  const live = animate();
  let tt = (now - T0) / 1000 - tOff;
  if (!live) tt = tFrozen; else if (now < freezeUntil) { tOff += dt; tt = tFrozen; } else tFrozen = tt;
  // кроссфейд жанра
  if (xf0 >= 0) { const k = !motionOK() ? 1 : eInOut(clamp((now - xf0) / 600)); cur = mixB(fromB, toB, k); if (k >= 1) xf0 = -1; }
  const B = cur;
  // интенсивность фазы
  const tgt = { idle: 0.35, spin: 1, land: 1, result: 0.5 }[ph] ?? 0.35;
  uI = ph === 'spin' && motionOK() ? lerp(uIfrom, 1, eRamp(clamp((now - ph0) / 400))) : motionOK() ? lerp(uI, tgt, Math.min(1, dt * 6)) : tgt;
  const sp = P.spin, inSpin = ph === 'spin';
  let dens = phaseVal(B.dens, B.sDens, uI), vig = phaseVal(B.vig, B.sVig, uI), halo = phaseVal(B.haloA, B.sHalo, uI), speed = phaseVal(B.speed, B.sSpeed, uI);
  let expo = 0, beam = [0, 0, 0.2, 0], beamCol = [0.5, 0.5, 0.5], beam0 = 0, clearV = 0, haloCol = B.haloCol, haloR = B.haloR, tintK = 1, grainK = 1;
  let scale = 1, tx = 0, ty = 0, dimA = 0, bars = 0, origin = '50% 50%', candleA = 0;
  const t = tt, vn = clamp(vel / velMax);
  // ---- поведение жанра по фазам (спека: idle/spin) ----
  const g = gid;
  if (live) {
    if (g === 'horror') {
      if (ph === 'idle') vig += 0.05 * Math.sin(t * Math.PI * 2 / 6);
      if (inSpin) { // мерцание практического света: 2–3 провала −.12 по 80 мс, не ритмично
        if (now > flickerAt) { flickerAt = now + 500 + Math.random() * 1400; flickerEnd = now + 80; }
        if (now < flickerEnd) expo -= 0.12;
      }
    } else if (g === 'thriller' && ph === 'idle') scale = 1 + 0.015 * clamp((now - ph0) / 20000);
    else if (g === 'scifi' && ph !== 'spin') expo += 0.015 * Math.sin(t * Math.PI);           // гул 0.5 Гц ±3%
    else if (g === 'action' && inSpin) { const a = 3 * vn, f = 3 * Math.PI * 2; tx += a * Math.sin(t * f); ty += a * 0.6 * Math.sin(t * f * 1.3 + 1); }
    else if (g === 'crime' && inSpin) { // «фары» каждые 600 мс за 250 мс
      const u = ((now - ph0) % 600) / 250;
      if (u < 1) { beam = [lerp(-0.3, geo.R.width / geo.R.height + 0.3, u), 0, 0.12, 0.15 * Math.sin(Math.PI * u)]; beamCol = hex('#FFD9A0'); }
    } else if (g === 'fantasy' && inSpin) dens += 0.04 * Math.sin(t * 7.1) * Math.sin(t * 2.3);   // ветер в листве
    else if (g === 'adventure' && inSpin) { const k = clamp((now - ph0) / 1500); ty = -6 * eInOut(k); scale = 1 + 0.02 * eInOut(k); }
    else if (g === 'war' && inSpin) { tx += 1.5 * Math.sin(t * 6 * Math.PI * 2); ty += 1.5 * Math.cos(t * 6 * Math.PI * 2 * 0.9); }
    else if (g === 'history') { candleA = 0.03; if (inSpin && velMax > 1 && vel < velMax * 0.45) scale = lerp(1.1, 1, clamp(vel / (velMax * 0.45))); }
    else if (g === 'documentary') { tx += 0.8 * Math.sin(t * 0.7 * Math.PI * 2); ty += 0.5 * Math.sin(t * 0.7 * Math.PI * 2 * 1.3 + 2); }
    else if (g === 'musical') beam0 = (inSpin ? 0.25 : 0.06) * (geo.R.width ? innerWidth / innerHeight : 1) * Math.sin(t * Math.PI * 2 / (inSpin ? 1.2 : 9));
    else if (g === 'noir' && inSpin) blinds += 0.3 * dt;
    if (g === 'noir') beam0 = blinds;
  }
  // ---- «вау» ----
  if (W) {
    const el = now - W.t0;
    // reduced/эффекты выкл: финальное состояние кроссфейдом за 300 мс
    const o = W.fn(motionOK() ? Math.min(el, W.ms) : W.ms) || {};
    const k = motionOK() ? 1 : eEaseOut(clamp(el / 300));
    const L = (a, b) => (b == null ? a : lerp(a, b, k));
    expo = L(expo, o.expo); halo = L(halo, o.halo); dens = L(dens, o.dens); vig = L(vig, o.vig);
    if (o.haloCol) haloCol = mixV(haloCol, o.haloCol, k); if (o.haloR) haloR = o.haloR;
    if (o.clear != null) clearV = o.clear * k;
    if (o.scale != null) scale = L(scale, o.scale); if (o.ty != null) ty = L(ty, o.ty);
    if (motionOK()) { tx += o.shakeX || 0; ty += o.shakeY || 0; }
    if (o.dimA != null) dimA = o.dimA * k; if (o.bars != null) bars = o.bars * k; if (o.origin) origin = o.origin;
    if (o.tintK != null) tintK = o.tintK; if (o.grainK != null) grainK = o.grainK; if (o.candle != null) candleA = o.candle;
    const c2 = posterPt(0.5, 2), c0 = posterPt(0.5, 0);
    if (o.beam) {
      beam = o.beam.slice(); beamCol = o.beamCol || beamCol;
      if (o.beamRel2) beam[0] = along(c2, beam[1]) + o.beam[0];
      if (o.blindsBeam) beam[0] = along(posterPt(1 / 3, 2), beam[1]);
      beam[3] *= k;
    }
    if (o.beamRel) beam0 = along(c0, P.atmo.angle) - t * speed + o.beam0;
    if (o.shaftK != null) { const tg = Math.PI / 2 - along(c0, P.atmo.angle) * 6; beam0 = lerp(0, tg, o.shaftK * k); }
    if (o.spot0) beam0 = lerp(beam0, 0, k);
    if (o.freeze && motionOK() && now >= freezeUntil) { freezeUntil = W.t0 + 300; tFrozen = tt; }
  }
  // результат: реакция жанра в покое (луч драмы на постере, тёплый ореол аниме и т. п. — значения из «вау» держатся)
  // свечное мерцание: ±3% экспозиции, шум 8 Гц со сглаживанием
  if (candleA && live) expo += candleA * (0.6 * Math.sin(t * 8 * 6.283) * 0.5 + 0.5 * Math.sin(t * 5.3 * 6.283 + 1.7) * Math.sin(t * 2.1));
  if (slow) dens = 0;
  // ---- камера L1 (дрожание кадра 24 шага в секунду) ----
  if (live && B.weave) { const q = Math.floor(t * 24) / 24, a = B.weave / 0.55; tx += a * (0.35 * Math.sin(q * 1.7) + 0.2 * Math.sin(q * 4.3)); ty += a * 0.25 * Math.sin(q * 2.3); }
  const tr = scale !== 1 || tx || ty ? `translate(${tx.toFixed(2)}px,${ty.toFixed(2)}px) scale(${scale.toFixed(4)})` : '';
  if (strip && strip.style.transform !== tr) { strip.style.transform = tr; strip.style.transformOrigin = origin; }
  // ---- чёрный слой ----
  setStyle(iris, 'opacity', dimA ? dimA.toFixed(3) : '0');
  if (bars !== lastBars) { lastBars = bars; const H = geo.R.height, bh = Math.max(0, (H - geo.R.width / 2.39) / 2); const s = (bh * bars / (H / 2)).toFixed(4); lbT.style.transform = `scaleY(${s})`; lbB.style.transform = `scaleY(${s})`; }
  // ---- L0 ----
  if (G0) {
    const { gl, U } = G0; gl.viewport(0, 0, cv0.width, cv0.height);
    gl.uniform2f(U.uRes, cv0.width, cv0.height); gl.uniform1f(U.uTime, t); gl.uniform1f(U.uMode, B.mode); gl.uniform1f(U.uDensity, Math.max(0, dens));
    gl.uniform1f(U.uSpeed, speed); gl.uniform1f(U.uScale, B.scale); gl.uniform1f(U.uAngle, B.angle); gl.uniform1f(U.uWidth, B.width);
    gl.uniform1f(U.uBeamPos, beam0); gl.uniform1f(U.uClear, clearV); gl.uniform3fv(U.uBg, B.bg); gl.uniform3fv(U.uAtmo, B.atmo); gl.uniform4fv(U.uRect, geo.r0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  // ---- L2 (только пока барабан на экране и жанр выбран) ----
  const l2on = G2 && gid !== 'none' && ph !== 'result';
  cv2.style.visibility = l2on ? '' : 'hidden';
  if (l2on) {
    const { gl, U } = G2; gl.viewport(0, 0, cv2.width, cv2.height);
    gl.uniform2f(U.uRes, cv2.width, cv2.height); gl.uniform1f(U.uTime, live ? t : 0.5);
    gl.uniform3fv(U.uTint, B.tint); gl.uniform1f(U.uTintAmt, B.tintAmt * tintK); gl.uniform1f(U.uGrain, B.grain * grainK); gl.uniform1f(U.uGrainSize, Math.max(1, B.gs * RS2 * (LOW ? 1.5 : 1)));
    gl.uniform1f(U.uVig, clamp(vig)); gl.uniform1f(U.uVigR, B.vigR); gl.uniform1f(U.uExpo, expo); gl.uniform4fv(U.uRect, geo.r2);
    gl.uniform3fv(U.uHaloCol, haloCol); gl.uniform1f(U.uHalo, Math.max(0, halo)); gl.uniform1f(U.uHaloR, Math.max(4, haloR * RS2));
    gl.uniform4f(U.uBeam, beam[0], beam[1], Math.max(0.01, beam[2]), beam[3]); gl.uniform3fv(U.uBeamCol, beamCol);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  // ---- следующий кадр: прокрутка/остановка/«вау» — 60 к/с, покой и результат — 30 к/с, статика — ни одного ----
  const busy = xf0 >= 0 || ph === 'spin' || ph === 'land' || (W && now - W.t0 < W.ms + 320) || Math.abs(uI - tgt) > 0.003 || now < freezeUntil;
  const moving = live && (gid !== 'none' || B.mode > 0);
  if (busy) raf = requestAnimationFrame(frame);
  else if (moving) { raf = -1; idleT = setTimeout(() => { thr = true; raf = requestAnimationFrame(frame); }, 1000 / 30 - 3); }
}
let lastBars = -1;
const styleCache = new WeakMap();
function setStyle(el, k, v) { let m = styleCache.get(el); if (!m) styleCache.set(el, (m = {})); if (m[k] !== v) { m[k] = v; el.style[k] = v; } }
function kick() {
  if (raf === -1) { clearTimeout(idleT); raf = 0; }
  if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
reduce.addEventListener?.('change', () => { document.body.classList.toggle('fx-still', !motionOK()); kick(); });

// ---------- API для приложения ----------
// жанр эффекта: id или список выбранных (первый — главный, второй даёт тинт 25% и атмосферу)
let lastKey = 'none';
export function setGenre(ids) {
  const list = [].concat(ids || []).map(presetId).filter(Boolean);
  const uniq = [...new Set(list)].slice(0, 2);
  const key = uniq.join('+') || 'none';
  if (key === lastKey) return;
  lastKey = key;
  const np = uniq.length ? resolvePreset(uniq) : NONE;
  // несовместимая пара сводится к одному жанру — узнаём, к какому
  const main = uniq.length ? uniq.find((x) => GENRES[x].ref === np.ref) || uniq[0] : 'none';
  document.body.dataset.fx = main;
  gid = main; P = np;
  fromB = { ...cur }; toB = base(np); xf0 = performance.now();
  gradeStr = fstr(canon(np.filter)); applyStripFilter();
  // постер результата: грейд на 35%, чтобы афиша оставалась читаемой
  root.style.setProperty('--pF', np === NONE ? 'none' : fstr(canon(np.filter), 0.35));
  root.style.setProperty('--vig', np === NONE ? '.3' : '0');
  kick();
}
export function phase(p) {
  if (p === ph) return;
  const prev = ph; ph = p; ph0 = performance.now(); uIfrom = uI;
  if (p === 'spin' || p === 'idle') {
    W = null; reel?.classList.remove('rack'); velMax = 1;
    reel?.querySelectorAll('.card').forEach((c) => c.getAnimations().forEach((a) => a.cancel()));
    lastBars = -1;
  }
  // призрак ленты: комедия — 300 мс на пике скорости, мелодрама — вся прокрутка (только десктоп)
  ghostOn = ''; if (p === 'spin' && !LOW && motionOK() && P.spin.ghost) ghostOn = gid === 'comedy' ? '' : 'fxG1';
  applyStripFilter();
  if (p === 'result') resultFx();
  if (prev === 'result') { const im = $('#rposter img'); im?.getAnimations().forEach((a) => a.cancel()); }
  kick();
}
function resultFx() {
  const im = $('#rposter img'); if (!im) return;
  const s = Math.min(1.03, P.result?.scale || 1), ms = P.result?.ms || 0;
  if (s <= 1) return;
  if (!motionOK() || !ms) im.animate([{ scale: String(s) }, { scale: String(s) }], { duration: 1, fill: 'forwards' });
  else im.animate([{ scale: '1' }, { scale: String(s) }], { duration: ms, easing: 'linear', fill: 'forwards' });
}
export function setMotion(v) { on = !!v; still = !on; document.body.classList.toggle('fx-still', !motionOK()); kick(); }
// скорость барабана (px/s): тряска боевика, зум Кубрика на торможении, пик для вип-пэна комедии
let whipT = 0;
export function onReel(v) {
  vel = Math.abs(v); if (vel > velMax) velMax = vel;
  if (gid === 'comedy' && ph === 'spin' && !LOW && motionOK() && P.spin.ghost) {
    const peak = vel > velMax * 0.97 && velMax > 600;
    if (peak && !whipT) { whipT = performance.now(); ghostOn = 'fxG2'; applyStripFilter(); }
    if (whipT && performance.now() - whipT > 300 && ghostOn) { ghostOn = ''; applyStripFilter(); }
  }
  if (ph === 'spin') kick();
}
// как барабан ходит у жанра: fps — ступенчатая печать (мелодрама 12, военный 24), land — кривая торможения
export function plan() {
  whipT = 0;
  if (!motionOK() || slow) return { fps: 0, land: 'normal' };
  return { fps: P.spin.stepFps || 0, land: gid === 'thriller' ? 'hard' : gid === 'comedy' ? 'mech' : 'normal' };
}
export const genreNow = () => gid;
// «вау» на остановке: возвращает, сколько ждать до раскрытия результата
export function wow(card) {
  if (gid === 'none' || P === NONE) { W = null; return 260; }
  if (ghostOn) { ghostOn = ''; applyStripFilter(); }
  const id = P.wow.id, ms = P.wow.ms, fn = WOWS[id] || (() => ({}));
  measure();
  W = { id, ms, fn, t0: performance.now() };
  cardFx(id, card, !motionOK());
  kick();
  return motionOK() ? ms : 300;
}
export function glInfo() { return { ok: !!G0, l2: !!G2, w: cv0?.width, h: cv0?.height, w2: cv2.width, h2: cv2.height, gid, sig: gid === 'none' ? 0 : 1, amt: uI, ph, slow, wow: W?.id || null, low: LOW }; }
measure();
setMotion(true);

export { ease };
