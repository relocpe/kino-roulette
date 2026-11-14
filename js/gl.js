// Реалистичные фоны на WebGL: объёмный туман с умирающей лампой, дождь на стекле с преломлением,
// дым с углями, психоделическое «дыхание», киноплёнка и VHS. Один full-screen шейдер на сцену.
const HEAD = `precision highp float;
uniform vec2 uRes; uniform float uTime, uAlpha; uniform vec2 uMouse; uniform vec4 uP0, uP1, uP2;
float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float h31(vec3 p){ p = fract(p*0.3183099+.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float n3(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.-2.*f);
  return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x),mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x),mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fbm(vec3 p){ float a=.5, s=0.; for(int i=0;i<5;i++){ s+=a*n3(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=.5; } return s; }
float fbm3(vec3 p){ float a=.5, s=0.; for(int i=0;i<3;i++){ s+=a*n3(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=.5; } return s; }
vec3 tone(vec3 c){ c = c/(1.+c); return pow(c, vec3(.92)); }
float grain(vec2 fc, float t){ return h21(fc + fract(t*7.13)*vec2(311.7, 183.3)) - .5; }
`;

const FRAG = {
  // туман в тёмной комнате: лампа сверху (uP0.xy позиция, z яркость, w ширина луча),
  // uP1.rgb цвет света, w плотность; uP2.x фонарик, y низовой туман, z холод/красный тон
  fogroom: `
void main(){
  vec2 fc = gl_FragCoord.xy, uv = fc/uRes; float asp = uRes.x/uRes.y;
  vec2 p = (fc - .5*uRes)/uRes.y; float t = uTime;
  vec2 L = vec2((uP0.x-.5)*asp, uP0.y-.5); float bulb = uP0.z;
  vec3 q = vec3(p*1.6, t*.04);
  vec2 w = vec2(fbm3(q + vec3(0,0,1.3)), fbm3(q + vec3(5.2,1.3,2.1)));
  float fog = fbm(vec3(p*2.1 + w*1.3 + vec2(t*.035, 0.), t*.06));
  float low = smoothstep(.55, -.55, p.y);
  float dens = (fog*fog*1.6) * (0.35 + uP2.y*low*1.4) * uP1.w;
  vec2 d = p - L; float dist = length(d);
  float fall = exp(-dist*3.6) * bulb;
  float hot = (.0016/(dist*dist + .0016)) * bulb;
  float depth = max(L.y - p.y, 0.);
  float cone = smoothstep(uP0.w*depth + .02, uP0.w*depth*.35, abs(d.x)) * smoothstep(0., .12, depth) * exp(-depth*1.1) * bulb;
  vec3 lc = uP1.rgb;
  // стена: грязная штукатурка с потёками
  float wall = fbm3(vec3(p*vec2(5.,7.), 3.)) * .7 + fbm3(vec3(p*vec2(30., 6.), 1.)) * .3;
  vec3 col = vec3(.002,.002,.003);
  col += lc * wall * .09 * fall;
  col += lc * dens * (fall*1.1 + cone*1.6);
  col += lc * hot * 1.8 + vec3(1.,.9,.75)*hot*hot*2.;
  // пылинки в луче
  vec2 g = p*vec2(46., 46.) + vec2(sin(t*.2)*2., t*1.2); vec2 id = floor(g), f = fract(g)-.5;
  float r = h21(id); vec2 o = vec2(h21(id+3.1), h21(id+7.7)) - .5;
  float mote = smoothstep(.07, 0., length(f - o*.7)) * step(.86, r) * (.5+.5*sin(t*2.+r*40.));
  col += lc * mote * cone * 1.4;
  // фонарик
  vec2 m = (uMouse - .5*uRes)/uRes.y;
  float fl = smoothstep(.42, .0, length(p - m)) * uP2.x;
  vec3 flc = vec3(1., .93, .82);
  col += flc * fl * (.025 + wall*.07 + dens*1.1);
  col *= mix(vec3(1.), vec3(1.25,.55,.5), uP2.z);
  float vig = smoothstep(1.35, .25, length(p*vec2(.85, 1.15)));
  col *= vig*vig;
  col = tone(col*1.5);
  col += grain(fc, t) * .05;
  gl_FragColor = vec4(col*uAlpha, uAlpha);
}`,

  // дождь на стекле с преломлением ночных огней. uP0.x — ч/б (нуар), uP0.y — жалюзи
  rain: `
vec3 lights(vec2 uv, float blur){
  vec3 c = mix(vec3(.01,.015,.03), vec3(.03,.035,.06), uv.y);
  for(int i=0;i<16;i++){
    float fi = float(i); vec2 pos = vec2(h21(vec2(fi,1.3)), h21(vec2(fi,7.1))*.75);
    pos.x = fract(pos.x + uTime*.004*(h21(vec2(fi,3.))-.5));
    float rad = mix(.025, .09, h21(vec2(fi,5.)));
    vec3 lc = h21(vec2(fi,9.)) < .5 ? vec3(1.,.62,.28) : (h21(vec2(fi,11.)) < .5 ? vec3(1.,.18,.15) : vec3(.5,.75,1.));
    float d = length((uv - pos)*vec2(uRes.x/uRes.y, 1.));
    float r = rad*(1.+blur*1.8);
    c += lc * smoothstep(r, r*(1.-.9*blur) - .002, d) * (.9 - blur*.5) * (.6+.4*h21(vec2(fi,13.)));
  }
  return c;
}
vec3 drop(vec2 uv, float t){
  vec2 a = vec2(4., 1.), grid = a*1.6;
  vec2 id = floor(uv*grid);
  float colShift = h21(vec2(id.x, 0.)); uv.y += colShift;
  id = floor(uv*grid);
  vec2 st = fract(uv*grid) - vec2(.5, 0.);
  float n = h21(id);
  float x = n - .5;
  float y = fract(-t*(.1+.05*n) + n*6.2831) ;
  float wig = sin(uv.y*40.)*sin(uv.y*13.)*.04;
  x += wig*(.5-abs(x))*(n-.5);
  y = smoothstep(0., .85, y)*.9 + .05;
  vec2 dp = (st - vec2(x, y))*a.yx;
  float m = smoothstep(.5, .0, length(dp*vec2(1., 1.25))*1.7);
  float trail = smoothstep(.22, .0, abs(st.x - x)*3.) * smoothstep(-.05, .05, st.y - y) * smoothstep(1., y, st.y);
  vec2 tp = vec2(st.x - x, fract(st.y*8.)-.5)*vec2(1., .25);
  float tdrops = smoothstep(.12, .0, length(tp)*3.) * trail;
  return vec3(dp*m*1.4, max(m, tdrops*.7));
}
float statics(vec2 uv, float t){
  uv *= 38.; vec2 id = floor(uv); vec2 f = fract(uv) - .5;
  vec2 o = vec2(h21(id), h21(id+1.7)) - .5;
  float s = smoothstep(.22, 0., length(f - o*.7)) * step(.45, h21(id+4.2));
  return s * (.5+.5*sin(t*.3 + h21(id)*6.28));
}
void main(){
  vec2 fc = gl_FragCoord.xy, uv = fc/uRes; float t = uTime;
  vec2 u = uv*vec2(uRes.x/uRes.y, 1.);
  vec3 d1 = drop(u*1.1, t), d2 = drop(u*1.9 + 7.1, t*1.1);
  float st = statics(u, t);
  float mask = clamp(d1.z + d2.z*.8 + st*.6, 0., 1.);
  vec2 off = d1.xy + d2.xy*.6 + vec2(st)*.012;
  vec3 bg = lights(uv, 1.);
  vec3 sharp = lights(uv + off*.6 + vec2(0., .04)*mask, .15);
  vec3 col = mix(bg, sharp*1.2 + vec3(.012,.016,.024), mask);
  float rim = smoothstep(.15, .45, mask) - smoothstep(.45, .9, mask);
  col *= 1. - rim*.45;
  col += vec3(.75,.82,1.)*pow(max(0., -off.y*14. + off.x*6.), 2.)*mask*.25;
  col *= .8 + .2*smoothstep(0., 1., uv.y);
  if (uP0.x > .5) { float l = dot(col, vec3(.3,.59,.11)); col = vec3(l)*1.3; }
  if (uP0.y > 0.) {
    vec2 r = mat2(.88,.47,-.47,.88)*uv; float bl = smoothstep(.35,.5,fract(r.y*14. + t*.02));
    col *= mix(1., .35 + .9*bl, uP0.y);
  }
  float vig = smoothstep(1.1, .3, length((uv-.5)*vec2(1.2, 1.)));
  col *= vig;
  col = tone(col*1.3) + grain(fc, t)*.03;
  gl_FragColor = vec4(col*uAlpha, uAlpha);
}`,

  // дым и угли (война) / пепел и смог (постапокалипсис): uP0.x режим
  smoke: `
void main(){
  vec2 fc = gl_FragCoord.xy, uv = fc/uRes; float t = uTime; float asp = uRes.x/uRes.y;
  vec2 p = (fc - .5*uRes)/uRes.y; float apo = uP0.x;
  vec3 q = vec3(p*1.4 + vec2(0., -t*.05*(1.-apo*1.4)), t*.05);
  vec2 w = vec2(fbm3(q), fbm3(q+vec3(4.1,2.3,1.)));
  float sm = fbm(vec3(p*1.8 + w*1.6 + vec2(t*.02, -t*.07*(1.-apo)), t*.04));
  float low = smoothstep(.6, -.6, p.y);
  vec3 sky = mix(vec3(.02,.015,.012), mix(vec3(.25,.09,.02), vec3(.22,.13,.06), apo), low*.9);
  vec3 smokeC = mix(vec3(.08,.07,.065), vec3(.16,.13,.1), apo);
  vec3 col = sky + smokeC*sm*sm*1.8;
  col += vec3(1.,.35,.08) * pow(low, 3.) * sm * (1.-apo*.55) * .9;
  // частицы: угли летят вверх (война), пепел падает (апокалипсис)
  for(int L=0; L<3; L++){
    float fl = float(L), sc = 18. + fl*14.;
    vec2 g = p*sc + vec2(sin(t*.3+fl)*1.5, (apo>.5 ? 1. : -1.)*t*(1.2+fl*.6));
    vec2 id = floor(g), f = fract(g) - .5;
    float r = h21(id + fl*13.); vec2 o = vec2(h21(id+2.3), h21(id+5.9)) - .5;
    float dd = length(f - o*.6);
    float on = step(apo > .5 ? .7 : .83, r);
    float ember = apo > .5 ? step(.97, r) : 1.;
    float tw = .55 + .45*sin(t*6. + r*50.);
    vec3 ec = vec3(1.,.45,.12)*exp(-dd*dd*90.)*2.2 + vec3(1.,.6,.25)*exp(-dd*dd*700.)*2.;
    vec3 ash = vec3(.55,.52,.5)*smoothstep(.09,.03,dd);
    col += on * mix(ash*.5, ec*tw, ember) * (1.-fl*.25);
  }
  float vig = smoothstep(1.4, .25, length(p*vec2(.8,1.1)));
  col *= vig;
  col = tone(col*1.4) + grain(fc, t)*.04;
  gl_FragColor = vec4(col*uAlpha, uAlpha);
}`,

  // психологический триллер: дышащая деформация пространства с хроматическим расслоением. uP0.x — шёпот
  psycho: `
float field(vec2 q, float t){
  float f = fbm(vec3(q*1.6, t*.05));
  float rings = sin(length(q)*18. - t*.6 + f*6.)*.5+.5;
  return f*f*1.4 + rings*.06*f;
}
void main(){
  vec2 fc = gl_FragCoord.xy; float t = uTime;
  vec2 p = (fc - .5*uRes)/uRes.y;
  float br = .5+.5*sin(t*1.1);
  vec2 q = p*(1. + .12*br*length(p));
  q += .05*vec2(fbm3(vec3(p*3., t*.1)), fbm3(vec3(p*3.+4., t*.1))) - .025;
  float ca = .008 + .012*br + uP0.x*.01;
  float r = field(q*(1.+ca), t), g = field(q, t), b = field(q*(1.-ca), t);
  vec3 col = vec3(r*.55, g*.12, b*.35) + vec3(r*.1, g*.25, b*.32)*.6;
  float vr = .55 + .25*br;
  col *= smoothstep(vr+.6, vr-.25, length(p*vec2(.9,1.1)));
  col = tone(col*1.5);
  col += grain(fc, t)*(.04 + uP0.x*.16);
  gl_FragColor = vec4(col*uAlpha, uAlpha);
}`,

  // проектор и плёнка (документальное) / VHS (культовое): uP0.x режим
  film: `
void main(){
  vec2 fc = gl_FragCoord.xy, uv = fc/uRes; float t = uTime; float vhs = uP0.x;
  float fr = floor(t*24.);
  vec2 p = (fc - .5*uRes)/uRes.y;
  vec3 col;
  if (vhs < .5) {
    vec2 o = vec2(-.9, .7);
    vec2 d = p - o; float ang = atan(d.y, d.x);
    float beam = smoothstep(.22, .0, abs(ang + .62)) * exp(-length(d)*.5);
    float flick = .85 + .15*h21(vec2(fr, 1.));
    float dust = fbm(vec3(p*3. + vec2(t*.02, 0.), t*.1));
    col = vec3(.02,.015,.01) + vec3(1.,.85,.62)*beam*(.25 + dust*.9)*flick;
    vec2 g = p*60. + vec2(t*.4, sin(t*.3)*2.); vec2 id = floor(g), f = fract(g)-.5;
    col += vec3(1.,.9,.7)*smoothstep(.08,0.,length(f-(vec2(h21(id),h21(id+1.))-.5)*.7))*step(.9,h21(id+3.))*beam*2.;
    float sx = h21(vec2(fr, 7.)); float scratch = step(.6, h21(vec2(fr,9.))) * smoothstep(.0015, .0, abs(uv.x - sx));
    col += scratch*.25;
    float speck = step(.9985, h21(floor(fc/3.) + fr));
    col = mix(col, vec3(0.), speck*.8);
    col *= smoothstep(1.3, .3, length(p));
    col = tone(col*1.5) + grain(fc, t)*.09;
  } else {
    float band = fract(t*.07);
    float inb = smoothstep(.06, .0, abs(uv.y - band));
    vec2 u = uv; u.x += (h21(vec2(floor(uv.y*240.), fr)) - .5) * .02 * inb;
    float glowF = fbm(vec3(u*vec2(2.,3.), t*.05));
    vec3 base = vec3(.05,.03,.06) + vec3(.6,.25,.15)*glowF*glowF*.5;
    col = vec3(base.r*(1.+.2*sin(u.y*900.)), base.g, base.b*1.2);
    col += inb * (h21(fc + fr) * .25);
    col *= .82 + .18*sin(uv.y*uRes.y*1.6);
    col += (vec3(h21(fc+fr), h21(fc+fr+3.), h21(fc+fr+7.))-.5)*.06;
    col *= smoothstep(1.2, .35, length(p*vec2(.9,1.2)));
    col = tone(col*1.3);
  }
  gl_FragColor = vec4(col*uAlpha, uAlpha);
}`,
};

// какие жанры рисует GL и как берутся параметры
const shared = { bulb: 1, whisper: 0, red: 0 };
export { shared };
const SCENES = {
  horror: { prog: 'fogroom', p: () => [[.5, 1.02, shared.bulb, .55], [1., .72, .45, 1.15], [1., 1., 0., 0]] },
  mystery: { prog: 'fogroom', p: () => [[.15, 1.1, .75, .9], [.45, .58, .85, 1.05], [1.2, 1.2, 0., 0]] },
  slasher: { prog: 'fogroom', p: () => [[.5, 1.05, .55 + shared.red * 2., .4], [1., .2, .15, .9], [.6, .9, .35, 0]] },
  thriller: { prog: 'fogroom', p: (t) => { const k = t % 1.3, beat = Math.exp(-k * 7) + .6 * Math.exp(-Math.max(0, k - .22) * 7) * (k > .22); return [[.5, .5, .35 + beat * .5, 3.], [1., .18, .12, .8], [.5, .6, .2, 0]]; } },
  drama: { prog: 'rain', p: () => [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]] },
  noir: { prog: 'rain', p: () => [[1, .9, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]] },
  war: { prog: 'smoke', p: () => [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]] },
  postapoc: { prog: 'smoke', p: () => [[1, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]] },
  psycho: { prog: 'psycho', p: () => [[shared.whisper, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]] },
  documentary: { prog: 'film', p: () => [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]] },
  cult: { prog: 'film', p: () => [[1, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]] },
};
export const glScenes = Object.keys(SCENES);

const cv = document.getElementById('gl');
const coarse = matchMedia('(pointer: coarse)').matches;
const NOADAPT = /[?&]noadapt/.test(location.search);
let gl = null, progs = {}, buf = null, scale = coarse ? 0.4 : 0.6, disabled = false;
let scene = null, alpha = 0, target = 0, W = 0, H = 0, slow = 0, frames = 0;
function init() {
  if (gl || disabled) return !!gl;
  try { gl = cv.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false, powerPreference: 'high-performance' }); } catch {}
  if (!gl || (navigator.deviceMemory && navigator.deviceMemory < 2)) { disabled = true; gl = null; return false; }
  buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); disabled = true; gl = null; }, false);
  resize();
  return true;
}
function compile(name) {
  if (progs[name]) return progs[name];
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const p = gl.createProgram();
  gl.attachShader(p, sh(gl.VERTEX_SHADER, 'attribute vec2 a; void main(){ gl_Position = vec4(a, 0., 1.); }'));
  gl.attachShader(p, sh(gl.FRAGMENT_SHADER, HEAD + FRAG[name]));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {}; for (const n of ['uRes', 'uTime', 'uAlpha', 'uMouse', 'uP0', 'uP1', 'uP2']) u[n] = gl.getUniformLocation(p, n);
  return (progs[name] = { p, u, a: gl.getAttribLocation(p, 'a') });
}
export function resize() {
  if (!gl) return;
  W = Math.max(1, Math.round(innerWidth * scale)); H = Math.max(1, Math.round(innerHeight * scale));
  cv.width = W; cv.height = H;
}
// true — GL берёт сцену на себя, 2D-эффект рисует только детали поверх
export function want(id) {
  const s = SCENES[id];
  if (!s || !init()) { target = 0; return false; }
  try { compile(s.prog); } catch (e) { console.warn('gl', e); disabled = true; return false; }
  if (scene !== id) { if (alpha < 0.05) { scene = id; } next = id; }
  target = 1;
  return true;
}
let next = null;
export function stop() { target = 0; next = null; }
export function active(id) { return !!gl && !disabled && (scene === id || next === id) && target > 0; }
export function render(t, dt, mx, my, still) {
  if (!gl) return;
  if (next && next !== scene) { alpha = Math.max(0, alpha - dt * 3); if (alpha <= 0.02) { scene = next; } }
  else alpha += (target - alpha) * Math.min(1, dt * 3);
  if (still) alpha = target;
  cv.style.opacity = '1';
  if (!scene || alpha < 0.01) { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); return; }
  const s = SCENES[scene], pr = compile(s.prog), P = s.p(t);
  gl.viewport(0, 0, W, H);
  gl.useProgram(pr.p);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(pr.a); gl.vertexAttribPointer(pr.a, 2, gl.FLOAT, false, 0, 0);
  gl.uniform2f(pr.u.uRes, W, H); gl.uniform1f(pr.u.uTime, t); gl.uniform1f(pr.u.uAlpha, Math.min(1, alpha));
  gl.uniform2f(pr.u.uMouse, mx * scale, (innerHeight - my) * scale);
  gl.uniform4fv(pr.u.uP0, P[0]); gl.uniform4fv(pr.u.uP1, P[1]); gl.uniform4fv(pr.u.uP2, P[2]);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  // адаптивное качество: если кадры тяжёлые — снижаем разрешение, потом отключаем GL
  if (!still && !NOADAPT) {
    frames++;
    slow = slow * 0.95 + (dt > 0.024 ? 1 : 0) * 0.05;
    if (frames > 90 && slow > 0.5) {
      frames = 0; slow = 0;
      if (scale > 0.3) { scale = Math.max(0.28, scale * 0.75); resize(); }
      else { disabled = true; gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl = null; cv.style.opacity = '0'; }
    }
  }
}
export const glInfo = () => ({ on: !!gl && !disabled, scale, scene, alpha });
