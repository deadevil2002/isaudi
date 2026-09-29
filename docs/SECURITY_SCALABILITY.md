# Phase 5A security and scalability notes

## SQL and D1

- Repository SQL uses prepared statements for request-controlled values. The only generated SQL fragments are placeholder counts from fixed server constants and the Admin section query, whose select/search/order fragments come from `ADMIN_SECTIONS`; search, pagination, and offsets remain bound values.
- Migration `0015_security_scalability_hardening.sql` adds indexes for hot session/token lookups, tenant-scoped product/order/report queries, order-item joins, snapshots, and bounded Admin ordering. Validate production plans after migration with `EXPLAIN QUERY PLAN` and D1 `meta.rows_read`; expected hot plans are `SEARCH ... USING INDEX`, not full tenant-table scans.
- Schema creation was removed from Salla OAuth requests. Global cleanup deletes were removed from session validation and OTP/Admin/AI rate-limit requests. This OpenNext worker currently has cron declarations but no repository-owned scheduled handler, so adding cleanup there would require a new deployment wrapper. Expired ephemeral rows should be deleted by a future scheduled task in bounded batches (for example, at most 1,000 rows per table/run), never by normal requests.

## Dashboard operations

- Before: a normal `/dashboard` render performed 9 D1 statements (layout session/user, page session/user, three store-stat aggregates, connection, latest report) and two request-path session cleanup writes. A report-id miss could make this 10.
- After: React request memoization shares the two identity reads, store statistics use one statement/one orders scan, and connection/report remain independent: 5 statements normally, or 6 for an invalid requested report fallback. No maintenance write occurs.

## Admin scaling

- Initial Admin data now returns only the four exact overview aggregates. Users, subscriptions, payments, connections, reports, and audit rows load only when their tab is opened.
- Each section uses indexed exact email/action search and pages of 25 rows (hard maximum 50, maximum page 200). SQL identifiers and order fields are fixed server allowlists. The exact revenue aggregate remains uncached; at very high Admin concurrency, a maintained financial aggregate is the next step rather than serving an approximate total.

## Endpoint and rate-limit review

| Class | Current application protection | Recommended edge rule before production |
| --- | --- | --- |
| Auth/OTP | strict body cap, email/IP limits, bounded attempts | `/api/auth/request-otp`: 10/min/IP; `/api/auth/verify-otp`: 30/min/IP |
| AI and analysis | authenticated plan quota, hourly/daily/concurrency reservations, body cap | `/api/analysis/*`: 30/min/IP with managed challenge/block |
| Reports | authenticated ownership/premium checks; weekly generation is idempotent | generation routes: 10/min/IP |
| Billing | authentication, canonical catalog, idempotency, provider verification | create/verify: 20/min/IP |
| Salla | authenticated state/link operations; signed provider webhook | interactive connection routes: 30/min/IP |
| CSV | authenticated session, strict total/per-file/row limits | upload: 5 requests/10 min/IP |
| Admin | isolated session/role/origin controls and action-specific limits | `/admin/api/*`: 120/min/IP; login: 20/15 min/IP |
| Public video | signed Stream token, allowed origins, 15-second burst cache/coalescing | `/how-it-works`: 120/min/IP if abusive |
| Provider webhooks | Tap/Salla signature and idempotency checks | **Exclude from generic rate rules**; use managed WAF only |

Cloudflare rate counters are burst/abuse controls, not exact business quotas. Keep the existing D1 quotas for entitlement correctness. Configure the available path-based rules in the zone dashboard; these recommendations do not depend on Enterprise-only fields.

## Read replication

Do not enable it yet. Read-heavy candidates are public video metadata, Admin list tabs, reports, snapshots, and dashboard aggregates. Authentication, OTP, payments, subscriptions, ownership claims, rate limits, Admin mutations, and all read-after-write flows require primary or bookmark-based sequential consistency. The minimal next step is to adopt `DB.withSession()` per request, use `first-primary` for consistency-sensitive flows/bookmarks after writes, verify latency and replica-region metrics, and only then enable D1 read replication.

## Observability and remaining work

Workers Logs are enabled at 10% with query strings redacted; traces are sampled at 1%. Use invocation status/outcome to find Worker exceptions and 429s. Use D1 Analytics for query count/latency and per-query `meta.rows_read`/`rows_written`, with billing notifications on read/write growth. Remaining bottlenecks are exact global Admin aggregates, historical order scans for unsnapshotted analysis, and per-product cost resolution in weekly/insight generation; address those with authoritative snapshots or bulk joins after production metrics identify actual pressure.
