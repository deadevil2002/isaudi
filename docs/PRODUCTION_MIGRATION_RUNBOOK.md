# Production D1 migration runbook (prepare only)

Status: **not approved for execution**. Verified 2026-10-01. Production remained read-only while this runbook was prepared.

## Verified starting point

- Account/profile: `e8ae8afc6a6708283d6b0b4534f7c91f` / `isaudi`
- Worker: `isaudi`
- D1: `isaudi-db` / `9e19c212-0118-4660-aaeb-e46cc7f4470e`
- Canonical `0009`–`0016` are reported pending by Wrangler.
- Objects from `0009`–`0013` mostly already exist from a different historical ledger.
- `how_it_works_video`, `user_runtime_summaries`, and `runtime_admin_summary` are absent.
- Production `admin_audit_log` is legacy camelCase (`adminUserId`, `targetType`, `targetId`, `metadata`, `createdAt`). Current code requires the canonical snake_case table. `0015` would fail on `created_at` if applied first.
- Read-only counts used for budgeting: 13 users, 4 sessions, 2 OTP rate rows, 10 store connections, 1,022 products, 1,546 orders, 1,671 order items, 75 reports, 6 snapshots, 2 subscriptions, 1 payment, and 0 Admin audit rows.

## Mandatory preflight

1. Check out the exact reviewed release commit on `new-ui-migration`; do not use `main`.
2. Run `npm run cf:preflight:production`. Abort unless account, profile, Worker, D1 name, and D1 ID exactly match the values above.
3. Run `npx wrangler d1 migrations list isaudi-db --remote --config ./wrangler.toml` and re-query `sqlite_schema` plus `d1_migrations`. Abort on any change from the reviewed schema until the diff is reviewed again.
4. Confirm the application version being prepared accepts both the pre-migration production schema (while the old Worker is live) and the final canonical schema, or schedule a maintenance window that prevents incompatible traffic.

## Backup and rehearsal

1. Export a schema-only snapshot with `wrangler d1 export ... --remote --no-data` to an access-controlled temporary location. Do not commit it.
2. Capture a fresh Time Travel bookmark immediately before the mutation window with `wrangler d1 time-travel info isaudi-db --config ./wrangler.toml --json`. Store the bookmark securely outside Git.
3. Rehearse on a disposable local database built from the exported schema and representative, synthetic cardinalities. Do not copy customer data into source control.
4. The rehearsal must first reconcile `admin_audit_log`: preserve the old table under a dated backup name, remove legacy index-name collisions, create the canonical table, copy and map legacy columns, and retain `admin_id` only when it references an existing canonical Admin account. Verify row counts and metadata before continuing.
5. Rehearse the complete canonical `0009`–`0016` chain after that reconciliation. Verify that `0009`–`0013` are idempotent, `0014` creates video state, `0015` creates every expected index, and `0016` backfills exact aggregates and installs every trigger.
6. Resolve the ledger strategy before production. Do not manually edit `d1_migrations` without a reviewed, Cloudflare-supported baseline procedure. Do not mix direct SQL and `migrations apply` in a way that leaves the ledger ambiguous.

## Expected write budget

`0016` should create 13 per-user summary rows plus one Admin summary row at the verified cardinality. The missing indexes cover roughly 10,000 existing index entries, dominated by products, orders, and order items; D1 billing metadata may count these differently. The rehearsal must record actual `rows_written` for each step. Abort if measured writes materially exceed the reviewed rehearsal result or if table cardinalities have materially changed.

## Execution order after separate approval

1. Freeze production-changing jobs and confirm no CSV, Salla sync, billing mutation, report generation, or Admin mutation is running.
2. Repeat account/resource/schema preflight and capture the Time Travel bookmark.
3. Execute the reviewed Admin audit reconciliation transaction/script.
4. Apply the rehearsed canonical chain in the exact order `0009` through `0016` using the approved ledger strategy.
5. Run post-migration checks before deploying application code.
6. Deploy the reviewed Worker version only after schema checks pass; never use a command that also targets another account or database.

## Abort conditions

- Any account/profile/name/ID mismatch.
- Migration ledger or schema changed since rehearsal.
- Non-zero foreign-key violations, failed statements, unexpected table/index replacement, or audit row-count mismatch.
- `rows_written` materially above rehearsal, D1 errors/overload, or an active write-producing workflow.
- Aggregate totals differ from source totals, required triggers/indexes are absent, or the new Worker is not compatible with the resulting schema.

## Post-migration verification

- `PRAGMA foreign_key_check` returns no rows.
- Canonical `admin_audit_log` columns and both expected indexes exist; preserved legacy backup count equals the copied count until final sign-off.
- `how_it_works_video`, `user_runtime_summaries`, and `runtime_admin_summary` exist.
- Per-user product/order/sales/excluded totals exactly match source queries; the Admin singleton exactly matches users, active subscriptions, captured revenue, and reports.
- All runtime aggregate triggers and every justified `0015` index exist.
- `d1_migrations` and `wrangler d1 migrations list` reflect the approved ledger outcome.
- Authentication, Dashboard, Admin, billing reads, Salla status, CSV empty/error state, video unavailable state, Arabic/English, desktop/mobile, logs, and D1 error metrics pass on the release candidate.

## Recovery

Application rollback and database recovery are separate decisions. If the new Worker fails but the schema is valid and backward compatible, roll the Worker back first. If the database mutation is corrupt or incompatible, stop writes and restore the captured D1 Time Travel bookmark only after incident approval; this restores the whole database and can discard writes made after the bookmark. SQLite/D1 migrations are not assumed reversible. Keep the legacy audit backup until final production verification, then remove it only in a separately approved cleanup.
