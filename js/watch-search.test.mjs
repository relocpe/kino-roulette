import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const src = readFileSync(new URL('./app.js', import.meta.url), 'utf8');

test('watch button looks up a kinopoisk id and then asks the resolvers', () => {
  assert.match(src, /function kpIdFor\(t\)/);
  const start = src.indexOf('async function openLordWatch');
  const end = src.indexOf('// ---------- история', start);
  const body = src.slice(start, end);
  const lookup = body.indexOf('await kpIdFor(t)');
  const search = body.indexOf('resolveWatchPayload(payload');
  assert.ok(lookup > 0 && search > lookup);
  assert.ok(body.indexOf('try {') < lookup);
});
