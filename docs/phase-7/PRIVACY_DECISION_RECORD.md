# Phase 7A privacy decision record

Decision status: **PROVISIONAL — NOT PRODUCTION AUTHORIZATION**

Decision version: `cross_store_privacy_v1_provisional`

## Approved foundation decisions

1. Cross-store intelligence is privacy-preserving aggregate intelligence, not model training on raw customer data.
2. Shared patterns contain no tenant identity, stable tenant hash, source drill-down, raw record, URL, free text, exact timestamp, or exact/extreme business value.
3. A customer with multiple stores counts once for distinct-tenant privacy and contribution limits.
4. Pattern creation, segmentation, privacy filtering, confidence, and retrieval are deterministic-first.
5. Referral activity, partner conversion, and commission do not prove intervention or business outcome. Commercial value never affects pattern ranking or confidence.
6. Aggregated data is not presumed anonymous. User-scoped, merchant-scoped, partner-scoped, plan-scoped, sparse, or exact aggregates remain internal until an approved derivation passes privacy gates.
7. The current privacy notice does not explicitly authorize cross-tenant derived intelligence. No production processing begins before the legal gates in the data contract are complete.

## Provisional decisions requiring approval

- `k=20` distinct tenants for prevalence.
- `k=30` distinct tenants for outcome/effect evidence.
- Exact retention durations for private contributions, aggregate cells, and shared patterns.
- Exact band boundaries, tenant-dominance threshold, diversity dimensions, freshness windows, and statistical uncertainty method.
- Whether consent or opt-out is required and how deletion interacts with any lawful retention exception.
- Whether any optional AI wording step creates cross-border processing obligations.

These values are documentation inputs only. They are not production rules until privacy, legal, statistical, and product approval is recorded in a later version.

## Re-identification decision

Removal of direct identifiers is insufficient. Every candidate must be tested for small sample, rare category, rare combination, extreme values, unique behavior, exact-time correlation, differencing, membership inference, source reconstruction, and tenant dominance. Failure is fail-closed suppression.

K-anonymity-style thresholds are only one control and do not guarantee anonymity. Future implementation must combine contribution bounding, coarse banding, hierarchical segment fallback, clipping, version isolation, and deterministic suppression. Differential privacy is not approved or rejected by this record; adopting it would require a separate design and accuracy/privacy budget review.

## Purpose and minimization decision

The only proposed purpose is to improve tenant analytics with recurring, sufficiently diverse, non-identifying patterns. Raw data is not retained longer merely because it might be useful for future learning. Each future contribution must have an approved field derivation, purpose, window, and deletion path in the machine-readable contract.

## Deletion decision

A deletion request invalidates that tenant's private contributions. Affected aggregates must be recomputed and patterns revalidated. Falling below any sample, diversity, quality, freshness, or privacy gate changes the pattern to `suppressed`; deletion cannot be hidden by keeping an irreversible tenant contribution in the shared layer.

## Release gate

Phase 7B may design and test a staging-only aggregation foundation after these provisional decisions are reviewed. Production remains blocked until all legal gates are approved and a separate explicit production authorization is given.
