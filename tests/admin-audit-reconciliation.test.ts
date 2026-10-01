import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';

type Statement = {
  run(...values: unknown[]): unknown;
  get(...values: unknown[]): unknown;
  all(...values: unknown[]): unknown[];
};
type Database = {
  exec(sql: string): void;
  prepare(sql: string): Statement;
  close(): void;
};

const nodeRequire = createRequire(import.meta.url);
const { DatabaseSync } = nodeRequire('node:sqlite') as {
  DatabaseSync: new (path: string) => Database;
};
const root = process.cwd();

function migration(name: string): string {
  return readFileSync(path.join(root, 'migrations', name), 'utf8');
}

function apply(db: Database, sql: string) {
  db.exec('BEGIN');
  try {
    db.exec(sql);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function count(db: Database, table: string): number {
  return Number((db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count);
}

function createProductionShape(db: Database) {
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA recursive_triggers = ON;
    CREATE TABLE admin_accounts (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL, password_iterations INTEGER NOT NULL,
      role TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE admin_audit_log (
      id TEXT PRIMARY KEY, adminUserId TEXT NOT NULL, adminEmail TEXT NOT NULL,
      action TEXT NOT NULL, targetType TEXT, targetId TEXT, metadata TEXT,
      createdAt INTEGER NOT NULL
    );
    CREATE INDEX idx_admin_audit_created ON admin_audit_log(createdAt DESC);
    CREATE INDEX idx_admin_audit_target ON admin_audit_log(targetType, targetId);
    CREATE TABLE users (
      id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, plan TEXT DEFAULT 'free',
      planExpiresAt INTEGER, createdAt INTEGER NOT NULL, email_verified INTEGER NOT NULL DEFAULT 0,
      email_verified_at INTEGER, email_verify_token TEXT, email_verify_token_expires_at INTEGER,
      free_reports_used INTEGER DEFAULT 0
    );
    CREATE TABLE sessions (
      sessionId TEXT PRIMARY KEY, userId TEXT NOT NULL, expiresAt INTEGER NOT NULL,
      createdAt INTEGER NOT NULL, FOREIGN KEY(userId) REFERENCES users(id)
    );
    CREATE TABLE otp_rate_limits (
      key_hash TEXT NOT NULL, window_start INTEGER NOT NULL, expires_at INTEGER NOT NULL,
      count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(key_hash, window_start)
    );
    CREATE TABLE subscriptions (
      id TEXT PRIMARY KEY, userId TEXT NOT NULL, planId TEXT NOT NULL, interval TEXT NOT NULL,
      status TEXT NOT NULL, startedAt INTEGER NOT NULL, expiresAt INTEGER NOT NULL,
      createdAt INTEGER NOT NULL, FOREIGN KEY(userId) REFERENCES users(id)
    );
    CREATE TABLE payments (
      id TEXT PRIMARY KEY, userId TEXT NOT NULL, provider TEXT NOT NULL,
      providerPaymentId TEXT UNIQUE, amountHalala INTEGER NOT NULL, currency TEXT NOT NULL,
      planId TEXT, interval TEXT, status TEXT NOT NULL, createdAt INTEGER NOT NULL
    );
    CREATE TABLE store_connections (
      id TEXT PRIMARY KEY, userId TEXT NOT NULL, platform TEXT NOT NULL, status TEXT NOT NULL,
      storeName TEXT, storeUrl TEXT, accessTokenEncrypted TEXT, refreshTokenEncrypted TEXT,
      tokenExpiresAt INTEGER, createdAt INTEGER NOT NULL, FOREIGN KEY(userId) REFERENCES users(id)
    );
    CREATE INDEX idx_store_connections_user_status ON store_connections(userId, status);
    CREATE INDEX idx_store_connections_user_platform ON store_connections(userId, platform);
    CREATE TABLE products (
      id TEXT PRIMARY KEY, userId TEXT NOT NULL, platform TEXT NOT NULL, externalId TEXT,
      title TEXT, sku TEXT, priceHalala INTEGER, inventory INTEGER, category TEXT,
      createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL, reportId TEXT,
      FOREIGN KEY(userId) REFERENCES users(id)
    );
    CREATE TABLE orders (
      id TEXT PRIMARY KEY, userId TEXT NOT NULL, platform TEXT NOT NULL, externalId TEXT,
      reportId TEXT, totalHalala INTEGER, status TEXT, itemsCount INTEGER,
      createdAt INTEGER NOT NULL, FOREIGN KEY(userId) REFERENCES users(id)
    );
    CREATE TABLE reports (
      id TEXT PRIMARY KEY, userId TEXT NOT NULL, storeId TEXT, reportJson TEXT NOT NULL,
      createdAt INTEGER NOT NULL, FOREIGN KEY(userId) REFERENCES users(id)
    );
    CREATE TABLE order_items (
      id TEXT PRIMARY KEY, report_id TEXT NOT NULL, order_id TEXT NOT NULL, sku TEXT,
      product_name TEXT, qty INTEGER NOT NULL, allocated_revenue REAL NOT NULL,
      created_at INTEGER NOT NULL, FOREIGN KEY(report_id) REFERENCES reports(id)
    );
    CREATE INDEX idx_order_items_report ON order_items(report_id);
    CREATE TABLE report_snapshots (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at INTEGER NOT NULL,
      source_hash TEXT NOT NULL, time_range_start INTEGER NOT NULL, time_range_end INTEGER NOT NULL,
      report_id TEXT NOT NULL, gross_sales_halala INTEGER NOT NULL DEFAULT 0,
      orders_count INTEGER NOT NULL DEFAULT 0, total_profit_halala INTEGER NOT NULL DEFAULT 0,
      margin_pct_x100 INTEGER NOT NULL DEFAULT 0, missing_cost_products_count INTEGER NOT NULL DEFAULT 0,
      missing_cost_sales_halala INTEGER NOT NULL DEFAULT 0, report_json TEXT NOT NULL,
      UNIQUE(user_id, source_hash)
    );
  `);

  db.prepare(`INSERT INTO admin_accounts VALUES (?, ?, 'hash', 'salt', 1, 'admin', ?, ?)`)
    .run('admin-1', 'admin@example.test', 1, 1);
  db.prepare('INSERT INTO admin_audit_log VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run('legacy-1', 'admin-1', 'admin@example.test', 'user_viewed', 'user', 'user-1', '{"source":"legacy"}', 1_700_000_001);
  db.prepare('INSERT INTO admin_audit_log VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run('legacy-2', 'retired-admin', 'retired@example.test', 'report_viewed', 'report', 'report-1', '{"retained":true}', 1_700_000_002);

  const user = db.prepare('INSERT INTO users (id,email,createdAt,email_verified) VALUES (?,?,?,1)');
  for (let index = 0; index < 13; index += 1) user.run(`user-${index}`, `user-${index}@example.test`, 1_700_000_000 + index);
  const session = db.prepare('INSERT INTO sessions VALUES (?,?,?,?)');
  for (let index = 0; index < 4; index += 1) session.run(`session-${index}`, `user-${index}`, 2_000_000_000, 1_700_000_000);
  const otp = db.prepare('INSERT INTO otp_rate_limits VALUES (?,?,?,?)');
  for (let index = 0; index < 2; index += 1) otp.run(`otp-${index}`, 1_700_000_000, 2_000_000_000, 1);
  const report = db.prepare('INSERT INTO reports VALUES (?,?,?,?,?)');
  for (let index = 0; index < 75; index += 1) report.run(`report-${index}`, `user-${index % 13}`, null, '{}', 1_700_000_000 + index);
  const product = db.prepare('INSERT INTO products VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
  for (let index = 0; index < 1_022; index += 1) product.run(`product-${index}`, `user-${index % 13}`, 'synthetic', `p-${index}`, `Product ${index}`, `sku-${index}`, 1_000, 1, 'test', 1_700_000_000 + index, 1_700_000_000 + index, null);
  const order = db.prepare('INSERT INTO orders VALUES (?,?,?,?,?,?,?,?,?)');
  for (let index = 0; index < 1_546; index += 1) order.run(`order-${index}`, `user-${index % 13}`, 'synthetic', `o-${index}`, `report-${index % 75}`, 2_000, index % 10 === 0 ? 'ملغي' : 'completed', 1, 1_700_000_000 + index);
  const item = db.prepare('INSERT INTO order_items VALUES (?,?,?,?,?,?,?,?)');
  for (let index = 0; index < 1_671; index += 1) item.run(`item-${index}`, `report-${index % 75}`, `order-${index % 1_546}`, `sku-${index % 1_022}`, `Product ${index % 1_022}`, 1, 20, 1_700_000_000 + index);
  const subscription = db.prepare('INSERT INTO subscriptions VALUES (?,?,?,?,?,?,?,?)');
  subscription.run('subscription-1', 'user-0', 'growth', 'monthly', 'active', 1, 2, 1);
  subscription.run('subscription-2', 'user-1', 'growth', 'monthly', 'expired', 1, 2, 1);
  db.prepare('INSERT INTO payments VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run('payment-1', 'user-0', 'tap', 'tap-1', 10_000, 'SAR', 'growth', 'monthly', 'captured', 1);
  const connection = db.prepare('INSERT INTO store_connections (id,userId,platform,status,createdAt) VALUES (?,?,?,?,?)');
  for (let index = 0; index < 10; index += 1) connection.run(`connection-${index}`, `user-${index}`, 'csv', 'active', 1_700_000_000 + index);
  const snapshot = db.prepare(`INSERT INTO report_snapshots
    (id,user_id,created_at,source_hash,time_range_start,time_range_end,report_id,report_json)
    VALUES (?,?,?,?,?,?,?,?)`);
  for (let index = 0; index < 6; index += 1) snapshot.run(`snapshot-${index}`, `user-${index}`, 1_700_000_000 + index, `hash-${index}`, 1, 2, `report-${index}`, '{}');

  // These objects exist physically in production even though their migration
  // filenames are not in the ledger. Reapplying 0010-0013 must be harmless.
  apply(db, migration('0010_ai_chat_rate_limits.sql'));
  apply(db, migration('0011_ai_usage_ledger.sql'));
  apply(db, migration('0012_salla_easy_mode.sql'));
  apply(db, migration('0013_salla_link_codes.sql'));
  db.prepare(`INSERT INTO salla_connections
    (merchantId,userId,status,updatedAt,lastEventAt,lastEventPriority,tokenVersion,refreshState)
    VALUES (?,?, 'active', ?, 0, 0, 0, 'idle')`).run('merchant-1', 'user-0', 1_700_000_000);
  db.prepare('INSERT INTO salla_link_codes VALUES (?,?,?,?,?,?,?)')
    .run('link-1', 'user-0', 'code-hash', 2_000_000_000, 1_700_000_001, null, 1_700_000_000);
  db.prepare('INSERT INTO salla_link_claims VALUES (?,?,?,?)')
    .run('merchant-1', 'user-0', 'link-1', 1_700_000_001);
}

test('legacy audit bridge preserves data and the complete migration chain succeeds', () => {
  const db = new DatabaseSync(':memory:');
  try {
    createProductionShape(db);
    const watched = ['users', 'sessions', 'subscriptions', 'payments', 'store_connections', 'products', 'orders', 'reports', 'order_items', 'report_snapshots', 'salla_connections', 'salla_link_codes', 'salla_link_claims'];
    const beforeCounts = Object.fromEntries(watched.map((table) => [table, count(db, table)]));
    const beforeAudit = db.prepare('SELECT * FROM admin_audit_log ORDER BY id').all() as Array<Record<string, unknown>>;

    apply(db, migration('production-reconciliation/0008b_reconcile_legacy_admin_audit.sql'));
    for (const name of [
      '0009_admin_portal.sql',
      '0010_ai_chat_rate_limits.sql',
      '0011_ai_usage_ledger.sql',
      '0012_salla_easy_mode.sql',
      '0013_salla_link_codes.sql',
      '0014_how_it_works_video.sql',
      '0015_security_scalability_hardening.sql',
      '0016_runtime_aggregates.sql',
      '0017_youtube_how_it_works_video.sql',
    ]) apply(db, migration(name));

    assert.equal(count(db, 'admin_audit_log'), beforeAudit.length);
    assert.equal(count(db, 'admin_audit_log_legacy_20261001'), beforeAudit.length);
    const canonicalRows = db.prepare(`SELECT id, admin_id, action, target_type, target_id,
      metadata_json, created_at, adminUserId, adminEmail, targetType, targetId, metadata, createdAt
      FROM admin_audit_log ORDER BY id`).all() as Array<Record<string, unknown>>;
    assert.deepEqual(canonicalRows.map(({ id }) => id), ['legacy-1', 'legacy-2']);
    for (const [index, legacy] of beforeAudit.entries()) {
      const reconciled = canonicalRows[index];
      assert.equal(reconciled.id, legacy.id);
      assert.equal(reconciled.adminUserId, legacy.adminUserId);
      assert.equal(reconciled.adminEmail, legacy.adminEmail);
      assert.equal(reconciled.action, legacy.action);
      assert.equal(reconciled.targetType, legacy.targetType);
      assert.equal(reconciled.targetId, legacy.targetId);
      assert.equal(reconciled.metadata, legacy.metadata);
      assert.equal(reconciled.createdAt, legacy.createdAt);
      assert.equal(reconciled.target_type, legacy.targetType);
      assert.equal(reconciled.target_id, legacy.targetId);
      assert.equal(reconciled.metadata_json, legacy.metadata);
      assert.equal(reconciled.created_at, legacy.createdAt);
    }
    assert.equal(canonicalRows[0].admin_id, 'admin-1');
    assert.equal(canonicalRows[1].admin_id, null);
    assert.equal(canonicalRows[1].adminUserId, 'retired-admin');
    assert.equal(canonicalRows[0].metadata_json, '{"source":"legacy"}');
    assert.equal(canonicalRows[0].metadata, '{"source":"legacy"}');
    assert.equal(canonicalRows[0].created_at, 1_700_000_001);
    assert.equal(canonicalRows[0].createdAt, 1_700_000_001);

    db.prepare(`INSERT INTO admin_audit_log
      (id,adminUserId,adminEmail,action,targetType,targetId,metadata,createdAt)
      VALUES (?,?,?,?,?,?,?,?)`).run('old-worker-1', 'admin-1', 'admin@example.test', 'old_event', 'user', 'user-2', '{"old":true}', 1_700_000_003);
    db.prepare(`INSERT INTO admin_audit_log
      (id,admin_id,action,target_type,target_id,ip_hash,metadata_json,created_at)
      VALUES (?,?,?,?,?,?,?,?)`).run('new-worker-1', 'admin-1', 'new_event', 'report', 'report-2', 'ip-hash', '{"new":true}', 1_700_000_004);
    assert.equal(count(db, 'admin_audit_log'), 4);

    const oldRow = db.prepare('SELECT * FROM admin_audit_log WHERE id=?').get('old-worker-1') as Record<string, unknown>;
    assert.equal(oldRow.admin_id, 'admin-1');
    assert.equal(oldRow.metadata_json, '{"old":true}');
    assert.equal(oldRow.created_at, 1_700_000_003);
    const newRow = db.prepare('SELECT * FROM admin_audit_log WHERE id=?').get('new-worker-1') as Record<string, unknown>;
    assert.equal(newRow.adminUserId, 'admin-1');
    assert.equal(newRow.adminEmail, 'admin@example.test');
    assert.equal(newRow.metadata, '{"new":true}');
    assert.equal(newRow.createdAt, 1_700_000_004);

    // Same immutable id is ignored by either compatibility path and cannot duplicate.
    db.prepare(`INSERT INTO admin_audit_log
      (id,adminUserId,adminEmail,action,createdAt) VALUES (?,?,?,?,?)`)
      .run('old-worker-1', 'admin-1', 'admin@example.test', 'duplicate', 1_700_000_005);
    db.prepare(`INSERT INTO admin_audit_log
      (id,admin_id,action,created_at) VALUES (?,?,?,?)`)
      .run('new-worker-1', 'admin-1', 'duplicate', 1_700_000_006);
    assert.equal(count(db, 'admin_audit_log'), 4);

    assert.deepEqual(Object.fromEntries(watched.map((table) => [table, count(db, table)])), beforeCounts);
    assert.equal(count(db, 'user_runtime_summaries'), 13);
    assert.equal(count(db, 'runtime_admin_summary'), 1);
    assert.equal(count(db, 'how_it_works_video'), 0);
    assert.deepEqual(
      db.prepare(`SELECT name FROM pragma_table_info('how_it_works_video') ORDER BY cid`)
        .all().map((column: unknown) => (column as { name: string }).name),
      ['id', 'youtube_video_id', 'youtube_url', 'enabled', 'updated_by', 'created_at', 'updated_at']
    );
    assert.equal((db.prepare(`SELECT COUNT(*) AS count FROM sqlite_schema
      WHERE type='trigger' AND name LIKE 'runtime_%'`).get() as { count: number }).count, 16);
    assert.ok(db.prepare(`SELECT name FROM sqlite_schema WHERE type='index'
      AND name='idx_admin_audit_action_created'`).get());
    assert.equal((db.prepare(`SELECT COUNT(*) AS count FROM (
      SELECT name FROM sqlite_schema WHERE name IS NOT NULL GROUP BY name HAVING COUNT(*) > 1
    )`).get() as { count: number }).count, 0);

    const mismatches = db.prepare(`SELECT COUNT(*) AS count
      FROM user_runtime_summaries s JOIN users u ON u.id=s.user_id
      WHERE s.products_count != (SELECT COUNT(*) FROM products p WHERE p.userId=u.id)
         OR s.orders_count != (SELECT COUNT(*) FROM orders o WHERE o.userId=u.id AND COALESCE(o.status,'') NOT IN ('ملغي','محذوف','ملغى'))
         OR s.sales_halala != (SELECT COALESCE(SUM(o.totalHalala),0) FROM orders o WHERE o.userId=u.id AND COALESCE(o.status,'') NOT IN ('ملغي','محذوف','ملغى'))`).get() as { count: number };
    assert.equal(mismatches.count, 0);
    assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0);
    assert.equal((db.prepare('PRAGMA integrity_check').get() as { integrity_check: string }).integrity_check, 'ok');
  } finally {
    db.close();
  }
});

test('0017 creates the final YouTube table when production skips historical 0014', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(`PRAGMA foreign_keys = ON;
      CREATE TABLE admin_accounts (id TEXT PRIMARY KEY);`);
    apply(db, migration('0017_youtube_how_it_works_video.sql'));
    assert.deepEqual(
      db.prepare(`SELECT name FROM pragma_table_info('how_it_works_video') ORDER BY cid`)
        .all().map((column: unknown) => (column as { name: string }).name),
      ['id', 'youtube_video_id', 'youtube_url', 'enabled', 'updated_by', 'created_at', 'updated_at']
    );
    assert.equal(count(db, 'how_it_works_video'), 0);
    assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0);
  } finally {
    db.close();
  }
});
