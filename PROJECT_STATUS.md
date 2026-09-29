# Project Status

Last updated: 2026-09-29

## Approved state

- `/design-preview` is approved.
- `public/brand/design-preview-logo.png` is the approved iSaudi.ai logo.
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
- Admin remains on the existing presentation and is the next separately approved phase.

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
- No Admin visual migration
- No Admin-managed “How It Works” video or protected streaming workflow

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

Phase 3 is complete on `new-ui-migration`, based on migration HEAD
`fde22bd3c690c05c726f6839868aa74aaa7431ee`. Review and isolated runtime testing
must precede any merge or deployment. The next major UI task is Admin; it must
remain separate and preserve its authentication, roles, audit, reset, and
transfer protections.
