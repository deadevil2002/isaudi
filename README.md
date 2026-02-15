isaudi.ai web

## Deployment (Cloudflare Workers via GitHub Actions)

This project is deployed to Cloudflare Workers using a GitHub Actions workflow that runs on pushes to the `main` branch.

The workflow:
- Checks out the repository
- Uses Node.js 20
- Runs `npm ci`
- Runs `npm run build`
- Runs `npm run deploy` (which builds and deploys via OpenNext + Wrangler)

### Required GitHub Secrets

Configure these repository secrets in **GitHub → Settings → Secrets and variables → Actions**:

- `CLOUDFLARE_ACCOUNT_ID` – Cloudflare account identifier used by Wrangler for deployments.
- `CLOUDFLARE_API_TOKEN` – API token with permissions to deploy Workers (and D1 if used).
