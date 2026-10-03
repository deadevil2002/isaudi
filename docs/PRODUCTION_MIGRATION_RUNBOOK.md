# Production D1 migration runbook (prepare only)

Status: **LEGAL REVIEW REQUIRED — not approved for execution**. Re-verified read-only on 2026-10-03. Production remained unchanged.

## 2026-10-03 superseding release state

- The live production ledger and schema are verified through `0019_admin_observability.sql`. The earlier pre-`0008b` starting point below is retained only as release history.
- The only planned remote steps are canonical `0020`–`0029`. Files `0026`–`0029` are independent production-safe reconciliations of the validated Phase 7 schema; the `migrations/staging` files remain staging-only and are never applied to production.
- Phase 7 production activation remains blocked by the legal gates in `docs/phase-7/PRIVACY_DECISION_RECORD.md`. Preparing or rehearsing SQL does not authorize processing or turn the feature flag on.
- The current read-only production plan reports 10 pending ledger/schema steps, 15 expected remaining writes, 11,162 prior estimated writes, and **11,177 cumulative expected writes**, below the unchanged 12,000 ceiling.
- The complete representative local rehearsal through `0029` preserves source counts, passes quick and foreign-key checks, and produces zero operations on a second run.

## Verified starting point

- Account/profile: `e8ae8afc6a6708283d6b0b4534f7c91f` / `isaudi`
- Worker: `isaudi`
- D1: `isaudi-db` / `9e19c212-0118-4660-aaeb-e46cc7f4470e`
- Canonical `0009`–`0019` are absent from the live ledger. The ledger has exactly
  `id`, unique `name`, and `applied_at`; it has no checksum or other metadata.
  Historical `0014` is a Cloudflare Stream schema and is recorded only through
  an explicit no-op marker. Its SQL is never executed in production.
- Objects from `0009`–`0013` mostly already exist from a different historical ledger.
- `how_it_works_video`, `user_runtime_summaries`, `runtime_admin_summary`, `admin_ai_usage_daily`, `admin_observability_summary`, and `admin_plan_summary` are absent. The eight `0018` AI metering columns and four `0019` observability columns are also absent; the base seven-column AI usage ledger and both tenant-scoped indexes already exist.
- Production `admin_audit_log` is legacy camelCase (`adminUserId`, `targetType`, `targetId`, `metadata`, `createdAt`). Current code requires the canonical snake_case table. `0015` would fail on `created_at` if applied first.
- Read-only counts used for budgeting: 13 users, 4 sessions, 2 OTP rate rows, 10 store connections, 1,022 products, 1,546 orders, 1,671 order items, 75 reports, 6 snapshots, 2 subscriptions, 1 payment, and 0 Admin audit rows.
- D1 reports 54 tables, no views, one existing Salla ownership trigger, a 29,376,512-byte database in WEUR, and read replication disabled. Time Travel bookmark retrieval is available.

## Mandatory preflight

1. Check out the exact reviewed release commit on `new-ui-migration`; do not use `main`.
2. Run `npm run cf:preflight:production`. Abort unless account, profile, Worker, D1 name, and D1 ID exactly match the values above.
3. Run `npx wrangler d1 migrations list isaudi-db --remote --config ./wrangler.toml` and re-query `sqlite_schema` plus `d1_migrations`. Abort on any change from the reviewed schema until the diff is reviewed again.
4. Confirm the application version being prepared accepts both the pre-migration production schema (while the old Worker is live) and the final canonical schema, or schedule a maintenance window that prevents incompatible traffic.

## Backup and rehearsal

1. Export an access-controlled local rehearsal copy with `wrangler d1 export ... --remote`. Do not print its data, commit it, or retain it after rehearsal.
2. Capture a fresh Time Travel bookmark immediately before the mutation window with `wrangler d1 time-travel info isaudi-db --config ./wrangler.toml --json`. Store the bookmark securely outside Git.
3. Rehearse on a disposable, access-controlled local database built from the export. Never print or commit customer data, and securely remove the local copy when verification is complete.
4. The initial production-export rehearsal proved that `0009`–`0014` apply and `0015` then fails with `no such column: created_at`. The canonical chain must not be run without the bridge.
5. An isolated `0016` rehearsal on the same production copy created 13 user summaries, one exact Admin summary, and all 16 runtime triggers. Source-table row counts were unchanged, aggregate comparisons had zero mismatches, `PRAGMA quick_check` was `ok`, and `PRAGMA foreign_key_check` returned no rows. Production verification supplements these supported checks with exact ledger, schema, index, trigger, aggregate, audit-bridge, metering, YouTube, and row-preservation invariants.
6. The bridge is `migrations/production-reconciliation/0008b_reconcile_legacy_admin_audit.sql`. A representative rehearsal used the verified production cardinalities (13 users, 1,022 products, 1,546 orders, 1,671 items, and the remaining verified table counts), legacy audit fixtures, foreign keys, and recursive triggers. The complete runner sequence passed with unchanged business counts, exact audit projections, exact runtime and Admin observability aggregates, 16 runtime triggers, 27 observability triggers, the final YouTube schema, all 19 AI usage columns, integrity `ok`, and no foreign-key violations.
7. Use only `scripts/production-release.mjs` for a real release. It performs the fixed identity preflight, verifies the exact ledger/schema and live counts, computes the write budget, applies one atomic Wrangler migration at a time, verifies the exact ledger prefix after every step, emits JSON, and stops before Worker deployment. Do not apply the reconciliation config or individual migration files manually and do not edit the ledger ad hoc.

Local rehearsal is safe and makes no remote calls:

```powershell
npm run d1:release:rehearse
```

The rehearsal must report `productionTouched: false`, `secondRunOperations: 0`, and `workerDeploymentIncluded: false`.

## Required Admin audit compatibility bridge

This bridge is implemented and locally rehearsed, but is not approved for remote execution.

1. In one transaction, rename the legacy table to a dated backup and drop its two index-name collisions.
2. Create `admin_audit_log` with both legacy columns (`adminUserId`, `adminEmail`, `targetType`, `targetId`, `metadata`, `createdAt`) and canonical columns (`admin_id`, `target_type`, `target_id`, `ip_hash`, `metadata_json`, `created_at`). Keep `id` as the primary key and `action` required; require at least one timestamp representation.
3. Copy every legacy row while populating both representations. Populate `admin_id` only when `adminUserId` matches `admin_accounts.id`; otherwise preserve attribution in the legacy fields and use `NULL` for the foreign key.
4. Add two recursion-safe `BEFORE INSERT` normalization triggers on the bridge table so the deployed legacy Worker can write legacy fields and the new Worker can write canonical fields. The nested row has both projections and uses the same immutable primary key with `INSERT OR IGNORE`; therefore recursive trigger mode cannot loop and a reused ID cannot duplicate. No UPDATE or DELETE synchronization is installed because the application audit path is append-only.
5. Recreate a canonical `idx_admin_audit_created` on `created_at`, retain a separately named legacy `createdAt` index, and retain the legacy target index. Migration `0015` then adds `idx_admin_audit_action_created` safely.
6. Verify old/new projections, row-count equality, primary-key equality, trigger behavior, and foreign keys locally. Keep the backup table through the Worker rollback window. Remove bridge columns, triggers, and the backup only in a later separately approved cleanup.

## Historical 0008b–0019 write budget and current cumulative budget

`0016` creates 13 per-user summary rows plus one Admin summary row at the verified cardinality; its triggers do not fire during that initial backfill. The 19 missing `0015` indexes cover 8,557 current row/index entries. `0019` adds four nullable columns to `ai_usage_ledger`; creates three aggregate tables, five indexes, and 27 triggers; backfills one observability singleton plus five plan buckets; and builds four indexes over 4 sessions, 1 Salla connection, 1,022 products, and 1,546 orders (2,573 index entries). The verified through-`0019` estimate remains **11,162 writes**. The reconciled `0020`–`0029` plan adds ten ledger rows, two bounded Salla-claim reconciliation/index writes at the verified cardinality, and three singleton/configuration seed rows, for 15 remaining and **11,177 cumulative expected writes**. The runner recomputes this from fresh counts and aborts above 12,000 or on material drift. Any drift must be reapproved.

## Migration 0019: Admin observability

`migrations/0019_admin_observability.sql` depends on the canonical `ai_usage_ledger` from `0011`, Salla tables from `0012`/`0013`, payment integrity fields present in the verified baseline/hardening chain, and the `0018` metering columns. It adds `plan`, `latency_ms`, `failure_kind`, and `provider_status` to the ledger. It creates `admin_ai_usage_daily` (checked scope and operation values with a composite primary key), `admin_observability_summary` (checked singleton ID), and `admin_plan_summary` (primary-keyed `WITHOUT ROWID`). The migration creates `idx_admin_ai_usage_daily_range`, `idx_sessions_created_at`, `idx_salla_connections_updated_at`, `idx_products_platform_updated_at`, and `idx_orders_platform_created_at`; one finalized-AI aggregation trigger; and 26 product/order/item/snapshot/subscription/payment/connection/Salla/plan summary triggers. Backfills are aggregate-only and preserve all source rows. The release verifier compares every 0019 table, index, trigger, and column definition to the reviewed migration before accepting the ledger state.

## Execution order after separate approval

1. Freeze production-changing jobs and confirm no CSV, Salla sync, billing mutation, report generation, or Admin mutation is running.
2. Repeat account/resource/schema preflight and capture the Time Travel bookmark.
3. Run `npm run d1:release:production:plan`. This is read-only but contacts production; inspect its JSON identity, exact steps, 19-index set, secret-name presence, and write budget. Abort on any mismatch.
4. With separate explicit approval for that release window, set the approval phrase, the newly captured Time Travel bookmark, and its capture timestamp only in the current process, then run `npm run d1:release:production:execute`. The runner requires the exact approval phrase internally and rejects bookmarks older than ten minutes. Never place these values in Git, files, documentation, or command arguments.
5. From the currently verified live `0019` state, the runner applies exactly: `0020` → `0021` → `0022` → `0023` → `0024` → `0025` → `0026` → `0027` → `0028` → `0029`. It still supports and verifies the historical prefix safely, and never runs historical `0014` SQL.
6. The release runner performs all schema, bridge, aggregate, integrity, foreign-key, ledger-prefix, and data-count checks, emits its JSON report, and stops. It cannot deploy a Worker.
7. Deploy the reviewed new Worker only in a separate human-approved action after the release JSON is accepted. The current Worker remains compatible through the bridge; the new Worker requires the final YouTube table, runtime summary tables, and `0018` metering columns. Never deploy the new Worker before the schema, and retain the audit bridge throughout rollback.
8. Under separate production approval, configure a strong
   `ADMIN_BOOTSTRAP_TOKEN` with `wrangler secret put` after the production
   identity preflight. Never place it in a command argument, file, log, or Git.
   Create the first independent Admin only after the new Worker is live, verify
   that setup is then closed and reuse is rejected, and remove the bootstrap
   secret in a separately approved follow-up after the Admin login is verified.
9. Run the listed smoke tests, monitor Worker/D1 errors, and retain the audit
   bridge plus legacy backup throughout the rollback window.

Cloudflare Stream availability is not a release dependency. The final application
does not require `CLOUDFLARE_STREAM_API_TOKEN`,
`CLOUDFLARE_STREAM_CUSTOMER_CODE`, a Stream subscription, or a Stream upload.

The production `OPENAI_API_KEY` secret name was verified present; its value was
not read and must not be changed by this release. Managed WAF and Custom WAF are
not configured; the `/api/auth/*` edge rate limit is verified. WAF enablement is
a manual release decision, not an automatic action in this procedure.

## Abort conditions

- Any account/profile/name/ID mismatch.
- Migration ledger or schema changed since rehearsal.
- Non-zero foreign-key violations, failed statements, unexpected table/index replacement, or audit row-count mismatch.
- `rows_written` materially above rehearsal, D1 errors/overload, or an active write-producing workflow.
- Aggregate totals differ from source totals, required triggers/indexes are absent, or the new Worker is not compatible with the resulting schema.

## Post-migration verification

- `PRAGMA foreign_key_check` returns no rows.
- Canonical `admin_audit_log` columns and both expected indexes exist; preserved legacy backup count equals the copied count until final sign-off.
- Legacy and canonical audit inserts both populate the opposite projection through the bridge triggers.
- `how_it_works_video` exists with `youtube_video_id`, `youtube_url`, and `enabled`; `user_runtime_summaries` and `runtime_admin_summary` exist.
- `ai_usage_ledger` has exactly the 19 reviewed columns and retains both tenant-scoped indexes; the eight `0018` metering fields and four `0019` observability fields are nullable. Historical source ledger rows are preserved; only aggregate rows are backfilled.
- All three `0019` aggregate tables, five indexes, and 27 triggers match the reviewed definitions; the observability singleton exists and all five reviewed plan buckets exist.
- Phase 6 tables from `0020`–`0025` and every Phase 7 private-contribution, aggregate-cell, pattern, validation, intervention, outcome, index, and foreign-key object from `0026`–`0029` match the reviewed canonical definitions.
- Per-user product/order/sales/excluded totals exactly match source queries; the Admin singleton exactly matches users, active subscriptions, captured revenue, and reports.
- All runtime aggregate triggers and every justified `0015` index exist.
- `d1_migrations` and `wrangler d1 migrations list` reflect the approved ledger outcome.
- Authentication, Dashboard, Admin, billing reads, Salla status, CSV empty/error state, video unavailable state, Arabic/English, desktop/mobile, logs, and D1 error metrics pass on the release candidate.

Run these read-only checks after the migration transaction and before Worker deployment:

```sql
PRAGMA foreign_key_check;
PRAGMA quick_check;

SELECT name, type FROM sqlite_schema
WHERE name IN ('admin_audit_log', 'how_it_works_video',
  'user_runtime_summaries', 'runtime_admin_summary')
ORDER BY name;

SELECT name, type, notnull FROM pragma_table_info('how_it_works_video')
ORDER BY cid;

SELECT name FROM sqlite_schema
WHERE type = 'trigger' AND name LIKE 'runtime_%'
ORDER BY name;

SELECT COUNT(*) AS audit_rows FROM admin_audit_log;
SELECT COUNT(*) AS legacy_audit_rows FROM admin_audit_log_legacy_20261001;

SELECT COUNT(*) AS user_summary_mismatches
FROM user_runtime_summaries s
JOIN users u ON u.id = s.user_id
WHERE s.products_count != (SELECT COUNT(*) FROM products p WHERE p.userId = u.id)
   OR s.orders_count != (SELECT COUNT(*) FROM orders o WHERE o.userId = u.id AND COALESCE(o.status, '') NOT IN ('ملغي', 'محذوف', 'ملغى'))
   OR s.sales_halala != (SELECT COALESCE(SUM(o.totalHalala), 0) FROM orders o WHERE o.userId = u.id AND COALESCE(o.status, '') NOT IN ('ملغي', 'محذوف', 'ملغى'))
   OR s.excluded_orders_count != (SELECT COUNT(*) FROM orders o WHERE o.userId = u.id AND COALESCE(o.status, '') IN ('ملغي', 'محذوف', 'ملغى'))
   OR s.excluded_sales_halala != (SELECT COALESCE(SUM(o.totalHalala), 0) FROM orders o WHERE o.userId = u.id AND COALESCE(o.status, '') IN ('ملغي', 'محذوف', 'ملغى'));

SELECT
  users_count = (SELECT COUNT(*) FROM users) AS users_ok,
  active_subscriptions_count = (SELECT COUNT(*) FROM subscriptions WHERE status = 'active') AS subscriptions_ok,
  captured_revenue_halala = (SELECT COALESCE(SUM(amountHalala), 0) FROM payments WHERE status IN ('paid', 'captured', 'completed')) AS revenue_ok,
  reports_count = (SELECT COUNT(*) FROM reports) AS reports_ok
FROM runtime_admin_summary WHERE id = 1;

SELECT id, name, applied_at FROM d1_migrations ORDER BY id;
```

Every equality/mismatch check must return success/zero before deployment.

## Recovery

Application rollback and database recovery are separate decisions. If the new Worker fails but the schema is valid and backward compatible, roll the Worker back first. If the database mutation is corrupt or incompatible, stop writes and restore the captured D1 Time Travel bookmark only after incident approval; this restores the whole database and can discard writes made after the bookmark. SQLite/D1 migrations are not assumed reversible. Keep the legacy audit backup until final production verification, then remove it only in a separately approved cleanup.
