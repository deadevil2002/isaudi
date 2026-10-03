-- Phase 7G staging-only outcome feedback foundation. Never apply to production.
-- Exact tenant values remain private; aggregate and pattern layers contain only
-- coarse deterministic bands and no source tenant/store identifiers.

CREATE TABLE cross_store_private_interventions (
  intervention_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  store_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('salla', 'csv')),
  finding_code TEXT NOT NULL,
  analysis_id TEXT NOT NULL,
  intervention_code TEXT NOT NULL CHECK (intervention_code IN (
    'landing.cta.added',
    'landing.trust_signals.added',
    'landing.seo.title_added',
    'landing.mobile.viewport_added'
  )),
  scope TEXT NOT NULL CHECK (scope = 'storefront'),
  source TEXT NOT NULL CHECK (source IN (
    'verified_application_event',
    'verified_partner_event',
    'manual_admin_verification'
  )),
  source_event_id TEXT NOT NULL,
  occurred_at INTEGER NOT NULL,
  verification_status TEXT NOT NULL CHECK (verification_status IN ('verified', 'rejected')),
  intervention_version TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (tenant_id, source, source_event_id, intervention_version)
);

CREATE INDEX idx_outcome_interventions_tenant_time
  ON cross_store_private_interventions(tenant_id, occurred_at DESC);
CREATE INDEX idx_outcome_interventions_lookup
  ON cross_store_private_interventions(
    finding_code, intervention_code, platform, verification_status, occurred_at
  );

CREATE TABLE cross_store_private_outcome_observations (
  outcome_id TEXT PRIMARY KEY,
  intervention_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  metric_code TEXT NOT NULL CHECK (metric_code IN (
    'revenue', 'orders', 'aov', 'profit', 'margin', 'conversion_rate'
  )),
  metric_version TEXT NOT NULL,
  baseline_window_start INTEGER NOT NULL,
  baseline_window_end INTEGER NOT NULL,
  baseline_value REAL NOT NULL,
  washout_seconds INTEGER NOT NULL CHECK (washout_seconds > 0),
  washout_policy_version TEXT NOT NULL,
  observation_window_start INTEGER NOT NULL,
  observation_window_end INTEGER NOT NULL,
  observation_policy_version TEXT NOT NULL,
  observed_value REAL NOT NULL,
  denominator_status TEXT NOT NULL CHECK (denominator_status IN (
    'not_required', 'available', 'unavailable'
  )),
  data_completeness TEXT NOT NULL CHECK (data_completeness IN (
    'complete', 'partial', 'insufficient'
  )),
  confounders_json TEXT NOT NULL CHECK (json_valid(confounders_json)),
  confounder_quality TEXT NOT NULL CHECK (confounder_quality IN (
    'clear', 'minor', 'major', 'unknown'
  )),
  measurement_quality TEXT NOT NULL CHECK (measurement_quality IN (
    'high', 'mixed', 'low', 'insufficient'
  )),
  overlap_status TEXT NOT NULL CHECK (overlap_status IN ('clear', 'confounded')),
  effect_band TEXT CHECK (effect_band IN (
    'negative', 'stable', 'small_positive', 'moderate_positive', 'large_positive'
  )),
  eligibility_status TEXT NOT NULL CHECK (eligibility_status IN (
    'eligible', 'insufficient_evidence'
  )),
  suppression_reason TEXT CHECK (suppression_reason IN (
    'intervention_unverified', 'baseline_invalid', 'window_invalid',
    'incomplete_measurement', 'major_confounders', 'overlapping_interventions',
    'conversion_not_ready', 'incompatible_version', 'contract_violation'
  )),
  evidence_class TEXT NOT NULL CHECK (evidence_class = 'observed_association'),
  source_event_id TEXT NOT NULL,
  outcome_version TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (tenant_id, intervention_id, metric_code, source_event_id, outcome_version),
  FOREIGN KEY (intervention_id) REFERENCES cross_store_private_interventions(intervention_id)
    ON DELETE CASCADE
);

CREATE INDEX idx_outcome_observations_tenant_window
  ON cross_store_private_outcome_observations(tenant_id, observation_window_end DESC);
CREATE INDEX idx_outcome_observations_intervention
  ON cross_store_private_outcome_observations(intervention_id, metric_code, metric_version);
CREATE INDEX idx_outcome_observations_aggregation
  ON cross_store_private_outcome_observations(
    metric_code, metric_version, effect_band, eligibility_status, observation_window_end
  );

CREATE TABLE cross_store_outcome_aggregate_cells (
  observation_window TEXT NOT NULL,
  anonymous_segment TEXT NOT NULL CHECK (anonymous_segment IN ('platform:salla', 'platform:csv')),
  finding_code TEXT NOT NULL,
  intervention_code TEXT NOT NULL,
  outcome_metric_code TEXT NOT NULL,
  effect_band TEXT NOT NULL CHECK (effect_band IN (
    'negative', 'stable', 'small_positive', 'moderate_positive', 'large_positive'
  )),
  data_contract_version TEXT NOT NULL,
  outcome_contract_version TEXT NOT NULL,
  metric_version TEXT NOT NULL,
  intervention_version TEXT NOT NULL,
  aggregation_version TEXT NOT NULL,
  privacy_policy_version TEXT NOT NULL,
  tenant_count INTEGER NOT NULL CHECK (tenant_count >= 0),
  observation_count INTEGER NOT NULL CHECK (observation_count >= 0),
  measurement_quality TEXT NOT NULL CHECK (measurement_quality IN ('high', 'mixed', 'low')),
  data_completeness TEXT NOT NULL CHECK (data_completeness IN ('complete', 'insufficient')),
  confounder_quality TEXT NOT NULL CHECK (confounder_quality IN ('clear', 'minor', 'major', 'unknown')),
  dominance_status TEXT NOT NULL CHECK (dominance_status IN ('pass', 'fail')),
  validation_status TEXT NOT NULL CHECK (validation_status IN (
    'suppressed', 'eligible_for_validation'
  )),
  suppression_reason TEXT CHECK (suppression_reason IN (
    'small_sample', 'incomplete_measurement', 'major_confounders',
    'overlapping_interventions', 'conversion_not_ready', 'incompatible_version',
    'privacy_risk', 'contract_violation'
  )),
  PRIMARY KEY (
    observation_window, anonymous_segment, finding_code, intervention_code,
    outcome_metric_code, effect_band, data_contract_version,
    outcome_contract_version, metric_version, intervention_version,
    aggregation_version, privacy_policy_version
  )
) WITHOUT ROWID;

CREATE INDEX idx_outcome_cells_validation
  ON cross_store_outcome_aggregate_cells(
    validation_status, observation_window DESC, finding_code,
    intervention_code, outcome_metric_code
  );

CREATE TABLE cross_store_outcome_patterns (
  pattern_id TEXT PRIMARY KEY,
  pattern_version TEXT NOT NULL,
  data_contract_version TEXT NOT NULL,
  outcome_contract_version TEXT NOT NULL,
  metric_version TEXT NOT NULL,
  intervention_version TEXT NOT NULL,
  aggregation_version TEXT NOT NULL,
  privacy_policy_version TEXT NOT NULL,
  finding_code TEXT NOT NULL,
  intervention_code TEXT NOT NULL,
  outcome_metric_code TEXT NOT NULL,
  anonymous_segment TEXT NOT NULL CHECK (anonymous_segment IN ('platform:salla', 'platform:csv')),
  effect_band TEXT NOT NULL,
  evidence_class TEXT NOT NULL CHECK (evidence_class = 'observed_association'),
  sample_size INTEGER NOT NULL CHECK (sample_size >= 0),
  tenant_diversity INTEGER NOT NULL CHECK (tenant_diversity >= 0),
  measurement_quality TEXT NOT NULL CHECK (measurement_quality IN ('high', 'mixed', 'low')),
  data_completeness TEXT NOT NULL CHECK (data_completeness IN ('complete', 'insufficient')),
  confounder_quality TEXT NOT NULL CHECK (confounder_quality IN ('clear', 'minor', 'major', 'unknown')),
  lifecycle_status TEXT NOT NULL CHECK (lifecycle_status IN (
    'candidate', 'validated', 'suppressed', 'stale', 'retired'
  )),
  suppression_reason TEXT,
  observation_window TEXT NOT NULL
) WITHOUT ROWID;

CREATE INDEX idx_outcome_patterns_status
  ON cross_store_outcome_patterns(lifecycle_status, observation_window DESC);
CREATE INDEX idx_outcome_patterns_match
  ON cross_store_outcome_patterns(
    finding_code, intervention_code, outcome_metric_code, anonymous_segment
  );

CREATE TABLE cross_store_outcome_pattern_validation_results (
  pattern_id TEXT NOT NULL,
  validation_version TEXT NOT NULL,
  validation_status TEXT NOT NULL CHECK (validation_status IN ('validated', 'suppressed')),
  passed_gates_json TEXT NOT NULL CHECK (json_valid(passed_gates_json)),
  failed_gates_json TEXT NOT NULL CHECK (json_valid(failed_gates_json)),
  sample_count INTEGER NOT NULL CHECK (sample_count >= 0),
  distinct_tenant_count INTEGER NOT NULL CHECK (distinct_tenant_count >= 0),
  evidence_class TEXT NOT NULL CHECK (evidence_class = 'observed_association'),
  suppression_reason TEXT,
  observation_window TEXT NOT NULL,
  PRIMARY KEY (pattern_id, validation_version),
  FOREIGN KEY (pattern_id) REFERENCES cross_store_outcome_patterns(pattern_id)
    ON DELETE CASCADE
) WITHOUT ROWID;

CREATE INDEX idx_outcome_validation_status
  ON cross_store_outcome_pattern_validation_results(
    validation_status, validation_version, observation_window
  );
