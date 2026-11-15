import { GENRES, SUBS, byId, GENRE_RU, isGenre } from './chips.js?v=9';
import { getPool, details, core, matchFull, matchLocal, poster, seedPosters } from './api.js?v=9';
import { setGenre, phase, wow, plan, onReel, setMotion, glInfo, top1, genreNow } from './grade.js?v=10';
import { findTrailer, ytSearch } from './trailer.js?v=10';
import * as V from './views.js?v=13';
import { ruTitles, ruCached, kpCached } from './ru.js?v=1';
import { storyBlob, shareLink, shareImage } from './share.js?v=1';
import { watchedIds, getLists } from './store.js?v=11';

const $ = (s) => document.querySelector(s);
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const coarse = matchMedia('(pointer: coarse)').matches;
const mobile = () => matchMedia('(max-width: 760px)').matches;
const LS = { prefs: 'kr:prefs', hist: 'kr:hist', seen: 'kr:seen' };
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MAX = 3;
let spinning = false;
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
  fxBtn.setAttribute('aria-checked', String(on));
  fxBtn.title = on ? 'Эффекты: вкл' : 'Эффекты: выкл';
  setMotion(on);
}
motion(prefs.fx ?? true);
fxBtn.addEventListener('click', () => motion(fxBtn.getAttribute('aria-checked') !== 'true', true));
addEventListener('kr:lowfps', () => { if (fxAuto) motion(false); });

// ---------- фильтры ----------
const picker = $('#picker');
const CHECK = '<i class="cb" aria-hidden="true"><svg viewBox="0 0 24 24" width="12" height="12"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg></i>';
const CHEV = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const subLabel = (c) => c.label.replace('Психологический триллер', 'Психологический').replace('С неожиданной развязкой', 'С твистом');
function chipEl(c, cls = '') {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'chip' + cls; b.dataset.id = c.id; b.textContent = c.label;
  return b;
}
// жанры: список с чекбоксами, у жанра с уточнениями — шеврон, уточнения раскрываются под ним
const ordered = [...MAIN.map((id) => byId[id]), ...GENRES.filter((g) => !MAIN.includes(g.id))];
const expanded = new Set(prefs.sel.filter((g) => SUBS[g]));
for (const c of ordered) {
  const grp = document.createElement('div'); grp.className = 'grp'; grp.dataset.g = c.id;
  grp.innerHTML = `<div class="grow"><button type="button" class="gopt" role="checkbox" data-id="${c.id}">${CHECK}<span>${esc(c.label)}</span></button>${SUBS[c.id] ? `<button type="button" class="gchev" aria-expanded="false" aria-label="Уточнить: ${esc(c.label)}">${CHEV}</button>` : ''}</div>`
    + (SUBS[c.id] ? `<div class="gsubs"><div class="gsin">${SUBS[c.id].map((sid) => `<button type="button" class="gopt sub" role="checkbox" data-g="${c.id}" data-s="${sid}">${CHECK}<span>${esc(subLabel(byId[sid]))}</span></button>`).join('')}</div></div>` : '');
  $('#genres').append(grp);
}
$('#genres').addEventListener('click', (e) => {
  const ch = e.target.closest('.gchev');
  if (ch) { const g = ch.closest('.grp').dataset.g; expanded.has(g) ? expanded.delete(g) : expanded.add(g); syncChips(); return; }
  const b = e.target.closest('.gopt'); if (!b) return;
  if (b.dataset.s) {
    const g = b.dataset.g;
    if (!prefs.sel.includes(g)) { if (prefs.sel.length >= MAX) return hint(`Максимум ${MAX} жанра. Сними один, чтобы добавить «${byId[g].label}».`, b); prefs.sel = [...prefs.sel, g]; }
    pickSub(g, b.dataset.s);
  } else toggle(b.dataset.id, b);
});

let hintT = 0;
function hint(msg, b) {
  if (b) { b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); setTimeout(() => b.classList.remove('nope'), 900); }
  $('#hint').textContent = msg; clearTimeout(hintT); hintT = setTimeout(() => ($('#hint').textContent = ''), 3500);
}
function toggle(id, b) {
  const on = !prefs.sel.includes(id);
  if (!on) { prefs.sel = prefs.sel.filter((x) => x !== id); delete prefs.sub[id]; }
  else if (prefs.sel.length >= MAX) return hint(`Максимум ${MAX} жанра. Сними один, чтобы добавить «${byId[id].label}».`, b);
  else { prefs.sel = [...prefs.sel, id]; if (SUBS[id]) expanded.add(id); }
  $('#hint').textContent = '';
  changed();
}
function pickSub(g, s) {
  if (s && prefs.sub[g] !== s) prefs.sub[g] = s; else delete prefs.sub[g];
  changed();
}
function changed() { syncUI(); savePrefs(); applyFx(); if (document.body.classList.contains('has-result') && !spinning) setSpin('Крутить'); }

function syncChips() {
  const full = prefs.sel.length >= MAX;
  document.querySelectorAll('#genres .grp').forEach((grp) => {
    const g = grp.dataset.g, on = prefs.sel.includes(g);
    grp.querySelector('.gopt').setAttribute('aria-checked', String(on));
    grp.classList.toggle('off', full && !on);
    const ch = grp.querySelector('.gchev'); if (!ch) return;
    const ex = expanded.has(g); ch.setAttribute('aria-expanded', String(ex)); grp.classList.toggle('open', ex);
    grp.querySelectorAll('.gopt.sub').forEach((b) => { b.setAttribute('aria-checked', String(on && prefs.sub[g] === b.dataset.s)); b.tabIndex = ex ? 0 : -1; });
  });
  $('#gCount').textContent = prefs.sel.length ? `${prefs.sel.length} из ${MAX}` : '';
}

// режим
document.querySelectorAll('#types button[data-mode]').forEach((b) => b.addEventListener('click', () => { prefs.mode = b.dataset.mode; changed(); if (picker.dataset.sec === 'type') closePanel(picker); }));

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
  $('#ratingOut').textContent = v ? v.toFixed(1) : 'любая';
  rating.style.setProperty('--k', k);
  $('#ratingOut').style.setProperty('--k', k);
}
rating.addEventListener('input', () => { prefs.rating = Number(rating.value); showRating(); savePrefs(); syncFields(); });

// не повторять
const nr = $('#noRepeat');
nr.addEventListener('click', () => { prefs.noRepeat = !prefs.noRepeat; changed(); });
// не показывать просмотренное: по умолчанию включено, как только в «Просмотрено» что-то есть
const noWatched = () => prefs.noWatched ?? watchedIds().size > 0;
$('#noWatched').addEventListener('click', () => { prefs.noWatched = !noWatched(); changed(); });
addEventListener('kr:lists', () => syncUI());
document.querySelectorAll('#known button').forEach((b) => b.addEventListener('click', () => { prefs.known = b.dataset.known === '1'; changed(); }));

const resetYears = () => Object.assign(prefs, { dec: [], from: '', to: '' });
const resetRate = () => { Object.assign(prefs, { rating: 0, known: false, noRepeat: true, noWatched: null }); rating.value = 0; showRating(); };
const resetGenres = () => { prefs.sel = []; prefs.sub = {}; $('#hint').textContent = ''; };
$('#pReset').addEventListener('click', () => {
  const s = picker.dataset.sec;
  if (s === 'genre' || s === 'all') resetGenres();
  if (s === 'years' || s === 'all') resetYears();
  if (s === 'rate' || s === 'all') resetRate();
  if (s === 'all') prefs.mode = 'all';
  changed();
});
$('#pDone').addEventListener('click', () => { const all = picker.dataset.sec === 'all'; closePanel(picker); if (all) setTimeout(spin, reduce.matches ? 0 : 220); });

const pairs = () => prefs.sel.map((g) => [byId[g], byId[prefs.sub[g]] || null]);
// значения полей пульта
const TYPE_V = { all: 'Фильмы и сериалы', movie: 'Фильмы', series: 'Сериалы' };
const low = (x) => subLabel(x).toLowerCase();
function genreVal() {
  const P = pairs();
  if (!P.length) return 'Любой';
  if (P.length === 1) { const [g, s] = P[0]; return s ? `${g.label} · ${low(s)}` : g.label; }
  return P.slice(0, 2).map(([g]) => g.label).join(', ') + (P.length > 2 ? ` +${P.length - 2}` : '');
}
function yearsVal() {
  const r = decRange();
  if (r) return r[0] === r[1] ? decLabel(r[0]) : `${decLabel(r[0])} – ${decLabel(r[1])}`;
  return prefs.from || prefs.to ? `${prefs.from || '…'}–${prefs.to || 'сейчас'}` : 'Любые';
}
function rateVal() {
  const r = Number(prefs.rating);
  const rs = r ? `от ${r.toFixed(r % 1 ? 1 : 0)}★` : '';
  return prefs.known ? (rs ? `${rs} · известные` : 'Только известные') : rs || 'Всё подряд';
}
function sumVal() {
  const parts = [prefs.mode === 'all' ? '' : TYPE_V[prefs.mode], prefs.sel.length ? genreVal() : '', yearsVal() === 'Любые' ? '' : yearsVal(), rateVal() === 'Всё подряд' ? '' : rateVal()].filter(Boolean);
  return parts.length ? (prefs.mode === 'all' ? ['Фильмы и сериалы', ...parts] : parts).join(' · ') : 'Любой фильм или сериал';
}
function syncFields() {
  const set = (id, lbl, v) => { const b = $(id); b.querySelector('span').textContent = v; b.setAttribute('aria-label', `${lbl}: ${v}`); };
  set('#fType', 'Что', TYPE_V[prefs.mode]); set('#fGenre', 'Жанр', genreVal()); set('#fYears', 'Годы', yearsVal()); set('#fRate', 'Рейтинг', rateVal()); set('#fSum', 'Настройки', sumVal());
}
function syncUI() {
  syncChips(); syncDec(); syncFields();
  document.querySelectorAll('#known button').forEach((x) => x.setAttribute('aria-checked', String((x.dataset.known === '1') === !!prefs.known)));
  document.querySelectorAll('#types button[data-mode]').forEach((x) => x.setAttribute('aria-checked', String(x.dataset.mode === prefs.mode)));
  nr.setAttribute('aria-checked', String(!!prefs.noRepeat));
  $('#noWatched').setAttribute('aria-checked', String(noWatched()));
  const bad = pairs().filter(([, s]) => (prefs.mode === 'movie' && s?.series) || (prefs.mode === 'series' && s?.movie));
  const warn = bad.length ? bad.map(([g, s]) => (s.id === 'a_movie' ? 'Аниме-фильмы' : s.label)).join(' и ') + (prefs.mode === 'movie' ? ' бывают только среди сериалов.' : ' бывают только среди фильмов.') : '';
  if (warn) $('#hint').textContent = warn;
  if (!spinning) say(warn);
}
// подсказка над пультом
function say(msg, btn) {
  const t = $('#toast'); $('#status').textContent = msg || '';
  const b = $('#toastBtn'); b.hidden = !btn; if (btn) { b.textContent = btn[0]; b.onclick = () => { btn[1](); say(''); }; }
  t.hidden = !msg;
}
// эффект — по первому выбранному жанру (его уточнение главное, жанр фоном)
// играет один жанр — старший по приоритету среди выбранных; на остановке — среди жанров выпавшего тайтла
const selG = () => pairs().map(([g]) => g.id);
const IMDB2G = {}; for (const g of GENRES) for (const n of [].concat(g.q?.genres || [])) IMDB2G[n] = g.id;
function titleG(t) { const ids = (t.g || []).map((n) => IMDB2G[n]).filter(Boolean); if (t.src === 'al') ids.push('anime'); return ids; }
function applyFx() { setGenre(top1(selG())); }
function landFx(t) { const sel = selG(); if (!sel.length) return setGenre('none'); const both = titleG(t).filter((x) => sel.includes(x)); setGenre(top1(both.length ? both : sel)); }
showRating(); syncUI(); applyFx();

// поповер над полем пульта на десктопе, шторка снизу на мобилке (там — все разделы сразу)
const DIALOGS = [picker];
const anyOpen = () => DIALOGS.some((d) => d.open && !d.classList.contains('out'));
const POPW = { type: 300, genre: 560, years: 520, rate: 400 };
function place(d, from) {
  const pop = !!from && !mobile() && d === picker;
  d.classList.toggle('pop', pop);
  if (!pop) { d.style.left = d.style.top = d.style.maxHeight = d.style.width = ''; return; }
  const w = Math.min(POPW[d.dataset.sec] || 440, innerWidth - 24); d.style.width = `${w}px`;
  const r = from.getBoundingClientRect(), pr = $('#pult').getBoundingClientRect();
  const left = Math.max(12, Math.min(innerWidth - w - 12, r.left + r.width / 2 - w / 2));
  const maxH = Math.max(200, pr.top - 12 - 76), h = Math.min(d.scrollHeight || 300, maxH);
  d.style.maxHeight = `${Math.round(maxH)}px`; d.style.left = `${Math.round(left)}px`;
  d.style.top = `${Math.round(pr.top - 12 - h)}px`;
}
const ro = new ResizeObserver(() => { if (picker.open && picker._from) place(picker, picker._from); });
ro.observe(picker.firstElementChild);
function openPanel(d, from, sec) {
  clearTimeout(d._t); d.classList.remove('out');
  if (d === picker) {
    const s = mobile() ? 'all' : sec || 'all';
    picker.dataset.sec = s;
    $('#pReset').textContent = s === 'all' ? 'Сбросить' : s === 'years' ? 'Любые годы' : s === 'genre' ? 'Сбросить' : 'Сбросить';
    $('#pDone').textContent = s === 'all' ? 'Показать' : 'Готово';
    document.querySelectorAll('#pult .pf').forEach((b) => b.classList.toggle('open', b === from && s !== 'all'));
  }
  if (!d.open) d.showModal();
  d._from = from || null; from?.setAttribute('aria-expanded', 'true'); place(d, from); requestAnimationFrame(() => place(d, from));
  document.documentElement.classList.add('locked');
}
function closePanel(d) {
  if (!d.open) return;
  if (reduce.matches) { d.close(); return; }
  d.classList.add('out'); clearTimeout(d._t);
  d._t = setTimeout(() => { if (d.classList.contains('out')) { d.classList.remove('out'); d.close(); } }, d.classList.contains('pop') ? 140 : 200);
}
for (const d of DIALOGS) {
  d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-close]')) closePanel(d); });
  d.addEventListener('cancel', (e) => { e.preventDefault(); closePanel(d); });
  d.addEventListener('close', () => {
    d._from?.setAttribute('aria-expanded', 'false'); document.querySelectorAll('#pult .pf.open').forEach((b) => b.classList.remove('open'));
    if (!anyOpen() && !tm.open) document.documentElement.classList.remove('locked'); d._from?.focus?.({ preventScroll: true });
  });
}
addEventListener('resize', () => DIALOGS.forEach((d) => d.open && place(d, d._from)), { passive: true });
document.querySelectorAll('#pult .pf').forEach((b) => b.addEventListener('click', () => {
  if (spinning) return;
  if (picker.open && picker._from === b && !picker.classList.contains('out')) return closePanel(picker);
  openPanel(picker, b, b.dataset.sec);
}));
// шторка: свайп вниз закрывает
{
  let y0 = null;
  picker.addEventListener('touchstart', (e) => { const inner = picker.firstElementChild; const cy = e.touches[0].clientY, nearTop = cy - picker.getBoundingClientRect().top < 56; y0 = picker.classList.contains('pop') || (inner.scrollTop > 0 && !nearTop) ? null : cy; }, { passive: true });
  picker.addEventListener('touchmove', (e) => { if (y0 == null) return; const dy = e.touches[0].clientY - y0; if (dy > 0) picker.style.transform = `translateY(${dy}px)`; }, { passive: true });
  picker.addEventListener('touchend', (e) => { if (y0 == null) return; const dy = e.changedTouches[0].clientY - y0; picker.style.transform = ''; y0 = null; if (dy > 90) closePanel(picker); });
}
const setSpin = (txt) => { $('#spin').firstChild.textContent = txt; };

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
  const need = Math.ceil(r.width / P) + 8; // запас карточек справа: src ставится заранее, за ~0.4 с до появления даже на полной скорости
  if (need !== K) {
    K = need; strip.textContent = '';
    cards = Array.from({ length: K }, () => { const d = document.createElement('div'); d.className = 'card'; d.innerHTML = '<img alt="" decoding="async"><span></span>'; strip.append(d); d.vi = null; const img = d.firstChild; img.onerror = () => d.classList.add('miss'); img.onload = () => d.classList.add('ok'); return d; });
  }
  paint(true);
  // эффекты живут только в сцене барабана: маска заканчивается под ним
  const b = reel.getBoundingClientRect().bottom + scrollY;
  document.documentElement.style.setProperty('--fxEnd', `${Math.round(b)}px`);
}
const mod = (a, n) => ((a % n) + n) % n;
// Лента барабана: заранее загруженные и декодированные постеры. Кадр v всегда показывает tape[v mod N],
// поэтому src меняется только у карточки, которая переезжает за краем, и только на уже декодированную картинку.
// items — точечные замены (победитель и соседи), их ставим только за пределами видимой части.
let tape = [];
const decoded = new Map();
const reelSrc = (t) => (t?.i ? poster(t.i, CW > 200 ? 400 : 300) : '');
function warm(src, ms = 2500) {
  if (!src) return Promise.resolve(false);
  let e = decoded.get(src);
  if (!e) {
    const im = new Image(); im.decoding = 'async'; im.alt = ''; im.src = src;
    im.onload = () => im.parentNode?.classList.add('ok'); im.onerror = () => im.parentNode?.classList.add('miss');
    e = { im, ok: false };
    e.p = (im.decode ? im.decode() : new Promise((r, j) => { im.onload = r; im.onerror = j; })).then(() => (e.ok = true), () => false);
    decoded.set(src, e);
  }
  return e.ok ? Promise.resolve(true) : Promise.race([e.p, new Promise((r) => setTimeout(() => r(false), ms))]);
}
const isWarm = (t) => !!decoded.get(reelSrc(t))?.ok;
function visRange() { const first = Math.floor((pos - CX) / P) - 1; return [first, first + K]; }
async function buildTape(list, n = 24) {
  const pool = list.filter((t) => t?.i).sort(() => Math.random() - 0.5).slice(0, n);
  if (!pool.length) return;
  const commit = (next) => {
    // видимые и запасные кадры закрепляем, чтобы смена ленты ничего не перерисовала на глазах
    const had = tape.length > 0;
    if (had && K) { const [a, b] = visRange(); for (let v = a; v < b; v++) if (!items.has(v)) items.set(v, itemAt(v)); }
    tape = next;
    const lo = visRange()[0] - 40; for (const k of items.keys()) if (k < lo) items.delete(k);
    paint(!had); kickDrift();
  };
  // первый раз (медленная сеть) лента растёт по мере декодирования; в ленту попадают только готовые постеры
  const grow = !tape.length, got = [];
  await Promise.all(pool.map((t) => warm(reelSrc(t), 15000).then((ok) => { if (!ok) return; got.push(t); if (grow && got.length >= 4) commit([...got]); })));
  if (!grow && got.length >= Math.min(6, pool.length)) commit(got);
  else if (!tape.length) commit(pool); // ничего не загрузилось: покажем заглушки с названиями
}
function itemAt(v) { return items.has(v) ? items.get(v) : tape.length ? tape[mod(v, tape.length)] : null; }
function paint(force) {
  const first = Math.floor((pos - CX) / P) - 1;
  for (let v = first; v < first + K; v++) {
    const el = cards[mod(v, K)];
    if (el.vi !== v || force) {
      el.vi = v;
      const t = itemAt(v);
      el.classList.remove('miss');
      let img = el.firstChild;
      const src = reelSrc(t), w = decoded.get(src);
      // уже декодированный <img> из кэша вставляем в карточку целиком: второй раз декодировать не нужно (большие PNG с AniList)
      if (w?.ok && w.im !== img && !w.im.isConnected) { el.replaceChild(w.im, img); img = w.im; el.classList.add('ok'); }
      if (img.getAttribute('src') !== src) { if (src) { img.src = src; el.classList.toggle('ok', isWarm(t) || (img.complete && img.naturalWidth > 0)); } else { img.removeAttribute('src'); el.classList.remove('ok'); el.classList.add('miss'); } }
      else if (img.complete && img.naturalWidth) el.classList.add('ok');
      el.lastChild.textContent = t ? t.t : '';
    }
    const x = v * P - pos + CX;
    const d = Math.min(1, Math.abs(x - CX) / (P * 2.4));
    el.style.transform = `translate3d(${x.toFixed(1)}px,0,0) scale(${(1 - d * 0.12).toFixed(3)})`;
    el.style.opacity = (1 - d * 0.5).toFixed(3);
    const c = Math.abs(x - CX) < P / 2; if (el.classList.contains('c') !== c) el.classList.toggle('c', c);
  }
  reel.style.setProperty('--sprocket', `${(-pos % 22).toFixed(1)}px`);
}
addEventListener('resize', () => measure(), { passive: true });
let tapeReady = seedPosters().then((s) => { display = s; return buildTape(s); }).catch(() => {}).finally(() => { measure(); kickDrift(); });
measure();

// покой: лента медленно дрейфует (только transform), стоит на паузе в фоне, при reduced-motion и во время крутки/результата
let driftRaf = 0, driftLast = 0;
const driftOn = () => !spinning && result.hidden && V.route.name === 'roulette' && !document.hidden && !reduce.matches && tape.length > 0 && P > 0;
function drift(now) {
  driftRaf = 0; if (!driftOn()) return;
  const dt = Math.min(0.05, (now - driftLast) / 1000); driftLast = now;
  pos += (P / 9) * dt; paint(); driftRaf = requestAnimationFrame(drift);
}
function kickDrift() { if (!driftRaf && driftOn()) { driftLast = performance.now(); driftRaf = requestAnimationFrame(drift); } }
document.addEventListener('visibilitychange', kickDrift);
setInterval(kickDrift, 800);

const preload = (t, w = 300, ms = 2500) => new Promise((res) => {
  if (!t?.i) return res();
  const im = new Image(); const done = () => res(); im.onload = done; im.onerror = done; setTimeout(done, ms); im.src = poster(t.i, w);
});

let landedAt = null;
async function spin() {
  if (spinning) return;
  spinning = true;
  const btn = $('#spin'); btn.disabled = true; setSpin('Крутим…'); document.body.classList.add('spinning');
  if (picker.open) closePanel(picker);
  say('');
  if (!result.hidden) await collapse();
  cancelAnimationFrame(driftRaf); driftRaf = 0;
  if (!tape.length) await Promise.race([tapeReady, new Promise((r) => setTimeout(r, 1500))]);
  reel.classList.remove('landed');
  applyFx(); phase('spin');
  const P0 = plan(); let lastQ = -1;
  // квантование картинки барабана (война 24 к/с, мелодрама 8 к/с)
  const draw = (now) => { if (P0.fps) { const q = Math.floor(now / (1000 / P0.fps)); if (q === lastQ) return; lastQ = q; } paint(); };
  scrollTo({ top: 0, behavior: reduce.matches ? 'auto' : 'smooth' });

  let v = 0, last = performance.now(), cruising = !reduce.matches;
  const vmax = Math.max(1800, P * 16);
  const cruise = (now) => {
    if (!cruising) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    v = Math.min(vmax, v + vmax * dt * 2.5); pos += v * dt; onReel(v); draw(now); requestAnimationFrame(cruise);
  };
  requestAnimationFrame(cruise);
  const t0 = performance.now();

  const ch = await choose();
  if (ch.error) {
    cruising = false; await settle(v);
    phase('idle'); finish();
    if (ch.empty) {
      // что сильнее режет выборку: годы/рейтинг или жанры
      const narrow = decRange() || prefs.from || prefs.to || Number(prefs.rating) || prefs.known;
      say('Под такие фильтры ничего не нашлось', narrow ? ['Сбросить годы и рейтинг', () => { resetYears(); resetRate(); changed(); }] : ['Убрать жанры', () => { resetGenres(); changed(); }]);
    } else say(ch.error);
    return;
  }
  const win = ch.win;
  display = ch.pool.map((x) => x.t);
  // победитель декодируется до торможения; если не успел за 6 с (барабан всё это время крутится) — кадр покажет заглушку с названием, без подмены на ходу
  await Promise.all([warm(reelSrc(win.t), 6000), preload(win.t, 600, 1500), new Promise((r) => setTimeout(r, Math.max(0, 650 - (performance.now() - t0))))]);
  const resetNote = ch.reset ? 'Всё подходящее уже выпадало, начинаю круг заново. ' : '';

  cruising = false;
  let T;
  if (reduce.matches) {
    T = Math.round(pos / P) + 1;
    items.set(T, win.t); pos = T * P; paint(true);
  } else {
    const vNow = Math.max(v, vmax * 0.6);
    const dist0 = vNow * 3.3 / 4;
    T = Math.round((pos + dist0) / P);
    // соседи победителя — только из уже декодированной ленты и только за краем видимой части
    const [va, vb] = visRange();
    const pickN = () => tape[Math.floor(Math.random() * tape.length)];
    for (let i = -6; i <= 4; i++) { const vv = T + i; if (vv >= va && vv < vb) continue; if (i) { if (tape.length) items.set(vv, pickN()); } else items.set(vv, win.t); }
    if (T >= va && T < vb) items.set(T, win.t);
    cards.forEach((c) => { if (c.vi != null && Math.abs(c.vi - T) <= 6 && !(c.vi >= va && c.vi < vb)) c.vi = null; });
    const p0 = pos, dist = T * P - p0, D = (4 * dist) / vNow * 1000;
    // кривая торможения по жанру: обычная, рапид в конце (мелодрама), почти стоп-кадр + доворот (боевик), перелёт и возврат (комедия)
    const kind = P0.land;
    const quart = (u) => 1 - Math.pow(1 - u, 4);
    let curve = quart, total = D;
    if (kind === 'rapid' && D > 1600) { const a = D - 1200, cA = D - 480; curve = (u) => { const tt = u * D; const tc = tt < a ? tt * (cA / a) : cA + (tt - a) * 0.4; return quart(Math.min(1, tc / D)); }; }
    if (kind === 'slowmo') {
      // почти стоп-кадр ×0.2 за 300ms до остановки, потом доворот 120ms
      const rem = Math.min(0.5, (P * 0.35) / dist), pA = 1 - rem, pB = pA + rem * 0.25, a = Math.max(400, D - 300); total = a + 420;
      curve = (u) => { const tt = u * total; if (tt < a) return pA * (1 - Math.pow(1 - tt / a, 3)); if (tt < a + 300) return pA + (pB - pA) * ((tt - a) / 300); return pB + (1 - pB) * (1 - Math.pow(1 - (tt - a - 300) / 120, 3)); };
    }
    if (kind === 'overshoot') { const ov = (P * 0.18) / dist; total = D + 220; curve = (u) => { const tt = u * total; if (tt < D) return quart(tt / D) * (1 + ov); const k = (tt - D) / 220; return 1 + ov * (1 - k * k * (3 - 2 * k)); }; }
    await new Promise((done) => {
      const s = performance.now(); let pv = pos, pt = s;
      const step = (now) => {
        const u = Math.min(1, (now - s) / total);
        pos = p0 + dist * curve(u); onReel((pos - pv) / Math.max(0.001, (now - pt) / 1000)); pv = pos; pt = now; draw(now);
        if (u < 1) requestAnimationFrame(step); else { paint(); done(); }
      };
      requestAnimationFrame(step);
    });
  }
  reel.classList.add('landed'); onReel(0);
  landFx(win.t); phase('land');
  remember(win.t, win.s || win.g, win.g);
  const note = resetNote + (ch.offline ? 'Сервер с данными не ответил, крутим из встроенной подборки.' : '');
  const center = cards.find((c) => c.vi === T);
  const hold = wow(center);
  await new Promise((r) => setTimeout(r, reduce.matches ? 0 : hold));
  showResult(win.t, win.s || win.g, win.g, center?.getBoundingClientRect());
  phase('result');
  tapeReady = buildTape([...display, ...tape]);
  finish(); setSpin('Ещё раз'); say(note);
  if (note) setTimeout(() => { if ($('#status').textContent === note) say(''); }, 6000);
}
const bad = new Set();
// Подбор: пул по логике групп, затем проверка кандидата по полной карточке IMDb (интересы, страна).
async function choose() {
  const P = pairs(), f = filters();
  let res;
  try { res = await getPool(P, f); } catch { res = { pool: [] }; }
  if (res.conflict) return { error: res.conflict };
  const pool = res.pool.filter((x) => !bad.has(x.t.id));
  const W = noWatched() ? watchedIds() : null;
  if (W?.size) { const left = pool.filter((x) => !W.has(x.t.id)); if (left.length) pool.splice(0, pool.length, ...left); }
  let fresh = prefs.noRepeat ? pool.filter((x) => !seen.has(x.t.id)) : pool.slice();
  let reset = false;
  if (!fresh.length && pool.length) { fresh = pool.slice(); reset = true; }
  fresh.sort(() => Math.random() - 0.5);
  for (const c of fresh.slice(0, 6)) {
    const g = byId[c.g], s = byId[c.s];
    if (c.t.src === 'al') { if (matchLocal(c.t, g, s, f)) return { win: c, pool, offline: res.offline, reset }; continue; }
    let d = null;
    // офлайн-записи уже проверены при сборке каталога — не ждём таймаутов API
    if (!c.snap) for (let k = 0; k < (res.offline ? 1 : 2) && !d; k++) { try { d = await core(c.t.id); } catch {} }
    if (!d) { if (matchLocal(c.t, g, s, f) && (c.snap || !s || !(s.anyI || s.noI))) return { win: c, pool, offline: res.offline, reset }; continue; }
    d.i = d.i || c.t.i;
    if (matchFull(d, g, s, f)) return { win: { ...c, t: d }, pool, offline: res.offline, reset };
    bad.add(c.t.id);
  }
  const want = P.map(([g, s]) => (s ? `${g.label}, ${s.label}` : g.label).toLowerCase()).join(' или ');
  return { empty: true, error: `Не нашлось ничего${want ? ` под «${want}»` : ''} с такими фильтрами.` };
}
async function settle(v) {
  if (reduce.matches) return;
  const T = Math.ceil((pos + v * 0.3) / P), p0 = pos, dist = T * P - p0;
  await new Promise((done) => { const s = performance.now(); const st = (n) => { const u = Math.min(1, (n - s) / 600); pos = p0 + dist * (1 - Math.pow(1 - u, 3)); paint(); u < 1 ? requestAnimationFrame(st) : done(); }; requestAnimationFrame(st); });
}
function finish() {
  spinning = false;
  const btn = $('#spin'); btn.disabled = false; setSpin('Крутить'); document.body.classList.remove('spinning');
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
  share: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3.5M7.5 8 12 3.5 16.5 8"/><path d="M5 12.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-6.5"/></svg>',
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
// фразы о происхождении фильма — не сюжет
const ORIGIN = /(по мотивам|экранизаци|снят[аоы]? по|основан[аоы]? на|по одноим|адаптаци|по роману|по пьесе|по повести|по комиксу|по манге|по ранобэ|по рассказу|ремейк|премьер|кассов|номинир|премии|«Оскар|Оскар»|сборы)/i;
function stripOrigin(s) {
  const parts = String(s || '').match(/[^.!?…]+[.!?…]+(?:\s|$)|[^.!?…]+$/g) || [];
  if (parts.length < 2) return s;
  const keep = parts.filter((x, i) => i === 0 ? !ORIGIN.test(x.replace(/^[^—–-]*[—–-]/, '')) : !ORIGIN.test(x));
  return (keep.length ? keep : parts.slice(0, 1)).join('').trim();
}
// из вводной вики оставляем только сюжетные предложения (без «— американский фильм», режиссёров, сезонов, премьер)
const META = /(\s[—–-]\s[^.]*?(фильм|сериал|аниме|мультфильм|мультсериал|драма|комедия|триллер|боевик|мини-сериал)|режисс|снят[аоы]?\b|вышел|вышла|выход|сезон|эпизод|сери[ия]|в ролях|главных ролях|студи[ия]|продюсер|сценари|прокат|рейтинг|фестивал|релиз|транслир|канал|телеканал|стриминг|платформ)/i;
function plotFromLead(s) {
  const parts = String(s || '').match(/[^.!?…]+[.!?…]+(?:\s|$)|[^.!?…]+$/g) || [];
  const keep = parts.filter((x) => !ORIGIN.test(x) && !META.test(x)).join('').trim();
  return keep.length >= 70 ? keep : '';
}
const crumbText = () => { const P = pairs(); return P.length ? P.map(([g, s]) => (s ? `${g.label} · ${low(s)}` : g.label)).join(' + ') : 'Любой жанр'; };
let token = 0, curT = null, curChip = null, curG = null;
function showResult(t, chipId, gId, fromRect) {
  const my = ++token;
  curChip = chipId; curG = gId;
  render(t, false);
  open(fromRect);
  if (V.route.name === 'roulette' || V.route.name === 'title') V.setUrl('title/' + t.id);
  details(t).then((d) => { if (my === token) { render(d, true); patchHistory(d); } }).catch(() => {});
}
const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" fill="currentColor"/></svg>';
function render(t, full) {
  curT = t;
  const my = token;
  const title = t.ru || ruCached(t.id) || t.t;
  const orig = [title !== t.t ? t.t : null, t.o && t.o !== (t.ru || t.t) ? t.o : null].filter(Boolean)[0];
  const isSeries = /tvSeries|tvMiniSeries/.test(t.k);
  const years = isSeries && t.y ? `${t.y}${t.e && t.e !== t.y ? '–' + t.e : t.e ? '' : '–…'}` : t.y || '';
  const dur = isSeries ? (t.seasons ? `${t.seasons}\u00a0${plural(t.seasons, 'сезон', 'сезона', 'сезонов')}` : t.ep ? `${t.ep}\u00a0${plural(t.ep, 'серия', 'серии', 'серий')}` : '') : runtime(t.s);
  const wantG = [].concat(byId[curG]?.q?.genres || []);
  const genres = [...(t.g || [])].sort((a, b) => wantG.includes(b) - wantG.includes(a)).slice(0, 3).map((g) => GENRE_RU[g] || g).join(', ');
  const kick = [kindOf(t), years, genres ? genres[0].toUpperCase() + genres.slice(1) : ''].filter(Boolean);
  const dirs = t.src === 'al' ? [] : (t.directors || []).slice(0, 2), cast = t.src === 'al' ? [] : (t.stars || []).slice(0, 3);
  // описание: сюжет из ру-вики → вводная ру-вики без фраз о происхождении → английский сюжет с пометкой
  const ruPlot = (t.plotRu ? cleanWiki(t.plotRu) : '') || plotFromLead(cleanWiki(t.wiki || '')), lead = t.wiki ? stripOrigin(cleanWiki(t.wiki)) : '';
  const txt = ruPlot || lead || t.p, isEn = !ruPlot && !lead && !!t.p;
  const desc = txt ? `${isEn ? '<p class="elabel">Описание на английском</p>' : ''}<p class="desc${isEn ? ' en' : ''}" id="desc"${isEn ? ' lang="en"' : ''}>${esc(txt)}</p><button class="moreDesc" type="button" data-act="more" hidden>Ещё</button>`
    : full ? '' : '<p class="desc muted">Загружаю описание…</p>';
  const keepPoster = result.querySelector('.poster img')?.dataset.id === t.id;
  const posterHTML = `<div class="poster${t.i ? '' : ' miss'}" id="rposter" data-t="${esc(title)}">${t.i ? `<img src="${poster(t.i, 600)}" data-id="${t.id}" alt="Постер: ${esc(title)}" onerror="this.parentNode.classList.add('miss')">` : ''}</div>`;
  const fact = (k, v, cls = '') => `<div class="fact${cls}"><small>${k}</small><b>${v}</b></div>`;
  const facts = [
    t.r ? fact(t.src === 'al' ? 'AniList' : 'IMDb', `${STAR}${t.r.toFixed(1)}`, ' score') : '',
    dur ? fact(isSeries ? 'Сезоны' : 'Длительность', esc(dur)) : '',
    dirs.length ? fact(dirs.length > 1 ? 'Режиссёры' : 'Режиссёр', esc(dirs.join(', ')), ' dir') : '',
    cast.length ? fact('В ролях', esc(cast.join(', ')), ' cast') : '',
  ].join('');
  const tr = trState.get(t.id);
  const infoHTML = `
    <div class="info">
      <p class="kick">${kick.map((x) => `<span>${esc(x)}</span>`).join('')}</p>
      <h2 class="${title.length > 34 ? 'xl' : title.length > 18 ? 'l' : ''}">${esc(title)}</h2>
      ${orig ? `<p class="orig" lang="en">${esc(orig)}</p>` : ''}
      ${facts ? `<div class="facts">${facts}</div>` : ''}
      ${desc}
      <div class="actions">
        <button class="btn primary" type="button" data-act="trailer"${tr === false ? ' disabled' : ''}>${tr === false ? 'Трейлера нет' : ico.play + 'Трейлер'}</button>
        <button class="btn" type="button" data-act="where" aria-expanded="false" aria-controls="where">Где посмотреть ${ico.ext}</button>
        <button class="btn sq" type="button" data-act="share" aria-label="Поделиться" title="Поделиться">${ico.share}</button>
        <span class="lacts">${V.iconBtns(t.id)}</span>
        <div class="where" id="where" hidden>${whereLinks(t, title)}</div>
      </div>
    </div>
  `;
  if (keepPoster) { result.querySelector('.info')?.remove(); result.insertAdjacentHTML('beforeend', infoHTML); }
  else result.innerHTML = posterHTML + infoHTML;
  V.remember(t); V.syncButtons(result);
  if (full) loadSimilar(t);
  // точная ссылка на Кинопоиск (Wikidata P2603) и русское название, если их ещё нет в кэше
  ruTitles([t.id]).then(() => {
    if (curT?.id !== t.id) return;
    const a = result.querySelector('#where a[data-kp]'); if (a) a.href = kpURL(t, title);
    const ru = ruCached(t.id), h = result.querySelector('.info h2');
    if (ru && !t.ru && h && h.textContent !== ru) { h.textContent = ru; if (!result.querySelector('.orig')) h.insertAdjacentHTML('afterend', `<p class="orig" lang="en">${esc(t.t)}</p>`); }
  });
  const d = $('#desc'); if (d) requestAnimationFrame(() => { if (d.scrollHeight > d.clientHeight + 2) result.querySelector('.moreDesc').hidden = false; });
  if (t.i) { const bd = $('#backdrop'); bd.style.backgroundImage = `url("${poster(t.i, 300)}")`; }
  // есть ли трейлер: если не нашёлся ни на одном языке — кнопка «Трейлера нет»
  if (full && tr == null) {
    const l = prefs.tlang || 'ru';
    findTrailer(t, l).then((r) => r || findTrailer(t, l === 'ru' ? 'en' : 'ru')).catch(() => null).then((r) => {
      trState.set(t.id, !!r);
      if (!r && my === token && curT?.id === t.id) { const b = result.querySelector('[data-act="trailer"]'); if (b) { b.disabled = true; b.textContent = 'Трейлера нет'; } }
    });
  }
}
const trState = new Map();
const SPRING = 'cubic-bezier(.2, 1.25, .35, 1)';
function open(fromRect) {
  const was = !result.hidden;
  result.hidden = false; stage.classList.add('show'); document.body.classList.add('has-result');
  $('#where')?.setAttribute('hidden', '');
  const img = result.querySelector('.poster');
  if (!was && fromRect && img && !reduce.matches) {
    const to = img.getBoundingClientRect();
    const dx = fromRect.left - to.left, dy = fromRect.top - to.top, sx = fromRect.width / to.width, sy = fromRect.height / to.height;
    img.animate([{ transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, borderRadius: '6px' }, { transform: 'none' }], { duration: 460, easing: 'cubic-bezier(.16,1,.3,1)' });
    result.querySelectorAll('.info > *').forEach((el, i) => el.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 320, delay: 200 + i * 40, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }));
    result.animate([{ backgroundColor: 'rgb(12 11 10 / 0)', borderColor: 'transparent' }, {}], { duration: 420, easing: 'ease-out' });
  }
}
// «Ещё раз»: карточка сворачивается обратно в кадр плёнки
async function collapse() {
  const img = result.querySelector('.poster');
  if (img && !reduce.matches) {
    const from = img.getBoundingClientRect(), gate = $('#gate').getBoundingClientRect();
    const to = { left: gate.left + 6, top: gate.top + 6, width: CW, height: CW * 1.5 };
    const dx = to.left - from.left, dy = to.top - from.top, sx = to.width / from.width, sy = to.height / from.height;
    const a = img.animate([{ transform: 'none' }, { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, borderRadius: '6px' }], { duration: 380, easing: 'cubic-bezier(.5,0,.2,1)', fill: 'forwards' });
    result.querySelectorAll('.info').forEach((el) => el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: 'forwards' }));
    result.animate([{}, { backgroundColor: 'rgb(12 11 10 / 0)', borderColor: 'transparent' }], { duration: 300, fill: 'forwards' });
    await a.finished.catch(() => {});
  }
  result.getAnimations({ subtree: true }).forEach((a) => a.cancel());
  result.hidden = true; result.innerHTML = ''; stage.classList.remove('show'); document.body.classList.remove('has-result');
  phase('idle');
  if (V.route.name === 'roulette') V.setUrl('');
}
function kpURL(t, title) {
  const kp = kpCached(t.id);
  if (kp) return `https://www.kinopoisk.ru/${/tvSeries|tvMiniSeries/.test(t.k || '') ? 'series' : 'film'}/${kp}/`;
  return `https://www.kinopoisk.ru/index.php?kp_query=${encodeURIComponent(`${title} ${t.y || ''}`.trim())}`;
}
function whereLinks(t, title) {
  const q = encodeURIComponent(title), qo = encodeURIComponent(t.t);
  const L = [
    ['Кинопоиск', kpURL(t, title), 'kp'],
    ['Okko', `https://okko.tv/search/${q}`],
    ['Иви', `https://www.ivi.ru/search/?q=${q}`],
    ['JustWatch', `https://www.justwatch.com/ru/%D0%BF%D0%BE%D0%B8%D1%81%D0%BA?q=${qo}`],
    ...(t.src === 'al' ? [['AniList', `https://anilist.co/anime/${t.al}`], ...(t.mal ? [['MyAnimeList', `https://myanimelist.net/anime/${t.mal}`]] : [])] : [['IMDb', `https://www.imdb.com/title/${t.id}/`]]),
  ];
  return L.map(([n, u, k]) => `<a href="${u}"${k ? ` data-${k}` : ''} target="_blank" rel="noopener">${n}${ico.ext}</a>`).join('');
}
result.addEventListener('click', (e) => {
  const mini = e.target.closest('.rmini');
  if (mini && spinning) return;
  if (mini) { const h = hist.find((x) => x.id === mini.dataset.id); if (h) { landFx(h); result.innerHTML = ''; result.hidden = true; showResult(h, h.chip, h.gc, mini.getBoundingClientRect()); } return; }
  const b = e.target.closest('[data-act]'); if (!b) return;
  const act = b.dataset.act;
  if (act === 'trailer') openTrailer(curT, b);
  if (act === 'again') spin();
  if (act === 'edit') { if (!spinning) collapse().then(() => $('#fGenre').focus()); }
  if (act === 'share') openShare(curT);
  if (act === 'more') { $('#desc').classList.add('open'); b.remove(); }
  if (act === 'where') {
    const w = $('#where'), op = w.hidden; w.hidden = !op; b.setAttribute('aria-expanded', op);
    if (op) { w.querySelector('a')?.focus({ preventScroll: true }); w.scrollIntoView({ block: 'nearest', behavior: reduce.matches ? 'auto' : 'smooth' }); }
  }
});
// ---------- Поделиться ----------
async function openShare(t) {
  if (!t) return;
  const d = $('#shareDlg'), title = t.ru || ruCached(t.id) || t.t, url = new URL('?t=' + t.id, document.baseURI).href;
  const meta = [kindOf(t), t.y].filter(Boolean).join(' · ');
  d.innerHTML = `<div class="af shr"><div class="ahead"><h2>Поделиться</h2><button class="px" type="button" data-close aria-label="Закрыть"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button></div>
    <div class="shprev load" aria-label="Картинка для сторис"><span>Рисую картинку…</span></div>
    <button class="abtn" type="button" data-s="link"><span>Отправить ссылку</span></button>
    <button class="btn ghost wide" type="button" data-s="img" disabled>${navigator.canShare ? 'Поделиться картинкой' : 'Скачать картинку'}</button>
    <p class="anote">Картинка 1080×1920 для сторис: постер, название, рейтинг.</p></div>`;
  if (!d.open) d.showModal();
  d.querySelector('[data-close]').onclick = () => d.close();
  d.onclick = (e) => { if (e.target === d) d.close(); };
  let blob = null;
  d.querySelector('[data-s="link"]').onclick = async () => { const r = await shareLink(url, title); if (r === 'copied') V.toast('Ссылка скопирована'); else if (r === 'fail') V.toast(url, null, 5000); };
  const ib = d.querySelector('[data-s="img"]');
  ib.onclick = async () => { if (!blob) return; const r = await shareImage(blob, `kinoruletka-${t.id}.jpg`, title); if (r === 'saved') V.toast('Картинка сохранена'); };
  blob = await storyBlob(t, title, meta).catch(() => null);
  const pv = d.querySelector('.shprev'); if (!pv) return;
  if (blob) { pv.classList.remove('load'); pv.innerHTML = ''; const im = new Image(); im.alt = 'Картинка для сторис: ' + title; im.src = URL.createObjectURL(blob); pv.append(im); ib.disabled = false; }
  else { pv.classList.remove('load'); pv.innerHTML = '<span>Картинку собрать не вышло, но ссылкой поделиться можно.</span>'; }
}
// мобилка: свайп карточки влево — «Другой»
{
  let sx = 0, sy = 0, st = 0, drag = false;
  result.addEventListener('touchstart', (e) => { if (e.touches.length !== 1 || e.target.closest('.where, .desc.open')) return; sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now(); drag = true; }, { passive: true });
  result.addEventListener('touchmove', (e) => { if (!drag) return; const dx = e.touches[0].clientX - sx, dy = e.touches[0].clientY - sy; if (Math.abs(dy) > Math.abs(dx)) { drag = false; result.style.transform = ''; return; } if (dx < 0) result.style.transform = `translateX(${Math.max(dx, -140) * 0.6}px)`; }, { passive: true });
  result.addEventListener('touchend', (e) => {
    if (!drag) return; drag = false;
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    result.style.transition = 'transform .25s cubic-bezier(.2,.8,.2,1)'; result.style.transform = '';
    setTimeout(() => (result.style.transition = ''), 260);
    if (dx < -70 && Math.abs(dy) < 60 && Date.now() - st < 900 && !spinning) spin();
  });
}
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
function drawHistory() { dispatchEvent(new CustomEvent('kr:hist')); }

// ---------- разделы ----------
function resetResult() {
  result.getAnimations({ subtree: true }).forEach((a) => a.cancel());
  result.hidden = true; result.innerHTML = ''; stage.classList.remove('show'); document.body.classList.remove('has-result'); phase('idle'); curT = null;
}
let titleReq = 0;
V.initViews({
  // логотип и «Рулетка» ведут на чистый барабан; из других разделов результат сохраняется
  roulette(prev) {
    if (prev === 'title') { resetResult(); setSpin('Крутить'); }
    else if (prev === 'roulette') { if (curT && !result.hidden && !spinning) collapse().then(() => { curT = null; setSpin('Крутить'); }); }
    else if (curT && !result.hidden) V.setUrl('title/' + curT.id);
    requestAnimationFrame(() => measure());
  },
  async title(id) {
    if (curT?.id === id && !result.hidden) { phase('result'); return; }
    const my = ++titleReq; resetResult();
    const cached = hist.find((h) => h.id === id);
    if (!cached) { stage.classList.add('show'); result.hidden = false; document.body.classList.add('has-result'); result.innerHTML = '<div class="poster sk" aria-hidden="true"></div><div class="info" aria-busy="true"><p class="kick"><span class="skl" style="width:140px"></span></p><h2><span class="skl" style="width:70%;height:.9em"></span></h2><p class="desc muted">Загружаю…</p></div>'; }
    try {
      const t = cached || await V.getTitle(id);
      if (my !== titleReq) return;
      landFx(t); showResult(t, null, null, null); phase('result');
    } catch (err) { if (my === titleReq && (navigator.onLine === false || err?.name === 'TypeError' || err?.name === 'AbortError')) { stage.classList.add('show'); result.hidden = false; result.innerHTML = '<div class="info"><h2>Нет связи</h2><p class="desc">Не получилось загрузить тайтл. Проверь интернет.</p><div class="actions"><button class="btn primary" type="button" id="tRetry">Повторить</button></div></div>'; $('#tRetry').onclick = () => V.navigate('title/' + id, { replace: true }); return; }
      if (my === titleReq) { stage.classList.add('show'); result.hidden = false; result.innerHTML = '<div class="info"><h2>Не нашли такой тайтл</h2><p class="desc">Возможно, ссылка битая. <a href="catalog" data-nav>В каталог</a></p></div>'; } }
  },
  leave() {},
  spinWith(m) {
    prefs.sel = [...(m.sel || [])]; prefs.sub = {}; prefs.dec = []; prefs.from = prefs.to = '';
    prefs.rating = m.rating || 0; prefs.known = !!m.known; rating.value = prefs.rating; showRating();
    savePrefs(); syncUI(); applyFx();
    if (curT) resetResult();
    setTimeout(spin, 120);
  },
  recent: () => hist.map((h) => ({ ...h })),
  clearRecent() { hist = []; seen = new Set(); save(LS.hist, hist); save(LS.seen, []); },
});
$('#searchBtn').addEventListener('click', () => V.openSearch());
// «Похожее» под разворотом: клик заменяет текущий результат тем же переездом постера
function loadSimilar(t) {
  const info = result.querySelector('.info'); if (!info || info.querySelector('.sim')) return;
  info.insertAdjacentHTML('beforeend', V.simHTML());
  const sec = info.querySelector('.sim'), my = token;
  V.similar(t).then((list) => { if (my === token && sec.isConnected) V.fillSim(sec, list, pickSimilar); }).catch(() => sec.remove());
}
function pickSimilar(t, rect) {
  if (spinning) return;
  landFx(t); result.getAnimations({ subtree: true }).forEach((a) => a.cancel());
  result.innerHTML = ''; result.hidden = true; stage.classList.remove('show');
  scrollTo({ top: 0, behavior: reduce.matches ? 'auto' : 'smooth' });
  showResult(t, null, null, rect); phase('result');
}

// для тестов
window.__kr = {
  tape: () => tape.map((t) => [reelSrc(t).slice(-24), isWarm(t)]),
  spin, setGenre, phase, wow: (id) => { setGenre(id); return wow(cards.find((c) => c.classList.contains('c'))); }, genreNow, choose, gl: () => glInfo(), cleanWiki,
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
