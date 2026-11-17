import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  embedFromKinopoiskId,
  extractMirrorEmbeds,
  mirrorPageUrls,
  resolveKinopoiskMirror,
} from './index.mjs';

describe('embedFromKinopoiskId', () => {
  it('builds iframe.cloud URL', () => {
    assert.equal(embedFromKinopoiskId('1267348'), 'https://iframe.cloud/iframe/1267348');
  });
});

describe('mirrorPageUrls', () => {
  it('uses kinopoisk.run and ggpoisk paths', () => {
    assert.deepEqual(mirrorPageUrls('99', 'movie'), [
      'https://www.kinopoisk.run/film/99/',
      'https://ggpoisk.ru/film/99/',
    ]);
    assert.deepEqual(mirrorPageUrls('5', 'tv'), [
      'https://www.kinopoisk.run/series/5/',
      'https://ggpoisk.ru/series/5/',
    ]);
  });
});

describe('extractMirrorEmbeds', () => {
  it('finds iframe.cloud links', () => {
    const html = `<script>window.x="https://iframe.cloud/iframe/1267348";</script>`;
    assert.deepEqual(extractMirrorEmbeds(html), ['https://iframe.cloud/iframe/1267348']);
  });
});

describe('resolveKinopoiskMirror', () => {
  it('returns embed from HTML', async () => {
    const fetcher = async () => ({
      ok: true,
      url: 'https://r.vtop.to/film/1267348/',
      text: async () => 'src="https://iframe.cloud/iframe/1267348"',
    });
    const r = await resolveKinopoiskMirror({ kinopoiskId: '1267348', type: 'movie' }, fetcher);
    assert.equal(r.matched, true);
    assert.equal(r.embedUrl, 'https://iframe.cloud/iframe/1267348');
  });

  it('falls back to direct embed when HTML has no iframe', async () => {
    const fetcher = async () => ({ ok: false, status: 503 });
    const r = await resolveKinopoiskMirror({ kinopoiskId: '42', type: 'movie' }, fetcher);
    assert.equal(r.matched, true);
    assert.equal(r.embedUrl, 'https://iframe.cloud/iframe/42');
    assert.equal(r.mirror, 'direct');
  });
});