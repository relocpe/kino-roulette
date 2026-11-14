import { GENRES, SUBS, byId, GENRE_RU, isGenre } from './chips.js?v=4';
import { findTrailer, ytSearch } from './trailer.js?v=4';
import { getPool, details, core, matchFull, matchLocal, poster, seedPosters } from './api.js?v=4';
import { setFx, burst, glInfo } from './fx.js?v=4';
import './sound.js?v=4';

const $ = (s) => document.querySelector(s);
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const LS = { prefs: 'kr:prefs', hist: 'kr:hist', seen: 'kr:seen' };
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const prefs = Object.assign({ mode: 'all', sel: [], sub: {}, multi: false, from: '', to: '', rating: 6.5, noRepeat: true }, load(LS.prefs, {}));
prefs.sel = (prefs.sel || []).filter((id) => isGenre.has(id)).slice(0, prefs.multi ? 3 : 1);
prefs.sub = Object.fromEntries(Object.entries(prefs.sub || {}).filter(([g, x]) => prefs.sel.includes(g) && SUBS[g]?.includes(x)));
const MAX = 3;
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

// ---------- фильтры ----------
// Жанр: один (как радио) или до трёх. Под выбранным жанром раскрываются его уточнения, максимум одно.
function chipEl(c, cls = '') {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'chip' + cls; b.dataset.id = c.id; b.textContent = c.label;
  b.style.setProperty('--c', c.accent);
  return b;
}
GENRES.forEach((c) => { const b = chipEl(c); b.addEventListener('click', () => toggle(c.id, b)); $('#genres').append(b); });

function hint(msg, b) {
  if (b && !reduce.matches) { b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); }
  note(msg);
}
function toggle(id, b) {
  const on = !prefs.sel.includes(id);
  if (!on) { prefs.sel = prefs.sel.filter((x) => x !== id); delete prefs.sub[id]; }
  else if (!prefs.multi) { prefs.sel = [id]; prefs.sub = {}; }
  else if (prefs.sel.length >= MAX) return hint(`Максимум ${MAX} жанра. Сними один, чтобы добавить «${byId[id].label}».`, b);
  else prefs.sel = [...prefs.sel, id];
  syncChips(); savePrefs(); note(); applyFx();
  if (on) burst(0.5);
}
function pickSub(g, s) {
  if (s && prefs.sub[g] !== s) prefs.sub[g] = s; else delete prefs.sub[g];
  syncChips(); savePrefs(); note(); applyFx();
  if (s) burst(0.5);
}
function setMulti(m) {
  prefs.multi = m;
  if (!m && prefs.sel.length > 1) { prefs.sel = prefs.sel.slice(0, 1); prefs.sub = prefs.sub[prefs.sel[0]] ? { [prefs.sel[0]]: prefs.sub[prefs.sel[0]] } : {}; }
  syncChips(); savePrefs(); note(); applyFx();
}
document.querySelectorAll('.count-seg button').forEach((b) => b.addEventListener('click', () => setMulti(b.dataset.multi === '1')));

// ряды уточнений: один на каждый выбранный жанр, у которого они есть
function syncChips() {
  document.querySelectorAll('#genres .chip').forEach((b) => b.setAttribute('aria-pressed', prefs.sel.includes(b.dataset.id)));
  document.querySelectorAll('.count-seg button').forEach((b) => b.setAttribute('aria-checked', String((b.dataset.multi === '1') === !!prefs.multi)));
  const box = $('#subs');
  const want = prefs.sel.filter((g) => SUBS[g]);
  for (const row of [...box.children]) if (!want.includes(row.dataset.g)) { row.classList.remove('open'); row.classList.add('closing'); setTimeout(() => row.remove(), reduce.matches ? 0 : 260); }
  for (const g of want) {
    let row = box.querySelector(`.subrow[data-g="${g}"]:not(.closing)`);
    if (!row) {
      row = document.createElement('div'); row.className = 'subrow'; row.dataset.g = g;
      row.innerHTML = `<div class="subin"><span class="sublbl">${esc(byId[g].label)}</span></div>`;
      const inner = row.firstChild;
      const any = chipEl({ id: '', label: 'Любые', accent: byId[g].accent }, ' sub'); any.addEventListener('click', () => pickSub(g, null)); inner.append(any);
      for (const sid of SUBS[g]) { const c = byId[sid]; const b = chipEl({ ...c, label: c.label.replace('Психологический триллер', 'Психологический') }, ' sub'); b.addEventListener('click', () => pickSub(g, sid)); inner.append(b); }
      box.append(row);
      requestAnimationFrame(() => requestAnimationFrame(() => row.classList.add('open')));
    }
    row.querySelectorAll('.chip').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.id || null) === (prefs.sub[g] || null))));
  }
  // порядок рядов = порядок выбора
  for (const g of want) { const r = box.querySelector(`.subrow[data-g="${g}"]:not(.closing)`); if (r) box.append(r); }
}
syncChips();

const pairs = () => prefs.sel.map((g) => [byId[g], byId[prefs.sub[g]] || null]);
const label = ([g, s]) => s ? `${g.label.toLowerCase()} · ${s.label.toLowerCase()}` : g.label.toLowerCase();
// эффект — по первому выбранному жанру (его уточнение главное, жанр фоном)
function applyFx(gId, sId) {
  let g = byId[gId], s = byId[sId];
  if (!g && !s) { const p = pairs()[0]; if (p) [g, s] = p; }
  const main = s || g;
  setFx(main ? main.fx : 'idle', main?.accent, s && g ? g.fx : null);
}
function note(extra) {
  const P = pairs();
  let html = !P.length ? 'Жанр не выбран, крутим всё подряд.' : `Ищем: ${P.map((p) => `<b>${esc(label(p))}</b>`).join(' или ')}`;
  if (prefs.mode === 'movie' && P.some(([, s]) => s?.series)) html += `<br><span class="warn">${P.filter(([, s]) => s?.series).map(([, s]) => s.label).join(' и ')}: только среди сериалов.</span>`;
  if (extra) html += `<br><span class="warn">${esc(extra)}</span>`;
  $('#selnote').innerHTML = html;
  $('#clearSel').hidden = !prefs.sel.length;
}
$('#clearSel').addEventListener('click', () => {
  prefs.sel = []; prefs.sub = {}; savePrefs(); syncChips(); note();
  applyFx();
});

document.querySelectorAll('.seg button').forEach((b) => {
  b.setAttribute('aria-checked', b.dataset.mode === prefs.mode);
  b.addEventListener('click', () => {
    prefs.mode = b.dataset.mode; savePrefs(); note();
    document.querySelectorAll('.seg button').forEach((x) => x.setAttribute('aria-checked', x === b));
  });
});
const yFrom = $('#yFrom'), yTo = $('#yTo'), rating = $('#rating');
yFrom.value = prefs.from; yTo.value = prefs.to; rating.value = prefs.rating;
const showRating = () => ($('#ratingOut').textContent = Number(rating.value) ? Number(rating.value).toFixed(1) : 'любой');
showRating();
rating.addEventListener('input', () => { prefs.rating = Number(rating.value); showRating(); savePrefs(); });
for (const el of [yFrom, yTo]) el.addEventListener('change', () => { prefs.from = yFrom.value; prefs.to = yTo.value; savePrefs(); });
$('#noRepeat').checked = prefs.noRepeat;
$('#noRepeat').addEventListener('change', (e) => { prefs.noRepeat = e.target.checked; savePrefs(); });
note();
applyFx();

function filters() {
  const y = (v) => { const n = parseInt(v, 10); return n >= 1880 && n <= 2035 ? n : undefined; };
  let from = y(yFrom.value), to = y(yTo.value);
  if (from && to && from > to) [from, to] = [to, from];
  const ids = [...prefs.sel, ...Object.values(prefs.sub)];
  const niche = ids.some((id) => ['kdrama', 'anime', 'noir', 'slasher', 'truecrime', 'cyberpunk', 'western', 'music', 'documentary', 'detective', 'dystopia', 'psycho', 'sitcom', 'mini'].includes(id));
  return { mode: prefs.mode, from, to, minRating: Number(rating.value) || 0, minVotes: niche ? 1500 : 4000 };
}

// ---------- барабан ----------
const reel = $('#reel'), strip = $('#strip');
let CW = 0, P = 0, CX = 0, K = 0, cards = [];
let pos = 0, items = new Map(), display = [];
function measure() {
  const r = reel.getBoundingClientRect();
  CW = parseFloat(getComputedStyle(reel).getPropertyValue('--cw')) || strip.querySelector('.card')?.offsetWidth || 160;
  const probe = document.createElement('div'); probe.style.width = 'var(--cw)'; reel.append(probe); CW = probe.offsetWidth || CW; probe.remove();
  P = CW + 14; CX = r.width / 2 - CW / 2;
  const need = Math.ceil(r.width / P) + 4;
  if (need !== K) {
    K = need; strip.textContent = '';
    cards = Array.from({ length: K }, () => { const d = document.createElement('div'); d.className = 'card'; d.innerHTML = '<img alt="" decoding="async"><span></span>'; strip.append(d); d.vi = null; const img = d.firstChild; img.onerror = () => d.classList.add('miss'); return d; });
  }
  paint(true);
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
      const src = t?.i ? poster(t.i, 300) : '';
      if (img.getAttribute('src') !== src) { if (src) img.src = src; else { img.removeAttribute('src'); el.classList.add('miss'); } }
      el.lastChild.textContent = t ? t.t : '';
    }
    const x = v * P - pos + CX;
    const d = Math.min(1, Math.abs(x - CX) / (P * 2.2));
    el.style.transform = `translate3d(${x.toFixed(1)}px,0,0) scale(${(1 - d * 0.1).toFixed(3)})`;
    el.style.opacity = (1 - d * 0.45).toFixed(3);
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

let spinning = false;
async function spin() {
  if (spinning) return;
  spinning = true;
  const btn = $('#spin'); btn.disabled = true; btn.firstChild.textContent = 'Крутим…';
  $('#status').textContent = '';
  reel.classList.remove('landed');
  if (matchMedia('(max-width: 900px)').matches) reel.scrollIntoView({ behavior: reduce.matches ? 'auto' : 'smooth', block: 'center' });

  // разгон начинается сразу, данные догоняют
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
    finish(); $('#status').textContent = ''; note(ch.error);
    $('#selnote').scrollIntoView?.({ block: 'nearest' });
    return;
  }
  note();
  const win = ch.win, res = ch;
  display = ch.pool.map((x) => x.t);
  await Promise.all([preload(win.t, 300), preload(win.t, 600, 1500), new Promise((r) => setTimeout(r, Math.max(0, 650 - (performance.now() - t0))))]);
  const resetNote = ch.reset ? 'Всё подходящее уже выпадало, начинаю круг заново. ' : '';

  cruising = false;
  if (reduce.matches) {
    const T = Math.round(pos / P) + 1;
    for (let i = -4; i <= 4; i++) items.delete(T + i);
    items.set(T, win.t); pos = T * P; paint(true);
  } else {
    const vNow = Math.max(v, vmax * 0.6);
    const dist0 = vNow * 3.3 / 4;
    const T = Math.round((pos + dist0) / P);
    for (let i = -6; i <= 4; i++) if (i) items.set(T + i, display[Math.floor(Math.random() * display.length)]);
    items.set(T, win.t);
    // подменяем уже отрисованные карточки у финиша
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
  $('#status').textContent = resetNote + (res.offline ? 'Сервер с данными не ответил, крутим из встроенной подборки.' : '');
  showResult(win.t, win.s || win.g, win.g);
  finish();
}
const bad = new Set();
// Подбор: пул по логике групп, затем проверка кандидата по полной карточке IMDb (интересы, страна).
async function choose() {
  const P = pairs(), f = filters();
  let res;
  try { res = await getPool(P, f); } catch { res = { pool: [] }; }
  if (res.conflict) return { error: 'Мини-сериалы и ситкомы бывают только среди сериалов. Переключи на «Сериалы» или «Всё».' };
  const pool = res.pool.filter((x) => !bad.has(x.t.id));
  let fresh = prefs.noRepeat ? pool.filter((x) => !seen.has(x.t.id)) : pool.slice();
  let reset = false;
  if (!fresh.length && pool.length) { fresh = pool.slice(); reset = true; }
  fresh.sort(() => Math.random() - 0.5);
  for (const c of fresh.slice(0, 6)) {
    let d = null;
    for (let k = 0; k < 2 && !d; k++) { try { d = await core(c.t.id); } catch {} }
    const g = byId[c.g], s = byId[c.s];
    // без карточки принимаем только то, что не требует проверки интересов, или офлайн-подборку (она проверена заранее)
    if (!d) { if (matchLocal(c.t, g, s, f) && (c.snap || !s || !(s.anyI || s.noI))) return { win: c, pool, offline: res.offline, reset }; continue; }
    d.i = d.i || c.t.i;
    if (matchFull(d, g, s, f)) return { win: { ...c, t: d }, pool, offline: res.offline, reset };
    bad.add(c.t.id);
  }
  const want = P.map(label).join(' или ');
  return { error: `Не нашлось ничего${want ? ` под «${want}»` : ''} с такими годами и рейтингом. Снизь рейтинг, расширь годы или выбери «Любые».` };
}
async function settle(v) {
  if (reduce.matches) return;
  const T = Math.ceil((pos + v * 0.3) / P), p0 = pos, dist = T * P - p0;
  await new Promise((done) => { const s = performance.now(); const st = (n) => { const u = Math.min(1, (n - s) / 600); pos = p0 + dist * (1 - Math.pow(1 - u, 3)); paint(); u < 1 ? requestAnimationFrame(st) : done(); }; requestAnimationFrame(st); });
}
function finish() {
  spinning = false;
  const btn = $('#spin'); btn.disabled = false; btn.firstChild.textContent = 'Ещё раз';
}
$('#spin').addEventListener('click', spin);
addEventListener('keydown', (e) => {
  if (e.code !== 'Space' || e.repeat) return;
  if (e.target.closest('a,button,input,textarea,select,[contenteditable]')) return;
  e.preventDefault(); spin();
});

// ---------- результат ----------
const ico = {
  play: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" fill="currentColor"/></svg>',
  eye: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1 8s2.6-5 7-5 7 5 7 5-2.6 5-7 5-7-5-7-5z" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="8" cy="8" r="2.2" fill="currentColor"/></svg>',
  redo: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13 8a5 5 0 1 1-1.5-3.6M13 2v3h-3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
const KIND_RU = { movie: 'Фильм', tvMovie: 'Телефильм', tvSeries: 'Сериал', tvMiniSeries: 'Мини-сериал' };
const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 12 || h > 14) ? b : c; };
const runtime = (s) => { if (!s) return ''; const m = Math.round(s / 60), h = Math.floor(m / 60); return h ? `${h}\u00a0ч ${m % 60}\u00a0мин` : `${m}\u00a0мин`; };
let token = 0;

function showResult(t, chipId, gId) {
  const my = ++token;
  render(t, chipId, false, gId);
  details(t).then((d) => { if (my === token) { render(d, chipId, true, gId); patchHistory(d); } }).catch(() => {});
}
let curT = null;
function render(t, chipId, full, gId) {
  const el = $('#result');
  curT = t;
  if (full) findTrailer(t, prefs.tlang || 'ru').catch(() => {});
  const title = t.ru || t.t;
  const orig = [t.ru && t.ru !== t.t ? t.t : null, t.o && t.o !== (t.ru || t.t) ? t.o : null].filter(Boolean)[0];
  const isSeries = /tvSeries|tvMiniSeries/.test(t.k);
  const years = isSeries && t.y ? `${t.y}${t.e && t.e !== t.y ? '–' + t.e : ''}` : t.y || '';
  const facts = [];
  if (t.r) facts.push(`<li><span class="star">★</span> <b>${t.r.toFixed(1)}</b>${t.v ? ` <span>(${t.v.toLocaleString('ru-RU')})</span>` : ''}</li>`);
  if (isSeries && t.seasons) facts.push(`<li>${t.seasons}\u00a0${plural(t.seasons, 'сезон', 'сезона', 'сезонов')}</li>`);
  else if (t.s) facts.push(`<li>${runtime(t.s)}</li>`);
  if (t.g?.length) facts.push(`<li>${t.g.map((g) => GENRE_RU[g] || g).join(', ')}</li>`);
  if (t.directors?.length) facts.push(`<li>Режиссёр: ${esc(t.directors.slice(0, 2).join(', '))}</li>`);
  const desc = t.wiki ? `<p class="desc">${esc(trim(t.wiki))}</p><p class="src">Из <a href="${esc(t.wikiUrl)}" target="_blank" rel="noopener">Википедии</a></p>`
    : t.p ? `<p class="desc en" lang="en">${esc(t.p)}</p><p class="src">Описание IMDb, на английском</p>` : full ? '' : '<p class="src">Загружаю описание…</p>';
  const chip = byId[chipId], gch = gId && gId !== chipId ? byId[gId] : null;
  const tag = [gch?.label, chip?.label].filter(Boolean).join(' + ');
  el.innerHTML = `
    <div class="poster">${t.i ? `<img src="${poster(t.i, 600)}" alt="Постер: ${esc(title)}">` : ''}</div>
    <div class="info">
      <p class="kicker">${KIND_RU[t.k] || 'Тайтл'}${years ? `, ${years}` : ''}${tag ? `. ${esc(tag)}` : ''}</p>
      <h2>${esc(title)}</h2>
      ${orig ? `<p class="orig" lang="en">${esc(orig)}</p>` : '<p class="orig"></p>'}
      <ul class="facts">${facts.join('')}</ul>
      ${desc}
      <div class="actions">
        <button class="btn primary" type="button" data-act="again">${ico.redo}Ещё раз</button>
        <button class="btn" type="button" data-act="trailer">${ico.play}Трейлер</button>
        <button class="btn" type="button" data-act="where" aria-expanded="false" aria-controls="where">${ico.eye}Где посмотреть</button>
        <div class="where" id="where" hidden>${whereLinks(t, title)}</div>
      </div>
    </div>`;
  if (!full) { el.hidden = false; el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter'); }
}
function trim(s) { const parts = s.split(/(?<=[.!?])\s+/); let out = ''; for (const p of parts) { if ((out + p).length > 420 && out) break; out += (out ? ' ' : '') + p; } return out; }
function whereLinks(t, title) {
  const q = encodeURIComponent(title), qy = encodeURIComponent(`${title} ${t.y || ''}`.trim()), qo = encodeURIComponent(t.t);
  const L = [
    ['Кинопоиск', `https://www.kinopoisk.ru/index.php?kp_query=${qy}`, 'поиск'],
    ['Okko', `https://okko.tv/search/${q}`, 'поиск'],
    ['Иви', `https://www.ivi.ru/search/?q=${q}`, 'поиск'],
    ['JustWatch', `https://www.justwatch.com/ru/%D0%BF%D0%BE%D0%B8%D1%81%D0%BA?q=${qo}`, 'где идёт'],
    ['IMDb', `https://www.imdb.com/title/${t.id}/`, 'страница'],
  ];
  return L.map(([n, u, s]) => `<a href="${u}" target="_blank" rel="noopener">${n} <small>${s}</small></a>`).join('');
}
$('#result').addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  if (b.dataset.act === 'trailer') openTrailer(curT, b);
  if (b.dataset.act === 'again') { $('#where')?.setAttribute('hidden', ''); spin(); }
  if (b.dataset.act === 'where') {
    const w = $('#where'), open = w.hidden; w.hidden = !open; b.setAttribute('aria-expanded', open);
    if (open) w.querySelector('a')?.focus();
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
  if (!tm.open) { tm.showModal(); document.documentElement.classList.add('tm-on'); window.dispatchEvent(new CustomEvent('kr:trailer', { detail: true })); }
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
  tm.close(); document.documentElement.classList.remove('tm-on');
  window.dispatchEvent(new CustomEvent('kr:trailer', { detail: false }));
  tBack?.focus();
}
tm.addEventListener('click', (e) => { if (e.target === tm || e.target.closest('[data-close]')) closeTrailer(); });
tm.addEventListener('cancel', (e) => { e.preventDefault(); closeTrailer(); });
tm.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => { if ((prefs.tlang || 'ru') === b.dataset.lang && $('#tmFrame').dataset.vid) return; prefs.tlang = b.dataset.lang; savePrefs(); openTrailer(curT, tBack); }));

// ---------- история ----------
function remember(t, chip, g) {
  seen.add(t.id); save(LS.seen, [...seen].slice(-600));
  hist = [{ id: t.id, t: t.t, k: t.k, y: t.y, e: t.e, r: t.r, v: t.v, g: t.g, i: t.i, s: t.s, chip, gc: g, ts: Date.now() }, ...hist.filter((h) => h.id !== t.id)].slice(0, 30);
  save(LS.hist, hist); drawHistory();
}
function patchHistory(d) { const h = hist.find((x) => x.id === d.id); if (h && d.ru) { h.ru = d.ru; save(LS.hist, hist); drawHistory(); } }
function drawHistory() {
  $('#histCount').textContent = hist.length ? hist.length : '';
  $('#history').hidden = !hist.length;
  $('#hrow').innerHTML = hist.map((h) => `<button class="hitem" type="button" data-id="${h.id}"><img loading="lazy" alt="" src="${poster(h.i, 200)}"><span>${esc(h.ru || h.t)}${h.y ? `, ${h.y}` : ''}</span></button>`).join('');
}
$('#hrow').addEventListener('click', (e) => {
  const b = e.target.closest('.hitem'); if (!b) return;
  const h = hist.find((x) => x.id === b.dataset.id); if (!h) return;
  applyFx(h.gc, h.chip && !isGenre.has(h.chip) ? h.chip : null);
  showResult(h, h.chip, h.gc);
  $('#result').scrollIntoView({ behavior: reduce.matches ? 'auto' : 'smooth', block: 'start' });
});
$('#histClear').addEventListener('click', () => { hist = []; seen = new Set(); save(LS.hist, hist); save(LS.seen, []); drawHistory(); });
$('#histBtn').addEventListener('click', () => { if (!hist.length) { $('#status').textContent = 'История пока пустая.'; return; } $('#history').scrollIntoView({ behavior: reduce.matches ? 'auto' : 'smooth', block: 'start' }); });
drawHistory();

// для тестов
window.__kr = {
  spin, setFx, burst, choose, gl: () => glInfo(),
  // sel: ['horror', 'comedy'], sub: {horror: 'slasher'}
  set(sel, mode = 'all', extra = {}) {
    prefs.sel = sel; prefs.sub = extra.sub || {}; prefs.multi = sel.length > 1; prefs.mode = mode; Object.assign(prefs, extra);
    yFrom.value = prefs.from || ''; yTo.value = prefs.to || ''; rating.value = prefs.rating ?? 6.5; showRating();
    syncChips();
    document.querySelectorAll('.seg button').forEach((x) => x.setAttribute('aria-checked', x.dataset.mode === mode));
    savePrefs(); note(); applyFx();
  },
  prefs, details, trailer: (t, l) => findTrailer(t, l),
  async pick() { const r = await choose(); if (r.win) { seen.add(r.win.t.id); } return r.error ? { error: r.error } : { t: r.win.t, g: r.win.g, s: r.win.s, offline: !!r.offline }; },
  filters,
};
