// Фоновые эффекты жанров: WebGL-сцена (gl.js) снизу, 2D-детали поверх, верхний слой над интерфейсом.
import * as G from './gl.js?v=3';
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


FX.thriller = {
  init(s) { s.g = 0; s.lines = []; s.next = 2; },
  draw(s, t, dt, a, gOn) {
    const beat = t % 1.3, k = Math.exp(-beat * 7) + 0.6 * Math.exp(-Math.max(0, beat - 0.22) * 7) * (beat > 0.22);
    if (!gOn) vignette(`rgba(170,10,10,${0.35 + 0.45 * k})`, 0.3, a);
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
  draw(s, t, dt, a, gOn) {
    if (gOn) return;
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
  draw(s, t, dt, a, gOn) {
    if (gOn) return;
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
  draw(s, t, dt, a, gOn) {
    if (gOn) return;
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
  draw(s, t, dt, a, gOn) {
    if (gOn) return;
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
  draw(s, t, dt, a, gOn) {
    if (gOn) return;
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
  draw(s, t, dt, a, gOn) {
    if (gOn) return;
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


// ---------- тёмные жанры: общий туман и верхний слой ----------
let FOG = null;
function fogTex() {
  if (FOG) return FOG;
  const w = 256, h = 128, c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'), img = g.createImageData(w, h);
  const oct = [[8, 4, 0.5], [16, 8, 0.28], [32, 16, 0.15], [64, 32, 0.07]].map(([gx, gy, amp]) => ({ gx, gy, amp, v: Array.from({ length: gx * (gy + 1) }, R) }));
  const sm = (x) => x * x * (3 - 2 * x);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let n = 0;
    for (const o of oct) {
      const fx = (x / w) * o.gx, fy = (y / h) * o.gy, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = sm(fx - x0), ty = sm(fy - y0);
      const at = (i, j) => o.v[(j % (o.gy + 1)) * o.gx + (i % o.gx)];
      const a0 = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx, a1 = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx;
      n += (a0 + (a1 - a0) * ty) * o.amp;
    }
    const edge = Math.sin((y / h) * Math.PI);
    const al = Math.max(0, Math.min(1, (n - 0.35) * 2.2)) * edge;
    const i = (y * w + x) * 4; img.data[i] = 150; img.data[i + 1] = 148; img.data[i + 2] = 156; img.data[i + 3] = al * 255;
  }
  g.putImageData(img, 0, 0);
  return (FOG = c);
}
function drawFog(t, y, h, speed, alpha, scale = 1.4) {
  const f = fogTex(), fw = W * scale, x = -((t * speed) % fw);
  ctx.globalAlpha = alpha;
  ctx.drawImage(f, x, y, fw, h); ctx.drawImage(f, x + fw, y, fw, h);
}
function flashlight(c, x, y, r, dark) {
  const g = c.createRadialGradient(x, y, r * 0.15, x, y, r);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${dark})`);
  c.fillStyle = g; c.fillRect(0, 0, W, H);
}
function eyes(c, x, y, sc, a) {
  const d = 17 * sc;
  c.globalAlpha = a * 0.75; c.fillStyle = '#000';
  const g = c.createRadialGradient(x, y, 0, x, y, 150 * sc); g.addColorStop(0, 'rgba(0,0,0,.85)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(x - 160 * sc, y - 160 * sc, 320 * sc, 320 * sc);
  for (const s of [-1, 1]) {
    const ex = x + s * d;
    c.globalAlpha = a * 0.5; c.drawImage(glow('rgba(255,200,120,1)', 64), ex - 22 * sc, y - 22 * sc, 44 * sc, 44 * sc);
    c.globalAlpha = a; c.fillStyle = '#f3dca8';
    c.beginPath(); c.ellipse(ex, y, 8 * sc, 3.2 * sc, s * -0.18, 0, TAU); c.fill();
    c.fillStyle = '#050302'; c.beginPath(); c.ellipse(ex, y, 1.2 * sc, 3 * sc, 0, 0, TAU); c.fill();
  }
}
function figure(c, x, base, h, a) {
  const g = c.createRadialGradient(x, base - h * 0.55, 0, x, base - h * 0.55, h * 0.7);
  g.addColorStop(0, 'rgba(120,120,130,.35)'); g.addColorStop(1, 'rgba(120,120,130,0)');
  c.globalAlpha = a; c.fillStyle = g; c.fillRect(x - h, base - h * 1.3, h * 2, h * 1.4);
  const hw = h * 0.065;
  c.fillStyle = '#020202'; c.beginPath();
  c.ellipse(x, base - h + hw * 1.2, hw, hw * 1.3, 0, 0, TAU);
  c.moveTo(x - hw * 0.5, base - h + hw * 2.2);
  c.bezierCurveTo(x - hw * 3.2, base - h + hw * 3, x - hw * 3.6, base - h * 0.55, x - hw * 2.4, base);
  c.lineTo(x + hw * 2.4, base);
  c.bezierCurveTo(x + hw * 3.6, base - h * 0.55, x + hw * 3.2, base - h + hw * 3, x + hw * 0.5, base - h + hw * 2.2);
  c.closePath(); c.fill();
}
function drips(s, n) { s.dr = Array.from({ length: N(n) }, () => ({ x: rr(0, W), l: rr(0, 60), v: rr(3, 14), w: rr(1.5, 4.5), max: rr(H * 0.08, H * 0.4) })); }
function drawDrips(s, dt, a, k = 1) {
  const g = ctx.createLinearGradient(0, 0, 0, H * 0.4); g.addColorStop(0, '#5a070b'); g.addColorStop(1, '#2a0204');
  ctx.fillStyle = g; ctx.globalAlpha = a * 0.9;
  for (const d of s.dr) {
    d.l += d.v * dt * k * (1 - d.l / d.max * 0.8);
    if (d.l >= d.max * 0.98) { d.l = 0; d.x = rr(0, W); d.max = rr(H * 0.08, H * 0.4); }
    ctx.beginPath(); ctx.moveTo(d.x - d.w, 0); ctx.quadraticCurveTo(d.x - d.w * 0.4, d.l * 0.6, d.x - d.w * 0.5, d.l);
    ctx.arc(d.x, d.l, d.w * 0.9, Math.PI, 0, true); ctx.quadraticCurveTo(d.x + d.w * 0.4, d.l * 0.6, d.x + d.w, 0); ctx.fill();
  }
}
const canFlash = (s, t, gap = 0.4) => { if (t - (s.lf ?? -9) < gap) return false; s.lf = t; return true; };
const pointerOr = (t, fx = 0.37, fy = 0.53) => pointer.active ? [pointer.x, pointer.y] : [W * (0.5 + 0.33 * Math.sin(t * fx)), H * (0.5 + 0.28 * Math.sin(t * fy + 1))];

FX.horror = {
  init(s) { s.bulb = 1; s.bt = 0.6; s.black = 0; s.ld = -9; s.vhs = 0; s.nv = rr(4, 8); s.sub = null; s.ns = rr(8, 16); s.close = 0; s.lx = W / 2; s.ly = H / 2; drips(s, 18); s.scr = []; },
  draw(s, t, dt, a, gOn) {
    s.bt -= dt;
    if (s.bt < 0) {
      const r = R();
      if (r < 0.1 && canFlash(s, t)) { s.black = rr(0.08, 0.2); s.bulb = 0.2; s.bt = s.black; }
      else if (r < 0.4 && t - s.ld > 0.4) { s.ld = t; s.bulb = rr(0.35, 0.65); s.bt = rr(0.05, 0.13); }
      else { s.bulb = rr(0.8, 1); s.bt = rr(0.35, 2.4); }
    }
    s.black = Math.max(0, s.black - dt); s.close = Math.max(0, s.close - dt * 0.25);
    const b = s.black > 0 ? 0 : s.bulb;
    G.shared.bulb = b;
    if (gOn) { drawDrips(s, dt, a); return; }
    ctx.globalAlpha = a; ctx.fillStyle = `rgba(0,0,0,${0.5 + (1 - b) * 0.4})`; ctx.fillRect(0, 0, W, H);
    drawFog(t, H * 0.34, H * 0.75, 18, a * 0.75 * (0.4 + 0.6 * b));
    drawFog(t + 40, H * 0.5, H * 0.6, 34, a * 0.6 * (0.4 + 0.6 * b), 1.1);
    const [tx, ty] = pointerOr(t);
    s.lx += (tx - s.lx) * Math.min(1, dt * 6); s.ly += (ty - s.ly) * Math.min(1, dt * 6);
    ctx.globalAlpha = a; flashlight(ctx, s.lx, s.ly, Math.min(W, H) * (0.3 - s.close * 0.08), 0.72);
    ctx.globalCompositeOperation = 'lighter';
    blob(s.lx, s.ly, Math.min(W, H) * 0.22, glow('rgba(255,225,180,1)', 128), a * 0.07 * b);
    ctx.globalCompositeOperation = 'source-over';
    drawDrips(s, dt, a);
    const inner = 0.2 + 0.05 * Math.sin(t * 0.35) - s.close * 0.12;
    vignette('rgba(12,0,0,1)', Math.max(0.05, inner), a);
  },
  top(c, s, t, dt, a) {
    const b = s.black > 0 ? 0 : s.bulb;
    c.globalAlpha = a; c.fillStyle = `rgba(0,0,0,${s.black > 0 ? 0.62 : (1 - b) * 0.32 + 0.04})`; c.fillRect(0, 0, W, H);
    if (R() < dt * 2.5) s.scr.push({ x: rr(0, W), l: rr(0.05, 0.22), w: R() < 0.2 ? 2 : 1 });
    c.fillStyle = 'rgba(230,225,215,.16)';
    for (const sc of s.scr) { sc.l -= dt; c.fillRect(sc.x, 0, sc.w, H); }
    s.scr = s.scr.filter((x) => x.l > 0);
    c.globalAlpha = a * 0.35; c.fillStyle = '#ddd';
    for (let i = 0; i < 4; i++) c.fillRect(rr(0, W), rr(0, H), rr(1, 2.5), rr(1, 2.5));
    s.nv -= dt;
    if (s.nv < 0) { s.nv = rr(5, 11); if (canFlash(s, t)) { s.vhs = 0.28; cssPulse('fx-vhs', 300); } }
    if (s.vhs > 0) {
      s.vhs -= dt;
      for (let i = 0; i < 10; i++) { c.globalAlpha = a * rr(0.06, 0.22); c.fillStyle = i % 3 ? '#e8e8e8' : '#ff2a2a'; c.fillRect(rr(-W * 0.2, W * 0.4), rr(0, H), rr(W * 0.3, W), rr(1, 3)); }
      const by = rr(0, H); c.globalAlpha = a * 0.12; c.fillStyle = '#fff'; c.fillRect(0, by, W, rr(8, 30));
    }
    s.ns -= dt;
    if (s.ns < 0 && canFlash(s, t)) { s.ns = rr(14, 30); s.sub = spawnSub(); }
    if (s.sub) {
      s.sub.l -= dt;
      if (s.sub.l > 0) s.sub.k === 'eyes' ? eyes(c, s.sub.x, s.sub.y, s.sub.sc, a * 0.9) : figure(c, s.sub.x, H, s.sub.h, a * 0.85);
      else s.sub = null;
    }
  },
  burst(s, k) {
    s.close = k;
    const t = (performance.now() - T0) / 1000;
    if (k >= 1 && canFlash(s, t, 0.3)) { s.black = 0.14; }
    setTimeout(() => { s.vhs = 0.3; cssPulse('fx-vhs', 300); }, 180);
    if (k >= 1 && (window.__krSub || R() < 0.6)) setTimeout(() => { s.sub = spawnSub(); s.lf = (performance.now() - T0) / 1000; }, 650);
  },
};
function spawnSub() {
  const left = R() < 0.5, x = left ? rr(W * 0.04, W * 0.2) : rr(W * 0.8, W * 0.96);
  return R() < 0.6 ? { k: 'eyes', x, y: rr(H * 0.25, H * 0.75), sc: rr(0.8, 1.4), l: rr(0.09, 0.13) } : { k: 'fig', x, h: rr(H * 0.45, H * 0.7), l: rr(0.1, 0.14) };
}

FX.slasher = {
  init(s) { drips(s, 22); s.sl = []; s.red = 0; s.ni = rr(4, 8); },
  draw(s, t, dt, a, gOn) {
    G.shared.red = Math.max(0, s.red);
    if (!gOn) { ctx.globalAlpha = a; ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, 0, W, H); vignette('rgba(60,0,2,1)', 0.22, a); }
    drawDrips(s, dt, a, 1.4);
    s.ni -= dt; if (s.ni < 0) { s.ni = rr(6, 11); FX.slasher.slash(s, 0); }
  },
  slash(s, delay) {
    setTimeout(() => {
      const fromLeft = R() < 0.5, y1 = rr(H * 0.1, H * 0.6), y2 = y1 + rr(H * 0.15, H * 0.45);
      s.sl.push({ x1: fromLeft ? -40 : W + 40, y1, x2: fromLeft ? W + 40 : -40, y2, p: 0, l: 1 });
      window.dispatchEvent(new CustomEvent('kr:sfx', { detail: 'slash' }));
    }, delay);
  },
  top(c, s, t, dt, a) {
    c.lineCap = 'round';
    for (const q of s.sl) {
      q.p = Math.min(1, q.p + dt * 7); q.l -= dt * 0.9;
      const x = q.x1 + (q.x2 - q.x1) * q.p, y = q.y1 + (q.y2 - q.y1) * q.p;
      const tail = Math.max(0, q.p - 0.35), tx = q.x1 + (q.x2 - q.x1) * tail, ty = q.y1 + (q.y2 - q.y1) * tail;
      if (q.p < 1) {
        const g = c.createLinearGradient(tx, ty, x, y); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,.95)');
        c.globalAlpha = a; c.strokeStyle = g; c.lineWidth = 3; c.beginPath(); c.moveTo(tx, ty); c.lineTo(x, y); c.stroke();
      }
      c.globalAlpha = a * Math.max(0, q.l) * 0.8; c.strokeStyle = '#a3080f'; c.lineWidth = 2.2;
      c.beginPath(); c.moveTo(q.x1, q.y1); c.lineTo(x, y + 2); c.stroke();
      c.globalAlpha = a * Math.max(0, q.l) * 0.25; c.lineWidth = 10; c.stroke();
    }
    s.sl = s.sl.filter((q) => q.l > 0);
    if (s.red > 0) { s.red -= dt; c.globalAlpha = a * Math.max(0, s.red / 0.14) * 0.32; c.fillStyle = '#c0000a'; c.fillRect(0, 0, W, H); }
  },
  burst(s, k) {
    FX.slasher.slash(s, 0);
    if (k >= 1) {
      FX.slasher.slash(s, 160);
      const t = (performance.now() - T0) / 1000;
      if (canFlash(s, t)) setTimeout(() => (s.red = 0.14), 60);
      cssPulse('fx-shake', 380);
    }
    for (const d of s.dr) d.l = Math.min(d.max * 0.9, d.l + 50 * k);
  },
};

FX.mystery = {
  init(s) { s.lx = W / 2; s.ly = H / 2; s.boost = 0; s.pass = null; s.np = rr(8, 15); },
  draw(s, t, dt, a, gOn) {
    if (!gOn) {
      ctx.globalAlpha = a; ctx.fillStyle = 'rgba(2,4,10,.45)'; ctx.fillRect(0, 0, W, H);
      drawFog(t, H * 0.1, H * 0.6, 10, a * 0.35, 1.6);
      drawFog(t + 20, H * 0.45, H * 0.7, 22, a * 0.45);
    }
    s.np -= dt;
    if (s.np < 0) { s.np = rr(10, 18); s.pass = { x: R() < 0.5 ? -80 : W + 80, v: rr(90, 160), h: rr(H * 0.5, H * 0.75) }; if (s.pass.x > 0) s.pass.v *= -1; }
    if (s.pass) { s.pass.x += s.pass.v * dt; ctx.save(); ctx.filter = 'blur(6px)'; figure(ctx, s.pass.x, H + 10, s.pass.h, a * 0.6); ctx.restore(); if (s.pass.x < -120 || s.pass.x > W + 120) s.pass = null; }
    const [tx, ty] = pointerOr(t);
    s.lx += (tx - s.lx) * Math.min(1, dt * 5); s.ly += (ty - s.ly) * Math.min(1, dt * 5);
    s.boost = Math.max(0, s.boost - dt * 0.6);
    if (gOn) return;
    ctx.globalAlpha = a; flashlight(ctx, s.lx, s.ly, Math.min(W, H) * (0.26 + s.boost * 0.35), 0.82);
    ctx.globalCompositeOperation = 'lighter';
    blob(s.lx, s.ly, Math.min(W, H) * 0.2, glow('rgba(190,210,255,1)', 128), a * 0.06);
    ctx.globalCompositeOperation = 'source-over';
  },
  burst(s, k) { s.boost = k; },
};

FX.psycho = {
  init(s) { s.k = 0; s.wh = 0; },
  draw(s, t, dt, a, gOn) {
    const br = 0.5 + 0.5 * Math.sin(t * 1.1);
    s.k = Math.max(0, s.k - dt * 0.7);
    G.shared.whisper = (window.__krWhisper || 0) + s.k * 0.5;
    if (gOn) {
      root.style.setProperty('--split', (0.8 + 2 * br + s.k * 5).toFixed(2) + 'px');
      root.style.setProperty('--breath', (1 + 0.004 * br + s.k * 0.01).toFixed(4));
      root.style.setProperty('--skew', ((Math.sin(t * 0.6) * 0.25 + s.k * Math.sin(t * 9) * 0.8) * a).toFixed(3) + 'deg');
      return;
    }
    ctx.globalAlpha = a; ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(0, 0, W, H);
    const cx = W / 2 + Math.sin(t * 0.7) * W * 0.05, cy = H * 0.48 + Math.cos(t * 0.5) * H * 0.05, M = Math.hypot(W, H) * 0.6;
    ctx.lineWidth = 1.2;
    for (let i = 1; i <= 14; i++) {
      const r0 = ((i / 14 + t * 0.03) % 1) * M;
      ctx.globalAlpha = a * 0.16 * (1 - r0 / M);
      ctx.strokeStyle = i % 2 ? '#d65a7a' : '#7fd8ff';
      ctx.beginPath();
      for (let j = 0; j <= 64; j++) {
        const an = (j / 64) * TAU, rr2 = r0 * (1 + (0.06 + 0.1 * br + s.k * 0.2) * Math.sin(an * 3 + t * 0.8 + i) * Math.sin(an * 2 - t * 0.5));
        const x = cx + Math.cos(an) * rr2 * (1 + 0.08 * br), y = cy + Math.sin(an) * rr2 * (1 - 0.06 * br);
        j ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    ctx.save(); ctx.translate(cx, cy); ctx.scale(1 + 0.1 * Math.sin(t * 0.9), 1 - 0.08 * Math.sin(t * 0.9 + 1)); ctx.translate(-cx, -cy);
    const r0 = Math.min(W, H) * (0.16 + 0.14 * br + s.k * 0.15);
    const g = ctx.createRadialGradient(cx, cy, r0, cx, cy, M);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.55, 'rgba(50,0,25,.6)'); g.addColorStop(1, 'rgba(0,0,0,.97)');
    ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(-W, -H, W * 3, H * 3);
    ctx.restore();
    root.style.setProperty('--split', (0.8 + 2 * br + s.k * 5).toFixed(2) + 'px');
    root.style.setProperty('--breath', (1 + 0.004 * br + s.k * 0.01).toFixed(4));
    root.style.setProperty('--skew', ((Math.sin(t * 0.6) * 0.25 + s.k * Math.sin(t * 9) * 0.8) * a).toFixed(3) + 'deg');
  },
  top(c, s, t, dt, a) {
    s.wh = window.__krWhisper || 0;
    const n = Math.round((20 + s.wh * 160 + s.k * 200) * SCALE);
    c.globalAlpha = a * (0.1 + s.wh * 0.25);
    for (let i = 0; i < n; i++) { c.fillStyle = R() < 0.5 ? '#fff' : '#000'; c.fillRect(rr(0, W), rr(0, H), 1.5, 1.5); }
  },
  burst(s, k) { s.k = k; window.dispatchEvent(new CustomEvent('kr:sfx', { detail: 'whisper' })); },
  end() { for (const v of ['--split', '--breath', '--skew']) root.style.removeProperty(v); },
};

// ---------- движок ----------
const top = document.getElementById('fxTop');
const ctt = top.getContext('2d');
let topDirty = false;
const layers = [];
let raf = 0, last = 0;
const T0 = performance.now();
const loopOn = () => !reduce.matches && !document.hidden;

function resize() {
  DPR = Math.min(coarse ? 1.25 : 1.75, devicePixelRatio || 1);
  W = innerWidth; H = innerHeight;
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  top.width = Math.round(W); top.height = Math.round(H);
  G.resize();
  SCALE = Math.min(1, Math.max(0.35, (W * H) / (1440 * 900))) * (coarse ? 0.7 : 1);
  for (const l of layers) FX[l.id].init(l.s);
  if (!loopOn()) renderStatic();
}

function frame(now, still) {
  raf = 0;
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
  const t = (now - T0) / 1000;
  const [mx, my] = pointerOr(t);
  G.render(t, dt, mx, my, still);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H);
  let anyTop = false;
  for (const l of layers) {
    l.a += (l.target - l.a) * Math.min(1, dt * 3.2);
    const a = Math.max(0, Math.min(1, l.a));
    ctx.save(); FX[l.id].draw(l.s, t, dt, a, G.active(l.id)); ctx.restore();
    if (FX[l.id].top && !still) anyTop = true;
  }
  if (anyTop || topDirty) {
    ctt.setTransform(1, 0, 0, 1, 0, 0); ctt.clearRect(0, 0, W, H); topDirty = anyTop;
    for (const l of layers) if (FX[l.id].top && !still) { ctt.save(); FX[l.id].top(ctt, l.s, t, dt, Math.max(0, Math.min(1, l.a)) * (l.target < 1 && l.target > 0 ? 0.5 : 1)); ctt.restore(); }
  }
  for (let i = layers.length - 1; i >= 0; i--) if (layers[i].target === 0 && layers[i].a < 0.02) { FX[layers[i].id].end?.(); layers.splice(i, 1); }
  ctx.globalAlpha = 1;
  if (loopOn()) raf = requestAnimationFrame(frame);
}
function renderStatic() {
  // без движения: один спокойный кадр, чтобы настроение жанра всё равно было видно
  for (const l of layers) l.a = l.target;
  last = performance.now() - 16;
  topDirty = true;
  frame(performance.now(), true);
}
function kick() { if (!raf && loopOn()) { last = performance.now(); raf = requestAnimationFrame(frame); } else if (!loopOn()) renderStatic(); }

export let current = null;
let secondary = null;
// id — главный эффект, second — фоновый на 35%, если выбраны и жанр, и поджанр
export function setFx(id, accent, second) {
  if (!FX[id]) id = 'idle';
  if (second && (!FX[second] || second === id)) second = null;
  document.body.dataset.fx = id;
  document.body.dataset.fx2 = second || '';
  if (accent) root.style.setProperty('--accent', accent);
  else root.style.removeProperty('--accent');
  if (current === id && secondary === second) return;
  current = id; secondary = second;
  const want = { [id]: 1 };
  if (second) want[second] = 0.35;
  for (const l of layers) l.target = want[l.id] ?? 0;
  for (const k of Object.keys(want)) if (!layers.some((l) => l.id === k)) { const s = {}; FX[k].init(s); layers.push({ id: k, s, a: 0, target: want[k] }); }
  while (layers.length > 4) { const i = layers.findIndex((l) => l.target === 0); if (i < 0) break; FX[layers[i].id].end?.(); layers.splice(i, 1); }
  if (!G.want(id)) G.stop();
  window.dispatchEvent(new CustomEvent('kr:fx', { detail: { id, second } }));
  kick();
}
export function burst(k = 1) {
  window.dispatchEvent(new CustomEvent('kr:burst', { detail: { id: current, k } }));
  if (reduce.matches) return;
  const l = layers.find((x) => x.id === current);
  if (l) FX[current]?.burst?.(l.s, k);
}
export const fxIds = Object.keys(FX);
export const glInfo = G.glInfo;

addEventListener('resize', resize, { passive: true });
document.addEventListener('visibilitychange', kick);
reduce.addEventListener?.('change', kick);
addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') { pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true; } }, { passive: true });
addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') { pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true; clearTimeout(pointer.to); pointer.to = setTimeout(() => (pointer.active = false), 2500); } }, { passive: true });
document.addEventListener('pointerleave', () => (pointer.active = false));
resize();
