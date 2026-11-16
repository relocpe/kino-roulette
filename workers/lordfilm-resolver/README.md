# LordFilm resolver

Deploy this Worker with Wrangler:

```sh
npx wrangler deploy --config workers/lordfilm-resolver/wrangler.toml
```

The app expects the Worker at `https://kino-roulette-lordfilm-resolver.samevamp.workers.dev/resolve`, using the existing API account's `samevamp.workers.dev` subdomain. If the deployed Worker gets a different hostname, update `LORD_RESOLVER` in `js/app.js`.

Successful responses may include `embedUrl` (iframe src extracted from the LordFilm film page). The site opens it in an in-app player instead of redirecting to LordFilm search.

After changing `workers/lordfilm-resolver/index.mjs`, redeploy the Worker — the GitHub Pages build does not deploy Workers automatically.

Pushes to `main` that touch this folder also run `.github/workflows/deploy-lordfilm-resolver.yml` when `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are set in GitHub Actions secrets.

`CLOUDFLARE_ACCOUNT_ID` must be the 32-character hex id from the same Cloudflare account that hosts `samevamp.workers.dev` (Workers & Pages → right sidebar), not a zone id and not the text `Value:` from a form label.

Run its tests with:

```sh
node --test workers/lordfilm-resolver/index.test.mjs
```
