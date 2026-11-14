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
  if (uP0.z > 0.) {
    float ph = uTime*2.6; float rd = pow(.5+.5*sin(ph), 6.), bl = pow(.5+.5*sin(ph+3.14159), 6.);
    vec2 asp2 = vec2(uRes.x/uRes.y, 1.);
    float r = .07*(1.+blur*2.);
    c += vec3(1.,.08,.06)*smoothstep(r, r*(1.-.9*blur)-.002, length((uv-vec2(.3,.2))*asp2))*rd*uP0.z*1.4;
    c += vec3(.15,.35,1.)*smoothstep(r, r*(1.-.9*blur)-.002, length((uv-vec2(.4,.18))*asp2))*bl*uP0.z*1.6;
    c += (vec3(1.,.1,.1)*rd + vec3(.15,.3,1.)*bl)*.05*uP0.z;
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
  if (uP0.x > 0.) { float l = dot(col, vec3(.3,.59,.11)); col = mix(col, vec3(l)*1.3, uP0.x); }
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
  vec2 p = (fc - .5*uRes)/uRes.y; float apo = uP0.x; float act = uP0.y;
  p += (vec2(n3(vec3(p*9., t*2.3)), n3(vec3(p*9.+5., t*2.3))) - .5)*.022*act*smoothstep(.3, -.6, p.y);
  vec3 q = vec3(p*1.4 + vec2(0., -t*.05*(1.-apo*1.4)), t*.05);
  vec2 w = vec2(fbm3(q), fbm3(q+vec3(4.1,2.3,1.)));
  float sm = fbm(vec3(p*1.8 + w*1.6 + vec2(t*.02, -t*.07*(1.-apo)), t*.04));
  float low = smoothstep(.6, -.6, p.y);
  vec3 sky = mix(vec3(.02,.015,.012), mix(vec3(.25,.09,.02), vec3(.22,.13,.06), apo), low*.9);
  vec3 smokeC = mix(vec3(.08,.07,.065), vec3(.16,.13,.1), apo);
  vec3 col = sky + smokeC*sm*sm*1.8;
  col += vec3(1.,.35,.08) * pow(low, 3.) * sm * (1.-apo*.55) * (.9 + act*.9);
  // частицы: угли летят вверх (война), пепел падает (апокалипсис)
  for(int L=0; L<3; L++){
    float fl = float(L), sc = 18. + fl*14.;
    vec2 g = p*sc*vec2(1., 1. - act*.3) + vec2(sin(t*.3+fl)*1.5 + act*t*(fl - 1.)*1.2, (apo>.5 ? 1. : -1.)*t*(1.2+fl*.6)*(1. + act*1.4));
    vec2 id = floor(g), f = fract(g) - .5;
    float r = h21(id + fl*13.); vec2 o = vec2(h21(id+2.3), h21(id+5.9)) - .5;
    float dd = length((f - o*.6)*vec2(1., 1. - act*.62));
    float on = step(apo > .5 ? .7 : (act > .5 ? .955 : .83), r);
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
  col = mix(col, vec3(r*.08, g*.42, b*.5), uP0.y);
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

  // космос: туманность + звёзды с варпом. uP0.x скорость варпа, uP1/uP2 цвета туманности
  space: `
void main(){
  vec2 fc = gl_FragCoord.xy; float t = uTime;
  vec2 p = (fc - .5*uRes)/uRes.y;
  p += ((uMouse - .5*uRes)/uRes.y)*.03;
  vec3 q = vec3(p*1.2, t*.012);
  vec2 w = vec2(fbm3(q), fbm3(q + vec3(3.1,1.7,.4)));
  float n = fbm(vec3(p*1.6 + w*1.9, t*.018));
  float n2 = fbm(vec3(p*2.8 - w*1.2, t*.025 + 4.));
  vec3 col = vec3(.003,.004,.011);
  col += uP1.rgb*pow(n, 3.2)*2.2 + uP2.rgb*pow(n2, 4.)*2.;
  col *= .35 + .65*smoothstep(.28, .62, fbm3(vec3(p*3.5 + w*2.2, 1.)));
  float sp = uP0.x;
  vec2 dir = normalize(p + 1e-4);
  for(int i=0;i<5;i++){
    float fi = float(i);
    float z = fract(fi*.2 + uP0.y*.035);
    float sc = mix(22., 2., z);
    float fade = smoothstep(0., .35, z)*smoothstep(1., .8, z);
    vec2 g = p*sc + fi*7.31; vec2 id = floor(g), f = fract(g) - .5;
    float r = h21(id + fi*3.7); vec2 o = vec2(h21(id+1.3), h21(id+2.7)) - .5;
    vec2 d = f - o*.6;
    float al = dot(d, dir), pe = dot(d, vec2(-dir.y, dir.x));
    float st = 1. + sp*z*z*length(p)*9.;
    float s = exp(-((al*al)/(st*st) + pe*pe)*1400.) + exp(-dot(d,d)*90.)*.04;
    vec3 sc3 = mix(vec3(.75,.85,1.), vec3(1.,.85,.65), h21(id+9.1));
    col += sc3 * s * step(.72, r) * fade * (.7 + .3*sin(t*3. + r*60.)) * 1.6;
  }
  // яркие звёзды с лучами
  for(int i=0;i<4;i++){
    float fi = float(i);
    vec2 c = vec2((h21(vec2(fi, 3.)) - .5)*1.6, (h21(vec2(fi, 8.)) - .5)*.9);
    vec2 d = p - c; float dd = length(d);
    float spk = exp(-abs(d.x)*260.)*exp(-abs(d.y)*14.) + exp(-abs(d.y)*260.)*exp(-abs(d.x)*14.);
    col += mix(vec3(.7,.8,1.), vec3(1.,.8,.6), h21(vec2(fi,5.))) * (.00025/(dd*dd + .00025) + spk*.35) * (.8+.2*sin(t*1.7+fi));
  }
  col *= smoothstep(1.5, .3, length(p*vec2(.8, 1.)));
  col = tone(col*1.5) + grain(fc, t)*.03;
  gl_FragColor = vec4(col*uAlpha, uAlpha);
}`,

  // неоновый город под дождём с мокрым асфальтом. uP0.x — палитра антиутопии (красный смог)
  neon: `
vec3 pal(float h){
  if (uP0.x > .5) return h < .45 ? vec3(1.,.13,.06) : (h < .8 ? vec3(1.,.48,.1) : vec3(.9,.85,.75));
  return h < .4 ? vec3(1.,.12,.65) : (h < .75 ? vec3(.08,.78,1.) : vec3(.55,.3,1.));
}
vec3 city(vec2 p, float bl){
  float t = uTime;
  vec3 haze = uP0.x > .5 ? vec3(.22,.06,.03) : vec3(.12,.04,.16);
  vec3 c = haze*(.25 + .5*smoothstep(.6, -.1, p.y))*(.6 + .4*fbm3(vec3(p*2., t*.03)));
  float bx = floor(p.x*7.); float top = -.02 + h21(vec2(bx, 4.))*.5;
  float inb = step(p.y, top);
  vec2 wg = p*vec2(70., 90.); float win = step(.95, h21(floor(wg))) * step(.35, fract(wg.x)) * step(.4, fract(wg.y)) * (.4 + .6*h21(floor(wg)+1.));
  c = mix(c, vec3(.006,.006,.01) + mix(vec3(1.,.8,.55), pal(h21(floor(wg)+3.)), .5)*win*.07, inb*.9);
  for(int i=0;i<10;i++){
    float fi = float(i);
    vec2 ctr = vec2((h21(vec2(fi,1.)) - .5)*2.2, -.02 + h21(vec2(fi,2.))*.42);
    vec2 sz = vec2(.025 + h21(vec2(fi,3.))*.1, .008 + h21(vec2(fi,4.))*.025);
    if (h21(vec2(fi,8.)) < .45) sz = vec2(sz.y*1.3, sz.x*.9);
    vec2 d = abs(p - ctr) - sz; float sd = length(max(d, 0.)) + min(max(d.x, d.y), 0.);
    float fl = step(.06, h21(vec2(fi, floor(t*7.)))) * (h21(vec2(fi,6.)) < .15 ? step(.5, fract(t*.4 + fi)) : 1.);
    float tube = smoothstep(.004 + bl, 0., abs(sd + .002)) + smoothstep(bl + .002, -.004, sd)*.25;
    c += pal(h21(vec2(fi,5.))) * (tube*1.3 + exp(-max(sd, 0.)*(22./(1. + bl*30.)))*.32) * fl;
  }
  return c;
}
void main(){
  vec2 fc = gl_FragCoord.xy; float t = uTime;
  vec2 p = (fc - .5*uRes)/uRes.y;
  float hz = -.2; vec3 col;
  if (p.y > hz) col = city(p, 0.);
  else {
    float dpt = hz - p.y;
    vec2 rg = p*vec2(9., 22.); vec2 id = floor(rg), f = fract(rg) - .5;
    float ph = fract(t*.9 + h21(id)*7.); float ring = sin((length(f*vec2(1.,2.4)) - ph*.5)*40.)*smoothstep(.5, .1, length(f))*(1. - ph);
    float wob = (fbm3(vec3(p*vec2(4., 30.), t*.5)) - .5)*.035 + ring*.006;
    vec2 rp = vec2(p.x + wob, hz + dpt*.55);
    vec3 r = city(rp, .03) + city(rp + vec2(0., .045), .07)*1.1;
    col = r*(.42 - dpt*.35) + vec3(.004);
    col += pal(.5)*.0;
  }
  float rq = p.x*60. + p.y*9.; float rid = floor(rq), rr = h21(vec2(rid, 2.));
  float streak = smoothstep(.93, 1., fract(p.y*(1.5 + rr) + t*(2.6 + rr*1.5) + rr*9.)) * step(.55, rr) * smoothstep(.5, .1, abs(fract(rq) - .5));
  col += streak*(uP0.x > .5 ? vec3(.5,.25,.18) : vec3(.35,.3,.5))*.5;
  col += (uP0.x > .5 ? vec3(.3,.08,.02) : vec3(.1,.03,.14))*fbm3(vec3(p*1.5 + vec2(t*.03, 0.), t*.05))*.35;
  col *= smoothstep(1.4, .3, length(p*vec2(.8, 1.1)));
  col = tone(col*1.6) + grain(fc, t)*.04;
  gl_FragColor = vec4(col*uAlpha, uAlpha);
}`,

  // волшебная пыль и лучи света. uP0.x лепестки (аниме), uP0.y разноцветные искры, uP0.zw источник; uP1 тень, uP2 свет
  magic: `
void main(){
  vec2 fc = gl_FragCoord.xy, uv = fc/uRes; float t = uTime; float asp = uRes.x/uRes.y;
  vec2 p = (fc - .5*uRes)/uRes.y;
  vec2 S = vec2((uP0.z - .5)*asp, uP0.w - .5);
  vec2 d = p - S; float dist = length(d); float an = atan(d.y, d.x);
  float rays = n3(vec3(an*9., t*.12, 0.))*.6 + n3(vec3(an*23., t*.2, 3.))*.4;
  rays = pow(rays, 2.2);
  float fog = fbm(vec3(p*1.4 + vec2(t*.015, -t*.01), t*.04));
  vec3 col = uP1.rgb*(.4 + .8*fog);
  float sh = exp(-dist*1.1);
  col += uP2.rgb*rays*sh*(.35 + fog*.9)*1.4;
  col += uP2.rgb*(.004/(dist*dist + .004))*.9;
  for(int L=0; L<3; L++){
    float fl = float(L), sc = 9. + fl*9.;
    vec2 g = p*sc + vec2(sin(t*.17 + fl)*1.3 + t*(.12 + fl*.05)*(uP0.x > .5 ? 1.6 : .3), (uP0.x > .5 ? 1. : -.35)*t*(.35 + fl*.15));
    vec2 id = floor(g), f = fract(g) - .5;
    float r = h21(id + fl*17.); vec2 o = vec2(h21(id+2.3), h21(id+5.9)) - .5;
    vec2 q = f - o*.55;
    float on = step(.8 + fl*.04, r);
    float dof = (2. - fl)*.6;
    float tw = .5 + .5*sin(t*(2. + r*3.) + r*40.);
    vec3 pc = mix(uP2.rgb, vec3(1., .86, .58), h21(id + 4.4)*.7);
    if (uP0.y > .5) pc = .55 + .45*cos(6.283*(r*3. + vec3(0., .33, .67)));
    if (uP0.x > .5) {
      float a = t*(1. + r*2.) + r*20.; mat2 R = mat2(cos(a), sin(a), -sin(a), cos(a));
      vec2 pq = R*q*vec2(1., 1.8); float pe = smoothstep(.12 + dof*.05, .08, length(pq) + abs(pq.x)*.25);
      col += vec3(1., .72, .8)*pe*on*(.35 + .4*(1. - fl*.3))*(.6 + sh*1.6);
    } else {
      float dd = length(q);
      float core = exp(-dd*dd*(2600./(1. + dof*dof*14.)))*(1. - dof*.35);
      float halo = exp(-dd*dd*90.)*.1;
      col += pc*on*(core*(.5 + 1.2*tw) + halo*tw)*(.35 + sh*2.2 + rays*sh*2.);
    }
  }
  col *= smoothstep(1.45, .25, length(p*vec2(.8, 1.05)));
  col = tone(col*1.45) + grain(fc, t)*.035;
  gl_FragColor = vec4(col*uAlpha, uAlpha);
}`,

  // тёплое боке огней за окном. uP0.x рама окна, uP1/uP2/uP3 — палитра (uP2.w оттенок), uP0.y запотевание
  bokeh: `
void main(){
  vec2 fc = gl_FragCoord.xy, uv = fc/uRes; float t = uTime; float asp = uRes.x/uRes.y;
  vec2 p = (fc - .5*uRes)/uRes.y;
  vec3 col = mix(uP1.rgb*.07, uP1.rgb*.015, uv.y) + uP1.rgb*.06*fbm3(vec3(p*1.2, t*.02));
  for(int L=0; L<3; L++){
    float fl = float(L);
    for(int i=0;i<9;i++){
      float fi = float(i) + fl*9.;
      vec2 c = vec2((fract(h21(vec2(fi,1.)) + t*.004*(h21(vec2(fi,2.)) - .5)*(3. - fl)) - .5)*asp*1.15,
                    (h21(vec2(fi,3.)) - .5)*1.05 + sin(t*.15 + fi)*.008);
      float rad = mix(.03, .085, h21(vec2(fi,4.)))*(1. + (2. - fl)*1.1);
      float hh = h21(vec2(fi,5.));
      vec3 lc = hh < .45 ? uP1.rgb : (hh < .8 ? uP2.rgb : vec3(1., .92, .78));
      vec2 q = (p - c)/rad;
      float d = length(q);
      float soft = .06 + (2. - fl)*.07;
      float disk = smoothstep(1., 1. - soft, d);
      float rim = smoothstep(.55, .98, d)*disk;
      float cat = 1.;
      float tex = .92 + .08*sin(q.x*7. + fi)*sin(q.y*6. - fi);
      float b = (.16 + .24*h21(vec2(fi,7.)))*(.6 + fl*.3)*(.85 + .15*sin(t*.4 + fi*2.));
      col += lc*disk*(.6*tex + .5*rim)*b*cat;
    }
  }
  // мягкий тёплый свет лампы и запотевшее стекло
  col += uP1.rgb*.22*exp(-length(p - vec2(-.55*asp*.5, -.35))*2.);
  float fog = fbm(vec3(p*2.4, t*.015));
  col = mix(col, col*.8 + uP1.rgb*.025, uP0.y*smoothstep(.35, .7, fog));
  col *= smoothstep(1.45, .3, length(p*vec2(.78, 1.05)));
  col = tone(col*1.6) + grain(fc, t)*.03;
  gl_FragColor = vec4(col*uAlpha, uAlpha);
}`,

  // концертные лучи в дыму, бит 120 BPM, силуэты зала
  beams: `
vec3 hue(float h){ return .5 + .5*cos(6.283*(h + vec3(0., .33, .67))); }
void main(){
  vec2 fc = gl_FragCoord.xy, uv = fc/uRes; float t = uTime; float asp = uRes.x/uRes.y;
  vec2 p = (fc - .5*uRes)/uRes.y;
  float beat = exp(-fract(t*2.)*5.); float bar = floor(t*.5);
  float haze = fbm(vec3(p*1.6 + vec2(t*.03, t*.01), t*.05));
  haze = .25 + haze*haze*1.6;
  vec3 col = vec3(.01,.006,.016);
  for(int i=0;i<7;i++){
    float fi = float(i);
    vec2 S = vec2((fi/6. - .5)*asp*1.1, .58);
    float a = -1.5708 + sin(t*(.35 + h21(vec2(fi,1.))*.4) + fi*1.7 + bar*.7)*.55;
    vec2 dir = vec2(cos(a), sin(a));
    vec2 d = p - S; float along = dot(d, dir); float perp = abs(dot(d, vec2(-dir.y, dir.x)));
    float wdt = .012 + along*.075;
    float b = smoothstep(wdt, wdt*.15, perp)*step(0., along)*exp(-along*.7);
    vec3 c = hue(fract(fi*.13 + bar*.21 + t*.02));
    col += c*b*haze*(.5 + .6*beat*step(.5, h21(vec2(fi, bar))))*.9;
    col += c*(.0012/(dot(d,d) + .0012))*.8;
  }
  float crowd = -.47;
  for(int r=0;r<2;r++){
    float fr = float(r); float cx = p.x*(11. + fr*5.) + fr*.37; float cid = floor(cx); float lx = fract(cx) - .5;
    float hy = -.4 - fr*.05 + h21(vec2(cid, fr))*.035 + .006*sin(t*3.8 + cid);
    float head = sqrt(max(0., .1 - lx*lx*.5))*.18;
    crowd = max(crowd, hy + head - .03 + smoothstep(.5, .2, abs(lx))*.0);
    crowd = max(crowd, (abs(lx) < .42 ? hy - .045 + .02*(1. - abs(lx)*2.) : -.6));
  }
  float hx = p.x*6.3 + .3; float hand = step(abs(fract(hx) - .5), .018)*step(p.y, crowd + .09 + .03*sin(t*4. + floor(hx)))*step(.7, h21(vec2(floor(hx), 1.)));
  float sil = max(step(p.y, crowd), hand);
  col += vec3(.25,.12,.35)*smoothstep(-.1, -.5, p.y)*(.3 + beat*.25);
  col *= 1. - sil*.96;
  col *= smoothstep(1.5, .3, length(p*vec2(.75, 1.)));
  col = tone(col*1.5) + grain(fc, t)*.04;
  gl_FragColor = vec4(col*uAlpha, uAlpha);
}`,

  // пыльная буря и жёсткое солнце. uP0.x плотность пыли, uP0.zw солнце
  dust: `
void main(){
  vec2 fc = gl_FragCoord.xy, uv = fc/uRes; float t = uTime; float asp = uRes.x/uRes.y;
  vec2 p = (fc - .5*uRes)/uRes.y;
  float hz = -.18;
  vec2 S = vec2((uP0.z - .5)*asp, uP0.w - .5);
  float shim = (n3(vec3(p*vec2(6., 40.), t*2.)) - .5)*.006*smoothstep(.15, 0., abs(p.y - hz));
  vec2 ps = p + vec2(shim, shim*.5);
  vec3 sky = mix(vec3(1.3, .95, .6), vec3(.35, .16, .08), smoothstep(hz, .6, ps.y));
  float ds = length(ps - S);
  sky += vec3(1., .85, .6)*(.03/(ds*ds + .03))*.9 + vec3(1.,.95,.85)*(.0015/(ds*ds + .0015))*2. + vec3(1.,.98,.92)*smoothstep(.05, .04, ds)*5.;
  float mesa = hz + .02 + .09*smoothstep(.42, .5, n3(vec3(ps.x*1.8 + 3., 1., 0.)))*(.8 + .2*n3(vec3(ps.x*9., 2., 0.))) + .008*n3(vec3(ps.x*30., 0., 0.));
  vec3 col = sky;
  col = mix(col, mix(vec3(.16,.08,.04), vec3(.55,.34,.2), smoothstep(-.1, .05, ps.y - hz)*.0 + .35*smoothstep(-.6, hz, ps.y)), smoothstep(.003, -.003, ps.y - mesa));
  float dens = uP0.x;
  for(int L=0; L<3; L++){
    float fl = float(L);
    vec3 q = vec3(p*vec2(1.2 + fl*.8, 2.2 + fl) + vec2(-t*(.35 + fl*.35), 0.), t*.1 + fl*3.);
    float n = fbm(q + vec3(fbm3(q*.7)*1.5, 0., 0.));
    float a = smoothstep(.35, .9, n)*dens*(.45 - fl*.08)*(.6 + .6*smoothstep(.3, -.5, p.y));
    vec3 dc = mix(vec3(.55,.32,.16), vec3(1., .78, .48), exp(-ds*1.8));
    col = mix(col, dc, a);
  }
  vec2 g = p*vec2(9., 60.) + vec2(-t*9., 0.); vec2 id = floor(g); vec2 f = fract(g) - .5;
  float grainS = step(.93, h21(id))*smoothstep(.5, 0., abs(f.y)*2.)*smoothstep(.5, .1, abs(f.x));
  col += vec3(1., .8, .55)*grainS*.07*dens;
  col *= smoothstep(1.6, .35, length(p*vec2(.78, 1.05)));
  col = tone(col*1.5) + grain(fc, t)*.05;
  gl_FragColor = vec4(col*uAlpha, uAlpha);
}`,

  // радужные мыльные пузыри в тёплом свете (комедия)
  bubbles: `
void main(){
  vec2 fc = gl_FragCoord.xy, uv = fc/uRes; float t = uTime; float asp = uRes.x/uRes.y;
  vec2 p = (fc - .5*uRes)/uRes.y;
  vec3 col = mix(vec3(.16,.09,.05), vec3(.05,.07,.09), uv.y);
  col += vec3(1., .66, .3)*(.06/(dot(p - vec2(.55*asp*.6, .45), p - vec2(.55*asp*.6, .45)) + .06))*.18;
  for(int i=0;i<8;i++){
    float fi = float(i);
    vec2 c = vec2((h21(vec2(fi,1.)) - .5)*asp, (h21(vec2(fi,2.)) - .5)); float r = mix(.06, .16, h21(vec2(fi,3.)));
    col += mix(vec3(1.,.7,.35), vec3(.4,.85,.9), h21(vec2(fi,4.)))*smoothstep(r, r*.2, length(p - c))*.05;
  }
  for(int i=0;i<12;i++){
    float fi = float(i);
    float sp = .025 + h21(vec2(fi,5.))*.035;
    float y = fract(h21(vec2(fi,6.)) + t*sp);
    float r = mix(.035, .13, h21(vec2(fi,7.)));
    vec2 c = vec2((h21(vec2(fi,8.)) - .5)*asp*1.05 + sin(t*.6 + fi*2.)*.04, mix(-.7, .75, y));
    vec2 q = (p - c)/r;
    q *= vec2(1. + .03*sin(t*3. + fi), 1. - .03*sin(t*3. + fi));
    float d = length(q);
    if (d < 1.03) {
      float edge = smoothstep(1.02, .98, d);
      float film = pow(d, 6.)*edge;
      float thick = d*d*1.2 + n3(vec3(q*2., t*.4 + fi))*.8 + t*.05 + q.y*.6;
      vec3 iri = .5 + .5*cos(6.283*(thick + vec3(0., .33, .67)));
      float body = (.05 + .9*film)*edge;
      vec2 hl = q - vec2(-.42, .45);
      float spec = smoothstep(.3, .0, length(hl*vec2(1., 1.6)))*.9 + smoothstep(.12, 0., length(q - vec2(.5, -.5)))*.25;
      float fade = smoothstep(0., .08, y)*smoothstep(1., .85, y);
      col += (iri*body*.75 + vec3(1.)*spec*edge)*fade;
    }
  }
  col *= smoothstep(1.5, .3, length(p*vec2(.78, 1.05)));
  col = tone(col*1.45) + grain(fc, t)*.03;
  gl_FragColor = vec4(col*uAlpha, uAlpha);
}`,
};

// какие жанры рисует GL и как берутся параметры
const shared = { bulb: 1, whisper: 0, red: 0, warp: 0 };
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
  mini: { prog: 'film', p: () => [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]] },
  detective: { prog: 'fogroom', p: () => [[.74, .74, .85, 1.5], [1., .68, .32, .75], [1., .35, 0, 0]] },
  twist: { prog: 'psycho', p: () => [[shared.whisper, 1, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]] },
  crime: { prog: 'rain', p: () => [[0, 0, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]] },
  truecrime: { prog: 'rain', p: () => [[.55, 0, .8, 0], [0, 0, 0, 0], [0, 0, 0, 0]] },
  scifi: { prog: 'space', p: (t) => { const sp = .35 + shared.warp * 2.5; shared.wph = (shared.wph || 0) + Math.min(.05, Math.max(0, t - (shared.wt || t))) * sp; shared.wt = t; return [[sp, shared.wph, 0, 0], [.18, .32, .9, 0], [.85, .25, .55, 0]]; } },
  cyberpunk: { prog: 'neon', p: () => [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]] },
  dystopia: { prog: 'neon', p: () => [[1, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]] },
  fantasy: { prog: 'magic', p: () => [[0, 0, .2, 1.05], [.05, .03, .1, 0], [.85, .7, 1., 0]] },
  family: { prog: 'magic', p: () => [[0, 0, .8, 1.02], [.07, .045, .02, 0], [1., .78, .45, 0]] },
  animation: { prog: 'magic', p: () => [[0, 1, .5, 1.1], [.06, .03, .08, 0], [1., .7, .9, 0]] },
  anime: { prog: 'magic', p: () => [[1, 0, .75, 1.05], [.06, .04, .07, 0], [1., .8, .85, 0]] },
  romance: { prog: 'bokeh', p: () => [[0, .6, 0, 0], [1., .55, .25, 0], [1., .35, .45, 0]] },
  kdrama: { prog: 'bokeh', p: () => [[0, .8, 0, 0], [1., .6, .7, 0], [.85, .8, 1., 0]] },
  sitcom: { prog: 'bokeh', p: () => [[0, .2, 0, 0], [1., .62, .3, 0], [.45, .8, .9, 0]] },
  music: { prog: 'beams', p: () => [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]] },
  western: { prog: 'dust', p: () => [[1, 0, .82, .86], [0, 0, 0, 0], [0, 0, 0, 0]] },
  adventure: { prog: 'dust', p: () => [[.35, 0, .3, .82], [0, 0, 0, 0], [0, 0, 0, 0]] },
  action: { prog: 'smoke', p: () => [[0, 1, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]] },
  comedy: { prog: 'bubbles', p: () => [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]] },
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
