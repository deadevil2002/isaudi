import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import {
  RELEASE_IDENTITY,
  assertExecutionApproval,
  assertIdentity,
  assertReleaseState,
  buildReleasePlan,
  extractCheckConstraints,
  normalizeAiUsageLedgerColumn,
  verifyFinalReleaseState,
  watchedCounts,
} from './lib/production-release-core.mjs';

const WRANGLER = path.join(process.cwd(), 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const CONFIG = path.join(process.cwd(), 'wrangler.toml');
const COUNT_TABLES = [
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
];

function fail(message) {
  throw new Error(`Production release runner failed: ${message}`);
}

function parseArguments(argv) {
  const args = { mode: null, action: null };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--mode') {
      args.mode = argv[index + 1];
      index += 1;
    } else if (value === '--plan') args.action = args.action ? 'invalid' : 'plan';
    else if (value === '--execute') args.action = args.action ? 'invalid' : 'execute';
    else fail(`unknown argument ${value}`);
  }
  if (args.mode !== 'production') fail('--mode production is required');
  if (!['plan', 'execute'].includes(args.action)) fail('choose exactly one of --plan or --execute');
  return args;
}

function fixedEnvironment() {
  const configuredProfile = process.env.CLOUDFLARE_PROFILE?.trim();
  if (configuredProfile && configuredProfile !== RELEASE_IDENTITY.profile) {
    fail(`CLOUDFLARE_PROFILE must be ${RELEASE_IDENTITY.profile}`);
  }
  const configuredAccount = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  if (configuredAccount && configuredAccount !== RELEASE_IDENTITY.accountId) {
    fail(`CLOUDFLARE_ACCOUNT_ID must be ${RELEASE_IDENTITY.accountId}`);
  }
  return {
    ...process.env,
    CI: 'true',
    CLOUDFLARE_PROFILE: RELEASE_IDENTITY.profile,
    CLOUDFLARE_ACCOUNT_ID: RELEASE_IDENTITY.accountId,
  };
}

function runNode(args) {
  return execFileSync(process.execPath, args, {
    cwd: process.cwd(),
    env: fixedEnvironment(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function runPreflight() {
  runNode(['scripts/assert-cloudflare-account.mjs', 'production']);
}

function runWrangler(args) {
  return runNode([WRANGLER, ...args]);
}

function parseJsonOutput(output, label) {
  try {
    return JSON.parse(output);
  } catch {
    fail(`${label} did not return machine-readable JSON`);
  }
}

function query(sql) {
  const payload = parseJsonOutput(runWrangler([
    'd1',
    'execute',
    RELEASE_IDENTITY.database,
    '--remote',
    '--config',
    CONFIG,
    '--profile',
    RELEASE_IDENTITY.profile,
    '--yes',
    '--json',
    '--command',
    sql,
  ]), 'D1 query');
  const result = Array.isArray(payload) ? payload[0] : payload;
  if (!result?.success || !Array.isArray(result.results)) fail('D1 read-only query failed');
  if (Number(result.meta?.rows_written ?? 0) !== 0 || result.meta?.changed_db === true) {
    fail('a read-only inspection query unexpectedly reported writes');
  }
  return result.results;
}

function tableColumns(table) {
  return query(`SELECT cid,name,type,"notnull" AS not_null,dflt_value,pk,hidden FROM pragma_table_xinfo('${table}') ORDER BY cid`);
}

function inspectAiUsageLedgerSchema(objects, columns) {
  const indexRows = query(`SELECT seq,name,"unique" AS is_unique,origin,partial
    FROM pragma_index_list('ai_usage_ledger') ORDER BY name`);
  const indexes = indexRows.map((index) => {
    const quotedName = String(index.name).replaceAll("'", "''");
    return {
      name: index.name,
      unique: Number(index.is_unique),
      origin: index.origin,
      partial: Number(index.partial),
      columns: query(`SELECT name FROM pragma_index_info('${quotedName}') ORDER BY seqno`).map((column) => column.name),
    };
  });
  const tableOptions = query(`SELECT wr,strict FROM pragma_table_list WHERE name='ai_usage_ledger'`)[0];
  return {
    exists: Boolean(objects['table:ai_usage_ledger']),
    columns: (columns.ai_usage_ledger ?? []).map(normalizeAiUsageLedgerColumn),
    foreignKeys: query(`SELECT id,seq,"table","from","to",on_update,on_delete,"match"
      FROM pragma_foreign_key_list('ai_usage_ledger') ORDER BY id,seq`),
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

function inspectRemoteState() {
  const schemaRows = query(`SELECT type,name,tbl_name,sql FROM sqlite_schema
    WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name`);
  const objects = Object.fromEntries(schemaRows.map((row) => [`${row.type}:${row.name}`, {
    type: row.type,
    name: row.name,
    table: row.tbl_name,
    sql: String(row.sql ?? '')
      .replace(/\bIF\s+NOT\s+EXISTS\b/gi, '')
      .replace(/\s+/g, ' ')
      .replace(/\s*;\s*$/, '')
      .trim()
      .toLowerCase(),
  }]));
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
  ]) columns[table] = tableColumns(table);

  const countSql = `SELECT ${COUNT_TABLES.map((table) => `(SELECT COUNT(*) FROM ${table}) AS ${table}`).join(',')},` +
    `(SELECT COUNT(*) FROM users WHERE email_verify_token IS NOT NULL) AS users_email_verify_token_non_null`;
  const countRow = query(countSql)[0];
  const counts = Object.fromEntries(Object.entries(countRow).map(([name, count]) => [name, Number(count)]));
  counts.user_runtime_summaries = objects['table:user_runtime_summaries']
    ? Number(query('SELECT COUNT(*) AS count FROM user_runtime_summaries')[0].count)
    : 0;
  counts.runtime_admin_summary = objects['table:runtime_admin_summary']
    ? Number(query('SELECT COUNT(*) AS count FROM runtime_admin_summary')[0].count)
    : 0;
  counts.admin_audit_log_legacy_20261001 = objects['table:admin_audit_log_legacy_20261001']
    ? Number(query('SELECT COUNT(*) AS count FROM admin_audit_log_legacy_20261001')[0].count)
    : 0;
  counts.admin_ai_usage_daily = objects['table:admin_ai_usage_daily']
    ? Number(query('SELECT COUNT(*) AS count FROM admin_ai_usage_daily')[0].count)
    : 0;
  counts.admin_observability_summary = objects['table:admin_observability_summary']
    ? Number(query('SELECT COUNT(*) AS count FROM admin_observability_summary')[0].count)
    : 0;
  counts.admin_plan_summary = objects['table:admin_plan_summary']
    ? Number(query('SELECT COUNT(*) AS count FROM admin_plan_summary')[0].count)
    : 0;

  const runtimePresent = Boolean(objects['table:user_runtime_summaries'] && objects['table:runtime_admin_summary']);
  const aggregateMismatches = runtimePresent
    ? Number(query(`SELECT COUNT(*) AS count FROM user_runtime_summaries summary JOIN users user ON user.id=summary.user_id
        WHERE summary.products_count != (SELECT COUNT(*) FROM products product WHERE product.userId=user.id)
           OR summary.orders_count != (SELECT COUNT(*) FROM orders item WHERE item.userId=user.id AND COALESCE(item.status,'') NOT IN ('ملغي','محذوف','ملغى'))
           OR summary.sales_halala != (SELECT COALESCE(SUM(item.totalHalala),0) FROM orders item WHERE item.userId=user.id AND COALESCE(item.status,'') NOT IN ('ملغي','محذوف','ملغى'))
           OR summary.excluded_orders_count != (SELECT COUNT(*) FROM orders item WHERE item.userId=user.id AND COALESCE(item.status,'') IN ('ملغي','محذوف','ملغى'))
           OR summary.excluded_sales_halala != (SELECT COALESCE(SUM(item.totalHalala),0) FROM orders item WHERE item.userId=user.id AND COALESCE(item.status,'') IN ('ملغي','محذوف','ملغى'))`)[0].count)
    : null;

  return {
    identity: { ...RELEASE_IDENTITY },
    objects,
    columns,
    aiUsageLedgerSchema: inspectAiUsageLedgerSchema(objects, columns),
    ledger: query('SELECT id,name,applied_at FROM d1_migrations ORDER BY id'),
    ledgerIndexes: query(`SELECT name,"unique" AS is_unique FROM pragma_index_list('d1_migrations') ORDER BY name`),
    counts,
    aggregateMismatches,
    foreignKeyViolations: runtimePresent ? query('PRAGMA foreign_key_check').length : null,
    quickCheck: runtimePresent ? query('PRAGMA quick_check')[0]?.quick_check : null,
  };
}

function productionSecretNames() {
  const payload = parseJsonOutput(runWrangler([
    'secret',
    'list',
    '--name',
    RELEASE_IDENTITY.worker,
    '--config',
    CONFIG,
    '--profile',
    RELEASE_IDENTITY.profile,
  ]), 'Worker secret inventory');
  if (!Array.isArray(payload)) fail('Worker secret inventory had an unexpected shape');
  return payload.map((secret) => secret.name);
}

function applyRemoteMigrationStep(step) {
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'isaudi-production-release-'));
  const migrationsDir = path.join(temporaryRoot, 'migrations');
  const configPath = path.join(temporaryRoot, 'wrangler.production-release.toml');
  try {
    mkdirSync(migrationsDir);
    writeFileSync(path.join(migrationsDir, step.name), step.sql, { encoding: 'utf8', flag: 'wx' });
    const portableMigrationsDir = migrationsDir.replaceAll('\\', '/');
    writeFileSync(configPath, `name = "${RELEASE_IDENTITY.worker}"
account_id = "${RELEASE_IDENTITY.accountId}"

[[d1_databases]]
binding = "DB"
database_name = "${RELEASE_IDENTITY.database}"
database_id = "${RELEASE_IDENTITY.databaseId}"
migrations_dir = "${portableMigrationsDir}"
migrations_table = "d1_migrations"
`, { encoding: 'utf8', flag: 'wx' });
    runWrangler([
      'd1',
      'migrations',
      'apply',
      RELEASE_IDENTITY.database,
      '--remote',
      '--config',
      configPath,
      '--profile',
      RELEASE_IDENTITY.profile,
    ]);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

function assertSourceCountsPreserved(before, after) {
  const beforeCounts = watchedCounts(before);
  const afterCounts = watchedCounts(after);
  if (JSON.stringify(beforeCounts) !== JSON.stringify(afterCounts)) {
    fail('source business row counts changed during the migration');
  }
}

function reportFor({ action, plan, openAiSecretPresent, appliedSteps = [], finalState = null }) {
  return {
    mode: 'production',
    action,
    identity: { ...RELEASE_IDENTITY },
    schemaVerified: true,
    ledgerVerified: true,
    plannedSteps: plan.steps.map((step) => ({
      name: step.name,
      kind: step.kind,
      skipped: Boolean(step.skipped),
      indexCount: step.indexNames?.length ?? null,
    })),
    appliedSteps,
    explicitSkip: plan.explicitlySkipped,
    writeBudget: plan.writeBudget,
    timeTravelBookmarkRequired: true,
    timeTravelBookmarkValueIncluded: false,
    openAiSecretPresent,
    adminBootstrapTokenRequiredLater: true,
    workerDeploymentIncluded: false,
    finalVerification: finalState ? {
      quickCheck: finalState.quickCheck,
      foreignKeyViolations: finalState.foreignKeyViolations,
      aggregateMismatches: finalState.aggregateMismatches,
    } : null,
    productionWorkerDeployed: false,
  };
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  assertIdentity({ ...RELEASE_IDENTITY, mode: args.mode });
  runPreflight();

  const initialState = inspectRemoteState();
  const plan = buildReleasePlan(initialState);
  const secretNames = productionSecretNames();
  const openAiSecretPresent = secretNames.includes('OPENAI_API_KEY');
  if (!openAiSecretPresent) fail('OPENAI_API_KEY secret name is missing');

  if (args.action === 'plan') {
    console.log(JSON.stringify(reportFor({ action: 'plan', plan, openAiSecretPresent }), null, 2));
    return;
  }

  assertExecutionApproval({
    execute: true,
    approval: process.env.ISAUDI_PRODUCTION_D1_APPROVAL,
    bookmark: process.env.ISAUDI_PRODUCTION_TIME_TRAVEL_BOOKMARK,
    bookmarkCapturedAt: process.env.ISAUDI_PRODUCTION_TIME_TRAVEL_CAPTURED_AT,
  });

  const appliedSteps = [];
  for (const step of plan.steps) {
    applyRemoteMigrationStep(step);
    appliedSteps.push(step.name);
    const checkpoint = inspectRemoteState();
    const prefix = assertReleaseState(checkpoint);
    if (prefix !== plan.prefixLength + appliedSteps.length) {
      fail(`ledger did not advance exactly after ${step.name}`);
    }
  }

  const finalState = inspectRemoteState();
  verifyFinalReleaseState(finalState);
  assertSourceCountsPreserved(initialState, finalState);
  console.log(JSON.stringify(reportFor({
    action: 'execute',
    plan,
    openAiSecretPresent,
    appliedSteps,
    finalState,
  }), null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    mode: 'production',
    success: false,
    error: error.message,
    productionWorkerDeployed: false,
  }));
  process.exitCode = 1;
});
