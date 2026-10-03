import {
  CROSS_STORE_AGGREGATION_VERSION,
  CROSS_STORE_DATA_CONTRACT_VERSION,
  CROSS_STORE_METRIC_VERSION,
  CROSS_STORE_PRIVACY_POLICY_VERSION,
  CROSS_STORE_SEGMENT_VERSION,
  PREVALENCE_MINIMUM_TENANTS,
  isApprovedFindingCode,
  isApprovedSegmentKey,
  type CrossStoreDb,
} from './aggregation';
import {
  PREVALENCE_PATTERN_VERSION,
  assertSharedPatternContract,
  type CandidatePattern,
} from './patterns';

export const PATTERN_VALIDATION_VERSION = 'pattern_validation_v1_staging';
export const MAX_PATTERN_VALIDATION_BATCH = 100;

export const VALIDATION_GATES = [
  'schema', 'data_contract', 'sample', 'tenant_diversity', 'dominance',
  'rare_segment', 'reidentification', 'measurement_quality', 'freshness',
  'version_compatibility', 'deletion_consistency', 'causality',
] as const;

export type ValidationGate = typeof VALIDATION_GATES[number];

export type PatternValidationPolicy = {
  validationVersion: string;
  patternVersion: string;
  dataContractVersion: string;
  analyzerVersion: string;
  metricVersion: string;
  segmentVersion: string;
  aggregationVersion: string;
  privacyPolicyVersion: string;
};

export const DEFAULT_PATTERN_VALIDATION_POLICY: PatternValidationPolicy = {
  validationVersion: PATTERN_VALIDATION_VERSION,
  patternVersion: PREVALENCE_PATTERN_VERSION,
  dataContractVersion: CROSS_STORE_DATA_CONTRACT_VERSION,
  analyzerVersion: 'landing_page_analyzer_v1',
  metricVersion: CROSS_STORE_METRIC_VERSION,
  segmentVersion: CROSS_STORE_SEGMENT_VERSION,
  aggregationVersion: CROSS_STORE_AGGREGATION_VERSION,
  privacyPolicyVersion: CROSS_STORE_PRIVACY_POLICY_VERSION,
};

export type PatternValidationResult = {
  patternId: string;
  validationVersion: string;
  dataContractVersion: string;
  validationStatus: 'validated' | 'suppressed';
  passedGates: ValidationGate[];
  failedGates: ValidationGate[];
  sampleCount: number;
  distinctTenantCount: number;
  measurementQuality: CandidatePattern['measurementQuality'];
  freshnessStatus: 'provisional_validated_no_activation' | 'invalid';
  versionCompatibility: 'compatible' | 'incompatible';
  privacyRisk: 'none_detected' | 'detected';
  evidenceQuality: 'sufficient_for_staging_validation' | 'insufficient';
  suppressionReason: CandidatePattern['suppressionReason'];
  validationWindow: string;
};

function scalarShape(pattern: CandidatePattern): boolean {
  return typeof pattern.patternId === 'string' && pattern.patternId.startsWith('sp_')
    && typeof pattern.patternVersion === 'string'
    && typeof pattern.analyzerVersion === 'string'
    && typeof pattern.findingCode === 'string'
    && typeof pattern.anonymousSegment === 'string'
    && Number.isInteger(pattern.sampleSize) && pattern.sampleSize >= 0
    && Number.isInteger(pattern.tenantDiversity) && pattern.tenantDiversity >= 0
    && ['candidate', 'validated', 'suppressed'].includes(pattern.lifecycleStatus)
    && /^month:\d{4}-(0[1-9]|1[0-2])$/.test(pattern.observationWindow)
    && pattern.confidenceComponents != null && typeof pattern.confidenceComponents === 'object'
    && pattern.freshness != null && typeof pattern.freshness === 'object';
}

function contractShape(pattern: CandidatePattern): boolean {
  try {
    assertSharedPatternContract(pattern);
    return scalarShape(pattern)
      && isApprovedFindingCode(pattern.findingCode)
      && isApprovedSegmentKey(pattern.anonymousSegment)
      && pattern.evidenceClass === 'observed_association'
      && pattern.direction === 'observed'
      && pattern.effectBand === 'not_applicable_prevalence';
  } catch {
    return false;
  }
}

function versionCompatible(pattern: CandidatePattern, policy: PatternValidationPolicy): boolean {
  return pattern.patternVersion === policy.patternVersion
    && pattern.analyzerVersion === policy.analyzerVersion
    && pattern.metricVersion === policy.metricVersion
    && pattern.segmentTaxonomyVersion === policy.segmentVersion
    && pattern.aggregationMethodVersion === policy.aggregationVersion
    && pattern.privacyPolicyVersion === policy.privacyPolicyVersion;
}

function noOutcomeOrCausalClaim(pattern: CandidatePattern): boolean {
  const candidate = pattern as CandidatePattern & {
    interventionCode?: unknown; outcomeMetricCode?: unknown;
  };
  return candidate.interventionCode == null && candidate.outcomeMetricCode == null
    && pattern.evidenceClass === 'observed_association'
    && pattern.direction === 'observed'
    && pattern.effectBand === 'not_applicable_prevalence';
}

export function validatePattern(
  pattern: CandidatePattern,
  policy: PatternValidationPolicy = DEFAULT_PATTERN_VALIDATION_POLICY,
): PatternValidationResult {
  const schema = scalarShape(pattern);
  const dataContract = contractShape(pattern);
  const sample = pattern.tenantDiversity >= PREVALENCE_MINIMUM_TENANTS;
  const diversity = pattern.sampleSize === pattern.tenantDiversity && sample;
  const dominance = pattern.confidenceComponents?.contributionBound === 'pass'
    && pattern.sampleSize === pattern.tenantDiversity;
  const rareSegment = isApprovedSegmentKey(pattern.anonymousSegment) && sample;
  const reidentification = dataContract && dominance && rareSegment
    && pattern.observationWindow.startsWith('month:');
  const measurement = pattern.measurementQuality !== 'low'
    && pattern.confidenceComponents?.dataCompleteness === 'bounded_complete';
  const freshness = pattern.freshness?.policy === 'provisional_not_approved'
    && (pattern.freshness.status === 'unvalidated'
      || pattern.freshness.status === 'provisional_validated_no_activation');
  const versions = versionCompatible(pattern, policy);
  const deletion = dominance && pattern.confidenceComponents?.sampleGate === (sample ? 'pass' : 'fail');
  const causality = noOutcomeOrCausalClaim(pattern);
  const decisions: Record<ValidationGate, boolean> = {
    schema, data_contract: dataContract, sample, tenant_diversity: diversity,
    dominance, rare_segment: rareSegment, reidentification, measurement_quality: measurement,
    freshness, version_compatibility: versions, deletion_consistency: deletion, causality,
  };
  const passedGates = VALIDATION_GATES.filter((gate) => decisions[gate]);
  const failedGates = VALIDATION_GATES.filter((gate) => !decisions[gate]);
  const suppressionReason: CandidatePattern['suppressionReason'] = !schema || !dataContract || !causality
    ? 'contract_violation'
    : !versions ? 'incompatible_version'
      : !sample || !diversity ? 'small_sample'
        : !measurement ? 'low_measurement_quality'
          : !freshness ? 'stale'
            : !dominance || !rareSegment || !reidentification || !deletion ? 'privacy_risk'
              : null;
  const validationStatus = failedGates.length === 0 ? 'validated' : 'suppressed';
  return {
    patternId: pattern.patternId,
    validationVersion: policy.validationVersion,
    dataContractVersion: policy.dataContractVersion,
    validationStatus,
    passedGates: [...passedGates],
    failedGates: [...failedGates],
    sampleCount: pattern.sampleSize,
    distinctTenantCount: pattern.tenantDiversity,
    measurementQuality: pattern.measurementQuality,
    freshnessStatus: freshness ? 'provisional_validated_no_activation' : 'invalid',
    versionCompatibility: versions ? 'compatible' : 'incompatible',
    privacyRisk: reidentification && dominance && rareSegment ? 'none_detected' : 'detected',
    evidenceQuality: validationStatus === 'validated'
      ? 'sufficient_for_staging_validation' : 'insufficient',
    suppressionReason,
    validationWindow: pattern.observationWindow,
  };
}

const UPSERT_VALIDATION = `INSERT INTO cross_store_pattern_validation_results (
    pattern_id, validation_version, data_contract_version, validation_status,
    passed_gates_json, failed_gates_json, sample_count, distinct_tenant_count,
    measurement_quality, freshness_status, version_compatibility, privacy_risk,
    evidence_quality, suppression_reason, validation_window
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(pattern_id, validation_version) DO UPDATE SET
    validation_status=excluded.validation_status,
    passed_gates_json=excluded.passed_gates_json,
    failed_gates_json=excluded.failed_gates_json,
    sample_count=excluded.sample_count,
    distinct_tenant_count=excluded.distinct_tenant_count,
    measurement_quality=excluded.measurement_quality,
    freshness_status=excluded.freshness_status,
    version_compatibility=excluded.version_compatibility,
    privacy_risk=excluded.privacy_risk,
    evidence_quality=excluded.evidence_quality,
    suppression_reason=excluded.suppression_reason`;

function resultParams(result: PatternValidationResult): unknown[] {
  return [
    result.patternId, result.validationVersion, result.dataContractVersion,
    result.validationStatus, JSON.stringify(result.passedGates), JSON.stringify(result.failedGates),
    result.sampleCount, result.distinctTenantCount, result.measurementQuality,
    result.freshnessStatus, result.versionCompatibility, result.privacyRisk,
    result.evidenceQuality, result.suppressionReason, result.validationWindow,
  ];
}

function rowToPattern(row: Record<string, unknown>): CandidatePattern {
  return {
    patternId: String(row.pattern_id),
    patternVersion: String(row.pattern_version) as CandidatePattern['patternVersion'],
    analyzerVersion: String(row.analyzer_version),
    metricVersion: String(row.metric_version) as CandidatePattern['metricVersion'],
    segmentTaxonomyVersion: String(row.segment_taxonomy_version) as CandidatePattern['segmentTaxonomyVersion'],
    aggregationMethodVersion: String(row.aggregation_method_version) as CandidatePattern['aggregationMethodVersion'],
    privacyPolicyVersion: String(row.privacy_policy_version) as CandidatePattern['privacyPolicyVersion'],
    findingCode: String(row.finding_code),
    anonymousSegment: String(row.anonymous_segment) as CandidatePattern['anonymousSegment'],
    evidenceClass: 'observed_association', direction: 'observed', effectBand: 'not_applicable_prevalence',
    sampleSize: Number(row.sample_size), tenantDiversity: Number(row.tenant_diversity),
    confidenceComponents: JSON.parse(String(row.confidence_components_json)),
    freshness: JSON.parse(String(row.freshness_json)),
    measurementQuality: String(row.measurement_quality) as CandidatePattern['measurementQuality'],
    lifecycleStatus: String(row.lifecycle_status) as CandidatePattern['lifecycleStatus'],
    suppressionReason: row.suppression_reason == null ? null : String(row.suppression_reason) as CandidatePattern['suppressionReason'],
    observationWindow: String(row.observation_window),
  };
}

const READ_PATTERNS = `SELECT pattern_id, pattern_version, analyzer_version,
    metric_version, segment_taxonomy_version, aggregation_method_version,
    privacy_policy_version, finding_code, anonymous_segment, evidence_class,
    direction, effect_band, sample_size, tenant_diversity,
    confidence_components_json, freshness_json, measurement_quality,
    lifecycle_status, suppression_reason, observation_window
  FROM cross_store_candidate_patterns
  WHERE lifecycle_status IN ('candidate', 'validated', 'suppressed')
  ORDER BY observation_window, finding_code, anonymous_segment
  LIMIT ?`;

export function createPatternValidationService(
  db: CrossStoreDb,
  enabled: boolean,
  policy: PatternValidationPolicy = DEFAULT_PATTERN_VALIDATION_POLICY,
) {
  const requireEnabled = () => {
    if (!enabled) throw new Error('cross-store pattern validation feature flag is disabled');
  };
  const validateChangedPatterns = async (patterns: CandidatePattern[]) => {
    requireEnabled();
    if (patterns.length > MAX_PATTERN_VALIDATION_BATCH) throw new Error('validation batch exceeds bounded maximum');
    const results = patterns.map((pattern) => validatePattern(pattern, policy));
    if (!results.length) return results;
    await db.batch(results.flatMap((result, index) => {
      const pattern = patterns[index];
      const freshness = result.validationStatus === 'validated'
        ? JSON.stringify({ policy: 'provisional_not_approved', status: 'provisional_validated_no_activation' })
        : JSON.stringify(pattern.freshness);
      const operations = [];
      if (result.validationStatus === 'validated') operations.push({
        sql: `UPDATE cross_store_candidate_patterns SET lifecycle_status='stale', suppression_reason='stale'
          WHERE pattern_id<>? AND finding_code=? AND anonymous_segment=? AND observation_window=?
            AND lifecycle_status='validated'
            AND (pattern_version<>? OR analyzer_version<>? OR metric_version<>?
              OR segment_taxonomy_version<>? OR aggregation_method_version<>?
              OR privacy_policy_version<>?)`,
        params: [
          pattern.patternId, pattern.findingCode, pattern.anonymousSegment, pattern.observationWindow,
          pattern.patternVersion, pattern.analyzerVersion, pattern.metricVersion,
          pattern.segmentTaxonomyVersion, pattern.aggregationMethodVersion, pattern.privacyPolicyVersion,
        ],
      });
      operations.push(
        { sql: UPSERT_VALIDATION, params: resultParams(result) },
        {
          sql: `UPDATE cross_store_candidate_patterns
            SET lifecycle_status=?, suppression_reason=?, freshness_json=? WHERE pattern_id=?`,
          params: [result.validationStatus, result.suppressionReason, freshness, pattern.patternId],
        },
      );
      return operations;
    }));
    return results;
  };
  return {
    validateChangedPatterns,
    validateBounded: async (limit = MAX_PATTERN_VALIDATION_BATCH) => {
      requireEnabled();
      if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PATTERN_VALIDATION_BATCH) {
        throw new Error('validation limit is invalid');
      }
      const rows = await db.prepare(READ_PATTERNS).all(limit);
      return validateChangedPatterns(rows.map(rowToPattern));
    },
  };
}
