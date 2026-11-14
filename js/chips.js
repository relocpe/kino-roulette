// Каждый чип: как его искать в API и какой эффект у него на фоне.
// q: параметры /titles (массивы = несколько значений). alt: варианты, из которых берётся случайный (ИЛИ).
// list: курируемый список IMDb id, если в API нет такого фильтра.
export const GENRES = [
  { id: 'horror', label: 'Ужасы', q: { genres: 'Horror' }, fx: 'horror', accent: '#c23b2a' },
  { id: 'thriller', label: 'Триллер', q: { genres: 'Thriller' }, fx: 'thriller', accent: '#e0402e' },
  { id: 'scifi', label: 'Фантастика', q: { genres: 'Sci-Fi' }, fx: 'scifi', accent: '#6ea8ff' },
  { id: 'fantasy', label: 'Фэнтези', q: { genres: 'Fantasy' }, fx: 'fantasy', accent: '#b18cff' },
  { id: 'action', label: 'Боевик', q: { genres: 'Action' }, fx: 'action', accent: '#ff8a2a' },
  { id: 'comedy', label: 'Комедия', q: { genres: 'Comedy' }, fx: 'comedy', accent: '#ffd23f' },
  { id: 'drama', label: 'Драма', q: { genres: 'Drama' }, fx: 'drama', accent: '#8fb3c9' },
  { id: 'romance', label: 'Мелодрама', q: { genres: 'Romance' }, fx: 'romance', accent: '#ff7aa2' },
  { id: 'crime', label: 'Криминал', q: { genres: 'Crime' }, fx: 'crime', accent: '#e8e2d4' },
  { id: 'mystery', label: 'Мистика и загадки', q: { genres: 'Mystery' }, fx: 'mystery', accent: '#c9d6e8' },
  { id: 'animation', label: 'Мультфильмы', q: { genres: 'Animation' }, fx: 'animation', accent: '#ff6ad5' },
  { id: 'family', label: 'Семейное', q: { genres: 'Family' }, fx: 'family', accent: '#7fd3ff' },
  { id: 'documentary', label: 'Документальное', q: { genres: 'Documentary' }, fx: 'documentary', accent: '#e8c690' },
  { id: 'western', label: 'Вестерн', q: { genres: 'Western' }, fx: 'western', accent: '#d9944a' },
  { id: 'war', label: 'Военное', q: { genres: 'War' }, fx: 'war', accent: '#e0703a' },
  { id: 'music', label: 'Музыка', q: { genres: ['Music', 'Musical'] }, alt: [{ genres: 'Music' }, { genres: 'Musical' }], fx: 'music', accent: '#ff4fb0' },
];

// need: хотя бы один из жанров IMDb; anyI: хотя бы один из интересов IMDb (проверяется по карточке тайтла);
// noI: исключающие интересы; kinds: допустимые типы; series: только сериалы.
export const MOODS = [
  { id: 'psycho', label: 'Психологический триллер', alt: [{ interestIds: ['in0000182', 'in0000086'] }, { interestIds: 'in0000182', genres: 'Mystery' }, { interestIds: 'in0000114' }],
    need: ['Thriller', 'Horror', 'Mystery'], anyI: ['in0000182', 'in0000114'], noI: ['in0000057', 'in0000051', 'in0000053', 'in0000058', 'in0000072', 'in0000008', 'in0000033', 'in0000055', 'in0000085', 'in0000056', 'in0000007'], noG: ['Comedy', 'Animation', 'Family', 'Biography', 'Documentary', 'Action', 'Adventure', 'War', 'Western', 'Romance'], fx: 'psycho', accent: '#d65a7a' },
  { id: 'detective', label: 'Детектив', alt: [{ interestIds: 'in0000141' }, { interestIds: 'in0000138' }, { interestIds: 'in0000137' }, { interestIds: 'in0000057', genres: 'Mystery' }],
    need: ['Mystery', 'Crime'], anyI: ['in0000141', 'in0000138', 'in0000137', 'in0000057'], fx: 'detective', accent: '#d8b27a' },
  { id: 'noir', label: 'Нуар', alt: [{ interestIds: 'in0000054' }, { interestIds: 'in0000138' }],
    need: ['Crime', 'Mystery', 'Thriller', 'Drama', 'Film-Noir'], anyI: ['in0000054', 'in0000138'], noG: ['Comedy', 'Animation', 'Family'], fx: 'noir', accent: '#f2f2f2' },
  { id: 'slasher', label: 'Слэшер', q: { interestIds: 'in0000115' }, need: ['Horror'], anyI: ['in0000115'], noI: ['in0000039', 'in0000038'], fx: 'slasher', accent: '#e3262f' },
  { id: 'cyberpunk', label: 'Киберпанк', q: { interestIds: 'in0000159' }, need: ['Sci-Fi'], anyI: ['in0000159'], fx: 'cyberpunk', accent: '#ff3df2' },
  { id: 'postapoc', label: 'Постапокалипсис', list: 'postapoc', fx: 'postapoc', accent: '#e38b3a' },
  { id: 'dystopia', label: 'Антиутопия', q: { interestIds: 'in0000160' }, need: ['Sci-Fi', 'Drama', 'Thriller', 'Action'], anyI: ['in0000160'], fx: 'dystopia', accent: '#ff5a4a' },
  { id: 'truecrime', label: 'Тру-крайм', alt: [{ interestIds: 'in0000058' }, { interestIds: 'in0000059' }],
    need: ['Crime', 'Documentary', 'Biography'], anyI: ['in0000058', 'in0000059'], fx: 'truecrime', accent: '#ffcf3a' },
  { id: 'anime', label: 'Аниме', q: { interestIds: 'in0000027' }, need: ['Animation'], anyI: ['in0000027'], fx: 'anime', accent: '#ff8fb8' },
  { id: 'kdrama', label: 'Дорамы', alt: [{ interestIds: 'in0000209' }, { countryCodes: 'KR', genres: 'Drama' }, { countryCodes: 'KR', genres: 'Romance' }],
    anyI: ['in0000209'], orCountry: 'KR', noG: ['Animation', 'Documentary', 'Reality-TV'], fx: 'kdrama', accent: '#ffb3c7' },
  { id: 'sitcom', label: 'Ситком', q: { interestIds: 'in0000044' }, need: ['Comedy'], anyI: ['in0000044'], series: true, fx: 'sitcom', accent: '#ffb547' },
  { id: 'mini', label: 'Мини-сериал', q: { types: 'TV_MINI_SERIES' }, kinds: ['tvMiniSeries'], series: true, fx: 'mini', accent: '#c7b8ff' },
  { id: 'cult', label: 'Культовая классика', q: { minVoteCount: 250000, endYear: 2005 }, minV: 250000, maxY: 2005, fx: 'cult', accent: '#ff6a3d' },
  { id: 'twist', label: 'С неожиданной развязкой', list: 'twist', fx: 'twist', accent: '#7af0e0' },
];

export const LISTS = {
  twist: 'tt0167404 tt0137523 tt0114814 tt1130884 tt0482571 tt0209144 tt2267998 tt0364569 tt0230600 tt0114369 tt0117381 tt0309698 tt0387564 tt0063442 tt0119174 tt2543164 tt6751668 tt5052448 tt4857264 tt2397535 tt2866360 tt0361862 tt0166924 tt0488120 tt1670345 tt1148204 tt1255953 tt1305806 tt0051201 tt0046911 tt0054215 tt0071315 tt0368447 tt0217869 tt4972582 tt7668870 tt8946378 tt1392214 tt2316411 tt1187064 tt5753856 tt4158110 tt0475784 tt2356777 tt11280740 tt2649356 tt6048596 tt2085059'.split(' '),
  postapoc: 'tt1392190 tt0898367 tt0480249 tt0289043 tt6644200 tt1037705 tt1706620 tt0114898 tt0082694 tt0114746 tt0910970 tt1156398 tt2737304 tt3581920 tt12637874 tt1520211 tt10574236 tt2661044 tt14688458 tt2222042 tt1483013 tt0119925 tt2103281 tt12037194 tt0472033 tt0805663 tt12809988 tt6156584 tt1571234 tt0079501'.split(' '),
};

export const ALL = [...GENRES, ...MOODS];
export const isGenre = new Set(GENRES.map((c) => c.id));
export const byId = Object.fromEntries(ALL.map((c) => [c.id, c]));

export const GENRE_RU = {
  Action: 'боевик', Adult: 'для взрослых', Adventure: 'приключения', Animation: 'мультфильм', Biography: 'биография',
  Comedy: 'комедия', Crime: 'криминал', Documentary: 'документальный', Drama: 'драма', Family: 'семейный',
  Fantasy: 'фэнтези', 'Film-Noir': 'нуар', 'Game-Show': 'игровое шоу', History: 'история', Horror: 'ужасы',
  Music: 'музыка', Musical: 'мюзикл', Mystery: 'детектив', News: 'новости', 'Reality-TV': 'реалити',
  Romance: 'мелодрама', 'Sci-Fi': 'фантастика', Short: 'короткометражка', Sport: 'спорт', 'Talk-Show': 'ток-шоу',
  Thriller: 'триллер', War: 'военный', Western: 'вестерн',
};
