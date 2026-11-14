import { GENRES, SUBS, byId, GENRE_RU, isGenre } from './chips.js?v=6';
import { getPool, details, core, matchFull, matchLocal, poster, seedPosters } from './api.js?v=6';
import { setFx, burst, glInfo, setMotion } from './fx.js?v=6';
import { findTrailer, ytSearch } from './trailer.js?v=6';

const $ = (s) => document.querySelector(s);
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const coarse = matchMedia('(pointer: coarse)').matches;
const mobile = () => matchMedia('(max-width: 760px)').matches;
const LS = { prefs: 'kr:prefs', hist: 'kr:hist', seen: 'kr:seen' };
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MAX = 3;
const MAIN = ['horror', 'thriller', 'scifi', 'comedy', 'drama', 'action', 'crime', 'anime'];

const prefs = Object.assign({ mode: 'all', sel: [], sub: {}, from: '', to: '', dec: [], rating: 0, known: false, noRepeat: true, fx: null }, load(LS.prefs, {}));
// v6: весь каталог по умолчанию — рейтинг «любой», «Всё подряд»
if (!prefs.v6) { prefs.rating = 0; prefs.known = false; prefs.v6 = true; }
prefs.sel = (prefs.sel || []).filter((id) => isGenre.has(id)).slice(0, MAX);
prefs.sub = Object.fromEntries(Object.entries(prefs.sub || {}).filter(([g, x]) => prefs.sel.includes(g) && SUBS[g]?.includes(x)));
save(LS.prefs, prefs);
delete prefs.multi;
let hist = load(LS.hist, []);
let seen = new Set(load(LS.seen, []));
const savePrefs = () => save(LS.prefs, prefs);

// зерно для шума плёнки
{
  const c = document.createElement('canvas'); c.width = c.height = 160;
  const g = c.getContext('2d'), d = g.createImageData(160, 160);
  for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 60; }
  g.putImageData(d, 0, 0);
  document.documentElement.style.setProperty('--grain', `url(${c.toDataURL()})`);
}

// ---------- эффекты: вкл / статичный кадр ----------
const fxBtn = $('#fxBtn');
let fxAuto = prefs.fx == null;
function motion(on, user) {
  if (user) { prefs.fx = on; fxAuto = false; savePrefs(); }
  fxBtn.setAttribute('aria-pressed', String(on));
  setMotion(on);
}
motion(prefs.fx ?? !coarse);
fxBtn.addEventListener('click', () => motion(fxBtn.getAttribute('aria-pressed') !== 'true', true));
addEventListener('kr:lowfps', () => { if (fxAuto) motion(false); });

// ---------- фильтры ----------
const panel = $('#filters');
function chipEl(c, cls = '') {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'chip' + cls; b.dataset.id = c.id; b.textContent = c.label;
  return b;
}
const ordered = [...MAIN.map((id) => byId[id]), ...GENRES.filter((g) => !MAIN.includes(g.id))];
{
  const any = chipEl({ id: '', label: 'Любой' }, ' any'); any.addEventListener('click', () => { prefs.sel = []; prefs.sub = {}; $('#hint').textContent = ''; changed(); }); $('#genres').append(any);
}
ordered.forEach((c) => { const b = chipEl(c, MAIN.includes(c.id) ? '' : ' extra'); b.addEventListener('click', () => toggle(c.id, b)); $('#genres').append(b); });
const moreG = chipEl({ id: 'more', label: 'Ещё' }, ' gmore'); moreG.removeAttribute('data-id'); moreG.setAttribute('aria-expanded', 'false'); $('#genres').append(moreG);
function showAll(on) { $('#genres').classList.toggle('all', on); moreG.setAttribute('aria-expanded', String(on)); moreG.textContent = on ? 'Меньше' : 'Ещё'; }
moreG.addEventListener('click', () => showAll(moreG.getAttribute('aria-expanded') !== 'true'));
showAll(prefs.sel.some((id) => !MAIN.includes(id)));

let hintT = 0;
function hint(msg, b) {
  if (b) { b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); setTimeout(() => b.classList.remove('nope'), 900); }
  $('#hint').textContent = msg; clearTimeout(hintT); hintT = setTimeout(() => ($('#hint').textContent = ''), 3500);
}
function toggle(id, b) {
  const on = !prefs.sel.includes(id);
  if (!on) { prefs.sel = prefs.sel.filter((x) => x !== id); delete prefs.sub[id]; }
  else if (prefs.sel.length >= MAX) return hint(`Максимум ${MAX} жанра. Сними один, чтобы добавить «${byId[id].label}».`, b);
  else prefs.sel = [...prefs.sel, id];
  $('#hint').textContent = '';
  changed(); if (on) burst(0.5);
}
function pickSub(g, s) {
  if (s && prefs.sub[g] !== s) prefs.sub[g] = s; else delete prefs.sub[g];
  changed(); if (s) burst(0.5);
}
function changed() { syncUI(); savePrefs(); applyFx(); }

function syncChips() {
  document.querySelectorAll('#genres .chip[data-id]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === '' ? !prefs.sel.length : prefs.sel.includes(b.dataset.id))));
  $('#gCount').textContent = prefs.sel.length ? `Жанров ${prefs.sel.length}/${MAX}` : '';
  $('#genres').classList.toggle('full', prefs.sel.length >= MAX);
  const box = $('#subs');
  const want = prefs.sel.filter((g) => SUBS[g]);
  for (const row of [...box.children]) if (!want.includes(row.dataset.g)) { row.classList.remove('open'); row.classList.add('closing'); setTimeout(() => row.remove(), reduce.matches ? 0 : 260); }
  for (const g of want) {
    let row = box.querySelector(`.subrow[data-g="${g}"]:not(.closing)`);
    if (!row) {
      row = document.createElement('div'); row.className = 'subrow'; row.dataset.g = g;
      row.innerHTML = `<div class="subin"><span class="sublbl">${esc(byId[g].label)}:</span></div>`;
      const inner = row.firstChild;
      const any = chipEl({ id: '', label: 'Любой' }, ' sub'); any.addEventListener('click', () => pickSub(g, null)); inner.append(any);
      for (const sid of SUBS[g]) { const c = byId[sid]; const b = chipEl({ ...c, label: c.label.replace('Психологический триллер', 'Психологический').replace('С неожиданной развязкой', 'С твистом') }, ' sub'); b.addEventListener('click', () => pickSub(g, sid)); inner.append(b); }
      box.append(row);
      requestAnimationFrame(() => requestAnimationFrame(() => row.classList.add('open')));
    }
    row.querySelectorAll('.chip').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.id || null) === (prefs.sub[g] || null))));
  }
  for (const g of want) { const r = box.querySelector(`.subrow[data-g="${g}"]:not(.closing)`); if (r) box.append(r); }
}

// режим
document.querySelectorAll('.seg button[data-mode]').forEach((b) => b.addEventListener('click', () => { prefs.mode = b.dataset.mode; changed(); }));

// десятилетия: одно или диапазон
const NOW = new Date().getFullYear();
const DECS = [[1900, 'до 70-х'], [1970, '70-е'], [1980, '80-е'], [1990, '90-е'], [2000, '00-е'], [2010, '10-е'], [2020, '20-е']];
const decLabel = (d) => DECS.find((x) => x[0] === d)[1];
DECS.forEach(([d, l]) => { const b = chipEl({ id: String(d), label: l }); b.addEventListener('click', () => pickDec(d)); $('#decades').append(b); });
function decRange() { const D = prefs.dec || []; return D.length ? [Math.min(...D), Math.max(...D)] : null; }
function pickDec(d) {
  const D = prefs.dec || [];
  if (D.length === 1 && D[0] === d) prefs.dec = [];
  else if (D.length === 1) prefs.dec = [D[0], d].sort((a, b) => a - b);
  else prefs.dec = [d];
  const r = decRange();
  prefs.from = r ? (r[0] === 1900 ? '' : r[0]) : '';
  prefs.to = r ? (r[1] === 1900 ? 1969 : r[1] >= 2020 ? '' : r[1] + 9) : '';
  changed();
}
function syncDec() {
  const r = decRange();
  document.querySelectorAll('#decades .chip').forEach((b) => {
    const d = +b.dataset.id; const inr = r && d >= r[0] && d <= r[1];
    b.setAttribute('aria-pressed', String(!!inr)); b.classList.toggle('mid', !!(inr && r[0] !== r[1] && d !== r[0] && d !== r[1]));
  });
}

// рейтинг
const rating = $('#rating');
rating.value = prefs.rating;
function showRating() {
  const v = Number(rating.value), k = v / 9;
  $('#ratingOut').textContent = v ? v.toFixed(1) : 'любой';
  rating.style.setProperty('--k', k);
  $('#ratingOut').style.setProperty('--k', k);
}
rating.addEventListener('input', () => { prefs.rating = Number(rating.value); showRating(); savePrefs(); syncFilterDot(); });

// не повторять
const nr = $('#noRepeat');
nr.addEventListener('click', () => { prefs.noRepeat = !prefs.noRepeat; changed(); });

document.querySelectorAll('#known button').forEach((b) => b.addEventListener('click', () => { prefs.known = b.dataset.known === '1'; changed(); }));
$('#resetBtn').addEventListener('click', () => { Object.assign(prefs, { dec: [], from: '', to: '', rating: 0, known: false, noRepeat: true }); rating.value = 0; showRating(); changed(); });

const pairs = () => prefs.sel.map((g) => [byId[g], byId[prefs.sub[g]] || null]);
// сколько фильтров отличается от умолчания — точка-счётчик на кнопке «Фильтры»
function syncFilterDot() {
  const n = (decRange() ? 1 : 0) + (Number(prefs.rating) ? 1 : 0) + (prefs.known ? 1 : 0) + (prefs.noRepeat ? 0 : 1);
  const el = $('#fCount'); el.hidden = !n; el.textContent = n ? String(n) : '';
  $('#filtersBtn').setAttribute('aria-label', n ? `Фильтры, изменено: ${n}` : 'Фильтры');
}
function syncUI() {
  syncChips(); syncDec(); syncFilterDot();
  document.querySelectorAll('#known button').forEach((x) => x.setAttribute('aria-checked', String((x.dataset.known === '1') === !!prefs.known)));
  document.querySelectorAll('.seg button[data-mode]').forEach((x) => x.setAttribute('aria-checked', String(x.dataset.mode === prefs.mode)));
  nr.setAttribute('aria-checked', String(!!prefs.noRepeat));
  const warn = prefs.mode === 'movie' && pairs().some(([, s]) => s?.series);
  if (warn) $('#hint').textContent = pairs().filter(([, s]) => s?.series).map(([, s]) => s.label).join(' и ') + ' бывают только среди сериалов.';
}
// эффект — по первому выбранному жанру (его уточнение главное, жанр фоном)
function applyFx(gId, sId) {
  let g = byId[gId], s = byId[sId];
  if (!g && !s) { const p = pairs()[0]; if (p) [g, s] = p; }
  const main = s || g;
  setFx(main ? main.fx : 'idle', main?.accent, s && g ? g.fx : null);
}
showRating(); syncUI(); applyFx();

// панели: сверху на десктопе, снизу на мобилке
function openPanel(d) { d.showModal(); document.documentElement.classList.add('locked'); }
function closePanel(d) {
  if (!d.open) return;
  if (reduce.matches) { d.close(); return; }
  d.classList.add('out'); setTimeout(() => { d.classList.remove('out'); d.close(); }, 220);
}
for (const d of [panel, $('#histPanel')]) {
  d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-close]')) closePanel(d); });
  d.addEventListener('cancel', (e) => { e.preventDefault(); closePanel(d); });
  d.addEventListener('close', () => { if (!panel.open && !$('#histPanel').open) document.documentElement.classList.remove('locked'); });
}
$('#filtersBtn').addEventListener('click', () => openPanel(panel));

function filters() {
  const y = (v) => { const n = parseInt(v, 10); return n >= 1880 && n <= 2035 ? n : undefined; };
  let from = y(prefs.from), to = y(prefs.to);
  if (from && to && from > to) [from, to] = [to, from];
  // порог голосов отсекает пустые заглушки: фильмы от 1000, сериалы от 500; «Только известные» — от 25k/10k
  const known = !!prefs.known;
  return { mode: prefs.mode, from, to, minRating: Number(prefs.rating) || 0, vm: known ? 25000 : 1000, vs: known ? 10000 : 500, known };
}

// ---------- барабан ----------
const stage = $('#stage'), reel = $('#reel'), strip = $('#strip'), result = $('#result');
let CW = 0, P = 0, CX = 0, K = 0, cards = [];
let pos = 0, items = new Map(), display = [];
function measure() {
  const r = reel.getBoundingClientRect();
  const probe = document.createElement('div'); probe.style.width = 'var(--cw)'; reel.append(probe); CW = probe.offsetWidth || 160; probe.remove();
  P = CW + Math.round(CW * 0.09); CX = r.width / 2 - CW / 2;
  const need = Math.ceil(r.width / P) + 4;
  if (need !== K) {
    K = need; strip.textContent = '';
    cards = Array.from({ length: K }, () => { const d = document.createElement('div'); d.className = 'card'; d.innerHTML = '<img alt="" decoding="async"><span></span>'; strip.append(d); d.vi = null; const img = d.firstChild; img.onerror = () => d.classList.add('miss'); return d; });
  }
  paint(true);
  // эффекты живут только в сцене барабана: маска заканчивается под ним
  const b = reel.getBoundingClientRect().bottom + scrollY;
  document.documentElement.style.setProperty('--fxEnd', `${Math.round(b)}px`);
}
const mod = (a, n) => ((a % n) + n) % n;
function itemAt(v) {
  if (!items.has(v)) items.set(v, display.length ? display[Math.floor(Math.random() * display.length)] : null);
  return items.get(v);
}
function paint(force) {
  const first = Math.floor((pos - CX) / P) - 1;
  for (let v = first; v < first + K; v++) {
    const el = cards[mod(v, K)];
    if (el.vi !== v || force) {
      el.vi = v;
      const t = itemAt(v);
      el.classList.remove('miss');
      const img = el.firstChild;
      const src = t?.i ? poster(t.i, CW > 200 ? 400 : 300) : '';
      if (img.getAttribute('src') !== src) { if (src) img.src = src; else { img.removeAttribute('src'); el.classList.add('miss'); } }
      el.lastChild.textContent = t ? t.t : '';
    }
    const x = v * P - pos + CX;
    const d = Math.min(1, Math.abs(x - CX) / (P * 2.4));
    el.style.transform = `translate3d(${x.toFixed(1)}px,0,0) scale(${(1 - d * 0.12).toFixed(3)})`;
    el.style.opacity = (1 - d * 0.5).toFixed(3);
  }
  reel.style.setProperty('--sprocket', `${(-pos % 22).toFixed(1)}px`);
}
addEventListener('resize', () => measure(), { passive: true });
seedPosters().then((s) => { display = s; items.clear(); measure(); }).catch(() => measure());
measure();

const preload = (t, w = 300, ms = 2500) => new Promise((res) => {
  if (!t?.i) return res();
  const im = new Image(); const done = () => res(); im.onload = done; im.onerror = done; setTimeout(done, ms); im.src = poster(t.i, w);
});

let spinning = false, landedAt = null;
async function spin() {
  if (spinning) return;
  spinning = true;
  const btn = $('#spin'); btn.disabled = true; btn.firstChild.textContent = 'Крутим…';
  $('#status').textContent = '';
  if (!result.hidden) await collapse();
  reel.classList.remove('landed');
  if (mobile()) reel.scrollIntoView({ behavior: reduce.matches ? 'auto' : 'smooth', block: 'center' });

  let v = 0, last = performance.now(), cruising = !reduce.matches;
  const vmax = Math.max(1800, P * 16);
  const cruise = (now) => {
    if (!cruising) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    v = Math.min(vmax, v + vmax * dt * 2.5); pos += v * dt; paint(); requestAnimationFrame(cruise);
  };
  requestAnimationFrame(cruise);
  const t0 = performance.now();

  const ch = await choose();
  if (ch.error) {
    cruising = false; await settle(v);
    finish(); $('#status').textContent = ch.error;
    return;
  }
  const win = ch.win;
  display = ch.pool.map((x) => x.t);
  await Promise.all([preload(win.t, 400), preload(win.t, 600, 1500), new Promise((r) => setTimeout(r, Math.max(0, 650 - (performance.now() - t0))))]);
  const resetNote = ch.reset ? 'Всё подходящее уже выпадало, начинаю круг заново. ' : '';

  cruising = false;
  let T;
  if (reduce.matches) {
    T = Math.round(pos / P) + 1;
    for (let i = -4; i <= 4; i++) items.delete(T + i);
    items.set(T, win.t); pos = T * P; paint(true);
  } else {
    const vNow = Math.max(v, vmax * 0.6);
    const dist0 = vNow * 3.3 / 4;
    T = Math.round((pos + dist0) / P);
    for (let i = -6; i <= 4; i++) if (i) items.set(T + i, display[Math.floor(Math.random() * display.length)]);
    items.set(T, win.t);
    cards.forEach((c) => { if (Math.abs(c.vi - T) <= 6) c.vi = null; });
    const p0 = pos, dist = T * P - p0, D = (4 * dist) / vNow * 1000;
    await new Promise((done) => {
      const s = performance.now();
      const step = (now) => {
        const u = Math.min(1, (now - s) / D);
        pos = p0 + dist * (1 - Math.pow(1 - u, 4)); paint();
        if (u < 1) requestAnimationFrame(step); else done();
      };
      requestAnimationFrame(step);
    });
  }
  reel.classList.add('landed');
  applyFx(win.g, win.s);
  burst(1);
  remember(win.t, win.s || win.g, win.g);
  $('#status').textContent = resetNote + (ch.offline ? 'Сервер с данными не ответил, крутим из встроенной подборки.' : '');
  const center = cards.find((c) => c.vi === T);
  await new Promise((r) => setTimeout(r, reduce.matches ? 0 : 260));
  showResult(win.t, win.s || win.g, win.g, center?.getBoundingClientRect());
  finish();
}
const bad = new Set();
// Подбор: пул по логике групп, затем проверка кандидата по полной карточке IMDb (интересы, страна).
async function choose() {
  const P = pairs(), f = filters();
  let res;
  try { res = await getPool(P, f); } catch { res = { pool: [] }; }
  if (res.conflict) return { error: res.conflict };
  const pool = res.pool.filter((x) => !bad.has(x.t.id));
  let fresh = prefs.noRepeat ? pool.filter((x) => !seen.has(x.t.id)) : pool.slice();
  let reset = false;
  if (!fresh.length && pool.length) { fresh = pool.slice(); reset = true; }
  fresh.sort(() => Math.random() - 0.5);
  for (const c of fresh.slice(0, 6)) {
    const g = byId[c.g], s = byId[c.s];
    if (c.t.src === 'al') { if (matchLocal(c.t, g, s, f)) return { win: c, pool, offline: res.offline, reset }; continue; }
    let d = null;
    for (let k = 0; k < 2 && !d; k++) { try { d = await core(c.t.id); } catch {} }
    if (!d) { if (matchLocal(c.t, g, s, f) && (c.snap || !s || !(s.anyI || s.noI))) return { win: c, pool, offline: res.offline, reset }; continue; }
    d.i = d.i || c.t.i;
    if (matchFull(d, g, s, f)) return { win: { ...c, t: d }, pool, offline: res.offline, reset };
    bad.add(c.t.id);
  }
  const want = P.map(([g, s]) => (s ? `${g.label}, ${s.label}` : g.label).toLowerCase()).join(' или ');
  return { error: `Не нашлось ничего${want ? ` под «${want}»` : ''} с такими фильтрами. Ослабь годы или рейтинг в «Фильтрах».` };
}
async function settle(v) {
  if (reduce.matches) return;
  const T = Math.ceil((pos + v * 0.3) / P), p0 = pos, dist = T * P - p0;
  await new Promise((done) => { const s = performance.now(); const st = (n) => { const u = Math.min(1, (n - s) / 600); pos = p0 + dist * (1 - Math.pow(1 - u, 3)); paint(); u < 1 ? requestAnimationFrame(st) : done(); }; requestAnimationFrame(st); });
}
function finish() {
  spinning = false;
  const btn = $('#spin'); btn.disabled = false; btn.firstChild.textContent = 'Крутить';
}
$('#spin').addEventListener('click', spin);
addEventListener('keydown', (e) => {
  if (!(e.code === 'Space' || e.key === 'Enter') || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
  if (document.querySelector('dialog[open]')) return;
  if (e.target.closest('a,button,input,textarea,select,dialog,[contenteditable]')) return;
  e.preventDefault(); spin();
});

// ---------- результат: кадр барабана вырастает в карточку ----------
const ico = {
  play: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" fill="currentColor"/></svg>',
  ext: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M9 2.5h4.5V7M13.5 2.5 7.5 8.5M12 9.5v3.5a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-8a.5.5 0 0 1 .5-.5H7" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  redo: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13 8a5 5 0 1 1-1.5-3.6M13 2v3h-3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
const KIND_RU = { movie: 'Фильм', tvMovie: 'Телефильм', tvSeries: 'Сериал', tvMiniSeries: 'Мини-сериал' };
const kindOf = (t) => (t.src === 'al' ? (t.k === 'movie' ? 'Аниме-фильм' : 'Аниме-сериал') : KIND_RU[t.k] || 'Тайтл');
const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 12 || h > 14) ? b : c; };
const runtime = (s) => { if (!s) return ''; const m = Math.round(s / 60), h = Math.floor(m / 60); return h ? `${h}\u00a0ч ${m % 60}\u00a0мин` : `${m}\u00a0мин`; };
// чистим вики-мусор: транскрипции, произношения, скобки с иероглифами, сноски
export function cleanWiki(s) {
  let out = String(s || '').replace(/\u0301/g, '');
  const junk = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af\u0590-\u06ff\u0e00-\u0e7f]|(?:^|[\s(;,])(?:англ|яп|кор|кит|фр|нем|исп|итал|лат|порт|тур|хинди|произн|МФА|ромадзи|букв|транслит|рус)\.|произношение|[ˈˌəɪʊʃʒθðŋ]/i;
  for (let k = 0; k < 3; k++) out = out.replace(/\s*\(([^()]*)\)/g, (m, inner) => (junk.test(inner) ? '' : m));
  return out.replace(/\[[^\]]*\]/g, '').replace(/\s+([,.;:])/g, '$1').replace(/\s{2,}/g, ' ').trim();
}
let token = 0, curT = null, curChip = null, curG = null;
function showResult(t, chipId, gId, fromRect) {
  const my = ++token;
  curChip = chipId; curG = gId;
  render(t, false);
  open(fromRect);
  details(t).then((d) => { if (my === token) { render(d, true); patchHistory(d); } }).catch(() => {});
}
function render(t, full) {
  curT = t;
  if (full) findTrailer(t, prefs.tlang || 'ru').catch(() => {});
  const title = t.ru || t.t;
  const orig = [t.ru && t.ru !== t.t ? t.t : null, t.o && t.o !== (t.ru || t.t) ? t.o : null].filter(Boolean)[0];
  const isSeries = /tvSeries|tvMiniSeries/.test(t.k);
  const years = isSeries && t.y ? `${t.y}${t.e && t.e !== t.y ? '–' + t.e : t.e ? '' : '–…'}` : t.y || '';
  const meta = [kindOf(t), years, isSeries ? (t.seasons ? `${t.seasons}\u00a0${plural(t.seasons, 'сезон', 'сезона', 'сезонов')}` : t.ep ? `${t.ep}\u00a0${plural(t.ep, 'серия', 'серии', 'серий')}` : '') : runtime(t.s), t.r ? `★\u00a0${t.r.toFixed(1)}` : ''].filter(Boolean);
  const wantG = [].concat(byId[curG]?.q?.genres || []);
  const genres = [...(t.g || [])].sort((a, b) => wantG.includes(b) - wantG.includes(a)).slice(0, 3).map((g) => GENRE_RU[g] || g).join(', ');
  const dir = t.src === 'al' ? '' : t.directors?.length ? `Режиссёр: ${t.directors.slice(0, 2).join(', ')}` : '';
  const txt = t.wiki ? cleanWiki(t.wiki) : t.p || '';
  const desc = txt ? `<p class="desc${t.wiki ? '' : ' en'}" id="desc"${t.wiki ? '' : ' lang="en"'}>${esc(txt)}</p><button class="moreDesc" type="button" data-act="more" hidden>Ещё</button>`
    : full ? '' : '<p class="desc muted">Загружаю описание…</p>';
  const rec = hist.filter((h) => h.id !== t.id).slice(0, 6);
  const keepPoster = result.querySelector('.poster img')?.dataset.id === t.id;
  const posterHTML = `<div class="poster" id="rposter">${t.i ? `<img src="${poster(t.i, 600)}" data-id="${t.id}" alt="Постер: ${esc(title)}">` : ''}</div>`;
  const infoHTML = `
    <div class="info">
      <p class="meta">${meta.map(esc).join(' · ')}</p>
      <h2>${esc(title)}</h2>
      ${orig ? `<p class="orig" lang="en">${esc(orig)}</p>` : ''}
      ${genres || dir ? `<p class="sub">${esc([genres, dir].filter(Boolean).join(' · '))}</p>` : ''}
      ${desc}
      <div class="actions">
        <button class="btn primary" type="button" data-act="trailer">${ico.play}Трейлер</button>
        <button class="btn" type="button" data-act="where" aria-expanded="false" aria-controls="where">Где посмотреть ${ico.ext}</button>
        <div class="where" id="where" hidden>${whereLinks(t, title)}</div>
      </div>
    </div>
    ${rec.length ? `<div class="recent"><p class="flabel">Недавно</p><div class="rrow">${rec.map((h) => `<button class="rmini" type="button" data-id="${h.id}" title="${esc(h.ru || h.t)}"><img loading="lazy" alt="${esc(h.ru || h.t)}" src="${poster(h.i, 200)}"></button>`).join('')}</div></div>` : ''}`;
  if (keepPoster) { result.querySelector('.info')?.remove(); result.querySelector('.recent')?.remove(); result.insertAdjacentHTML('beforeend', infoHTML); }
  else result.innerHTML = posterHTML + infoHTML;
  const d = $('#desc'); if (d) requestAnimationFrame(() => { if (d.scrollHeight > d.clientHeight + 2) result.querySelector('.moreDesc').hidden = false; });
  if (t.i) { const bd = $('#backdrop'); bd.style.backgroundImage = `url("${poster(t.i, 300)}")`; }
}
const SPRING = 'cubic-bezier(.2, 1.25, .35, 1)';
function open(fromRect) {
  const was = !result.hidden;
  result.hidden = false; stage.classList.add('show'); document.body.classList.add('has-result');
  $('#where')?.setAttribute('hidden', '');
  const img = result.querySelector('.poster');
  if (!was && fromRect && img && !reduce.matches) {
    const to = img.getBoundingClientRect();
    const dx = fromRect.left - to.left, dy = fromRect.top - to.top, sx = fromRect.width / to.width, sy = fromRect.height / to.height;
    img.animate([{ transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, borderRadius: '6px' }, { transform: 'none' }], { duration: 520, easing: SPRING });
    result.querySelectorAll('.info, .recent').forEach((el, i) => el.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 360, delay: 160 + i * 80, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }));
    result.animate([{ backgroundColor: 'rgb(12 11 10 / 0)', borderColor: 'transparent' }, {}], { duration: 420, easing: 'ease-out' });
  }
  if (mobile()) stage.scrollIntoView({ behavior: reduce.matches ? 'auto' : 'smooth', block: 'start' });
}
// «Ещё раз»: карточка сворачивается обратно в кадр плёнки
async function collapse() {
  const img = result.querySelector('.poster');
  if (img && !reduce.matches) {
    const from = img.getBoundingClientRect(), gate = $('#gate').getBoundingClientRect();
    const to = { left: gate.left + 6, top: gate.top + 6, width: CW, height: CW * 1.5 };
    const dx = to.left - from.left, dy = to.top - from.top, sx = to.width / from.width, sy = to.height / from.height;
    const a = img.animate([{ transform: 'none' }, { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, borderRadius: '6px' }], { duration: 380, easing: 'cubic-bezier(.5,0,.2,1)', fill: 'forwards' });
    result.querySelectorAll('.info, .recent').forEach((el) => el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: 'forwards' }));
    result.animate([{}, { backgroundColor: 'rgb(12 11 10 / 0)', borderColor: 'transparent' }], { duration: 300, fill: 'forwards' });
    await a.finished.catch(() => {});
  }
  result.getAnimations({ subtree: true }).forEach((a) => a.cancel());
  result.hidden = true; result.innerHTML = ''; stage.classList.remove('show'); document.body.classList.remove('has-result');
}
function whereLinks(t, title) {
  const q = encodeURIComponent(title), qy = encodeURIComponent(`${title} ${t.y || ''}`.trim()), qo = encodeURIComponent(t.t);
  const L = [
    ['Кинопоиск', `https://www.kinopoisk.ru/index.php?kp_query=${qy}`],
    ['Okko', `https://okko.tv/search/${q}`],
    ['Иви', `https://www.ivi.ru/search/?q=${q}`],
    ['JustWatch', `https://www.justwatch.com/ru/%D0%BF%D0%BE%D0%B8%D1%81%D0%BA?q=${qo}`],
    ...(t.src === 'al' ? [['AniList', `https://anilist.co/anime/${t.al}`], ...(t.mal ? [['MyAnimeList', `https://myanimelist.net/anime/${t.mal}`]] : [])] : [['IMDb', `https://www.imdb.com/title/${t.id}/`]]),
  ];
  return L.map(([n, u]) => `<a href="${u}" target="_blank" rel="noopener">${n}${ico.ext}</a>`).join('');
}
result.addEventListener('click', (e) => {
  const mini = e.target.closest('.rmini');
  if (mini) { const h = hist.find((x) => x.id === mini.dataset.id); if (h) { applyFx(h.gc, h.chip && !isGenre.has(h.chip) ? h.chip : null); result.innerHTML = ''; result.hidden = true; showResult(h, h.chip, h.gc, mini.getBoundingClientRect()); } return; }
  const b = e.target.closest('[data-act]'); if (!b) return;
  const act = b.dataset.act;
  if (act === 'trailer') openTrailer(curT, b);
  if (act === 'again') spin();
  if (act === 'more') { $('#desc').classList.add('open'); b.remove(); }
  if (act === 'where') {
    const w = $('#where'), op = w.hidden; w.hidden = !op; b.setAttribute('aria-expanded', op);
    if (op) w.querySelector('a')?.focus();
  }
});
document.addEventListener('click', (e) => { const w = $('#where'); if (w && !w.hidden && !e.target.closest('.actions')) { w.hidden = true; $('[data-act="where"]')?.setAttribute('aria-expanded', 'false'); } });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { const w = $('#where'); if (w && !w.hidden) { w.hidden = true; $('[data-act="where"]')?.focus(); } } });

// ---------- трейлер ----------
const tm = $('#tmodal');
let tReq = 0, tBack = null;
async function openTrailer(t, from) {
  if (!t) return;
  tBack = from;
  const my = ++tReq;
  $('#tmTitle').textContent = t.ru || t.t;
  $('#tmFrame').innerHTML = '<div class="tm-load" aria-live="polite">Ищу трейлер…</div>';
  $('#tmYt').href = ytSearch(t);
  tm.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === (prefs.tlang || 'ru'))));
  if (!tm.open) { tm.showModal(); document.documentElement.classList.add('locked'); window.dispatchEvent(new CustomEvent('kr:trailer', { detail: true })); }
  let lang = prefs.tlang || 'ru';
  let r = await findTrailer(t, lang).catch(() => null);
  if (!r && my === tReq) { const alt = lang === 'ru' ? 'en' : 'ru'; r = await findTrailer(t, alt).catch(() => null); if (r) lang = alt; }
  if (my !== tReq || !tm.open) return;
  tm.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  if (!r) { $('#tmFrame').innerHTML = `<div class="tm-load">Трейлер не нашёлся. <a href="${ytSearch(t)}" target="_blank" rel="noopener">Поискать на YouTube</a></div>`; return; }
  $('#tmFrame').innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${r.id}?autoplay=1&rel=0&playsinline=1&modestbranding=1" title="Трейлер: ${esc(t.ru || t.t)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
  $('#tmFrame').dataset.vid = r.id;
  $('#tmYt').href = `https://www.youtube.com/watch?v=${r.id}`;
}
function closeTrailer() {
  if (!tm.open) return;
  tReq++; $('#tmFrame').innerHTML = ''; delete $('#tmFrame').dataset.vid;
  tm.close(); document.documentElement.classList.remove('locked');
  window.dispatchEvent(new CustomEvent('kr:trailer', { detail: false }));
  tBack?.focus();
}
tm.addEventListener('click', (e) => { if (e.target === tm || e.target.closest('[data-close]')) closeTrailer(); });
tm.addEventListener('cancel', (e) => { e.preventDefault(); closeTrailer(); });
tm.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => { if ((prefs.tlang || 'ru') === b.dataset.lang && $('#tmFrame').dataset.vid) return; prefs.tlang = b.dataset.lang; savePrefs(); openTrailer(curT, tBack); }));

// ---------- история ----------
function remember(t, chip, g) {
  seen.add(t.id); save(LS.seen, [...seen].slice(-3000));
  hist = [{ id: t.id, t: t.t, o: t.o, k: t.k, y: t.y, e: t.e, r: t.r, v: t.v, g: t.g, i: t.i, s: t.s, src: t.src, al: t.al, mal: t.mal, fmt: t.fmt, ep: t.ep, yt: t.yt, p: t.src === 'al' ? t.p : undefined, chip, gc: g, ts: Date.now() }, ...hist.filter((h) => h.id !== t.id)].slice(0, 30);
  save(LS.hist, hist); drawHistory();
}
function patchHistory(d) { const h = hist.find((x) => x.id === d.id); if (h && d.ru) { h.ru = d.ru; save(LS.hist, hist); drawHistory(); } }
function drawHistory() {
  $('#histCount').textContent = hist.length ? String(hist.length) : '';
  $('#hlist').innerHTML = hist.length ? hist.map((h) => `<button class="hitem" type="button" data-id="${h.id}"><img loading="lazy" alt="" src="${poster(h.i, 200)}"><span><b>${esc(h.ru || h.t)}</b><small>${esc([kindOf(h), h.y, h.r ? '★ ' + h.r.toFixed(1) : ''].filter(Boolean).join(' · '))}</small></span></button>`).join('')
    : '<p class="empty">Здесь появится всё, что выпадет.</p>';
  $('#histClear').hidden = !hist.length;
}
$('#hlist').addEventListener('click', (e) => {
  const b = e.target.closest('.hitem'); if (!b) return;
  const h = hist.find((x) => x.id === b.dataset.id); if (!h) return;
  const r = b.querySelector('img').getBoundingClientRect();
  $('#histPanel').close();
  applyFx(h.gc, h.chip && !isGenre.has(h.chip) ? h.chip : null);
  result.innerHTML = ''; result.hidden = true;
  showResult(h, h.chip, h.gc, r);
});
$('#histClear').addEventListener('click', () => { hist = []; seen = new Set(); save(LS.hist, hist); save(LS.seen, []); drawHistory(); });
$('#histBtn').addEventListener('click', () => openPanel($('#histPanel')));
drawHistory();

// для тестов
window.__kr = {
  spin, setFx, burst, choose, gl: () => glInfo(), cleanWiki,
  // sel: ['horror', 'comedy'], extra: {sub: {horror: 'slasher'}, from, to, rating, noRepeat}
  set(sel, mode = 'all', extra = {}) {
    prefs.sel = sel; prefs.sub = extra.sub || {}; prefs.mode = mode; prefs.dec = []; Object.assign(prefs, extra);
    rating.value = prefs.rating ?? 0; showRating();
    savePrefs(); syncUI(); applyFx();
  },
  prefs, details, trailer: (t, l) => findTrailer(t, l),
  async pick() { const r = await choose(); if (r.win) { seen.add(r.win.t.id); } return r.error ? { error: r.error } : { t: r.win.t, g: r.win.g, s: r.win.s, offline: !!r.offline }; },
  filters,
};
