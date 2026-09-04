# isaudi.ai

Production: **https://isaudi.ai**

## Architecture

The production application uses:

```text
Next.js 16 → OpenNext → Cloudflare Worker
```

- Worker name: `isaudi`
- First-party API base: `https://isaudi.ai/api` (same origin)
- Database: Cloudflare D1 `isaudi-db`
- D1 binding: `DB`
- Worker configuration: `wrangler.toml`
- OpenNext configuration: `open-next.config.ts`

## Deployment (Cloudflare Workers via GitHub Actions)

This project is deployed to Cloudflare Workers using a GitHub Actions workflow that runs on pushes to the `main` branch.

The workflow:
- Checks out the repository
- Uses Node.js 20
- Runs `npm ci`
- Runs `npm run build`
- Runs `npm run deploy` using the project-pinned OpenNext and Wrangler versions

The custom production routes are:

- `isaudi.ai/*`
- `www.isaudi.ai/*`

Do not use the `workers.dev` hostname as the application base URL.

### Required GitHub Secrets

Configure these repository secrets in **GitHub → Settings → Secrets and variables → Actions**:

- `CLOUDFLARE_ACCOUNT_ID` – Cloudflare account identifier used by Wrangler for deployments.
- `CLOUDFLARE_API_TOKEN` – API token with permissions to deploy Workers (and D1 if used).

Runtime secrets and provider credentials are configured in Cloudflare and must not be committed.
