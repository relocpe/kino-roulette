import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeChat, sanitizeFilm, sanitizeNick, syncNow, newRoomId } from './codec.mjs';

describe('watch-party codec', () => {
  it('sanitizes nick and chat', () => {
    assert.equal(sanitizeNick('<b>x</b>'), 'bx/b');
    assert.equal(sanitizeChat('  hello  '), 'hello');
  });

  it('syncNow advances while playing', () => {
    const sync = { at: 10, playing: true, wall: Date.now() - 5000 };
    assert.ok(syncNow(sync) >= 14.9 && syncNow(sync) <= 15.1);
    assert.equal(syncNow({ at: 3, playing: false, wall: 0 }), 3);
  });

  it('newRoomId length', () => {
    assert.match(newRoomId(), /^[A-Z2-9]{8}$/);
  });

  it('keeps season and episode on the room film', () => {
    const film = sanitizeFilm({ id: 'tt1', title: 'Шерлок', type: 'tv', season: 2, episode: 4, streamUrl: 'https://cdn.example/a.m3u8', kinopoiskId: '12' });
    assert.equal(film.season, 2);
    assert.equal(film.episode, 4);
    assert.equal(film.type, 'tv');
    assert.equal(sanitizeFilm({ season: 0, episode: 900 }).episode, undefined);
  });
});
describe('watch-party publicRoom', () => {
  it('host flag follows the member, not a spoofable uid', async () => {
    const { publicRoom } = await import('./codec.mjs');
    const room = { id: 'X', hostId: 'a', sync: { at: 0, playing: false, wall: 0 }, chat: [] };
    const pub = publicRoom(room, [{ uid: 'a', nick: 'spoof', host: false }, { uid: 'b', nick: 'real', host: true }]);
    assert.deepEqual(pub.members.map((m) => m.host), [false, true]);
  });
});
