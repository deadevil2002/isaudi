-- Production-safe Phase 7 migration reconciled from the validated staging schema.
-- Apply only through the guarded iSaudi production release mechanism after legal approval.

CREATE TABLE cross_store_private_contributions (
  tenant_id TEXT NOT NULL,
  observation_window_kind TEXT NOT NULL CHECK (observation_window_kind = 'month'),
  observation_window_start INTEGER NOT NULL,
  segment_key TEXT NOT NULL CHECK (segment_key IN ('platform:salla', 'platform:csv')),
  finding_code TEXT NOT NULL CHECK (finding_code IN (
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
    'landing.trust.signals_absent.v1'
  )),
  metric_code TEXT NOT NULL CHECK (metric_code = 'finding_prevalence'),
  value_band TEXT NOT NULL CHECK (value_band = 'present'),
  measurement_quality TEXT NOT NULL CHECK (measurement_quality IN ('high', 'medium', 'low')),
  analyzer_version TEXT NOT NULL CHECK (analyzer_version = 'landing_page_analyzer_v1'),
  data_contract_version TEXT NOT NULL,
  segment_version TEXT NOT NULL,
  metric_version TEXT NOT NULL,
  aggregation_version TEXT NOT NULL,
  privacy_policy_version TEXT NOT NULL,
  PRIMARY KEY (
    tenant_id, observation_window_kind, observation_window_start,
    segment_key, finding_code, metric_code, analyzer_version,
    data_contract_version, segment_version, metric_version,
    aggregation_version, privacy_policy_version
  ),
  FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE RESTRICT
) WITHOUT ROWID;

CREATE INDEX idx_cross_store_private_tenant_window
  ON cross_store_private_contributions(tenant_id, observation_window_start);

CREATE INDEX idx_cross_store_private_recompute
  ON cross_store_private_contributions(
    observation_window_kind, observation_window_start,
    data_contract_version, segment_version, metric_version,
    aggregation_version, privacy_policy_version,
    segment_key, finding_code, metric_code
  );

CREATE TABLE cross_store_aggregate_cells (
  observation_window_kind TEXT NOT NULL CHECK (observation_window_kind = 'month'),
  observation_window_start INTEGER NOT NULL,
  segment_key TEXT NOT NULL CHECK (segment_key IN ('platform:salla', 'platform:csv')),
  finding_code TEXT NOT NULL CHECK (finding_code IN (
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
    'landing.trust.signals_absent.v1'
  )),
  metric_code TEXT NOT NULL CHECK (metric_code = 'finding_prevalence'),
  value_band TEXT NOT NULL CHECK (value_band = 'present'),
  analyzer_version TEXT NOT NULL CHECK (analyzer_version = 'landing_page_analyzer_v1'),
  data_contract_version TEXT NOT NULL,
  segment_version TEXT NOT NULL,
  metric_version TEXT NOT NULL,
  aggregation_version TEXT NOT NULL,
  privacy_policy_version TEXT NOT NULL,
  tenant_count INTEGER NOT NULL CHECK (tenant_count >= 0),
  observation_count INTEGER NOT NULL CHECK (observation_count >= 0),
  measurement_quality TEXT NOT NULL CHECK (measurement_quality IN ('high', 'mixed', 'low')),
  validation_status TEXT NOT NULL
    CHECK (validation_status IN ('suppressed', 'eligible_for_validation')),
  suppression_reason TEXT CHECK (suppression_reason IS NULL OR suppression_reason = 'small_sample'),
  PRIMARY KEY (
    observation_window_kind, observation_window_start,
    segment_key, finding_code, metric_code, analyzer_version,
    data_contract_version, segment_version, metric_version,
    aggregation_version, privacy_policy_version
  )
) WITHOUT ROWID;

CREATE INDEX idx_cross_store_cells_validation
  ON cross_store_aggregate_cells(
    validation_status, observation_window_start DESC,
    finding_code, segment_key, metric_code
  );


