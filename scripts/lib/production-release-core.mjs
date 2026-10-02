import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { DatabaseSync } from 'node:sqlite';

export const RELEASE_IDENTITY = Object.freeze({
  accountId: 'e8ae8afc6a6708283d6b0b4534f7c91f',
  profile: 'isaudi',
  worker: 'isaudi',
  database: 'isaudi-db',
  databaseId: '9e19c212-0118-4660-aaeb-e46cc7f4470e',
});

export const EXECUTION_APPROVAL = 'APPLY_ISAUDI_PRODUCTION_D1_RELEASE';
export const APPROVED_EXPECTED_WRITES = 8_582;
export const APPROVED_MAX_WRITES = 9_000;
export const BOOKMARK_MAX_AGE_MS = 10 * 60 * 1_000;

export const BASE_LEDGER_NAMES = Object.freeze([
  '0001_init.sql',
  '0002_add_email_verify_columns.sql',
  '0003_add_global_benchmarks.sql',
  '0004_add_source_to_report_snapshots.sql',
  '0003b_create_report_snapshots_if_missing.sql',
  '0006_add_global_benchmarks_weekly_percentiles.sql',
  '0007_add_beta_invites_usage_counters.sql',
  '0003_add_updatedat_to_subscriptions.sql',
  '0004_subscriptions_userid_unique.sql',
  '0005_add_receipt_to_payments.sql',
  '0006_create_invoices_table.sql',
  '0007_add_reminder_sent_at.sql',
  '0008_add_cancel_at_period_end.sql',
  '0009_add_recurring_fields.sql',
  '0010_add_renewal_safety.sql',
  '0011_add_renewal_retry_fields.sql',
  '0013_payment_audit_log.sql',
  '0014_analysis_foundation.sql',
  '0015_ai_assistant_limits.sql',
  '0016_assistant_credit_purchases.sql',
  '0017_store_connections_foundation.sql',
  '0018_salla_webhook_authorizations.sql',
  '0019_admin_backoffice.sql',
  '0020_admin_phase2.sql',
  '0021_admin_user_flags.sql',
  '0022_tiktok_accounts.sql',
  '0023_tiktok_content_insights.sql',
  '0024_traffic_sessions.sql',
  '0025_market_intelligence.sql',
  '0007_otp_hardening.sql',
  '0008_payment_integrity.sql',
  '0006_create_salla_oauth_states.sql',
]);

export const RELEASE_NAMES = Object.freeze([
  '0008b_reconcile_legacy_admin_audit.sql',
  '0009_admin_portal.sql',
  '0010_ai_chat_rate_limits.sql',
  '0011_ai_usage_ledger.sql',
  '0012_salla_easy_mode.sql',
  '0013_salla_link_codes.sql',
  '0014_how_it_works_video.sql',
  '0015_security_scalability_hardening.sql',
  '0016_runtime_aggregates.sql',
  '0017_youtube_how_it_works_video.sql',
  '0018_ai_usage_metering.sql',
]);

const ROOT = process.cwd();
const WATCHED_TABLES = Object.freeze([
  'users',
  'sessions',
  'otp_rate_limits',
  'store_connections',
  'products',
  'orders',
  'order_items',
  'reports',
  'report_snapshots',
  'subscriptions',
  'payments',
  'admin_accounts',
  'admin_sessions',
  'admin_audit_log',
  'ai_usage_ledger',
  'ai_chat_rate_limits',
  'salla_connections',
  'salla_link_codes',
  'salla_link_claims',
]);

const PREEXISTING_RELEASE_OBJECTS = Object.freeze([
  'table:admin_accounts',
  'index:idx_admin_single_super_admin',
  'table:admin_sessions',
  'index:idx_admin_sessions_admin',
  'table:admin_rate_limits',
  'index:idx_admin_rate_limits_expiry',
  'table:admin_password_resets',
  'table:admin_transfer_requests',
  'index:idx_admin_transfers_pending',
  'table:ai_chat_rate_limits',
  'index:idx_ai_chat_rate_limits_expiry',
  'index:idx_ai_usage_user_operation_created',
  'index:idx_ai_usage_active_leases',
  'table:salla_connections',
  'index:idx_salla_connections_merchant',
  'index:idx_salla_connections_user',
  'index:idx_salla_connections_one_merchant_per_user',
  'index:idx_salla_connections_authorizer_email',
  'table:salla_link_codes',
  'index:idx_salla_link_codes_one_active_per_user',
  'index:idx_salla_link_codes_expiry',
  'table:salla_link_claims',
  'index:idx_salla_link_claims_user',
  'trigger:trg_salla_connection_owner_immutable',
]);

const AUDIT_LEGACY_OBJECTS = Object.freeze([
  'table:admin_audit_log',
  'index:idx_admin_audit_created',
  'index:idx_admin_audit_target',
]);

const AUDIT_BRIDGE_OBJECTS = Object.freeze([
  'table:admin_audit_log',
  'table:admin_audit_log_legacy_20261001',
  'trigger:admin_audit_bridge_legacy_insert',
  'trigger:admin_audit_bridge_canonical_insert',
  'index:idx_admin_audit_created',
  'index:idx_admin_audit_target',
  'index:idx_admin_audit_legacy_created',
  'index:idx_admin_audit_legacy_target',
  'index:idx_admin_audit_backup_created_20261001',
  'index:idx_admin_audit_backup_target_20261001',
]);

const RUNTIME_OBJECTS = Object.freeze([
  'table:user_runtime_summaries',
  'table:runtime_admin_summary',
  'trigger:runtime_user_summary_user_insert',
  'trigger:runtime_user_summary_user_delete',
  'trigger:runtime_user_summary_product_insert',
  'trigger:runtime_user_summary_product_delete',
  'trigger:runtime_user_summary_product_move',
  'trigger:runtime_user_summary_order_insert',
  'trigger:runtime_user_summary_order_delete',
  'trigger:runtime_user_summary_order_update',
  'trigger:runtime_admin_subscription_insert',
  'trigger:runtime_admin_subscription_delete',
  'trigger:runtime_admin_subscription_update',
  'trigger:runtime_admin_payment_insert',
  'trigger:runtime_admin_payment_delete',
  'trigger:runtime_admin_payment_update',
  'trigger:runtime_admin_report_insert',
  'trigger:runtime_admin_report_delete',
]);

export const AI_METERING_COLUMNS = Object.freeze([
  'id',
  'user_id',
  'operation',
  'status',
  'created_at',
  'lease_expires_at',
  'finalized_at',
  'model',
  'report_id',
  'source_hash',
  'input_tokens',
  'output_tokens',
  'total_tokens',
  'cached_input_tokens',
  'cache_write_tokens',
]);

const BASE_AI_COLUMNS = Object.freeze(AI_METERING_COLUMNS.slice(0, 7));

function fail(message) {
  throw new Error(`Production release safety check failed: ${message}`);
}

function migration(relativePath) {
  return readFileSync(path.join(ROOT, 'migrations', relativePath), 'utf8');
}

export function normalizeSchemaSql(sql) {
  return String(sql ?? '')
    .replace(/\bIF\s+NOT\s+EXISTS\b/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*;\s*$/, '')
    .trim()
    .toLowerCase();
}

function objectMap(rows) {
  return Object.fromEntries(
    rows
      .filter((row) => row.name && !String(row.name).startsWith('sqlite_'))
      .map((row) => [`${row.type}:${row.name}`, {
        type: row.type,
        name: row.name,
        table: row.tbl_name,
        sql: normalizeSchemaSql(row.sql),
      }]),
  );
}

function columnNames(columns, table) {
  return (columns[table] ?? []).map((column) => column.name);
}

function assertSameObject(actual, expected, key) {
  const actualObject = actual[key];
  const expectedObject = expected[key];
  if (!actualObject || !expectedObject) fail(`required schema object ${key} is missing`);
  if (actualObject.table !== expectedObject.table || actualObject.sql !== expectedObject.sql) {
    fail(`schema object ${key} differs from the verified definition`);
  }
}

function assertObjectSet(actual, expected, keys) {
  for (const key of keys) assertSameObject(actual, expected, key);
}

function hardeningStatements() {
  const statements = migration('0015_security_scalability_hardening.sql')
    .match(/CREATE(?:\s+UNIQUE)?\s+INDEX[\s\S]*?;/gi) ?? [];
  return Object.fromEntries(statements.map((sql) => {
    const match = sql.match(/INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z0-9_]+)/i);
    if (!match) fail('could not parse a hardening index name');
    return [match[1], sql.trim()];
  }));
}

export const HARDENING_INDEX_SQL = Object.freeze(hardeningStatements());
export const HARDENING_INDEX_NAMES = Object.freeze(Object.keys(HARDENING_INDEX_SQL));

function schemaRows(db) {
  return db.prepare(`SELECT type,name,tbl_name,sql FROM sqlite_schema
    WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name`).all();
}

function tableColumns(db, table) {
  return db.prepare(`SELECT cid,name,type,"notnull" AS not_null,dflt_value,pk
    FROM pragma_table_info(?) ORDER BY cid`).all(table);
}

function tableCount(db, table) {
  return Number(db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count);
}

export function inspectLocalDatabase(db) {
  const objects = objectMap(schemaRows(db));
  const columns = {};
  for (const table of [
    'd1_migrations',
    'admin_audit_log',
    'admin_audit_log_legacy_20261001',
    'ai_usage_ledger',
    'user_runtime_summaries',
    'runtime_admin_summary',
    'how_it_works_video',
  ]) columns[table] = tableColumns(db, table);

  const counts = Object.fromEntries(WATCHED_TABLES.map((table) => [table, tableCount(db, table)]));
  counts.users_email_verify_token_non_null = Number(
    db.prepare('SELECT COUNT(*) AS count FROM users WHERE email_verify_token IS NOT NULL').get().count,
  );
  counts.user_runtime_summaries = objects['table:user_runtime_summaries']
    ? tableCount(db, 'user_runtime_summaries')
    : 0;
  counts.runtime_admin_summary = objects['table:runtime_admin_summary']
    ? tableCount(db, 'runtime_admin_summary')
    : 0;
  counts.admin_audit_log_legacy_20261001 = objects['table:admin_audit_log_legacy_20261001']
    ? tableCount(db, 'admin_audit_log_legacy_20261001')
    : 0;

  const runtimePresent = Boolean(objects['table:user_runtime_summaries'] && objects['table:runtime_admin_summary']);
  const aggregateMismatches = runtimePresent
    ? Number(db.prepare(`SELECT COUNT(*) AS count
        FROM user_runtime_summaries summary JOIN users user ON user.id=summary.user_id
        WHERE summary.products_count != (SELECT COUNT(*) FROM products product WHERE product.userId=user.id)
           OR summary.orders_count != (SELECT COUNT(*) FROM orders item WHERE item.userId=user.id AND COALESCE(item.status,'') NOT IN ('ملغي','محذوف','ملغى'))
           OR summary.sales_halala != (SELECT COALESCE(SUM(item.totalHalala),0) FROM orders item WHERE item.userId=user.id AND COALESCE(item.status,'') NOT IN ('ملغي','محذوف','ملغى'))
           OR summary.excluded_orders_count != (SELECT COUNT(*) FROM orders item WHERE item.userId=user.id AND COALESCE(item.status,'') IN ('ملغي','محذوف','ملغى'))
           OR summary.excluded_sales_halala != (SELECT COALESCE(SUM(item.totalHalala),0) FROM orders item WHERE item.userId=user.id AND COALESCE(item.status,'') IN ('ملغي','محذوف','ملغى'))`).get().count)
    : null;

  return {
    identity: { ...RELEASE_IDENTITY },
    objects,
    columns,
    ledger: db.prepare('SELECT id,name,applied_at FROM d1_migrations ORDER BY id').all(),
    ledgerIndexes: db.prepare(`SELECT name,"unique" AS is_unique FROM pragma_index_list('d1_migrations') ORDER BY name`).all(),
    counts,
    aggregateMismatches,
    foreignKeyViolations: db.prepare('PRAGMA foreign_key_check').all().length,
    integrity: db.prepare('PRAGMA integrity_check').get().integrity_check,
  };
}

function createProductionSchema(db) {
  db.exec(`
    PRAGMA foreign_keys=ON;
    PRAGMA recursive_triggers=ON;
    CREATE TABLE d1_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
    CREATE TABLE admin_audit_log (
      id TEXT PRIMARY KEY,
      adminUserId TEXT NOT NULL,
      adminEmail TEXT NOT NULL,
      action TEXT NOT NULL,
      targetType TEXT,
      targetId TEXT,
      metadata TEXT,
      createdAt INTEGER NOT NULL
    );
    CREATE INDEX idx_admin_audit_created ON admin_audit_log(createdAt DESC);
    CREATE INDEX idx_admin_audit_target ON admin_audit_log(targetType, targetId);
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      plan TEXT DEFAULT 'free',
      planExpiresAt INTEGER,
      createdAt INTEGER NOT NULL,
      email_verified INTEGER NOT NULL DEFAULT 0,
      email_verified_at INTEGER,
      email_verify_token TEXT,
      email_verify_token_expires_at INTEGER,
      free_reports_used INTEGER DEFAULT 0
    );
    CREATE TABLE sessions (
      sessionId TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      expiresAt INTEGER NOT NULL,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY(userId) REFERENCES users(id)
    );
    CREATE TABLE otp_rate_limits (
      key_hash TEXT NOT NULL,
      window_start INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(key_hash,window_start)
    );
    CREATE TABLE subscriptions (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      planId TEXT NOT NULL,
      interval TEXT NOT NULL,
      status TEXT NOT NULL,
      startedAt INTEGER NOT NULL,
      expiresAt INTEGER NOT NULL,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY(userId) REFERENCES users(id)
    );
    CREATE TABLE payments (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      provider TEXT NOT NULL,
      providerPaymentId TEXT UNIQUE,
      amountHalala INTEGER NOT NULL,
      currency TEXT NOT NULL,
      planId TEXT,
      interval TEXT,
      status TEXT NOT NULL,
      createdAt INTEGER NOT NULL
    );
    CREATE TABLE store_connections (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      platform TEXT NOT NULL,
      status TEXT NOT NULL,
      storeName TEXT,
      storeUrl TEXT,
      accessTokenEncrypted TEXT,
      refreshTokenEncrypted TEXT,
      tokenExpiresAt INTEGER,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY(userId) REFERENCES users(id)
    );
    CREATE INDEX idx_store_connections_user_status ON store_connections(userId,status);
    CREATE INDEX idx_store_connections_user_platform ON store_connections(userId,platform);
    CREATE TABLE products (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      platform TEXT NOT NULL,
      externalId TEXT,
      title TEXT,
      sku TEXT,
      priceHalala INTEGER,
      inventory INTEGER,
      category TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      reportId TEXT,
      FOREIGN KEY(userId) REFERENCES users(id)
    );
    CREATE TABLE orders (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      platform TEXT NOT NULL,
      externalId TEXT,
      reportId TEXT,
      totalHalala INTEGER,
      status TEXT,
      itemsCount INTEGER,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY(userId) REFERENCES users(id)
    );
    CREATE TABLE reports (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      storeId TEXT,
      reportJson TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY(userId) REFERENCES users(id)
    );
    CREATE TABLE order_items (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL,
      order_id TEXT NOT NULL,
      sku TEXT,
      product_name TEXT,
      qty INTEGER NOT NULL,
      allocated_revenue REAL NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(report_id) REFERENCES reports(id)
    );
    CREATE INDEX idx_order_items_report ON order_items(report_id);
    CREATE TABLE report_snapshots (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      source_hash TEXT NOT NULL,
      time_range_start INTEGER NOT NULL,
      time_range_end INTEGER NOT NULL,
      report_id TEXT NOT NULL,
      gross_sales_halala INTEGER NOT NULL DEFAULT 0,
      orders_count INTEGER NOT NULL DEFAULT 0,
      total_profit_halala INTEGER NOT NULL DEFAULT 0,
      margin_pct_x100 INTEGER NOT NULL DEFAULT 0,
      missing_cost_products_count INTEGER NOT NULL DEFAULT 0,
      missing_cost_sales_halala INTEGER NOT NULL DEFAULT 0,
      report_json TEXT NOT NULL,
      UNIQUE(user_id,source_hash)
    );
  `);
  for (const name of BASE_LEDGER_NAMES) {
    db.prepare('INSERT INTO d1_migrations(name) VALUES (?)').run(name);
  }
  for (const name of [
    '0009_admin_portal.sql',
    '0010_ai_chat_rate_limits.sql',
    '0011_ai_usage_ledger.sql',
    '0012_salla_easy_mode.sql',
    '0013_salla_link_codes.sql',
  ]) db.exec(migration(name));
}

function seedProductionCardinality(db, auditRows = 0) {
  const user = db.prepare(`INSERT INTO users
    (id,email,plan,createdAt,email_verified,email_verify_token) VALUES (?,?,?,?,1,?)`);
  for (let index = 0; index < 13; index += 1) {
    user.run(`user-${index}`, `user-${index}@example.test`, index < 2 ? 'growth' : 'free', 1_700_000_000 + index, index < 10 ? `verify-${index}` : null);
  }
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
  const connection = db.prepare('INSERT INTO store_connections (id,userId,platform,status,createdAt) VALUES (?,?,?,?,?)');
  for (let index = 0; index < 10; index += 1) connection.run(`connection-${index}`, `user-${index}`, 'csv', 'active', 1_700_000_000 + index);
  const snapshot = db.prepare(`INSERT INTO report_snapshots
    (id,user_id,created_at,source_hash,time_range_start,time_range_end,report_id,report_json)
    VALUES (?,?,?,?,?,?,?,?)`);
  for (let index = 0; index < 6; index += 1) snapshot.run(`snapshot-${index}`, `user-${index}`, 1_700_000_000 + index, `hash-${index}`, 1, 2, `report-${index}`, '{}');
  db.prepare('INSERT INTO subscriptions VALUES (?,?,?,?,?,?,?,?)').run('subscription-1', 'user-0', 'growth', 'monthly', 'active', 1, 2, 1);
  db.prepare('INSERT INTO subscriptions VALUES (?,?,?,?,?,?,?,?)').run('subscription-2', 'user-1', 'growth', 'monthly', 'expired', 1, 2, 1);
  db.prepare('INSERT INTO payments VALUES (?,?,?,?,?,?,?,?,?,?)').run('payment-1', 'user-0', 'tap', 'tap-1', 10_000, 'SAR', 'growth', 'monthly', 'captured', 1);
  db.prepare(`INSERT INTO salla_connections
    (merchantId,userId,status,updatedAt,lastEventAt,lastEventPriority,tokenVersion,refreshState)
    VALUES (?,?, 'active', ?, 0, 0, 0, 'idle')`).run('merchant-1', 'user-0', 1_700_000_000);
  db.prepare('INSERT INTO salla_link_codes VALUES (?,?,?,?,?,?,?)').run('link-1', 'user-0', 'code-hash', 2_000_000_000, 1_700_000_001, null, 1_700_000_000);
  db.prepare('INSERT INTO salla_link_claims VALUES (?,?,?,?)').run('merchant-1', 'user-0', 'link-1', 1_700_000_001);

  const audit = db.prepare(`INSERT INTO admin_audit_log
    (id,adminUserId,adminEmail,action,targetType,targetId,metadata,createdAt)
    VALUES (?,?,?,?,?,?,?,?)`);
  for (let index = 0; index < auditRows; index += 1) {
    audit.run(`legacy-${index}`, `retired-${index}`, `retired-${index}@example.test`, 'report_viewed', 'report', `report-${index}`, '{"synthetic":true}', 1_700_000_100 + index);
  }
}

export function createProductionRehearsalDatabase({ auditRows = 0, withData = true } = {}) {
  const db = new DatabaseSync(':memory:');
  createProductionSchema(db);
  if (withData) seedProductionCardinality(db, auditRows);
  return db;
}

function applyMigrationAndLedger(db, name, sql) {
  db.exec('BEGIN');
  try {
    db.exec(sql);
    db.prepare('INSERT INTO d1_migrations(name) VALUES (?)').run(name);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function expectedStates() {
  const baselineDb = createProductionRehearsalDatabase({ withData: false });
  const finalDb = createProductionRehearsalDatabase({ withData: false });
  try {
    const baseline = inspectLocalDatabase(baselineDb);
    applyMigrationAndLedger(finalDb, RELEASE_NAMES[0], migration('production-reconciliation/0008b_reconcile_legacy_admin_audit.sql'));
    for (const name of RELEASE_NAMES.slice(1, 7)) applyMigrationAndLedger(finalDb, name, 'SELECT 1;');
    applyMigrationAndLedger(finalDb, RELEASE_NAMES[7], migration(RELEASE_NAMES[7]));
    applyMigrationAndLedger(finalDb, RELEASE_NAMES[8], migration(RELEASE_NAMES[8]));
    applyMigrationAndLedger(finalDb, RELEASE_NAMES[9], migration(RELEASE_NAMES[9]));
    applyMigrationAndLedger(finalDb, RELEASE_NAMES[10], migration(RELEASE_NAMES[10]));
    return { baseline, final: inspectLocalDatabase(finalDb) };
  } finally {
    baselineDb.close();
    finalDb.close();
  }
}

let cachedExpectedStates;
function getExpectedStates() {
  cachedExpectedStates ??= expectedStates();
  return cachedExpectedStates;
}

export function assertIdentity(identity) {
  if (!identity || identity.mode !== 'production') fail('explicit production mode is required');
  for (const [key, expected] of Object.entries(RELEASE_IDENTITY)) {
    if (identity[key] !== expected) fail(`${key} must be ${expected}`);
  }
}

export function assertExecutionApproval({ execute, approval, bookmark, bookmarkCapturedAt, now = Date.now() }) {
  if (!execute) fail('the production execution flag is required');
  if (approval !== EXECUTION_APPROVAL) fail('explicit production approval phrase is missing');
  if (!bookmark || typeof bookmark !== 'string' || bookmark.trim().length < 8) fail('a fresh Time Travel bookmark is required');
  const captured = Date.parse(bookmarkCapturedAt ?? '');
  if (!Number.isFinite(captured)) fail('the Time Travel bookmark capture timestamp is invalid');
  const age = now - captured;
  if (age < -60_000 || age > BOOKMARK_MAX_AGE_MS) fail('the Time Travel bookmark is not fresh');
}

function releasePrefixLength(ledgerNames) {
  if (ledgerNames.length < BASE_LEDGER_NAMES.length) fail('migration ledger is shorter than the verified baseline');
  for (let index = 0; index < BASE_LEDGER_NAMES.length; index += 1) {
    if (ledgerNames[index] !== BASE_LEDGER_NAMES[index]) fail(`unexpected baseline ledger entry at position ${index + 1}`);
  }
  const releaseRows = ledgerNames.slice(BASE_LEDGER_NAMES.length);
  for (let index = 0; index < releaseRows.length; index += 1) {
    if (releaseRows[index] !== RELEASE_NAMES[index]) fail(`release ledger is not an exact ordered prefix at ${releaseRows[index]}`);
  }
  if (releaseRows.length > RELEASE_NAMES.length) fail('unexpected migration ledger rows follow the approved release');
  return releaseRows.length;
}

function assertLedgerSchema(state) {
  const columns = state.columns.d1_migrations ?? [];
  const actual = columns.map((column) => ({
    name: column.name,
    type: String(column.type).toUpperCase(),
    notNull: Number(column.not_null ?? column.notnull ?? 0),
    primaryKey: Number(column.pk ?? 0),
  }));
  const expected = [
    { name: 'id', type: 'INTEGER', notNull: 0, primaryKey: 1 },
    { name: 'name', type: 'TEXT', notNull: 0, primaryKey: 0 },
    { name: 'applied_at', type: 'TIMESTAMP', notNull: 1, primaryKey: 0 },
  ];
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail('d1_migrations schema differs or contains unexpected checksum/metadata columns');
  if (!(state.ledgerIndexes ?? []).some((index) => Number(index.is_unique ?? index.unique) === 1)) {
    fail('d1_migrations.name is not protected by a unique index');
  }
}

function assertSchemaForProgress(state, prefixLength) {
  const expected = getExpectedStates();
  assertObjectSet(state.objects, expected.baseline.objects, PREEXISTING_RELEASE_OBJECTS);

  const meteringApplied = prefixLength >= 11;
  assertSameObject(
    state.objects,
    meteringApplied ? expected.final.objects : expected.baseline.objects,
    'table:ai_usage_ledger',
  );

  if (prefixLength >= 1) assertObjectSet(state.objects, expected.final.objects, AUDIT_BRIDGE_OBJECTS);
  else {
    assertObjectSet(state.objects, expected.baseline.objects, AUDIT_LEGACY_OBJECTS);
    for (const key of AUDIT_BRIDGE_OBJECTS.filter((key) => !AUDIT_LEGACY_OBJECTS.includes(key))) {
      if (state.objects[key]) fail(`audit bridge object ${key} exists without its ledger entry`);
    }
  }

  const hardeningApplied = prefixLength >= 8;
  for (const name of HARDENING_INDEX_NAMES) {
    const key = `index:${name}`;
    if (state.objects[key]) assertSameObject(state.objects, expected.final.objects, key);
    else if (hardeningApplied) fail(`hardening index ${name} is missing after 0015`);
  }

  const runtimeApplied = prefixLength >= 9;
  const runtimePresent = RUNTIME_OBJECTS.filter((key) => state.objects[key]);
  if (!runtimeApplied && runtimePresent.length !== 0) fail('runtime aggregate schema is partially present without 0016 ledger state');
  if (runtimeApplied) assertObjectSet(state.objects, expected.final.objects, RUNTIME_OBJECTS);

  const videoApplied = prefixLength >= 10;
  if (videoApplied) assertSameObject(state.objects, expected.final.objects, 'table:how_it_works_video');
  else if (state.objects['table:how_it_works_video']) fail('historical 0014 video table must remain absent before 0017');

  const meteringColumns = columnNames(state.columns, 'ai_usage_ledger');
  const expectedColumns = meteringApplied ? AI_METERING_COLUMNS : BASE_AI_COLUMNS;
  if (JSON.stringify(meteringColumns) !== JSON.stringify(expectedColumns)) fail('AI usage metering columns do not match the release ledger state');
}

export function assertReleaseState(state) {
  assertIdentity({ ...state.identity, mode: 'production' });
  assertLedgerSchema(state);
  const prefixLength = releasePrefixLength(state.ledger.map((row) => row.name));
  assertSchemaForProgress(state, prefixLength);
  for (const [name, count] of Object.entries(state.counts ?? {})) {
    if (!Number.isSafeInteger(Number(count)) || Number(count) < 0) fail(`invalid row count for ${name}`);
  }
  return prefixLength;
}

function indexWriteRows(name, counts) {
  const tableByIndex = {
    idx_sessions_expires_at: 'sessions',
    idx_admin_sessions_expires_at: 'admin_sessions',
    idx_otp_rate_limits_expires_at: 'otp_rate_limits',
    idx_store_connections_user_status: 'store_connections',
    idx_store_connections_user_platform: 'store_connections',
    idx_products_user_external_updated: 'products',
    idx_products_user_sku_updated: 'products',
    idx_orders_user_external: 'orders',
    idx_orders_user_created: 'orders',
    idx_orders_user_status_created: 'orders',
    idx_reports_user_created: 'reports',
    idx_order_items_order: 'order_items',
    idx_order_items_report: 'order_items',
    idx_report_snapshots_user_end: 'report_snapshots',
    idx_report_snapshots_user_source: 'report_snapshots',
    idx_users_created_at: 'users',
    idx_subscriptions_created_at: 'subscriptions',
    idx_payments_created_at: 'payments',
    idx_store_connections_created_at: 'store_connections',
    idx_reports_created_at: 'reports',
    idx_admin_audit_action_created: 'admin_audit_log',
  };
  if (name === 'idx_users_email_verify_token') return Number(counts.users_email_verify_token_non_null ?? 0);
  const table = tableByIndex[name];
  if (!table) fail(`write budget has no table mapping for ${name}`);
  return Number(counts[table] ?? 0);
}

export function calculateWriteBudget(state, steps) {
  const names = new Set(steps.map((step) => step.name));
  const missingIndexes = steps.find((step) => step.name === '0015_security_scalability_hardening.sql')?.indexNames ?? [];
  const auditRows = names.has(RELEASE_NAMES[0]) ? Number(state.counts.admin_audit_log ?? 0) : 0;
  const auditBridge = auditRows * 8;
  const indexes = missingIndexes.reduce((sum, name) => sum + indexWriteRows(name, state.counts), 0);
  const aggregates = names.has('0016_runtime_aggregates.sql') ? Number(state.counts.users ?? 0) + 1 : 0;
  const ledger = steps.length;
  const result = {
    auditBridge,
    indexes,
    aggregates,
    migrationLedger: ledger,
    videoTable: 0,
    aiMetering: 0,
    otherDdlDataAccounting: 0,
  };
  const total = Object.values(result).reduce((sum, value) => sum + value, 0);
  return { ...result, total };
}

function ledgerOnlySql(name, reason) {
  const safeAlias = `release_${name.replace(/[^A-Za-z0-9_]/g, '_')}`;
  return `-- ${reason}\nSELECT 1 AS ${safeAlias};\n`;
}

export function buildReleasePlan(state) {
  const prefixLength = assertReleaseState(state);
  const pending = RELEASE_NAMES.slice(prefixLength);
  const steps = pending.map((name) => {
    if (name === RELEASE_NAMES[0]) {
      return { name, kind: 'audit_bridge', sql: migration('production-reconciliation/0008b_reconcile_legacy_admin_audit.sql') };
    }
    if (RELEASE_NAMES.slice(1, 6).includes(name)) {
      return { name, kind: 'ledger_reconciliation', sql: ledgerOnlySql(name, 'Schema already exists and was verified equivalent; record only.') };
    }
    if (name === '0014_how_it_works_video.sql') {
      return { name, kind: 'explicit_skip', skipped: true, sql: ledgerOnlySql(name, 'Historical Cloudflare Stream migration is intentionally skipped. YouTube is created by 0017.') };
    }
    if (name === '0015_security_scalability_hardening.sql') {
      const indexNames = HARDENING_INDEX_NAMES.filter((indexName) => !state.objects[`index:${indexName}`]);
      const sql = indexNames.length > 0
        ? `${indexNames.map((indexName) => HARDENING_INDEX_SQL[indexName]).join('\n')}\n`
        : ledgerOnlySql(name, 'All hardening indexes already exist and were verified equivalent; record only.');
      return { name, kind: 'missing_indexes_only', indexNames, sql };
    }
    return { name, kind: 'schema_migration', sql: migration(name) };
  });
  const writeBudget = calculateWriteBudget(state, steps);
  if (writeBudget.total > APPROVED_MAX_WRITES) fail(`expected writes ${writeBudget.total} exceed approved maximum ${APPROVED_MAX_WRITES}`);
  if (prefixLength === 0 && Math.abs(writeBudget.total - APPROVED_EXPECTED_WRITES) > 100) {
    fail(`expected writes ${writeBudget.total} materially differ from approved estimate ${APPROVED_EXPECTED_WRITES}`);
  }
  return {
    prefixLength,
    steps,
    writeBudget,
    explicitlySkipped: '0014_how_it_works_video.sql',
    workerDeploymentIncluded: false,
  };
}

export function applyReleasePlanLocally(db, plan) {
  for (const step of plan.steps) applyMigrationAndLedger(db, step.name, step.sql);
}

export function verifyFinalReleaseState(state) {
  const prefixLength = assertReleaseState(state);
  if (prefixLength !== RELEASE_NAMES.length) fail('release ledger is incomplete');
  if (state.aggregateMismatches !== 0) fail(`runtime aggregate mismatches: ${state.aggregateMismatches}`);
  if (state.foreignKeyViolations !== 0) fail(`foreign-key violations: ${state.foreignKeyViolations}`);
  if (state.integrity !== 'ok') fail(`integrity_check returned ${state.integrity}`);
  if (Number(state.counts.user_runtime_summaries) !== Number(state.counts.users)) {
    fail('runtime user summary count does not match users');
  }
  if (Number(state.counts.runtime_admin_summary) !== 1) fail('runtime Admin summary singleton is missing');
  if (Number(state.counts.admin_audit_log_legacy_20261001) !== Number(state.counts.admin_audit_log)) {
    fail('audit backup count does not match the compatibility table');
  }
  return true;
}

export function watchedCounts(state) {
  return Object.fromEntries(WATCHED_TABLES.map((name) => [name, Number(state.counts[name] ?? 0)]));
}
