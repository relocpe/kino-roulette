// Фоновые эффекты жанров: один canvas, у каждого эффекта свой init/draw/burst.
const R = Math.random;
const rr = (a, b) => a + R() * (b - a);
const TAU = Math.PI * 2;

const canvas = document.getElementById('fx');
const ctx = canvas.getContext('2d', { alpha: true });
const root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const coarse = matchMedia('(pointer: coarse)').matches;
let W = 0, H = 0, DPR = 1, SCALE = 1;
const pointer = { x: -1, y: -1, active: false };

const sprites = {};
function glow(color, size = 64) {
  const k = color + size;
  if (sprites[k]) return sprites[k];
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, color);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  return (sprites[k] = c);
}
function blob(x, y, r, img, a) { ctx.globalAlpha = a; ctx.drawImage(img, x - r, y - r, r * 2, r * 2); }
const N = (n) => Math.max(6, Math.round(n * SCALE));
function vignette(color, inner = 0.45, a = 1) {
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * inner, W / 2, H / 2, Math.hypot(W, H) / 1.6);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, color);
  ctx.globalAlpha = a;
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}
function heart(x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.3);
  ctx.bezierCurveTo(x, y, x - s * 0.5, y - s * 0.1, x - s * 0.5, y + s * 0.25);
  ctx.bezierCurveTo(x - s * 0.5, y + s * 0.55, x, y + s * 0.75, x, y + s);
  ctx.bezierCurveTo(x, y + s * 0.75, x + s * 0.5, y + s * 0.55, x + s * 0.5, y + s * 0.25);
  ctx.bezierCurveTo(x + s * 0.5, y - s * 0.1, x, y, x, y + s * 0.3);
  ctx.fill();
}
const stage = () => document.querySelector('.stage');
function cssPulse(cls, ms) {
  if (reduce.matches) return;
  const el = document.body;
  el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), ms);
}

// ---------- эффекты ----------
const FX = {};

FX.idle = {
  init(s) { s.p = Array.from({ length: N(60) }, () => ({ x: rr(0, W), y: rr(0, H), r: rr(0.6, 1.8), v: rr(4, 12), o: rr(0, TAU) })); },
  draw(s, t, dt, a) {
    const g = glow('rgba(255,214,160,1)', 32);
    for (const p of s.p) {
      p.y -= p.v * dt; p.x += Math.sin(t * 0.3 + p.o) * 6 * dt;
      if (p.y < -5) { p.y = H + 5; p.x = rr(0, W); }
      blob(p.x, p.y, p.r * 3, g, a * 0.35 * (0.6 + 0.4 * Math.sin(t + p.o)));
    }
  },
};

FX.horror = {
  init(s) { s.fog = Array.from({ length: N(10) }, () => ({ x: rr(0, W), y: rr(H * 0.3, H), r: rr(200, 420), v: rr(6, 18) })); s.fl = 0; s.next = 1; },
  draw(s, t, dt, a) {
    const g = glow('rgba(120,110,110,1)', 128);
    for (const f of s.fog) { f.x += f.v * dt; if (f.x - f.r > W) f.x = -f.r; blob(f.x, f.y, f.r, g, a * 0.09); }
    s.next -= dt;
    if (s.next < 0) { s.fl = rr(0.12, 0.22); s.next = rr(1.2, 4); }
    s.fl = Math.max(0, s.fl - dt);
    vignette('rgba(30,0,0,0.95)', 0.25, a);
    if (s.fl > 0) { ctx.globalAlpha = a * 0.45; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
  },
  burst(s) { s.fl = 0.2; setTimeout(() => (s.fl = 0.16), 380); },
};

FX.thriller = {
  init(s) { s.g = 0; s.lines = []; s.next = 2; },
  draw(s, t, dt, a) {
    const beat = t % 1.3, k = Math.exp(-beat * 7) + 0.6 * Math.exp(-Math.max(0, beat - 0.22) * 7) * (beat > 0.22);
    vignette(`rgba(170,10,10,${0.35 + 0.45 * k})`, 0.3, a);
    s.next -= dt;
    if (s.next < 0) { s.next = rr(2, 4.5); s.lines = Array.from({ length: 3 + (R() * 3 | 0) }, () => ({ y: rr(0, H), h: rr(1, 6), x: rr(-40, 40), life: rr(0.08, 0.18) })); }
    ctx.globalAlpha = a * 0.6;
    for (const l of s.lines) { l.life -= dt; if (l.life > 0) { ctx.fillStyle = 'rgba(255,40,40,.7)'; ctx.fillRect(l.x, l.y, W, l.h); } }
    if (s.g > 0) { s.g -= dt; ctx.globalAlpha = a * 0.25; for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? '#0ff' : '#f00'; ctx.fillRect(0, rr(0, H), W, rr(2, 18)); } }
  },
  burst(s) { s.g = 0.22; cssPulse('fx-glitch', 260); },
};

FX.scifi = {
  init(s) { s.st = Array.from({ length: N(260) }, () => ({ x: rr(-1, 1), y: rr(-1, 1), z: rr(0.05, 1) })); s.warp = 0; },
  draw(s, t, dt, a) {
    const cx = W / 2, cy = H / 2, sp = 0.06 + s.warp * 1.6;
    s.warp = Math.max(0, s.warp - dt * 0.8);
    ctx.globalAlpha = a; ctx.strokeStyle = '#cfe0ff'; ctx.lineCap = 'round';
    for (const p of s.st) {
      const z0 = p.z; p.z -= sp * dt;
      if (p.z <= 0.02) { p.x = rr(-1, 1); p.y = rr(-1, 1); p.z = 1; continue; }
      const k = Math.max(W, H) * 0.5;
      const x = cx + (p.x / p.z) * k, y = cy + (p.y / p.z) * k, x0 = cx + (p.x / z0) * k, y0 = cy + (p.y / z0) * k;
      ctx.globalAlpha = a * Math.min(1, (1 - p.z) * 1.4);
      ctx.lineWidth = (1 - p.z) * 2.2;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x + (x - x0) * s.warp * 4, y + (y - y0) * s.warp * 4); ctx.stroke();
    }
  },
  burst(s, k) { s.warp = 1 * k; },
};

FX.fantasy = {
  init(s) { s.p = Array.from({ length: N(110) }, () => mote()); s.ring = []; function mote() { return { x: rr(0, W), y: rr(0, H), v: rr(10, 34), o: rr(0, TAU), r: rr(1, 3), c: R() < 0.6 ? 0 : 1 }; } s.mote = mote; },
  draw(s, t, dt, a) {
    ctx.globalCompositeOperation = 'lighter';
    const g = [glow('rgba(190,150,255,1)', 32), glow('rgba(255,215,140,1)', 32)];
    for (const p of s.p) {
      p.y -= p.v * dt; p.x += Math.sin(t * 1.2 + p.o) * 14 * dt;
      if (p.y < -10) Object.assign(p, s.mote(), { y: H + 10 });
      blob(p.x, p.y, p.r * 4, g[p.c], a * (0.35 + 0.35 * Math.sin(t * 3 + p.o)));
    }
    for (const q of s.ring) { q.l -= dt; q.r += q.v * dt; q.v *= 0.97; blob(W / 2 + Math.cos(q.a) * q.r, H * 0.42 + Math.sin(q.a) * q.r, 6, g[q.c], a * Math.max(0, q.l)); q.a += dt * 1.4; }
    s.ring = s.ring.filter((q) => q.l > 0);
    ctx.globalCompositeOperation = 'source-over';
  },
  burst(s, k) { for (let i = 0; i < 90 * k; i++) s.ring.push({ a: (i / 90) * TAU * 3, r: 10, v: rr(140, 420), l: rr(0.8, 1.6), c: i % 2 }); },
};

FX.action = {
  init(s) { s.p = []; s.acc = 0; },
  spawn(s, x, y, n, f) { for (let i = 0; i < n; i++) { const an = rr(-Math.PI * 0.95, -Math.PI * 0.05), v = rr(200, 650) * f; s.p.push({ x, y, vx: Math.cos(an) * v, vy: Math.sin(an) * v, l: rr(0.5, 1.2) }); } },
  draw(s, t, dt, a) {
    s.acc += dt * 30 * SCALE;
    while (s.acc > 1) { s.acc--; FX.action.spawn(s, R() < 0.5 ? rr(0, W * 0.2) : rr(W * 0.8, W), H + 4, 1, 0.8); }
    ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (const p of s.p) {
      p.vy += 520 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.l -= dt;
      ctx.globalAlpha = a * Math.max(0, Math.min(1, p.l * 1.5));
      ctx.strokeStyle = p.l > 0.6 ? '#fff3c4' : '#ff8a2a'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); ctx.stroke();
    }
    s.p = s.p.filter((p) => p.l > 0 && p.y < H + 40);
    ctx.globalCompositeOperation = 'source-over';
    vignette('rgba(60,20,0,.7)', 0.5, a);
  },
  burst(s, k) {
    const st = stage()?.querySelector('.gate')?.getBoundingClientRect();
    const x = st ? st.left + st.width / 2 : W / 2, y = st ? st.top + st.height / 2 : H / 2;
    for (let i = 0; i < 140 * k; i++) { const an = rr(0, TAU), v = rr(150, 900); s.p.push({ x, y, vx: Math.cos(an) * v, vy: Math.sin(an) * v, l: rr(0.5, 1.3) }); }
    if (k >= 1) cssPulse('fx-shake', 380);
  },
};

const CONF = ['#ffd23f', '#ff5d73', '#4cc9f0', '#f8f3e6', '#ff9f1c', '#b388ff'];
FX.comedy = {
  init(s) { s.p = Array.from({ length: N(26) }, () => ({ x: rr(0, W), y: rr(-H, H), vx: rr(-10, 10), vy: rr(30, 60), r: rr(0, TAU), vr: rr(-3, 3), c: CONF[R() * 6 | 0], w: rr(6, 10), drift: true })); },
  draw(s, t, dt, a) {
    for (const p of s.p) {
      if (p.drift) { p.y += p.vy * dt; if (p.y > H + 20) { p.y = -20; p.x = rr(0, W); } }
      else {
        p.vy += 900 * dt; p.vx *= 0.995; p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.y > H - 6 && p.vy > 0) { p.y = H - 6; p.vy *= -rr(0.35, 0.55); p.vx *= 0.7; p.b = (p.b || 0) + 1; }
        p.l -= dt;
      }
      p.r += p.vr * dt;
      ctx.globalAlpha = a * (p.drift ? 0.55 : Math.min(1, p.l));
      ctx.fillStyle = p.c;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.scale(1, Math.cos(t * 6 + p.r * 3)); ctx.fillRect(-p.w / 2, -p.w * 0.3, p.w, p.w * 0.6); ctx.restore();
    }
    s.p = s.p.filter((p) => p.drift || p.l > 0);
  },
  burst(s, k) {
    for (let i = 0; i < 170 * k; i++) {
      const left = i % 2, an = left ? rr(-1.35, -0.85) : rr(-2.3, -1.8), v = rr(700, 1250);
      s.p.push({ x: left ? 0 : W, y: H, vx: Math.cos(an) * v, vy: Math.sin(an) * v, r: rr(0, TAU), vr: rr(-12, 12), c: CONF[R() * 6 | 0], w: rr(7, 12), l: rr(2.2, 3.4) });
    }
  },
};

FX.drama = {
  init(s) {
    s.drops = Array.from({ length: N(260) }, () => ({ x: rr(0, W), y: rr(0, H), r: R() < 0.85 ? rr(1.2, 3.4) : rr(4, 7) }));
    s.run = Array.from({ length: N(22) }, () => ({ x: rr(0, W), y: rr(-H, H), r: rr(4, 7.5), v: rr(40, 120), w: rr(0, TAU) }));
  },
  draw(s, t, dt, a) {
    ctx.globalAlpha = a * 0.5; ctx.fillStyle = 'rgba(40,60,80,.35)'; ctx.fillRect(0, 0, W, H);
    const hl = 'rgba(225,238,255,.75)', sh = 'rgba(0,0,0,.5)';
    for (const d of s.drops) { drop(d.x, d.y, d.r); }
    for (const d of s.run) {
      d.y += d.v * dt * (0.6 + 0.4 * Math.sin(t * 2 + d.w)); d.x += Math.sin(t + d.w) * 4 * dt;
      if (d.y > H + 10) { d.y = -10; d.x = rr(0, W); }
      ctx.globalAlpha = a * 0.3; ctx.strokeStyle = hl; ctx.lineWidth = d.r * 0.55;
      ctx.beginPath(); ctx.moveTo(d.x - Math.sin(t + d.w) * 6, d.y - 160); ctx.lineTo(d.x, d.y); ctx.stroke();
      drop(d.x, d.y, d.r);
    }
    function drop(x, y, r) {
      ctx.globalAlpha = a * 0.5; ctx.fillStyle = sh; ctx.beginPath(); ctx.ellipse(x, y + r * 0.3, r, r * 1.15, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = a * 0.7; ctx.fillStyle = hl; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.4, 0, TAU); ctx.fill();
    }
  },
};

FX.romance = {
  init(s) {
    s.b = Array.from({ length: N(26) }, () => ({ x: rr(0, W), y: rr(0, H), r: rr(30, 110), v: rr(6, 16), c: R() < 0.5 ? 0 : 1, o: rr(0, TAU) }));
    s.h = Array.from({ length: N(12) }, () => ({ x: rr(0, W), y: rr(0, H), s: rr(8, 16), v: rr(14, 30), o: rr(0, TAU) }));
    s.pop = [];
  },
  draw(s, t, dt, a) {
    const g = [glow('rgba(255,120,160,1)', 128), glow('rgba(255,190,150,1)', 128)];
    for (const b of s.b) { b.y -= b.v * dt; if (b.y < -b.r) { b.y = H + b.r; b.x = rr(0, W); } blob(b.x + Math.sin(t * 0.4 + b.o) * 20, b.y, b.r, g[b.c], a * 0.16); }
    ctx.fillStyle = '#ff8fb0';
    for (const h of s.h.concat(s.pop)) {
      h.y -= h.v * dt; h.x += Math.sin(t + h.o) * 10 * dt;
      if (h.l !== undefined) { h.l -= dt; h.x += h.vx * dt; h.vx *= 0.98; }
      else if (h.y < -20) { h.y = H + 20; h.x = rr(0, W); }
      ctx.globalAlpha = a * (h.l !== undefined ? Math.max(0, h.l) * 0.8 : 0.32);
      heart(h.x, h.y, h.s);
    }
    s.pop = s.pop.filter((h) => h.l > 0);
  },
  burst(s, k) { for (let i = 0; i < 40 * k; i++) s.pop.push({ x: W / 2 + rr(-60, 60), y: H * 0.5, s: rr(10, 22), v: rr(60, 220), vx: rr(-260, 260), o: rr(0, TAU), l: rr(1, 2) }); },
};

FX.crime = {
  init(s) { s.snap = 0; },
  draw(s, t, dt, a) {
    let x = W * (0.5 + 0.32 * Math.sin(t * 0.23)), y = H * (0.45 + 0.25 * Math.sin(t * 0.31 + 1));
    if (s.snap > 0) { s.snap -= dt; const k = Math.min(1, s.snap); x = x * (1 - k) + W * 0.62 * k; y = y * (1 - k) + H * 0.4 * k; }
    const g = ctx.createRadialGradient(x, y, 0, x, y, Math.min(W, H) * 0.42);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.55, 'rgba(0,0,0,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0.88)');
    ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    blob(x, y, Math.min(W, H) * 0.35, glow('rgba(255,250,235,1)', 128), a * 0.08);
    ctx.globalCompositeOperation = 'source-over';
  },
  burst(s) { s.snap = 1.6; },
};

FX.mystery = {
  init(s) { s.fog = Array.from({ length: N(14) }, () => ({ x: rr(0, W), y: rr(0, H), r: rr(180, 380), v: rr(-14, 14) })); s.fx = W / 2; s.fy = H / 2; s.boost = 0; },
  draw(s, t, dt, a) {
    const g = glow('rgba(150,170,200,1)', 128);
    for (const f of s.fog) { f.x += f.v * dt; if (f.x > W + f.r) f.x = -f.r; if (f.x < -f.r) f.x = W + f.r; blob(f.x, f.y + Math.sin(t * 0.2 + f.r) * 20, f.r, g, a * 0.1); }
    const tx = pointer.active ? pointer.x : W * (0.5 + 0.35 * Math.sin(t * 0.37)), ty = pointer.active ? pointer.y : H * (0.5 + 0.3 * Math.sin(t * 0.53));
    s.fx += (tx - s.fx) * Math.min(1, dt * 5); s.fy += (ty - s.fy) * Math.min(1, dt * 5);
    s.boost = Math.max(0, s.boost - dt * 0.6);
    const r = Math.min(W, H) * (0.22 + s.boost * 0.4);
    const gr = ctx.createRadialGradient(s.fx, s.fy, r * 0.2, s.fx, s.fy, r);
    gr.addColorStop(0, 'rgba(4,6,10,0)'); gr.addColorStop(1, 'rgba(4,6,10,0.8)');
    ctx.globalAlpha = a; ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  },
  burst(s, k) { s.boost = k; },
};

FX.animation = {
  init(s) { s.b = Array.from({ length: 6 }, (_, i) => ({ h: i * 60, o: rr(0, TAU), f: rr(0.15, 0.3), j: 0 })); },
  draw(s, t, dt, a) {
    ctx.globalCompositeOperation = 'lighter';
    for (const b of s.b) {
      b.j = Math.max(0, b.j - dt * 1.5);
      const x = W * (0.5 + 0.42 * Math.sin(t * b.f + b.o)), y = H * (0.5 + 0.4 * Math.cos(t * b.f * 1.3 + b.o * 2));
      const r = Math.min(W, H) * (0.28 + 0.06 * Math.sin(t * 1.4 + b.o) + 0.15 * Math.sin(b.j * 12) * b.j);
      blob(x, y, r, glow(`hsl(${(b.h + t * 20) % 360} 90% 60%)`, 128), a * 0.2);
    }
    ctx.globalCompositeOperation = 'source-over';
  },
  burst(s) { for (const b of s.b) b.j = 1; },
};

FX.family = {
  init(s) { s.b = Array.from({ length: N(36) }, () => bub()); function bub(y) { return { x: rr(0, W), y: y ?? rr(0, H), r: rr(6, 26), v: rr(20, 60), o: rr(0, TAU) }; } s.bub = bub; s.pop = []; },
  draw(s, t, dt, a) {
    ctx.lineWidth = 1.2;
    for (const b of s.b) {
      b.y -= b.v * dt; const x = b.x + Math.sin(t * 1.5 + b.o) * 10;
      if (b.y < -30) Object.assign(b, s.bub(H + 30));
      ctx.globalAlpha = a * 0.5; ctx.strokeStyle = 'rgba(190,235,255,.8)'; ctx.beginPath(); ctx.arc(x, b.y, b.r, 0, TAU); ctx.stroke();
      ctx.globalAlpha = a * 0.6; ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.arc(x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.18, 0, TAU); ctx.fill();
    }
    for (const p of s.pop) { p.l -= dt * 2.5; p.r += dt * 60; ctx.globalAlpha = a * Math.max(0, p.l); ctx.strokeStyle = '#d7f3ff'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.stroke(); }
    s.pop = s.pop.filter((p) => p.l > 0);
  },
  burst(s, k) {
    for (const b of s.b.slice(0, 14 * k)) { s.pop.push({ x: b.x, y: b.y, r: b.r, l: 1 }); Object.assign(b, s.bub(H + rr(10, 200))); }
    for (let i = 0; i < 24 * k; i++) s.b.push(Object.assign(s.bub(H + rr(0, 120)), { v: rr(120, 260) }));
    s.b = s.b.slice(-N(70));
  },
};

FX.documentary = {
  init(s) { s.d = Array.from({ length: N(70) }, () => ({ u: R(), v: R(), s: rr(0.6, 1.8), o: rr(0, TAU) })); s.scr = []; },
  draw(s, t, dt, a) {
    const fl = 0.85 + 0.15 * Math.sin(t * 47) * Math.sin(t * 13);
    const ox = -W * 0.05, oy = -H * 0.1;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(ox, oy, W * 0.8, H);
    g.addColorStop(0, 'rgba(255,225,170,0.22)'); g.addColorStop(1, 'rgba(255,225,170,0)');
    ctx.globalAlpha = a * fl; ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(W * 1.0, H * 0.45); ctx.lineTo(W * 0.45, H * 1.1); ctx.closePath(); ctx.fill();
    const sp = glow('rgba(255,235,200,1)', 32);
    for (const d of s.d) {
      d.u = (d.u + dt * 0.01) % 1; d.v = (d.v + Math.sin(t * 0.5 + d.o) * dt * 0.004 + 1) % 1;
      const x = ox + (W * 1.0 - ox) * d.u * (1 - d.v * 0.5) + (W * 0.45 - ox) * d.v * 0.5 * d.u * 2, y = oy + (H * 0.45 - oy) * d.u * (1 - d.v) + (H * 1.1 - oy) * d.v * d.u;
      blob(x, y, d.s * 3, sp, a * 0.5 * fl);
    }
    ctx.restore();
    if (R() < dt * 1.2) s.scr.push({ x: rr(0, W), l: rr(0.1, 0.35) });
    ctx.globalAlpha = a * 0.25; ctx.fillStyle = '#f5ecd8';
    for (const c of s.scr) { c.l -= dt; ctx.fillRect(c.x, 0, 1, H); }
    s.scr = s.scr.filter((c) => c.l > 0);
    vignette('rgba(10,6,0,.85)', 0.35, a);
  },
};

FX.western = {
  init(s) { s.p = Array.from({ length: N(160) }, () => ({ x: rr(0, W), y: rr(H * 0.35, H), r: rr(0.6, 2.2), v: rr(40, 120) })); s.gust = 0; },
  draw(s, t, dt, a) {
    const g = ctx.createLinearGradient(0, H, 0, H * 0.3);
    g.addColorStop(0, 'rgba(200,120,50,.35)'); g.addColorStop(1, 'rgba(200,120,50,0)');
    ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const wind = 1 + 1.5 * Math.max(0, Math.sin(t * 0.6)) + s.gust; s.gust = Math.max(0, s.gust - dt);
    const sp = glow('rgba(235,190,130,1)', 32);
    for (const p of s.p) {
      p.x += p.v * wind * dt; p.y += Math.sin(t * 2 + p.x * 0.01) * 8 * dt;
      if (p.x > W + 10) { p.x = -10; p.y = rr(H * 0.35, H); }
      blob(p.x, p.y, p.r * 3, sp, a * 0.45);
    }
  },
  burst(s, k) { s.gust = 3 * k; },
};

FX.war = {
  init(s) {
    s.sm = Array.from({ length: N(16) }, () => ({ x: rr(0, W), y: rr(H * 0.4, H * 1.2), r: rr(160, 320), v: rr(8, 20) }));
    s.e = Array.from({ length: N(90) }, () => emb()); function emb(y) { return { x: rr(0, W), y: y ?? rr(0, H), v: rr(30, 90), o: rr(0, TAU), l: rr(0.5, 1) }; } s.emb = emb;
  },
  draw(s, t, dt, a) {
    const g = glow('rgba(70,62,58,1)', 128);
    for (const m of s.sm) { m.y -= m.v * dt; m.x += Math.sin(t * 0.2 + m.r) * 6 * dt; if (m.y < -m.r) { m.y = H + m.r; m.x = rr(0, W); } blob(m.x, m.y, m.r, g, a * 0.28); }
    const gr = ctx.createLinearGradient(0, H, 0, H * 0.5); gr.addColorStop(0, 'rgba(200,70,20,.28)'); gr.addColorStop(1, 'rgba(200,70,20,0)');
    ctx.globalAlpha = a; ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    const sp = glow('rgba(255,140,50,1)', 32);
    for (const e of s.e) { e.y -= e.v * dt; e.x += Math.sin(t * 2 + e.o) * 20 * dt; if (e.y < -10) Object.assign(e, s.emb(H + 10)); blob(e.x, e.y, 5, sp, a * e.l * (0.5 + 0.5 * Math.sin(t * 9 + e.o))); }
    ctx.globalCompositeOperation = 'source-over';
  },
  burst(s, k) { for (let i = 0; i < 60 * k; i++) s.e.push(Object.assign(s.emb(H + rr(0, 60)), { v: rr(150, 360) })); s.e = s.e.slice(-N(160)); },
};

FX.music = {
  init(s) { s.n = coarse ? 28 : 56; s.hv = new Float32Array(s.n); s.kick = 0; },
  draw(s, t, dt, a) {
    const bw = W / s.n, beat = Math.exp(-((t * 2) % 1) * 6);
    s.kick = Math.max(0, s.kick - dt * 1.5);
    const g = ctx.createLinearGradient(0, H, 0, H * 0.55);
    g.addColorStop(0, 'rgba(255,79,176,.75)'); g.addColorStop(1, 'rgba(255,170,90,.15)');
    ctx.fillStyle = g;
    for (let i = 0; i < s.n; i++) {
      const f = i / s.n;
      const target = (0.25 + 0.35 * Math.abs(Math.sin(t * (1.3 + f * 3) + i * 0.7)) * (1 - f * 0.5) + beat * 0.35 * (1 - f) + s.kick * 0.6) * H * 0.32;
      s.hv[i] += (target - s.hv[i]) * Math.min(1, dt * 12);
      ctx.globalAlpha = a * 0.55;
      ctx.fillRect(i * bw + 2, H - s.hv[i], bw - 4, s.hv[i]);
      ctx.globalAlpha = a * 0.15;
      ctx.fillRect(i * bw + 2, 0, bw - 4, s.hv[i] * 0.35);
    }
  },
  burst(s, k) { s.kick = k; },
};

// ---------- поджанры ----------
FX.psycho = {
  init(s) { s.k = 0; },
  draw(s, t, dt, a) {
    const br = 0.5 + 0.5 * Math.sin(t * 1.2);
    s.k = Math.max(0, s.k - dt);
    const cx = W / 2 + Math.sin(t * 0.7) * W * 0.04, cy = H / 2 + Math.cos(t * 0.5) * H * 0.04;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(1 + 0.08 * Math.sin(t * 0.9), 1 - 0.06 * Math.sin(t * 0.9 + 1)); ctx.translate(-cx, -cy);
    const r0 = Math.min(W, H) * (0.18 + 0.12 * br + s.k * 0.2);
    const g = ctx.createRadialGradient(cx, cy, r0, cx, cy, Math.hypot(W, H) * 0.6);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.6, 'rgba(60,0,30,.55)'); g.addColorStop(1, 'rgba(0,0,0,.95)');
    ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(-W, -H, W * 3, H * 3);
    ctx.restore();
    ctx.globalCompositeOperation = 'lighter';
    const o = 6 + 10 * br;
    blob(cx - o, cy, Math.min(W, H) * 0.3, glow('rgba(255,0,60,1)', 128), a * 0.06);
    blob(cx + o, cy, Math.min(W, H) * 0.3, glow('rgba(0,200,255,1)', 128), a * 0.06);
    ctx.globalCompositeOperation = 'source-over';
    root.style.setProperty('--split', (0.6 + 1.6 * br + s.k * 4).toFixed(2) + 'px');
  },
  burst(s, k) { s.k = k; },
  end() { root.style.removeProperty('--split'); },
};

FX.detective = {
  init(s) {
    const edge = () => (R() < 0.5 ? { x: rr(0.03, 0.22), y: rr(0.1, 0.9) } : { x: rr(0.78, 0.97), y: rr(0.1, 0.9) });
    s.pins = Array.from({ length: 9 }, edge);
    s.links = s.pins.map((_, i) => [i, (i + 1 + (R() * 3 | 0)) % 9]);
    s.t0 = 0; s.lx = W / 2; s.ly = H / 2;
  },
  draw(s, t, dt, a) {
    s.t0 += dt;
    const lamp = ctx.createRadialGradient(W * 0.5, -H * 0.1, 0, W * 0.5, -H * 0.1, H * 1.1);
    lamp.addColorStop(0, 'rgba(255,200,120,.18)'); lamp.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.globalAlpha = a; ctx.fillStyle = lamp; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(200,40,40,.7)'; ctx.lineWidth = 1.2;
    s.links.forEach(([i, j], n) => {
      const p = s.pins[i], q = s.pins[j], k = Math.min(1, Math.max(0, s.t0 * 0.8 - n * 0.25));
      if (!k) return;
      const x1 = p.x * W, y1 = p.y * H, x2 = x1 + (q.x * W - x1) * k, y2 = y1 + (q.y * H - y1) * k;
      ctx.globalAlpha = a * 0.55;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo((x1 + x2) / 2, (y1 + y2) / 2 + 30, x2, y2); ctx.stroke();
    });
    for (const p of s.pins) { ctx.globalAlpha = a * 0.9; ctx.fillStyle = '#c8302c'; ctx.beginPath(); ctx.arc(p.x * W, p.y * H, 4, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.arc(p.x * W - 1.2, p.y * H - 1.2, 1.2, 0, TAU); ctx.fill(); }
    const tx = pointer.active ? pointer.x : W * (0.5 + 0.3 * Math.sin(t * 0.3)), ty = pointer.active ? pointer.y : H * (0.5 + 0.25 * Math.cos(t * 0.4));
    s.lx += (tx - s.lx) * Math.min(1, dt * 4); s.ly += (ty - s.ly) * Math.min(1, dt * 4);
    ctx.globalAlpha = a * 0.5; ctx.strokeStyle = '#d8b27a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(s.lx, s.ly, 46, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s.lx + 33, s.ly + 33); ctx.lineTo(s.lx + 70, s.ly + 70); ctx.lineWidth = 7; ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    blob(s.lx, s.ly, 46, glow('rgba(255,230,190,1)', 64), a * 0.12);
    ctx.globalCompositeOperation = 'source-over';
  },
  burst(s) { s.t0 = 0; s.links = s.pins.map((_, i) => [i, (i + 1 + (R() * 3 | 0)) % 9]); },
};

FX.noir = {
  init(s) { s.rain = Array.from({ length: N(120) }, () => ({ x: rr(0, W), y: rr(0, H), l: rr(10, 30), v: rr(500, 900) })); s.k = 0; },
  draw(s, t, dt, a) {
    ctx.globalAlpha = a * 0.55; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.translate(W * 0.15, -H * 0.2); ctx.rotate(-0.42);
    const off = (t * 6) % 70; s.k = Math.max(0, s.k - dt);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = -4; i < 24; i++) {
      const g = ctx.createLinearGradient(0, 0, W * 1.2, 0);
      g.addColorStop(0, 'rgba(255,255,255,.0)'); g.addColorStop(0.3, `rgba(255,255,255,${0.07 + s.k * 0.1})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(-W * 0.2, i * 70 + off, W * 1.6, 34);
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(220,220,220,.35)'; ctx.lineWidth = 1;
    ctx.globalAlpha = a; ctx.beginPath();
    for (const r of s.rain) { r.y += r.v * dt; r.x -= r.v * 0.12 * dt; if (r.y > H) { r.y = -r.l; r.x = rr(0, W * 1.1); } ctx.moveTo(r.x, r.y); ctx.lineTo(r.x - r.l * 0.12, r.y + r.l); }
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  },
  burst(s, k) { s.k = k; },
};

FX.slasher = {
  init(s) { s.dr = Array.from({ length: N(14) }, () => ({ x: rr(0, W), l: rr(0, 40), v: rr(4, 16), w: rr(2, 5) })); s.sl = []; },
  draw(s, t, dt, a) {
    vignette('rgba(70,0,0,.9)', 0.35, a);
    ctx.globalAlpha = a * 0.85; ctx.fillStyle = '#7a0b0f';
    for (const d of s.dr) {
      d.l += d.v * dt * (0.5 + Math.max(0, Math.sin(t * 0.7 + d.x))); if (d.l > H * 0.35) { d.l = 0; d.x = rr(0, W); }
      ctx.fillRect(d.x - d.w / 2, 0, d.w, d.l); ctx.beginPath(); ctx.arc(d.x, d.l, d.w * 0.9, 0, TAU); ctx.fill();
    }
    ctx.lineCap = 'round';
    for (const c of s.sl) {
      c.p = Math.min(1, c.p + dt * 6); c.l -= dt;
      const x = c.x1 + (c.x2 - c.x1) * c.p, y = c.y1 + (c.y2 - c.y1) * c.p;
      ctx.globalAlpha = a * Math.max(0, c.l) * 1.4; ctx.strokeStyle = '#ffe9e9'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(c.x1, c.y1); ctx.lineTo(x, y); ctx.stroke();
      ctx.strokeStyle = 'rgba(220,20,30,.7)'; ctx.lineWidth = 9; ctx.globalAlpha *= 0.5; ctx.stroke();
    }
    s.sl = s.sl.filter((c) => c.l > 0);
  },
  burst(s, k) {
    for (let i = 0; i < 3; i++) setTimeout(() => s.sl.push({ x1: rr(0, W * 0.3), y1: rr(0, H * 0.4) + i * H * 0.2, x2: rr(W * 0.7, W), y2: rr(H * 0.4, H * 0.8) + i * H * 0.1, p: 0, l: 0.7 }), i * 110);
    for (const d of s.dr) d.l += 40 * k;
  },
};

FX.cyberpunk = {
  init(s) { s.r = Array.from({ length: N(110) }, () => ({ x: rr(0, W), y: rr(-H, H), l: rr(20, 90), v: rr(300, 700), c: R() < 0.5 })); s.f = 0; },
  draw(s, t, dt, a) {
    const hz = H * 0.68;
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 1.5;
    for (const d of s.r) {
      d.y += d.v * dt; if (d.y > H) { d.y = -d.l; d.x = rr(0, W); }
      ctx.globalAlpha = a * 0.45; ctx.strokeStyle = d.c ? '#ff3df2' : '#3de8ff';
      ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x, d.y + d.l); ctx.stroke();
    }
    s.f = Math.max(0, s.f - dt * 1.5);
    ctx.strokeStyle = '#ff3df2'; ctx.lineWidth = 1;
    const sp = (t * 0.6) % 1;
    for (let i = 0; i < 12; i++) { const k = Math.pow((i + sp) / 12, 2.2); const y = hz + (H - hz) * k; ctx.globalAlpha = a * (0.15 + 0.5 * k + s.f * 0.4); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    for (let i = -14; i <= 14; i++) { ctx.globalAlpha = a * (0.25 + s.f * 0.4); ctx.beginPath(); ctx.moveTo(W / 2 + i * 12, hz); ctx.lineTo(W / 2 + i * W * 0.12, H); ctx.stroke(); }
    blob(W / 2, hz, W * 0.4, glow('rgba(255,61,242,1)', 128), a * 0.12);
    ctx.globalCompositeOperation = 'source-over';
  },
  burst(s, k) { s.f = k; cssPulse('fx-glitch', 240); },
};

FX.postapoc = {
  init(s) { s.p = Array.from({ length: N(150) }, () => ({ x: rr(0, W), y: rr(0, H), r: rr(1, 3.5), v: rr(14, 40), o: rr(0, TAU), e: R() < 0.08 })); s.k = 0; },
  draw(s, t, dt, a) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(60,40,25,.45)'); g.addColorStop(0.7, 'rgba(150,80,30,.18)'); g.addColorStop(1, 'rgba(200,100,30,.35)');
    ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    s.k = Math.max(0, s.k - dt * 0.5);
    for (const p of s.p) {
      p.y += p.v * (1 + s.k * 3) * dt; p.x += (Math.sin(t * 0.8 + p.o) * 18 + 10) * dt;
      if (p.y > H + 5) { p.y = -5; p.x = rr(-50, W); }
      if (p.e) { ctx.globalCompositeOperation = 'lighter'; blob(p.x, p.y, 5, glow('rgba(255,140,60,1)', 32), a * 0.7); ctx.globalCompositeOperation = 'source-over'; }
      else { ctx.globalAlpha = a * 0.55; ctx.fillStyle = '#b9b2a8'; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(t + p.o); ctx.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r); ctx.restore(); }
    }
  },
  burst(s, k) { s.k = k; },
};

FX.dystopia = {
  init(s) { s.lock = 0; },
  draw(s, t, dt, a) {
    ctx.globalAlpha = a * 0.1; ctx.strokeStyle = '#ff5a4a'; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = 0; x < W; x += 48) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = 0; y < H; y += 48) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
    s.lock = Math.max(0, s.lock - dt * 0.5);
    const ang = Math.PI / 2 + Math.sin(t * 0.45) * 0.9 * (1 - s.lock);
    const ox = W / 2, oy = -20, L = Math.hypot(W, H);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, L); g.addColorStop(0, 'rgba(255,240,230,.22)'); g.addColorStop(1, 'rgba(255,240,230,0)');
    ctx.globalAlpha = a; ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(ox, oy); ctx.arc(ox, oy, L, ang - 0.13, ang + 0.13); ctx.closePath(); ctx.fill();
    ctx.restore();
    const sy = ((t * 0.12) % 1) * H;
    ctx.globalAlpha = a * 0.35; ctx.fillStyle = '#ff5a4a'; ctx.fillRect(0, sy, W, 1);
    ctx.globalAlpha = a * (Math.sin(t * 4) > 0 ? 0.9 : 0.15); ctx.beginPath(); ctx.arc(W - 28, 28, 5, 0, TAU); ctx.fill();
  },
  burst(s) { s.lock = 1; },
};

FX.truecrime = {
  init(s) { s.flash = 0; s.next = 3; },
  draw(s, t, dt, a) {
    const ph = (t / 1.6) % 1, red = Math.max(0, Math.sin(ph * TAU)), blue = Math.max(0, -Math.sin(ph * TAU));
    const gl = ctx.createLinearGradient(0, 0, W * 0.45, 0); gl.addColorStop(0, `rgba(230,30,40,${0.3 * red})`); gl.addColorStop(1, 'rgba(230,30,40,0)');
    const gr = ctx.createLinearGradient(W, 0, W * 0.55, 0); gr.addColorStop(0, `rgba(40,90,255,${0.32 * blue})`); gr.addColorStop(1, 'rgba(40,90,255,0)');
    ctx.globalAlpha = a; ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalAlpha = a * 0.5; ctx.translate(0, H - 70); ctx.rotate(-0.04);
    ctx.fillStyle = '#ffcf3a'; ctx.fillRect(-20, 0, W + 40, 26);
    ctx.fillStyle = '#111'; for (let x = -20; x < W + 40; x += 36) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 16, 0); ctx.lineTo(x + 4, 26); ctx.lineTo(x - 12, 26); ctx.fill(); }
    ctx.restore();
    s.next -= dt; if (s.next < 0) { s.flash = 0.25; s.next = rr(4, 7); }
    if (s.flash > 0) { s.flash -= dt; ctx.globalAlpha = a * s.flash * 0.6; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); }
  },
  burst(s) { s.flash = 0.35; },
};

FX.anime = {
  init(s) { s.p = Array.from({ length: N(40) }, () => ({ x: rr(0, W), y: rr(0, H), s: rr(5, 10), v: rr(25, 60), o: rr(0, TAU) })); s.lines = 0; },
  draw(s, t, dt, a) {
    ctx.fillStyle = '#ffb3cc';
    for (const p of s.p) {
      p.y += p.v * dt; p.x += (Math.sin(t + p.o) * 30 + 20) * dt;
      if (p.y > H + 10) { p.y = -10; p.x = rr(-100, W); }
      ctx.globalAlpha = a * 0.7; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(t * 1.5 + p.o); ctx.scale(1, Math.cos(t * 2 + p.o));
      ctx.beginPath(); ctx.ellipse(0, 0, p.s, p.s * 0.55, 0, 0, TAU); ctx.fill(); ctx.restore();
    }
    if (s.lines > 0) {
      s.lines -= dt; const cx = W / 2, cy = H * 0.42, R0 = Math.min(W, H) * 0.25, R1 = Math.hypot(W, H);
      ctx.globalAlpha = a * Math.min(1, s.lines * 2) * 0.55; ctx.fillStyle = '#fff';
      for (let i = 0; i < 90; i++) { const an = (i / 90) * TAU + rr(-0.02, 0.02), w = rr(0.003, 0.012), r0 = R0 * rr(0.9, 1.6); ctx.beginPath(); ctx.moveTo(cx + Math.cos(an) * r0, cy + Math.sin(an) * r0); ctx.lineTo(cx + Math.cos(an - w) * R1, cy + Math.sin(an - w) * R1); ctx.lineTo(cx + Math.cos(an + w) * R1, cy + Math.sin(an + w) * R1); ctx.fill(); }
    }
  },
  burst(s, k) { if (k >= 1) s.lines = 0.6; },
};

FX.kdrama = {
  init(s) { s.l = [['255,180,150', 0], ['255,160,200', 2], ['200,180,255', 4]]; s.p = Array.from({ length: N(50) }, () => ({ x: rr(0, W), y: rr(0, H), r: rr(1, 2.5), v: rr(8, 20), o: rr(0, TAU) })); s.fl = -1; },
  draw(s, t, dt, a) {
    ctx.globalCompositeOperation = 'lighter';
    s.l.forEach(([c, o], i) => blob(W * (i % 2 ? 0.95 : 0.05) + Math.sin(t * 0.15 + o) * W * 0.08, H * (0.2 + i * 0.3) + Math.cos(t * 0.2 + o) * H * 0.1, Math.min(W, H) * 0.55, glow(`rgba(${c},1)`, 128), a * 0.22));
    const sp = glow('rgba(255,240,245,1)', 32);
    for (const p of s.p) { p.y += p.v * dt; p.x += Math.sin(t * 0.6 + p.o) * 8 * dt; if (p.y > H + 5) { p.y = -5; p.x = rr(0, W); } blob(p.x, p.y, p.r * 4, sp, a * 0.5); }
    if (s.fl >= 0) {
      s.fl += dt * 0.9; const x = -W * 0.2 + s.fl * W * 1.4;
      const g = ctx.createLinearGradient(x - 200, 0, x + 200, 0); g.addColorStop(0, 'rgba(255,220,230,0)'); g.addColorStop(0.5, 'rgba(255,220,230,.25)'); g.addColorStop(1, 'rgba(255,220,230,0)');
      ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); if (s.fl > 1) s.fl = -1;
    }
    ctx.globalCompositeOperation = 'source-over';
  },
  burst(s) { s.fl = 0; },
};

FX.sitcom = {
  init(s) { s.k = 0; },
  draw(s, t, dt, a) {
    const g = ctx.createRadialGradient(W / 2, -H * 0.2, 0, W / 2, -H * 0.2, H * 1.2);
    g.addColorStop(0, 'rgba(255,190,110,.2)'); g.addColorStop(1, 'rgba(255,190,110,0)');
    ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    s.k = Math.max(0, s.k - dt);
    const gap = 34, n = Math.ceil(W / gap), step = Math.floor(t * 6);
    const on = glow('rgba(255,200,110,1)', 32);
    ctx.globalCompositeOperation = 'lighter';
    for (const y of [10, H - 10]) for (let i = 0; i <= n; i++) {
      const lit = s.k > 0 ? (Math.floor(s.k * 6) % 2 === 0) : ((i + step) % 3 === 0);
      ctx.globalAlpha = a * 0.9; ctx.fillStyle = lit ? '#fff1cf' : 'rgba(120,90,50,.6)';
      ctx.beginPath(); ctx.arc(i * gap + 8, y, 3.2, 0, TAU); ctx.fill();
      if (lit) blob(i * gap + 8, y, 18, on, a * 0.6);
    }
    ctx.globalCompositeOperation = 'source-over';
  },
  burst(s) { s.k = 0.68; },
};

FX.mini = {
  init(s) { s.bar = 0; s.st = Array.from({ length: 5 }, () => ({ y: rr(0.15, 0.85), x: rr(0, 1), v: rr(0.02, 0.06), w: rr(0.3, 0.7) })); },
  draw(s, t, dt, a) {
    ctx.globalCompositeOperation = 'lighter';
    for (const l of s.st) {
      l.x = (l.x + l.v * dt) % 1.6; const x = (l.x - 0.3) * W, y = l.y * H, w = l.w * W;
      const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0); g.addColorStop(0, 'rgba(140,150,255,0)'); g.addColorStop(0.5, 'rgba(160,170,255,.35)'); g.addColorStop(1, 'rgba(140,150,255,0)');
      ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(x - w / 2, y - 1, w, 2);
      blob(x, y, 60, glow('rgba(150,160,255,1)', 64), a * 0.2);
    }
    ctx.globalCompositeOperation = 'source-over';
    if (s.bar > 0) s.bar = Math.max(0, s.bar - dt * 0.7);
    const k = s.bar > 0 ? Math.sin(Math.min(1, s.bar) * Math.PI) : 0;
    const h = H * (0.06 + 0.12 * k);
    ctx.globalAlpha = a; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, h); ctx.fillRect(0, H - h, W, h);
  },
  burst(s) { s.bar = 1; },
};

FX.cult = {
  init(s) { s.band = 0; s.k = 0; },
  draw(s, t, dt, a) {
    ctx.globalAlpha = a * 0.12; ctx.fillStyle = '#000';
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
    s.k = Math.max(0, s.k - dt);
    s.band = (s.band + dt * (0.12 + s.k * 2)) % 1.3;
    const by = (s.band - 0.15) * H, bh = 40 + s.k * 120;
    for (let i = 0; i < 14; i++) { ctx.globalAlpha = a * rr(0.05, 0.25); ctx.fillStyle = R() < 0.5 ? '#fff' : '#ff6a3d'; ctx.fillRect(rr(-W * 0.2, W * 0.3), by + rr(0, bh), rr(W * 0.3, W), rr(1, 3)); }
    const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.hypot(W, H) * 0.6);
    g.addColorStop(0, 'rgba(255,120,60,.08)'); g.addColorStop(1, 'rgba(0,0,0,.7)');
    ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  },
  burst(s, k) { s.k = 0.3 * k; cssPulse('fx-glitch', 250); },
};

FX.twist = {
  init(s) { s.p = Array.from({ length: N(180) }, () => sp()); function sp() { return { a: rr(0, TAU), r: rr(0.15, 1), v: rr(0.2, 0.6), c: R() < 0.5 }; } s.sp = sp; s.out = 0; },
  draw(s, t, dt, a) {
    const cx = W / 2, cy = H * 0.45, M = Math.hypot(W, H) * 0.55;
    s.out = Math.max(0, s.out - dt * 0.8);
    ctx.globalCompositeOperation = 'lighter';
    const g = [glow('rgba(122,240,224,1)', 32), glow('rgba(170,130,255,1)', 32)];
    for (const p of s.p) {
      p.a += dt * p.v / Math.max(0.15, p.r); p.r += (s.out > 0 ? s.out * 1.8 : -0.05) * dt;
      if (p.r < 0.05 || p.r > 1.3) Object.assign(p, s.sp(), { r: s.out > 0 ? rr(0.1, 0.4) : 1 });
      blob(cx + Math.cos(p.a) * p.r * M, cy + Math.sin(p.a) * p.r * M * 0.6, 4 + p.r * 4, g[+p.c], a * 0.55 * Math.min(1, p.r * 3));
    }
    ctx.globalCompositeOperation = 'source-over';
  },
  burst(s, k) { s.out = k; },
};

// ---------- движок ----------
const layers = [];
let raf = 0, last = 0, T0 = performance.now();
const loopOn = () => !reduce.matches && !document.hidden;

function resize() {
  DPR = Math.min(coarse ? 1.25 : 1.75, devicePixelRatio || 1);
  W = innerWidth; H = innerHeight;
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  SCALE = Math.min(1, Math.max(0.35, (W * H) / (1440 * 900))) * (coarse ? 0.7 : 1);
  for (const l of layers) FX[l.id].init(l.s);
  if (!loopOn()) renderStatic();
}

function frame(now) {
  raf = 0;
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
  const t = (now - T0) / 1000;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H);
  for (const l of layers) {
    l.a += (l.target - l.a) * Math.min(1, dt * 3.2);
    ctx.save(); FX[l.id].draw(l.s, t, dt, Math.max(0, Math.min(1, l.a))); ctx.restore();
  }
  for (let i = layers.length - 1; i >= 0; i--) if (layers[i].target === 0 && layers[i].a < 0.02) { FX[layers[i].id].end?.(); layers.splice(i, 1); }
  ctx.globalAlpha = 1;
  if (loopOn()) raf = requestAnimationFrame(frame);
}
function renderStatic() {
  // без движения: один кадр, чтобы оттенок жанра всё равно был виден
  for (const l of layers) l.a = l.target;
  last = performance.now() - 16;
  frame(performance.now());
}
function kick() { if (!raf && loopOn()) { last = performance.now(); raf = requestAnimationFrame(frame); } else if (!loopOn()) renderStatic(); }

export let current = null;
export function setFx(id, accent) {
  if (!FX[id]) id = 'idle';
  document.body.dataset.fx = id;
  if (accent) root.style.setProperty('--accent', accent);
  else root.style.removeProperty('--accent');
  if (current === id) return;
  current = id;
  for (const l of layers) l.target = 0;
  const s = {};
  FX[id].init(s);
  layers.push({ id, s, a: 0, target: 1 });
  while (layers.length > 3) { FX[layers[0].id].end?.(); layers.shift(); }
  kick();
}
export function burst(k = 1) {
  if (reduce.matches) return;
  const l = layers.find((x) => x.id === current);
  FX[current]?.burst?.(l.s, k);
}
export const fxIds = Object.keys(FX);

addEventListener('resize', resize, { passive: true });
document.addEventListener('visibilitychange', kick);
reduce.addEventListener?.('change', kick);
addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') { pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true; } }, { passive: true });
document.addEventListener('pointerleave', () => (pointer.active = false));
resize();
