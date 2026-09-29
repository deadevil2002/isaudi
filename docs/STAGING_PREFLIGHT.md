# Phase 5B staging and production preflight

## Isolated staging

- Worker: `isaudi-staging` at `https://isaudi-staging.tabbakheen.workers.dev`
- D1: `isaudi-staging-db` (`86d3c78e-ceea-422e-999a-08d5fc08da26`, EEUR)
- Configuration: `wrangler.staging.toml`; it has no production hostname, database, payment, AI, Salla, or Stream binding/secret.
- Data: synthetic tenants only. `scripts/staging/seed-load.sql` creates 100/1,000, 5,000/50,000, and 20,000/200,000 product/order tenants plus bounded synthetic Admin rows.
- The temporary Admin session used for the test was removed afterward; generate and insert a fresh hashed 64-character token for any future Admin load run instead of committing a reusable credential.
- Staging observability samples all Worker logs and 10% of traces. `wrangler d1 insights isaudi-staging-db --time-period 1h --json` exposes query count, duration, rows read, and rows written.

Do not reuse the staging D1 ID or workers.dev hostname in `wrangler.toml`. Build with `npm run cf:build`, deploy only with `npx wrangler deploy --config wrangler.staging.toml`, and provision secrets interactively with `wrangler secret put --config wrangler.staging.toml`.

## Load-test finding

The current Cloudflare account enforces a 10 ms Worker CPU ceiling. Live logs confirmed intermittent `exceededCpu` outcomes/HTTP 503 error 1102 on the dynamic homepage, so the public ramp stopped at 250 connections and did not continue to 500 or 1,000. This staging tier is not representative enough for a production capacity decision until its Workers plan/CPU allowance matches production.

The homepage ramp produced 79.6/184.8/365.2/674.6/762.4 RPS at 10/25/50/100/250 connections. Its p50/p97.5/p99 at 250 were 219/1,094/1,422 ms, with 61 HTTP 503 responses in 3,812 requests (1.60%); the 10-connection cold run had 44/398 non-2xx responses (11.06%). No 429 was observed. Because errors were already significant, escalation stopped.

The dashboard test exposed and fixed an unresolved D1 aggregate Promise. After the fix, 10-connection dashboard tests had zero errors: small tenant 37 RPS and p50/p97.5/p99 232/802/889 ms; medium 19.2 RPS and 491/1,171/1,284 ms; large 6.8 RPS and 1,301/2,276/2,276 ms. The small tenant remained error-free at 100 connections (85.4 RPS, 997/1,884/1,982 ms). Autocannon reports p97.5 rather than p95; p97.5 is retained as a conservative p95 upper bound.

D1 insights confirmed the server dashboard path issues one session lookup, one user lookup, one aggregate, one connection lookup, and one latest-report lookup per successful render. Premium clients additionally make one intentional weekly-snapshot request and, when a snapshot exists, one insights request; there is no interval polling loop.

Admin lazy pagination was confirmed at 25 rows by default with a server hard maximum of 50, and tabs did not load in the initial summary call. A 10-connection read test was not healthy enough to escalate: summary returned 302/353 HTTP 200 responses, users 332/332, payments 261/302, and audit 281/371. The remaining responses were 405 plus three summary 503s. Per the stop policy, the mixed 100-Admin test was not attempted on this CPU-limited tier.

## Recommended zone rate-limit rules

Create zone-level `http_ratelimit` rules using the source IP characteristic (Cloudflare includes data-center scope). These rules use only path matching and request counts, so they do not require Enterprise Advanced Rate Limiting. Use `block`, a 60-second mitigation for ordinary API bursts, and a 600-second mitigation for authentication/CSV abuse.

| Name | Path expression | Requests / period | Mitigation |
| --- | --- | ---: | ---: |
| OTP request | `http.request.uri.path eq "/api/auth/request-otp"` | 10 / 60 s | 600 s |
| OTP verify | `http.request.uri.path eq "/api/auth/verify-otp"` | 30 / 60 s | 600 s |
| AI chat | `http.request.uri.path eq "/api/analysis/chat"` | 30 / 60 s | 60 s |
| Report/analysis generation | `http.request.uri.path in {"/api/analysis/generate" "/api/reports/generate-weekly"}` | 10 / 60 s | 60 s |
| Billing create/verify | `http.request.uri.path in {"/api/billing/tap/create-payment" "/api/billing/verify"}` | 20 / 60 s | 60 s |
| Interactive Salla | `http.request.uri.path in {"/api/connect/salla/start" "/api/connect/salla/status" "/api/connect/salla/verify" "/api/connect/salla/link-code"}` | 30 / 60 s | 60 s |
| CSV upload | `http.request.uri.path eq "/api/connect/csv/upload"` | 5 / 600 s | 600 s |
| Admin API | `starts_with(http.request.uri.path, "/admin/api/") and http.request.uri.path ne "/admin/api/login"` | 120 / 60 s | 60 s |
| Admin login | `http.request.uri.path eq "/admin/api/login"` | 20 / 900 s | 900 s |

Do not include `/api/billing/tap/webhook` or `/api/webhooks/salla` in generic limits. Preserve their signature/idempotency checks. Deploy the Cloudflare Free Managed Ruleset on Free, or the broader Cloudflare Managed Ruleset plus OWASP Core Ruleset on Pro/Business, and review Security Events before tightening SQLi/exploit actions.

## Remaining production blockers

- Match staging's Worker CPU allowance to the intended production plan, then rerun the same staged ramps and mixed 100-Admin read test.
- The authenticated Cloudflare account has no `isaudi` production Worker and cannot verify production secrets. Staging lacks `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_STREAM_API_TOKEN`, and `CLOUDFLARE_STREAM_CUSTOMER_CODE`; no real Stream upload/playback test was possible.
- Admin exact summary queries read about 5,007 rows/request in this dataset. Financial totals remain accurate, but a maintained authoritative aggregate is the next scale step if Admin concurrency requires it.
- Large-tenant dashboard aggregation scans about the tenant's order cardinality on each render; snapshots/precomputed current totals are required before treating 200,000-order latency as production-ready.
