# Production D1 migration runbook (prepare only)

Status: **not approved for execution**. Verified 2026-10-01. Production remained read-only while this runbook was prepared.

## Verified starting point

- Account/profile: `e8ae8afc6a6708283d6b0b4534f7c91f` / `isaudi`
- Worker: `isaudi`
- D1: `isaudi-db` / `9e19c212-0118-4660-aaeb-e46cc7f4470e`
- Canonical `0009`–`0017` are reported pending by Wrangler; `0014` is historical
  Stream schema and is explicitly excluded from the production execution set.
- Objects from `0009`–`0013` mostly already exist from a different historical ledger.
- `how_it_works_video`, `user_runtime_summaries`, and `runtime_admin_summary` are absent.
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
5. An isolated `0016` rehearsal on the same production copy created 13 user summaries, one exact Admin summary, and all 16 runtime triggers. Source-table row counts were unchanged, aggregate comparisons had zero mismatches, `PRAGMA integrity_check` was `ok`, and `PRAGMA foreign_key_check` returned no rows.
6. Local-only implementation is `migrations/production-reconciliation/0008b_reconcile_legacy_admin_audit.sql`. A representative rehearsal used the verified production cardinalities (13 users, 1,022 products, 1,546 orders, 1,671 items, and the remaining verified table counts), legacy audit fixtures, foreign keys, and recursive triggers. The bridge followed by `0009`–`0013`, skipped `0014`, then applied `0015`–`0017`; it passed with unchanged business counts, exact audit projections, exact runtime aggregates, 16 runtime triggers, the final YouTube video schema, integrity `ok`, and no foreign-key violations.
7. The bridge is isolated behind `wrangler.production-reconciliation.toml`; normal production and staging migration discovery cannot include it accidentally. It requires the verified legacy camelCase table and must not run against a canonical database. After a fresh preflight, apply that one-file migration explicitly with the reconciliation config, then apply only the approved production set: `0009`–`0013`, `0015`, `0016`, and `0017`. Do not execute `0014` on production. Reconcile the migration ledger through the separately approved release procedure; do not make an ad-hoc ledger edit.

## Required Admin audit compatibility bridge

This bridge is implemented and locally rehearsed, but is not approved for remote execution.

1. In one transaction, rename the legacy table to a dated backup and drop its two index-name collisions.
2. Create `admin_audit_log` with both legacy columns (`adminUserId`, `adminEmail`, `targetType`, `targetId`, `metadata`, `createdAt`) and canonical columns (`admin_id`, `target_type`, `target_id`, `ip_hash`, `metadata_json`, `created_at`). Keep `id` as the primary key and `action` required; require at least one timestamp representation.
3. Copy every legacy row while populating both representations. Populate `admin_id` only when `adminUserId` matches `admin_accounts.id`; otherwise preserve attribution in the legacy fields and use `NULL` for the foreign key.
4. Add two recursion-safe `BEFORE INSERT` normalization triggers on the bridge table so the deployed legacy Worker can write legacy fields and the new Worker can write canonical fields. The nested row has both projections and uses the same immutable primary key with `INSERT OR IGNORE`; therefore recursive trigger mode cannot loop and a reused ID cannot duplicate. No UPDATE or DELETE synchronization is installed because the application audit path is append-only.
5. Recreate a canonical `idx_admin_audit_created` on `created_at`, retain a separately named legacy `createdAt` index, and retain the legacy target index. Migration `0015` then adds `idx_admin_audit_action_created` safely.
6. Verify old/new projections, row-count equality, primary-key equality, trigger behavior, and foreign keys locally. Keep the backup table through the Worker rollback window. Remove bridge columns, triggers, and the backup only in a later separately approved cleanup.

## Expected write budget

`0016` creates 13 per-user summary rows plus one Admin summary row at the verified cardinality; its triggers do not fire during that initial backfill. The 19 missing `0015` indexes cover 8,557 current row/index entries. The last read-only audit count was zero, so the reviewed data/index/ledger estimate remains approximately 8,580 writes: 8,557 index entries, 14 aggregate rows, and nine approved migration-ledger rows (`0008b`, `0009`–`0013`, and `0015`–`0017`), excluding provider-specific schema accounting. `0017` carries no legacy Stream UID forward and creates no video row. If the fresh preflight finds `N` audit rows, add the bridge copy and index work for those `N` rows and reapprove the budget before execution.

## Execution order after separate approval

1. Freeze production-changing jobs and confirm no CSV, Salla sync, billing mutation, report generation, or Admin mutation is running.
2. Repeat account/resource/schema preflight and capture the Time Travel bookmark.
3. Apply only `0008b_reconcile_legacy_admin_audit.sql` through `wrangler.production-reconciliation.toml` with profile `isaudi`. Abort unless Wrangler lists exactly that one reconciliation file and the legacy-schema precondition is still exact. It preserves both legacy and canonical write/read contracts and records its filename in `d1_migrations`.
4. Apply the approved production files in this exact order: `0009`–`0013`, skip `0014`, then `0015`, `0016`, and `0017`. Migration `0014` remains immutable history but must not execute on production; `0017` independently creates the final YouTube schema and also replaces the Stream table in environments where `0014` was historically applied. Use only the separately approved ledger-safe release procedure.
5. Run all schema, bridge, aggregate, and data-safety checks before deploying application code.
6. Deploy the reviewed new Worker only after checks pass. The current Worker remains compatible through `0016` because the bridge retains legacy columns. Applying `0017` removes the legacy Stream columns, so freeze traffic or deploy the reviewed new Worker immediately after final schema verification; do not leave the old Worker serving video-management requests after `0017`. The new Worker requires the final YouTube `how_it_works_video` table and both runtime summary tables. Never deploy the new Worker before the schema, and never replace the audit table with a canonical-only version while rollback to the old Worker remains possible.
7. Under separate production approval, configure a strong
   `ADMIN_BOOTSTRAP_TOKEN` with `wrangler secret put` after the production
   identity preflight. Never place it in a command argument, file, log, or Git.
   Create the first independent Admin only after the new Worker is live, verify
   that setup is then closed and reuse is rejected, and remove the bootstrap
   secret in a separately approved follow-up after the Admin login is verified.
8. Run the listed smoke tests, monitor Worker/D1 errors, and retain the audit
   bridge plus legacy backup throughout the rollback window.

Cloudflare Stream availability is not a release dependency. The final application
does not require `CLOUDFLARE_STREAM_API_TOKEN`,
`CLOUDFLARE_STREAM_CUSTOMER_CODE`, a Stream subscription, or a Stream upload.

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
- Per-user product/order/sales/excluded totals exactly match source queries; the Admin singleton exactly matches users, active subscriptions, captured revenue, and reports.
- All runtime aggregate triggers and every justified `0015` index exist.
- `d1_migrations` and `wrangler d1 migrations list` reflect the approved ledger outcome.
- Authentication, Dashboard, Admin, billing reads, Salla status, CSV empty/error state, video unavailable state, Arabic/English, desktop/mobile, logs, and D1 error metrics pass on the release candidate.

Run these read-only checks after the migration transaction and before Worker deployment:

```sql
PRAGMA foreign_key_check;
PRAGMA integrity_check;

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
