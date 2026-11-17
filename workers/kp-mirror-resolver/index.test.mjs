import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  embedFromKinopoiskId,
  extractMirrorEmbeds,
  mirrorPageUrls,
  resolveKinopoiskMirror,
} from './index.mjs';
import { allowedMediaUrl, collectStreams, pickPlayable, pickSeasonUrl, resolveVeoStream, rewritePlaylist } from './stream.mjs';

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

  it('attaches a playable stream when the catalog returns one', async () => {
    const fetcher = async (url) => {
      if (String(url).includes('gogo.iframe.cloud')) {
        return {
          ok: true,
          json: async () => ({
            type: 'movie',
            data: [
              { method: 'play', url: 'https://cdn.example/original.m3u8', translate: 'Оригинал' },
              { method: 'play', url: 'https://cdn.example/ru.m3u8', translate: 'Дубляж' },
              { method: 'link', url: 'https://evil.example/steal' },
            ],
          }),
        };
      }
      return { ok: false, status: 503 };
    };
    const r = await resolveKinopoiskMirror({ kinopoiskId: '326', type: 'movie', stream: true, title: 'Побег' }, fetcher);
    assert.equal(r.embedUrl, 'https://iframe.cloud/iframe/326');
    assert.equal(r.stream.url, 'https://cdn.example/ru.m3u8');
    assert.equal(r.stream.label, 'Дубляж');
  });

  it('falls back to direct embed when HTML has no iframe', async () => {
    const fetcher = async () => ({ ok: false, status: 503 });
    const r = await resolveKinopoiskMirror({ kinopoiskId: '42', type: 'movie' }, fetcher);
    assert.equal(r.matched, true);
    assert.equal(r.embedUrl, 'https://iframe.cloud/iframe/42');
    assert.equal(r.mirror, 'direct');
  });
});

describe('media proxy', () => {
  it('keeps only the catalog proxy and rewrites a playlist through it', () => {
    assert.equal(allowedMediaUrl('https://gogo.iframe.cloud/proxy/a.m3u8'), 'https://gogo.iframe.cloud/proxy/a.m3u8');
    assert.equal(allowedMediaUrl('https://evil.example/proxy/a.m3u8'), '');
    const text = rewritePlaylist('#EXTM3U\nhttps://gogo.iframe.cloud/proxy/a.m4s\n', 'https://gogo.iframe.cloud/proxy/a.m3u8', 'https://worker.test/media?u=');
    assert.match(text, /media\?u=https%3A%2F%2Fgogo\.iframe\.cloud%2Fproxy%2Fa\.m4s/);
  });
});

describe('call sources', () => {
  it('follows a call to the playable file', async () => {
    const fetcher = async (url) => {
      const u = String(url);
      if (u.includes('/lite/events')) return { ok: true, json: async () => [{ balanser: 'phantom', show: true }] };
      if (u.includes('/lite/phantom?')) return { ok: true, json: async () => ({ data: [{ method: 'call', url: 'https://gogo.iframe.cloud/lite/phantom/video?id=1', translate: 'Оригинальный' }] }) };
      if (u.includes('/phantom/video')) return { ok: true, json: async () => ({ data: [{ method: 'play', url: 'https://gogo.iframe.cloud/proxy/file.m3u8', translate: 'Оригинальный' }] }) };
      return { ok: false, status: 404 };
    };
    const stream = await resolveVeoStream({ kinopoiskId: '7918531', type: 'movie' }, fetcher);
    assert.equal(stream.url, 'https://gogo.iframe.cloud/proxy/file.m3u8');
    assert.equal(stream.source, 'phantom');
  });
});

describe('collectStreams', () => {
  it('puts a dub ahead of the original and keeps both', () => {
    const items = collectStreams([
      { source: 'veoveo', data: [{ method: 'play', url: 'https://cdn.example/orig.m3u8', translate: 'Оригинал' }] },
      { source: 'collaps', data: [{ method: 'play', url: 'https://cdn.example/dub.m3u8', translate: 'Movie Dubbing' }] },
    ]);
    assert.equal(items[0].url, 'https://cdn.example/dub.m3u8');
    const mixed = collectStreams([
      { source: 'collaps', data: [{ method: 'play', url: 'https://gogo.iframe.cloud/proxy/dub.m3u8', translate: 'Дубляж' }] },
      { source: 'veoveo', data: [{ method: 'play', url: 'https://cdn.example/orig.m3u8', translate: 'Оригинал' }, { method: 'play', url: 'https://cdn.example/a.m4s', translate: 'кусок' }] },
    ]);
    assert.equal(mixed[0].url, 'https://cdn.example/orig.m3u8');
    assert.equal(mixed.some((item) => item.url.endsWith('.m4s')), false);
    assert.equal(items[1].label, 'Оригинал');
    assert.equal(items.length, 2);
  });
});

describe('pickPlayable', () => {
  it('prefers a Russian dub and ignores non-play rows', () => {
    const picked = pickPlayable({
      data: [
        { method: 'play', url: 'http://cdn.example/insecure.m3u8', translate: 'Дубляж' },
        { method: 'play', url: 'https://cdn.example/original.m3u8', translate: 'Original' },
        { method: 'link', url: 'https://gogo.iframe.cloud/lite/veoveo?x=1', name: '1 сезон' },
        { method: 'play', url: 'https://cdn.example/ru.m3u8', translate: 'Русский дубляж' },
      ],
    });
    assert.equal(picked.url, 'https://cdn.example/ru.m3u8');
  });

  it('follows only a gogo season link', () => {
    assert.equal(pickSeasonUrl({
      data: [
        { method: 'link', url: 'https://evil.example/lite/veoveo' },
        { method: 'link', url: 'https://gogo.iframe.cloud/lite/veoveo?id=kp1&s=1' },
      ],
    }), 'https://gogo.iframe.cloud/lite/veoveo?id=kp1&s=1');
  });

  it('walks a season down to the first episode', async () => {
    const fetcher = async (url) => {
      if (String(url).includes('s=1')) {
        return { ok: true, json: async () => ({ type: 'episode', data: [{ method: 'play', url: 'https://cdn.example/e1.m3u8', name: '1 серия' }] }) };
      }
      return { ok: true, json: async () => ({ type: 'season', data: [{ method: 'link', url: 'https://gogo.iframe.cloud/lite/veoveo?s=1', name: '1 сезон' }] }) };
    };
    const stream = await resolveVeoStream({ kinopoiskId: '1', type: 'tv' }, fetcher);
    assert.equal(stream.url, 'https://cdn.example/e1.m3u8');
    assert.equal(stream.source, 'veoveo');
  });

  it('lists seasons and plays the requested episode', async () => {
    const fetcher = async (url) => {
      const u = String(url);
      if (u.includes('/lite/events')) return { ok: true, json: async () => [{ balanser: 'veoveo', show: true }] };
      if (u.includes('e=2')) return { ok: true, json: async () => ({ data: [{ method: 'play', url: 'https://cdn.example/e2.m3u8', translate: 'Дубляж', name: '2 серия' }] }) };
      if (u.includes('e=1')) return { ok: true, json: async () => ({ data: [{ method: 'play', url: 'https://cdn.example/e1.m3u8', translate: 'Дубляж', name: '1 серия' }] }) };
      if (u.includes('s=1')) return { ok: true, json: async () => ({ data: [
        { method: 'link', url: 'https://gogo.iframe.cloud/lite/veoveo?s=1&e=1', name: '1 серия' },
        { method: 'link', url: 'https://gogo.iframe.cloud/lite/veoveo?s=1&e=2', name: '2 серия' },
      ] }) };
      return { ok: true, json: async () => ({ data: [
        { method: 'link', url: 'https://gogo.iframe.cloud/lite/veoveo?s=1', name: '1 сезон' },
        { method: 'link', url: 'https://gogo.iframe.cloud/lite/veoveo?s=2', name: '2 сезон' },
      ] }) };
    };
    const first = await resolveVeoStream({ kinopoiskId: '5', type: 'tv' }, fetcher);
    assert.equal(first.url, 'https://cdn.example/e1.m3u8');
    assert.equal(first.series.season, 1);
    assert.equal(first.series.episode, 1);
    assert.equal(first.series.episodes.length, 2);
    const second = await resolveVeoStream({ kinopoiskId: '5', type: 'tv', season: 1, episode: 2 }, fetcher);
    assert.equal(second.url, 'https://cdn.example/e2.m3u8');
    assert.equal(second.series.episode, 2);
    assert.equal(second.options.some((item) => item.url.endsWith('e1.m3u8')), false);
  });
});