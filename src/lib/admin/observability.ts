import 'server-only';

import { hmacPseudonym } from '@/lib/admin/security';
import { type D1 } from '@/lib/admin/db';
import { getRuntimeEnvironment, getRuntimeString } from '@/lib/runtime/environment';
import {
  addAiTotals,
  approximateLatencyPercentile,
  emptyAiTotals,
  estimateGpt4oMiniCostMicroUsd,
  monthlyRevenueHalala,
  limitStatus,
  planEntitlements,
  quotaStatus,
  reportAllowance,
  type AiTotals,
} from './observability-math';

type AiAggregateRow = {
  scope_type: 'global' | 'plan';
  scope_id: string;
  day_start: number;
  operation: 'chat' | 'generate';
  model: string;
  request_count: number;
  success_count: number;
  failure_count: number;
  timeout_count: number;
  rate_limit_count: number;
  provider_error_count: number;
  status_2xx_count: number;
  status_4xx_count: number;
  status_5xx_count: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cached_input_tokens: number;
  cache_write_tokens: number;
  latency_total_ms: number;
  latency_samples: number;
  latency_le_100: number;
  latency_le_250: number;
  latency_le_500: number;
  latency_le_1000: number;
  latency_le_2500: number;
  latency_le_5000: number;
  latency_gt_5000: number;
  updated_at: number;
};

type CoreRow = Record<string, number | string | null>;
type MigrationRow = { name: string; applied_at: number | string };
type PlanRow = { plan: string; customers_count: number; reports_count: number; updated_at: number };
type SallaAggregateRow = {
  total: number;
  active_healthy: number;
  reconnect_required: number;
  inactive: number;
  pending: number;
};
type BusinessApiAggregateRow = {
  active_keys: number;
  revoked_keys: number;
  request_count: number;
  error_count: number;
  rate_limit_count: number;
  last_used_at: number | null;
  updated_at: number;
};

const EXPECTED_MIGRATIONS = [
  '0001_init.sql',
  '0002_add_email_verify_columns.sql',
  '0003_add_updatedat_to_subscriptions.sql',
  '0004_subscriptions_userid_unique.sql',
  '0005_add_receipt_to_payments.sql',
  '0006_create_salla_oauth_states.sql',
  '0007_otp_hardening.sql',
  '0008_payment_integrity.sql',
  '0009_admin_portal.sql',
  '0010_ai_chat_rate_limits.sql',
  '0011_ai_usage_ledger.sql',
  '0012_salla_easy_mode.sql',
  '0013_salla_link_codes.sql',
  '0015_security_scalability_hardening.sql',
  '0016_runtime_aggregates.sql',
  '0017_youtube_how_it_works_video.sql',
  '0018_ai_usage_metering.sql',
  '0019_admin_observability.sql',
] as const;

const SECRET_NAMES = [
  'OPENAI_API_KEY',
  'RESEND_API_KEY',
  'OTP_HMAC_SECRET',
  'TOKEN_ENCRYPTION_KEY',
  'TAP_SECRET_KEY',
  'SALLA_CLIENT_ID',
  'SALLA_CLIENT_SECRET',
  'SALLA_WEBHOOK_SECRET',
  'ADMIN_BOOTSTRAP_TOKEN',
] as const;

function number(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : Number(value) || 0;
}

function timestamp(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function aiRowTotals(row: AiAggregateRow): AiTotals {
  return {
    requestCount: number(row.request_count),
    successCount: number(row.success_count),
    failureCount: number(row.failure_count),
    timeoutCount: number(row.timeout_count),
    rateLimitCount: number(row.rate_limit_count),
    providerErrorCount: number(row.provider_error_count),
    status2xxCount: number(row.status_2xx_count),
    status4xxCount: number(row.status_4xx_count),
    status5xxCount: number(row.status_5xx_count),
    inputTokens: number(row.input_tokens),
    outputTokens: number(row.output_tokens),
    totalTokens: number(row.total_tokens),
    cachedInputTokens: number(row.cached_input_tokens),
    cacheWriteTokens: number(row.cache_write_tokens),
    latencyTotalMs: number(row.latency_total_ms),
    latencySamples: number(row.latency_samples),
    latencyBuckets: [
      row.latency_le_100,
      row.latency_le_250,
      row.latency_le_500,
      row.latency_le_1000,
      row.latency_le_2500,
      row.latency_le_5000,
      row.latency_gt_5000,
    ].map(number),
  };
}

function summarizeRows(rows: AiAggregateRow[], from: number, operation?: 'chat' | 'generate') {
  const totals = emptyAiTotals();
  for (const row of rows) {
    if (row.day_start < from || (operation && row.operation !== operation)) continue;
    addAiTotals(totals, aiRowTotals(row));
  }
  const costMicroUsd = estimateGpt4oMiniCostMicroUsd(totals);
  return {
    ...totals,
    costMicroUsd,
    averageCostMicroUsd: totals.requestCount ? Math.round(costMicroUsd / totals.requestCount) : 0,
    averageTokens: totals.requestCount ? Math.round(totals.totalTokens / totals.requestCount) : 0,
    cacheRatio: totals.inputTokens ? totals.cachedInputTokens / totals.inputTokens : 0,
    averageLatencyMs: totals.latencySamples
      ? Math.round(totals.latencyTotalMs / totals.latencySamples)
      : null,
    p50LatencyMs: approximateLatencyPercentile(totals.latencyBuckets, totals.latencySamples, 0.5),
    p95LatencyMs: approximateLatencyPercentile(totals.latencyBuckets, totals.latencySamples, 0.95),
  };
}

function presence(name: (typeof SECRET_NAMES)[number]) {
  if (name === 'TAP_SECRET_KEY') {
    return Boolean(
      getRuntimeString('TAP_SECRET_KEY') ||
        getRuntimeString('TAP_SECRET') ||
        getRuntimeString('TAP_API_KEY')
    );
  }
  return Boolean(getRuntimeString(name));
}

function evidenceStatus(input: {
  observedAt: number | null;
  successes?: number;
  failures?: number;
  configured?: boolean;
}): 'healthy' | 'warning' | 'error' | 'unknown' {
  if (!input.observedAt) return 'unknown';
  const successes = input.successes ?? 0;
  const failures = input.failures ?? 0;
  if (failures > 0 && successes === 0) return 'error';
  if (failures > 0) return 'warning';
  if (successes > 0) return 'healthy';
  return input.configured ? 'unknown' : 'unknown';
}

export async function readAdminObservability(db: D1, now = Date.now()) {
  const dayStart = Math.floor(now / 86_400_000) * 86_400_000;
  const sevenDayStart = dayStart - 6 * 86_400_000;
  const thirtyDayStart = dayStart - 29 * 86_400_000;
  const date = new Date(now);
  const billingStart = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
  const queryStart = Math.min(thirtyDayStart, billingStart);

  const [core, aiResult, planResult, migrationResult, schema, foreignKeys, sallaAggregate, businessApi] = await Promise.all([
    db.prepare(`SELECT
      r.users_count AS users_count, r.reports_count AS reports_count,
      r.active_subscriptions_count AS active_subscriptions_count,
      r.captured_revenue_halala AS captured_revenue_halala,
      r.updated_at AS runtime_updated_at,
      o.products_count, o.orders_count, o.order_items_count, o.snapshots_count,
      o.subscriptions_count, o.payments_count, o.payment_success_count,
      o.payment_failure_count, o.payment_integrity_failure_count, o.connections_count, o.csv_products_count,
      o.csv_orders_count, o.salla_connected_count, o.salla_warning_count,
      o.updated_at AS observability_updated_at,
      (SELECT COUNT(*) FROM sessions WHERE expiresAt > ?) AS customer_sessions,
      (SELECT COUNT(*) FROM admin_sessions WHERE expires_at > ?) AS admin_sessions,
      (SELECT COALESCE(SUM(attempts), 0) FROM otp_challenges WHERE attempts > 0 AND expires_at > ?) AS otp_failures,
      (SELECT COUNT(*) FROM admin_audit_log WHERE action = 'login_failed' AND created_at >= ?) AS admin_login_failures,
      (SELECT MAX(created_at) FROM admin_audit_log WHERE action = 'login_success') AS last_admin_login_at,
      (SELECT MAX(createdAt) FROM sessions) AS last_customer_login_at,
      (SELECT MAX(updatedAt) FROM salla_connections) AS last_salla_event_at,
      (SELECT COUNT(*) FROM salla_link_codes WHERE consumedAt IS NULL AND invalidatedAt IS NULL AND expiresAt > ?) AS pending_salla_codes,
      (SELECT MAX(updatedAt) FROM products WHERE platform = 'csv') AS last_csv_at,
      (SELECT MAX(createdAt) FROM payments) AS last_payment_at,
      (SELECT youtube_video_id FROM how_it_works_video WHERE id = 1) AS youtube_video_id,
      (SELECT enabled FROM how_it_works_video WHERE id = 1) AS video_enabled,
      (SELECT updated_at FROM how_it_works_video WHERE id = 1) AS video_updated_at
    FROM runtime_admin_summary r CROSS JOIN admin_observability_summary o
    WHERE r.id = 1 AND o.id = 1`)
      .bind(now, now, now, thirtyDayStart, now)
      .first<CoreRow>(),
    db.prepare(`SELECT * FROM admin_ai_usage_daily
      WHERE scope_type IN ('global', 'plan') AND day_start >= ?
      ORDER BY day_start ASC`)
      .bind(queryStart)
      .all<AiAggregateRow>(),
    db.prepare('SELECT plan, customers_count, reports_count, updated_at FROM admin_plan_summary ORDER BY plan')
      .all<PlanRow>(),
    db.prepare('SELECT name, applied_at FROM d1_migrations ORDER BY id ASC').all<MigrationRow>(),
    db.prepare(`SELECT
      SUM(CASE WHEN type='trigger' AND name LIKE 'runtime_%' THEN 1 ELSE 0 END) AS runtime_triggers,
      SUM(CASE WHEN type='trigger' AND name LIKE 'admin_obs_%' THEN 1 ELSE 0 END) AS observability_triggers,
      SUM(CASE WHEN type='trigger' AND name='admin_ai_usage_finalize' THEN 1 ELSE 0 END) AS ai_triggers
      FROM sqlite_master`).first<Record<string, number>>(),
    db.prepare('PRAGMA foreign_keys').first<Record<string, number>>(),
    db.prepare(`SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'connected' AND NOT (
        refreshState = 'uncertain' OR
        (refreshState = 'in_progress' AND (
          refreshAttemptId IS NULL OR refreshAttemptStartedAt IS NULL OR
          refreshLockExpiresAt IS NULL OR refreshLockExpiresAt <= ?
        ))
      ) THEN 1 ELSE 0 END) AS active_healthy,
      SUM(CASE WHEN status = 'connected' AND (
        refreshState = 'uncertain' OR
        (refreshState = 'in_progress' AND (
          refreshAttemptId IS NULL OR refreshAttemptStartedAt IS NULL OR
          refreshLockExpiresAt IS NULL OR refreshLockExpiresAt <= ?
        ))
      ) THEN 1 ELSE 0 END) AS reconnect_required,
      SUM(CASE WHEN status IN ('disconnected', 'uninstalled') THEN 1 ELSE 0 END) AS inactive,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending
      FROM salla_connections`)
      .bind(now, now)
      .first<SallaAggregateRow>(),
    db.prepare(`SELECT active_keys, revoked_keys, request_count, error_count,
      rate_limit_count, last_used_at, updated_at
      FROM business_api_admin_summary WHERE id = 1`).first<BusinessApiAggregateRow>(),
  ]);

  if (!core) throw new Error('Observability aggregates unavailable');
  const aiRows = aiResult.results;
  const globalRows = aiRows.filter(row => row.scope_type === 'global');
  const period = {
    today: summarizeRows(globalRows, dayStart),
    sevenDays: summarizeRows(globalRows, sevenDayStart),
    thirtyDays: summarizeRows(globalRows, thirtyDayStart),
    billing: summarizeRows(globalRows, billingStart),
  };
  const generate = summarizeRows(globalRows, billingStart, 'generate');
  const chat = summarizeRows(globalRows, billingStart, 'chat');
  const modelUsage = new Map<string, AiTotals>();
  for (const row of globalRows.filter(value => value.day_start >= billingStart)) {
    const totals = modelUsage.get(row.model) ?? emptyAiTotals();
    addAiTotals(totals, aiRowTotals(row));
    modelUsage.set(row.model, totals);
  }
  const planAiRows = aiRows.filter(row => row.scope_type === 'plan');
  const planSummaries = planResult.results.map(plan => {
    const totals = summarizeRows(
      planAiRows.filter(row => row.scope_id === plan.plan),
      billingStart
    );
    const entitlements = planEntitlements(plan.plan);
    return {
      plan: plan.plan,
      customers: number(plan.customers_count),
      reports: number(plan.reports_count),
      aiRequests: totals.requestCount,
      totalTokens: totals.totalTokens,
      aiCostMicroUsd: totals.costMicroUsd,
      averageAiCostMicroUsd: plan.customers_count
        ? Math.round(totals.costMicroUsd / plan.customers_count)
        : 0,
      averageReports: plan.customers_count ? plan.reports_count / plan.customers_count : 0,
      catalogMonthlyRevenueHalala: monthlyRevenueHalala(plan.plan) * plan.customers_count,
      entitlements,
      reportCapacity: entitlements
        ? entitlements.maxReportsPerMonth * number(plan.customers_count)
        : null,
      reportsStatus: entitlements
        ? limitStatus(
            number(plan.reports_count),
            entitlements.maxReportsPerMonth * number(plan.customers_count)
          )
        : 'not_entitled',
    };
  });

  const migrations = migrationResult.results;
  const appliedNames = new Set(migrations.map(item => item.name));
  const pending = EXPECTED_MIGRATIONS.filter(name => !appliedNames.has(name));
  const latestEvidence = Math.max(
    number(core.runtime_updated_at),
    number(core.observability_updated_at),
    ...aiRows.map(row => number(row.updated_at))
  );
  const secrets = Object.fromEntries(
    SECRET_NAMES.map(name => [name, { required: name !== 'ADMIN_BOOTSTRAP_TOKEN', present: presence(name) }])
  );
  const env = getRuntimeEnvironment();
  const versionMetadata = env.CF_VERSION_METADATA;
  const workerVersion =
    versionMetadata && typeof versionMetadata === 'object' && 'id' in versionMetadata
      ? String((versionMetadata as { id?: unknown }).id ?? '') || null
      : null;

  const aiEvidenceAt = aiRows.reduce((max, row) => Math.max(max, number(row.updated_at)), 0) || null;
  const authEvidenceAt = Math.max(number(core.last_admin_login_at), number(core.last_customer_login_at)) || null;
  const videoObservedAt = number(core.video_updated_at) || null;
  const dbObservedAt = number(core.observability_updated_at) || null;

  return {
    generatedAt: now,
    systemHealth: [
      { key: 'ai', status: evidenceStatus({ observedAt: aiEvidenceAt, successes: period.thirtyDays.successCount, failures: period.thirtyDays.failureCount }), observedAt: aiEvidenceAt },
      { key: 'database', status: dbObservedAt ? 'healthy' : 'unknown', observedAt: dbObservedAt },
      { key: 'authentication', status: authEvidenceAt ? 'healthy' : 'unknown', observedAt: authEvidenceAt },
      { key: 'email', status: 'unknown', observedAt: null },
      { key: 'salla', status: number(core.salla_warning_count) ? 'warning' : number(core.salla_connected_count) ? 'healthy' : 'unknown', observedAt: number(core.last_salla_event_at) || null },
      { key: 'csv', status: number(core.csv_products_count) || number(core.csv_orders_count) ? 'healthy' : 'unknown', observedAt: number(core.last_csv_at) || null },
      { key: 'billing', status: evidenceStatus({ observedAt: number(core.last_payment_at) || null, successes: number(core.payment_success_count), failures: number(core.payment_failure_count) }), observedAt: number(core.last_payment_at) || null },
      { key: 'video', status: videoObservedAt ? (number(core.video_enabled) ? 'healthy' : 'warning') : 'unknown', observedAt: videoObservedAt },
      { key: 'cloudflare', status: 'unknown', observedAt: null },
    ],
    ai: {
      period,
      generate,
      chat,
      modelUsage: Array.from(modelUsage.entries()).map(([model, totals]) => ({ model, ...totals })),
      openAiCreditBalance: 'not_available_via_application_api',
      pricing: {
        model: 'gpt-4o-mini', inputUsdPerMillion: 0.15,
        cachedInputUsdPerMillion: 0.075, outputUsdPerMillion: 0.6,
        source: 'official_openai_model_page', estimated: true,
      },
    },
    plans: planSummaries,
    database: {
      users: number(core.users_count), products: number(core.products_count),
      orders: number(core.orders_count), orderItems: number(core.order_items_count),
      reports: number(core.reports_count), snapshots: number(core.snapshots_count),
      subscriptions: number(core.subscriptions_count), payments: number(core.payments_count),
      connections: number(core.connections_count), runtimeAggregates: Boolean(core.runtime_updated_at),
      aggregateObservedAt: latestEvidence || null,
      foreignKeysEnabled: number(foreignKeys?.foreign_keys) === 1,
      runtimeTriggerCount: number(schema?.runtime_triggers),
      observabilityTriggerCount: number(schema?.observability_triggers),
      aiAggregateTriggerCount: number(schema?.ai_triggers),
      integrity: 'not_run_on_dashboard',
      sizeBytes: null,
    },
    migrations: {
      currentLedger: migrations.map(item => ({ name: item.name, appliedAt: timestamp(item.applied_at) })),
      expectedSchema: '0019_admin_observability.sql', pending,
      migration0014: 'intentionally_skipped_in_production_runbook',
      currentLedger0014: appliedNames.has('0014_how_it_works_video.sql') ? 'applied_legacy_staging' : 'not_applied',
      migration0018: appliedNames.has('0018_ai_usage_metering.sql') ? 'applied' : 'pending',
      expectedReleaseSequence: ['0008b', '0009', '0010', '0011', '0012', '0013', 'SKIP 0014', '0015', '0016', '0017', '0018', '0019', 'schema/data verification', 'Worker deploy'],
      expectedWrites: 11162, dailyBudget: 100000,
      remainingSafetyMargin: 100000 - 11162,
      liveExpectedWrites: null,
      lastVerification: timestamp(migrations.at(-1)?.applied_at),
    },
    security: {
      adminSessions: number(core.admin_sessions), customerSessions: number(core.customer_sessions),
      otpFailures: number(core.otp_failures), adminLoginFailures: number(core.admin_login_failures),
      rateLimitEvents: period.thirtyDays.rateLimitCount,
      promptInjectionDetections: null, webhookFailures: number(core.payment_integrity_failure_count),
      originFailures: null, rawSecurityEventsExposed: false,
    },
    secrets,
    cloudflare: {
      worker: 'isaudi-staging', environment: String(getRuntimeString('APP_ENV') ?? 'unknown'),
      version: workerVersion, cpuObservations: null, errors1102: null, errors503: null,
      d1Errors: null, waf: 'unknown', rateLimit: 'unknown', minimumTls: null,
      tls13: null, cipherProfile: null,
      reason: 'authenticated_cloudflare_telemetry_unavailable', lastCheckedAt: now,
    },
    integrations: {
      resend: { configured: presence('RESEND_API_KEY'), status: 'unknown', deliveryHistory: 'not_recorded', lastSuccessAt: null, lastFailureAt: null, deliveryFailures: null, suppressions: null },
      tap: { configured: presence('TAP_SECRET_KEY'), stagingStatus: 'not_configured_in_staging', attempts: number(core.payments_count), successes: number(core.payment_success_count), failures: number(core.payment_failure_count), integrityFailures: number(core.payment_integrity_failure_count), lastEventAt: number(core.last_payment_at) || null, accountBalance: null },
      salla: {
        integrationHealth: { status: 'unknown', reason: 'runtime_partner_app_health_not_recorded', lastCheckedAt: now },
        customerStores: {
          total: number(sallaAggregate?.total),
          connected: number(core.salla_connected_count),
          activeHealthy: number(sallaAggregate?.active_healthy),
          reconnectRequired: number(sallaAggregate?.reconnect_required),
          inactive: number(sallaAggregate?.inactive),
          pending: number(sallaAggregate?.pending),
          failedSyncs: null,
        },
        warnings: number(core.salla_warning_count), pendingLinkCodes: number(core.pending_salla_codes),
        lastEventAt: number(core.last_salla_event_at) || null, webhookStatus: 'unknown',
      },
      csv: { products: number(core.csv_products_count), orders: number(core.csv_orders_count), lastImportAt: number(core.last_csv_at) || null, failedImports: null, rawContentRetained: false },
      video: { configured: Boolean(core.youtube_video_id), enabled: Boolean(core.video_enabled), updatedAt: videoObservedAt, provider: 'youtube' },
      businessApi: {
        activeKeys: number(businessApi?.active_keys), revokedKeys: number(businessApi?.revoked_keys),
        requests: number(businessApi?.request_count), errors: number(businessApi?.error_count),
        rateLimitEvents: number(businessApi?.rate_limit_count), lastUsedAt: number(businessApi?.last_used_at) || null,
        updatedAt: number(businessApi?.updated_at) || null, plaintextKeysExposed: false,
      },
    },
  };
}

type CustomerRow = {
  id: string;
  plan: string;
  reports_used: number;
  request_count: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cached_input_tokens: number;
  chat_hour: number;
  chat_day: number;
  generate_hour: number;
  generate_day: number;
  stores_used: number;
};

export async function readAdminObservabilityCustomers(
  db: D1,
  input: { page: number; pageSize: number; now?: number }
) {
  const now = input.now ?? Date.now();
  const page = Math.min(200, Math.max(1, input.page));
  const pageSize = Math.min(25, Math.max(5, input.pageSize));
  const offset = (page - 1) * pageSize;
  const dayStart = now - 24 * 60 * 60 * 1000;
  const hourStart = now - 60 * 60 * 1000;
  const date = new Date(now);
  const billingStart = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
  const result = await db.prepare(`WITH page_users AS (
      SELECT id, COALESCE(NULLIF(plan, ''), 'free') AS plan
      FROM users ORDER BY createdAt DESC LIMIT ? OFFSET ?
    ), ai AS (
      SELECT scope_id AS user_id, SUM(request_count) AS request_count,
        SUM(input_tokens) AS input_tokens, SUM(output_tokens) AS output_tokens,
        SUM(total_tokens) AS total_tokens, SUM(cached_input_tokens) AS cached_input_tokens
      FROM admin_ai_usage_daily a JOIN page_users p ON p.id = a.scope_id
      WHERE a.scope_type = 'user' AND a.day_start >= ? GROUP BY a.scope_id
    ), recent AS (
      SELECT l.user_id,
        SUM(CASE WHEN l.operation='chat' AND l.created_at>=? THEN 1 ELSE 0 END) AS chat_hour,
        SUM(CASE WHEN l.operation='chat' AND l.created_at>=? THEN 1 ELSE 0 END) AS chat_day,
        SUM(CASE WHEN l.operation='generate' AND l.created_at>=? THEN 1 ELSE 0 END) AS generate_hour,
        SUM(CASE WHEN l.operation='generate' AND l.created_at>=? THEN 1 ELSE 0 END) AS generate_day
      FROM ai_usage_ledger l JOIN page_users p ON p.id = l.user_id
      WHERE l.created_at >= ? GROUP BY l.user_id
    ), report_use AS (
      SELECT r.userId AS user_id, COUNT(*) AS reports_used
      FROM reports r JOIN page_users p ON p.id = r.userId
      WHERE r.createdAt >= ? GROUP BY r.userId
    ), store_use AS (
      SELECT p.id AS user_id,
        (SELECT COUNT(*) FROM store_connections c WHERE c.userId = p.id) +
        (SELECT COUNT(*) FROM salla_connections s
          WHERE s.userId = p.id AND s.status <> 'uninstalled') AS stores_used
      FROM page_users p
    )
    SELECT p.id, p.plan,
      COALESCE(report_use.reports_used, 0) AS reports_used,
      COALESCE(ai.request_count, 0) AS request_count,
      COALESCE(ai.input_tokens, 0) AS input_tokens,
      COALESCE(ai.output_tokens, 0) AS output_tokens,
      COALESCE(ai.total_tokens, 0) AS total_tokens,
      COALESCE(ai.cached_input_tokens, 0) AS cached_input_tokens,
      COALESCE(recent.chat_hour, 0) AS chat_hour,
      COALESCE(recent.chat_day, 0) AS chat_day,
      COALESCE(recent.generate_hour, 0) AS generate_hour,
      COALESCE(recent.generate_day, 0) AS generate_day
      , COALESCE(store_use.stores_used, 0) AS stores_used
    FROM page_users p
    LEFT JOIN ai ON ai.user_id = p.id
    LEFT JOIN recent ON recent.user_id = p.id
    LEFT JOIN report_use ON report_use.user_id = p.id
    LEFT JOIN store_use ON store_use.user_id = p.id`)
    .bind(pageSize + 1, offset, billingStart, hourStart, dayStart, hourStart, dayStart, dayStart, billingStart)
    .all<CustomerRow>();

  const rows = await Promise.all(result.results.slice(0, pageSize).map(async row => {
    const allowance = reportAllowance(row.plan);
    const entitlements = planEntitlements(row.plan);
    const aiCostMicroUsd = estimateGpt4oMiniCostMicroUsd({
      inputTokens: number(row.input_tokens), outputTokens: number(row.output_tokens),
      cachedInputTokens: number(row.cached_input_tokens),
    });
    const monthlyRevenue = monthlyRevenueHalala(row.plan);
    // A transparent estimate using the long-standing SAR/USD peg; infrastructure
    // and payment costs are deliberately excluded.
    const aiCostHalalaEstimate = Math.round((aiCostMicroUsd / 1_000_000) * 3.75 * 100);
    return {
      customerIdentifier: `cust_${(await hmacPseudonym(`observability:${row.id}`)).slice(0, 12)}`,
      plan: row.plan, aiRequests: number(row.request_count),
      inputTokens: number(row.input_tokens), outputTokens: number(row.output_tokens),
      totalTokens: number(row.total_tokens), aiCostMicroUsd,
      reports: { used: number(row.reports_used), allowance, remaining: allowance == null ? null : Math.max(0, allowance - number(row.reports_used)) },
      stores: {
        used: number(row.stores_used),
        allowance: entitlements?.maxStores ?? null,
        remaining: entitlements ? Math.max(0, entitlements.maxStores - number(row.stores_used)) : null,
        status: entitlements ? limitStatus(number(row.stores_used), entitlements.maxStores) : 'not_entitled',
      },
      chatQuota: quotaStatus({ operation: 'chat', plan: row.plan, hourlyUsed: number(row.chat_hour), dailyUsed: number(row.chat_day) }),
      generationQuota: quotaStatus({ operation: 'generate', plan: row.plan, hourlyUsed: number(row.generate_hour), dailyUsed: number(row.generate_day) }),
      reportStatus: allowance == null ? 'not_entitled' : limitStatus(number(row.reports_used), allowance),
      entitlements,
      catalogMonthlyRevenueHalala: monthlyRevenue,
      estimatedContributionHalala: monthlyRevenue - aiCostHalalaEstimate,
      contributionExcludesInfrastructure: true,
    };
  }));
  return { rows, page, pageSize, hasMore: result.results.length > pageSize };
}
