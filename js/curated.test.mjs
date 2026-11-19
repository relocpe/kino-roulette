import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildShelves, shelfById, weekScore, SHELF_SPECS, SHELF_LIMIT, MIN_SHELF } from './curated.js';

const movie = (over) => ({ id: 'tt1', t: 'Film', k: 'movie', y: 2025, r: 7.2, v: 90000, s: 110 * 60, g: ['Drama'], i: 'poster', ...over });

test('week score is votes times rating', () => {
  assert.equal(weekScore({ v: 1000, r: 8 }), 8000);
  assert.equal(weekScore({}), 0);
});

test('2025 shelf keeps rated movies from that year only', () => {
  const titles = [
    movie({ id: 'tt2025', y: 2025, v: 120000 }),
    movie({ id: 'tt2024', y: 2024, v: 900000, r: 9 }),
    movie({ id: 'ttflop', y: 2025, r: 2.2, v: 400000 }),
    movie({ id: 'ttseries', k: 'tvSeries', y: 2025, v: 500000 }),
    movie({ id: 'al9', k: 'anime', y: 2025, v: 900000, r: 9 }),
    movie({ id: 'ttnoposter', i: '', y: 2025, v: 800000 }),
  ];
  const shelf = buildShelves(titles).find((s) => s.id === 'novinki-2025');
  assert.deepEqual(shelf.items.map((t) => t.id), ['tt2025']);
});

test('a shelf never invents an id and drops duplicates', () => {
  const a = movie({ id: 'tt9', v: 50000 });
  const b = movie({ id: 'tt9', v: 800000, t: 'Other' });
  const shelf = buildShelves([a, b], [shelfById('novinki-2025')])[0];
  assert.deepEqual(shelf.items.map((t) => t.id), ['tt9']);
  assert.equal(shelf.items[0].t, 'Film');
});

test('weekly top sorts by votes times rating inside 2024–2026', () => {
  const titles = [
    movie({ id: 'ttlow', y: 2025, r: 8, v: 100000 }),
    movie({ id: 'tthigh', y: 2026, r: 7, v: 200000 }),
    movie({ id: 'ttold', y: 2019, r: 9, v: 900000 }),
    movie({ id: 'ttshow', k: 'tvSeries', y: 2024, r: 8.5, v: 300000 }),
  ];
  const shelf = buildShelves(titles).find((s) => s.id === 'top');
  assert.deepEqual(shelf.items.map((t) => t.id), ['ttshow', 'tthigh', 'ttlow']);
  assert.ok(weekScore(shelf.items[0]) >= weekScore(shelf.items[1]));
});

test('new-season shelf keeps a show that ended in 2025 and skips one that ended in 2019', () => {
  const titles = [
    movie({ id: 'ttlive', k: 'tvSeries', y: 2016, e: 2025, r: 8.6, v: 500000 }),
    movie({ id: 'ttgone', k: 'tvSeries', y: 2016, e: 2019, r: 8.6, v: 500000 }),
    movie({ id: 'ttnew', k: 'tvSeries', y: 2025, r: 8, v: 200000 }),
    movie({ id: 'ttquiet', k: 'tvSeries', y: 2019, e: 0, r: 8.4, v: 400000 }),
  ];
  const ids = buildShelves(titles).find((s) => s.id === 'serialy').items.map((t) => t.id);
  assert.deepEqual(ids, ['ttlive', 'ttnew']);
  assert.ok(!ids.includes('ttgone'));
  assert.ok(!ids.includes('ttquiet'));
});

test('short evening is under 100 minutes and not a series', () => {
  const titles = [
    movie({ id: 'ttshort', y: 2024, s: 96 * 60, v: 80000, r: 7.4 }),
    movie({ id: 'ttlong', y: 2024, s: 130 * 60, v: 800000, r: 8 }),
    movie({ id: 'ttzero', y: 2024, s: 0, v: 800000, r: 8 }),
    movie({ id: 'ttshow', k: 'tvSeries', y: 2024, s: 50 * 60, v: 800000, r: 8.5 }),
  ];
  const ids = buildShelves(titles).find((s) => s.id === 'korotkiy').items.map((t) => t.id);
  assert.deepEqual(ids, ['ttshort']);
});

test('anime shelf is only recent anilist ids', () => {
  const titles = [
    movie({ id: 'al10', k: 'anime', y: 2025, r: 8.4, v: 200000 }),
    movie({ id: 'alold', k: 'anime', y: 2019, r: 9, v: 900000 }),
    movie({ id: 'tt1', y: 2025, r: 8, v: 400000 }),
  ];
  const ids = buildShelves(titles).find((s) => s.id === 'anime').items.map((t) => t.id);
  assert.deepEqual(ids, ['al10']);
});

test('a shelf stops at 24 cards', () => {
  const titles = Array.from({ length: 40 }, (_, n) => movie({ id: 'tt' + n, v: 50000 + n }));
  const shelf = buildShelves(titles, [shelfById('novinki-2025')])[0];
  assert.equal(shelf.items.length, SHELF_LIMIT);
  assert.equal(shelf.items[0].id, 'tt39');
});

test('catalog pool is real ids and every shelf has 12–24 posters', () => {
  const curated = JSON.parse(readFileSync(new URL('../data/curated.json', import.meta.url), 'utf8'));
  const catalog = JSON.parse(readFileSync(new URL('../data/catalog.json', import.meta.url), 'utf8'));
  const known = new Set(catalog.titles.map((row) => row[0]));
  assert.ok(curated.titles.length > 80);
  for (const t of curated.titles) assert.ok(known.has(t.id), t.id);
  const shelves = buildShelves(curated.titles);
  assert.equal(shelves.length, SHELF_SPECS.length);
  for (const shelf of shelves) {
    assert.ok(shelf.items.length >= MIN_SHELF && shelf.items.length <= SHELF_LIMIT, `${shelf.id} ${shelf.items.length}`);
    assert.equal(new Set(shelf.items.map((t) => t.id)).size, shelf.items.length);
    assert.ok(shelf.text && !/lorem|ipsum/i.test(shelf.text));
    assert.equal(shelf.text.split(/[.!?]/).filter(Boolean).length, 1);
  }
});
