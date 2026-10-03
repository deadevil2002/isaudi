import {
  CROSS_STORE_AGGREGATION_VERSION,
  CROSS_STORE_DATA_CONTRACT_VERSION,
  CROSS_STORE_METRIC_VERSION,
  CROSS_STORE_PRIVACY_POLICY_VERSION,
  CROSS_STORE_SEGMENT_VERSION,
  PREVALENCE_MINIMUM_TENANTS,
  isApprovedFindingCode,
  isApprovedSegmentKey,
  isCoarseMonthWindow,
  type AggregateCell,
  type CrossStoreDb,
} from './aggregation';

export const SHARED_PATTERN_SCHEMA_VERSION = 'shared_pattern_v1';
export const PREVALENCE_PATTERN_VERSION = 'shared_pattern_v1.prevalence_candidate_v1';
export const MAX_PATTERN_GENERATION_BATCH = 100;

export const SHARED_PATTERN_ALLOWED_FIELDS = [
  'patternId', 'patternVersion', 'analyzerVersion', 'metricVersion',
  'segmentTaxonomyVersion', 'aggregationMethodVersion', 'privacyPolicyVersion',
  'findingCode', 'anonymousSegment', 'interventionCode', 'outcomeMetricCode',
  'evidenceClass', 'direction', 'effectBand', 'sampleSize', 'tenantDiversity',
  'confidenceComponents', 'freshness', 'measurementQuality', 'lifecycleStatus',
  'suppressionReason', 'observationWindow',
] as const;

export const SHARED_PATTERN_FORBIDDEN_FIELDS = [
  'userId', 'user_id', 'email', 'phone', 'storeId', 'store_id', 'storeName',
  'storeUrl', 'merchantId', 'merchant_id', 'customerId', 'customer_id', 'tenantId',
  'tenant_id', 'tenantHash', 'sourceTenantId', 'sessionId', 'accessToken', 'refreshToken',
  'productId', 'orderId', 'reportId', 'analysisId', 'referralId', 'partnerOfferId',
  'partnerName', 'partnerUrl', 'commission', 'commissionAmount', 'sourceUrl', 'rawJson',
  'prompt', 'chatContext', 'exactTimestamp', 'exactRevenue', 'exactValue',
] as const;

type SuppressionReason = 'small_sample' | 'low_measurement_quality' | 'invalid_aggregate' | 'privacy_risk';

export type CandidatePattern = {
  patternId: string;
  patternVersion: typeof PREVALENCE_PATTERN_VERSION;
  analyzerVersion: string;
  metricVersion: typeof CROSS_STORE_METRIC_VERSION;
  segmentTaxonomyVersion: typeof CROSS_STORE_SEGMENT_VERSION;
  aggregationMethodVersion: typeof CROSS_STORE_AGGREGATION_VERSION;
  privacyPolicyVersion: typeof CROSS_STORE_PRIVACY_POLICY_VERSION;
  findingCode: string;
  anonymousSegment: AggregateCell['segmentKey'];
  evidenceClass: 'observed_association';
  direction: 'observed';
  effectBand: 'not_applicable_prevalence';
  sampleSize: number;
  tenantDiversity: number;
  confidenceComponents: {
    sampleGate: 'pass' | 'fail';
    contributionBound: 'pass' | 'fail';
    consistency: 'single_aggregate_cell';
    uncertainty: 'not_estimated';
    dataCompleteness: 'bounded_complete' | 'invalid';
  };
  freshness: {
    policy: 'provisional_not_approved';
    status: 'unvalidated';
  };
  measurementQuality: AggregateCell['measurementQuality'];
  lifecycleStatus: 'candidate' | 'suppressed';
  suppressionReason: SuppressionReason | null;
  observationWindow: string;
};

function monthLabel(value: number): string {
  if (!isCoarseMonthWindow(value)) throw new Error('aggregate observation window is not coarse monthly data');
  const now = new Date();
  const currentMonth = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  if (value > currentMonth) throw new Error('aggregate observation window cannot be in the future');
  return `month:${new Date(value).toISOString().slice(0, 7)}`;
}

function assertCompatibleCell(cell: AggregateCell): void {
  if (cell.dataContractVersion !== CROSS_STORE_DATA_CONTRACT_VERSION
    || cell.segmentVersion !== CROSS_STORE_SEGMENT_VERSION
    || cell.metricVersion !== CROSS_STORE_METRIC_VERSION
    || cell.aggregationVersion !== CROSS_STORE_AGGREGATION_VERSION
    || cell.privacyPolicyVersion !== CROSS_STORE_PRIVACY_POLICY_VERSION) {
    throw new Error('aggregate versions are incompatible with the pattern generator');
  }
  if (cell.metricCode !== 'finding_prevalence' || cell.valueBand !== 'present'
    || !isApprovedFindingCode(cell.findingCode) || !isApprovedSegmentKey(cell.segmentKey)) {
    throw new Error('aggregate source is outside the approved data contract');
  }
}

function canonicalKey(cell: AggregateCell, observationWindow: string): string {
  return [
    PREVALENCE_PATTERN_VERSION,
    cell.dataContractVersion,
    cell.analyzerVersion,
    cell.metricVersion,
    cell.segmentVersion,
    cell.aggregationVersion,
    cell.privacyPolicyVersion,
    cell.findingCode,
    cell.segmentKey,
    cell.metricCode,
    observationWindow,
  ].join('|');
}

async function semanticPatternId(key: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return `sp_${[...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('').slice(0, 32)}`;
}

function suppression(cell: AggregateCell): SuppressionReason | null {
  if (!Number.isInteger(cell.tenantCount) || !Number.isInteger(cell.observationCount)
    || cell.tenantCount < 0 || cell.observationCount < 0) return 'invalid_aggregate';
  if (cell.tenantCount < PREVALENCE_MINIMUM_TENANTS) return 'small_sample';
  if (cell.observationCount !== cell.tenantCount) return 'privacy_risk';
  if (cell.measurementQuality === 'low') return 'low_measurement_quality';
  if (cell.validationStatus !== 'eligible_for_validation') return 'invalid_aggregate';
  return null;
}

export async function candidateFromAggregate(cell: AggregateCell): Promise<CandidatePattern> {
  assertCompatibleCell(cell);
  const observationWindow = monthLabel(cell.observationWindowStart);
  const suppressionReason = suppression(cell);
  const contributionBound = cell.observationCount === cell.tenantCount ? 'pass' : 'fail';
  const pattern: CandidatePattern = {
    patternId: await semanticPatternId(canonicalKey(cell, observationWindow)),
    patternVersion: PREVALENCE_PATTERN_VERSION,
    analyzerVersion: cell.analyzerVersion,
    metricVersion: CROSS_STORE_METRIC_VERSION,
    segmentTaxonomyVersion: CROSS_STORE_SEGMENT_VERSION,
    aggregationMethodVersion: CROSS_STORE_AGGREGATION_VERSION,
    privacyPolicyVersion: CROSS_STORE_PRIVACY_POLICY_VERSION,
    findingCode: cell.findingCode,
    anonymousSegment: cell.segmentKey,
    evidenceClass: 'observed_association',
    direction: 'observed',
    effectBand: 'not_applicable_prevalence',
    sampleSize: cell.observationCount,
    tenantDiversity: cell.tenantCount,
    confidenceComponents: {
      sampleGate: cell.tenantCount >= PREVALENCE_MINIMUM_TENANTS ? 'pass' : 'fail',
      contributionBound,
      consistency: 'single_aggregate_cell',
      uncertainty: 'not_estimated',
      dataCompleteness: contributionBound === 'pass' ? 'bounded_complete' : 'invalid',
    },
    freshness: { policy: 'provisional_not_approved', status: 'unvalidated' },
    measurementQuality: cell.measurementQuality,
    lifecycleStatus: suppressionReason ? 'suppressed' : 'candidate',
    suppressionReason,
    observationWindow,
  };
  assertSharedPatternContract(pattern);
  return pattern;
}

export function assertSharedPatternContract(value: unknown): asserts value is CandidatePattern {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('pattern must be an object');
  const allowed = new Set<string>(SHARED_PATTERN_ALLOWED_FIELDS);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`pattern field is not allowed: ${key}`);
  }
  const forbidden = new Set<string>(SHARED_PATTERN_FORBIDDEN_FIELDS.map((field) => field.toLowerCase()));
  const visit = (input: unknown): void => {
    if (Array.isArray(input)) return input.forEach(visit);
    if (!input || typeof input !== 'object') return;
    for (const [key, nested] of Object.entries(input)) {
      if (forbidden.has(key.toLowerCase())) throw new Error(`forbidden pattern field: ${key}`);
      visit(nested);
    }
  };
  visit(value);
}

const UPSERT_PATTERN = `INSERT INTO cross_store_candidate_patterns (
    pattern_id, pattern_version, analyzer_version, metric_version,
    segment_taxonomy_version, aggregation_method_version, privacy_policy_version,
    finding_code, anonymous_segment, evidence_class, direction, effect_band,
    sample_size, tenant_diversity, confidence_components_json, freshness_json,
    measurement_quality, lifecycle_status, suppression_reason, observation_window
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(pattern_id) DO UPDATE SET
    sample_size=excluded.sample_size,
    tenant_diversity=excluded.tenant_diversity,
    confidence_components_json=excluded.confidence_components_json,
    freshness_json=excluded.freshness_json,
    measurement_quality=excluded.measurement_quality,
    lifecycle_status=excluded.lifecycle_status,
    suppression_reason=excluded.suppression_reason`;

function patternParams(pattern: CandidatePattern): unknown[] {
  return [
    pattern.patternId, pattern.patternVersion, pattern.analyzerVersion, pattern.metricVersion,
    pattern.segmentTaxonomyVersion, pattern.aggregationMethodVersion, pattern.privacyPolicyVersion,
    pattern.findingCode, pattern.anonymousSegment, pattern.evidenceClass, pattern.direction,
    pattern.effectBand, pattern.sampleSize, pattern.tenantDiversity,
    JSON.stringify(pattern.confidenceComponents), JSON.stringify(pattern.freshness),
    pattern.measurementQuality, pattern.lifecycleStatus, pattern.suppressionReason,
    pattern.observationWindow,
  ];
}

function rowToCell(row: Record<string, unknown>): AggregateCell {
  return {
    observationWindowKind: 'month',
    observationWindowStart: Number(row.observation_window_start),
    segmentKey: String(row.segment_key) as AggregateCell['segmentKey'],
    findingCode: String(row.finding_code),
    metricCode: 'finding_prevalence',
    valueBand: 'present',
    analyzerVersion: String(row.analyzer_version),
    dataContractVersion: String(row.data_contract_version) as AggregateCell['dataContractVersion'],
    segmentVersion: String(row.segment_version) as AggregateCell['segmentVersion'],
    metricVersion: String(row.metric_version) as AggregateCell['metricVersion'],
    aggregationVersion: String(row.aggregation_version) as AggregateCell['aggregationVersion'],
    privacyPolicyVersion: String(row.privacy_policy_version) as AggregateCell['privacyPolicyVersion'],
    tenantCount: Number(row.tenant_count),
    observationCount: Number(row.observation_count),
    measurementQuality: String(row.measurement_quality) as AggregateCell['measurementQuality'],
    validationStatus: String(row.validation_status) as AggregateCell['validationStatus'],
    suppressionReason: row.suppression_reason == null ? null : 'small_sample',
  };
}

export function createPatternGenerationService(db: CrossStoreDb, enabled: boolean) {
  const requireEnabled = () => {
    if (!enabled) throw new Error('cross-store pattern generation feature flag is disabled');
  };
  const writeCells = async (cells: AggregateCell[]) => {
    requireEnabled();
    if (cells.length > MAX_PATTERN_GENERATION_BATCH) throw new Error('pattern batch exceeds bounded maximum');
    const patterns = await Promise.all(cells.map(candidateFromAggregate));
    if (patterns.length) await db.batch(patterns.map((pattern) => ({
      sql: UPSERT_PATTERN,
      params: patternParams(pattern),
    })));
    return patterns;
  };
  return {
    generateChangedCells: writeCells,
    generateBounded: async (limit = MAX_PATTERN_GENERATION_BATCH) => {
      requireEnabled();
      if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PATTERN_GENERATION_BATCH) {
        throw new Error('pattern generation limit is invalid');
      }
      const rows = await db.prepare(`SELECT observation_window_kind,
          observation_window_start, segment_key, finding_code, metric_code,
          value_band, analyzer_version, data_contract_version, segment_version,
          metric_version, aggregation_version, privacy_policy_version,
          tenant_count, observation_count, measurement_quality,
          validation_status, suppression_reason
        FROM cross_store_aggregate_cells
        ORDER BY observation_window_start, finding_code, segment_key
        LIMIT ?`).all(limit);
      return writeCells(rows.map(rowToCell));
    },
  };
}
