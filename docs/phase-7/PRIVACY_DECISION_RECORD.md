# Cross-Store Intelligence privacy decision record

Decision status: **LEGAL REVIEW REQUIRED — NOT PRODUCTION AUTHORIZATION**

Decision version: `cross_store_privacy_v1_provisional`

This is a technical and product decision record, not legal advice and not a declaration of compliance or anonymity.

## Purpose

Use aggregated signals with source identifiers removed, derived from customer store analysis, to identify recurring patterns and general best practices so iSaudi can improve future customer analyses and recommendations. The purpose is not to share raw store data and is not model training on raw customer records.

## Actual data flow and classification

| Layer | Actual fields | Classification | Boundary |
| --- | --- | --- | --- |
| Customer source | private report/landing analysis, tenant/store ownership; raw products and orders only in the existing customer analysis flow | raw tenant data / secret where applicable | remains tenant-scoped; Phase 7 does not copy raw records into its shared layer |
| Private prevalence contribution | `tenant_id`, coarse month, `platform:salla|csv`, allowlisted deterministic `finding_code`, `finding_prevalence=present`, coarse quality and version fields | private derived data | tenant ID exists only to enforce contribution bounds, deletion, and recomputation |
| Aggregate cell | coarse window/segment/finding/version dimensions plus distinct tenant/observation counts, quality and suppression state | aggregate, not presumed anonymous | no tenant/store identity or raw value |
| Shared prevalence pattern | generated pattern/version data, finding, broad platform, observed-association class, sample/diversity, bounded confidence/freshness, quality and lifecycle | shared pattern | recursive allowlist and forbidden-field validation; retrieval requires all gates |
| Private outcome evidence | tenant/store/analysis IDs, verified intervention, exact private baseline/observed values, windows, confounders and quality | private derived data | never retrieved by another tenant and never projected to AI |
| Outcome aggregate/pattern | coarse platform/finding/intervention/outcome/effect bands, counts, quality, dominance and lifecycle/version fields | aggregate / shared pattern candidate | 30-tenant threshold; observed association, never causal proof |
| Retrieval | at most three active compatible patterns for the requesting tenant's current finding codes and platform | bounded shared pattern | no source drill-down; repeated validation fails closed |
| OpenAI projection | finding code, recurring-pattern label, broad platform, tenant sample **band**, observed-association class, quality, coarse month, short non-instructional guidance | compact shared evidence | added to the existing request only; zero extra requests; omitted on failure |

## Data never shared or projected from another tenant

`userId`, `storeId`, `merchantId`, email, phone, session IDs, access/refresh tokens, URLs, stable tenant hashes, source tenant/store IDs, raw orders/products/customers, names/SKUs, private reports, prompts/chats, exact timestamps, exact revenue/order/AOV/cost/margin values, partner/referral/conversion/commission data. The recursive validator covers nested arrays and objects.

## Minimization, necessity, and proportionality

- Only allowlisted deterministic finding codes are contributed.
- Time is reduced to a month; platform to `salla` or `csv`; values to presence or coarse bands.
- A customer with multiple stores is one tenant. Keys enforce one contribution per tenant/finding/metric/segment/window/version.
- Prevalence requires 20 distinct tenants; outcomes require 30. These are **provisional controls**, not anonymity guarantees.
- Batch, retrieval, deletion, and queries are bounded. Retrieval supplies `0–3` patterns within one existing AI request.

The processing is useful for general recommendation quality, but necessity and proportionality against less intrusive alternatives require legal approval before activation.

## Candidate lawful basis

Candidate for counsel assessment: processing necessary to provide and improve the contracted analytics service and/or another basis permitted by the Saudi PDPL for this documented purpose. **No lawful basis is approved by this record.** Counsel must determine the basis, additional-purpose rules, notice timing, and any cross-border obligations.

## Customer expectations and transparency

The draft public notice explains aggregated indicators with source identifiers removed, the improvement purpose, the boundary against exposing other-customer data, limited AI evidence, and deletion behavior in Arabic and English. Terms contain a short reference. Legal approval of wording and effective-date process remains required.

## Risks and safeguards

Risks include rare cohorts, tenant dominance, differencing, membership inference, time correlation, nested identity leakage, free-text instructions, incompatible versions, and re-identification using auxiliary information.

Safeguards include contribution bounding, broad allowlisted segments, coarse windows/bands, distinct-tenant thresholds, dominance/diversity/freshness/quality/version/lifecycle gates, recursive field validation, instruction-content rejection, at most three results, no source drill-down, failure isolation, and fail-closed suppression. These controls reduce risk but do not prove legal anonymization.

## Deletion

Customer deletion removes private prevalence contributions, recomputes affected bounded aggregate scopes, re-generates/revalidates affected patterns, and suppresses patterns that fall below a gate. Outcome deletion removes private interventions/observations and recomputes affected outcome scopes. Any lawful retention exception must be separately documented and must not silently preserve a shared contribution.

## Retention

- Raw tenant data: existing service/legal lifecycle only; Phase 7 does not extend it.
- Private contributions: **PROVISIONAL — duration not approved**.
- Aggregate cells: **PROVISIONAL — duration not approved**.
- Shared patterns: lifecycle-managed, but exact retention is **PROVISIONAL — not approved**.

Production activation is blocked until durations, deletion SLAs, and any retention exception are approved.

## Consent, objection, and opt-out

Separate consent: **UNRESOLVED — LEGAL REVIEW REQUIRED**. No cosmetic consent checkbox is implemented.

Objection/opt-out: **UNRESOLVED — LEGAL REVIEW REQUIRED**. Counsel and product must determine whether the selected basis creates such a requirement and whether it can coexist with this core capability.

## Required legal gates

1. Approve the lawful basis and additional-purpose analysis.
2. Approve Arabic/English notice and Terms wording and effective-date process.
3. Approve retention, deletion handling, and any exception.
4. Resolve consent, objection, and opt-out obligations.
5. Determine whether a DPIA is required and complete it if so.
6. Complete Saudi privacy counsel review, including de-identification/re-identification classification.
7. Assess cross-border processing for compact evidence supplied to OpenAI.

## Release decision

Production-safe schema and rehearsal may be prepared. `CROSS_STORE_INTELLIGENCE_AI=on`, production D1 migration, and public activation remain blocked until all gates are recorded complete and the exact production action is separately authorized.
