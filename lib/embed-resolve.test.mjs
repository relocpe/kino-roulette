import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { corsOrigin, lookupKodik, resolveEmbed } from './embed-resolve.mjs';

describe('corsOrigin', () => {
  it('allows vercel preview', () => {
    const req = { headers: { get: () => 'https://kino-roulette-abc.vercel.app' } };
    assert.equal(corsOrigin(req), 'https://kino-roulette-abc.vercel.app');
  });
});

describe('resolveEmbed', () => {
  it('returns no-token without secrets', async () => {
    const r = await resolveEmbed({ kinopoiskId: '404900' }, {});
    assert.equal(r.matched, false);
    assert.equal(r.reason, 'no-token');
  });
});

describe('lookupKodik', () => {
  it('parses kodik link', async () => {
    const fetcher = async () => ({
      ok: true,
      json: async () => ({
        results: [{ link: '//kodik.info/serial/123/1/1', title: 'Test', season: 1, episode: 1 }],
      }),
    });
    const r = await lookupKodik({ kinopoiskId: '1', token: 'x', fetcher });
    assert.equal(r.matched, true);
    assert.equal(r.embedUrl, 'https://kodik.info/serial/123/1/1');
  });
});