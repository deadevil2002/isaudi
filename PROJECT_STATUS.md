# Project Status

Last updated: 2026-09-19

## Approved state

- `/design-preview` is approved.
- `public/brand/design-preview-logo.png` is the approved iSaudi.ai logo.
- **`/design-preview` is the approved visual source of truth for the upcoming
  production UI migration.**
- The preview is intentionally isolated and does not perform real login,
  billing, API, database, Salla, or TikTok mutations.
- Desktop and mobile preview presentation has been browser-verified.

## Production UI status

Production continues to use the existing pages and components under `src/app`
and `src/components`. The approved preview has not been copied into the
homepage, authentication, pricing, dashboard, reports, billing, settings, or
admin routes.

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
- No migration of the approved preview UI into production routes

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
6. The visual OTP flow in `/design-preview` must never be mistaken for real
   authentication.
7. Production admin provisioning and current remote D1 migration state require
   separate operational verification.
8. Next.js/OpenNext compatibility must be runtime-tested on an isolated Worker;
   a local build alone is not sufficient.

## Current stop point

The approved-state recovery commit and safety tag are being prepared before any
production UI migration begins. The next development task is a controlled
migration on a dedicated branch while preserving all backend contracts and
production behavior.