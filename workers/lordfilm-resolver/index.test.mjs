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

function detailPage({ title, originalTitle, year, type }) {
  const ogType = type === 'movie' ? 'video.movie' : 'video.tv_show';
  return `<html><head><meta property="og:title" content="${title} (${year})"><meta property="ya:original_name" content="${originalTitle}"><meta property="video:release_date" content="${year}-01-01"><meta property="og:type" content="${ogType}"></head></html>`;
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
  });
});

test('falls back to search when there are no results', async () => {
  const result = await resolveLordFilm(request, mockFetch({ cards: [], details: {} }));
  assert.equal(result.matched, false);
  assert.match(result.url, /^https:\/\/1\.2026-lord\.pics\/search\?q=/);
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
