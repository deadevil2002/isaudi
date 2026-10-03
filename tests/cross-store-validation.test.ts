import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
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
  candidateFromAggregate,
  createPatternGenerationService,
  type CandidatePattern,
} from '../src/lib/cross-store/patterns';
import {
  DEFAULT_PATTERN_VALIDATION_POLICY,
  createPatternValidationService,
  validatePattern,
} from '../src/lib/cross-store/validation';

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
  for (const migration of [
    '0002_cross_store_aggregation_foundation.sql',
    '0003_cross_store_candidate_patterns.sql',
    '0004_cross_store_pattern_validation.sql',
  ]) sqlite.exec(readFileSync(new URL(`../migrations/staging/${migration}`, import.meta.url), 'utf8'));
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
  return {
    sqlite,
    generation: createPatternGenerationService(db, true),
    validation: createPatternValidationService(db, true),
    db,
  };
}

test('19 suppresses while 20 and 21 validate under provisional staging gates', async () => {
  for (const count of [19, 20, 21]) {
    const pattern = await candidateFromAggregate(cell(count));
    const result = validatePattern(pattern);
    assert.equal(result.validationStatus, count < 20 ? 'suppressed' : 'validated');
    assert.equal(result.suppressionReason, count < 20 ? 'small_sample' : null);
    assert.equal(result.freshnessStatus, 'provisional_validated_no_activation');
    assert.equal(result.distinctTenantCount, count);
  }
});

test('multi-store, repeated rows, and dominant observations cannot inflate tenant diversity', async () => {
  const tenStoresOneTenant = validatePattern(await candidateFromAggregate(cell(1)));
  assert.equal(tenStoresOneTenant.distinctTenantCount, 1);
  assert.equal(tenStoresOneTenant.validationStatus, 'suppressed');
  const dominant = validatePattern(await candidateFromAggregate(cell(20, { observationCount: 200 })));
  assert.equal(dominant.validationStatus, 'suppressed');
  assert.ok(dominant.failedGates.includes('dominance'));
  assert.equal(dominant.privacyRisk, 'detected');
});

test('rare, combined, timed, extreme, and nested identity probes fail closed', async () => {
  const base = await candidateFromAggregate(cell(20));
  const attacks: CandidatePattern[] = [
    { ...base, anonymousSegment: 'platform:salla|category:rare' as CandidatePattern['anonymousSegment'] },
    { ...base, findingCode: 'landing.rare.unique-store.v1' },
    { ...base, effectBand: '17842_sar' as CandidatePattern['effectBand'] },
    { ...base, observationWindow: '2026-10-03T10:11:12.123Z' },
    { ...base, confidenceComponents: { ...base.confidenceComponents, tenantId: 'hidden' } as never },
  ];
  for (const attack of attacks) {
    const result = validatePattern(attack);
    assert.equal(result.validationStatus, 'suppressed');
    assert.ok(result.failedGates.includes('data_contract') || result.failedGates.includes('schema'));
  }
});

test('outcome and causal fields remain impossible at 29, 30, and 31 tenants', async () => {
  for (const count of [29, 30, 31]) {
    const pattern = await candidateFromAggregate(cell(count));
    const causal = { ...pattern, outcomeMetricCode: 'conversion_rate' } as CandidatePattern;
    const result = validatePattern(causal);
    assert.equal(result.validationStatus, 'suppressed');
    assert.ok(result.failedGates.includes('causality'));
  }
});

test('validation persists deterministically and repeated runs create no duplicate state', async () => {
  const { sqlite, generation, validation } = database();
  const [pattern] = await generation.generateChangedCells([cell(20)]);
  const first = await validation.validateChangedPatterns([pattern]);
  const second = await validation.validateBounded(10);
  assert.deepEqual(second, first);
  assert.equal(sqlite.prepare('SELECT COUNT(*) count FROM cross_store_candidate_patterns').get().count, 1);
  assert.equal(sqlite.prepare('SELECT COUNT(*) count FROM cross_store_pattern_validation_results').get().count, 1);
  const row = sqlite.prepare('SELECT lifecycle_status FROM cross_store_candidate_patterns').get() as { lifecycle_status: string };
  assert.equal(row.lifecycle_status, 'validated');
});

test('deletion recomputation changes the same validated pattern from 20 to suppressed 19', async () => {
  const { sqlite, generation, validation } = database();
  const [eligible] = await generation.generateChangedCells([cell(20)]);
  await validation.validateChangedPatterns([eligible]);
  const [recomputed] = await generation.generateChangedCells([cell(19)]);
  assert.equal(recomputed.patternId, eligible.patternId);
  const [result] = await validation.validateChangedPatterns([recomputed]);
  assert.equal(result.validationStatus, 'suppressed');
  assert.equal(result.suppressionReason, 'small_sample');
  const row = sqlite.prepare('SELECT lifecycle_status,sample_size FROM cross_store_candidate_patterns').get() as {
    lifecycle_status: string; sample_size: number;
  };
  assert.equal(row.lifecycle_status, 'suppressed');
  assert.equal(row.sample_size, 19);
});

test('a newly validated analyzer version makes the old validated semantic pattern stale', async () => {
  const { sqlite, generation, validation, db } = database();
  const [oldPattern] = await generation.generateChangedCells([cell(20)]);
  await validation.validateChangedPatterns([oldPattern]);
  const [newPattern] = await generation.generateChangedCells([cell(20, { analyzerVersion: 'landing_page_analyzer_v2' })]);
  const versionTwo = createPatternValidationService(db, true, {
    ...DEFAULT_PATTERN_VALIDATION_POLICY,
    validationVersion: 'pattern_validation_v2_staging',
    analyzerVersion: 'landing_page_analyzer_v2',
  });
  const [result] = await versionTwo.validateChangedPatterns([newPattern]);
  assert.equal(result.validationStatus, 'validated');
  const rows = sqlite.prepare('SELECT pattern_id,lifecycle_status FROM cross_store_candidate_patterns ORDER BY pattern_id').all() as {
    pattern_id: string; lifecycle_status: string;
  }[];
  assert.equal(rows.find((row) => row.pattern_id === oldPattern.patternId)?.lifecycle_status, 'stale');
  assert.equal(rows.find((row) => row.pattern_id === newPattern.patternId)?.lifecycle_status, 'validated');
});

test('privacy policy change re-evaluates and suppresses an old validated pattern', async () => {
  const { sqlite, generation, validation, db } = database();
  const [pattern] = await generation.generateChangedCells([cell(20)]);
  await validation.validateChangedPatterns([pattern]);
  const changedPolicy = createPatternValidationService(db, true, {
    ...DEFAULT_PATTERN_VALIDATION_POLICY,
    validationVersion: 'pattern_validation_privacy_v2_staging',
    privacyPolicyVersion: 'cross_store_privacy_v2_provisional',
  });
  const [result] = await changedPolicy.validateChangedPatterns([pattern]);
  assert.equal(result.validationStatus, 'suppressed');
  assert.equal(result.suppressionReason, 'incompatible_version');
  assert.equal(sqlite.prepare("SELECT COUNT(*) count FROM cross_store_candidate_patterns WHERE lifecycle_status='validated'").get().count, 0);
});

test('differencing and membership inference have no customer query surface or active result', async () => {
  const { sqlite, generation, validation } = database();
  const [pattern] = await generation.generateChangedCells([cell(20)]);
  await validation.validateChangedPatterns([pattern]);
  assert.equal(existsSync(new URL('../src/app/api/intelligence/patterns', import.meta.url)), false);
  assert.equal(sqlite.prepare("SELECT COUNT(*) count FROM cross_store_candidate_patterns WHERE lifecycle_status='active'").get().count, 0);
  const persisted = JSON.stringify(sqlite.prepare('SELECT * FROM cross_store_pattern_validation_results').get());
  for (const forbidden of ['tenantId', 'storeId', 'merchantId', 'email', 'phone', 'http', 'commission', 'partnerName']) {
    assert.equal(persisted.includes(forbidden), false);
  }
});

test('validation is bounded, server-disabled by default, and reads no tenant tables', async () => {
  const disabled = createPatternValidationService({
    prepare() { throw new Error('must not read'); },
    async batch() { throw new Error('must not write'); },
  }, false);
  await assert.rejects(disabled.validateBounded(), /feature flag is disabled/);
  const { validation } = database();
  await assert.rejects(validation.validateBounded(101), /limit is invalid/);
});
