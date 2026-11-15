// Каждый чип: как его искать в API и какой эффект у него на фоне.
// q: параметры /titles (массивы = несколько значений). alt: варианты, из которых берётся случайный (ИЛИ).
// list: курируемый список IMDb id, если в API нет такого фильтра.
export const GENRES = [
  { id: 'horror', label: 'Ужасы', q: { genres: 'Horror' }, al: { g: ['Horror'] }, fx: 'horror', accent: '#c23b2a' },
  { id: 'thriller', label: 'Триллер', q: { genres: 'Thriller' }, al: { g: ['Thriller'] }, fx: 'thriller', accent: '#e0402e' },
  { id: 'scifi', label: 'Фантастика', q: { genres: 'Sci-Fi' }, al: { g: ['Sci-Fi'] }, fx: 'scifi', accent: '#6ea8ff' },
  { id: 'fantasy', label: 'Фэнтези', q: { genres: 'Fantasy' }, al: { g: ['Fantasy'] }, fx: 'fantasy', accent: '#b18cff' },
  { id: 'action', label: 'Боевик', q: { genres: 'Action' }, al: { g: ['Action'] }, fx: 'action', accent: '#ff8a2a' },
  { id: 'adventure', label: 'Приключения', q: { genres: 'Adventure' }, al: { g: ['Adventure'] }, fx: 'adventure', accent: '#e8b04a' },
  { id: 'comedy', label: 'Комедия', q: { genres: 'Comedy' }, al: { g: ['Comedy'] }, fx: 'comedy', accent: '#ffd23f' },
  { id: 'drama', label: 'Драма', q: { genres: 'Drama' }, al: { g: ['Drama'] }, fx: 'drama', accent: '#8fb3c9' },
  { id: 'romance', label: 'Мелодрама', q: { genres: 'Romance' }, al: { g: ['Romance'] }, fx: 'romance', accent: '#ff7aa2' },
  { id: 'crime', label: 'Криминал', q: { genres: 'Crime' }, al: { tag: ['Crime'] }, fx: 'crime', accent: '#e8e2d4' },
  { id: 'mystery', label: 'Мистика и загадки', q: { genres: 'Mystery' }, al: { g: ['Mystery', 'Supernatural'] }, fx: 'mystery', accent: '#c9d6e8' },
  { id: 'animation', label: 'Мультфильмы', q: { genres: 'Animation' }, fx: 'animation', accent: '#ff6ad5' },
  { id: 'family', label: 'Семейное', q: { genres: 'Family' }, al: { tag: ['Kids'] }, fx: 'family', accent: '#7fd3ff' },
  { id: 'documentary', label: 'Документальное', q: { genres: 'Documentary' }, fx: 'documentary', accent: '#e8c690' },
  { id: 'western', label: 'Вестерн', q: { genres: 'Western' }, fx: 'western', accent: '#d9944a' },
  { id: 'war', label: 'Военное', q: { genres: 'War' }, al: { tag: ['War'] }, fx: 'war', accent: '#e0703a' },
  { id: 'music', label: 'Музыка', q: { genres: ['Music', 'Musical'] }, alt: [{ genres: 'Music' }, { genres: 'Musical' }], al: { g: ['Music'] }, fx: 'music', accent: '#ff4fb0' },
  // только в режиме «Аниме» (AniList)
  { id: 'shonen', label: 'Сёнен', al: { tag: ['Shounen'] }, animeOnly: true, fx: 'anime', accent: '#ff9f43' },
  { id: 'seinen', label: 'Сэйнэн', al: { tag: ['Seinen'] }, animeOnly: true, fx: 'noir', accent: '#e8e2d4' },
  { id: 'isekai', label: 'Исекай', al: { tag: ['Isekai'] }, animeOnly: true, fx: 'fantasy', accent: '#b18cff' },
  { id: 'mecha', label: 'Меха', al: { g: ['Mecha'] }, animeOnly: true, fx: 'cyberpunk', accent: '#6ea8ff' },
  { id: 'slice', label: 'Повседневность', al: { g: ['Slice of Life'] }, animeOnly: true, fx: 'family', accent: '#7fd3ff' },
  { id: 'sports', label: 'Спорт', al: { g: ['Sports'] }, animeOnly: true, fx: 'action', accent: '#ff8a2a' },
];
// источник «Аниме» (режим «Что → Аниме»): AniList; в списке жанров его нет
export const ANIME = { id: 'anime', label: 'Аниме', src: 'anilist', fx: 'anime', accent: '#ff8fb8' };
// жанр доступен в режиме: в «Аниме» — только жанры с соответствием на AniList, в остальных — без аниме-only
export const genreOk = (g, mode) => !!g && (mode === 'anime' ? !!g.al : !g.animeOnly);
// аниме-уточнения прежних версий → жанр режима «Аниме»
export const A_SUB2G = { a_shonen: 'shonen', a_seinen: 'seinen', a_isekai: 'isekai', a_mecha: 'mecha', a_slice: 'slice', a_horror: 'horror', a_romance: 'romance' };

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
  { id: 'kdrama', label: 'Дорамы', alt: [{ interestIds: 'in0000209' }, { countryCodes: 'KR', genres: 'Drama' }, { countryCodes: 'KR', genres: 'Romance' }],
    anyI: ['in0000209'], orCountry: 'KR', noG: ['Animation', 'Documentary', 'Reality-TV'], fx: 'kdrama', accent: '#ffb3c7' },
  { id: 'sitcom', label: 'Ситком', q: { interestIds: 'in0000044' }, need: ['Comedy'], anyI: ['in0000044'], series: true, fx: 'sitcom', accent: '#ffb547' },
  { id: 'mini', label: 'Мини-сериал', q: { types: 'TV_MINI_SERIES' }, kinds: ['tvMiniSeries'], series: true, fx: 'mini', accent: '#c7b8ff' },
  { id: 'cult', label: 'Культовая классика', q: { minVoteCount: 250000, endYear: 2005 }, minV: 250000, maxY: 2005, fx: 'cult', accent: '#ff6a3d' },
  // аниме-уточнения (AniList): al.g — жанры, al.tag — теги (rank ≥ 60), al.fmt — форматы
  { id: 'a_shonen', label: 'Сёнен', al: { tag: ['Shounen'] }, fx: 'anime', accent: '#ff9f43' },
  { id: 'a_seinen', label: 'Сейнен', al: { tag: ['Seinen'] }, fx: 'noir', accent: '#e8e2d4' },
  { id: 'a_isekai', label: 'Исекай', al: { tag: ['Isekai'] }, fx: 'fantasy', accent: '#b18cff' },
  { id: 'a_mecha', label: 'Меха', al: { g: ['Mecha'] }, fx: 'cyberpunk', accent: '#6ea8ff' },
  { id: 'a_slice', label: 'Повседневность', al: { g: ['Slice of Life'] }, fx: 'family', accent: '#7fd3ff' },
  { id: 'a_horror', label: 'Ужасы', al: { g: ['Horror'] }, fx: 'horror', accent: '#c23b2a' },
  { id: 'a_romance', label: 'Романтика', al: { g: ['Romance'] }, fx: 'romance', accent: '#ff7aa2' },
  { id: 'a_movie', label: 'Фильмы', al: { fmt: ['MOVIE'] }, movie: true, fx: 'cult', accent: '#ff6a3d' },
  { id: 'twist', label: 'С неожиданной развязкой', list: 'twist', fx: 'twist', accent: '#7af0e0' },
];

export const LISTS = {
  twist: 'tt0167404 tt0137523 tt0114814 tt1130884 tt0482571 tt0209144 tt2267998 tt0364569 tt0230600 tt0114369 tt0117381 tt0309698 tt0387564 tt0063442 tt0119174 tt2543164 tt6751668 tt5052448 tt4857264 tt2397535 tt2866360 tt0361862 tt0166924 tt0488120 tt1670345 tt1148204 tt1255953 tt1305806 tt0051201 tt0046911 tt0054215 tt0071315 tt0368447 tt0217869 tt4972582 tt7668870 tt8946378 tt1392214 tt2316411 tt1187064 tt5753856 tt4158110 tt0475784 tt2356777 tt11280740 tt2649356 tt6048596 tt2085059 tt1937149 tt0070917 tt0052357 tt0070735 tt0093640 tt0104036 tt0092563 tt0099871 tt0118929 tt0397101 tt0363988 tt0452623 tt0470752 tt0884328 tt7282468 tt1614989 tt0247586 tt0120890 tt0945513 tt11564570 tt0440803 tt0365376 tt5215952 tt0425210 tt0443543 tt2053463 tt3631112 tt15791034 tt4178092 tt17351924 tt0390384 tt0480669 tt0407887 tt1375666 tt7784604 tt2400463 tt6857112 tt10954652 tt0286106 tt0120382 tt0119099 tt0264616 tt1216496 tt1772250 tt0069281 tt0083806 tt0134119 tt0416320 tt0144084 tt0246578 tt0259711 tt0125659 tt0947798 tt4846232 tt3704050 tt3748172 tt3289956 tt1179933 tt1259521 tt3811906 tt10638522 tt8134470 tt9698442 tt3920596 tt2521668 tt18347622 tt9319668'.split(' '),
  postapoc: 'tt1392190 tt0898367 tt0480249 tt0289043 tt6644200 tt1037705 tt1706620 tt0114898 tt0082694 tt0114746 tt0910970 tt1156398 tt2737304 tt3581920 tt12637874 tt1520211 tt10574236 tt2661044 tt14688458 tt2222042 tt1483013 tt0119925 tt2103281 tt12037194 tt0472033 tt0805663 tt12809988 tt6156584 tt1571234 tt0079501 tt0089530 tt0463854 tt10548174 tt0206634 tt8332922 tt13433802 tt3743822 tt2070791 tt1462059 tt6656238 tt1560220 tt0816711 tt0363547 tt0088993 tt0087799 tt0063442 tt0065462 tt3450958 tt11389872 tt3148266 tt0438488 tt1815862 tt5246700 tt1535616 tt6063090 tt4695012 tt2580382 tt1598642 tt0253556 tt0483607 tt0114614 tt0072730 tt0085404 tt0090163 tt0053137 tt0086429 tt0089869 tt0085426 tt0101700 tt3672742 tt1790864 tt4046784 tt4500922 tt8850222 tt1160996 tt0806203 tt8755226 tt3843168 tt8923854 tt7949218 tt13062500 tt3230454 tt0058700 tt0067525 tt0094625 tt0087544 tt0142371 tt3860916 tt4547056 tt0993840 tt0069768 tt0074812 tt0133093 tt0103064 tt0088247 tt14400246 tt12747748 tt4334266 tt2345737 tt2625810 tt2558318 tt4814760 tt8179388 tt0432021 tt0075909 tt0118736 tt0094764 tt0099740 tt0092746 tt0185183 tt0234215'.split(' '),
};

export const ALL = [...GENRES, ...MOODS];
// какие уточнения показываются под каждым жанром (поджанр сужает только свой жанр)
export const SUBS = {
  horror: ['psycho', 'slasher', 'cult'],
  thriller: ['psycho', 'twist', 'detective'],
  scifi: ['cyberpunk', 'postapoc', 'dystopia'],
  action: ['cyberpunk', 'postapoc', 'cult'],
  adventure: ['postapoc'],
  comedy: ['sitcom', 'cult'],
  drama: ['kdrama', 'mini'],
  romance: ['kdrama'],
  crime: ['detective', 'noir', 'truecrime'],
  mystery: ['detective', 'twist', 'noir'],
  documentary: ['truecrime'],
  western: ['cult'],
  war: ['mini'],
};
export const isGenre = new Set(GENRES.map((c) => c.id));
export const byId = Object.fromEntries([...ALL, ANIME].map((c) => [c.id, c]));

export const GENRE_RU = {
  Action: 'боевик', Adult: 'для взрослых', Adventure: 'приключения', Animation: 'мультфильм', Biography: 'биография',
  Comedy: 'комедия', Crime: 'криминал', Documentary: 'документальный', Drama: 'драма', Family: 'семейный',
  Fantasy: 'фэнтези', 'Film-Noir': 'нуар', 'Game-Show': 'игровое шоу', History: 'история', Horror: 'ужасы',
  Music: 'музыка', Musical: 'мюзикл', Mystery: 'детектив', News: 'новости', 'Reality-TV': 'реалити',
  Romance: 'мелодрама', 'Sci-Fi': 'фантастика', Short: 'короткометражка', Sport: 'спорт', 'Talk-Show': 'ток-шоу',
  Thriller: 'триллер', War: 'военный', Western: 'вестерн',
  'Slice of Life': 'повседневность', Mecha: 'меха', Supernatural: 'сверхъестественное', Sports: 'спорт', Psychological: 'психологическое', Ecchi: 'этти', 'Mahou Shoujo': 'махо-сёдзё', Hentai: '18+',
};
