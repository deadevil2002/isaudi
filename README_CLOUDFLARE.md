# Cloudflare Worker Deployment for isaudi.ai

> This file replaces the obsolete Cloudflare Pages/static-export instructions. The application is not deployed as a Pages project.

## Production architecture

```text
Next.js 16 → OpenNext → Cloudflare Worker
```

- Production URL: `https://isaudi.ai`
- First-party API base: `https://isaudi.ai/api`
- Worker: `isaudi`
- D1 database: `isaudi-db`
- D1 binding: `DB`
- Worker entrypoint: `.open-next/worker.js`
- Static assets: `.open-next/assets`

`wrangler.toml` is the deployment source of truth. It preserves both custom routes:

- `isaudi.ai/*`
- `www.isaudi.ai/*`

The `workers.dev` hostname is not the canonical application URL.

## Deployment

Pushes to `main` trigger `.github/workflows/deploy-worker.yml`. The workflow runs:

```bash
npm ci
npm run build
npm run deploy
```

`npm run deploy` builds the OpenNext Worker and deploys it with the project-pinned tooling.

Required GitHub Actions secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

Runtime secrets and integration credentials remain in Cloudflare; never commit them.

## Local validation

Before pushing deployment configuration:

```bash
npm ci
npm run build
npm run cf:build
npx wrangler deploy --dry-run --config ./wrangler.toml
```

These commands build locally and validate Worker packaging without changing production.