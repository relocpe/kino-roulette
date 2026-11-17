import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parsePlayerMessage, playbackUrl, playerKind, preferEmbeds, prepareEmbedUrl, shouldSnapGuest } from './player-bridge.js';

describe('player bridge', () => {
  it('reads playerjs time', () => {
    assert.deepEqual(parsePlayerMessage({ event: 'time', time: 12.5, duration: 3600 }), { at: 12.5, duration: 3600, playing: undefined });
  });
  it('reads kodik time', () => {
    const tick = parsePlayerMessage({ key: 'kodik_player_api', value: { method: 'time_update', time: 8, duration: 90 } });
    assert.equal(tick.at, 8);
    assert.equal(tick.duration, 90);
  });
  it('reads a json string', () => {
    const tick = parsePlayerMessage(JSON.stringify({ event: 'timeupdate', value: { seconds: 4, duration: 20 } }));
    assert.equal(tick.at, 4);
    assert.equal(tick.duration, 20);
  });
  it('reads a timeUpdate with currentTime', () => {
    const tick = parsePlayerMessage({ type: 'timeUpdate', currentTime: 16.25, duration: 120 });
    assert.equal(tick.at, 16.25);
    assert.equal(tick.duration, 120);
  });
  it('puts a direct player iframe ahead of a site page', () => {
    const ranked = preferEmbeds([
      'https://2026-lord.pics/123',
      'https://kodik.info/serial/1/abc',
      'https://abalone.thealloha.club/?token_movie=a',
    ]);
    assert.match(ranked[0], /kodik|alloha/);
    assert.match(ranked[2], /lord/);
  });
  it('reads the kodik events a live room actually receives', () => {
    assert.deepEqual(parsePlayerMessage({ key: 'kodik_player_pause' }), { playing: false, at: null, explicit: true });
    assert.deepEqual(parsePlayerMessage({ key: 'kodik_player_time_update', value: 42 }), { at: 42, duration: null, playing: undefined });
    assert.deepEqual(parsePlayerMessage({ key: 'kodik_player_seek', value: { time: 90 } }), { at: 90, explicit: true, seek: true });
    assert.equal(parsePlayerMessage({ key: 'kodik_player_ad_started' }), null);
  });
  it('builds an autostart address so the guest player begins without a click', () => {
    const kodik = playbackUrl('https://kodik.info/video/1/abc', { at: 8, playing: true });
    assert.match(kodik, /autoplay=1/);
    assert.match(kodik, /start_from=8/);
    const alloha = playbackUrl('https://abalone.thealloha.club/?token_movie=a', { at: 12, playing: true });
    assert.match(alloha, /api=1/);
    assert.match(alloha, /autoplay=1/);
    assert.match(alloha, /start=12/);
  });
  it('turns on the alloha and youtube control flags', () => {
    assert.match(prepareEmbedUrl('https://abalone.thealloha.club/?token_movie=a'), /[?&]api=1/);
    assert.match(prepareEmbedUrl('https://www.youtube.com/embed/BJXduSlq-eY'), /enablejsapi=1/);
    assert.equal(playerKind('https://kodik.info/serial/1/abc'), 'kodik');
  });
  it('reads a pause that has no timestamp', () => {
    assert.deepEqual(parsePlayerMessage({ key: 'kodik_player_api', value: { method: 'pause' } }), { playing: false, at: null, explicit: true });
  });
  it('ignores chat noise', () => {
    assert.equal(parsePlayerMessage({ type: 'chat', text: 'привет' }), null);
  });
});

describe('guest snap policy', () => {
  it('does not seek on a quiet heartbeat', () => {
    assert.equal(shouldSnapGuest({}), false);
    assert.equal(shouldSnapGuest({ first: true, playing: false }), false);
  });
  it('seeks on play, a real jump, or the sync button', () => {
    assert.equal(shouldSnapGuest({ first: true, playing: true }), true);
    assert.equal(shouldSnapGuest({ playEdge: true }), true);
    assert.equal(shouldSnapGuest({ jump: true }), true);
    assert.equal(shouldSnapGuest({ snap: true }), true);
    assert.equal(shouldSnapGuest({ force: true }), true);
  });
});
