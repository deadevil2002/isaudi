import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { pickReportViewData } from '../src/lib/dashboard/report-view-data';

const source = (path: string) => readFile(new URL(path, import.meta.url), 'utf8');

test('dashboard report projection keeps first-paint fields and drops unused bulk', () => {
  const original = {
    metrics: { totalOrders: 12, totalSales: 3400 },
    profitability: { missingCostProductsCount: 2 },
    summary: 'Useful summary',
    rawOrders: Array.from({ length: 500 }, (_, index) => ({ id: index, payload: 'x'.repeat(100) })),
  };
  const projected = pickReportViewData(original);

  assert.deepEqual(projected.metrics, original.metrics);
  assert.deepEqual(projected.profitability, original.profitability);
  assert.equal(projected.summary, original.summary);
  assert.equal('rawOrders' in projected, false);
  assert.ok(JSON.stringify(projected).length < JSON.stringify(original).length / 10);
});

test('dashboard report parsing fails closed for malformed historical JSON', async () => {
  const { parseReportViewData } = await import('../src/lib/dashboard/report-view-data');
  assert.deepEqual(parseReportViewData('{not-json'), {});
});

test('dashboard initial data uses narrow parallel reads without full report rows', async () => {
  const [page, dashboardData, auth] = await Promise.all([
    source('../src/app/(authenticated)/dashboard/page.tsx'),
    source('../src/lib/dashboard/data.ts'),
    source('../src/lib/auth/utils.ts'),
  ]);
  assert.match(page, /Promise\.all\(\[/);
  assert.match(page, /hasStoreConnection/);
  assert.match(page, /getLatestDashboardReport/);
  assert.doesNotMatch(page, /getLatestReport\(/);
  assert.match(dashboardData, /SELECT 1 AS connected FROM store_connections/);
  const projection = dashboardData.match(/const REPORT_VIEW_PROJECTION[\s\S]*?export type DashboardReportRow/)?.[0] || '';
  assert.match(projection, /json_object\(/);
  assert.doesNotMatch(projection, /SELECT \*/);
  assert.doesNotMatch(auth, /SELECT \* FROM sessions/);
  assert.doesNotMatch(auth, /SELECT \*, free_reports_used/);
});

test('Admin initial bootstrap is one authenticated request with one overview payload', async () => {
  const [portal, route] = await Promise.all([
    source('../src/app/admin/portal.tsx'),
    source('../src/app/admin/api/[action]/route.ts'),
  ]);
  assert.match(portal, /api\('bootstrap'\)/);
  assert.doesNotMatch(portal, /api\('status'\)/);
  assert.doesNotMatch(portal, /api\('data'\)/);
  assert.match(route, /async function adminBootstrap\(\)/);
  assert.match(route, /action === 'bootstrap'/);
  assert.match(route, /data: await portalData\(admin\)/);
});
