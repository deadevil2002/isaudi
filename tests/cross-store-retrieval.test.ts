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
import { createPatternGenerationService } from '../src/lib/cross-store/patterns';
import {
  MAX_RETRIEVAL_CANDIDATES,
  assertCompactEvidence,
  createPatternActivationService,
  createPatternRetrievalService,
  type ServerDerivedCustomerFacts,
} from '../src/lib/cross-store/retrieval';
import { createPatternValidationService } from '../src/lib/cross-store/validation';

const NOW = new Date('2026-10-15T12:00:00.000Z');
const WINDOW = Date.UTC(2026, 9, 1);
const FINDINGS = [
  'landing.cta.missing.v1',
  'landing.seo.title_missing.v1',
  'landing.trust.signals_absent.v1',
  'landing.mobile.viewport_missing.v1',
];

function cell(tenantCount: number, overrides: Partial<AggregateCell> = {}): AggregateCell {
  return {
    observationWindowKind: 'month', observationWindowStart: WINDOW,
    segmentKey: 'platform:salla', findingCode: FINDINGS[0],
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

function facts(overrides: Partial<ServerDerivedCustomerFacts> = {}): ServerDerivedCustomerFacts {
  return {
    platform: 'salla', findingCodes: [...FINDINGS],
    analyzerVersion: 'landing_page_analyzer_v1',
    dataContractVersion: CROSS_STORE_DATA_CONTRACT_VERSION,
    segmentVersion: CROSS_STORE_SEGMENT_VERSION,
    metricVersion: CROSS_STORE_METRIC_VERSION,
    aggregationVersion: CROSS_STORE_AGGREGATION_VERSION,
    privacyPolicyVersion: CROSS_STORE_PRIVACY_POLICY_VERSION,
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
    sqlite, db,
    generation: createPatternGenerationService(db, true),
    validation: createPatternValidationService(db, true),
    activation: createPatternActivationService(db, true),
    retrieval: createPatternRetrievalService(db, 'shadow'),
  };
}

async function seedValidated(
  context: ReturnType<typeof database>,
  aggregate: AggregateCell,
  activate = false,
) {
  const [pattern] = await context.generation.generateChangedCells([aggregate]);
  await context.validation.validateChangedPatterns([pattern]);
  if (activate) await context.activation.activate({ patternId: pattern.patternId, actorRole: 'super_admin' }, NOW);
  return pattern;
}

test('activation is explicit, super_admin-only, and requires all 7D gates', async () => {
  const context = database();
  const eligible = await seedValidated(context, cell(20));
  await assert.rejects(
    context.activation.activate({ patternId: eligible.patternId, actorRole: 'customer' }, NOW),
    /super_admin authorization/,
  );
  const disabled = createPatternActivationService(context.db, false);
  await assert.rejects(
    disabled.activate({ patternId: eligible.patternId, actorRole: 'super_admin' }, NOW),
    /feature flag is disabled/,
  );
  await context.activation.activate({ patternId: eligible.patternId, actorRole: 'super_admin' }, NOW);
  const active = context.sqlite.prepare('SELECT lifecycle_status FROM cross_store_candidate_patterns').get() as { lifecycle_status: string };
  assert.equal(active.lifecycle_status, 'active');

  const belowThreshold = await seedValidated(context, cell(19, { findingCode: FINDINGS[1] }));
  await assert.rejects(
    context.activation.activate({ patternId: belowThreshold.patternId, actorRole: 'super_admin' }, NOW),
    /not eligible/,
  );
});

test('19 is unavailable while 20 and 21 can be explicitly activated and retrieved', async () => {
  for (const count of [19, 20, 21]) {
    const context = database();
    const pattern = await seedValidated(context, cell(count), count >= 20);
    const result = await context.retrieval.retrieve(facts({ findingCodes: [FINDINGS[0]] }), { now: NOW });
    assert.equal(result.shadowEvidence.length, count >= 20 ? 1 : 0);
    if (count >= 20) assert.equal(result.shadowEvidence[0].patternCode, pattern.patternId);
    assert.deepEqual(result.customerEvidence, []);
  }
});

test('only active patterns are retrievable; validated, stale, suppressed, and retired fail closed', async () => {
  for (const status of ['validated', 'stale', 'suppressed', 'retired'] as const) {
    const context = database();
    const pattern = await seedValidated(context, cell(20));
    context.sqlite.prepare('UPDATE cross_store_candidate_patterns SET lifecycle_status=?, suppression_reason=? WHERE pattern_id=?')
      .run(status, status === 'suppressed' ? 'privacy_risk' : status === 'stale' ? 'stale' : null, pattern.patternId);
    const result = await context.retrieval.retrieve(facts({ findingCodes: [FINDINGS[0]] }), { now: NOW });
    assert.equal(result.shadowEvidence.length, 0, status);
  }
});

test('retrieval is exact-match, exact-platform, version compatible, and has no invented fallback', async () => {
  const context = database();
  await seedValidated(context, cell(20), true);
  assert.equal((await context.retrieval.retrieve(facts({ findingCodes: [FINDINGS[1]] }), { now: NOW })).shadowEvidence.length, 0);
  assert.equal((await context.retrieval.retrieve(facts({ platform: 'csv' }), { now: NOW })).shadowEvidence.length, 0);
  await assert.rejects(
    context.retrieval.retrieve(facts({ metricVersion: 'old_metric' }), { now: NOW }),
    /versions are incompatible/,
  );
});

test('ranking is deterministic, diverse by finding, and limited to the top three', async () => {
  const context = database();
  for (let index = 0; index < FINDINGS.length; index += 1) {
    await seedValidated(context, cell(20 + index, { findingCode: FINDINGS[index] }), true);
  }
  await seedValidated(context, cell(50, {
    findingCode: FINDINGS[0], observationWindowStart: Date.UTC(2026, 8, 1),
  }), true);
  const first = await context.retrieval.retrieve(facts(), { now: NOW });
  const second = await context.retrieval.retrieve(facts(), { now: NOW });
  assert.deepEqual(first, second);
  assert.equal(first.shadowEvidence.length, 3);
  assert.equal(new Set(first.shadowEvidence.map((item) => item.findingCode)).size, 3);
  assert.equal(first.shadowEvidence[0].findingCode, FINDINGS[0]);
  assert.equal(first.shadowEvidence[0].tenantSampleBand, '50-99');
  assert.ok(first.rowsTouched <= MAX_RETRIEVAL_CANDIDATES);
  assert.equal(first.queryCount, 1);
});

test('freshness, privacy, dominance, measurement quality, and validation state are rechecked', async () => {
  const context = database();
  const stale = await seedValidated(context, cell(20, { observationWindowStart: Date.UTC(2026, 4, 1) }));
  await assert.rejects(
    context.activation.activate({ patternId: stale.patternId, actorRole: 'super_admin' }, NOW),
    /freshness/,
  );
  const dominant = await seedValidated(context, cell(20, { findingCode: FINDINGS[1], observationCount: 200 }));
  await assert.rejects(
    context.activation.activate({ patternId: dominant.patternId, actorRole: 'super_admin' }, NOW),
    /not eligible/,
  );
  const low = await seedValidated(context, cell(20, { findingCode: FINDINGS[2], measurementQuality: 'low' }));
  await assert.rejects(
    context.activation.activate({ patternId: low.patternId, actorRole: 'super_admin' }, NOW),
    /not eligible/,
  );
});

test('deletion recomputation immediately removes an active pattern from retrieval', async () => {
  const context = database();
  await seedValidated(context, cell(20), true);
  assert.equal((await context.retrieval.retrieve(facts({ findingCodes: [FINDINGS[0]] }), { now: NOW })).shadowEvidence.length, 1);
  const [recomputed] = await context.generation.generateChangedCells([cell(19)]);
  await context.validation.validateChangedPatterns([recomputed]);
  assert.equal((await context.retrieval.retrieve(facts({ findingCodes: [FINDINGS[0]] }), { now: NOW })).shadowEvidence.length, 0);
});

test('off mode performs no query and customer exposure remains empty in shadow mode', async () => {
  let queried = false;
  const db: CrossStoreDb = {
    prepare() {
      queried = true;
      throw new Error('must not query');
    },
    async batch() { throw new Error('must not write'); },
  };
  const result = await createPatternRetrievalService(db, 'off').retrieve(facts(), { now: NOW });
  assert.equal(queried, false);
  assert.equal(result.queryCount, 0);
  assert.deepEqual(result.customerEvidence, []);
});

test('arbitrary segment, source, tenant, store, merchant, and pattern injection is rejected', async () => {
  const context = database();
  const attacks = [
    { ...facts(), tenantId: 'other' }, { ...facts(), storeId: 'other' },
    { ...facts(), merchantId: 'other' }, { ...facts(), patternId: 'sp_target' },
    { ...facts(), sourceTenant: 'other' }, { ...facts(), segment: 'platform:salla|category:rare' },
  ];
  for (const attack of attacks) {
    await assert.rejects(context.retrieval.retrieve(attack as ServerDerivedCustomerFacts, { now: NOW }), /not allowed/);
  }
});

test('repeated retrieval cannot vary a window or expose membership/differencing controls', async () => {
  const context = database();
  await seedValidated(context, cell(20), true);
  const baseline = await context.retrieval.retrieve(facts({ findingCodes: [FINDINGS[0]] }), { now: NOW });
  for (let index = 0; index < 5; index += 1) {
    assert.deepEqual(await context.retrieval.retrieve(facts({ findingCodes: [FINDINGS[0]] }), { now: NOW }), baseline);
  }
  await assert.rejects(
    context.retrieval.retrieve({ ...facts(), observationWindow: 'month:2026-10' } as ServerDerivedCustomerFacts, { now: NOW }),
    /not allowed/,
  );
});

test('compact output contains no forbidden field at any nesting depth', async () => {
  const context = database();
  await seedValidated(context, cell(100), true);
  const result = await context.retrieval.retrieve(facts({ findingCodes: [FINDINGS[0]] }), { now: NOW });
  assert.equal(result.shadowEvidence.length, 1);
  assertCompactEvidence(result.shadowEvidence[0]);
  const serialized = JSON.stringify(result.shadowEvidence);
  for (const forbidden of [
    'userId', 'storeId', 'merchantId', 'email', 'phone', 'tenantHash', 'sourceTenant',
    'http', 'exactTimestamp', 'exactRevenue', 'exactValue', 'partner', 'commission',
  ]) assert.equal(serialized.toLowerCase().includes(forbidden.toLowerCase()), false, forbidden);
  assert.equal(result.shadowEvidence[0].tenantSampleBand, '100+');
});

test('current indexes support the bounded active finding and segment lookup', () => {
  const context = database();
  const indexes = context.sqlite.prepare("PRAGMA index_list('cross_store_candidate_patterns')").all() as { name: string }[];
  assert.ok(indexes.some((index) => index.name === 'idx_cross_store_patterns_finding_segment'));
  assert.ok(indexes.some((index) => index.name === 'idx_cross_store_patterns_status_version'));
});
