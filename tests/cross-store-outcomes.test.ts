import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
// @ts-expect-error Node 22 provides node:sqlite; project types intentionally remain Node 20.
import { DatabaseSync } from 'node:sqlite';
import type { CrossStoreDb } from '../src/lib/cross-store/aggregation';
import {
  INTERVENTION_VERSION,
  OUTCOME_CONTRACT_VERSION,
  OUTCOME_OBSERVATION_POLICY_VERSION,
  OUTCOME_PATTERN_VERSION,
  OUTCOME_VERSION,
  OUTCOME_WASHOUT_POLICY_VERSION,
  aggregateOutcomeContributions,
  assertInterventionInput,
  assertOutcomePatternContract,
  classifyOutcomeMetric,
  createOutcomeFeedbackService,
  deriveEffectBand,
  evaluateOutcomeObservation,
  isCrossStoreOutcomeEnabled,
  patternFromOutcomeCell,
  validateOutcomePattern,
  type InterventionInput,
  type OutcomeContribution,
  type OutcomeObservationInput,
  type OutcomeScope,
} from '../src/lib/cross-store/outcomes';

const FINDING = 'landing.cta.missing.v1';
const WINDOW = 'month:2026-10';
const SCOPE: OutcomeScope = {
  platform: 'salla', findingCode: FINDING, interventionCode: 'landing.cta.added',
  metricCode: 'revenue', metricVersion: 'revenue_absolute_v1',
  interventionVersion: INTERVENTION_VERSION, effectBand: 'moderate_positive',
  observationWindow: WINDOW,
};

function contribution(index: number, overrides: Partial<OutcomeContribution> = {}): OutcomeContribution {
  return {
    outcomeId: `out-${String(index).padStart(3, '0')}`,
    tenantId: `tenant-${String(index).padStart(3, '0')}`,
    platform: 'salla', findingCode: FINDING, interventionCode: 'landing.cta.added',
    metricCode: 'revenue', metricVersion: 'revenue_absolute_v1',
    interventionVersion: INTERVENTION_VERSION, observationWindow: WINDOW,
    effectBand: 'moderate_positive', eligibilityStatus: 'eligible', suppressionReason: null,
    measurementQuality: 'high', dataCompleteness: 'complete',
    confounderQuality: 'clear', deltaMagnitude: 20,
    ...overrides,
  };
}

function contributions(count: number, overrides: Partial<OutcomeContribution> = {}) {
  return Array.from({ length: count }, (_, index) => contribution(index, overrides));
}

const INTERVENTION_TIME = Date.UTC(2026, 8, 15);
const intervention = (tenantId = 'tenant-1', suffix = '1'): InterventionInput => ({
  tenantId, storeId: `store-${suffix}`, platform: 'salla', findingCode: FINDING,
  analysisId: `analysis-${suffix}`, interventionCode: 'landing.cta.added',
  scope: 'storefront', source: 'verified_application_event',
  sourceEventId: `intervention-event-${suffix}`, occurredAt: INTERVENTION_TIME,
  verificationStatus: 'verified', interventionVersion: INTERVENTION_VERSION,
});

function observation(tenantId: string, interventionId: string, suffix: string): OutcomeObservationInput {
  return {
    tenantId, interventionId, metricCode: 'revenue', metricVersion: 'revenue_absolute_v1',
    baselineWindowStart: Date.UTC(2026, 7, 1),
    baselineWindowEnd: Date.UTC(2026, 8, 14), baselineValue: 100,
    washoutSeconds: 7 * 86_400, washoutPolicyVersion: OUTCOME_WASHOUT_POLICY_VERSION,
    observationWindowStart: Date.UTC(2026, 8, 22),
    observationWindowEnd: Date.UTC(2026, 9, 2),
    observationPolicyVersion: OUTCOME_OBSERVATION_POLICY_VERSION,
    observedValue: 120, denominatorStatus: 'not_required', dataCompleteness: 'complete',
    confounders: [], measurementQuality: 'high', sourceEventId: `outcome-event-${suffix}`,
    outcomeVersion: OUTCOME_VERSION,
  };
}

function database() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys=ON');
  sqlite.exec(readFileSync(new URL('../migrations/staging/0005_cross_store_outcome_feedback.sql', import.meta.url), 'utf8'));
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
  return { sqlite, db, service: createOutcomeFeedbackService(db, true) };
}

test('metric audit separates eligible absolutes, missing denominators, and unsuitable commercial events', () => {
  for (const metric of ['revenue', 'orders', 'aov', 'profit', 'margin']) {
    assert.equal(classifyOutcomeMetric(metric).classification, 'eligible_now', metric);
  }
  assert.equal(classifyOutcomeMetric('conversion_rate').classification, 'requires_measurement');
  assert.equal(classifyOutcomeMetric('refunds').classification, 'requires_measurement');
  for (const metric of ['referral_click', 'partner_conversion', 'recommendation_shown']) {
    assert.equal(classifyOutcomeMetric(metric).classification, 'not_suitable', metric);
  }
});

test('effect bands are deterministic, versioned in docs, and conversion remains blocked', () => {
  assert.equal(deriveEffectBand('revenue', 100, 85), 'negative');
  assert.equal(deriveEffectBand('orders', 100, 100), 'stable');
  assert.equal(deriveEffectBand('aov', 100, 110), 'small_positive');
  assert.equal(deriveEffectBand('profit', 100, 120), 'moderate_positive');
  assert.equal(deriveEffectBand('revenue', 100, 140), 'large_positive');
  assert.equal(deriveEffectBand('margin', 20, 26), 'moderate_positive');
  assert.throws(() => deriveEffectBand('conversion_rate', 1, 2));
});

test('only verified intervention sources are accepted and display/commercial events cannot masquerade as interventions', () => {
  assert.doesNotThrow(() => assertInterventionInput(intervention()));
  assert.throws(() => assertInterventionInput({ ...intervention(), source: 'referral_click' } as never));
  assert.throws(() => assertInterventionInput({ ...intervention(), customerEmail: 'private@example.test' } as never));
});

test('29 tenants suppress while 30 and 31 are eligible for validation', () => {
  assert.equal(aggregateOutcomeContributions(contributions(29), SCOPE).validationStatus, 'suppressed');
  assert.equal(aggregateOutcomeContributions(contributions(30), SCOPE).validationStatus, 'eligible_for_validation');
  assert.equal(aggregateOutcomeContributions(contributions(31), SCOPE).validationStatus, 'eligible_for_validation');
});

test('30 rows with only 10 verified interventions remain suppressed', () => {
  const rows = contributions(30).map((row, index) => index < 10 ? row : {
    ...row, effectBand: null, eligibilityStatus: 'insufficient_evidence' as const,
    suppressionReason: 'intervention_unverified' as const,
  });
  const cell = aggregateOutcomeContributions(rows, SCOPE);
  assert.equal(cell.tenantCount, 10);
  assert.equal(cell.validationStatus, 'suppressed');
});

test('incomplete measurement and major confounders suppress outcome evidence', () => {
  const incomplete = contributions(30, {
    effectBand: null, eligibilityStatus: 'insufficient_evidence',
    suppressionReason: 'incomplete_measurement', dataCompleteness: 'partial',
  });
  assert.equal(aggregateOutcomeContributions(incomplete, SCOPE).suppressionReason, 'incomplete_measurement');
  const confounded = contributions(30, {
    effectBand: null, eligibilityStatus: 'insufficient_evidence',
    suppressionReason: 'major_confounders', confounderQuality: 'major',
  });
  assert.equal(aggregateOutcomeContributions(confounded, SCOPE).suppressionReason, 'major_confounders');
});

test('valid revenue evidence creates and validates an observed-association pattern without activation', () => {
  const cell = aggregateOutcomeContributions(contributions(30), SCOPE);
  const pattern = patternFromOutcomeCell(cell);
  assert.equal(pattern.lifecycleStatus, 'candidate');
  assert.equal(pattern.evidenceClass, 'observed_association');
  assert.equal(validateOutcomePattern(pattern).validationStatus, 'validated');
  assert.notEqual(pattern.lifecycleStatus, 'active' as never);
});

test('ten stores owned by one tenant count once and repeated rows never inflate diversity', () => {
  const rows = contributions(29);
  for (let store = 0; store < 10; store += 1) rows.push(contribution(100 + store, {
    outcomeId: `multi-store-${store}`, tenantId: 'tenant-multi',
  }));
  const cell = aggregateOutcomeContributions(rows, SCOPE);
  assert.equal(cell.tenantCount, 30);
  assert.equal(cell.observationCount, 39);
  assert.equal(cell.validationStatus, 'eligible_for_validation');
});

test('one tenant dominating private absolute change is privacy-suppressed', () => {
  const rows = contributions(30);
  rows[0] = { ...rows[0], deltaMagnitude: 1_000_000 };
  const cell = aggregateOutcomeContributions(rows, SCOPE);
  assert.equal(cell.dominanceStatus, 'fail');
  assert.equal(cell.suppressionReason, 'privacy_risk');
});

test('overlapping interventions are insufficient descriptive evidence', () => {
  const stored = { ...intervention(), interventionId: 'int-1' };
  const assessment = evaluateOutcomeObservation(observation('tenant-1', 'int-1', '1'), stored, 1);
  assert.equal(assessment.eligibilityStatus, 'insufficient_evidence');
  assert.equal(assessment.suppressionReason, 'overlapping_interventions');
});

test('conversion without a reliable traffic denominator is always NOT READY', () => {
  const stored = { ...intervention(), interventionId: 'int-1' };
  const input = { ...observation('tenant-1', 'int-1', '1'), metricCode: 'conversion_rate' as const,
    metricVersion: 'conversion_v1', denominatorStatus: 'unavailable' as const };
  const assessment = evaluateOutcomeObservation(input, stored);
  assert.equal(assessment.effectBand, null);
  assert.equal(assessment.suppressionReason, 'conversion_not_ready');
});

test('incompatible metric versions fail closed', () => {
  const stored = { ...intervention(), interventionId: 'int-1' };
  const assessment = evaluateOutcomeObservation({
    ...observation('tenant-1', 'int-1', '1'), metricVersion: 'revenue_legacy_v0',
  }, stored);
  assert.equal(assessment.suppressionReason, 'incompatible_version');

  const incompatible = contributions(30).map((row) => ({
    ...row,
    metricVersion: 'revenue_legacy_v0',
    eligibilityStatus: 'insufficient_evidence' as const,
    suppressionReason: 'incompatible_version' as const,
  }));
  const cell = aggregateOutcomeContributions(incompatible, SCOPE);
  assert.equal(cell.validationStatus, 'suppressed');
  assert.equal(cell.suppressionReason, 'incompatible_version');
});

test('outcome pattern passes the Phase 7 contract allowlist and rejects nested/private attack fields', () => {
  const contract = JSON.parse(readFileSync(new URL('../docs/phase-7/cross-store-data-contract.v1.json', import.meta.url), 'utf8'));
  assert.equal(contract.policies.outcome_candidate.minimumTenants, 30);
  assert.equal(contract.thresholds.outcomeDistinctTenants, 30);
  const pattern = patternFromOutcomeCell(aggregateOutcomeContributions(contributions(30), SCOPE));
  assert.doesNotThrow(() => assertOutcomePatternContract(pattern));
  assert.throws(() => assertOutcomePatternContract({ ...pattern, tenantId: 'private' }));
  assert.throws(() => assertOutcomePatternContract({ ...pattern, metadata: { sourceTenantId: 'private' } }));
  assert.equal(pattern.patternVersion, OUTCOME_PATTERN_VERSION);
  assert.equal(pattern.outcomeContractVersion, OUTCOME_CONTRACT_VERSION);
});

test('rare, uniquely timed, raw-value, and identity-bearing re-identification inputs fail closed', () => {
  assert.throws(() => aggregateOutcomeContributions(contributions(30), {
    ...SCOPE, findingCode: 'landing.unique.rare-finding.v1',
  }));
  assert.throws(() => aggregateOutcomeContributions(contributions(30), {
    ...SCOPE, interventionCode: 'landing.unique.rare-intervention',
  } as unknown as OutcomeScope));
  assert.throws(() => aggregateOutcomeContributions(contributions(30), {
    ...SCOPE, observationWindow: '2026-10-03T11:11:12.259Z',
  }));
  const pattern = patternFromOutcomeCell(aggregateOutcomeContributions(contributions(30), SCOPE));
  assert.throws(() => assertOutcomePatternContract({ ...pattern, sourceTenantHash: 'stable-hash' }));
  assert.throws(() => assertOutcomePatternContract({ ...pattern, rawValue: 120 }));
  assert.throws(() => assertOutcomePatternContract({ ...pattern, occurredAt: INTERVENTION_TIME }));
});

test('feature flag fails closed and customer retrieval/AI paths do not consume outcome patterns', () => {
  assert.equal(isCrossStoreOutcomeEnabled({}), false);
  assert.equal(isCrossStoreOutcomeEnabled({ CROSS_STORE_OUTCOME_ENABLED: 'false' }), false);
  assert.equal(isCrossStoreOutcomeEnabled({ CROSS_STORE_OUTCOME_ENABLED: 'true' }), true);
  const retrieval = readFileSync(new URL('../src/lib/cross-store/retrieval.ts', import.meta.url), 'utf8');
  const sharedAi = readFileSync(new URL('../src/lib/ai/shared-intelligence.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(retrieval, /cross_store_outcome_patterns/);
  assert.doesNotMatch(sharedAi, /cross_store_outcome_patterns/);
  assert.doesNotMatch(readFileSync(new URL('../src/lib/cross-store/outcomes.ts', import.meta.url), 'utf8'), /requestOpenAIChat|OPENAI_API_KEY/);
});

test('persistent interventions and outcomes are idempotent and deletion recomputes 30 to suppressed 29', async () => {
  const context = database();
  for (let index = 0; index < 30; index += 1) {
    const tenantId = `tenant-${index}`;
    const input = intervention(tenantId, String(index));
    const interventionId = await context.service.recordIntervention(input);
    assert.equal(await context.service.recordIntervention(input), interventionId);
    const outcome = observation(tenantId, interventionId, String(index));
    const first = await context.service.recordOutcome(outcome);
    assert.equal((await context.service.recordOutcome(outcome)).outcomeId, first.outcomeId);
  }
  assert.equal(context.sqlite.prepare('SELECT COUNT(*) count FROM cross_store_private_interventions').get().count, 30);
  assert.equal(context.sqlite.prepare('SELECT COUNT(*) count FROM cross_store_private_outcome_observations').get().count, 30);
  const before = await context.service.recomputeScope(SCOPE);
  assert.equal(before.cell.tenantCount, 30);
  assert.equal(before.validation.validationStatus, 'validated');
  await context.service.removeTenant('tenant-0');
  const cell = context.sqlite.prepare('SELECT tenant_count,validation_status,suppression_reason FROM cross_store_outcome_aggregate_cells').get();
  assert.equal(cell.tenant_count, 29);
  assert.equal(cell.validation_status, 'suppressed');
  assert.equal(cell.suppression_reason, 'small_sample');
  const pattern = context.sqlite.prepare('SELECT lifecycle_status,suppression_reason FROM cross_store_outcome_patterns').get();
  assert.equal(pattern.lifecycle_status, 'suppressed');
  assert.equal(pattern.suppression_reason, 'small_sample');
});
