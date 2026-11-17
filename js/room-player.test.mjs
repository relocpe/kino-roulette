import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { chooseStream, isSitePlayer, kpEmbed, kpFromFilm, playbackStreamUrl } from './room-player.js';

describe('kpFromFilm', () => {
  it('reads a kinopoisk id from the film or from the iframe.cloud address', () => {
    assert.equal(kpFromFilm({ kinopoiskId: '326' }), '326');
    assert.equal(kpFromFilm({ embedUrl: 'https://iframe.cloud/iframe/326' }), '326');
    assert.equal(kpFromFilm({ embedUrl: 'https://kodik.info/video/1' }), '');
    assert.equal(kpEmbed('326'), 'https://iframe.cloud/iframe/326');
    assert.equal(kpEmbed(''), '');
  });
});

describe('isSitePlayer', () => {
  it('keeps a catalog file in our player and leaves the site page outside', () => {
    assert.equal(isSitePlayer('https://gogo.iframe.cloud/proxy/file.m3u8'), false);
    assert.equal(isSitePlayer('https://api.rstprgapipt.com/content/a.m3u8'), false);
    assert.equal(isSitePlayer('https://iframe.cloud/iframe/326'), true);
    assert.equal(isSitePlayer('https://iframe.cloud/see/326'), true);
  });
});

describe('playbackStreamUrl', () => {
  it('sends a catalog proxy file through our worker', () => {
    const next = playbackStreamUrl('https://gogo.iframe.cloud/proxy/file.m3u8');
    assert.match(next, /^https:\/\/kino-roulette-kp-mirror-resolver\.samevamp\.workers\.dev\/media\?u=/);
    assert.equal(playbackStreamUrl('https://cdn.example/film.m3u8'), 'https://cdn.example/film.m3u8');
  });
});

describe('chooseStream', () => {
  it('keeps the dub the host picked', () => {
    const streams = [
      { url: 'https://cdn.example/dub.m3u8', label: 'Movie Dubbing' },
      { url: 'https://cdn.example/orig.m3u8', label: 'Оригинал' },
    ];
    assert.equal(chooseStream(streams, 'Оригинал').url, 'https://cdn.example/orig.m3u8');
    assert.equal(chooseStream(streams, '').label, 'Movie Dubbing');
  });
});
