// Отдельная страница беты: один кадр и смена картинки, без колеса.
import { browseSnap, poster, tileMetaLine } from './api.js?v=22';
import { GENRES } from './chips.js?v=10';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const FX = { horror: 'ghost', action: 'flash', thriller: 'flash', romance: 'warm', scifi: 'scan', fantasy: 'dust', comedy: 'bounce' };
const face = GENRES.filter((g) => !g.animeOnly).slice(0, 10);

async function pool(genre) {
  const names = genre ? [].concat(face.find((g) => g.id === genre)?.q?.genres || []) : [];
  const { list } = await browseSnap({
    mode: 'all',
    genreGroups: names.length ? [names] : [],
    sort: 'pop',
    votes: genre ? 4000 : 15000,
  }, 0, 36);
  return list.filter((t) => t.i);
}

export function mountBetaWorld(host) {
  let alive = true;
  let genre = null;
  let busy = false;
  let current = null;
  host.innerHTML = `<div class="bw-fx" data-g="" aria-hidden="true"></div>
    <header class="bw-bar">
      <a class="bw-back" href="" data-nav>Кинорулетка</a>
      <span class="bw-tag">бета</span>
    </header>
    <div class="bw-stage">
      <div class="bw-frame"><img class="bw-still" alt=""></div>
      <div class="bw-side">
        <p class="bw-kicker"></p>
        <h1 class="bw-title">Что смотрим</h1>
        <p class="bw-meta">Один кадр. Жанр слева меняет свет, «Крутить» меняет фильм.</p>
        <button class="bw-go" type="button">Крутить</button>
        <div class="bw-genres"></div>
        <a class="bw-open" href="" data-nav hidden>Открыть карточку</a>
      </div>
    </div>`;

  const fx = host.querySelector('.bw-fx');
  const still = host.querySelector('.bw-still');
  const title = host.querySelector('.bw-title');
  const meta = host.querySelector('.bw-meta');
  const kicker = host.querySelector('.bw-kicker');
  const go = host.querySelector('.bw-go');
  const genres = host.querySelector('.bw-genres');
  const open = host.querySelector('.bw-open');
  genres.innerHTML = face.map((g) => `<button type="button" data-id="${g.id}" style="--gc:${g.accent}">${esc(g.label)}</button>`).join('');

  const paint = (t, quiet) => {
    current = t;
    still.src = poster(t.i, 800);
    still.alt = t.ru || t.t || '';
    title.textContent = t.ru || t.t || 'Без названия';
    meta.textContent = tileMetaLine(t);
    kicker.textContent = genre ? (face.find((g) => g.id === genre)?.label || '') : '';
    open.href = `title/${t.id}`;
    open.hidden = false;
    if (!quiet) host.classList.add('bw-land');
  };

  const burst = (id) => {
    if (reduce() || !id) return;
    const kind = FX[id] || 'edge';
    fx.dataset.g = '';
    void fx.offsetWidth;
    fx.dataset.g = kind;
    clearTimeout(burst.t);
    burst.t = setTimeout(() => { if (alive) fx.dataset.g = ''; }, kind === 'flash' ? 420 : 800);
  };

  pool(null).then((list) => { if (alive && list[0]) paint(list[0], true); }).catch(() => {});

  host.addEventListener('click', async (e) => {
    const g = e.target.closest('.bw-genres button');
    if (g) {
      genre = genre === g.dataset.id ? null : g.dataset.id;
      genres.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.id === genre));
      host.style.setProperty('--glow', genre ? g.style.getPropertyValue('--gc') : '#f4f1ea');
      burst(genre);
      const list = await pool(genre).catch(() => []);
      if (alive && list[0]) paint(list[0], true);
      return;
    }
    if (e.target !== go) return;
    if (busy) return;
    busy = true;
    go.disabled = true;
    host.classList.add('is-spin');
    host.classList.remove('bw-land');
    burst(genre);
    const frames = pool(genre).catch(() => []);
    const wait = new Promise((r) => setTimeout(r, reduce() ? 40 : 900));
    const [list] = await Promise.all([frames, wait]);
    if (!alive) return;
    const next = (list || []).filter((t) => t.id !== current?.id).sort(() => Math.random() - 0.5)[0] || list?.[0];
    host.classList.remove('is-spin');
    go.disabled = false;
    busy = false;
    if (next) paint(next);
    else meta.textContent = 'Под этот жанр ничего нет. Сними его.';
  });

  return () => { alive = false; clearTimeout(burst.t); };
}
