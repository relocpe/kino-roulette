# LordFilm resolver

Deploy this Worker with Wrangler:

```sh
npx wrangler deploy --config workers/lordfilm-resolver/wrangler.toml
```

The app expects the Worker at `https://kino-roulette-lordfilm-resolver.samevamp.workers.dev/resolve`, using the existing API account's `samevamp.workers.dev` subdomain. If the deployed Worker gets a different hostname, update `LORD_RESOLVER` in `js/app.js`.

Run its tests with:

```sh
node --test workers/lordfilm-resolver/index.test.mjs
```
