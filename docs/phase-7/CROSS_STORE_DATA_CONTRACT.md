# Phase 7A cross-store data contract

Status: **documentation and validation only**. This contract does not authorize aggregation, a D1 migration, customer-facing shared intelligence, or production processing.

Contract version: `cross_store_data_contract_v1`

Pattern schema version: `shared_pattern_v1`

Privacy policy version: `cross_store_privacy_v1_provisional`

The normative, test-readable inventory is [`cross-store-data-contract.v1.json`](./cross-store-data-contract.v1.json). Its `inventory` object enumerates every inspected field and maps it to a policy. Joining an inventory field to its policy supplies the required classification, allowed derivation, purpose, retention, deletion behavior, contribution bound, minimum tenants, diversity requirement, suppression rule, version, and notes.

## Boundary

Raw tenant data remains tenant-scoped. A future private computation layer may create bounded contributions, but it remains private and pseudonymous rather than anonymous. Only a pattern that passes deterministic aggregation, measurement-quality validation, privacy suppression, and lifecycle approval may enter the shared layer.

No shared output may contain a user, store, merchant, customer, report, analysis, referral, product, order, partner, administrator, session, token, stable tenant hash, URL, free text, raw JSON, exact timestamp, or exact financial/extreme value.

## Classification and derivation policies

| Policy | Classification | Shared-layer decision |
| --- | --- | --- |
| `forbidden_identity` | Sensitive / identifying | Never shared and never hashed into the shared layer. |
| `forbidden_secret` | Secret / credential | Never used for intelligence. |
| `forbidden_raw_business` | Raw tenant data | Never shared; only an explicitly approved derived policy may consume it privately. |
| `forbidden_private_document` | Private tenant document/context | Never shared or sent as cross-store AI context. |
| `forbidden_commercial` | Sensitive commercial data | Never affects pattern detection, confidence, severity, recommendation, or rank. |
| `internal_only` | Internal operational/configuration data | Not a shared pattern input. |
| `internal_aggregate` | Aggregate but not anonymous | Not shareable without a separate approved derivation. |
| `allow_platform` | Potentially aggregatable | Normalized platform from a fixed allowlist. |
| `allow_business_category` | Potentially aggregatable | Broad normalized taxonomy only; rare categories roll up or suppress. |
| `allow_count_band` | Potentially aggregatable | Predefined coarse count band; never the exact value. |
| `allow_money_band` | Potentially aggregatable | Predefined SAR band; never exact revenue, price, cost, or profit. |
| `allow_margin_band` | Potentially aggregatable | Predefined coarse margin band; never exact margin. |
| `allow_status_prevalence` | Potentially aggregatable | Allowlisted normalized status prevalence only. |
| `allow_finding_code` | Potentially aggregatable | Versioned deterministic finding-code prevalence. |
| `allow_finding_metadata` | Potentially aggregatable | Versioned severity/detection-confidence/source bands; not statistical confidence. |
| `allow_measurement_quality` | Potentially aggregatable | Completeness/quality band only. |
| `outcome_candidate` | Potentially aggregatable, gated | May contribute only after verified intervention and complete outcome measurement. |
| `public_configuration` | Public/configuration | Not evidence of tenant behavior and not a pattern input. |

Raw fields with an `allow_*` policy are permitted only as inputs to the stated derivation inside the future private computation layer. The raw values themselves never enter the shared layer.

## Approved segmentation

Allowed dimensions are broad normalized business category, platform, predefined order-volume/AOV/revenue/product-count bands, maturity band, and measurement-quality band. Every combination must independently pass privacy gates.

Disallowed dimensions include identity, store name or URL, merchant ID, SKU, product name, exact location, exact timestamps, free text, rare category combinations, and user plan. Plan remains internal-only unless a future privacy decision separately justifies it.

Hierarchical fallback is mandatory: remove the narrowest dimension until the segment passes the gate; if no approved segment passes, return no pattern.

## Tenant contribution and activation gates

- Tenant means the customer account, not a store. Multiple stores owned by one customer count as one tenant.
- Maximum contribution: one normalized contribution per tenant, pattern key, metric version, segment version, and observation window.
- Repeated rows, reports, analyses, products, orders, stores, clicks, or conversions cannot increase tenant diversity.
- Prevalence activation floor: **20 distinct tenants — PROVISIONAL**.
- Outcome/effect activation floor: **30 distinct tenants — PROVISIONAL**.
- Both require diversity, dominance, re-identification, differencing, membership-inference, freshness, and measurement-quality checks.
- No contribution or threshold is active in production until legal/statistical approval and a later explicitly approved phase.

## Future shared pattern output

`shared_pattern_v1` is an allowlist, not a current D1 table:

- `patternId`: semantic identifier derived from approved non-tenant dimensions.
- `patternVersion`, `analyzerVersion`, `metricVersion`, `segmentTaxonomyVersion`, `aggregationMethodVersion`, `privacyPolicyVersion`.
- `findingCode`, `anonymousSegment`, optional verified `interventionCode`, optional `outcomeMetricCode`.
- `evidenceClass`: defaults to `observed_association`; stronger values require an approved measurement design.
- `direction`, coarse `effectBand`, `sampleSize`, `tenantDiversity`.
- Separate `confidenceComponents`, `freshness`, `measurementQuality`.
- `lifecycleStatus`: `candidate`, `validated`, `active`, `stale`, `suppressed`, or `retired`.
- `suppressionReason` and coarse lifecycle timestamps/windows.

The exact forbidden-name list and allowed keys are enforced by the contract test. Candidate patterns remain private and cannot be retrieved by customers.

## Intervention contract

An intervention requires an allowlisted intervention code plus evidence that the action occurred, its affected scope, a verified event time, and a source type of `verified_application_event`, `verified_partner_event`, or `manual_admin_verification`. Manual verification must be attributable in the private audit layer.

The following are explicitly not intervention evidence: recommendation shown, referral shown, referral click, contact, partner conversion, or commission state. A partner conversion describes a commercial funnel event, not proof that a recommended store change was implemented.

## Outcome contract

An outcome contribution requires a compatible baseline, verified intervention time, documented washout period, observation window, versioned metric definition, completeness check, traffic exposure when the metric needs a denominator, and confounder flags for seasonality, campaigns, price, product, and traffic changes.

The default evidence class is `observed_association`. Current sales/order data can support descriptive changes but cannot establish storefront conversion improvement because a reliable visitor/session denominator is not currently present.

## Confidence contract

Three values remain separate:

1. Analyzer detection confidence: confidence that a finding was detected correctly.
2. Pattern evidence/statistical confidence: sample size, tenant diversity, consistency, uncertainty, completeness, freshness, and confounders.
3. AI wording confidence: presentation-only and never a substitute for evidence confidence.

No single combined “AI confidence” is permitted.

## Deterministic suppression

A candidate cannot become active if any gate fails: sample floor, distinct-tenant diversity, contribution bound, rare segment, extreme-value clipping/banding, tenant dominance, exact-time correlation, differencing/membership-inference review, measurement quality, freshness, deletion revalidation, or schema/version compatibility.

Suppression is fail-closed. A suppressed, stale, or retired pattern is not customer-retrievable.

## Retention and deletion

Retention policy is separated by layer:

- Raw tenant layer: existing service/legal retention only; Phase 7 must not extend it.
- Private contribution layer: minimum period needed to aggregate, revalidate, and honor deletion; the exact duration is **PROVISIONAL / NOT APPROVED**.
- Aggregate cells: retained only for active compatible observation windows and revalidation; exact duration is **PROVISIONAL / NOT APPROVED**.
- Shared patterns: lifecycle-managed, revalidated for freshness, then stale/suppressed/retired; exact freshness windows are **PROVISIONAL / NOT APPROVED**.

Deletion must remove the tenant's private contribution, recompute affected cells, re-run thresholds and privacy gates, and suppress any pattern that falls below a gate. A deleted tenant may not permanently influence shared intelligence without a documented lawful basis. Source raw data is then handled under the existing deletion/legal-retention policy.

## Versioning

Data contract, shared pattern schema, analyzer, metric, segment taxonomy, aggregation method, and privacy policy are independently versioned. Incompatible versions cannot share a cell, sample, confidence calculation, or pattern. A new version is built and validated separately before the old version becomes stale or retired.

## Future Admin boundary

Super-admin may eventually see aggregate pattern status, sample size, tenant diversity, confidence components, freshness, versions, suppression reason, and last update. Future controls may globally disable retrieval or suppress/retire a pattern, with audit logging. There is no source-tenant drill-down.

## AI and performance boundary

The order is deterministic aggregation, deterministic pattern, deterministic bounded retrieval, then optional wording. AI cannot create the pattern, sample, segment, outcome, confidence, or rank. Raw tenant data is forbidden from cross-store prompts. Future retrieval returns at most a compact top set after privacy filtering; commission never affects ranking.

Request paths must not scan raw cross-tenant data. A later Phase 7B design may use bounded incremental or scheduled aggregation and derived cells while preserving existing O(1) runtime aggregates. This document creates no table, index, trigger, migration, job, poller, or production behavior.

## Legal gates

Production Shared Intelligence remains blocked pending a documented purpose and lawful basis, privacy-notice review/update, retention and deletion approval, consent/opt-out assessment, DPIA, Saudi privacy/legal review, and cross-border processing assessment if AI later receives derived evidence.
