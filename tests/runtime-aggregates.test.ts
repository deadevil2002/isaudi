import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
// @ts-expect-error Node 22 provides node:sqlite; the project intentionally retains Node 20 type declarations.
import { DatabaseSync } from 'node:sqlite';

const schema = readFileSync(new URL('../db/d1-schema.sql', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../migrations/0016_runtime_aggregates.sql', import.meta.url), 'utf8');

type SqliteStatement = {
  run(...values: unknown[]): unknown;
  get(...values: unknown[]): Record<string, number>;
};
type SqliteDatabase = { exec(sql: string): void; prepare(sql: string): SqliteStatement };

function database(): SqliteDatabase {
  const db = new DatabaseSync(':memory:') as SqliteDatabase;
  db.exec(schema);
  return db;
}

function user(db: SqliteDatabase, id: string) {
  db.prepare(`INSERT INTO users (id,email,plan,createdAt,free_reports_used,email_verified)
    VALUES (?,?,'free',1,0,1)`).run(id, `${id}@example.test`);
}

function product(db: SqliteDatabase, id: string, userId: string, platform = 'csv') {
  db.prepare(`INSERT INTO products (id,userId,platform,externalId,title,sku,priceHalala,inventory,createdAt,updatedAt)
    VALUES (?,?,?,?,?,?,100,1,1,1)`).run(id, userId, platform, id, id, id);
}

function order(db: SqliteDatabase, id: string, userId: string, total: number | null, status: string | null, platform = 'csv') {
  db.prepare(`INSERT INTO orders (id,userId,platform,externalId,totalHalala,status,itemsCount,createdAt)
    VALUES (?,?,?,?,?,?,1,1)`).run(id, userId, platform, id, total, status);
}

function summary(db: SqliteDatabase, userId: string) {
  return db.prepare(`SELECT products_count, orders_count, sales_halala,
    excluded_orders_count, excluded_sales_halala
    FROM user_runtime_summaries WHERE user_id = ?`).get(userId);
}

function legacy(db: SqliteDatabase, userId: string) {
  return db.prepare(`SELECT
    (SELECT COUNT(*) FROM products WHERE userId = ?) products_count,
    COALESCE(SUM(CASE WHEN COALESCE(status,'') NOT IN ('ملغي','محذوف','ملغى') THEN 1 ELSE 0 END),0) orders_count,
    COALESCE(SUM(CASE WHEN COALESCE(status,'') NOT IN ('ملغي','محذوف','ملغى') THEN totalHalala ELSE 0 END),0) sales_halala,
    COALESCE(SUM(CASE WHEN COALESCE(status,'') IN ('ملغي','محذوف','ملغى') THEN 1 ELSE 0 END),0) excluded_orders_count,
    COALESCE(SUM(CASE WHEN COALESCE(status,'') IN ('ملغي','محذوف','ملغى') THEN totalHalala ELSE 0 END),0) excluded_sales_halala
    FROM orders WHERE userId = ?`).get(userId, userId);
}

test('0016 backfills exact legacy totals including excluded, null, and zero-order users', () => {
  const db = database();
  user(db, 'existing');
  user(db, 'zero');
  product(db, 'p1', 'existing');
  order(db, 'o1', 'existing', 12_500, 'completed');
  order(db, 'o2', 'existing', 5_000, 'ملغي');
  order(db, 'o3', 'existing', 7_000, 'محذوف');
  order(db, 'o4', 'existing', null, null);
  db.exec(migration);
  assert.deepEqual(summary(db, 'existing'), legacy(db, 'existing'));
  assert.deepEqual(summary(db, 'zero'), legacy(db, 'zero'));
  db.exec(migration);
  assert.deepEqual(summary(db, 'existing'), legacy(db, 'existing'), 'migration rerun is idempotent');
});

test('CSV and Salla inserts, replacements, updates, deletes, and duplicate failures stay exact', () => {
  const db = database();
  user(db, 'tenant');
  db.exec(migration);
  product(db, 'csv-product', 'tenant', 'csv');
  product(db, 'salla-product', 'tenant', 'salla');
  order(db, 'csv-order', 'tenant', 10_000, 'completed', 'csv');
  order(db, 'salla-order', 'tenant', 20_000, 'ملغى', 'salla');
  assert.deepEqual(summary(db, 'tenant'), legacy(db, 'tenant'));

  db.prepare(`UPDATE orders SET totalHalala = 25_000, status = 'completed' WHERE id = 'salla-order'`).run();
  db.prepare(`UPDATE products SET title = 'replacement' WHERE id = 'csv-product'`).run();
  assert.deepEqual(summary(db, 'tenant'), legacy(db, 'tenant'));

  assert.throws(() => order(db, 'csv-order', 'tenant', 99_999, 'completed', 'csv'));
  assert.deepEqual(summary(db, 'tenant'), legacy(db, 'tenant'), 'failed duplicate is not counted');

  db.prepare(`DELETE FROM orders WHERE id = 'csv-order'`).run();
  db.prepare(`DELETE FROM products WHERE id = 'salla-product'`).run();
  assert.deepEqual(summary(db, 'tenant'), legacy(db, 'tenant'));
});

test('admin exact counters follow user, subscription, payment, and report mutations', () => {
  const db = database();
  db.exec(migration);
  user(db, 'admin-counted-user');
  db.prepare(`INSERT INTO subscriptions (id,userId,planId,interval,status,startedAt,expiresAt,createdAt)
    VALUES ('s','admin-counted-user','growth','month','pending',1,2,1)`).run();
  db.prepare(`UPDATE subscriptions SET status = 'active' WHERE id = 's'`).run();
  db.prepare(`INSERT INTO payments (id,userId,provider,amountHalala,currency,status,createdAt)
    VALUES ('p','admin-counted-user','tap',39900,'SAR','pending',1)`).run();
  db.prepare(`UPDATE payments SET status = 'captured' WHERE id = 'p'`).run();
  db.prepare(`UPDATE payments SET amountHalala = 49900 WHERE id = 'p'`).run();
  db.prepare(`INSERT INTO reports (id,userId,reportJson,createdAt) VALUES ('r','admin-counted-user','{}',1)`).run();

  assert.deepEqual({ ...db.prepare(`SELECT users_count, active_subscriptions_count,
    captured_revenue_halala, reports_count FROM runtime_admin_summary WHERE id=1`).get() }, {
    users_count: 1,
    active_subscriptions_count: 1,
    captured_revenue_halala: 49_900,
    reports_count: 1,
  });

  db.prepare(`UPDATE subscriptions SET status = 'canceled' WHERE id = 's'`).run();
  db.prepare(`UPDATE payments SET status = 'failed' WHERE id = 'p'`).run();
  db.prepare(`DELETE FROM reports WHERE id = 'r'`).run();
  assert.deepEqual({ ...db.prepare(`SELECT active_subscriptions_count, captured_revenue_halala,
    reports_count FROM runtime_admin_summary WHERE id=1`).get() }, {
    active_subscriptions_count: 0,
    captured_revenue_halala: 0,
    reports_count: 0,
  });
});

test('dashboard fallback is a persisted guarded rebuild, not a recurring scan', () => {
  const source = readFileSync(new URL('../src/lib/db/service.ts', import.meta.url), 'utf8');
  const stats = source.match(/getStoreStats:[\s\S]*?\/\/ Costs identity helpers/)?.[0] || '';
  assert.match(stats, /FROM user_runtime_summaries WHERE user_id = \?/);
  assert.match(stats, /WHERE NOT EXISTS \(SELECT 1 FROM user_runtime_summaries WHERE user_id = \?\)/);
  assert.match(stats, /ON CONFLICT\(user_id\) DO NOTHING/);
});

test('Admin overview is a single-row exact aggregate read', () => {
  const route = readFileSync(new URL('../src/app/admin/api/[action]/route.ts', import.meta.url), 'utf8');
  const portal = route.match(/async function portalData[\s\S]*?const ADMIN_SECTIONS/)?.[0] || '';
  assert.match(portal, /FROM runtime_admin_summary WHERE id = 1/);
  assert.doesNotMatch(portal, /COUNT\(\*\)|SUM\(amountHalala\)/);
});

test('public shells are build-time assets and signed video remains a no-store API read', () => {
  for (const relative of ['../src/app/page.tsx', '../src/app/pricing/page.tsx', '../src/app/how-it-works/page.tsx']) {
    const page = readFileSync(new URL(relative, import.meta.url), 'utf8');
    assert.match(page, /dynamic = ['"]force-static['"]/);
    assert.match(page, /revalidate = false/);
    assert.doesNotMatch(page, /cookies\(|getCurrentUser|getUserEntitlements/);
  }
  const layout = readFileSync(new URL('../src/app/layout.tsx', import.meta.url), 'utf8');
  const videoRoute = readFileSync(new URL('../src/app/api/public/how-it-works-video/route.ts', import.meta.url), 'utf8');
  const openNext = readFileSync(new URL('../open-next.config.ts', import.meta.url), 'utf8');
  const prepareAssets = readFileSync(new URL('../scripts/prepare-cloudflare-assets.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(layout, /cookies\(/);
  assert.match(videoRoute, /Cache-Control', 'no-store'/);
  assert.match(openNext, /staticAssetsIncrementalCache/);
  assert.match(openNext, /enableCacheInterception: true/);
  assert.match(prepareAssets, /'pricing', 'how-it-works'/);
});
