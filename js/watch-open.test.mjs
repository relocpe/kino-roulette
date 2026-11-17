import test from 'node:test';
import assert from 'node:assert/strict';
import { decideWatchOpen } from './watch-open.js';

const got = { id: 'tt0944947', title: 'Игра престолов', embedUrl: 'https://player.example/got' };
const other = { id: 'tt0903747', t: 'Breaking Bad', ru: 'Во все тяжкие' };

test('a clicked title replaces the film already saved in the room', () => {
  assert.equal(decideWatchOpen({ host: true, createdHere: false, boot: other, film: got }), 'play-boot');
});

test('a guest of someone else\'s room does not inherit their film', () => {
  assert.equal(decideWatchOpen({ host: false, createdHere: false, boot: other, film: got }), 'own-room');
});

test('the room we just created plays the clicked title even before the host flag arrives', () => {
  assert.equal(decideWatchOpen({ host: false, createdHere: true, boot: other, film: null }), 'play-boot');
});

test('an already resolved copy of the same title is shown as-is', () => {
  const saved = { id: other.id, embedUrl: 'https://player.example/bb' };
  assert.equal(decideWatchOpen({ host: true, createdHere: false, boot: other, film: saved }), 'saved');
  assert.equal(decideWatchOpen({ host: false, createdHere: false, boot: other, film: saved }), 'saved');
});

test('opening a shared link keeps the room film', () => {
  assert.equal(decideWatchOpen({ host: false, createdHere: false, boot: null, film: got }), 'room');
  assert.equal(decideWatchOpen({ host: true, createdHere: false, boot: null, film: null }), 'wait');
});
