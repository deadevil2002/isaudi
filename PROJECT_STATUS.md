# Project Status

Last updated: 2026-10-01

## Approved state

- `/design-preview` is approved.
- `public/brand/design-preview-logo.png` is the approved iSaudi.ai logo.
- Phase 4 Admin visual migration and managed Cloudflare Stream “How It Works” video are implemented.
- Admin visual migration and managed “How It Works” video management are implemented.
- Production deployment remains blocked on the audited D1 reconciliation/runbook and verification of production edge rules and Stream configuration.
- **`/design-preview` is the approved visual source of truth for the upcoming
  production UI migration.**
- The preview is intentionally isolated and does not perform real login,
  billing, API, database, Salla, or TikTok mutations.
- Desktop and mobile preview presentation has been browser-verified.

## Production UI status

- Phase 1: public navigation, homepage, pricing, login, OTP, and verification complete.
- Phase 2: authenticated shell, dashboard, costs, assistant, reactive KPIs/charts,
  reports rail, and owned-report comparison complete.
- Official Saudi Business Center seal integration complete.
- Phase 3: Settings, Billing/subscriptions, Salla connection, and CSV import complete.
- Admin uses the approved premium presentation while preserving its separate authentication and authorization model.

## Implemented production capabilities

- Passwordless email OTP authentication and D1-backed sessions
- CSV product and order ingestion
- Salla Easy Mode webhook/link-code architecture
- Tap checkout and subscriptions
- Sales/profit analysis and report generation
- Weekly reports, insights, and owned-report comparison
- Report-grounded AI generation and chat with quotas
- Account/settings and subscription status
- Separate admin portal and security model
- Cloudflare Worker deployment with D1

## Current pricing

| Plan | Monthly | Annual |
| --- | ---: | ---: |
| Starter | 199 SAR | 1,999 SAR |
| Growth | 399 SAR | 3,999 SAR |
| Business | 899 SAR | 8,999 SAR |

Tap's provider-facing checkout key remains `enterprise` for the Business plan;
the internal entitlement is `business`.

## Not implemented

- No production TikTok integration
- No external competitor/market-data feed

The preview's TikTok and market-comparison presentations are visual/illustrative
unless backed by existing report comparison data.

## Known risks and verification requirements

1. The deploy workflow uses Node.js 24. Older documentation previously stated
   Node.js 20.
2. Tap uses `enterprise` while entitlement/UI code uses `business`; preserve the
   mapping.
3. The deploy script applies only the current idempotent release SQL, not a
   generic replay of every historical migration.
4. Salla Easy Mode depends on correct external Partner Portal settings and
   runtime secrets.
5. AI routes fail when `OPENAI_API_KEY` is not configured.
6. QA fixtures in `/design-preview/dashboard-review` must never be imported by
   production pages or mistaken for real account, billing, or connection state.
7. Production admin provisioning and current remote D1 migration state require
   separate operational verification.
8. Next.js/OpenNext compatibility must be runtime-tested on an isolated Worker;
   a local build alone is not sufficient.

## Current stop point

The approved design baseline is `a8906f2ceba795a32dd0313451503bb39cacae80` on `new-ui-migration`. Security-readiness changes must be validated on isolated staging only. Production and `main` remain untouched. Production D1 is not ready for migration until the legacy `admin_audit_log` schema is reconciled and the complete `0009`–`0016` sequence is rehearsed from a schema snapshot.
