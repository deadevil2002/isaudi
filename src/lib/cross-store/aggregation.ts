export const CROSS_STORE_DATA_CONTRACT_VERSION = 'cross_store_data_contract_v1';
export const CROSS_STORE_PRIVACY_POLICY_VERSION = 'cross_store_privacy_v1_provisional';
export const CROSS_STORE_SEGMENT_VERSION = 'cross_store_segment_platform_v1_staging';
export const CROSS_STORE_METRIC_VERSION = 'finding_prevalence_v1_staging';
export const CROSS_STORE_AGGREGATION_VERSION = 'bounded_monthly_v1_staging';
export const CROSS_STORE_AGGREGATION_FLAG = 'CROSS_STORE_AGGREGATION_ENABLED';

export const PREVALENCE_MINIMUM_TENANTS = 20;
export const OUTCOME_MINIMUM_TENANTS = 30;
export const MAX_CONTRIBUTIONS_PER_TENANT_WINDOW = 100;
export const MAX_WINDOWS_PER_DELETION = 100;

export type CrossStorePlatform = 'salla' | 'csv';
export type FindingQuality = 'high' | 'medium' | 'low';
export type SampleKind = 'prevalence' | 'outcome';

export type FindingContribution = {
  tenantId: string;
  observationWindowKind: 'month';
  observationWindowStart: number;
  segmentKey: `platform:${CrossStorePlatform}`;
  findingCode: string;
  metricCode: 'finding_prevalence';
  valueBand: 'present';
  measurementQuality: FindingQuality;
  analyzerVersion: string;
  dataContractVersion: typeof CROSS_STORE_DATA_CONTRACT_VERSION;
  segmentVersion: typeof CROSS_STORE_SEGMENT_VERSION;
  metricVersion: typeof CROSS_STORE_METRIC_VERSION;
  aggregationVersion: typeof CROSS_STORE_AGGREGATION_VERSION;
  privacyPolicyVersion: typeof CROSS_STORE_PRIVACY_POLICY_VERSION;
};

export type AggregateCell = Omit<FindingContribution, 'tenantId' | 'measurementQuality'> & {
  tenantCount: number;
  observationCount: number;
  measurementQuality: 'high' | 'mixed' | 'low';
  validationStatus: 'suppressed' | 'eligible_for_validation';
  suppressionReason: 'small_sample' | null;
};

export type CrossStoreDb = {
  prepare(sql: string): {
    get(...params: unknown[]): Promise<Record<string, unknown> | undefined>;
    all(...params: unknown[]): Promise<Record<string, unknown>[]>;
    run(...params: unknown[]): Promise<unknown>;
  };
  batch(operations: Array<{ sql: string; params?: unknown[] }>): Promise<unknown>;
};

type WindowScope = Pick<FindingContribution,
  | 'observationWindowKind'
  | 'observationWindowStart'
  | 'dataContractVersion'
  | 'segmentVersion'
  | 'metricVersion'
  | 'aggregationVersion'
  | 'privacyPolicyVersion'
>;

const MONTH_MS = 31 * 24 * 60 * 60 * 1000;
const LANDING_ANALYZER_VERSION = 'landing_page_analyzer_v1';
const APPROVED_FINDING_CODES = new Set([
  'landing.accessibility.form_labels_missing.v1',
  'landing.accessibility.image_alt_missing.v1',
  'landing.cta.competing_actions.v1',
  'landing.cta.missing.v1',
  'landing.cta.weak_text.v1',
  'landing.heading.h1_missing.v1',
  'landing.heading.multiple_h1.v1',
  'landing.image.obvious_broken_source.v1',
  'landing.mobile.fixed_width_risk.v1',
  'landing.mobile.viewport_missing.v1',
  'landing.seo.description_missing.v1',
  'landing.seo.noindex.v1',
  'landing.seo.title_missing.v1',
  'landing.trust.signals_absent.v1',
]);

export function isApprovedFindingCode(value: string): boolean {
  return APPROVED_FINDING_CODES.has(value);
}

export function isApprovedSegmentKey(value: string): value is `platform:${CrossStorePlatform}` {
  return value === 'platform:salla' || value === 'platform:csv';
}

function assertNonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

export function isCrossStoreAggregationEnabled(env: Record<string, unknown>): boolean {
  return env[CROSS_STORE_AGGREGATION_FLAG] === 'true';
}

export function monthWindowStart(timestamp: number): number {
  if (!Number.isFinite(timestamp) || timestamp < 0) throw new Error('analyzedAt must be a valid timestamp');
  const date = new Date(timestamp);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
}

export function platformSegment(platform: string): `platform:${CrossStorePlatform}` {
  if (platform !== 'salla' && platform !== 'csv') {
    throw new Error('platform is not in the approved segment allowlist');
  }
  return `platform:${platform}`;
}

export function orderVolumeBand(count: number): string {
  if (!Number.isFinite(count) || count < 0) throw new Error('order count must be non-negative');
  if (count === 0) return 'orders:0';
  if (count < 10) return 'orders:1-9';
  if (count < 50) return 'orders:10-49';
  if (count < 200) return 'orders:50-199';
  if (count < 1000) return 'orders:200-999';
  return 'orders:1000+';
}

export function productCountBand(count: number): string {
  if (!Number.isFinite(count) || count < 0) throw new Error('product count must be non-negative');
  if (count === 0) return 'products:0';
  if (count < 10) return 'products:1-9';
  if (count < 50) return 'products:10-49';
  if (count < 200) return 'products:50-199';
  return 'products:200+';
}

export function revenueBand(grossSalesHalala: number): string {
  if (!Number.isFinite(grossSalesHalala) || grossSalesHalala < 0) {
    throw new Error('revenue must be non-negative');
  }
  if (grossSalesHalala === 0) return 'revenue_sar:0';
  if (grossSalesHalala < 100_000) return 'revenue_sar:1-999';
  if (grossSalesHalala < 1_000_000) return 'revenue_sar:1000-9999';
  if (grossSalesHalala < 5_000_000) return 'revenue_sar:10000-49999';
  if (grossSalesHalala < 25_000_000) return 'revenue_sar:50000-249999';
  return 'revenue_sar:250000+';
}

export function aovBand(aovHalala: number): string {
  if (!Number.isFinite(aovHalala) || aovHalala < 0) throw new Error('AOV must be non-negative');
  if (aovHalala === 0) return 'aov_sar:0';
  if (aovHalala < 5_000) return 'aov_sar:1-49';
  if (aovHalala < 10_000) return 'aov_sar:50-99';
  if (aovHalala < 25_000) return 'aov_sar:100-249';
  if (aovHalala < 50_000) return 'aov_sar:250-499';
  return 'aov_sar:500+';
}

export function marginBand(marginPctX100: number): string {
  if (!Number.isFinite(marginPctX100)) throw new Error('margin must be finite');
  if (marginPctX100 < 0) return 'margin:negative';
  if (marginPctX100 < 1_000) return 'margin:0-9';
  if (marginPctX100 < 2_500) return 'margin:10-24';
  if (marginPctX100 < 4_000) return 'margin:25-39';
  return 'margin:40+';
}

export function evaluateSampleGate(kind: SampleKind, distinctTenants: number) {
  if (!Number.isInteger(distinctTenants) || distinctTenants < 0) {
    throw new Error('distinct tenant count must be a non-negative integer');
  }
  const minimum = kind === 'prevalence'
    ? PREVALENCE_MINIMUM_TENANTS
    : OUTCOME_MINIMUM_TENANTS;
  return {
    minimum,
    provisional: true as const,
    status: distinctTenants >= minimum
      ? 'eligible_for_validation' as const
      : 'suppressed' as const,
    suppressionReason: distinctTenants >= minimum ? null : 'small_sample' as const,
  };
}

export function findingWindowScope(analyzedAt: number): WindowScope {
  return {
    observationWindowKind: 'month',
    observationWindowStart: monthWindowStart(analyzedAt),
    dataContractVersion: CROSS_STORE_DATA_CONTRACT_VERSION,
    segmentVersion: CROSS_STORE_SEGMENT_VERSION,
    metricVersion: CROSS_STORE_METRIC_VERSION,
    aggregationVersion: CROSS_STORE_AGGREGATION_VERSION,
    privacyPolicyVersion: CROSS_STORE_PRIVACY_POLICY_VERSION,
  };
}

export function deriveFindingContributions(input: {
  tenantId: string;
  platform: CrossStorePlatform;
  analyzedAt: number;
  analyzerVersion: string;
  findings: Array<{ findingCode: string; confidence: FindingQuality }>;
}): FindingContribution[] {
  const tenantId = assertNonEmpty(input.tenantId, 'tenantId');
  const analyzerVersion = assertNonEmpty(input.analyzerVersion, 'analyzerVersion');
  if (analyzerVersion !== LANDING_ANALYZER_VERSION) {
    throw new Error('analyzerVersion is not approved for this aggregation version');
  }
  const unique = new Map<string, FindingQuality>();
  for (const finding of input.findings) {
    if (!APPROVED_FINDING_CODES.has(finding.findingCode)) {
      throw new Error('findingCode is not in the approved analyzer allowlist');
    }
    const previous = unique.get(finding.findingCode);
    if (!previous || qualityRank(finding.confidence) > qualityRank(previous)) {
      unique.set(finding.findingCode, finding.confidence);
    }
  }
  if (unique.size > MAX_CONTRIBUTIONS_PER_TENANT_WINDOW) {
    throw new Error('tenant contribution batch exceeds the bounded maximum');
  }
  const scope = findingWindowScope(input.analyzedAt);
  return [...unique.entries()].sort(([left], [right]) => left.localeCompare(right)).map(
    ([findingCode, measurementQuality]) => ({
      tenantId,
      observationWindowKind: 'month',
      observationWindowStart: scope.observationWindowStart,
      segmentKey: platformSegment(input.platform),
      findingCode,
      metricCode: 'finding_prevalence',
      valueBand: 'present',
      measurementQuality,
      analyzerVersion,
      dataContractVersion: scope.dataContractVersion,
      segmentVersion: scope.segmentVersion,
      metricVersion: scope.metricVersion,
      aggregationVersion: scope.aggregationVersion,
      privacyPolicyVersion: scope.privacyPolicyVersion,
    })
  );
}

function qualityRank(quality: FindingQuality): number {
  return quality === 'high' ? 3 : quality === 'medium' ? 2 : 1;
}

function scopeParams(scope: WindowScope): unknown[] {
  return [
    scope.observationWindowKind,
    scope.observationWindowStart,
    scope.dataContractVersion,
    scope.segmentVersion,
    scope.metricVersion,
    scope.aggregationVersion,
    scope.privacyPolicyVersion,
  ];
}

function windowScope(contribution: FindingContribution): WindowScope {
  return {
    observationWindowKind: contribution.observationWindowKind,
    observationWindowStart: contribution.observationWindowStart,
    dataContractVersion: contribution.dataContractVersion,
    segmentVersion: contribution.segmentVersion,
    metricVersion: contribution.metricVersion,
    aggregationVersion: contribution.aggregationVersion,
    privacyPolicyVersion: contribution.privacyPolicyVersion,
  };
}

const DELETE_CELLS_FOR_SCOPE = `DELETE FROM cross_store_aggregate_cells
  WHERE observation_window_kind=? AND observation_window_start=?
    AND data_contract_version=? AND segment_version=? AND metric_version=?
    AND aggregation_version=? AND privacy_policy_version=?`;

const REBUILD_CELLS_FOR_SCOPE = `INSERT INTO cross_store_aggregate_cells (
    observation_window_kind, observation_window_start, segment_key, finding_code,
    metric_code, value_band, analyzer_version, data_contract_version,
    segment_version, metric_version, aggregation_version, privacy_policy_version,
    tenant_count, observation_count, measurement_quality,
    validation_status, suppression_reason
  )
  SELECT observation_window_kind, observation_window_start, segment_key, finding_code,
    metric_code, MIN(value_band), analyzer_version, data_contract_version,
    segment_version, metric_version, aggregation_version, privacy_policy_version,
    COUNT(DISTINCT tenant_id), COUNT(*),
    CASE
      WHEN SUM(CASE WHEN measurement_quality <> 'high' THEN 1 ELSE 0 END) = 0 THEN 'high'
      WHEN SUM(CASE WHEN measurement_quality = 'low' THEN 1 ELSE 0 END) > 0 THEN 'low'
      ELSE 'mixed'
    END,
    CASE WHEN COUNT(DISTINCT tenant_id) >= 20
      THEN 'eligible_for_validation' ELSE 'suppressed' END,
    CASE WHEN COUNT(DISTINCT tenant_id) >= 20
      THEN NULL ELSE 'small_sample' END
  FROM cross_store_private_contributions
  WHERE observation_window_kind=? AND observation_window_start=?
    AND data_contract_version=? AND segment_version=? AND metric_version=?
    AND aggregation_version=? AND privacy_policy_version=?
  GROUP BY observation_window_kind, observation_window_start, segment_key,
    finding_code, metric_code, analyzer_version, data_contract_version,
    segment_version, metric_version, aggregation_version, privacy_policy_version`;

export function createCrossStoreAggregationService(db: CrossStoreDb, enabled: boolean) {
  function requireEnabled() {
    if (!enabled) throw new Error('cross-store aggregation feature flag is disabled');
  }

  async function recomputeScopes(scopes: WindowScope[]): Promise<void> {
    if (scopes.length > MAX_WINDOWS_PER_DELETION) {
      throw new Error('bounded recomputation window limit exceeded');
    }
    await db.batch(scopes.flatMap((scope) => {
      const params = scopeParams(scope);
      return [
        { sql: DELETE_CELLS_FOR_SCOPE, params },
        { sql: REBUILD_CELLS_FOR_SCOPE, params },
      ];
    }));
  }

  return {
    replaceTenantFindingContributions: async (input: {
      tenantId: string;
      scope: WindowScope;
      contributions: FindingContribution[];
    }) => {
      requireEnabled();
      const tenantId = assertNonEmpty(input.tenantId, 'tenantId');
      const { contributions, scope } = input;
      if (contributions.length > MAX_CONTRIBUTIONS_PER_TENANT_WINDOW) {
        throw new Error('tenant contribution batch exceeds the bounded maximum');
      }
      if (contributions.some((item) => item.tenantId !== tenantId
        || JSON.stringify(windowScope(item)) !== JSON.stringify(scope))) {
        throw new Error('a replacement batch must belong to one tenant and one versioned window');
      }
      const deleteParams = [tenantId, ...scopeParams(scope)];
      const operations = [{
        sql: `DELETE FROM cross_store_private_contributions
          WHERE tenant_id=? AND observation_window_kind=? AND observation_window_start=?
            AND data_contract_version=? AND segment_version=? AND metric_version=?
            AND aggregation_version=? AND privacy_policy_version=?`,
        params: deleteParams,
      }, ...contributions.map((item) => ({
        sql: `INSERT INTO cross_store_private_contributions (
          tenant_id, observation_window_kind, observation_window_start,
          segment_key, finding_code, metric_code, value_band, measurement_quality,
          analyzer_version, data_contract_version, segment_version, metric_version,
          aggregation_version, privacy_policy_version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          item.tenantId, item.observationWindowKind, item.observationWindowStart,
          item.segmentKey, item.findingCode, item.metricCode, item.valueBand,
          item.measurementQuality, item.analyzerVersion, item.dataContractVersion,
          item.segmentVersion, item.metricVersion, item.aggregationVersion,
          item.privacyPolicyVersion,
        ],
      })), ...[{
        sql: DELETE_CELLS_FOR_SCOPE,
        params: scopeParams(scope),
      }, {
        sql: REBUILD_CELLS_FOR_SCOPE,
        params: scopeParams(scope),
      }]];
      await db.batch(operations);
    },

    removeTenantContributions: async (tenantIdInput: string) => {
      requireEnabled();
      const tenantId = assertNonEmpty(tenantIdInput, 'tenantId');
      const rows = await db.prepare(`SELECT DISTINCT observation_window_kind,
          observation_window_start, data_contract_version, segment_version,
          metric_version, aggregation_version, privacy_policy_version
        FROM cross_store_private_contributions
        WHERE tenant_id=?
        LIMIT ?`).all(tenantId, MAX_WINDOWS_PER_DELETION + 1);
      if (rows.length > MAX_WINDOWS_PER_DELETION) {
        throw new Error('tenant deletion requires bounded continuation before account deletion');
      }
      const scopes = rows.map((row): WindowScope => ({
        observationWindowKind: 'month',
        observationWindowStart: Number(row.observation_window_start),
        dataContractVersion: String(row.data_contract_version) as WindowScope['dataContractVersion'],
        segmentVersion: String(row.segment_version) as WindowScope['segmentVersion'],
        metricVersion: String(row.metric_version) as WindowScope['metricVersion'],
        aggregationVersion: String(row.aggregation_version) as WindowScope['aggregationVersion'],
        privacyPolicyVersion: String(row.privacy_policy_version) as WindowScope['privacyPolicyVersion'],
      }));
      await db.batch([
        { sql: 'DELETE FROM cross_store_private_contributions WHERE tenant_id=?', params: [tenantId] },
        ...scopes.flatMap((scope) => {
          const params = scopeParams(scope);
          return [
            { sql: DELETE_CELLS_FOR_SCOPE, params },
            { sql: REBUILD_CELLS_FOR_SCOPE, params },
          ];
        }),
      ]);
    },

    recomputeWindow: async (scope: WindowScope) => {
      requireEnabled();
      await recomputeScopes([scope]);
    },

    readValidationCells: async (): Promise<AggregateCell[]> => {
      requireEnabled();
      const rows = await db.prepare(`SELECT observation_window_kind,
          observation_window_start, segment_key, finding_code, metric_code,
          value_band, analyzer_version, data_contract_version, segment_version,
          metric_version, aggregation_version, privacy_policy_version,
          tenant_count, observation_count, measurement_quality,
          validation_status, suppression_reason
        FROM cross_store_aggregate_cells
        ORDER BY observation_window_start DESC, finding_code, segment_key
        LIMIT 500`).all();
      return rows.map((row) => ({
        observationWindowKind: 'month',
        observationWindowStart: Number(row.observation_window_start),
        segmentKey: String(row.segment_key) as AggregateCell['segmentKey'],
        findingCode: String(row.finding_code),
        metricCode: 'finding_prevalence',
        valueBand: 'present',
        measurementQuality: String(row.measurement_quality) as AggregateCell['measurementQuality'],
        analyzerVersion: String(row.analyzer_version),
        dataContractVersion: String(row.data_contract_version) as AggregateCell['dataContractVersion'],
        segmentVersion: String(row.segment_version) as AggregateCell['segmentVersion'],
        metricVersion: String(row.metric_version) as AggregateCell['metricVersion'],
        aggregationVersion: String(row.aggregation_version) as AggregateCell['aggregationVersion'],
        privacyPolicyVersion: String(row.privacy_policy_version) as AggregateCell['privacyPolicyVersion'],
        tenantCount: Number(row.tenant_count),
        observationCount: Number(row.observation_count),
        validationStatus: String(row.validation_status) as AggregateCell['validationStatus'],
        suppressionReason: row.suppression_reason == null ? null : 'small_sample',
      }));
    },
  };
}

export function isCoarseMonthWindow(value: number): boolean {
  if (!Number.isInteger(value) || value < 0) return false;
  const date = new Date(value);
  return date.getUTCDate() === 1
    && date.getUTCHours() === 0
    && date.getUTCMinutes() === 0
    && date.getUTCSeconds() === 0
    && date.getUTCMilliseconds() === 0
    && Date.now() - value < 1200 * MONTH_MS;
}
