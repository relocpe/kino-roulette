// Подборки каталога. Чистая логика: на вход карточки из data/curated.json, на выход полки.
// Карточки собираются из catalog.json, выдуманных id здесь нет.

export const SHELF_LIMIT = 24;
export const MIN_SHELF = 12;

const isAnime = (t) => String(t?.id || '').startsWith('al');
const isMovie = (t) => !isAnime(t) && (t?.k === 'movie' || t?.k === 'tvMovie');
const isSeries = (t) => !isAnime(t) && (t?.k === 'tvSeries' || t?.k === 'tvMiniSeries');
const minutes = (t) => (Number(t?.s) || 0) / 60;

/** Эвристика «в топе»: больше голосов и выше оценка — выше место. */
export function weekScore(t) {
  return (Number(t?.v) || 0) * (Number(t?.r) || 0);
}

const byVotes = (a, b) => (b.v || 0) - (a.v || 0) || (b.r || 0) - (a.r || 0) || String(a.id).localeCompare(String(b.id));
const byWeek = (a, b) => weekScore(b) - weekScore(a) || byVotes(a, b);

export const SHELF_SPECS = [
  {
    id: 'novinki-2026',
    title: 'Новинки 2026',
    text: 'Фильмы этого года, у которых уже есть оценки, а не только дата выхода.',
    limit: SHELF_LIMIT,
    match: (t) => isMovie(t) && t.y === 2026 && (t.r || 0) >= 6.4 && (t.v || 0) >= 40000,
    sort: byVotes,
  },
  {
    id: 'novinki-2025',
    title: 'Новинки 2025',
    text: 'Картины прошлого года, которые до сих пор смотрят и ставят в очередь.',
    limit: SHELF_LIMIT,
    match: (t) => isMovie(t) && t.y === 2025 && (t.r || 0) >= 6.5 && (t.v || 0) >= 40000,
    sort: byVotes,
  },
  {
    id: 'serialy',
    title: 'Сериалы — новые сезоны',
    text: 'Свежие сезоны больших сериалов и премьеры, которые ещё обсуждают.',
    limit: SHELF_LIMIT,
    match: (t) => {
      if (!isSeries(t) || (t.r || 0) < 7.5 || (t.v || 0) < 120000) return false;
      const y = t.y || 0;
      const e = t.e || 0;
      if (y >= 2024 && y <= 2026) return true;
      if (e >= 2024 && e <= 2026) return true;
      return !e && y >= 2022 && y <= 2026;
    },
    sort: byVotes,
  },
  {
    id: 'top',
    title: 'В топе недели',
    text: 'Релизы 2024–2026: выше те, у кого больше голосов и выше оценка.',
    limit: SHELF_LIMIT,
    match: (t) => !isAnime(t) && (isMovie(t) || isSeries(t)) && t.y >= 2024 && t.y <= 2026 && (t.r || 0) >= 6.5 && (t.v || 0) >= 80000,
    sort: byWeek,
  },
  {
    id: 'korotkiy',
    title: 'Короткий вечер',
    text: 'Фильмы короче ста минут, если завтра рано вставать.',
    limit: SHELF_LIMIT,
    match: (t) => isMovie(t) && t.y >= 2023 && t.y <= 2026 && minutes(t) > 0 && minutes(t) < 100 && (t.r || 0) >= 6.6 && (t.v || 0) >= 12000,
    sort: byVotes,
  },
  {
    id: 'dvoe',
    title: 'На двоих',
    text: 'Мелодрамы последних лет, которые нормально включить вдвоём.',
    limit: SHELF_LIMIT,
    match: (t) => {
      if (!isMovie(t) || t.y < 2019 || t.y > 2026 || (t.r || 0) < 6.8 || (t.v || 0) < 40000) return false;
      const g = t.g || [];
      if (!g.includes('Romance') || g.includes('Horror') || g.includes('War') || g.includes('Family') || g.includes('Animation')) return false;
      const romanceAt = g.indexOf('Romance');
      const actionAt = g.indexOf('Action');
      return actionAt < 0 || romanceAt < actionAt;
    },
    sort: byVotes,
  },
  {
    id: 'anime',
    title: 'Аниме сейчас',
    text: 'Сезоны и фильмы 2024–2026 с самой большой аудиторией на AniList.',
    limit: SHELF_LIMIT,
    match: (t) => isAnime(t) && t.y >= 2024 && t.y <= 2026 && (t.r || 0) >= 7.4 && (t.v || 0) >= 60000,
    sort: byVotes,
  },
];

export function shelfById(id) {
  return SHELF_SPECS.find((s) => s.id === id) || null;
}

/** Полки по порядку спек. В полке не больше limit карточек, без пустых постеров и повторов id. */
export function buildShelves(titles, specs = SHELF_SPECS) {
  const list = Array.isArray(titles) ? titles : [];
  return specs.map((spec) => {
    const seen = new Set();
    const items = [];
    for (const t of list) {
      if (!t?.id || !t.i || seen.has(t.id) || !spec.match(t)) continue;
      seen.add(t.id);
      items.push(t);
    }
    items.sort(spec.sort);
    return { id: spec.id, title: spec.title, text: spec.text, items: items.slice(0, spec.limit || SHELF_LIMIT) };
  });
}
