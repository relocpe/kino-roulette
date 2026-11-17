import test from 'node:test';
import assert from 'node:assert/strict';
import { isBeta, betaFromQuery, betaAttr } from './beta.js';

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
