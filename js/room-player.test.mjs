import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { kpFromFilm } from './room-player.js';

describe('kpFromFilm', () => {
  it('reads a kinopoisk id from the film or from the iframe.cloud address', () => {
    assert.equal(kpFromFilm({ kinopoiskId: '326' }), '326');
    assert.equal(kpFromFilm({ embedUrl: 'https://iframe.cloud/iframe/326' }), '326');
    assert.equal(kpFromFilm({ embedUrl: 'https://kodik.info/video/1' }), '');
  });
});
