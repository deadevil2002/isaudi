import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
// @ts-expect-error Node 22 provides node:sqlite; the project intentionally retains Node 20 type declarations.
import { DatabaseSync } from 'node:sqlite';
import {
  aovBand,
  createCrossStoreAggregationService,
  deriveFindingContributions,
  evaluateSampleGate,
  findingWindowScope,
  isCoarseMonthWindow,
  marginBand,
  orderVolumeBand,
  platformSegment,
  productCountBand,
  revenueBand,
  type CrossStoreDb,
} from '../src/lib/cross-store/aggregation';

const ANALYZED_AT = Date.UTC(2026, 9, 3, 13, 27, 41);
const FINDING = 'landing.cta.missing.v1';

function database() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys=ON; CREATE TABLE users (id TEXT PRIMARY KEY);');
  sqlite.exec(readFileSync(new URL(
    '../migrations/staging/0002_cross_store_aggregation_foundation.sql',
    import.meta.url
  ), 'utf8'));
  const db: CrossStoreDb = {
    prepare(sql: string) {
      const statement = sqlite.prepare(sql);
      return {
        get: async (...params: unknown[]) => statement.get(...params as never[]) as Record<string, unknown> | undefined,
        all: async (...params: unknown[]) => statement.all(...params as never[]) as Record<string, unknown>[],
        run: async (...params: unknown[]) => statement.run(...params as never[]),
      };
    },
    async batch(operations) {
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        for (const operation of operations) {
          sqlite.prepare(operation.sql).run(...(operation.params ?? []) as never[]);
        }
        sqlite.exec('COMMIT');
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
  return { sqlite, service: createCrossStoreAggregationService(db, true) };
}

function contribution(tenantId: string, findingCode = FINDING) {
  return deriveFindingContributions({
    tenantId,
    platform: 'salla',
    analyzedAt: ANALYZED_AT,
    analyzerVersion: 'landing_page_analyzer_v1',
    findings: [{ findingCode, confidence: 'high' }],
  });
}

async function seedTenants(count: number) {
  const fixture = database();
  for (let index = 1; index <= count; index += 1) {
    const tenantId = `synthetic-phase7b-${index}`;
    fixture.sqlite.prepare('INSERT INTO users(id) VALUES (?)').run(tenantId);
    await fixture.service.replaceTenantFindingContributions({
      tenantId,
      scope: findingWindowScope(ANALYZED_AT),
      contributions: contribution(tenantId),
    });
  }
  return fixture;
}

test('versioned buckets discard exact count and financial values', () => {
  assert.equal(orderVolumeBand(1_247), 'orders:1000+');
  assert.equal(productCountBand(127), 'products:50-199');
  assert.equal(revenueBand(1_874_200), 'revenue_sar:10000-49999');
  assert.equal(aovBand(18_373), 'aov_sar:100-249');
  assert.equal(marginBand(3_241), 'margin:25-39');
  assert.throws(() => platformSegment('merchant-123'), /allowlist/);
});

test('19 tenants are suppressed and 20/21 are only eligible for later validation', async () => {
  const nineteen = await seedTenants(19);
  const [suppressed] = await nineteen.service.readValidationCells();
  assert.equal(suppressed.tenantCount, 19);
  assert.equal(suppressed.observationCount, 19);
  assert.equal(suppressed.validationStatus, 'suppressed');
  assert.equal(suppressed.suppressionReason, 'small_sample');

  for (const count of [20, 21]) {
    const fixture = await seedTenants(count);
    const [eligible] = await fixture.service.readValidationCells();
    assert.equal(eligible.tenantCount, count);
    assert.equal(eligible.observationCount, count);
    assert.equal(eligible.validationStatus, 'eligible_for_validation');
    assert.equal(eligible.suppressionReason, null);
  }
});

test('outcome gate remains non-persistent and requires the provisional 30 tenants', () => {
  assert.equal(evaluateSampleGate('outcome', 29).status, 'suppressed');
  assert.equal(evaluateSampleGate('outcome', 30).status, 'eligible_for_validation');
  assert.equal(evaluateSampleGate('outcome', 31).status, 'eligible_for_validation');
  assert.equal(evaluateSampleGate('outcome', 30).provisional, true);
});

test('multiple stores and repeated rows from one tenant remain one contribution', async () => {
  const { sqlite, service } = database();
  sqlite.prepare('INSERT INTO users(id) VALUES (?)').run('synthetic-multi-store');
  for (let index = 0; index < 50; index += 1) {
    await service.replaceTenantFindingContributions({
      tenantId: 'synthetic-multi-store',
      scope: findingWindowScope(ANALYZED_AT),
      contributions: contribution('synthetic-multi-store'),
    });
  }
  const privateCount = sqlite.prepare(
    'SELECT COUNT(*) count FROM cross_store_private_contributions'
  ).get() as { count: number };
  assert.equal(privateCount.count, 1);
  const [cell] = await service.readValidationCells();
  assert.equal(cell.tenantCount, 1);
  assert.equal(cell.observationCount, 1);
  assert.equal(cell.validationStatus, 'suppressed');
});

test('deletion recomputes 20 tenants to 19 and suppresses the cell', async () => {
  const { sqlite, service } = await seedTenants(20);
  await service.removeTenantContributions('synthetic-phase7b-20');
  const [cell] = await service.readValidationCells();
  assert.equal(cell.tenantCount, 19);
  assert.equal(cell.observationCount, 19);
  assert.equal(cell.validationStatus, 'suppressed');
  assert.equal(cell.suppressionReason, 'small_sample');
  assert.doesNotThrow(() => sqlite.prepare(
    "DELETE FROM users WHERE id='synthetic-phase7b-20'"
  ).run());
});

test('recomputation and repeated aggregation are deterministic and idempotent', async () => {
  const { sqlite, service } = await seedTenants(20);
  const before = await service.readValidationCells();
  const privateBefore = sqlite.prepare(
    'SELECT COUNT(*) count FROM cross_store_private_contributions'
  ).get() as { count: number };
  await service.replaceTenantFindingContributions({
    tenantId: 'synthetic-phase7b-1',
    scope: findingWindowScope(ANALYZED_AT),
    contributions: contribution('synthetic-phase7b-1'),
  });
  const after = await service.readValidationCells();
  const privateAfter = sqlite.prepare(
    'SELECT COUNT(*) count FROM cross_store_private_contributions'
  ).get() as { count: number };
  assert.deepEqual(after, before);
  assert.equal(privateAfter.count, privateBefore.count);
  assert.equal(sqlite.prepare('SELECT COUNT(*) count FROM cross_store_aggregate_cells')
    .get().count, 1);
});

test('validation output has a coarse window and no identity, URL, raw, or exact-value fields', async () => {
  const { service } = await seedTenants(20);
  const [cell] = await service.readValidationCells();
  assert.ok(isCoarseMonthWindow(cell.observationWindowStart));
  const serialized = JSON.stringify(cell);
  for (const forbidden of [
    'userId', 'tenantId', 'storeId', 'merchantId', 'email', 'phone', 'http',
    'tenantHash', 'exactRevenue', 'productName', 'rawJson', '18,742',
  ]) assert.equal(serialized.includes(forbidden), false, `leaked ${forbidden}`);
});

test('rare and combined segments fail closed while extreme values remain coarse', () => {
  for (const unsafeSegment of [
    'category:one-tenant-niche',
    'platform:salla|category:rare',
    'https://merchant.example',
  ]) assert.throws(() => platformSegment(unsafeSegment), /allowlist/);

  assert.equal(orderVolumeBand(Number.MAX_SAFE_INTEGER), 'orders:1000+');
  assert.equal(productCountBand(Number.MAX_SAFE_INTEGER), 'products:200+');
  assert.equal(revenueBand(Number.MAX_SAFE_INTEGER), 'revenue_sar:250000+');
  assert.equal(aovBand(Number.MAX_SAFE_INTEGER), 'aov_sar:500+');
  assert.equal(marginBand(Number.MAX_SAFE_INTEGER), 'margin:40+');
});

test('small samples, dominance, differencing, and repeated membership reads remain suppressed', async () => {
  const { service } = await seedTenants(19);
  const firstRead = await service.readValidationCells();
  const secondRead = await service.readValidationCells();

  assert.deepEqual(secondRead, firstRead);
  assert.equal(firstRead.length, 1);
  assert.equal(firstRead[0].tenantCount, 19);
  assert.equal(firstRead[0].validationStatus, 'suppressed');
  assert.equal(firstRead[0].suppressionReason, 'small_sample');

  const serialized = JSON.stringify(firstRead);
  for (let index = 1; index <= 19; index += 1) {
    assert.equal(serialized.includes(`synthetic-phase7b-${index}`), false);
  }
});

test('an empty replacement clears stale findings and deterministically removes the cell', async () => {
  const { service } = await seedTenants(1);
  await service.replaceTenantFindingContributions({
    tenantId: 'synthetic-phase7b-1',
    scope: findingWindowScope(ANALYZED_AT),
    contributions: [],
  });
  assert.deepEqual(await service.readValidationCells(), []);
});

test('feature flag fails closed before any contribution write', async () => {
  const { sqlite } = database();
  sqlite.prepare('INSERT INTO users(id) VALUES (?)').run('synthetic-disabled');
  const disabled = createCrossStoreAggregationService({
    prepare(sql: string) {
      const statement = sqlite.prepare(sql);
      return {
        get: async (...params: unknown[]) => statement.get(...params as never[]) as Record<string, unknown> | undefined,
        all: async (...params: unknown[]) => statement.all(...params as never[]) as Record<string, unknown>[],
        run: async (...params: unknown[]) => statement.run(...params as never[]),
      };
    },
    async batch() { throw new Error('batch must not run'); },
  }, false);
  await assert.rejects(
    disabled.replaceTenantFindingContributions({
      tenantId: 'synthetic-disabled',
      scope: findingWindowScope(ANALYZED_AT),
      contributions: contribution('synthetic-disabled'),
    }),
    /feature flag is disabled/
  );
});
