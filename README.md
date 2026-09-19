# iSaudi.ai

iSaudi.ai is a Saudi ecommerce analytics application for importing store data,
generating sales and profitability reports, comparing reporting periods, and
asking an AI assistant questions grounded in the user's latest report.

Production: **https://isaudi.ai**

## Current status

- The production application and its existing routes remain unchanged.
- `/design-preview` is an isolated, non-mutating visual preview.
- **The approved `/design-preview` is the visual source of truth for the
  upcoming production UI migration.**
- `public/brand/design-preview-logo.png` is the approved logo for that migration.
- The approved visual system has not yet been migrated to production routes.
- No TikTok integration exists. The TikTok section in `/design-preview` is an
  explicitly unavailable visual concept, not a product commitment.

See `PROJECT_STATUS.md`, `MIGRATION_NOTES_V2.md`, and `AI_CONTEXT.md` before
continuing development.

## Architecture

```text
Browser
  -> Next.js 16 App Router
  -> same-origin route handlers under /api
  -> OpenNext adapter
  -> Cloudflare Worker
  -> Cloudflare D1 (binding: DB)
```

- Runtime: Next.js 16.3.4, React 19, TypeScript
- Worker: `isaudi`
- Database: Cloudflare D1 `isaudi-db`
- Worker configuration: `wrangler.toml`
- OpenNext configuration: `open-next.config.ts`
- Production assets: `.open-next/assets`
- Canonical API base: `https://isaudi.ai/api`

The Replit workspace contains the app under `artifacts/isaudi`, while the
standalone GitHub repository stores this directory's contents at repository
root. Do not push the whole Replit workspace to the iSaudi repository.

## Product systems

### Authentication

Passwordless email OTP authentication uses D1-backed, `httpOnly` sessions.
Production OTPs are HMAC-protected and rate-limited. See `README_AUTH.md`.

### Billing and subscriptions

Tap is the only payment provider. The current public prices are:

| Plan | Monthly | Annual |
| --- | ---: | ---: |
| Starter | 199 SAR | 1,999 SAR |
| Growth | 399 SAR | 3,999 SAR |
| Business | 899 SAR | 8,999 SAR |

The checkout provider key for the Business entitlement is currently
`enterprise`; application entitlements use `business`. Preserve and test this
mapping during migration. See `README_BILLING.md`.

### Store data and Salla

Users can import CSV product/order data. Salla Easy Mode support uses signed
webhooks, encrypted rotating credentials, short-lived single-use linking codes,
and immutable merchant ownership. Partner configuration is still an external
operational dependency. See `README_SALLA.md`.

### Reports and market comparison

Production supports generated analyses, weekly report snapshots, insights, and
comparison between owned reports/periods. It does not currently use an external
competitor or market-data feed. The market-comparison presentation in
`/design-preview` must remain illustrative unless a verified data source is
added later.

### AI assistant

The authenticated AI assistant uses the latest owned report as bounded context,
applies D1-backed quota controls, and calls OpenAI only when runtime
configuration is present. Missing provider configuration fails explicitly.

### Admin area

The application includes a separate admin authentication/session system,
role-aware portal, audited actions, reset/transfer flows, and supporting D1
schema. Code presence does not prove that production admin provisioning is
complete; verify deployment state separately.

### TikTok

TikTok is not integrated. There are no production TikTok routes, credentials,
database tables, or provider client.

## Deployment

The standalone GitHub repository deploys from `.github/workflows/deploy-worker.yml`
when `main` is pushed:

1. Checkout
2. Node.js 24
3. `npm ci`
4. `npm run build`
5. OpenNext build
6. Remote D1 release command
7. Wrangler Worker deployment

Production routes are `isaudi.ai/*` and `www.isaudi.ai/*`. Do not use a
`workers.dev` hostname as the application base URL.

The current release script applies only the idempotent Salla link-code release
SQL and then probes the required schema. Do not assume that this proves all
older migrations are present in a fresh database.

## Environment variable names

Names only—never commit values:

- `APP_URL`
- `BASE_URL`
- `NEXT_PUBLIC_APP_URL`
- `AUTH_SECRET`
- `OTP_HMAC_SECRET`
- `EMAIL_PROVIDER`
- `EMAIL_FROM`
- `RESEND_API_KEY`
- `RESEND_FROM`
- `OPENAI_API_KEY`
- `TAP_API_KEY`
- `TAP_SECRET`
- `TAP_SECRET_KEY`
- `SALLA_CLIENT_ID`
- `SALLA_CLIENT_SECRET`
- `SALLA_WEBHOOK_SECRET`
- `TOKEN_ENCRYPTION_KEY`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

Development-only names used by local tooling include `DEV_OTP`,
`DEV_TRUSTED_ORIGINS`, `DEBUG_EMAIL_VERIFY`, `DB_PATH`, and `CF_PAGES_URL`.

## Validation

```bash
npm test
npx tsc --noEmit --pretty false
npm run lint
npm run build
```

The direct Next.js build is the local source/build check. The standalone
repository's GitHub Action is the authoritative OpenNext packaging check.

## Stop point

Development is stopped immediately before migrating the approved visual system
from `/design-preview` into production routes. Do not start that migration,
merge a migration branch, change backend behavior, or deploy production without
an explicit next task.