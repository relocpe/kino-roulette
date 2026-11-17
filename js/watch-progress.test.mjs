import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { markProgress, watchButtonText, formatClock } from './watch-progress.js';

describe('continue from a real minute', () => {
  it('remembers the player time and names the episode', () => {
    markProgress('tt9', 2520, 5400, { season: 2, episode: 4 });
    const text = watchButtonText({ id: 'tt9', k: 'tvSeries' });
    assert.equal(text.label, 'Продолжить · 2 сезон, 4 серия');
    assert.match(text.hint, /42:00/);
    assert.equal(formatClock(134), '2:14');
  });
});
