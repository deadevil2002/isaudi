# Phase 7E — bounded cross-store retrieval

Phase 7E adds an internal, server-controlled retrieval service. It does not add a customer API, UI integration, AI call, cache, or production migration.

## Exposure and activation

- Customer exposure is off. `off` performs no query; `shadow` returns evidence only to the internal caller and always returns an empty customer evidence array.
- A pattern remains unavailable until its lifecycle is explicitly changed from `validated` to `active` by the internal activation service.
- Activation is feature-flag controlled, requires `super_admin`, and rechecks the complete Phase 7D validation result, privacy status, version compatibility, sample/diversity bounds, measurement quality, and freshness.
- Customers, partners, AI, referrals, and commissions cannot activate or rank a pattern. There is no activation HTTP route.

## Segment and fallback

The implemented Phase 7B–7D taxonomy currently approves only the broad platform segments `platform:salla` and `platform:csv`. Retrieval deterministically derives that segment from server-owned customer facts. No narrower segment or fallback chain is invented in 7E. A missing exact platform/finding match returns zero evidence.

## Query bound and ranking

The query uses the existing `idx_cross_store_patterns_finding_segment` and `idx_cross_store_patterns_status_version` indexes, requires `active`, exact finding codes, exact segment, and exact compatible versions, joins the exact validation version, and has a hard candidate limit of 12. The internal result is capped at three patterns.

Ranking is deterministic: measurement quality, tenant diversity, sample size, coarse observation window, finding code, then pattern ID. Only the strongest pattern per finding is retained to prevent semantic duplication. Request-time tenant, contribution, aggregate-cell, or pattern generation scans are forbidden.

## Retrieval-time fail-closed checks

Every result rechecks lifecycle, suppression, all Phase 7D gates, validation status, privacy status, versions, minimum 20-tenant diversity, one bounded observation per tenant, measurement quality, coarse freshness (current or previous three months), exact finding, and exact platform segment. Deletion recomputation that drops a pattern below the threshold makes it unavailable immediately.

## Compact evidence

The internal evidence contains only:

- semantic pattern code
- finding code
- exact-platform compatibility
- coarse tenant sample band
- observed-association evidence class
- measurement quality
- coarse freshness label
- pattern version
- same-finding/same-platform applicability

It excludes source tenants, customer/store/merchant identifiers, URLs, exact values, exact timestamps, private text, products, partner data, and commissions. Exact sample counts are converted to coarse bands.

## Cache and AI

No cache is introduced. Each shadow retrieval rechecks current database state, so suppression, staleness, retirement, deletion, and version changes take effect without an invalidation window. OpenAI requests and token cost are zero. Phase 7F remains responsible for any future wording or customer-facing integration.
