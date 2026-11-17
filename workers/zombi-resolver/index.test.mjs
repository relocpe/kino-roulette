import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractEmbedUrl, extractEmbedUrls, resolveZombiFilm } from './index.mjs';

test('extracts data-src iframe from player block', () => {
  const html = '<div class="player"><iframe data-src="https://api.nextembed.ws/embed/movie/1?host=filmy-pro-zombi.com"></iframe></div>';
  assert.equal(
    extractEmbedUrl(html, 'https://filmy-pro-zombi.com/47-vojna-mirov-z_2013.html'),
    'https://api.nextembed.ws/embed/movie/1?host=filmy-pro-zombi.com',
  );
});

test('extracts multiple players from tabs-block', () => {
  const html = `<div class="tabs-block__content video-inside video-responsive mw">
    <iframe data-src="https://abalone.thealloha.club/?token_movie=a&amp;token=b" src="https://abalone.thealloha.club/?token_movie=a&amp;token=b"></iframe>
    <iframe data-src="//api.nextembed.ws/embed/movie/1?host=filmy-pro-zombi.com"></iframe>
  </div>`;
  assert.deepEqual(extractEmbedUrls(html, 'https://filmy-pro-zombi.com/1.html'), [
    'https://abalone.thealloha.club/?token_movie=a&token=b',
    'https://api.nextembed.ws/embed/movie/1?host=filmy-pro-zombi.com',
  ]);
});

test('resolves a search hit into embed URL', async () => {
  const searchHtml = '<a href="https://filmy-pro-zombi.com/47-vojna-mirov-z_2013.html">Война миров Z</a>';
  const pageHtml = `<html><head><meta property="og:title" content="Война миров Z (2013)">
</head><div class="player"><iframe data-src="https://play.totfilm.online/?x=1"></iframe></div>`;
  const fetcher = async (input) => {
    const url = new URL(input);
    if (url.searchParams.get('do') === 'search') return new Response(searchHtml);
    if (url.pathname.includes('47-vojna')) return new Response(pageHtml);
    return new Response('', { status: 404 });
  };
  const result = await resolveZombiFilm({
    title: 'Война миров Z',
    originalTitle: 'World War Z',
    year: 2013,
    type: 'movie',
  }, fetcher);
  assert.equal(result.matched, true);
  assert.equal(result.embedUrl, 'https://play.totfilm.online/?x=1');
  assert.match(result.url, /\/47-vojna-mirov-z_2013\.html$/);
});