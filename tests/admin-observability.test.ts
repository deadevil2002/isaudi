import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  approximateLatencyPercentile,
  estimateGpt4oMiniCostMicroUsd,
  limitStatus,
  planEntitlements,
  quotaStatus,
  reportAllowance,
} from '../src/lib/admin/observability-math';

test('AI cost uses published gpt-4o-mini input, cached-input, and output rates', () => {
  assert.equal(
    estimateGpt4oMiniCostMicroUsd({
      inputTokens: 100,
      cachedInputTokens: 40,
      outputTokens: 20,
    }),
    24
  );
  assert.equal(
    estimateGpt4oMiniCostMicroUsd({
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
    }),
    0
  );
});

test('latency percentiles require enough observations and use bounded histograms', () => {
  assert.equal(approximateLatencyPercentile([1, 1, 1, 1, 0, 0, 0], 4, 0.5), null);
  assert.equal(approximateLatencyPercentile([1, 2, 4, 2, 1, 0, 0], 10, 0.5), 500);
  assert.equal(approximateLatencyPercentile([1, 2, 4, 2, 1, 0, 0], 10, 0.95), 2500);
});

test('application quota and report limits stay separate from provider credit', () => {
  assert.deepEqual(quotaStatus({ operation: 'chat', plan: 'free', hourlyUsed: 3, dailyUsed: 12 }), {
    hourly: { used: 3, limit: 10, remaining: 7 },
    daily: { used: 12, limit: 50, remaining: 38 },
  });
  assert.equal(reportAllowance('free'), 2);
  assert.equal(reportAllowance('starter'), 30);
  assert.equal(reportAllowance('growth'), 200);
  assert.equal(reportAllowance('business'), 999999);
});

test('Admin plan entitlements are derived from the application catalogs', () => {
  assert.deepEqual(planEntitlements('starter'), {
    id: 'starter', maxStores: 1, maxReportsPerMonth: 30,
    aiInsights: true, dataExport: false, apiAccess: false,
    chat: { hourly: 60, daily: 300, concurrent: 4 },
    generate: { hourly: 6, daily: 24, concurrent: 1 },
  });
  assert.equal(planEntitlements('free')?.maxReportsPerMonth, 2);
  assert.equal(planEntitlements('growth')?.maxStores, 3);
  assert.equal(planEntitlements('business')?.dataExport, true);
  assert.equal(planEntitlements('business')?.apiAccess, true);
  assert.equal(planEntitlements('unknown'), null);
  assert.equal(limitStatus(8, 10), 'approaching');
  assert.equal(limitStatus(10, 10), 'reached');
});

test('observability API is super-admin only, bounded, and derives customer scope server-side', async () => {
  const route = await readFile(
    new URL('../src/app/admin/api/[action]/route.ts', import.meta.url),
    'utf8'
  );
  const server = await readFile(
    new URL('../src/lib/admin/observability.ts', import.meta.url),
    'utf8'
  );
  assert.match(route, /async function observability\(admin: \{ role: string \}\)[\s\S]*admin\.role !== 'super_admin'/);
  assert.match(route, /async function observabilityCustomers[\s\S]*admin\.role !== 'super_admin'/);
  assert.match(server, /Math\.min\(25, Math\.max\(5, input\.pageSize\)\)/);
  assert.match(server, /WITH page_users AS/);
  assert.match(server, /JOIN page_users p ON p\.id = a\.scope_id/);
  assert.match(server, /FROM store_connections c WHERE c\.userId = p\.id/);
  assert.match(server, /FROM salla_connections s[\s\S]*s\.userId = p\.id/);
  assert.match(server, /hmacPseudonym\(`observability:\$\{row\.id\}`\)/);
  assert.doesNotMatch(server, /input\.userId|request\.userId|searchParams\.get\(['"]userId/);
});

test('observability payload exposes presence and accounting metadata, never secret or customer content', async () => {
  const server = await readFile(
    new URL('../src/lib/admin/observability.ts', import.meta.url),
    'utf8'
  );
  assert.match(server, /present: presence\(name\)/);
  assert.match(server, /rawSecurityEventsExposed: false/);
  assert.match(server, /openAiCreditBalance: 'not_available_via_application_api'/);
  assert.doesNotMatch(server, /reportJson|\bprompt\s*:/i);
  assert.doesNotMatch(server, /apiKey\s*:/i);
  assert.doesNotMatch(server, /email:\s*row\./i);
});

test('observability migration uses durable O(1) summaries and explicitly tracks write-time AI metadata', async () => {
  const migration = await readFile(
    new URL('../migrations/0019_admin_observability.sql', import.meta.url),
    'utf8'
  );
  assert.match(migration, /CREATE TABLE IF NOT EXISTS admin_ai_usage_daily/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS admin_observability_summary/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS admin_plan_summary/);
  assert.match(migration, /CREATE TRIGGER IF NOT EXISTS admin_ai_usage_finalize/);
  assert.match(migration, /latency_le_5000/);
  assert.match(migration, /provider_status/);
  assert.doesNotMatch(migration, /api_key|prompt|report_json/i);
});

test('missing Cloudflare telemetry and expensive integrity checks remain explicitly unknown', async () => {
  const server = await readFile(
    new URL('../src/lib/admin/observability.ts', import.meta.url),
    'utf8'
  );
  assert.match(server, /cpuObservations: null, errors1102: null, errors503: null/);
  assert.match(server, /waf: 'unknown', rateLimit: 'unknown'/);
  assert.match(server, /integrity: 'not_run_on_dashboard'/);
  assert.match(server, /migration0014: 'intentionally_skipped_in_production_runbook'/);
  assert.match(server, /reason: 'authenticated_cloudflare_telemetry_unavailable', lastCheckedAt: now/);
  assert.match(server, /deliveryHistory: 'not_recorded'/);
  assert.match(server, /stagingStatus: 'not_configured_in_staging'/);
  assert.match(server, /expectedWrites: 11162/);
});

test('Salla integration health is separate from deterministic customer-store aggregates', async () => {
  const server = await readFile(
    new URL('../src/lib/admin/observability.ts', import.meta.url),
    'utf8'
  );
  assert.match(server, /integrationHealth: \{ status: 'unknown'/);
  assert.match(server, /customerStores: \{/);
  assert.match(server, /activeHealthy: number\(sallaAggregate\?\.active_healthy\)/);
  assert.match(server, /reconnectRequired: number\(sallaAggregate\?\.reconnect_required\)/);
  assert.match(server, /inactive: number\(sallaAggregate\?\.inactive\)/);
  assert.match(server, /failedSyncs: null/);
  assert.doesNotMatch(server, /authorizerEmail|authorizerName/);
});

test('Admin observability layout is responsive at 390px and inherits RTL/LTR direction', async () => {
  const component = await readFile(
    new URL('../src/app/admin/observability-dashboard.tsx', import.meta.url),
    'utf8'
  );
  const portal = await readFile(
    new URL('../src/app/admin/portal.tsx', import.meta.url),
    'utf8'
  );
  assert.match(component, /overflow-x-clip/);
  assert.match(component, /grid-cols-2 gap-2 sm:grid-cols-3/);
  assert.match(component, /min-h-11/);
  assert.doesNotMatch(component, /min-w-\[(?:4|5|6|7|8|9)\d{2}px\]/);
  assert.match(portal, /dir=\{lang === 'ar' \? 'rtl' : 'ltr'\}/);
  assert.match(portal, /<ObservabilityDashboard lang=\{lang\}/);
});
