import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parsePlayerMessage } from './player-bridge.js';

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
  it('ignores chat noise', () => {
    assert.equal(parsePlayerMessage({ type: 'chat', text: 'привет' }), null);
  });
});
