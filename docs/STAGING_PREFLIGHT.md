# Isolated staging preflight

Verified 2026-10-01.

## Authoritative resources

- Account/profile: `e8ae8afc6a6708283d6b0b4534f7c91f` / `isaudi`
- Production (read-only during readiness work): Worker `isaudi`, D1 `isaudi-db` (`9e19c212-0118-4660-aaeb-e46cc7f4470e`)
- Staging: Worker `isaudi-staging`, D1 `isaudi-staging-db` (`48ad8f80-6aae-4147-84e5-9f88161401eb`)
- Staging URL: `https://isaudi-staging.isaudi-official.workers.dev`

`npm run cf:preflight:production` and `npm run cf:preflight:staging` verify the active account, the exact Worker and D1 names, and the exact D1 IDs. The preflight requires the `isaudi` Wrangler profile and fails closed on a profile or account override. It never switches profiles or accounts.

Run the applicable preflight immediately before every remote command. Never use the retired Tabbakheen staging resources.

## Current staging state

- Migrations `0001` through `0017` are recorded as applied. `0017` replaced the
  historical Stream table with the final empty YouTube schema.
- A read-only count on 2026-10-01 found zero users, sessions, products, orders, order items, payments, reports, and Admin audit rows. `runtime_admin_summary` contains its required singleton row.
- The deployed Worker version is `38d24fa7-f78c-45a5-84dd-633917a014ad`.
- The staging Worker currently has no secrets, including no
  `ADMIN_BOOTSTRAP_TOKEN`; first-Admin setup and authenticated/Admin E2E remain
  unavailable until a secret and legitimate staging credentials are supplied.
- Because the controlled representative tenant is absent, no seed and no c10/c25/c50 load test is permitted by the production-readiness scope. Only normal smoke traffic is allowed.

## Edge controls

The authenticated API token can read the zone but cannot read the zone rulesets (`10000` authorization failure). Consequently, managed WAF and path rate-limit deployment are **not verified**. Do not state that those controls are enabled until an authorized read confirms the ruleset IDs, phases, expressions, actions, thresholds, and webhook exclusions.
