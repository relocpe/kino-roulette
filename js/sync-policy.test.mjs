import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hostChange, guestNeedsSeek, guestCommand, localPosition, noteHostTick } from './sync-policy.js';

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

describe('host play actually reaches the room', () => {
  const run = (samples) => {
    let state = { tick: null, stallSince: 0, sentAt: 0, sentPlaying: false, sentWall: 0 };
    const emits = [];
    for (const sample of samples) {
      const step = noteHostTick(state, sample.tick, sample.ms);
      state = step.state;
      if (step.emit) emits.push(step.emit);
    }
    return emits;
  };
  it('does not pause the guest on the first timestamp, then starts them when time moves', () => {
    const emits = run([
      { ms: 1000, tick: { at: 8 } },
      { ms: 2000, tick: { at: 9.1 } },
    ]);
    assert.equal(emits.some((e) => e.playing === false), false);
    assert.deepEqual(emits.at(-1), { at: 9.1, playing: true });
  });
  it('starts the room on a real play event even without a timestamp', () => {
    const emits = run([{ ms: 500, tick: { playing: true, explicit: true } }]);
    assert.deepEqual(emits, [{ at: 0, playing: true }]);
  });
  it('sends a pause the host actually pressed', () => {
    let state = noteHostTick({ tick: null, stallSince: 0, sentAt: 80, sentPlaying: true, sentWall: 0 }, { at: 80, playing: false, explicit: true }, 5000).state;
    const step = noteHostTick(state, { at: 80, playing: false, explicit: true }, 5000);
    assert.equal(step.emit, null);
    const fresh = noteHostTick({ tick: { at: 80, wall: 0, playing: true }, stallSince: 0, sentAt: 80, sentPlaying: true, sentWall: 0 }, { at: 80, playing: false, explicit: true }, 5000);
    assert.deepEqual(fresh.emit, { at: 80, playing: false });
  });
  it('sends a seek while the host stays paused', () => {
    const step = noteHostTick(
      { tick: { at: 80, wall: 0, playing: false }, stallSince: 0, sentAt: 80, sentPlaying: false, sentWall: 0 },
      { at: 200, explicit: true },
      4000,
    );
    assert.deepEqual(step.emit, { at: 200, playing: false });
  });
});

describe('guest starts when the host is playing', () => {
  it('plays from a cold player', () => {
    assert.deepEqual(guestCommand({ roomPlaying: true, roomAt: 8, localPlaying: null }), { playing: true, at: 8 });
  });
  it('does not poke a cold player while the room is paused', () => {
    assert.equal(guestCommand({ roomPlaying: false, roomAt: 0, localPlaying: null, snap: true }), null);
  });
  it('pauses a guest who is still going', () => {
    assert.deepEqual(guestCommand({ roomPlaying: false, roomAt: 80, localPlaying: true }), { playing: false, at: 80 });
  });
  it('leaves a guest who is already in sync', () => {
    assert.equal(guestCommand({ roomPlaying: true, roomAt: 30, localPlaying: true, localAt: 29 }), null);
  });
  it('catches up when the host rewound while everyone was paused', () => {
    assert.deepEqual(guestCommand({ roomPlaying: false, roomAt: 134, localPlaying: false, localAt: 60, sinceSeekMs: 9000 }), { playing: false, at: 134 });
    assert.equal(guestCommand({ roomPlaying: false, roomAt: 134, localPlaying: false, localAt: 60, sinceSeekMs: 2000 }), null);
  });
  it('retries play after a missed command, not on every tick', () => {
    assert.equal(guestCommand({ roomPlaying: true, roomAt: 8, localPlaying: false, sinceSeekMs: 200 }), null);
    assert.deepEqual(guestCommand({ roomPlaying: true, roomAt: 9, localPlaying: false, sinceSeekMs: 1600 }), { playing: true, at: 9 });
  });
});

describe('local position', () => {
  it('advances while playing and holds while paused', () => {
    assert.equal(localPosition({ at: 10, wall: 1000, playing: true }, 4000), 13);
    assert.equal(localPosition({ at: 10, wall: 1000, playing: false }, 4000), 10);
    assert.equal(localPosition(null), null);
  });
});
