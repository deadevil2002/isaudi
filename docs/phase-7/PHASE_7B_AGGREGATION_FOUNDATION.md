# Phase 7B staging aggregation foundation

Status: staging-only validation foundation. No Shared Pattern, customer retrieval, AI wording, outcome learning, or production activation exists.

## Chosen strategy

The implementation uses bounded incremental contribution replacement followed by deterministic recomputation of one coarse monthly/version scope. It does not scan all tenant data on a customer request. A future scheduled job can process bounded source pages and call the same service; no polling or request-time aggregation was added.

Private contributions are unique by tenant, monthly window, platform segment, finding, metric, analyzer, contract, segment, metric, aggregation, and privacy versions. Repeated reports, analyses, stores, or rows from one customer replace the same contribution instead of increasing tenant diversity.

Aggregate cells are rebuilt from their bounded monthly/version scope using `COUNT(DISTINCT tenant_id)`. The aggregate table contains no tenant, store, merchant, URL, raw text, raw JSON, exact financial value, stable tenant hash, or exact event timestamp. A month-start value is the coarse observation window.

## Scope

Phase 7B implements only deterministic landing-finding prevalence for the approved `platform:salla` and `platform:csv` segments. Finding codes must be in the versioned `landing.*.vN` namespace. Raw finding text/evidence is never stored in either new representation.

The following versioned bucket helpers are defined for later approved metrics but are not written into finding-prevalence cells:

- Orders: `0`, `1–9`, `10–49`, `50–199`, `200–999`, `1000+`.
- Products: `0`, `1–9`, `10–49`, `50–199`, `200+`.
- Revenue SAR: `0`, `1–999`, `1,000–9,999`, `10,000–49,999`, `50,000–249,999`, `250,000+`.
- AOV SAR: `0`, `1–49`, `50–99`, `100–249`, `250–499`, `500+`.
- Margin: negative, `0–9%`, `10–24%`, `25–39%`, `40%+`.

These boundaries are staging implementation metadata, not a legal/statistical anonymity claim and not production-approved policy.

## Privacy and validation

Prevalence cells below 20 distinct tenants are `suppressed`; cells at or above 20 are only `eligible_for_validation`, never active or customer-retrievable. The 20/30 thresholds remain provisional. Outcome storage is intentionally absent; the code only tests the provisional 30-tenant sample gate for a future phase.

One tenant can contribute at most once to one finding cell. Multiple stores remain one tenant because the private key is the customer tenant and the schema has no store identifier. Exact combined/rare customer dimensions are not accepted; the initial segment allowlist contains platform only.

Deletion is fail-closed: the foreign key prevents deleting a user while contributions remain. The bounded deletion service finds affected scopes, deletes the private contributions, recomputes the cells, and can reduce a 20-tenant cell to a suppressed 19-tenant cell. More than 100 affected windows requires a bounded continuation before account deletion.

## Feature and operational boundary

All service methods require the `CROSS_STORE_AGGREGATION_ENABLED` flag. It defaults to disabled because there is no production or customer request integration. The migration lives under `migrations/staging` and must never be run against production.

No Admin page was added. Future super-admin observability may read bounded aggregate counts only; raw private contribution rows remain inaccessible to Admin UI.
