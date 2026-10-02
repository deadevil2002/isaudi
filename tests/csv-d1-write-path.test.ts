import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const serviceUrl = new URL('../src/lib/db/service.ts', import.meta.url);
const uploadUrl = new URL('../src/app/api/connect/csv/upload/route.ts', import.meta.url);
const pageUrl = new URL('../src/app/(authenticated)/connect/csv/page.tsx', import.meta.url);

function method(source: string, name: string, nextName: string): string {
  const match = source.match(new RegExp(`${name}:[\\s\\S]*?${nextName}:`));
  assert.ok(match, `missing ${name} method`);
  return match[0];
}

test('CSV D1 writes use awaited positional bindings and propagate failures', async () => {
  const source = await readFile(serviceUrl, 'utf8');
  const blocks = [
    method(source, 'createOrUpdateStoreConnection', 'disconnectStore'),
    method(source, 'upsertProduct', 'getProductByExternalId'),
    method(source, 'upsertProductCost', 'addOrder'),
    method(source, 'addOrder', 'insertOrderItem'),
    method(source, 'insertOrderItem', 'upsertOrder'),
    method(source, 'createEmptyReport', 'updateReportJsonForUser'),
  ];

  for (const block of blocks) {
    assert.match(block, /await db\.prepare\(/);
    assert.doesNotMatch(block, /\.run\(\s*\{/);
    assert.doesNotMatch(block, /@[a-z_]/i);
    assert.doesNotMatch(block, /void db\.prepare|\.catch\(/);
  }
});

test('CSV upload awaits products, orders, items, and report before success', async () => {
  const source = await readFile(uploadUrl, 'utf8');
  for (const operation of [
    'createOrUpdateStoreConnection',
    'createEmptyReport',
    'upsertProduct',
    'upsertProductCost',
    'addOrder',
    'insertOrderItem',
  ]) {
    assert.match(source, new RegExp(`await dbService\\.${operation}\\(`));
  }

  const report = source.indexOf('await dbService.createEmptyReport');
  const product = source.indexOf('await dbService.upsertProduct');
  const order = source.indexOf('await dbService.addOrder');
  const item = source.indexOf('await dbService.insertOrderItem');
  const success = source.indexOf('return NextResponse.json({', item);
  assert.ok(report < product && product < order && order < item && item < success);
  assert.match(source, /catch \(error\)[\s\S]*status: 500/);
});

test('CSV product upsert prevents duplicate tenant/external-id inserts', async () => {
  const source = await readFile(serviceUrl, 'utf8');
  const block = method(source, 'upsertProduct', 'getProductByExternalId');
  assert.match(block, /WHERE userId = \? AND externalId = \?/);
  assert.match(block, /if \(existing\)[\s\S]*UPDATE products/);
  assert.match(block, /else[\s\S]*INSERT INTO products/);
});

test('report generation starts only after the CSV upload response succeeds', async () => {
  const page = await readFile(pageUrl, 'utf8');
  const uploadCheck = page.indexOf('if (!uploadRes.ok)');
  const generation = page.indexOf("fetch('/api/analysis/generate'");
  assert.ok(uploadCheck >= 0 && generation > uploadCheck);
});
