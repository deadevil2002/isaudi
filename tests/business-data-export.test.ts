import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  BUSINESS_EXPORT_MAX_BYTES,
  BUSINESS_EXPORT_MAX_ROWS,
  buildBusinessReportCsv,
  createBusinessDataExportHandler,
  type BusinessExportD1,
} from '../src/lib/export/business-data';
import { getPlanLimits } from '../src/lib/subscription/plans';
import { pricingFeaturesForPlan } from '../src/lib/pricing/feature-matrix';

const user = { id: 'tenant-a' };
const business = {
  isActiveNow: true,
  limits: { dataExport: true },
};

function request(query = '') {
  return new Request(`https://example.test/api/export/business-data${query}`);
}

function database(rows: Array<Record<string, unknown>> = []) {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const db = {
    prepare(sql: string) {
      let values: unknown[] = [];
      const statement = {
        bind(...next: unknown[]) {
          values = next;
          return statement;
        },
        async first() {
          return { count: 1 };
        },
        async all() {
          calls.push({ sql, values });
          return { results: rows };
        },
      };
      return statement;
    },
  } as BusinessExportD1;
  return { db, calls };
}

type HandlerOptions = Parameters<typeof createBusinessDataExportHandler>[0];

function handler(options: HandlerOptions = {}) {
  const { db } = database();
  return createBusinessDataExportHandler({
    getUser: async () => user,
    getEntitlements: async () => business,
    getDb: () => db,
    consumeLimit: async () => ({ allowed: true, retryAfter: 0 }),
    now: () => Date.UTC(2026, 9, 3),
    ...options,
  });
}

test('data export entitlement is active Business-only and drives the pricing matrix', () => {
  assert.equal(getPlanLimits('free').dataExport, false);
  assert.equal(getPlanLimits('starter').dataExport, false);
  assert.equal(getPlanLimits('growth').dataExport, false);
  assert.equal(getPlanLimits('business').dataExport, true);
  const businessFeature = pricingFeaturesForPlan('business').find(item => item.id === 'dataExport');
  assert.equal(businessFeature?.included, true);
});

test('unauthenticated and expired sessions cannot export', async () => {
  for (const getUser of [async () => null, async () => null]) {
    const response = await handler({ getUser })(request());
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
  }
});

test('Starter, Growth, inactive, and expired Business entitlements are denied server-side', async () => {
  const denied = [
    { isActiveNow: true, limits: { dataExport: getPlanLimits('starter').dataExport } },
    { isActiveNow: true, limits: { dataExport: getPlanLimits('growth').dataExport } },
    { isActiveNow: false, limits: { dataExport: true } },
  ];
  for (const entitlement of denied) {
    const response = await handler({ getEntitlements: async () => entitlement })(request());
    assert.equal(response.status, 403);
  }
});

test('export rejects tenant, store, path, and pagination selectors instead of trusting request input', async () => {
  for (const query of ['?userId=tenant-b', '?tenantId=tenant-b', '?storeId=store-b', '?limit=999999', '?path=../../admin']) {
    const response = await handler()(request(query));
    assert.equal(response.status, 400);
  }
});

test('valid export is one bounded tenant query with a safe CSV and no private fields', async () => {
  const { db, calls } = database([{
    id: 'internal-snapshot-id',
    user_id: 'tenant-a',
    report_id: 'internal-report-id',
    report_json: '{"prompt":"private AI content"}',
    created_at: 1_780_704_000_000,
    time_range_start: 1_780_099_200_000,
    time_range_end: 1_780_704_000_000,
    gross_sales_halala: 12345,
    orders_count: 7,
    total_profit_halala: 4321,
    margin_pct_x100: 3500,
    missing_cost_products_count: 2,
    missing_cost_sales_halala: 505,
    accessTokenEncrypted: 'secret-token',
    commission_rate_bps: 1000,
  }]);
  const response = await handler({ getDb: () => db })(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'text/csv; charset=utf-8');
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.match(response.headers.get('content-disposition') || '', /isaudi-report-summaries-2026-10-03\.csv/);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].values, ['tenant-a', BUSINESS_EXPORT_MAX_ROWS]);
  assert.match(calls[0].sql, /WHERE user_id = \?/);
  assert.match(calls[0].sql, /ORDER BY time_range_end DESC/);
  assert.match(calls[0].sql, /LIMIT \?/);
  assert.doesNotMatch(calls[0].sql, /report_json|accessToken|refreshToken|partner|commission|SELECT\s+\*/i);
  const body = await response.text();
  assert.match(body, /"gross_sales_sar"/);
  assert.match(body, /"123\.45"/);
  assert.match(body, /"43\.21"/);
  assert.match(body, /"35\.00"/);
  assert.doesNotMatch(body, /internal-|tenant-a|private AI|secret-token|1000/);
});

test('empty exports remain valid and large exports stay within row and byte bounds', async () => {
  const empty = await handler()(request());
  assert.equal(empty.status, 200);
  assert.equal((await empty.text()).split('\r\n').length, 1);

  const row = {
    created_at: 1_780_704_000_000,
    time_range_start: 1_780_099_200_000,
    time_range_end: 1_780_704_000_000,
    gross_sales_halala: 12345,
    orders_count: 7,
    total_profit_halala: 4321,
    margin_pct_x100: 3500,
    missing_cost_products_count: 2,
    missing_cost_sales_halala: 505,
  };
  const csv = buildBusinessReportCsv(Array.from({ length: BUSINESS_EXPORT_MAX_ROWS + 50 }, () => row));
  assert.equal(csv.split('\r\n').length, BUSINESS_EXPORT_MAX_ROWS + 1);
  assert.ok(new TextEncoder().encode(csv).byteLength <= BUSINESS_EXPORT_MAX_BYTES);
});

test('rate-limit exhaustion returns 429 without querying export data', async () => {
  const { db, calls } = database();
  const response = await handler({
    getDb: () => db,
    consumeLimit: async () => ({ allowed: false, retryAfter: 42 }),
  })(request());
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('retry-after'), '42');
  assert.equal(calls.length, 0);
});

test('D1 failures propagate as a generic no-store service error', async () => {
  const db = {
    prepare() {
      return {
        bind() { return this; },
        async first() { return { count: 1 }; },
        async all() { throw new Error('sensitive D1 detail'); },
      };
    },
  } as BusinessExportD1;
  const original = console.error;
  const messages: unknown[][] = [];
  console.error = (...values: unknown[]) => { messages.push(values); };
  try {
    const response = await handler({ getDb: () => db })(request());
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'Export unavailable' });
    assert.deepEqual(messages, [['[business-data-export] Request failed']]);
  } finally {
    console.error = original;
  }
});

test('Settings exposes the export only through the real entitlement and never accepts selectors', () => {
  const settings = readFileSync(
    new URL('../src/app/(authenticated)/settings/settings-client.tsx', import.meta.url),
    'utf8',
  );
  assert.match(settings, /subscription\?\.limits\.dataExport === true/);
  assert.match(settings, /fetch\("\/api\/export\/business-data"/);
  assert.doesNotMatch(settings, /userId=|tenantId=|storeId=/);
  assert.match(settings, /aria-busy=\{exporting\}/);
});
