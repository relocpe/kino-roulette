import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parsePlayerMessage, preferEmbeds, shouldSnapGuest } from './player-bridge.js';

describe('player bridge', () => {
  it('reads playerjs time', () => {
    assert.deepEqual(parsePlayerMessage({ event: 'time', time: 12.5, duration: 3600 }), { at: 12.5, duration: 3600, playing: true });
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
