// Жанровые эффекты: работа колориста, а не шейдер-демка.
// У жанра ровно 4 слоя: грейд (тень/свет/насыщенность), зерно 24 к/с, виньетка и одна «подпись» — движение камеры, света или монтажа.
// Плюс «вау» на остановке барабана (≤900ms, у вестерна — шторки по спеке). Фон — один fragment-pass в 0.5×, карточки — SVG feColorMatrix.
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const root = document.documentElement;
const $ = (s) => document.querySelector(s);

// sig: номер подписи в шейдере; gs: размер зерна; vig: виньетка; hold: сколько ждать «вау» до раскрытия результата
export const GEN = {
  none:        { sh: '#0C0B0A', hi: '#F1EBE2', sat: 1.0,  gr: 0.03,  gs: 1,   vig: 0.3,  sig: 0,  hold: 260 },
  horror:      { sh: '#0B1410', hi: '#B8C4B0', sat: 0.6,  gr: 0.06,  gs: 1.6, vig: 0.45, sig: 1,  hold: 520 },
  thriller:    { sh: '#0E1312', hi: '#D9CFA3', sat: 0.55, gr: 0.035, gs: 0.8, vig: 0.4,  sig: 2,  hold: 260 },
  scifi:       { sh: '#0A0B10', hi: '#FFB36B', sat: 0.8,  gr: 0.025, gs: 1,   vig: 0.35, sig: 3,  hold: 480 },
  action:      { sh: '#06202A', hi: '#FFB25E', sat: 1.15, gr: 0.05,  gs: 1.2, vig: 0.35, sig: 4,  hold: 160, s: 1 },
  crime:       { sh: '#07100F', hi: '#E8A04B', sat: 0.65, gr: 0.045, gs: 0.9, vig: 0.4,  sig: 5,  hold: 480, shadowGrain: 1.5 },
  romance:     { sh: '#1A0708', hi: '#F0C7A0', sat: 0.9,  gr: 0.04,  gs: 1.2, vig: 0.35, sig: 6,  hold: 320 },
  fantasy:     { sh: '#0F1408', hi: '#E9D48C', sat: 0.85, gr: 0.03,  gs: 1,   vig: 0.3,  sig: 7,  hold: 520 },
  adventure:   { sh: '#1A1008', hi: '#FFD08A', sat: 1.05, gr: 0.05,  gs: 1.3, vig: 0.35, sig: 8,  hold: 820 },
  mystery:     { sh: '#12060A', hi: '#E6C9A8', sat: 0.8,  gr: 0.04,  gs: 1,   vig: 0.4,  sig: 9,  hold: 520 },
  western:     { sh: '#1A0F06', hi: '#F4D29A', sat: 0.6,  gr: 0.07,  gs: 1.5, vig: 0.4,  sig: 10, hold: 440 },
  war:         { sh: '#10120E', hi: '#D6D3C4', sat: 0.3,  gr: 0.06,  gs: 1.4, vig: 0.4,  sig: 11, hold: 300 },
  anime:       { sh: '#0B1A3A', hi: '#FFE6C8', sat: 1.2,  gr: 0.02,  gs: 0.8, vig: 0.25, sig: 12, hold: 520 },
  animation:   { sh: '#14182A', hi: '#FFF0D8', sat: 1.15, gr: 0.015, gs: 0.8, vig: 0.25, sig: 13, hold: 460 },
  music:       { sh: '#140A2A', hi: '#FFD8A8', sat: 1.1,  gr: 0.04,  gs: 1,   vig: 0.4,  sig: 14, hold: 660 },
  documentary: { sh: '#0F0F0E', hi: '#ECE6DA', sat: 0.75, gr: 0.055, gs: 1.3, vig: 0.3,  sig: 15, hold: 620 },
  comedy:      { sh: '#1E1412', hi: '#FFE4C4', sat: 1.12, gr: 0.03,  gs: 1,   vig: 0.25, sig: 16, hold: 300 },
  family:      { sh: '#0C1226', hi: '#FFE0A8', sat: 0.95, gr: 0.04,  gs: 1,   vig: 0.3,  sig: 17, hold: 520 },
  drama:       { sh: '#0E1013', hi: '#E8DFD0', sat: 0.8,  gr: 0.045, gs: 1.1, vig: 0.35, sig: 18, hold: 640 },
};
// по визуальной узнаваемости: играет один
export const PRIORITY = ['horror', 'western', 'war', 'scifi', 'anime', 'animation', 'romance', 'music', 'mystery', 'crime', 'thriller', 'action', 'fantasy', 'adventure', 'documentary', 'comedy', 'family', 'drama'];
export const top1 = (ids) => PRIORITY.find((g) => ids.includes(g)) || 'none';

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const eio = (u) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);
const eoc = (u) => 1 - (1 - u) ** 3;

// ---------- состояние ----------
let gid = 'none', on = true, still = false, slow = false;
const cur = { sh: hex(GEN.none.sh), hi: hex(GEN.none.hi), sat: 1, gr: 0.03, gs: 1, vig: 0.3 };
let from = { ...cur }, to = { ...cur }, xf0 = -1;           // кроссфейд грейда 600ms
let sig = 0, sigA = 0, sigNext = 0, sigT0 = 0;               // подпись: гаснет 200ms, проявляется 400ms
let ph = 'idle', amt = 0.35, land0 = 0;                      // фазы
let tSig = 0, wowK = 0, deSat = 0, focusC = 0;               // время подписи (замирает на результате), «вау» в шейдере
let vel = 0, whip = 0;
const T0 = performance.now();
const NOADAPT = /[?&]noadapt/.test(location.search);
// телефоны (в том числе встроенный браузер Telegram на iOS): фон в 0.35×, быстрее деградация, карточки без SVG-фильтров
const LOW = matchMedia('(pointer: coarse)').matches || /iP(hone|ad|od)/.test(navigator.userAgent);
const RS = LOW ? 0.35 : 0.5, SLOW_N = LOW ? 10 : 30;

// ---------- SVG-фильтры карточек ----------
const NS = 'http://www.w3.org/2000/svg';
const svg = document.createElementNS(NS, 'svg');
svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
svg.innerHTML = `<defs>
  <filter id="gS" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB"><feGaussianBlur id="gSb" stdDeviation="0"/><feColorMatrix id="gSm" type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0"/></filter>
  <filter id="gC" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB"><feGaussianBlur id="gCb" stdDeviation="0"/><feColorMatrix id="gCm" type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0"/></filter>
  <filter id="gM" x="-20%" y="-5%" width="140%" height="110%" color-interpolation-filters="sRGB"><feGaussianBlur id="gMb" in="SourceGraphic" stdDeviation="0 0" result="b"/><feOffset id="gMo" in="b" dx="0" result="o"/><feComponentTransfer in="o" result="g"><feFuncA id="gMa" type="linear" slope="0"/></feComponentTransfer><feMerge><feMergeNode in="g"/><feMergeNode in="b"/></feMerge></filter>
</defs>`;
document.body.prepend(svg);
const el = (id) => svg.querySelector('#' + id);
const F = { sm: el('gSm'), sb: el('gSb'), cm: el('gCm'), cb: el('gCb'), mb: el('gMb'), mo: el('gMo'), ma: el('gMa') };
const lastAttr = new Map();
const setA = (node, k, v) => { const key = node.id + k; if (lastAttr.get(key) !== v) { lastAttr.set(key, v); node.setAttribute(k, v); } };
// грейд одной матрицей: (1-k)·sat(c) + k·mix(sh, hi, luma(c))
function matrix(k, s) {
  const w = [0.2126, 0.7152, 0.0722], o = [];
  for (let i = 0; i < 3; i++) {
    const row = [];
    for (let j = 0; j < 3; j++) { const S = (1 - s) * w[j] + (i === j ? s : 0); row.push((1 - k) * S + k * (cur.hi[i] - cur.sh[i]) * w[j]); }
    o.push(...row.map((x) => x.toFixed(4)), '0', (k * cur.sh[i]).toFixed(4));
  }
  return o.join(' ') + ' 0 0 0 1 0';
}

// ---------- зерно: 8 кадров 128², листаются 24 раза в секунду ----------
{
  const c = document.createElement('canvas'); c.width = 128; c.height = 128 * 8;
  const x = c.getContext('2d'), im = x.createImageData(128, 1024);
  for (let i = 0; i < im.data.length; i += 4) { const v = 128 + (Math.random() + Math.random() + Math.random() - 1.5) * 120; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
  x.putImageData(im, 0, 0);
  c.toBlob((b) => { if (b) root.style.setProperty('--grain', `url("${URL.createObjectURL(b)}")`); });
}

// ---------- фон: один полноэкранный проход в 0.5× ----------
const cv = $('#gl');
let gl = null, U = {}, glOk = false;
const FS = `precision mediump float;
uniform vec2 uRes; uniform vec2 uC; uniform float uT, uTs, uAmt, uGr, uGs, uVig, uSigA, uWow, uFr, uShG;
uniform vec3 uSh, uHi; uniform float uSig;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + 1.), f.x), f.y); }
float fbm(vec2 p){ return n(p) * .65 + n(p * 2.03 + 7.1) * .35; }
bool S(float k){ return abs(uSig - k) < .5; }
void main(){
  vec2 uv = gl_FragCoord.xy / uRes; float asp = uRes.x / uRes.y;
  vec2 q = (uv - .5) * vec2(asp, 1.); vec2 qc = (uv - uC) * vec2(asp, 1.);
  float t = uTs, L = .03; vec3 add = vec3(0.);
  if (S(1.)) { L += .09 * exp(-length((q - vec2(0., .62)) * vec2(.55, 1.7)) * 2.2) * (.8 + .2 * fbm(q * 2. + t * .03)); }
  else if (S(2.)) { L += .07 * fbm(q * 1.6 + vec2(t * .012, 0.)) + .03 * exp(-length(q - vec2(.5, .4)) * 2.); }
  else if (S(3.)) { float f = fbm(q * 1.8 + vec2(0., -t * .01 * 6.)); L += .03 + .07 * (f - .5) * 2. * smoothstep(.0, .5, f); L += .04 * smoothstep(.2, .7, 1. - uv.y); }
  else if (S(4.)) { L += .1 * smoothstep(.75, .0, uv.y) * (.85 + .15 * fbm(q * 3.)); }
  else if (S(5.)) { L += .035; float ph = mod(t, 6.) / 1.8; if (ph < 1.) { float x = mix(-.5, 1.5, ph); add += vec3(.95, .77, .54) * .1 * uSigA * exp(-pow((uv.x - x) / .22, 2.)) * exp(-pow((uv.y - .48) / .15, 2.)); } }
  else if (S(6.)) { L += .09 * exp(-length(qc * vec2(.7, 1.)) * 1.6); }
  else if (S(7.)) { vec2 p = uv - vec2(-.08, 1.12); p.x *= asp; float a = atan(p.y, p.x) + .035 * sin(t * 6.2832 / 12.);
    float r = pow(.5 + .5 * sin(a * 11. + 1.3 * fbm(vec2(a * 4., t * .04))), 5.) * smoothstep(1.9, .15, length(p));
    L += (.12 + .18 * uWow) * r; }
  else if (S(8.)) { float f = fbm(q * 2.2); float line = smoothstep(.06, 0., abs(fract(f * 7.) - .5) - .44); L += .02 + .02 * (n(q * 60.) - .5) + .035 * line + .015 * fbm(q * 9.); }
  else if (S(9.)) { L += .07 * exp(-length(qc) * 1.3) + .02 * fbm(q * 2.); }
  else if (S(10.)) { vec2 p = uv; float b = smoothstep(.2, .0, uv.y); p.x += b * sin(uv.y * 90. + t * 6.2832 * .4) * 1.5 / uRes.x * 2.;
    L += .1 * smoothstep(.4, .0, p.y) * (.6 + .6 * fbm(vec2(p.x * 9. * asp, p.y * 40.))); }
  else if (S(11.)) { L += .06 + .05 * fbm(q * 1.2 + vec2(t * .005, 0.)); }
  else if (S(12.)) { add += mix(vec3(.25, .13, .09), vec3(.03, .06, .17), smoothstep(.1, .95, uv.y)) * .38 * uSigA;
    add += vec3(.2, .17, .15) * .12 * uSigA * smoothstep(.55, .8, fbm(vec2(q.x * 1.4 + t * .02, q.y * 3.))) * smoothstep(.35, .8, uv.y); }
  else if (S(13.)) { L += .08 * exp(-length(qc * vec2(.6, 1.)) * 1.2) + .03 * uv.y; }
  else if (S(14.)) { vec2 c = vec2(sin(t * .15) * .45, .08 + .06 * sin(t * .23)); float sp = smoothstep(.5, .0, length((q - c) * vec2(1., 1.35)));
    float beam = smoothstep(.16, .0, abs(q.x - c.x * (1. - (uv.y - .5)))) * smoothstep(.3, 1., uv.y); L += .16 * sp + .03 * beam; }
  else if (S(15.)) { L += .05 * fbm(q * 1.4 + vec2(t * .01, 0.)) + .02; }
  else if (S(16.)) { L += .06 + .04 * smoothstep(.05, .5, abs(q.x)); add += vec3(.1, .05, .06) * .25 * uSigA * smoothstep(.5, 1., uv.y) + vec3(.09, .08, .03) * .25 * uSigA * smoothstep(.5, 0., uv.y); }
  else if (S(17.)) { L += (.16 + .22 * uWow) * exp(-length(qc * vec2(.9, .75)) * 2.1) * (.9 + .1 * sin(t * 1.3)); }
  else if (S(18.)) { vec2 p = q - vec2(-.42 + .06 * sin(t * .05), .12); p = mat2(.93, -.36, .36, .93) * p;
    float w = smoothstep(.0, .09, .3 - abs(p.x)) * smoothstep(.0, .09, .24 - abs(p.y));
    w *= 1. - .7 * smoothstep(.014, .0, abs(p.x)) - .7 * smoothstep(.014, .0, abs(p.y)); L += .13 * w * (.65 + .35 * fbm(vec2(t * .05, 1.))); }
  L = .03 + (L - .03) * mix(1., uSigA, step(.5, uSig)) * (.45 + .55 * uAmt);
  vec3 src = vec3(.047, .043, .039) + vec3(L);
  vec3 gr = mix(uSh, uHi, clamp(L * 1.15, 0., 1.));
  vec3 col = mix(src, gr, .6 * clamp(uAmt * 1.6, 0., 1.)) + add * (.5 + .5 * uAmt);
  // зерно: 8 кадров, 24 к/с
  vec2 gp = floor(gl_FragCoord.xy / uGs) + vec2(uFr * 37., uFr * 91.);
  float g = h(gp) + h(gp + 13.7) - 1.;
  float shadowK = mix(1., uShG, 1. - smoothstep(.0, .2, L));
  col += g * uGr * shadowK * (.35 + 1.3 * uAmt) * (.25 + L * 3.);
  float v = smoothstep(.3, 1.15, length(q * vec2(.78, 1.)));
  col *= 1. - uVig * v * (.6 + .4 * uAmt);
  gl_FragColor = vec4(col, 1.);
}`;
function initGL() {
  try {
    gl = cv.getContext('webgl', { alpha: false, antialias: false, depth: false, powerPreference: 'low-power', preserveDrawingBuffer: false });
    if (!gl) return;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}'));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link');
    gl.useProgram(p);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(p, 'a'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    for (const k of ['uRes', 'uC', 'uT', 'uTs', 'uAmt', 'uGr', 'uGs', 'uVig', 'uSigA', 'uWow', 'uFr', 'uShG', 'uSh', 'uHi', 'uSig']) U[k] = gl.getUniformLocation(p, k);
    glOk = true;
  } catch (e) { glOk = false; gl = null; }
}
initGL();
cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); glOk = false; document.body.classList.add('nogl'); });
cv.addEventListener('webglcontextrestored', () => { initGL(); document.body.classList.remove('nogl'); kick(); });
if (!glOk) document.body.classList.add('nogl');
function resize() { reelR = null; cv.width = Math.max(2, Math.round(innerWidth * RS)); cv.height = Math.max(2, Math.round(innerHeight * RS)); if (glOk) gl.viewport(0, 0, cv.width, cv.height); kick(true); }
addEventListener('resize', resize, { passive: true });

// ---------- кадр ----------
const fxwrap = $('.fxwrap'), reelEl = $('#reel'), strip = $('#strip'), vig = $('#vig');
let raf = 0, last = 0, slowN = 0, reelR = null, reelRT = 0, idleT = 0;
const cssVals = new Map();
const setVar = (k, v) => { if (cssVals.get(k) !== v) { cssVals.set(k, v); root.style.setProperty(k, v); } };
addEventListener('scroll', () => (reelR = null), { passive: true });
const animate = () => on && !still && !reduce.matches && !document.hidden;
function phaseAmt(now) {
  if (ph === 'land') {
    const u = now - land0;
    if (u < 400) return 1;
    const k = clamp((u - 400) / 1200); return lerp(1, 0.2, eoc(k));
  }
  return { idle: 0.35, spin: 0.7, result: 0.2 }[ph] ?? 0.35;
}
function frame(now) {
  raf = 0;
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
  // деградация: 30 кадров подряд дольше 20ms — подпись выключается, грейд и зерно остаются
  if (animate() && !NOADAPT) { if (dt > 0.02) { if (++slowN >= SLOW_N && !slow) { slow = true; } } else slowN = 0; }
  const t = (now - T0) / 1000;
  // грейд: кроссфейд 600ms ease-in-out
  if (xf0 >= 0) {
    const k = still || reduce.matches ? 1 : eio(clamp((now - xf0) / 600));
    for (const key of ['sat', 'gr', 'gs', 'vig']) cur[key] = lerp(from[key], to[key], k);
    for (let i = 0; i < 3; i++) { cur.sh[i] = lerp(from.sh[i], to.sh[i], k); cur.hi[i] = lerp(from.hi[i], to.hi[i], k); }
    if (k >= 1) xf0 = -1;
  }
  // подпись: старая гаснет 200ms, новая проявляется 400ms
  if (sig !== sigNext) { sigA = Math.max(0, sigA - dt / 0.2); if (sigA <= 0 || still || reduce.matches) { sig = sigNext; sigT0 = now; sigA = 0; } }
  else sigA = still || reduce.matches ? (sig ? 1 : 0) : Math.min(1, sigA + dt / 0.4);
  const sA = slow || !animate() ? 0 : sigA;
  // амплитуда фазы: мягко к цели, остановка — по своей кривой
  const target = phaseAmt(now);
  amt = ph === 'land' || !animate() ? target : amt + (target - amt) * Math.min(1, dt * 5);
  if (ph !== 'result' && animate()) tSig += dt;
  const g = GEN[gid] || GEN.none;
  // карточки: боковые 100%, центральная — грейд не больше 25%
  const kS = 0.6 * clamp(amt * 1.25), satS = 1 + (cur.sat - 1) * clamp(amt * 1.25);
  if (!LOW) {
    setA(F.sm, 'values', matrix(kS, deSat > 0 ? lerp(satS, 0, deSat) : satS));
    setA(F.cm, 'values', matrix(Math.min(0.25, kS) * 0.6, 1 + (cur.sat - 1) * 0.25));
  }
  // подписи на карточках
  let sideBlur = 0, cBlur = 0;
  if (sig === 2) { sideBlur = 6 * sA; cBlur = ph === 'spin' ? (1.5 - 1.5 * Math.cos(t * Math.PI * 2 / 1.6)) * sA : 0; }
  if (sig === 13) sideBlur = 2.5 * sA;
  if (focusC > 0) cBlur = Math.max(cBlur, focusC);
  setA(F.sb, 'stdDeviation', sideBlur.toFixed(2)); setA(F.cb, 'stdDeviation', cBlur.toFixed(2));
  // барабан: смаз движения (боевик), рывок-панорама (комедия), step-printing с призраком (мелодрама)
  let mb = 0, ghost = 0, gdx = 0;
  if (ph === 'spin' && sA > 0) {
    if (sig === 4) mb = Math.min(8, Math.abs(vel) / 260) * sA;
    if (sig === 6) { ghost = 0.5 * sA; gdx = Math.min(260, Math.abs(vel) * 0.125); }
  }
  if (whip > 0) { mb = Math.max(mb, 10 * whip); whip = Math.max(0, whip - dt / 0.15); }
  const stripOn = mb > 0.05 || ghost > 0.01;
  if (stripOn) { setA(F.mb, 'stdDeviation', `${mb.toFixed(1)} 0`); setA(F.mo, 'dx', gdx.toFixed(1)); setA(F.ma, 'slope', ghost.toFixed(2)); }
  const sf = stripOn ? 'url(#gM)' : ''; if (strip.style.filter !== sf) strip.style.filter = sf;
  // фон и барабан: наезд (ужасы), dolly zoom (мистика), Кен Бёрнс (документальное)
  let bgS = 1, bgX = 0, rS = 1;
  const ts = tSig;
  if (sig === 1) bgS = 1.02 - 0.02 * Math.cos(ts * Math.PI * 2 / 16) * sA;
  if (sig === 9) { const k = (0.5 - 0.5 * Math.cos(ts * Math.PI * 2 / 10)) * sA; bgS = 1 + 0.05 * k; rS = 1 - 0.015 * k; }
  if (sig === 15) { const k = 0.5 - 0.5 * Math.cos(ts * Math.PI * 2 / 14); bgS = 1 + 0.04 * k * sA; bgX = (k - 0.5) * 2 * sA; }
  bgS *= dz.bg; rS *= dz.r;
  fxwrap.style.transform = bgS !== 1 || bgX ? `translateX(${bgX.toFixed(2)}%) scale(${bgS.toFixed(4)})` : '';
  reelEl.style.scale = rS !== 1 ? rS.toFixed(4) : '';
  if (sig === 2) cv.style.filter = sA > 0 ? `blur(${(5 * sA).toFixed(1)}px)` : ''; else if (cv.style.filter) cv.style.filter = '';
  // виньетка (у ужасов дышит ±0.05 за 4s) и зерно карточек
  const vv = cur.vig + (sig === 1 ? 0.05 * Math.sin(ts * Math.PI * 2 / 4) * sA : 0);
  setVar('--vig', (vv * (0.6 + 0.4 * amt)).toFixed(2));
  if (!LOW) { setVar('--gA', (cur.gr * 5 * (0.35 + 0.65 * amt)).toFixed(2)); setVar('--gS', `${Math.round(128 * cur.gs)}px`); }
  // фон
  if (glOk) {
    if (!reelR || now - reelRT > 1000) { reelR = reelEl.getBoundingClientRect(); reelRT = now; }
    const r = reelR;
    gl.uniform2f(U.uRes, cv.width, cv.height);
    gl.uniform2f(U.uC, 0.5, 1 - (r.top + r.height / 2) / innerHeight);
    gl.uniform1f(U.uT, t); gl.uniform1f(U.uTs, ts); gl.uniform1f(U.uAmt, amt);
    gl.uniform1f(U.uGr, cur.gr); gl.uniform1f(U.uGs, Math.max(1, cur.gs)); gl.uniform1f(U.uVig, cur.vig);
    gl.uniform1f(U.uSigA, sA || (still || reduce.matches ? sigA : 0)); gl.uniform1f(U.uWow, wowK);
    gl.uniform1f(U.uFr, animate() ? Math.floor(t * 24) % 8 : 0); gl.uniform1f(U.uShG, g.shadowGrain || 1);
    gl.uniform3fv(U.uSh, cur.sh); gl.uniform3fv(U.uHi, cur.hi); gl.uniform1f(U.uSig, sig);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  const busy = xf0 >= 0 || sig !== sigNext || sigA < 1 || ph === 'land' || Math.abs(amt - target) > 0.002 || whip > 0 || wowK > 0;
  // в покое и на результате хватает 24 к/с (зерно и так 24 к/с): не гоняем GPU на 60
  if (animate() || busy) {
    if (!busy && (ph === 'idle' || ph === 'result')) { raf = -1; idleT = setTimeout(() => { raf = requestAnimationFrame(frame); }, 1000 / 24 - 4); }
    else raf = requestAnimationFrame(frame);
  }
}
function kick() {
  if (raf === -1) { clearTimeout(idleT); raf = 0; }
  if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
reduce.addEventListener?.('change', () => { document.body.classList.toggle('fx-still', !animate()); kick(); });
const dz = { bg: 1, r: 1 };

// ---------- API для приложения ----------
// жанр эффекта (id основного жанра или 'none')
export function setGenre(id) {
  if (!GEN[id]) id = 'none';
  document.body.dataset.fx = id;
  if (id === gid) return;
  gid = id; const g = GEN[id];
  from = { ...cur, sh: cur.sh.slice(), hi: cur.hi.slice() };
  to = { sh: hex(g.sh), hi: hex(g.hi), sat: g.sat, gr: g.gr, gs: g.gs, vig: g.vig };
  xf0 = performance.now(); sigNext = g.sig;
  kick();
}
export function phase(p) { if (p === ph) return; ph = p; if (p === 'land') land0 = performance.now(); if (p === 'spin' && gid === 'comedy' && animate()) whip = 1; kick(); }
export function setMotion(v) { on = !!v; still = !on; document.body.classList.toggle('fx-still', !animate()); document.body.classList.toggle('nofx', false); kick(); }
// скорость барабана (px/s) — для смаза и призрака
export function onReel(v) { vel = v; }
// как барабан ходит у жанра: fps — квантование картинки (война 24, мелодрама 8), land — кривая торможения
export function plan() {
  if (!animate() || slow) return { fps: 0, land: 'normal' };
  const s = GEN[gid].sig;
  return { fps: s === 11 ? 24 : s === 6 ? 8 : 0, land: s === 4 ? 'slowmo' : s === 6 ? 'rapid' : s === 16 ? 'overshoot' : 'normal' };
}
export const genreNow = () => gid;

// «вау» на остановке: возвращает, сколько ждать до раскрытия результата
const topEl = $('#fxTop');
const ease = 'cubic-bezier(.16,1,.3,1)';
function layer(css, cls = '') { const d = document.createElement('div'); d.className = 'fxl ' + cls; d.style.cssText = css; topEl.append(d); return d; }
const gone = (d, a) => a.finished.then(() => d.remove(), () => d.remove());
export function wow(card) {
  const g = GEN[gid] || GEN.none;
  if (gid === 'none' || !on) return 260;
  if (reduce.matches || still) return 200; // вместо «вау» — кроссфейд фазы
  const r = card?.getBoundingClientRect?.() || { left: innerWidth / 2 - 100, top: innerHeight / 2 - 150, width: 200, height: 300 };
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const s = g.sig;
  if (s === 1) { // перебой практического света: ×0.15 на 70ms, назад 120ms, ×0.3 на 50ms
    const d = layer('inset:0;background:#000;opacity:0');
    gone(d, d.animate([{ opacity: 0.85, offset: 0 }, { opacity: 0.85, offset: 0.14 }, { opacity: 0, offset: 0.38 }, { opacity: 0.7, offset: 0.4 }, { opacity: 0.7, offset: 0.5 }, { opacity: 0, offset: 0.62 }, { opacity: 0, offset: 1 }], { duration: 500, easing: 'linear' }));
  } else if (s === 2) { // snap-фокус: центр 8px → 0 за 180ms
    tween(260, (u) => { focusC = u < 0.3 ? 8 : 8 * (1 - eoc((u - 0.3) / 0.7)); }, () => (focusC = 0));
  } else if (s === 3) { // анаморфный блик через центр постера
    const d = layer(`left:0;right:0;top:${cy - 1}px;height:2px;background:#9FC9FF;box-shadow:0 0 40px 10px rgba(159,201,255,.45),0 0 4px 1px rgba(220,236,255,.8);mix-blend-mode:screen;opacity:0`);
    gone(d, d.animate([{ opacity: 0, transform: 'scaleX(.2)' }, { opacity: 0.6, transform: 'scaleX(1)', offset: 0.4 }, { opacity: 0, transform: 'scaleX(1.05)' }], { duration: 500, easing: 'ease-out' }));
  } else if (s === 4) { // тряска 2px по 3 кадрам по 16ms
    const st = $('#stage'); st.animate([{ transform: 'translate(2px,-1px)' }, { transform: 'translate(-2px,1px)' }, { transform: 'translate(1px,2px)' }, { transform: 'none' }], { duration: 48, easing: 'steps(1,end)' });
  } else if (s === 5) { // фары: одна полоса через постер
    const d = layer(`left:${r.left - r.width * 0.6}px;top:${cy - r.height * 0.15}px;width:${r.width * 0.6}px;height:${r.height * 0.3}px;border-radius:50%;background:#F2C58A;filter:blur(28px);mix-blend-mode:screen;opacity:0`);
    gone(d, d.animate([{ opacity: 0, transform: 'translateX(0)' }, { opacity: 0.25, offset: 0.3 }, { opacity: 0.25, offset: 0.7 }, { opacity: 0, transform: `translateX(${r.width * 2.2}px)` }], { duration: 700, easing: 'cubic-bezier(.4,0,.6,1)' }));
  } else if (s === 6) { // рапид — в торможении; ореол
    const d = layer(`left:${r.left - 60}px;top:${r.top - 60}px;width:${r.width + 120}px;height:${r.height + 120}px;background:radial-gradient(closest-side,rgba(255,122,92,.9),rgba(255,122,92,0));mix-blend-mode:screen;opacity:0`);
    gone(d, d.animate([{ opacity: 0 }, { opacity: 0.2, offset: 0.35 }, { opacity: 0 }], { duration: 900, easing: 'ease-in-out' }));
  } else if (s === 7) { // лучи разгораются и ложатся на постер
    tween(900, (u) => { wowK = u < 0.78 ? 1 - (1 - u / 0.78) ** 2 : 1 - (u - 0.78) / 0.22; }, () => (wowK = 0));
    const d = layer(`left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;border-radius:6px;background:repeating-conic-gradient(from 100deg at -30% -20%,rgba(233,212,140,0) 0deg,rgba(233,212,140,.55) 2deg,rgba(233,212,140,0) 5deg,rgba(233,212,140,0) 9deg);mix-blend-mode:screen;opacity:0`);
    gone(d, d.animate([{ opacity: 0 }, { opacity: 0.3, offset: 0.78 }, { opacity: 0 }], { duration: 900, easing: 'ease-out' }));
  } else if (s === 8) { // красная линия маршрута к постеру
    const W = innerWidth, H = innerHeight, x1 = r.left - 6, y1 = cy;
    const d = layer('inset:0'); d.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none"><defs><mask id="rt"><path d="M-10 ${H * 0.86} C ${W * 0.12} ${H * 0.5}, ${x1 - 160} ${y1 + 220}, ${x1} ${y1}" stroke="#fff" stroke-width="6" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"><animate attributeName="stroke-dashoffset" from="1" to="0" dur=".8s" fill="freeze" calcMode="spline" keySplines=".4 0 .2 1" keyTimes="0;1"/></path></mask></defs>
      <path d="M-10 ${H * 0.86} C ${W * 0.12} ${H * 0.5}, ${x1 - 160} ${y1 + 220}, ${x1} ${y1}" stroke="#B3261E" stroke-width="3" stroke-dasharray="10 6" mask="url(#rt)"/><circle cx="${x1}" cy="${y1}" r="4" fill="#B3261E" opacity="0"><animate attributeName="opacity" begin=".78s" from="0" to="1" dur=".08s" fill="freeze"/></circle></svg>`;
    gone(d, d.animate([{ opacity: 1 }, { opacity: 1, offset: 0.75 }, { opacity: 0 }], { duration: 1500 }));
  } else if (s === 9) { // резкий dolly zoom: фон 1→1.12, постер 1→0.96, возврат 600ms
    tween(1100, (u) => { const k = u < 0.455 ? eio(u / 0.455) : 1 - eio((u - 0.455) / 0.545); dz.bg = 1 + 0.12 * k; }, () => (dz.bg = 1));
    card?.animate([{ scale: '1' }, { scale: '0.96', offset: 0.455 }, { scale: '1' }], { duration: 1100, easing: 'ease-in-out' });
  } else if (s === 10) { // шторки до 2.76:1
    const bh = Math.max(0, (innerHeight - innerWidth / 2.76) / 2) || innerHeight * 0.12;
    for (const side of ['top', 'bottom']) {
      const d = layer(`left:0;right:0;${side}:0;height:${bh}px;background:#000`);
      const y = side === 'top' ? '-100%' : '100%';
      gone(d, d.animate([{ transform: `translateY(${y})` }, { transform: 'none', offset: 0.19, easing: 'linear' }, { transform: 'none', offset: 0.76, easing: 'cubic-bezier(.65,0,.35,1)' }, { transform: `translateY(${y})` }], { duration: 2100, easing: 'cubic-bezier(.65,0,.35,1)' }));
    }
  } else if (s === 11) { // всплеск контраста 1→1.25 за 120ms, спад 300ms
    $('#stage').animate([{ filter: 'contrast(1)' }, { filter: 'contrast(1.25)', offset: 0.29 }, { filter: 'contrast(1)' }], { duration: 420, easing: 'ease-out' });
  } else if (s === 12) { // солнечный засвет Синкая через постер
    const d = layer(`left:${r.left - r.width * 0.5}px;top:${r.top - r.height * 0.4}px;width:${r.width * 2}px;height:${r.height * 1.6}px;background:radial-gradient(closest-side,rgba(255,226,186,.85),rgba(255,170,120,.25) 45%,rgba(255,170,120,0));mix-blend-mode:screen;opacity:0`);
    gone(d, d.animate([{ opacity: 0, transform: `translate(${r.width * 0.45}px,${-r.height * 0.25}px)` }, { opacity: 0.45, offset: 0.45 }, { opacity: 0, transform: `translate(${-r.width * 0.25}px,${r.height * 0.2}px)` }], { duration: 760, easing: 'ease-out' }));
  } else if (s === 13) { // squash & stretch центральной карточки
    card?.animate([{ scale: '1 1' }, { scale: '1.05 0.93', offset: 0.28 }, { scale: '0.98 1.035', offset: 0.6 }, { scale: '1 1' }], { duration: 460, easing: 'ease-out' });
  } else if (s === 14) { // ирис прожектора сходится на постер
    const R = Math.hypot(r.width, r.height) * 0.62, size = R / 0.12;
    const d = layer(`left:${cx - size / 2}px;top:${cy - size / 2}px;width:${size}px;height:${size}px;border-radius:50%;background:radial-gradient(circle,rgba(0,0,0,0) 12%,rgba(0,0,0,.78) 15%);box-shadow:0 0 0 ${Math.max(innerWidth, innerHeight) * 2}px rgba(0,0,0,.78);opacity:0`);
    gone(d, d.animate([{ transform: 'scale(4)', opacity: 0 }, { transform: 'scale(1)', opacity: 1, offset: 0.4 }, { transform: 'scale(1)', opacity: 1, offset: 0.62 }, { transform: 'scale(4)', opacity: 0 }], { duration: 820, easing: 'cubic-bezier(.45,0,.2,1)' }));
  } else if (s === 15) { // стоп-кадр: бока выцветают, центр — Кен Бёрнс
    tween(900, (u) => { deSat = u < 0.6 ? eoc(u / 0.6) : 1 - (u - 0.6) / 0.4; }, () => (deSat = 0));
    card?.animate([{ scale: '1' }, { scale: '1.03', offset: 0.85 }, { scale: '1' }], { duration: 900, easing: 'ease-out' });
  } else if (s === 16) { // комедия: перелёт и возврат — в торможении; лёгкий «дабл-тейк»
    card?.animate([{ scale: '1' }, { scale: '1.025', offset: 0.4 }, { scale: '1' }], { duration: 260, easing: 'ease-out' });
  } else if (s === 17) { // контровой свет за постером разгорается
    tween(800, (u) => { wowK = u < 0.6 ? eoc(u / 0.6) : 1 - (u - 0.6) / 0.4; }, () => (wowK = 0));
    const d = layer(`left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;border-radius:6px;box-shadow:0 0 90px 24px rgba(255,214,160,.5);opacity:0`);
    gone(d, d.animate([{ opacity: 0 }, { opacity: 0.8, offset: 0.55 }, { opacity: 0 }], { duration: 800, easing: 'ease-out' }));
  } else if (s === 18) { // оконный свет переползает на постер
    const d = layer(`left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;border-radius:6px;background:linear-gradient(115deg,rgba(255,244,226,0) 25%,rgba(255,244,226,.32) 42%,rgba(255,244,226,.32) 58%,rgba(255,244,226,0) 75%) 0 0/300% 100% no-repeat;mix-blend-mode:screen;opacity:0`);
    gone(d, d.animate([{ opacity: 0, backgroundPosition: '100% 0' }, { opacity: 1, offset: 0.3 }, { opacity: 1, offset: 0.7 }, { opacity: 0, backgroundPosition: '0% 0' }], { duration: 860, easing: 'ease-in-out' }));
  }
  kick();
  return g.hold;
}
function tween(ms, fn, end) {
  const s = performance.now();
  const st = (n) => { const u = clamp((n - s) / ms); fn(u); kick(); if (u < 1) requestAnimationFrame(st); else end?.(); };
  requestAnimationFrame(st);
}
export function glInfo() { return { ok: glOk, w: cv.width, h: cv.height, gid, sig, amt, ph, slow }; }
resize();
setMotion(true);
