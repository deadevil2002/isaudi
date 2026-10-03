import { createHash } from 'crypto';
import {
  CROSS_STORE_DATA_CONTRACT_VERSION,
  CROSS_STORE_PRIVACY_POLICY_VERSION,
  OUTCOME_MINIMUM_TENANTS,
  isApprovedFindingCode,
  type CrossStoreDb,
  type CrossStorePlatform,
} from './aggregation';
import { SHARED_PATTERN_FORBIDDEN_FIELDS } from './patterns';

export const CROSS_STORE_OUTCOME_FLAG = 'CROSS_STORE_OUTCOME_ENABLED';
export const OUTCOME_CONTRACT_VERSION = 'outcome_contract_v1_provisional';
export const OUTCOME_PATTERN_VERSION = 'shared_pattern_v1.outcome_candidate_v1';
export const OUTCOME_AGGREGATION_VERSION = 'bounded_outcome_v1_staging';
export const OUTCOME_VALIDATION_VERSION = 'outcome_validation_v1_staging';
export const OUTCOME_WASHOUT_POLICY_VERSION = 'outcome_washout_v1_provisional';
export const OUTCOME_OBSERVATION_POLICY_VERSION = 'outcome_observation_v1_provisional';
export const INTERVENTION_VERSION = 'verified_intervention_v1';
export const OUTCOME_VERSION = 'outcome_observation_v1';
export const MAX_OUTCOME_BATCH = 1_000;
export const MAX_OUTCOME_WINDOWS_PER_DELETION = 100;
export const PROVISIONAL_DOMINANCE_BPS = 2_000;

export const INTERVENTION_CODES = [
  'landing.cta.added',
  'landing.trust_signals.added',
  'landing.seo.title_added',
  'landing.mobile.viewport_added',
] as const;

export const INTERVENTION_SOURCES = [
  'verified_application_event',
  'verified_partner_event',
  'manual_admin_verification',
] as const;

export const OUTCOME_METRICS = [
  'revenue', 'orders', 'aov', 'profit', 'margin', 'conversion_rate',
] as const;

export const EFFECT_BANDS = [
  'negative', 'stable', 'small_positive', 'moderate_positive', 'large_positive',
] as const;

export const CONFOUNDERS = [
  'campaign_change', 'pricing_change', 'product_change', 'traffic_change',
  'seasonality', 'discount_change', 'inventory_change', 'store_redesign',
  'external_event',
] as const;

export type InterventionCode = typeof INTERVENTION_CODES[number];
export type InterventionSource = typeof INTERVENTION_SOURCES[number];
export type OutcomeMetric = typeof OUTCOME_METRICS[number];
export type EffectBand = typeof EFFECT_BANDS[number];
export type Confounder = typeof CONFOUNDERS[number];
export type MeasurementQuality = 'high' | 'mixed' | 'low' | 'insufficient';
export type OutcomeSuppressionReason =
  | 'intervention_unverified' | 'baseline_invalid' | 'window_invalid'
  | 'incomplete_measurement' | 'major_confounders' | 'overlapping_interventions'
  | 'conversion_not_ready' | 'incompatible_version' | 'contract_violation';
export type AggregateSuppressionReason =
  | 'small_sample' | 'incomplete_measurement' | 'major_confounders'
  | 'overlapping_interventions' | 'conversion_not_ready'
  | 'incompatible_version' | 'privacy_risk' | 'contract_violation';

export type InterventionInput = {
  tenantId: string;
  storeId: string;
  platform: CrossStorePlatform;
  findingCode: string;
  analysisId: string;
  interventionCode: InterventionCode;
  scope: 'storefront';
  source: InterventionSource;
  sourceEventId: string;
  occurredAt: number;
  verificationStatus: 'verified' | 'rejected';
  interventionVersion: typeof INTERVENTION_VERSION;
};

export type OutcomeObservationInput = {
  tenantId: string;
  interventionId: string;
  metricCode: OutcomeMetric;
  metricVersion: string;
  baselineWindowStart: number;
  baselineWindowEnd: number;
  baselineValue: number;
  washoutSeconds: number;
  washoutPolicyVersion: typeof OUTCOME_WASHOUT_POLICY_VERSION;
  observationWindowStart: number;
  observationWindowEnd: number;
  observationPolicyVersion: typeof OUTCOME_OBSERVATION_POLICY_VERSION;
  observedValue: number;
  denominatorStatus: 'not_required' | 'available' | 'unavailable';
  dataCompleteness: 'complete' | 'partial' | 'insufficient';
  confounders: Confounder[];
  measurementQuality: MeasurementQuality;
  sourceEventId: string;
  outcomeVersion: typeof OUTCOME_VERSION;
};

type StoredIntervention = InterventionInput & { interventionId: string };

export type OutcomeAssessment = {
  effectBand: EffectBand | null;
  eligibilityStatus: 'eligible' | 'insufficient_evidence';
  suppressionReason: OutcomeSuppressionReason | null;
  evidenceClass: 'observed_association';
  confounderQuality: 'clear' | 'minor' | 'major' | 'unknown';
  overlapStatus: 'clear' | 'confounded';
  deltaMagnitude: number;
};

export type OutcomeContribution = {
  outcomeId: string;
  tenantId: string;
  platform: CrossStorePlatform;
  findingCode: string;
  interventionCode: InterventionCode;
  metricCode: OutcomeMetric;
  metricVersion: string;
  interventionVersion: string;
  observationWindow: string;
  effectBand: EffectBand | null;
  eligibilityStatus: OutcomeAssessment['eligibilityStatus'];
  suppressionReason: OutcomeSuppressionReason | null;
  measurementQuality: MeasurementQuality;
  dataCompleteness: OutcomeObservationInput['dataCompleteness'];
  confounderQuality: OutcomeAssessment['confounderQuality'];
  deltaMagnitude: number;
};

export type OutcomeScope = {
  platform: CrossStorePlatform;
  findingCode: string;
  interventionCode: InterventionCode;
  metricCode: OutcomeMetric;
  metricVersion: string;
  interventionVersion: string;
  effectBand: EffectBand;
  observationWindow: string;
};

export type OutcomeAggregateCell = OutcomeScope & {
  tenantCount: number;
  observationCount: number;
  measurementQuality: 'high' | 'mixed' | 'low';
  dataCompleteness: 'complete' | 'insufficient';
  confounderQuality: 'clear' | 'minor' | 'major' | 'unknown';
  dominanceStatus: 'pass' | 'fail';
  validationStatus: 'suppressed' | 'eligible_for_validation';
  suppressionReason: AggregateSuppressionReason | null;
};

export type OutcomePattern = {
  patternId: string;
  patternVersion: typeof OUTCOME_PATTERN_VERSION;
  dataContractVersion: typeof CROSS_STORE_DATA_CONTRACT_VERSION;
  outcomeContractVersion: typeof OUTCOME_CONTRACT_VERSION;
  metricVersion: string;
  interventionVersion: string;
  aggregationVersion: typeof OUTCOME_AGGREGATION_VERSION;
  privacyPolicyVersion: typeof CROSS_STORE_PRIVACY_POLICY_VERSION;
  findingCode: string;
  interventionCode: InterventionCode;
  outcomeMetricCode: OutcomeMetric;
  anonymousSegment: `platform:${CrossStorePlatform}`;
  effectBand: EffectBand;
  evidenceClass: 'observed_association';
  sampleSize: number;
  tenantDiversity: number;
  measurementQuality: 'high' | 'mixed' | 'low';
  dataCompleteness: 'complete' | 'insufficient';
  confounderQuality: 'clear' | 'minor' | 'major' | 'unknown';
  lifecycleStatus: 'candidate' | 'validated' | 'suppressed' | 'stale' | 'retired';
  suppressionReason: AggregateSuppressionReason | null;
  observationWindow: string;
};

const METRIC_VERSIONS: Record<Exclude<OutcomeMetric, 'conversion_rate'>, string> = {
  revenue: 'revenue_absolute_v1',
  orders: 'orders_absolute_v1',
  aov: 'aov_absolute_v1',
  profit: 'profit_complete_cost_v1',
  margin: 'margin_complete_cost_v1',
};

const INTERVENTION_KEYS = new Set([
  'tenantId', 'storeId', 'platform', 'findingCode', 'analysisId', 'interventionCode',
  'scope', 'source', 'sourceEventId', 'occurredAt', 'verificationStatus',
  'interventionVersion',
]);
const OUTCOME_KEYS = new Set([
  'tenantId', 'interventionId', 'metricCode', 'metricVersion',
  'baselineWindowStart', 'baselineWindowEnd', 'baselineValue', 'washoutSeconds',
  'washoutPolicyVersion', 'observationWindowStart', 'observationWindowEnd',
  'observationPolicyVersion', 'observedValue', 'denominatorStatus',
  'dataCompleteness', 'confounders', 'measurementQuality', 'sourceEventId',
  'outcomeVersion',
]);
const PATTERN_KEYS = new Set([
  'patternId', 'patternVersion', 'dataContractVersion', 'outcomeContractVersion',
  'metricVersion', 'interventionVersion', 'aggregationVersion',
  'privacyPolicyVersion', 'findingCode', 'interventionCode', 'outcomeMetricCode',
  'anonymousSegment', 'effectBand', 'evidenceClass', 'sampleSize',
  'tenantDiversity', 'measurementQuality', 'dataCompleteness',
  'confounderQuality', 'lifecycleStatus', 'suppressionReason', 'observationWindow',
]);
const FORBIDDEN = new Set(SHARED_PATTERN_FORBIDDEN_FIELDS.map((item) => item.toLowerCase()));

function nonEmpty(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required`);
  return value.trim();
}

function finite(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label} must be finite`);
  return value;
}

function exactKeys(value: object, allowed: Set<string>): void {
  for (const key of Object.keys(value)) if (!allowed.has(key)) throw new Error(`field is not allowed: ${key}`);
}

function stableId(prefix: string, parts: unknown[]): string {
  return `${prefix}_${createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 32)}`;
}

export function isCrossStoreOutcomeEnabled(env: Record<string, unknown>): boolean {
  return env[CROSS_STORE_OUTCOME_FLAG] === 'true';
}

export function classifyOutcomeMetric(metric: string): {
  classification: 'eligible_now' | 'requires_measurement' | 'not_suitable';
  reason: string;
} {
  if (['revenue', 'orders', 'aov'].includes(metric)) {
    return { classification: 'eligible_now', reason: 'versioned absolute store measurement' };
  }
  if (metric === 'profit' || metric === 'margin') {
    return { classification: 'eligible_now', reason: 'eligible only with complete versioned cost data' };
  }
  if (metric === 'conversion_rate') {
    return { classification: 'requires_measurement', reason: 'reliable traffic/session denominator is unavailable' };
  }
  if (metric === 'refunds' || metric === 'cancellations') {
    return { classification: 'requires_measurement', reason: 'consistent versioned status definition is not yet established' };
  }
  if (['referral_click', 'partner_conversion', 'recommendation_shown'].includes(metric)) {
    return { classification: 'not_suitable', reason: 'commercial or display event does not prove intervention outcome' };
  }
  return { classification: 'not_suitable', reason: 'metric is outside the approved outcome contract' };
}

export function assertInterventionInput(input: InterventionInput): void {
  exactKeys(input, INTERVENTION_KEYS);
  nonEmpty(input.tenantId, 'tenantId');
  nonEmpty(input.storeId, 'storeId');
  nonEmpty(input.analysisId, 'analysisId');
  nonEmpty(input.sourceEventId, 'sourceEventId');
  if (input.platform !== 'salla' && input.platform !== 'csv') throw new Error('platform is not approved');
  if (!isApprovedFindingCode(input.findingCode)) throw new Error('findingCode is not approved');
  if (!INTERVENTION_CODES.includes(input.interventionCode)) throw new Error('interventionCode is not approved');
  if (!INTERVENTION_SOURCES.includes(input.source)) throw new Error('intervention source is not verifiable');
  if (input.scope !== 'storefront') throw new Error('intervention scope is not approved');
  if (!Number.isInteger(input.occurredAt) || input.occurredAt < 0) throw new Error('occurredAt is invalid');
  if (!['verified', 'rejected'].includes(input.verificationStatus)) throw new Error('verificationStatus is invalid');
  if (input.interventionVersion !== INTERVENTION_VERSION) throw new Error('intervention version is incompatible');
}

export function assertOutcomeObservationInput(input: OutcomeObservationInput): void {
  exactKeys(input, OUTCOME_KEYS);
  nonEmpty(input.tenantId, 'tenantId');
  nonEmpty(input.interventionId, 'interventionId');
  nonEmpty(input.sourceEventId, 'sourceEventId');
  if (!OUTCOME_METRICS.includes(input.metricCode)) throw new Error('outcome metric is not approved');
  finite(input.baselineValue, 'baselineValue');
  finite(input.observedValue, 'observedValue');
  if (![input.baselineWindowStart, input.baselineWindowEnd, input.observationWindowStart, input.observationWindowEnd]
    .every((item) => Number.isInteger(item) && item >= 0)) throw new Error('outcome windows are invalid');
  if (!Number.isInteger(input.washoutSeconds) || input.washoutSeconds < 86_400 || input.washoutSeconds > 7_776_000) {
    throw new Error('washout must be explicitly selected within the provisional 1–90 day range');
  }
  if (input.washoutPolicyVersion !== OUTCOME_WASHOUT_POLICY_VERSION
    || input.observationPolicyVersion !== OUTCOME_OBSERVATION_POLICY_VERSION
    || input.outcomeVersion !== OUTCOME_VERSION) throw new Error('outcome policy version is incompatible');
  if (!['not_required', 'available', 'unavailable'].includes(input.denominatorStatus)) throw new Error('denominatorStatus is invalid');
  if (!['complete', 'partial', 'insufficient'].includes(input.dataCompleteness)) throw new Error('dataCompleteness is invalid');
  if (!['high', 'mixed', 'low', 'insufficient'].includes(input.measurementQuality)) throw new Error('measurementQuality is invalid');
  if (!Array.isArray(input.confounders) || input.confounders.length > CONFOUNDERS.length
    || input.confounders.some((item) => !CONFOUNDERS.includes(item))) throw new Error('confounder is not approved');
}

export function deriveEffectBand(metric: OutcomeMetric, baseline: number, observed: number): EffectBand {
  finite(baseline, 'baseline');
  finite(observed, 'observed');
  if (metric === 'conversion_rate') throw new Error('conversion outcome is not ready');
  if (metric === 'margin') {
    const points = observed - baseline;
    if (points <= -2) return 'negative';
    if (points < 2) return 'stable';
    if (points < 5) return 'small_positive';
    if (points < 10) return 'moderate_positive';
    return 'large_positive';
  }
  if (baseline <= 0) throw new Error('baseline must be positive for relative outcome metrics');
  const percent = ((observed - baseline) / Math.abs(baseline)) * 100;
  if (percent <= -10) return 'negative';
  if (percent < 5) return 'stable';
  if (percent < 15) return 'small_positive';
  if (percent < 30) return 'moderate_positive';
  return 'large_positive';
}

function metricVersionCompatible(metric: OutcomeMetric, version: string): boolean {
  return metric !== 'conversion_rate' && METRIC_VERSIONS[metric] === version;
}

export function evaluateOutcomeObservation(
  input: OutcomeObservationInput,
  intervention: StoredIntervention,
  overlappingVerifiedInterventions = 0,
): OutcomeAssessment {
  assertOutcomeObservationInput(input);
  let suppressionReason: OutcomeSuppressionReason | null = null;
  const confounderQuality = input.confounders.length === 0
    ? 'clear' as const
    : input.confounders.length === 1 ? 'minor' as const : 'major' as const;
  const overlapStatus = overlappingVerifiedInterventions > 0 ? 'confounded' as const : 'clear' as const;
  if (intervention.tenantId !== input.tenantId || intervention.verificationStatus !== 'verified') {
    suppressionReason = 'intervention_unverified';
  } else if (input.metricCode === 'conversion_rate') {
    suppressionReason = 'conversion_not_ready';
  } else if (!metricVersionCompatible(input.metricCode, input.metricVersion)) {
    suppressionReason = 'incompatible_version';
  } else if (input.baselineWindowStart >= input.baselineWindowEnd
    || input.baselineWindowEnd >= intervention.occurredAt || input.baselineValue <= 0) {
    suppressionReason = 'baseline_invalid';
  } else if (input.observationWindowStart < intervention.occurredAt + input.washoutSeconds * 1_000
    || input.observationWindowStart >= input.observationWindowEnd) {
    suppressionReason = 'window_invalid';
  } else if (input.dataCompleteness !== 'complete'
    || input.measurementQuality === 'low' || input.measurementQuality === 'insufficient') {
    suppressionReason = 'incomplete_measurement';
  } else if (confounderQuality === 'major') {
    suppressionReason = 'major_confounders';
  } else if (overlapStatus === 'confounded') {
    suppressionReason = 'overlapping_interventions';
  }
  let effectBand: EffectBand | null = null;
  if (!suppressionReason) {
    try { effectBand = deriveEffectBand(input.metricCode, input.baselineValue, input.observedValue); }
    catch { suppressionReason = 'baseline_invalid'; }
  }
  return {
    effectBand,
    eligibilityStatus: suppressionReason ? 'insufficient_evidence' : 'eligible',
    suppressionReason,
    evidenceClass: 'observed_association',
    confounderQuality,
    overlapStatus,
    deltaMagnitude: Math.abs(input.observedValue - input.baselineValue),
  };
}

function suppressionFromRows(rows: OutcomeContribution[], eligibleCount: number): AggregateSuppressionReason | null {
  if (rows.some((row) => row.metricCode === 'conversion_rate' || row.suppressionReason === 'conversion_not_ready')) return 'conversion_not_ready';
  if (rows.some((row) => row.suppressionReason === 'incompatible_version')) return 'incompatible_version';
  if (rows.some((row) => row.suppressionReason === 'overlapping_interventions')) return 'overlapping_interventions';
  if (rows.some((row) => row.suppressionReason === 'major_confounders')) return 'major_confounders';
  if (rows.some((row) => row.suppressionReason === 'incomplete_measurement')) return 'incomplete_measurement';
  return eligibleCount < OUTCOME_MINIMUM_TENANTS ? 'small_sample' : null;
}

export function aggregateOutcomeContributions(
  rows: OutcomeContribution[],
  scope: OutcomeScope,
): OutcomeAggregateCell {
  if (rows.length > MAX_OUTCOME_BATCH) throw new Error('outcome aggregation batch exceeds bounded maximum');
  if (!isApprovedFindingCode(scope.findingCode) || !INTERVENTION_CODES.includes(scope.interventionCode)
    || !OUTCOME_METRICS.includes(scope.metricCode) || !EFFECT_BANDS.includes(scope.effectBand)
    || !/^month:\d{4}-(0[1-9]|1[0-2])$/.test(scope.observationWindow)) {
    throw new Error('outcome aggregation scope is invalid');
  }
  const scoped = rows.filter((row) => row.platform === scope.platform
    && row.findingCode === scope.findingCode && row.interventionCode === scope.interventionCode
    && row.metricCode === scope.metricCode
    && row.interventionVersion === scope.interventionVersion
    && row.observationWindow === scope.observationWindow
    && (row.effectBand === scope.effectBand || row.effectBand == null));
  const onePerTenant = new Map<string, OutcomeContribution>();
  for (const row of [...scoped].sort((a, b) => a.outcomeId.localeCompare(b.outcomeId))) {
    if (!onePerTenant.has(row.tenantId)) onePerTenant.set(row.tenantId, row);
  }
  const contributions = [...onePerTenant.values()];
  const eligible = contributions.filter((row) => row.eligibilityStatus === 'eligible'
    && row.metricVersion === scope.metricVersion
    && row.effectBand === scope.effectBand);
  const totalMagnitude = eligible.reduce((sum, row) => sum + row.deltaMagnitude, 0);
  const maxMagnitude = Math.max(0, ...eligible.map((row) => row.deltaMagnitude));
  const dominanceBps = totalMagnitude > 0 ? Math.round((maxMagnitude / totalMagnitude) * 10_000) : 0;
  const dominanceStatus = dominanceBps > PROVISIONAL_DOMINANCE_BPS ? 'fail' as const : 'pass' as const;
  let suppressionReason = suppressionFromRows(contributions, eligible.length);
  if (!suppressionReason && dominanceStatus === 'fail') suppressionReason = 'privacy_risk';
  const validationStatus = !suppressionReason && eligible.length >= OUTCOME_MINIMUM_TENANTS
    ? 'eligible_for_validation' as const : 'suppressed' as const;
  return {
    ...scope,
    tenantCount: eligible.length,
    observationCount: scoped.length,
    measurementQuality: eligible.every((row) => row.measurementQuality === 'high') ? 'high'
      : eligible.some((row) => row.measurementQuality === 'low') ? 'low' : 'mixed',
    dataCompleteness: eligible.length === contributions.length && eligible.length > 0 ? 'complete' : 'insufficient',
    confounderQuality: eligible.some((row) => row.confounderQuality === 'minor') ? 'minor'
      : contributions.some((row) => row.confounderQuality === 'major') ? 'major'
        : contributions.some((row) => row.confounderQuality === 'unknown') ? 'unknown' : 'clear',
    dominanceStatus,
    validationStatus,
    suppressionReason,
  };
}

export function patternFromOutcomeCell(cell: OutcomeAggregateCell): OutcomePattern {
  const semantic = [
    OUTCOME_PATTERN_VERSION, cell.findingCode, cell.interventionCode,
    cell.metricCode, cell.metricVersion, cell.interventionVersion,
    cell.platform, cell.effectBand, cell.observationWindow,
  ];
  const pattern: OutcomePattern = {
    patternId: stableId('spo', semantic),
    patternVersion: OUTCOME_PATTERN_VERSION,
    dataContractVersion: CROSS_STORE_DATA_CONTRACT_VERSION,
    outcomeContractVersion: OUTCOME_CONTRACT_VERSION,
    metricVersion: cell.metricVersion,
    interventionVersion: cell.interventionVersion,
    aggregationVersion: OUTCOME_AGGREGATION_VERSION,
    privacyPolicyVersion: CROSS_STORE_PRIVACY_POLICY_VERSION,
    findingCode: cell.findingCode,
    interventionCode: cell.interventionCode,
    outcomeMetricCode: cell.metricCode,
    anonymousSegment: `platform:${cell.platform}`,
    effectBand: cell.effectBand,
    evidenceClass: 'observed_association',
    sampleSize: cell.tenantCount,
    tenantDiversity: cell.tenantCount,
    measurementQuality: cell.measurementQuality,
    dataCompleteness: cell.dataCompleteness,
    confounderQuality: cell.confounderQuality,
    lifecycleStatus: cell.validationStatus === 'eligible_for_validation' ? 'candidate' : 'suppressed',
    suppressionReason: cell.suppressionReason,
    observationWindow: cell.observationWindow,
  };
  assertOutcomePatternContract(pattern);
  return pattern;
}

export function assertOutcomePatternContract(value: unknown): asserts value is OutcomePattern {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('outcome pattern must be an object');
  for (const key of Object.keys(value)) {
    if (!PATTERN_KEYS.has(key)) throw new Error(`outcome pattern field is not allowed: ${key}`);
    if (FORBIDDEN.has(key.toLowerCase())) throw new Error(`forbidden outcome pattern field: ${key}`);
  }
  const pattern = value as OutcomePattern;
  if (!/^spo_[a-f0-9]{32}$/.test(pattern.patternId)
    || pattern.patternVersion !== OUTCOME_PATTERN_VERSION
    || pattern.dataContractVersion !== CROSS_STORE_DATA_CONTRACT_VERSION
    || pattern.outcomeContractVersion !== OUTCOME_CONTRACT_VERSION
    || pattern.aggregationVersion !== OUTCOME_AGGREGATION_VERSION
    || pattern.privacyPolicyVersion !== CROSS_STORE_PRIVACY_POLICY_VERSION
    || !isApprovedFindingCode(pattern.findingCode)
    || !INTERVENTION_CODES.includes(pattern.interventionCode)
    || !OUTCOME_METRICS.includes(pattern.outcomeMetricCode)
    || !EFFECT_BANDS.includes(pattern.effectBand)
    || pattern.evidenceClass !== 'observed_association'
    || pattern.anonymousSegment !== 'platform:salla' && pattern.anonymousSegment !== 'platform:csv'
    || !Number.isInteger(pattern.sampleSize) || !Number.isInteger(pattern.tenantDiversity)
    || pattern.sampleSize < 0 || pattern.tenantDiversity < 0
    || pattern.lifecycleStatus === ('active' as OutcomePattern['lifecycleStatus'])) {
    throw new Error('outcome pattern violates the Phase 7G contract');
  }
}

export const OUTCOME_VALIDATION_GATES = [
  'schema', 'verified_intervention', 'baseline', 'washout', 'observation_window',
  'metric_version', 'data_completeness', 'confounders', 'sample',
  'tenant_diversity', 'dominance', 'privacy', 'causality',
] as const;

export function validateOutcomePattern(pattern: OutcomePattern) {
  let schema = true;
  try { assertOutcomePatternContract(pattern); } catch { schema = false; }
  const decisions: Record<typeof OUTCOME_VALIDATION_GATES[number], boolean> = {
    schema,
    verified_intervention: pattern.interventionVersion === INTERVENTION_VERSION,
    baseline: pattern.outcomeContractVersion === OUTCOME_CONTRACT_VERSION,
    washout: pattern.outcomeContractVersion === OUTCOME_CONTRACT_VERSION,
    observation_window: /^month:\d{4}-(0[1-9]|1[0-2])$/.test(pattern.observationWindow),
    metric_version: metricVersionCompatible(pattern.outcomeMetricCode, pattern.metricVersion),
    data_completeness: pattern.dataCompleteness === 'complete' && pattern.measurementQuality !== 'low',
    confounders: pattern.confounderQuality === 'clear' || pattern.confounderQuality === 'minor',
    sample: pattern.sampleSize >= OUTCOME_MINIMUM_TENANTS,
    tenant_diversity: pattern.tenantDiversity >= OUTCOME_MINIMUM_TENANTS
      && pattern.sampleSize === pattern.tenantDiversity,
    dominance: pattern.suppressionReason !== 'privacy_risk',
    privacy: schema && pattern.suppressionReason == null,
    causality: pattern.evidenceClass === 'observed_association',
  };
  const passedGates = OUTCOME_VALIDATION_GATES.filter((gate) => decisions[gate]);
  const failedGates = OUTCOME_VALIDATION_GATES.filter((gate) => !decisions[gate]);
  return {
    patternId: pattern.patternId,
    validationVersion: OUTCOME_VALIDATION_VERSION,
    validationStatus: failedGates.length ? 'suppressed' as const : 'validated' as const,
    passedGates: [...passedGates],
    failedGates: [...failedGates],
    sampleCount: pattern.sampleSize,
    distinctTenantCount: pattern.tenantDiversity,
    evidenceClass: 'observed_association' as const,
    suppressionReason: failedGates.length ? pattern.suppressionReason ?? 'contract_violation' : null,
    observationWindow: pattern.observationWindow,
  };
}

function monthLabel(timestamp: number): string {
  const date = new Date(timestamp);
  return `month:${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthBounds(label: string): [number, number] {
  const match = /^month:(\d{4})-(0[1-9]|1[0-2])$/.exec(label);
  if (!match) throw new Error('observation window must be a coarse month');
  const start = Date.UTC(Number(match[1]), Number(match[2]) - 1, 1);
  return [start, Date.UTC(Number(match[1]), Number(match[2]), 1) - 1];
}

export function createOutcomeFeedbackService(db: CrossStoreDb, enabled: boolean) {
  const requireEnabled = () => { if (!enabled) throw new Error('outcome feedback feature flag is disabled'); };
  const service = {
    recordIntervention: async (input: InterventionInput) => {
      requireEnabled();
      assertInterventionInput(input);
      const interventionId = stableId('int', [
        input.tenantId, input.source, input.sourceEventId, input.interventionVersion,
      ]);
      await db.prepare(`INSERT INTO cross_store_private_interventions (
        intervention_id,tenant_id,store_id,platform,finding_code,analysis_id,
        intervention_code,scope,source,source_event_id,occurred_at,
        verification_status,intervention_version,created_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING`).run(
        interventionId, input.tenantId, input.storeId, input.platform, input.findingCode,
        input.analysisId, input.interventionCode, input.scope, input.source,
        input.sourceEventId, input.occurredAt, input.verificationStatus,
        input.interventionVersion, Date.now(),
      );
      return interventionId;
    },

    recordOutcome: async (input: OutcomeObservationInput) => {
      requireEnabled();
      assertOutcomeObservationInput(input);
      const row = await db.prepare(`SELECT intervention_id,tenant_id,store_id,platform,
        finding_code,analysis_id,intervention_code,scope,source,source_event_id,
        occurred_at,verification_status,intervention_version
        FROM cross_store_private_interventions WHERE intervention_id=? LIMIT 1`)
        .get(input.interventionId);
      if (!row) throw new Error('intervention does not exist');
      const intervention: StoredIntervention = {
        interventionId: String(row.intervention_id), tenantId: String(row.tenant_id),
        storeId: String(row.store_id), platform: String(row.platform) as CrossStorePlatform,
        findingCode: String(row.finding_code), analysisId: String(row.analysis_id),
        interventionCode: String(row.intervention_code) as InterventionCode,
        scope: 'storefront', source: String(row.source) as InterventionSource,
        sourceEventId: String(row.source_event_id), occurredAt: Number(row.occurred_at),
        verificationStatus: String(row.verification_status) as StoredIntervention['verificationStatus'],
        interventionVersion: String(row.intervention_version) as typeof INTERVENTION_VERSION,
      };
      const overlap = await db.prepare(`SELECT COUNT(*) AS count
        FROM cross_store_private_interventions
        WHERE tenant_id=? AND intervention_id<>? AND verification_status='verified'
          AND occurred_at>? AND occurred_at<?`).get(
        input.tenantId, input.interventionId, input.baselineWindowEnd, input.observationWindowEnd,
      );
      const assessment = evaluateOutcomeObservation(input, intervention, Number(overlap?.count ?? 0));
      const outcomeId = stableId('out', [
        input.tenantId, input.interventionId, input.metricCode,
        input.sourceEventId, input.outcomeVersion,
      ]);
      await db.prepare(`INSERT INTO cross_store_private_outcome_observations (
        outcome_id,intervention_id,tenant_id,metric_code,metric_version,
        baseline_window_start,baseline_window_end,baseline_value,washout_seconds,
        washout_policy_version,observation_window_start,observation_window_end,
        observation_policy_version,observed_value,denominator_status,
        data_completeness,confounders_json,confounder_quality,measurement_quality,
        overlap_status,effect_band,eligibility_status,suppression_reason,
        evidence_class,source_event_id,outcome_version,created_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT DO NOTHING`).run(
        outcomeId, input.interventionId, input.tenantId, input.metricCode,
        input.metricVersion, input.baselineWindowStart, input.baselineWindowEnd,
        input.baselineValue, input.washoutSeconds, input.washoutPolicyVersion,
        input.observationWindowStart, input.observationWindowEnd,
        input.observationPolicyVersion, input.observedValue, input.denominatorStatus,
        input.dataCompleteness, JSON.stringify(input.confounders),
        assessment.confounderQuality, input.measurementQuality, assessment.overlapStatus,
        assessment.effectBand, assessment.eligibilityStatus, assessment.suppressionReason,
        assessment.evidenceClass, input.sourceEventId, input.outcomeVersion, Date.now(),
      );
      return { outcomeId, assessment };
    },

    recomputeScope: async (scope: OutcomeScope) => {
      requireEnabled();
      const [start, end] = monthBounds(scope.observationWindow);
      const rows = await db.prepare(`SELECT o.outcome_id,o.tenant_id,i.platform,i.finding_code,
          i.intervention_code,o.metric_code,o.metric_version,i.intervention_version,
          o.observation_window_end,o.effect_band,o.eligibility_status,
          o.suppression_reason,o.measurement_quality,o.data_completeness,
          o.confounder_quality,ABS(o.observed_value-o.baseline_value) AS delta_magnitude
        FROM cross_store_private_outcome_observations o
        JOIN cross_store_private_interventions i ON i.intervention_id=o.intervention_id
        WHERE i.platform=? AND i.finding_code=? AND i.intervention_code=?
          AND o.metric_code=? AND o.observation_window_end BETWEEN ? AND ?
        ORDER BY o.tenant_id,o.outcome_id LIMIT ?`).all(
        scope.platform, scope.findingCode, scope.interventionCode,
        scope.metricCode, start, end, MAX_OUTCOME_BATCH + 1,
      );
      if (rows.length > MAX_OUTCOME_BATCH) throw new Error('outcome recomputation requires bounded continuation');
      const contributions: OutcomeContribution[] = rows.map((row) => ({
        outcomeId: String(row.outcome_id), tenantId: String(row.tenant_id),
        platform: String(row.platform) as CrossStorePlatform,
        findingCode: String(row.finding_code),
        interventionCode: String(row.intervention_code) as InterventionCode,
        metricCode: String(row.metric_code) as OutcomeMetric,
        metricVersion: String(row.metric_version), interventionVersion: String(row.intervention_version),
        observationWindow: monthLabel(Number(row.observation_window_end)),
        effectBand: row.effect_band == null ? null : String(row.effect_band) as EffectBand,
        eligibilityStatus: String(row.eligibility_status) as OutcomeContribution['eligibilityStatus'],
        suppressionReason: row.suppression_reason == null ? null
          : String(row.suppression_reason) as OutcomeSuppressionReason,
        measurementQuality: String(row.measurement_quality) as MeasurementQuality,
        dataCompleteness: String(row.data_completeness) as OutcomeContribution['dataCompleteness'],
        confounderQuality: String(row.confounder_quality) as OutcomeContribution['confounderQuality'],
        deltaMagnitude: Number(row.delta_magnitude),
      }));
      const cell = aggregateOutcomeContributions(contributions, scope);
      const pattern = patternFromOutcomeCell(cell);
      const validation = validateOutcomePattern(pattern);
      pattern.lifecycleStatus = validation.validationStatus === 'validated' ? 'validated' : 'suppressed';
      pattern.suppressionReason = validation.suppressionReason;
      await db.batch([
        {
          sql: `DELETE FROM cross_store_outcome_aggregate_cells WHERE
            observation_window=? AND anonymous_segment=? AND finding_code=?
            AND intervention_code=? AND outcome_metric_code=? AND effect_band=?`,
          params: [scope.observationWindow, `platform:${scope.platform}`, scope.findingCode,
            scope.interventionCode, scope.metricCode, scope.effectBand],
        },
        {
          sql: `INSERT INTO cross_store_outcome_aggregate_cells (
            observation_window,anonymous_segment,finding_code,intervention_code,
            outcome_metric_code,effect_band,data_contract_version,outcome_contract_version,
            metric_version,intervention_version,aggregation_version,privacy_policy_version,
            tenant_count,observation_count,measurement_quality,data_completeness,
            confounder_quality,dominance_status,validation_status,suppression_reason
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          params: [cell.observationWindow, `platform:${cell.platform}`, cell.findingCode,
            cell.interventionCode, cell.metricCode, cell.effectBand,
            CROSS_STORE_DATA_CONTRACT_VERSION, OUTCOME_CONTRACT_VERSION,
            cell.metricVersion, cell.interventionVersion, OUTCOME_AGGREGATION_VERSION,
            CROSS_STORE_PRIVACY_POLICY_VERSION, cell.tenantCount, cell.observationCount,
            cell.measurementQuality, cell.dataCompleteness, cell.confounderQuality,
            cell.dominanceStatus, cell.validationStatus, cell.suppressionReason],
        },
        {
          sql: `INSERT INTO cross_store_outcome_patterns (
            pattern_id,pattern_version,data_contract_version,outcome_contract_version,
            metric_version,intervention_version,aggregation_version,privacy_policy_version,
            finding_code,intervention_code,outcome_metric_code,anonymous_segment,effect_band,
            evidence_class,sample_size,tenant_diversity,measurement_quality,data_completeness,
            confounder_quality,lifecycle_status,suppression_reason,observation_window
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
          ON CONFLICT(pattern_id) DO UPDATE SET sample_size=excluded.sample_size,
            tenant_diversity=excluded.tenant_diversity,
            measurement_quality=excluded.measurement_quality,
            data_completeness=excluded.data_completeness,
            confounder_quality=excluded.confounder_quality,
            lifecycle_status=excluded.lifecycle_status,
            suppression_reason=excluded.suppression_reason`,
          params: [pattern.patternId, pattern.patternVersion, pattern.dataContractVersion,
            pattern.outcomeContractVersion, pattern.metricVersion, pattern.interventionVersion,
            pattern.aggregationVersion, pattern.privacyPolicyVersion, pattern.findingCode,
            pattern.interventionCode, pattern.outcomeMetricCode, pattern.anonymousSegment,
            pattern.effectBand, pattern.evidenceClass, pattern.sampleSize,
            pattern.tenantDiversity, pattern.measurementQuality, pattern.dataCompleteness,
            pattern.confounderQuality, pattern.lifecycleStatus, pattern.suppressionReason,
            pattern.observationWindow],
        },
        {
          sql: `INSERT INTO cross_store_outcome_pattern_validation_results (
            pattern_id,validation_version,validation_status,passed_gates_json,
            failed_gates_json,sample_count,distinct_tenant_count,evidence_class,
            suppression_reason,observation_window
          ) VALUES (?,?,?,?,?,?,?,?,?,?)
          ON CONFLICT(pattern_id,validation_version) DO UPDATE SET
            validation_status=excluded.validation_status,
            passed_gates_json=excluded.passed_gates_json,
            failed_gates_json=excluded.failed_gates_json,
            sample_count=excluded.sample_count,
            distinct_tenant_count=excluded.distinct_tenant_count,
            suppression_reason=excluded.suppression_reason`,
          params: [validation.patternId, validation.validationVersion,
            validation.validationStatus, JSON.stringify(validation.passedGates),
            JSON.stringify(validation.failedGates), validation.sampleCount,
            validation.distinctTenantCount, validation.evidenceClass,
            validation.suppressionReason, validation.observationWindow],
        },
      ]);
      return { cell, pattern, validation };
    },

    removeTenant: async (tenantIdInput: string) => {
      requireEnabled();
      const tenantId = nonEmpty(tenantIdInput, 'tenantId');
      const rows = await db.prepare(`SELECT DISTINCT i.platform,i.finding_code,
          i.intervention_code,o.metric_code,o.metric_version,i.intervention_version,
          o.effect_band,o.observation_window_end
        FROM cross_store_private_outcome_observations o
        JOIN cross_store_private_interventions i ON i.intervention_id=o.intervention_id
        WHERE o.tenant_id=? LIMIT ?`).all(tenantId, MAX_OUTCOME_WINDOWS_PER_DELETION + 1);
      if (rows.length > MAX_OUTCOME_WINDOWS_PER_DELETION) throw new Error('tenant deletion requires bounded continuation');
      await db.batch([
        { sql: 'DELETE FROM cross_store_private_outcome_observations WHERE tenant_id=?', params: [tenantId] },
        { sql: 'DELETE FROM cross_store_private_interventions WHERE tenant_id=?', params: [tenantId] },
      ]);
      const scopes = rows.flatMap((row) => row.effect_band == null ? [] : [{
        platform: String(row.platform) as CrossStorePlatform,
        findingCode: String(row.finding_code),
        interventionCode: String(row.intervention_code) as InterventionCode,
        metricCode: String(row.metric_code) as OutcomeMetric,
        metricVersion: String(row.metric_version),
        interventionVersion: String(row.intervention_version),
        effectBand: String(row.effect_band) as EffectBand,
        observationWindow: monthLabel(Number(row.observation_window_end)),
      }]);
      const unique = [...new Map(scopes.map((scope) => [JSON.stringify(scope), scope])).values()];
      for (const scope of unique) await service.recomputeScope(scope);
    },
  };
  return service;
}
