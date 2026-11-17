import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hostChange, guestNeedsSeek, localPosition } from './sync-policy.js';

describe('host change', () => {
  it('sends a seek made inside the player (2:14 while the room is at 1:00)', () => {
    const r = hostChange({ at: 134, playing: true, expected: 60, sentPlaying: true });
    assert.deepEqual(r, { at: 134, playing: true });
  });
  it('ignores normal playback', () => {
    assert.equal(hostChange({ at: 61.2, playing: true, expected: 60.5, sentPlaying: true }), null);
  });
  it('sends a native pause and a native play', () => {
    assert.deepEqual(hostChange({ at: 80, playing: false, explicit: true, expected: 80, sentPlaying: true }), { at: 80, playing: false });
    assert.deepEqual(hostChange({ at: 80, playing: true, explicit: true, expected: 80, sentPlaying: false }), { at: 80, playing: true });
  });
  it('sends autoplay that the room does not know about', () => {
    assert.deepEqual(hostChange({ at: 2, playing: true, expected: 0, sentPlaying: false }), { at: 2, playing: true });
  });
  it('sends a seek while paused with a smaller threshold', () => {
    assert.deepEqual(hostChange({ at: 200, playing: undefined, expected: 80, sentPlaying: false }), { at: 200, playing: false });
    assert.equal(hostChange({ at: 80.4, playing: undefined, expected: 80, sentPlaying: false }), null);
  });
  it('stays quiet right after our own command, but a new seek still goes out', () => {
    assert.equal(hostChange({ at: 11, playing: true, expected: 10, sentPlaying: true, sinceSentMs: 500 }), null);
    assert.deepEqual(hostChange({ at: 134, playing: true, expected: 10, sentPlaying: true, sinceSentMs: 500 }), { at: 134, playing: true });
  });
  it('sends a pause even inside the quiet window', () => {
    assert.deepEqual(hostChange({ at: 80, playing: false, explicit: true, expected: 80, sentPlaying: true, sinceSentMs: 400 }), { at: 80, playing: false });
  });
  it('ignores a tick without time', () => {
    assert.equal(hostChange({ at: null, playing: true }), null);
  });
});

describe('guest drift', () => {
  it('pulls a guest who fell behind', () => {
    assert.equal(guestNeedsSeek({ expected: 134, local: 60, roomPlaying: true }), true);
  });
  it('leaves a small drift alone', () => {
    assert.equal(guestNeedsSeek({ expected: 100, local: 98.5, roomPlaying: true }), false);
  });
  it('pauses a guest who is still playing after the host paused', () => {
    assert.equal(guestNeedsSeek({ expected: 80, local: 80.2, roomPlaying: false, localPlaying: true }), true);
  });
  it('follows a paused seek and does not repeat within the cooldown', () => {
    assert.equal(guestNeedsSeek({ expected: 134, local: 60, roomPlaying: false }), true);
    assert.equal(guestNeedsSeek({ expected: 80.5, local: 80, roomPlaying: false }), false);
    assert.equal(guestNeedsSeek({ expected: 134, local: 60, roomPlaying: true, sinceSeekMs: 3000 }), false);
  });
});

describe('local position', () => {
  it('advances while playing and holds while paused', () => {
    assert.equal(localPosition({ at: 10, wall: 1000, playing: true }, 4000), 13);
    assert.equal(localPosition({ at: 10, wall: 1000, playing: false }, 4000), 10);
    assert.equal(localPosition(null), null);
  });
});
