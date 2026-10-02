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
export const APPROVED_EXPECTED_WRITES = 11_162;
export const APPROVED_MAX_WRITES = 12_000;
export const BOOKMARK_MAX_AGE_MS = 10 * 60 * 1_000;
const APPROVED_CUMULATIVE_WRITES_BY_PREFIX = Object.freeze([
  0, 1, 2, 3, 4, 5, 6, 7, 8_565, 8_580, 8_581, 8_582, 11_162,
]);

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
  '0019_admin_observability.sql',
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

export const AI_OBSERVABILITY_COLUMNS = Object.freeze([
  ...AI_METERING_COLUMNS,
  'plan',
  'latency_ms',
  'failure_kind',
  'provider_status',
]);

const AI_USAGE_LEDGER_COLUMN_DEFINITIONS = Object.freeze([
  { name: 'id', type: 'TEXT', notNull: 0, defaultValue: null, primaryKey: 1, hidden: 0 },
  { name: 'user_id', type: 'TEXT', notNull: 1, defaultValue: null, primaryKey: 0, hidden: 0 },
  { name: 'operation', type: 'TEXT', notNull: 1, defaultValue: null, primaryKey: 0, hidden: 0 },
  { name: 'status', type: 'TEXT', notNull: 1, defaultValue: null, primaryKey: 0, hidden: 0 },
  { name: 'created_at', type: 'INTEGER', notNull: 1, defaultValue: null, primaryKey: 0, hidden: 0 },
  { name: 'lease_expires_at', type: 'INTEGER', notNull: 1, defaultValue: null, primaryKey: 0, hidden: 0 },
  { name: 'finalized_at', type: 'INTEGER', notNull: 0, defaultValue: null, primaryKey: 0, hidden: 0 },
  { name: 'model', type: 'TEXT', notNull: 0, defaultValue: null, primaryKey: 0, hidden: 0 },
  { name: 'report_id', type: 'TEXT', notNull: 0, defaultValue: null, primaryKey: 0, hidden: 0 },
  { name: 'source_hash', type: 'TEXT', notNull: 0, defaultValue: null, primaryKey: 0, hidden: 0 },
  { name: 'input_tokens', type: 'INTEGER', notNull: 0, defaultValue: null, primaryKey: 0, hidden: 0 },
  { name: 'output_tokens', type: 'INTEGER', notNull: 0, defaultValue: null, primaryKey: 0, hidden: 0 },
  { name: 'total_tokens', type: 'INTEGER', notNull: 0, defaultValue: null, primaryKey: 0, hidden: 0 },
  { name: 'cached_input_tokens', type: 'INTEGER', notNull: 0, defaultValue: null, primaryKey: 0, hidden: 0 },
  { name: 'cache_write_tokens', type: 'INTEGER', notNull: 0, defaultValue: null, primaryKey: 0, hidden: 0 },
  { name: 'plan', type: 'TEXT', notNull: 0, defaultValue: null, primaryKey: 0, hidden: 0 },
  { name: 'latency_ms', type: 'INTEGER', notNull: 0, defaultValue: null, primaryKey: 0, hidden: 0 },
  { name: 'failure_kind', type: 'TEXT', notNull: 0, defaultValue: null, primaryKey: 0, hidden: 0 },
  { name: 'provider_status', type: 'INTEGER', notNull: 0, defaultValue: null, primaryKey: 0, hidden: 0 },
]);

const AI_USAGE_LEDGER_INDEX_DEFINITIONS = Object.freeze([
  { name: 'idx_ai_usage_active_leases', unique: 0, origin: 'c', partial: 0, columns: ['user_id', 'operation', 'status', 'lease_expires_at'] },
  { name: 'idx_ai_usage_user_operation_created', unique: 0, origin: 'c', partial: 0, columns: ['user_id', 'operation', 'created_at'] },
  { name: 'sqlite_autoindex_ai_usage_ledger_1', unique: 1, origin: 'pk', partial: 0, columns: ['id'] },
]);

const AI_USAGE_LEDGER_STATUS_CHECK = "statusin('reserved','succeeded','failed')";

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
  return db.prepare(`SELECT cid,name,type,"notnull" AS not_null,dflt_value,pk,hidden
    FROM pragma_table_xinfo(?) ORDER BY cid`).all(table);
}

function canonicalizeCheckExpression(expression) {
  let result = '';
  for (let index = 0; index < expression.length;) {
    const character = expression[index];
    if (/\s/.test(character)) {
      index += 1;
      continue;
    }
    if (character === "'") {
      let literal = character;
      index += 1;
      while (index < expression.length) {
        literal += expression[index];
        if (expression[index] === "'") {
          if (expression[index + 1] === "'") {
            literal += expression[index + 1];
            index += 2;
            continue;
          }
          index += 1;
          break;
        }
        index += 1;
      }
      result += literal;
      continue;
    }
    if (character === '"' || character === '`' || character === '[') {
      const closing = character === '[' ? ']' : character;
      let identifier = '';
      index += 1;
      while (index < expression.length && expression[index] !== closing) {
        identifier += expression[index];
        index += 1;
      }
      if (expression[index] === closing) index += 1;
      result += identifier.toLowerCase();
      continue;
    }
    result += character.toLowerCase();
    index += 1;
  }
  return result;
}

export function extractCheckConstraints(sql) {
  const source = String(sql ?? '');
  const checks = [];
  let quote = null;
  for (let index = 0; index < source.length;) {
    const character = source[index];
    if (quote) {
      if (character === quote) {
        if (source[index + 1] === quote && quote !== ']') index += 2;
        else {
          quote = null;
          index += 1;
        }
      } else index += 1;
      continue;
    }
    if (character === "'" || character === '"' || character === '`' || character === '[') {
      quote = character === '[' ? ']' : character;
      index += 1;
      continue;
    }
    const match = source.slice(index).match(/^check\b/i);
    if (!match) {
      index += 1;
      continue;
    }
    let cursor = index + match[0].length;
    while (/\s/.test(source[cursor] ?? '')) cursor += 1;
    if (source[cursor] !== '(') {
      index = cursor;
      continue;
    }
    const start = cursor + 1;
    let depth = 1;
    let innerQuote = null;
    cursor += 1;
    for (; cursor < source.length && depth > 0; cursor += 1) {
      const inner = source[cursor];
      if (innerQuote) {
        if (inner === innerQuote) {
          if (source[cursor + 1] === innerQuote && innerQuote !== ']') cursor += 1;
          else innerQuote = null;
        }
      } else if (inner === "'" || inner === '"' || inner === '`' || inner === '[') {
        innerQuote = inner === '[' ? ']' : inner;
      } else if (inner === '(') depth += 1;
      else if (inner === ')') depth -= 1;
    }
    if (depth !== 0) fail('ai_usage_ledger contains an unterminated CHECK constraint');
    checks.push(canonicalizeCheckExpression(source.slice(start, cursor - 1)));
    index = cursor;
  }
  return checks;
}

export function normalizeAiUsageLedgerColumn(column) {
  return {
    name: String(column.name),
    type: String(column.type ?? '').trim().replace(/\s+/g, ' ').toUpperCase(),
    notNull: Number(column.not_null ?? column.notnull ?? 0),
    defaultValue: column.dflt_value == null ? null : String(column.dflt_value).trim(),
    primaryKey: Number(column.pk ?? 0),
    hidden: Number(column.hidden ?? 0),
  };
}

function localAiUsageLedgerSchema(db, objects, columns) {
  const indexes = db.prepare(`SELECT seq,name,"unique" AS is_unique,origin,partial
    FROM pragma_index_list('ai_usage_ledger') ORDER BY name`).all().map((index) => ({
    name: index.name,
    unique: Number(index.is_unique),
    origin: index.origin,
    partial: Number(index.partial),
    columns: db.prepare('SELECT name FROM pragma_index_info(?) ORDER BY seqno').all(index.name).map((column) => column.name),
  }));
  const tableOptions = db.prepare(`SELECT wr,strict FROM pragma_table_list WHERE name='ai_usage_ledger'`).get();
  return {
    exists: Boolean(objects['table:ai_usage_ledger']),
    columns: (columns.ai_usage_ledger ?? []).map(normalizeAiUsageLedgerColumn),
    foreignKeys: db.prepare(`SELECT id,seq,"table","from","to",on_update,on_delete,"match"
      FROM pragma_foreign_key_list('ai_usage_ledger') ORDER BY id,seq`).all(),
    indexes,
    checks: extractCheckConstraints(objects['table:ai_usage_ledger']?.sql),
    triggers: Object.values(objects)
      .filter((object) => object.type === 'trigger' && object.table === 'ai_usage_ledger')
      .map((object) => object.name)
      .sort(),
    withoutRowId: Number(tableOptions?.wr ?? 0),
    strict: Number(tableOptions?.strict ?? 0),
  };
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
    'admin_ai_usage_daily',
    'admin_observability_summary',
    'admin_plan_summary',
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
  counts.admin_ai_usage_daily = objects['table:admin_ai_usage_daily']
    ? tableCount(db, 'admin_ai_usage_daily')
    : 0;
  counts.admin_observability_summary = objects['table:admin_observability_summary']
    ? tableCount(db, 'admin_observability_summary')
    : 0;
  counts.admin_plan_summary = objects['table:admin_plan_summary']
    ? tableCount(db, 'admin_plan_summary')
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
    aiUsageLedgerSchema: localAiUsageLedgerSchema(db, objects, columns),
    ledger: db.prepare('SELECT id,name,applied_at FROM d1_migrations ORDER BY id').all(),
    ledgerIndexes: db.prepare(`SELECT name,"unique" AS is_unique FROM pragma_index_list('d1_migrations') ORDER BY name`).all(),
    counts,
    aggregateMismatches,
    foreignKeyViolations: db.prepare('PRAGMA foreign_key_check').all().length,
    quickCheck: db.prepare('PRAGMA quick_check').get().quick_check,
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
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER,
      processedAt INTEGER,
      integrityError TEXT,
      processingToken TEXT,
      receiptClaimedAt INTEGER,
      receiptLeaseToken TEXT
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
    CREATE INDEX idx_store_connections_user_status ON store_connections(userId, status);
    CREATE INDEX idx_store_connections_user_platform ON store_connections(userId, platform);
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
  db.prepare(`INSERT INTO payments
    (id,userId,provider,providerPaymentId,amountHalala,currency,planId,interval,status,createdAt)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run('payment-1', 'user-0', 'tap', 'tap-1', 10_000, 'SAR', 'growth', 'monthly', 'captured', 1);
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
    for (const name of RELEASE_NAMES.slice(7)) {
      applyMigrationAndLedger(finalDb, name, migration(name));
    }
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

export function assertAiUsageLedgerSemanticSchema(schema, prefixLength) {
  if (!schema?.exists) fail('required table ai_usage_ledger is missing');
  const expectedColumnCount = prefixLength >= 12 ? 19 : prefixLength >= 11 ? 15 : 7;
  const expectedColumns = AI_USAGE_LEDGER_COLUMN_DEFINITIONS.slice(0, expectedColumnCount);
  if (JSON.stringify(schema.columns) !== JSON.stringify(expectedColumns)) {
    fail('ai_usage_ledger semantic columns differ from the verified definition');
  }
  if ((schema.foreignKeys ?? []).length !== 0) {
    fail('ai_usage_ledger contains an unexpected foreign key');
  }
  const indexes = [...(schema.indexes ?? [])]
    .map((index) => ({
      name: String(index.name),
      unique: Number(index.unique ?? index.is_unique ?? 0),
      origin: String(index.origin ?? ''),
      partial: Number(index.partial ?? 0),
      columns: (index.columns ?? []).map(String),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
  if (JSON.stringify(indexes) !== JSON.stringify(AI_USAGE_LEDGER_INDEX_DEFINITIONS)) {
    fail('ai_usage_ledger indexes or unique constraints differ from the verified definition');
  }
  if (JSON.stringify(schema.checks ?? []) !== JSON.stringify([AI_USAGE_LEDGER_STATUS_CHECK])) {
    fail('ai_usage_ledger CHECK constraints differ from the verified definition');
  }
  const expectedTriggers = prefixLength >= 12 ? ['admin_ai_usage_finalize'] : [];
  if (JSON.stringify(schema.triggers ?? []) !== JSON.stringify(expectedTriggers)) {
    fail('ai_usage_ledger triggers differ from the release ledger state');
  }
  if (Number(schema.withoutRowId ?? 0) !== 0 || Number(schema.strict ?? 0) !== 0) {
    fail('ai_usage_ledger has unexpected table options');
  }
  return true;
}

function assertSchemaForProgress(state, prefixLength) {
  const expected = getExpectedStates();
  assertObjectSet(state.objects, expected.baseline.objects, PREEXISTING_RELEASE_OBJECTS);

  const observabilityApplied = prefixLength >= 12;
  assertAiUsageLedgerSemanticSchema(state.aiUsageLedgerSchema, prefixLength);

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

  const observabilityKeys = Object.keys(expected.final.objects).filter((key) =>
    key === 'table:admin_ai_usage_daily' ||
    key === 'table:admin_observability_summary' ||
    key === 'table:admin_plan_summary' ||
    key === 'trigger:admin_ai_usage_finalize' ||
    key.startsWith('trigger:admin_obs_') ||
    key === 'index:idx_admin_ai_usage_daily_range' ||
    key === 'index:idx_sessions_created_at' ||
    key === 'index:idx_salla_connections_updated_at' ||
    key === 'index:idx_products_platform_updated_at' ||
    key === 'index:idx_orders_platform_created_at'
  );
  const observabilityPresent = observabilityKeys.filter((key) => state.objects[key]);
  if (!observabilityApplied && observabilityPresent.length !== 0) {
    fail('Admin observability schema is partially present without 0019 ledger state');
  }
  if (observabilityApplied) {
    assertObjectSet(state.objects, expected.final.objects, observabilityKeys);
    for (const table of ['admin_ai_usage_daily', 'admin_observability_summary', 'admin_plan_summary']) {
      if (JSON.stringify(columnNames(state.columns, table)) !== JSON.stringify(columnNames(expected.final.columns, table))) {
        fail(`${table} columns differ from the verified 0019 definition`);
      }
    }
  }
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
  const observabilityIndexes = names.has('0019_admin_observability.sql')
    ? [
        ['idx_sessions_created_at', 'sessions'],
        ['idx_salla_connections_updated_at', 'salla_connections'],
        ['idx_products_platform_updated_at', 'products'],
        ['idx_orders_platform_created_at', 'orders'],
      ].reduce((sum, [index, table]) => sum + (state.objects[`index:${index}`] ? 0 : Number(state.counts[table] ?? 0)), 0)
    : 0;
  const observabilityRows = names.has('0019_admin_observability.sql') ? 6 : 0;
  const aiObservabilityBackfillUpperBound = names.has('0019_admin_observability.sql')
    ? Number(state.counts.ai_usage_ledger ?? 0) * 3
    : 0;
  const ledger = steps.length;
  const result = {
    auditBridge,
    indexes,
    aggregates,
    migrationLedger: ledger,
    videoTable: 0,
    aiMetering: 0,
    adminObservabilityIndexes: observabilityIndexes,
    adminObservabilityRows: observabilityRows,
    aiObservabilityBackfillUpperBound,
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
  const remainingWriteBudget = calculateWriteBudget(state, steps);
  const priorEstimatedWrites = APPROVED_CUMULATIVE_WRITES_BY_PREFIX[prefixLength];
  const cumulativeEstimatedWrites = priorEstimatedWrites + remainingWriteBudget.total;
  const expectedRemainingWrites = APPROVED_EXPECTED_WRITES - priorEstimatedWrites;
  if (cumulativeEstimatedWrites > APPROVED_MAX_WRITES) {
    fail(`cumulative expected writes ${cumulativeEstimatedWrites} exceed approved maximum ${APPROVED_MAX_WRITES}`);
  }
  if (Math.abs(remainingWriteBudget.total - expectedRemainingWrites) > 100) {
    fail(`remaining expected writes ${remainingWriteBudget.total} materially differ from approved estimate ${expectedRemainingWrites}`);
  }
  const writeBudget = { ...remainingWriteBudget, priorEstimatedWrites, cumulativeEstimatedWrites };
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
  if (state.quickCheck !== 'ok') fail(`quick_check returned ${state.quickCheck}`);
  if (Number(state.counts.user_runtime_summaries) !== Number(state.counts.users)) {
    fail('runtime user summary count does not match users');
  }
  if (Number(state.counts.runtime_admin_summary) !== 1) fail('runtime Admin summary singleton is missing');
  if (Number(state.counts.admin_observability_summary) !== 1) fail('Admin observability summary singleton is missing');
  if (Number(state.counts.admin_plan_summary) !== 5) fail('Admin plan summary does not contain the five reviewed plan buckets');
  if (Number(state.counts.admin_audit_log_legacy_20261001) !== Number(state.counts.admin_audit_log)) {
    fail('audit backup count does not match the compatibility table');
  }
  return true;
}

export function watchedCounts(state) {
  return Object.fromEntries(WATCHED_TABLES.map((name) => [name, Number(state.counts[name] ?? 0)]));
}
