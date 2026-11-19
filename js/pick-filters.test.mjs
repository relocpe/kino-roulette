import assert from 'node:assert/strict';
import test from 'node:test';
import { passesRegion, passesRuntime } from './pick-filters.js';

test('runtime buckets use minutes and skip a title without a length', () => {
  assert.equal(passesRuntime({ s: 80 * 60 }, 'short'), true);
  assert.equal(passesRuntime({ s: 100 * 60 }, 'short'), false);
  assert.equal(passesRuntime({ s: 100 * 60 }, 'mid'), true);
  assert.equal(passesRuntime({ s: 130 * 60 }, 'long'), true);
  assert.equal(passesRuntime({ s: 0 }, 'short'), false);
  assert.equal(passesRuntime({ s: 50 * 60 }, ''), true);
});

test('region matches any listed country and treats anime without a country as Japan', () => {
  assert.equal(passesRegion({ countries: ['FR', 'US'] }, 'us'), true);
  assert.equal(passesRegion({ countries: ['FR'] }, 'us'), false);
  assert.equal(passesRegion({ countries: ['RU'] }, 'ru'), true);
  assert.equal(passesRegion({ src: 'al' }, 'asia'), true);
  assert.equal(passesRegion({}, 'eu'), false);
  assert.equal(passesRegion({}, ''), true);
});
