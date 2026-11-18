import test from 'node:test';
import assert from 'node:assert/strict';
import { isBeta, betaFromQuery, betaAttr, gestureFor, gesturesAllowed, GESTURES, playGenreGesture } from './beta.js';

test('only a real true turns the beta look on', () => {
  assert.equal(isBeta(true), true);
  for (const v of [false, undefined, null, 0, 1, '1', 'true']) assert.equal(isBeta(v), false);
});

test('the beta link parameter reads 1 and 0 and ignores the rest', () => {
  assert.equal(betaFromQuery('?beta=1'), true);
  assert.equal(betaFromQuery('?x=2&beta=0'), false);
  assert.equal(betaFromQuery('?beta=yes'), null);
  assert.equal(betaFromQuery(''), null);
  assert.equal(betaFromQuery(undefined), null);
});

test('the page attribute is 1 when on and empty when off', () => {
  assert.equal(betaAttr(true), '1');
  assert.equal(betaAttr(false), '');
});

test('genre gestures follow the selected genre', () => {
  assert.equal(gestureFor(['horror']), 'ghost');
  assert.equal(gestureFor(['action']), 'flash');
  assert.equal(gestureFor(['thriller']), 'flash');
  assert.equal(gestureFor(['anime', 'action']), 'flash');
  assert.equal(gestureFor(['drama', 'horror']), 'ghost');
  assert.equal(gestureFor(['romance']), 'warm');
  assert.equal(gestureFor(['scifi']), 'scan');
  assert.equal(gestureFor(['fantasy']), 'dust');
  assert.equal(gestureFor(['comedy']), 'edge');
  assert.equal(gestureFor(['noir']), 'edge');
  assert.equal(gestureFor([]), 'edge');
  assert.equal(GESTURES.flash.count, 3);
  assert.ok(GESTURES.flash.ms <= 400);
  assert.equal(GESTURES.edge.count, 1);
});

test('gestures stay off without beta, with reduced motion, or with effects off', () => {
  const on = { beta: true, reduce: false, effects: true };
  assert.equal(gesturesAllowed(on), true);
  assert.equal(gesturesAllowed({ ...on, beta: false }), false);
  assert.equal(gesturesAllowed({ ...on, reduce: true }), false);
  assert.equal(gesturesAllowed({ ...on, effects: false }), false);
  assert.equal(gesturesAllowed({ beta: true, reduce: false }), false);
  assert.equal(playGenreGesture(['horror']), '');
});
