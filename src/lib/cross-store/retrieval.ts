import {
  CROSS_STORE_AGGREGATION_VERSION,
  CROSS_STORE_DATA_CONTRACT_VERSION,
  CROSS_STORE_METRIC_VERSION,
  CROSS_STORE_PRIVACY_POLICY_VERSION,
  CROSS_STORE_SEGMENT_VERSION,
  PREVALENCE_MINIMUM_TENANTS,
  isApprovedFindingCode,
  platformSegment,
  type CrossStoreDb,
  type CrossStorePlatform,
} from './aggregation';
import { PREVALENCE_PATTERN_VERSION, SHARED_PATTERN_FORBIDDEN_FIELDS } from './patterns';
import {
  DEFAULT_PATTERN_VALIDATION_POLICY,
  PATTERN_VALIDATION_VERSION,
  VALIDATION_GATES,
  type PatternValidationPolicy,
} from './validation';

export const CROSS_STORE_RETRIEVAL_FLAG = 'CROSS_STORE_RETRIEVAL_MODE';
export const CROSS_STORE_ACTIVATION_FLAG = 'CROSS_STORE_PATTERN_ACTIVATION_ENABLED';
export const MAX_RETRIEVED_PATTERNS = 3;
export const MAX_RETRIEVAL_FINDINGS = 20;
export const MAX_RETRIEVAL_CANDIDATES = 12;
export const MAX_PATTERN_AGE_MONTHS = 3;

export type RetrievalMode = 'off' | 'shadow';

export type ServerDerivedCustomerFacts = {
  platform: CrossStorePlatform;
  findingCodes: string[];
  analyzerVersion: string;
  dataContractVersion: string;
  segmentVersion: string;
  metricVersion: string;
  aggregationVersion: string;
  privacyPolicyVersion: string;
};

export type CompactPatternEvidence = {
  patternCode: string;
  findingCode: string;
  segmentCompatibility: 'exact_platform';
  tenantSampleBand: '20-49' | '50-99' | '100+';
  evidenceClass: 'observed_association';
  measurementQuality: 'high' | 'mixed';
  freshness: 'current_coarse_month';
  patternVersion: string;
  applicability: 'same_finding_same_platform';
};

type RetrievalRow = Record<string, unknown>;

const CUSTOMER_FACT_KEYS = new Set([
  'platform', 'findingCodes', 'analyzerVersion', 'dataContractVersion',
  'segmentVersion', 'metricVersion', 'aggregationVersion', 'privacyPolicyVersion',
]);

const RETRIEVAL_SELECT = `SELECT
    p.pattern_id, p.pattern_version, p.analyzer_version, p.metric_version,
    p.segment_taxonomy_version, p.aggregation_method_version,
    p.privacy_policy_version, p.finding_code, p.anonymous_segment,
    p.evidence_class, p.sample_size, p.tenant_diversity,
    p.confidence_components_json, p.freshness_json, p.measurement_quality,
    p.lifecycle_status, p.suppression_reason, p.observation_window,
    v.validation_status, v.data_contract_version, v.passed_gates_json,
    v.failed_gates_json, v.sample_count, v.distinct_tenant_count,
    v.measurement_quality AS validation_measurement_quality,
    v.freshness_status, v.version_compatibility, v.privacy_risk,
    v.evidence_quality, v.suppression_reason AS validation_suppression_reason,
    v.validation_window
  FROM cross_store_candidate_patterns p
  JOIN cross_store_pattern_validation_results v
    ON v.pattern_id=p.pattern_id AND v.validation_version=?
  WHERE p.lifecycle_status='active'
    AND p.anonymous_segment=?
    AND p.finding_code IN (__FINDINGS__)
    AND p.pattern_version=? AND p.analyzer_version=? AND p.metric_version=?
    AND p.segment_taxonomy_version=? AND p.aggregation_method_version=?
    AND p.privacy_policy_version=?
  ORDER BY CASE p.measurement_quality WHEN 'high' THEN 0 ELSE 1 END,
    p.tenant_diversity DESC, p.sample_size DESC, p.observation_window DESC,
    p.finding_code, p.pattern_id
  LIMIT ?`;

const ACTIVATION_SELECT = `SELECT
    p.pattern_id, p.pattern_version, p.analyzer_version, p.metric_version,
    p.segment_taxonomy_version, p.aggregation_method_version,
    p.privacy_policy_version, p.finding_code, p.anonymous_segment,
    p.evidence_class, p.sample_size, p.tenant_diversity,
    p.confidence_components_json, p.freshness_json, p.measurement_quality,
    p.lifecycle_status, p.suppression_reason, p.observation_window,
    v.validation_status, v.data_contract_version, v.passed_gates_json,
    v.failed_gates_json, v.sample_count, v.distinct_tenant_count,
    v.measurement_quality AS validation_measurement_quality,
    v.freshness_status, v.version_compatibility, v.privacy_risk,
    v.evidence_quality, v.suppression_reason AS validation_suppression_reason,
    v.validation_window
  FROM cross_store_candidate_patterns p
  JOIN cross_store_pattern_validation_results v
    ON v.pattern_id=p.pattern_id AND v.validation_version=?
  WHERE p.lifecycle_status='validated' AND p.pattern_id=?
    AND p.pattern_version=? AND p.analyzer_version=? AND p.metric_version=?
    AND p.segment_taxonomy_version=? AND p.aggregation_method_version=?
    AND p.privacy_policy_version=?
  LIMIT 1`;

function assertExactCustomerFacts(input: ServerDerivedCustomerFacts): void {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('server-derived customer facts are required');
  }
  for (const key of Object.keys(input)) {
    if (!CUSTOMER_FACT_KEYS.has(key)) throw new Error(`customer fact is not allowed: ${key}`);
  }
  platformSegment(input.platform);
  if (!Array.isArray(input.findingCodes) || input.findingCodes.length > MAX_RETRIEVAL_FINDINGS) {
    throw new Error('server-derived finding context exceeds the bounded maximum');
  }
  if (input.findingCodes.some((code) => typeof code !== 'string' || !isApprovedFindingCode(code))) {
    throw new Error('finding context contains an unapproved code');
  }
  if (input.analyzerVersion !== DEFAULT_PATTERN_VALIDATION_POLICY.analyzerVersion
    || input.dataContractVersion !== CROSS_STORE_DATA_CONTRACT_VERSION
    || input.segmentVersion !== CROSS_STORE_SEGMENT_VERSION
    || input.metricVersion !== CROSS_STORE_METRIC_VERSION
    || input.aggregationVersion !== CROSS_STORE_AGGREGATION_VERSION
    || input.privacyPolicyVersion !== CROSS_STORE_PRIVACY_POLICY_VERSION) {
    throw new Error('customer analysis versions are incompatible with retrieval');
  }
}

function parseJsonObject(value: unknown): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function monthIndex(label: string): number | null {
  const match = /^month:(\d{4})-(0[1-9]|1[0-2])$/.exec(label);
  return match ? Number(match[1]) * 12 + Number(match[2]) - 1 : null;
}

function isFresh(label: string, now: Date): boolean {
  const value = monthIndex(label);
  const current = now.getUTCFullYear() * 12 + now.getUTCMonth();
  return value != null && value <= current && current - value <= MAX_PATTERN_AGE_MONTHS;
}

function passesAllValidationGates(row: RetrievalRow): boolean {
  let passed: unknown;
  let failed: unknown;
  try {
    passed = JSON.parse(String(row.passed_gates_json));
    failed = JSON.parse(String(row.failed_gates_json));
  } catch {
    return false;
  }
  return Array.isArray(passed) && Array.isArray(failed) && failed.length === 0
    && VALIDATION_GATES.every((gate) => passed.includes(gate));
}

function eligibleRow(row: RetrievalRow, facts: ServerDerivedCustomerFacts, now: Date): boolean {
  const confidence = parseJsonObject(row.confidence_components_json);
  const freshness = parseJsonObject(row.freshness_json);
  const sample = Number(row.sample_size);
  const diversity = Number(row.tenant_diversity);
  return /^sp_[a-f0-9]{32}$/.test(String(row.pattern_id))
    && row.lifecycle_status === 'active'
    && row.suppression_reason == null
    && row.validation_suppression_reason == null
    && row.validation_status === 'validated'
    && row.version_compatibility === 'compatible'
    && row.privacy_risk === 'none_detected'
    && row.evidence_quality === 'sufficient_for_staging_validation'
    && row.freshness_status === 'provisional_validated_no_activation'
    && row.data_contract_version === facts.dataContractVersion
    && row.pattern_version === PREVALENCE_PATTERN_VERSION
    && row.analyzer_version === facts.analyzerVersion
    && row.metric_version === facts.metricVersion
    && row.segment_taxonomy_version === facts.segmentVersion
    && row.aggregation_method_version === facts.aggregationVersion
    && row.privacy_policy_version === facts.privacyPolicyVersion
    && row.anonymous_segment === platformSegment(facts.platform)
    && facts.findingCodes.includes(String(row.finding_code))
    && row.evidence_class === 'observed_association'
    && Number.isInteger(sample) && Number.isInteger(diversity)
    && sample === diversity && diversity >= PREVALENCE_MINIMUM_TENANTS
    && Number(row.sample_count) === sample
    && Number(row.distinct_tenant_count) === diversity
    && row.validation_measurement_quality === row.measurement_quality
    && (row.measurement_quality === 'high' || row.measurement_quality === 'mixed')
    && confidence?.sampleGate === 'pass'
    && confidence?.contributionBound === 'pass'
    && confidence?.dataCompleteness === 'bounded_complete'
    && freshness?.policy === 'provisional_not_approved'
    && freshness?.status === 'provisional_validated_no_activation'
    && row.validation_window === row.observation_window
    && isFresh(String(row.observation_window), now)
    && passesAllValidationGates(row);
}

function sampleBand(count: number): CompactPatternEvidence['tenantSampleBand'] {
  if (count >= 100) return '100+';
  if (count >= 50) return '50-99';
  return '20-49';
}

const EVIDENCE_KEYS = new Set([
  'patternCode', 'findingCode', 'segmentCompatibility', 'tenantSampleBand',
  'evidenceClass', 'measurementQuality', 'freshness', 'patternVersion', 'applicability',
]);

export function assertCompactEvidence(value: unknown): asserts value is CompactPatternEvidence {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('evidence must be an object');
  for (const key of Object.keys(value)) {
    if (!EVIDENCE_KEYS.has(key)) throw new Error(`evidence field is not allowed: ${key}`);
  }
  const forbidden = new Set(SHARED_PATTERN_FORBIDDEN_FIELDS.map((field) => field.toLowerCase()));
  const visit = (input: unknown): void => {
    if (Array.isArray(input)) return input.forEach(visit);
    if (!input || typeof input !== 'object') return;
    for (const [key, nested] of Object.entries(input)) {
      if (forbidden.has(key.toLowerCase()) || key.toLowerCase() === 'url') {
        throw new Error(`forbidden evidence field: ${key}`);
      }
      visit(nested);
    }
  };
  visit(value);
}

function compactEvidence(row: RetrievalRow): CompactPatternEvidence {
  const evidence: CompactPatternEvidence = {
    patternCode: String(row.pattern_id),
    findingCode: String(row.finding_code),
    segmentCompatibility: 'exact_platform',
    tenantSampleBand: sampleBand(Number(row.tenant_diversity)),
    evidenceClass: 'observed_association',
    measurementQuality: String(row.measurement_quality) as CompactPatternEvidence['measurementQuality'],
    freshness: 'current_coarse_month',
    patternVersion: String(row.pattern_version),
    applicability: 'same_finding_same_platform',
  };
  assertCompactEvidence(evidence);
  return evidence;
}

export function createPatternActivationService(
  db: CrossStoreDb,
  enabled: boolean,
  policy: PatternValidationPolicy = DEFAULT_PATTERN_VALIDATION_POLICY,
) {
  return {
    activate: async (input: { patternId: string; actorRole: string }, now = new Date()) => {
      if (!enabled) throw new Error('cross-store pattern activation feature flag is disabled');
      if (input.actorRole !== 'super_admin') throw new Error('super_admin authorization is required');
      if (!/^sp_[a-f0-9]{32}$/.test(input.patternId)) throw new Error('patternId is invalid');
      const row = await db.prepare(ACTIVATION_SELECT)
        .get(
          policy.validationVersion, input.patternId, policy.patternVersion,
          policy.analyzerVersion, policy.metricVersion, policy.segmentVersion,
          policy.aggregationVersion, policy.privacyPolicyVersion,
        );
      if (!row) throw new Error('pattern is not eligible for activation');
      const facts: ServerDerivedCustomerFacts = {
        platform: String(row.anonymous_segment).replace('platform:', '') as CrossStorePlatform,
        findingCodes: [String(row.finding_code)], analyzerVersion: policy.analyzerVersion,
        dataContractVersion: policy.dataContractVersion, segmentVersion: policy.segmentVersion,
        metricVersion: policy.metricVersion, aggregationVersion: policy.aggregationVersion,
        privacyPolicyVersion: policy.privacyPolicyVersion,
      };
      if (!eligibleRow({ ...row, lifecycle_status: 'active' }, facts, now)) {
        throw new Error('pattern failed activation privacy, freshness, or version gates');
      }
      await db.prepare(`UPDATE cross_store_candidate_patterns SET lifecycle_status='active'
        WHERE pattern_id=? AND lifecycle_status='validated' AND suppression_reason IS NULL`).run(input.patternId);
      return { patternId: input.patternId, lifecycleStatus: 'active' as const };
    },
  };
}

export function createPatternRetrievalService(db: CrossStoreDb, mode: RetrievalMode) {
  return {
    retrieve: async (
      input: ServerDerivedCustomerFacts,
      options: { maxResults?: number; now?: Date } = {},
    ) => {
      assertExactCustomerFacts(input);
      const maxResults = options.maxResults ?? MAX_RETRIEVED_PATTERNS;
      if (!Number.isInteger(maxResults) || maxResults < 1 || maxResults > MAX_RETRIEVED_PATTERNS) {
        throw new Error('retrieval result limit is invalid');
      }
      if (mode === 'off' || input.findingCodes.length === 0) {
        return { customerEvidence: [] as CompactPatternEvidence[], shadowEvidence: [] as CompactPatternEvidence[], queryCount: 0, rowsTouched: 0 };
      }
      const findings = [...new Set(input.findingCodes)].sort();
      const sql = RETRIEVAL_SELECT.replace('__FINDINGS__', findings.map(() => '?').join(','));
      const rows = await db.prepare(sql).all(
        PATTERN_VALIDATION_VERSION, platformSegment(input.platform), ...findings,
        PREVALENCE_PATTERN_VERSION, input.analyzerVersion, input.metricVersion,
        input.segmentVersion, input.aggregationVersion, input.privacyPolicyVersion,
        MAX_RETRIEVAL_CANDIDATES,
      );
      const now = options.now ?? new Date();
      const uniqueFindings = new Set<string>();
      const shadowEvidence: CompactPatternEvidence[] = [];
      for (const row of rows) {
        if (!eligibleRow(row, input, now)) continue;
        const findingCode = String(row.finding_code);
        if (uniqueFindings.has(findingCode)) continue;
        uniqueFindings.add(findingCode);
        shadowEvidence.push(compactEvidence(row));
        if (shadowEvidence.length === maxResults) break;
      }
      return {
        customerEvidence: [] as CompactPatternEvidence[],
        shadowEvidence,
        queryCount: 1,
        rowsTouched: rows.length,
      };
    },
  };
}
