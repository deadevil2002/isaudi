-- Production-safe Phase 7 migration reconciled from the validated staging schema.
-- Apply only through the guarded iSaudi production release mechanism after legal approval.

CREATE TABLE cross_store_candidate_patterns (
  pattern_id TEXT PRIMARY KEY,
  pattern_version TEXT NOT NULL,
  analyzer_version TEXT NOT NULL,
  metric_version TEXT NOT NULL,
  segment_taxonomy_version TEXT NOT NULL,
  aggregation_method_version TEXT NOT NULL,
  privacy_policy_version TEXT NOT NULL,
  finding_code TEXT NOT NULL,
  anonymous_segment TEXT NOT NULL CHECK (anonymous_segment IN ('platform:salla', 'platform:csv')),
  evidence_class TEXT NOT NULL CHECK (evidence_class = 'observed_association'),
  direction TEXT NOT NULL CHECK (direction = 'observed'),
  effect_band TEXT NOT NULL CHECK (effect_band = 'not_applicable_prevalence'),
  sample_size INTEGER NOT NULL CHECK (sample_size >= 0),
  tenant_diversity INTEGER NOT NULL CHECK (tenant_diversity >= 0),
  confidence_components_json TEXT NOT NULL CHECK (json_valid(confidence_components_json)),
  freshness_json TEXT NOT NULL CHECK (json_valid(freshness_json)),
  measurement_quality TEXT NOT NULL CHECK (measurement_quality IN ('high', 'mixed', 'low')),
  lifecycle_status TEXT NOT NULL CHECK (lifecycle_status IN ('candidate', 'suppressed')),
  suppression_reason TEXT CHECK (suppression_reason IN (
    'small_sample', 'low_measurement_quality', 'invalid_aggregate', 'privacy_risk'
  )),
  observation_window TEXT NOT NULL CHECK (observation_window GLOB 'month:[0-9][0-9][0-9][0-9]-[0-9][0-9]')
) WITHOUT ROWID;

CREATE INDEX idx_cross_store_patterns_status_version
  ON cross_store_candidate_patterns(lifecycle_status, pattern_version, observation_window);

CREATE INDEX idx_cross_store_patterns_finding_segment
  ON cross_store_candidate_patterns(finding_code, anonymous_segment, lifecycle_status);


