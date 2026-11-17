import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker, { resolveLordFilm } from './index.mjs';

function fixtureCard(id, title, year, cssRules) {
  const encode = (value, prefix) => [...value].map((character, index) => {
    const className = `${prefix}${index}`;
    cssRules.push(`.${className}::before{content:"${character}"}`);
    return `<i class="${className}"></i>`;
  }).join('');
  return `<li><div class="Poster"><a href="/${id}"><b>${encode(title, `t${id}x`)}<span>${encode(String(year), `y${id}x`)}</span></b></a></div></li>`;
}

function searchPage(cards) {
  return `<html><head><link href="/assets/site.css" rel="stylesheet"></head><body><div id="Teasers-search"><ul class="m">${cards}</ul></div></body></html>`;
}

function detailPage({ title, originalTitle, year, type, pageTitle }) {
  const ogType = type === 'movie' ? 'video.movie' : 'video.tv_show';
  const titleTag = pageTitle ? `<title>${pageTitle}</title>` : '';
  return `<html><head>${titleTag}<meta property="og:title" content="${title} (${year})"><meta property="ya:original_name" content="${originalTitle}"><meta property="video:release_date" content="${year}-01-01"><meta property="og:type" content="${ogType}"></head></html>`;
}

function mockFetch({ cards, details }) {
  const rules = [];
  const html = searchPage(cards.map((card) => fixtureCard(card.id, card.title, card.year, rules)).join(''));
  const css = rules.join('');
  return async (input) => {
    const url = new URL(input);
    if (url.pathname === '/search') return new Response(html);
    if (url.pathname === '/assets/site.css') return new Response(css);
    const id = url.pathname.slice(1);
    return details[id] ? new Response(details[id]) : new Response('', { status: 404 });
  };
}

const request = { title: 'Человек-паук: Новый день', originalTitle: '', year: 2026, type: 'movie' };

test('returns a direct URL for one exact title, year, and type match', async () => {
  const fetcher = mockFetch({
    cards: [{ id: '78994', title: request.title, year: 2026 }],
    details: {
      78994: detailPage({ title: request.title, originalTitle: 'Spider-Man: Brand New Day', year: 2026, type: 'movie' }),
    },
  });
  const result = await resolveLordFilm(request, fetcher);
  assert.deepEqual(result, {
    url: 'https://1.2026-lord.pics/78994',
    matched: true,
    reason: 'exact-match',
    embedUrl: null,
  });
});

test('falls back to search when there are no results', async () => {
  const result = await resolveLordFilm(request, mockFetch({ cards: [], details: {} }));
  assert.equal(result.matched, false);
  assert.equal(result.reason, 'no-exact-title');
  assert.match(result.url, /^https:\/\/1\.2026-lord\.pics\/search\?q=/);
});

test('reports an unavailable upstream search instead of a missing title', async () => {
  let calls = 0;
  const result = await resolveLordFilm(request, async () => {
    calls += 1;
    return new Response('', { status: 500 });
  });
  assert.equal(result.matched, false);
  assert.equal(result.reason, 'search-unavailable');
  assert.ok(result.upstreamStatuses?.length >= 4);
  assert.ok(result.upstreamStatuses.every((status) => status === 500));
  assert.ok(calls >= 1);
});

test('retries without the year when the year-qualified search has no cards', async () => {
  const calls = [];
  const result = await resolveLordFilm({
    title: 'Чужак',
    originalTitle: '',
    year: 2020,
    type: 'tv',
  }, async (input) => {
    const url = new URL(input);
    if (url.pathname === '/search') {
      const query = url.searchParams.get('q');
      calls.push(query);
      if (query === 'Чужак (2020)') return new Response(searchPage(''));
      return new Response(searchPage('<li><a href="/22385">Чужак</a></li>'));
    }
    return new Response(detailPage({
      title: 'Чужак',
      originalTitle: 'The Outsider',
      year: 2020,
      type: 'movie',
      pageTitle: 'Чужак (сериал 2020, 1 сезон) смотреть онлайн бесплатно',
    }));
  });
  assert.deepEqual(calls, ['Чужак (2020)', 'Чужак (2020)', 'Чужак']);
  assert.deepEqual(result, {
    url: 'https://1.2026-lord.pics/22385',
    matched: true,
    reason: 'exact-match',
    embedUrl: null,
  });
});

test('maps search connection failures to search-unavailable without retrying', async () => {
  let calls = 0;
  const result = await resolveLordFilm({
    title: 'Network failure title',
    originalTitle: '',
    year: 2020,
    type: 'movie',
  }, async () => {
    calls += 1;
    throw new TypeError('fetch failed');
  });
  assert.equal(result.reason, 'search-unavailable');
  assert.ok(calls >= 1);
});

test('caches search failures within the Worker isolate', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response('', { status: 500 });
  };
  const input = {
    title: 'negative cache test',
    originalTitle: '',
    year: 2020,
    type: 'movie',
  };
  const makeRequest = (title) => new Request('https://resolver.test/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, title }),
  });
  try {
    const first = await worker.fetch(makeRequest(input.title));
    const second = await worker.fetch(makeRequest('different cache title'));
    const third = await worker.fetch(makeRequest('different cache title'));
    assert.equal((await first.json()).reason, 'search-unavailable');
    assert.equal((await second.json()).reason, 'search-unavailable');
    assert.equal((await third.json()).reason, 'search-unavailable');
    assert.ok(calls >= 2);
    assert.ok(calls < 80);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('extracts an iframe embed URL from a film page', async () => {
  const { extractEmbedUrl } = await import('./index.mjs');
  const html = '<div class="pleer"><iframe src="https://cdn.player.example/embed/abc123"></iframe></div>';
  assert.equal(
    extractEmbedUrl(html, 'https://1.2026-lord.pics/42'),
    'https://cdn.player.example/embed/abc123',
  );
});

test('decodes LordFilm player data-src payloads', async () => {
  const { extractEmbedUrl } = await import('./index.mjs');
  const encoded = Buffer.from('https://player.example/embed/42', 'utf8').toString('base64');
  const html = `<motion id="Player"><ul><li class="active" data-src="${encoded}"></li></ul><iframe id="Iframe" src="https://player.example/embed/42"></iframe></div>`;
  assert.equal(
    extractEmbedUrl(html, 'https://1.2026-lord.pics/71852'),
    'https://player.example/embed/42',
  );
});

test('does not cache ordinary no-result responses', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(searchPage(''));
  };
  const makeRequest = () => new Request('https://resolver.test/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'ordinary no-result cache test',
      originalTitle: '',
      year: 2020,
      type: 'movie',
    }),
  });
  try {
    const first = await worker.fetch(makeRequest());
    const second = await worker.fetch(makeRequest());
    assert.equal((await first.json()).reason, 'no-exact-title');
    assert.equal((await second.json()).reason, 'no-exact-title');
    assert.ok(calls >= 8);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('falls back to search when more than one exact result exists', async () => {
  const title = request.title;
  const result = await resolveLordFilm(request, mockFetch({
    cards: [
      { id: '78994', title, year: 2026 },
      { id: '78995', title, year: 2026 },
    ],
    details: {
      78994: detailPage({ title, originalTitle: 'Spider-Man: Brand New Day', year: 2026, type: 'movie' }),
      78995: detailPage({ title, originalTitle: 'Spider-Man: Brand New Day', year: 2026, type: 'movie' }),
    },
  }));
  assert.equal(result.matched, false);
  assert.equal(result.reason, 'ambiguous-match');
});

test('does not match a page with the wrong type', async () => {
  const result = await resolveLordFilm(request, mockFetch({
    cards: [{ id: '78994', title: request.title, year: 2026 }],
    details: {
      78994: detailPage({ title: request.title, originalTitle: 'Spider-Man: Brand New Day', year: 2026, type: 'tv' }),
    },
  }));
  assert.equal(result.matched, false);
});

test('recognizes a series when LordFilm incorrectly labels its Open Graph type as a movie', async () => {
  const tvRequest = { title: 'Чужак', originalTitle: 'The Outsider', year: 2020, type: 'tv' };
  const result = await resolveLordFilm(tvRequest, mockFetch({
    cards: [{ id: '22385', title: 'Чужак: 1 сезон', year: 2020 }],
    details: {
      22385: detailPage({
        title: 'Чужак',
        originalTitle: 'The Outsider',
        year: 2020,
        type: 'movie',
        pageTitle: 'Чужак (сериал 2020, 1 сезон) смотреть онлайн бесплатно',
      }),
    },
  }));
  assert.deepEqual(result, {
    url: 'https://1.2026-lord.pics/22385',
    matched: true,
    reason: 'exact-match',
    embedUrl: null,
  });
});

test('does not follow redirects to arbitrary hosts', async () => {
  const requested = [];
  const result = await resolveLordFilm(request, async (input) => {
    requested.push(new URL(input).hostname);
    return new Response(null, {
      status: 302,
      headers: { Location: 'https://example.com/redirected' },
    });
  });
  assert.equal(result.matched, false);
  assert.deepEqual(requested, ['1.2026-lord.pics']);
});

test('allows browser requests only from the app origin', async () => {
  const allowed = await worker.fetch(new Request('https://resolver.test/resolve', {
    method: 'OPTIONS',
    headers: { Origin: 'https://relocpe.github.io' },
  }));
  const rejected = await worker.fetch(new Request('https://resolver.test/resolve', {
    method: 'OPTIONS',
    headers: { Origin: 'https://example.com' },
  }));
  assert.equal(allowed.headers.get('Access-Control-Allow-Origin'), 'https://relocpe.github.io');
  assert.equal(rejected.headers.get('Access-Control-Allow-Origin'), null);
});
