# AI / Developer Context

## Read first

This is the standalone iSaudi.ai Next.js application. In Replit it lives under
`artifacts/isaudi`; in GitHub this directory maps to repository root.

**`/design-preview` is the approved visual source of truth for the next UI
migration.** The approved logo is `public/brand/design-preview-logo.png`.

The current task boundary ends before production UI migration. Do not migrate,
merge, or deploy without a new explicit task.

## Architecture summary

- Next.js 16 App Router and React 19
- Same-origin route handlers under `src/app/api`
- OpenNext Cloudflare adapter
- Cloudflare Worker `isaudi`
- Cloudflare D1 database `isaudi-db`, binding `DB`
- GitHub Actions deploys `main` through `.github/workflows/deploy-worker.yml`

## Security and product invariants

### Authentication

- Passwordless email OTP
- HMAC-protected OTP records with expiry, attempts, and request/verify limits
- D1-backed `httpOnly` `session_id` cookie
- Preview OTP is visual only and must not replace production auth

### Billing

- Tap only; no Moyasar
- Verify provider ID, status, SAR currency, exact amount, metadata ownership, and
  activate subscriptions atomically
- Checkout key `enterprise` maps to internal `business`
- Prices: Starter 199/1,999; Growth 399/3,999; Business 899/8,999 SAR

### Salla

- CSV import is supported
- Normal Salla flow is Easy Mode via signed lifecycle webhooks
- Credentials are encrypted; ownership is keyed by authoritative merchant ID
- Linking codes are short-lived and single-use
- Legacy OAuth callback remains for compatibility, not normal connection flow

### AI and reports

- AI generation/chat requires authentication and owned report context
- Context and message sizes are bounded
- Quotas are D1-backed
- Missing OpenAI configuration fails explicitly
- Reports include generation, weekly snapshots, insights, and owned-period
  comparison
- No external market or competitor data feed exists

### Admin

- Separate admin accounts and sessions
- Role-aware portal and audited actions
- Reset/transfer flows must retain their existing protections

### TikTok

No TikTok integration exists. The preview section is explicitly an unavailable
concept.

## Environment variable names

Never place values in documentation or commits:

`APP_URL`, `BASE_URL`, `NEXT_PUBLIC_APP_URL`, `AUTH_SECRET`,
`OTP_HMAC_SECRET`, `EMAIL_PROVIDER`, `EMAIL_FROM`, `RESEND_API_KEY`,
`RESEND_FROM`, `OPENAI_API_KEY`, `TAP_API_KEY`, `TAP_SECRET`,
`TAP_SECRET_KEY`, `SALLA_CLIENT_ID`, `SALLA_CLIENT_SECRET`,
`SALLA_WEBHOOK_SECRET`, `TOKEN_ENCRYPTION_KEY`, `CLOUDFLARE_ACCOUNT_ID`,
`CLOUDFLARE_API_TOKEN`.

## Deployment notes

- Workflow runtime is Node.js 24.
- `npm run deploy` builds OpenNext, runs the targeted remote D1 release, and
  deploys with Wrangler.
- The current release script does not generically replay every migration.
- The standalone GitHub Action is the authoritative packaging check.
- Do not push workspace-root history to the standalone app repository.

## Known risks

- Tap `enterprise` versus entitlement `business`
- Targeted migration release does not prove full migration history
- Salla depends on external Partner configuration and runtime secrets
- AI depends on runtime provider configuration
- Preview simulation could be confused with production behavior
- OpenNext compatibility requires runtime verification

## Next task

Create a controlled production UI migration on the dedicated migration branch.
Preserve all existing APIs, schemas, security controls, pricing, and provider
flows. Do not introduce TikTok or external-market claims during the UI migration.