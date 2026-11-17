# Vercel и локальная разработка

## Что куда

| Часть | Где |
| --- | --- |
| Сайт + `POST /api/resolve` | Vercel (этот репозиторий) |
| Комната «смотреть вместе» | Cloudflare Worker `kino-roulette-watch-party` |
| Резолвер embed (Kodik / Alloha) | Vercel `/api/resolve` или Worker `workers/embed-resolver` |

## Vercel

1. [Import](https://vercel.com/new) репозиторий `relocpe/kino-roulette`.
2. Build / Install — пусто (статика).
3. **Environment Variables** (Production + Preview):
   - `KODIK_TOKEN` — токен API Kodik (кабинет).
   - `ALLOHA_TOKEN` — токен Alloha (если используешь).
   - `EMBED_PROVIDER` — опционально `kodik,alloha`.
   - `CORS_ORIGINS` — опционально, через запятую, если фронт не на `*.vercel.app` и не GitHub Pages.

На `*.vercel.app` клиент сам ходит на `${origin}/api/resolve`.

## Локально

```bash
# Терминал 1 — сайт
npm run dev:site
# http://127.0.0.1:4173

# Терминал 2 — embed-resolver
cp workers/embed-resolver/.dev.vars.example workers/embed-resolver/.dev.vars
# впиши KODIK_TOKEN
npm run dev:embed
```

В консоли браузера можно задать свой URL резолвера:

```js
localStorage.setItem('kr:embed', 'http://127.0.0.1:8788/resolve');
```

## Комната с Vercel

В watch-party worker добавлен origin `*.vercel.app`. Свой домен — допиши в `workers/watch-party/index.mjs` или задеплой с `CORS_ORIGINS` на embed-worker.