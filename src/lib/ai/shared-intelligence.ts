import {
  CROSS_STORE_AGGREGATION_VERSION,
  CROSS_STORE_DATA_CONTRACT_VERSION,
  CROSS_STORE_METRIC_VERSION,
  CROSS_STORE_PRIVACY_POLICY_VERSION,
  CROSS_STORE_SEGMENT_VERSION,
  isApprovedFindingCode,
  type CrossStoreDb,
} from '@/lib/cross-store/aggregation';
import {
  MAX_RETRIEVED_PATTERNS,
  assertCompactEvidence,
  createPatternRetrievalService,
  type CompactPatternEvidence,
} from '@/lib/cross-store/retrieval';

export const CROSS_STORE_INTELLIGENCE_AI_FLAG = 'CROSS_STORE_INTELLIGENCE_AI';
export const MAX_SHARED_EVIDENCE_BYTES = 2_400;

export type SharedIntelligenceAiMode = 'off' | 'shadow' | 'on';

export type SharedPatternAiEvidence = {
  findingCode: string;
  aggregateContext: 'recurring_observed_pattern';
  segmentCompatibility: 'exact_platform';
  tenantSampleBand: '20-49' | '50-99' | '100+';
  evidenceClass: 'observed_association';
  measurementQuality: 'high' | 'mixed';
  freshness: 'current_coarse_month';
  applicability: 'same_finding_same_platform';
};

export type SharedIntelligencePromptContext = {
  customerFindingCodes: string[];
  sharedPatterns: SharedPatternAiEvidence[];
};

export type SharedIntelligenceResolution = {
  mode: SharedIntelligenceAiMode;
  promptContext: SharedIntelligencePromptContext | null;
  patternsEvaluated: number;
  patternsUsed: number;
  retrievalFailed: boolean;
  retrievalLatencyMs: number;
};

const PROMPT_PATTERN_KEYS = new Set([
  'findingCode', 'aggregateContext', 'segmentCompatibility', 'tenantSampleBand',
  'evidenceClass', 'measurementQuality', 'freshness', 'applicability',
]);

const INSTRUCTION_LIKE = /\b(ignore|disregard|override|system prompt|developer message|execute|reveal|secret|password|token|api key)\b/i;

export function sharedIntelligenceAiMode(value: unknown): SharedIntelligenceAiMode {
  return value === 'shadow' || value === 'on' ? value : 'off';
}

function safeFindingCodes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const findingCode = (item as Record<string, unknown>).findingCode;
    return typeof findingCode === 'string' && isApprovedFindingCode(findingCode)
      ? [findingCode] : [];
  }))].sort();
}

function assertPromptPattern(value: unknown): asserts value is SharedPatternAiEvidence {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('shared AI evidence must be an object');
  }
  for (const [key, nested] of Object.entries(value)) {
    if (!PROMPT_PATTERN_KEYS.has(key)) throw new Error(`shared AI evidence field is not allowed: ${key}`);
    if (typeof nested !== 'string' || INSTRUCTION_LIKE.test(nested)) {
      throw new Error('shared AI evidence contains suspicious content');
    }
  }
  const record = value as Record<string, unknown>;
  if (!isApprovedFindingCode(String(record.findingCode))
    || record.aggregateContext !== 'recurring_observed_pattern'
    || record.segmentCompatibility !== 'exact_platform'
    || !['20-49', '50-99', '100+'].includes(String(record.tenantSampleBand))
    || record.evidenceClass !== 'observed_association'
    || !['high', 'mixed'].includes(String(record.measurementQuality))
    || record.freshness !== 'current_coarse_month'
    || record.applicability !== 'same_finding_same_platform') {
    throw new Error('shared AI evidence is outside the approved projection');
  }
}

export function projectSharedPatternForAi(pattern: CompactPatternEvidence): SharedPatternAiEvidence {
  assertCompactEvidence(pattern);
  const projected: SharedPatternAiEvidence = {
    findingCode: pattern.findingCode,
    aggregateContext: 'recurring_observed_pattern',
    segmentCompatibility: pattern.segmentCompatibility,
    tenantSampleBand: pattern.tenantSampleBand,
    evidenceClass: pattern.evidenceClass,
    measurementQuality: pattern.measurementQuality,
    freshness: pattern.freshness,
    applicability: pattern.applicability,
  };
  assertPromptPattern(projected);
  return projected;
}

export function assertSharedIntelligencePromptContext(
  value: SharedIntelligencePromptContext,
): void {
  if (!Array.isArray(value.customerFindingCodes)
    || value.customerFindingCodes.some((code) => !isApprovedFindingCode(code))) {
    throw new Error('customer finding context is invalid');
  }
  if (!Array.isArray(value.sharedPatterns)
    || value.sharedPatterns.length < 1
    || value.sharedPatterns.length > MAX_RETRIEVED_PATTERNS) {
    throw new Error('shared AI evidence count is invalid');
  }
  value.sharedPatterns.forEach(assertPromptPattern);
  if (value.sharedPatterns.some((pattern) => !value.customerFindingCodes.includes(pattern.findingCode))) {
    throw new Error('shared AI evidence does not match a customer finding');
  }
  if (new TextEncoder().encode(JSON.stringify(value.sharedPatterns)).byteLength > MAX_SHARED_EVIDENCE_BYTES) {
    throw new Error('shared AI evidence exceeds its compact context budget');
  }
}

function emptyResolution(mode: SharedIntelligenceAiMode): SharedIntelligenceResolution {
  return {
    mode, promptContext: null, patternsEvaluated: 0, patternsUsed: 0,
    retrievalFailed: false, retrievalLatencyMs: 0,
  };
}

export async function resolveSharedIntelligenceForAi(input: {
  db: CrossStoreDb;
  userId: string;
  mode: SharedIntelligenceAiMode;
  now?: Date;
}): Promise<SharedIntelligenceResolution> {
  if (input.mode === 'off') return emptyResolution('off');
  const startedAt = performance.now();
  try {
    const row = await input.db.prepare(`SELECT findings_json, analyzer_version
      FROM landing_page_analyses
      WHERE user_id=? AND status='succeeded'
        AND analyzer_version='landing_page_analyzer_v1'
      ORDER BY analyzed_at DESC
      LIMIT 1`).get(input.userId);
    if (!row) return { ...emptyResolution(input.mode), retrievalLatencyMs: performance.now() - startedAt };
    let findings: unknown;
    try {
      findings = JSON.parse(String(row.findings_json));
    } catch {
      throw new Error('stored customer findings are invalid');
    }
    const findingCodes = safeFindingCodes(findings);
    if (!findingCodes.length) {
      return { ...emptyResolution(input.mode), retrievalLatencyMs: performance.now() - startedAt };
    }
    const result = await createPatternRetrievalService(input.db, 'shadow').retrieve({
      platform: 'salla', findingCodes,
      analyzerVersion: String(row.analyzer_version),
      dataContractVersion: CROSS_STORE_DATA_CONTRACT_VERSION,
      segmentVersion: CROSS_STORE_SEGMENT_VERSION,
      metricVersion: CROSS_STORE_METRIC_VERSION,
      aggregationVersion: CROSS_STORE_AGGREGATION_VERSION,
      privacyPolicyVersion: CROSS_STORE_PRIVACY_POLICY_VERSION,
    }, { now: input.now });
    const projected = result.shadowEvidence.map(projectSharedPatternForAi);
    const resolution: SharedIntelligenceResolution = {
      mode: input.mode,
      promptContext: null,
      patternsEvaluated: projected.length,
      patternsUsed: input.mode === 'on' ? projected.length : 0,
      retrievalFailed: false,
      retrievalLatencyMs: performance.now() - startedAt,
    };
    if (input.mode === 'on' && projected.length) {
      const promptContext = { customerFindingCodes: findingCodes, sharedPatterns: projected };
      assertSharedIntelligencePromptContext(promptContext);
      resolution.promptContext = promptContext;
    }
    return resolution;
  } catch {
    return {
      ...emptyResolution(input.mode), retrievalFailed: true,
      retrievalLatencyMs: performance.now() - startedAt,
    };
  }
}
