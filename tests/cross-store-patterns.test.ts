import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
// @ts-expect-error Node 22 provides node:sqlite; the project intentionally retains Node 20 type declarations.
import { DatabaseSync } from 'node:sqlite';
import {
  CROSS_STORE_AGGREGATION_VERSION,
  CROSS_STORE_DATA_CONTRACT_VERSION,
  CROSS_STORE_METRIC_VERSION,
  CROSS_STORE_PRIVACY_POLICY_VERSION,
  CROSS_STORE_SEGMENT_VERSION,
  type AggregateCell,
  type CrossStoreDb,
} from '../src/lib/cross-store/aggregation';
import {
  PREVALENCE_PATTERN_VERSION,
  SHARED_PATTERN_ALLOWED_FIELDS,
  SHARED_PATTERN_FORBIDDEN_FIELDS,
  assertSharedPatternContract,
  candidateFromAggregate,
  createPatternGenerationService,
} from '../src/lib/cross-store/patterns';

const WINDOW = Date.UTC(2026, 9, 1);

function cell(tenantCount: number, overrides: Partial<AggregateCell> = {}): AggregateCell {
  return {
    observationWindowKind: 'month', observationWindowStart: WINDOW,
    segmentKey: 'platform:salla', findingCode: 'landing.cta.missing.v1',
    metricCode: 'finding_prevalence', valueBand: 'present',
    measurementQuality: 'high', analyzerVersion: 'landing_page_analyzer_v1',
    dataContractVersion: CROSS_STORE_DATA_CONTRACT_VERSION,
    segmentVersion: CROSS_STORE_SEGMENT_VERSION,
    metricVersion: CROSS_STORE_METRIC_VERSION,
    aggregationVersion: CROSS_STORE_AGGREGATION_VERSION,
    privacyPolicyVersion: CROSS_STORE_PRIVACY_POLICY_VERSION,
    tenantCount, observationCount: tenantCount,
    validationStatus: tenantCount >= 20 ? 'eligible_for_validation' : 'suppressed',
    suppressionReason: tenantCount >= 20 ? null : 'small_sample',
    ...overrides,
  };
}

function database() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../migrations/staging/0002_cross_store_aggregation_foundation.sql', import.meta.url), 'utf8'));
  sqlite.exec(readFileSync(new URL('../migrations/staging/0003_cross_store_candidate_patterns.sql', import.meta.url), 'utf8'));
  const db: CrossStoreDb = {
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      return {
        get: async (...params) => statement.get(...params as never[]) as Record<string, unknown> | undefined,
        all: async (...params) => statement.all(...params as never[]) as Record<string, unknown>[],
        run: async (...params) => statement.run(...params as never[]),
      };
    },
    async batch(operations) {
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        for (const operation of operations) sqlite.prepare(operation.sql).run(...(operation.params ?? []) as never[]);
        sqlite.exec('COMMIT');
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
  return { sqlite, service: createPatternGenerationService(db, true) };
}

test('19 is suppressed while 20 and 21 create deterministic non-active candidates', async () => {
  for (const count of [19, 20, 21]) {
    const pattern = await candidateFromAggregate(cell(count));
    assert.equal(pattern.lifecycleStatus, count < 20 ? 'suppressed' : 'candidate');
    assert.equal(pattern.suppressionReason, count < 20 ? 'small_sample' : null);
    assert.equal(pattern.tenantDiversity, count);
    assert.equal(pattern.effectBand, 'not_applicable_prevalence');
    assert.notEqual(pattern.lifecycleStatus, 'active');
  }
});

test('outcome patterns remain absent at 29, 30, and 31 tenants', async () => {
  for (const count of [29, 30, 31]) {
    const pattern = await candidateFromAggregate(cell(count));
    assert.equal('outcomeMetricCode' in pattern, false);
    assert.equal('interventionCode' in pattern, false);
    assert.equal(pattern.evidenceClass, 'observed_association');
  }
});

test('same semantic aggregate is idempotent and a version change has a new identity', async () => {
  const { sqlite, service } = database();
  const [first] = await service.generateChangedCells([cell(20)]);
  const [second] = await service.generateChangedCells([cell(20)]);
  assert.equal(second.patternId, first.patternId);
  assert.equal(sqlite.prepare('SELECT COUNT(*) count FROM cross_store_candidate_patterns').get().count, 1);
  const changed = await candidateFromAggregate(cell(20, { analyzerVersion: 'landing_page_analyzer_v2' }));
  assert.notEqual(changed.patternId, first.patternId);
  assert.equal(first.patternVersion, PREVALENCE_PATTERN_VERSION);
});

test('multi-store ownership remains one tenant while 20 distinct tenants qualify', async () => {
  const oneTenantTenStores = await candidateFromAggregate(cell(1));
  const twentyDistinctTenants = await candidateFromAggregate(cell(20));
  assert.equal(oneTenantTenStores.tenantDiversity, 1);
  assert.equal(oneTenantTenStores.lifecycleStatus, 'suppressed');
  assert.equal(twentyDistinctTenants.tenantDiversity, 20);
  assert.equal(twentyDistinctTenants.lifecycleStatus, 'candidate');
});

test('incompatible versions, rare segments, combined dimensions, and exact time fail before writes', async () => {
  const { sqlite, service } = database();
  const invalid = [
    cell(20, { metricVersion: 'other' as AggregateCell['metricVersion'] }),
    cell(20, { segmentKey: 'platform:salla|category:rare' as AggregateCell['segmentKey'] }),
    cell(20, { observationWindowStart: WINDOW + 1234 }),
  ];
  for (const source of invalid) await assert.rejects(service.generateChangedCells([source]));
  assert.equal(sqlite.prepare('SELECT COUNT(*) count FROM cross_store_candidate_patterns').get().count, 0);
});

test('dominance/unbounded observations and low quality are suppressed', async () => {
  const dominant = await candidateFromAggregate(cell(20, { observationCount: 200 }));
  assert.equal(dominant.lifecycleStatus, 'suppressed');
  assert.equal(dominant.suppressionReason, 'privacy_risk');
  const low = await candidateFromAggregate(cell(20, { measurementQuality: 'low' }));
  assert.equal(low.lifecycleStatus, 'suppressed');
  assert.equal(low.suppressionReason, 'low_measurement_quality');
});

test('deletion recomputation updates the same candidate from 20 to suppressed 19', async () => {
  const { sqlite, service } = database();
  const [before] = await service.generateChangedCells([cell(20)]);
  const [after] = await service.generateChangedCells([cell(19)]);
  assert.equal(after.patternId, before.patternId);
  assert.equal(after.lifecycleStatus, 'suppressed');
  assert.equal(after.suppressionReason, 'small_sample');
  const row = sqlite.prepare('SELECT lifecycle_status,sample_size FROM cross_store_candidate_patterns').get() as {
    lifecycle_status: string; sample_size: number;
  };
  assert.equal(row.lifecycle_status, 'suppressed');
  assert.equal(row.sample_size, 19);
});

test('machine-readable contract allowlist and forbidden names are enforced recursively', async () => {
  const contract = JSON.parse(readFileSync(new URL('../docs/phase-7/cross-store-data-contract.v1.json', import.meta.url), 'utf8'));
  assert.deepEqual([...SHARED_PATTERN_ALLOWED_FIELDS], contract.sharedPattern.allowedFields);
  assert.deepEqual([...SHARED_PATTERN_FORBIDDEN_FIELDS], contract.sharedPattern.forbiddenFieldNames);
  const pattern = await candidateFromAggregate(cell(20));
  assert.doesNotThrow(() => assertSharedPatternContract(pattern));
  for (const forbidden of contract.sharedPattern.forbiddenFieldNames) {
    assert.equal(JSON.stringify(pattern).toLowerCase().includes(String(forbidden).toLowerCase()), false);
  }
  assert.throws(() => assertSharedPatternContract({ ...pattern, confidenceComponents: { tenantId: 'hidden' } }), /forbidden/);
  for (const field of [
    'rawOrder', 'rawProduct', 'rawCustomer', 'privateReport', 'privatePrompt',
    'privateChat', 'exactOrderCount', 'exactAov', 'exactCost',
  ]) {
    assert.throws(
      () => assertSharedPatternContract({
        ...pattern,
        confidenceComponents: { nested: [{ [field]: 'hidden' }] },
      }),
      /forbidden/,
      field,
    );
  }
});

test('re-identification probes remain suppressed or rejected without identity leakage', async () => {
  const small = await candidateFromAggregate(cell(1));
  const repeated = await candidateFromAggregate(cell(1));
  assert.deepEqual(repeated, small);
  assert.equal(small.lifecycleStatus, 'suppressed');
  assert.equal(small.freshness.policy, 'provisional_not_approved');
  const serialized = JSON.stringify(small);
  for (const marker of ['synthetic-tenant', 'merchant', 'http://', 'https://', '@', 'exactTimestamp']) {
    assert.equal(serialized.includes(marker), false);
  }
});

test('bounded generation reads aggregate cells only and customer flag fails closed', async () => {
  const { sqlite, service } = database();
  sqlite.prepare(`INSERT INTO cross_store_aggregate_cells VALUES (
    'month',?,'platform:salla','landing.cta.missing.v1','finding_prevalence','present',
    'landing_page_analyzer_v1',?,?,?,?,?,20,20,'high','eligible_for_validation',NULL
  )`).run(WINDOW, CROSS_STORE_DATA_CONTRACT_VERSION, CROSS_STORE_SEGMENT_VERSION,
    CROSS_STORE_METRIC_VERSION, CROSS_STORE_AGGREGATION_VERSION, CROSS_STORE_PRIVACY_POLICY_VERSION);
  const generated = await service.generateBounded(1);
  assert.equal(generated.length, 1);
  assert.equal(generated[0].lifecycleStatus, 'candidate');
  const disabled = createPatternGenerationService({
    prepare() { throw new Error('must not read'); },
    async batch() { throw new Error('must not write'); },
  }, false);
  await assert.rejects(disabled.generateBounded(), /feature flag is disabled/);
});
