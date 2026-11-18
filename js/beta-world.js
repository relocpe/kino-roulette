// Отдельная страница беты. Не скин основного сайта.
import { browseSnap, poster, tileMetaLine } from './api.js?v=22';
import { GENRES } from './chips.js?v=10';
import { buildShelves, MIN_SHELF } from './curated.js?v=1';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const GENRE_FX = { horror: 'ghost', action: 'flash', thriller: 'flash', romance: 'warm', scifi: 'scan', fantasy: 'dust', comedy: 'bounce' };

const face = GENRES.filter((g) => !g.animeOnly).slice(0, 12);

async function ring() {
  const { list } = await browseSnap({ mode: 'all', sort: 'pop', votes: 20000 }, 0, 24);
  return list.filter((t) => t.i).sort(() => Math.random() - 0.5).slice(0, 8);
}

function card(t, i, n) {
  const a = (360 / n) * i;
  const src = poster(t.i, 300);
  return `<a class="bw-card" style="--a:${a}deg" href="title/${esc(t.id)}" data-nav><img src="${esc(src)}" alt=""></a>`;
}

export function mountBetaWorld(host) {
  let alive = true;
  let mode = 'orbit';
  let genre = null;
  let busy = false;
  host.innerHTML = `<div class="bw-fx" data-g="" aria-hidden="true"></div>
    <header class="bw-bar">
      <p class="bw-logo">Орбита</p>
      <div class="bw-modes" role="tablist">
        <button type="button" data-mode="orbit" role="tab" aria-selected="true">Круг</button>
        <button type="button" data-mode="shelves" role="tab" aria-selected="false">Полки</button>
      </div>
      <a class="bw-leave" href="" data-nav>Обычный сайт</a>
    </header>
    <section class="bw-orbit-view">
      <div class="bw-orbit" aria-hidden="true"></div>
      <button class="bw-go" type="button">Крутить</button>
      <p class="bw-note">Выбери жанр — круг ответит вспышкой, призраком или сканом. Потом крути.</p>
      <div class="bw-genres" role="list"></div>
    </section>
    <section class="bw-shelves" hidden></section>
    <section class="bw-result" hidden></section>`;

  const fx = host.querySelector('.bw-fx');
  const orbit = host.querySelector('.bw-orbit');
  const go = host.querySelector('.bw-go');
  const genres = host.querySelector('.bw-genres');
  const shelves = host.querySelector('.bw-shelves');
  const result = host.querySelector('.bw-result');
  const orbitView = host.querySelector('.bw-orbit-view');

  genres.innerHTML = face.map((g) => `<button type="button" class="bw-g" data-id="${g.id}" style="--gc:${g.accent}">${esc(g.label)}</button>`).join('');

  const burst = (id) => {
    if (reduce()) return;
    const kind = GENRE_FX[id] || 'edge';
    fx.dataset.g = '';
    void fx.offsetWidth;
    fx.dataset.g = kind;
    clearTimeout(burst.t);
    burst.t = setTimeout(() => { if (alive) fx.dataset.g = ''; }, kind === 'flash' ? 420 : 900);
  };

  const showOrbit = async () => {
    orbit.innerHTML = `<div class="bw-wait">Собираю круг…</div>`;
    const list = await ring().catch(() => []);
    if (!alive) return;
    orbit.innerHTML = list.map((t, i) => card(t, i, Math.max(list.length, 1))).join('') || `<div class="bw-wait">Постеры не загрузились</div>`;
  };

  const showShelves = async () => {
    if (shelves.dataset.ready === '1') return;
    shelves.innerHTML = `<p class="bw-wait">Собираю полки…</p>`;
    const packs = await Promise.all(face.slice(0, 6).map(async (g) => {
      const names = [].concat(g.q?.genres || []);
      const { list } = await browseSnap({ mode: 'all', genreGroups: names.length ? [names] : [], sort: 'rating', votes: 8000 }, 0, 14);
      return { title: g.label, accent: g.accent, list };
    })).catch(() => []);
    let curated = [];
    try {
      const raw = await fetch('data/curated.json?v=1').then((r) => r.json());
      curated = buildShelves(raw.titles || []).filter((s) => s.items.length >= MIN_SHELF).slice(0, 4);
    } catch { /* полки жанров всё равно есть */ }
    if (!alive) return;
    const blocks = [
      ...curated.map((s) => ({ title: s.title, list: s.items.slice(0, 14), accent: '#fff' })),
      ...packs.filter((p) => p.list?.length),
    ];
    shelves.innerHTML = blocks.map((b) => `<section class="bw-row" style="--gc:${b.accent}"><h2>${esc(b.title)}</h2><div class="bw-strip">${b.list.map((t) => {
      const src = t.i ? poster(t.i, 300) : '';
      const name = t.ru || t.t || '';
      return `<a href="title/${esc(t.id)}" data-nav><img src="${esc(src)}" alt=""><b>${esc(name)}</b><small>${esc(tileMetaLine(t))}</small></a>`;
    }).join('')}</div></section>`).join('') || `<p class="bw-wait">Полки не загрузились</p>`;
    shelves.dataset.ready = '1';
  };

  const setMode = (next) => {
    mode = next;
    host.querySelectorAll('.bw-modes button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === next)));
    orbitView.hidden = next !== 'orbit';
    shelves.hidden = next !== 'shelves';
    result.hidden = true;
    host.classList.remove('is-spin');
    if (next === 'shelves') showShelves();
  };

  const reveal = (t) => {
    const src = poster(t.i, 600);
    const name = t.ru || t.t || 'Без названия';
    result.innerHTML = `<div class="bw-shot" style="background-image:url('${esc(src)}')"></div>
      <div class="bw-copy">
        <p class="bw-kicker">${esc(genre ? face.find((g) => g.id === genre)?.label || '' : 'Случайный выбор')}</p>
        <h1>${esc(name)}</h1>
        <p class="bw-meta">${esc(tileMetaLine(t))}</p>
        <div class="bw-acts">
          <button type="button" data-x="again">Ещё раз</button>
          <a href="title/${esc(t.id)}" data-nav>Карточка</a>
        </div>
      </div>`;
    result.hidden = false;
    orbitView.hidden = true;
  };

  host.addEventListener('click', async (e) => {
    const tab = e.target.closest('[data-mode]');
    if (tab) { setMode(tab.dataset.mode); return; }
    const g = e.target.closest('.bw-g');
    if (g) {
      genre = genre === g.dataset.id ? null : g.dataset.id;
      genres.querySelectorAll('.bw-g').forEach((b) => b.classList.toggle('on', b.dataset.id === genre));
      host.style.setProperty('--glow', g.style.getPropertyValue('--gc'));
      if (genre) burst(genre);
      return;
    }
    if (e.target.closest('[data-x="again"]')) { result.hidden = true; orbitView.hidden = mode !== 'orbit'; return; }
    if (e.target !== go && !go.contains(e.target)) return;
    if (busy) return;
    busy = true;
    go.disabled = true;
    host.classList.add('is-spin');
    if (genre) burst(genre);
    const names = genre ? [].concat(face.find((x) => x.id === genre)?.q?.genres || []) : [];
    const wait = new Promise((r) => setTimeout(r, reduce() ? 80 : 1400));
    const picked = browseSnap({ mode: 'all', genreGroups: names.length ? [names] : [], sort: 'pop', votes: 5000 }, 0, 40)
      .then(({ list }) => list.filter((t) => t.i).sort(() => Math.random() - 0.5)[0])
      .catch(() => null);
    const [t] = await Promise.all([picked, wait]);
    if (!alive) return;
    host.classList.remove('is-spin');
    go.disabled = false;
    busy = false;
    if (!t) { orbit.insertAdjacentHTML('beforeend', `<p class="bw-wait">Ничего не нашлось. Сними жанр.</p>`); return; }
    reveal(t);
  });

  showOrbit();
  return () => { alive = false; clearTimeout(burst.t); };
}
