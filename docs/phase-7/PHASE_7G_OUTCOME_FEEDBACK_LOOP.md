# Phase 7G — outcome feedback foundation

Status: **staging-only, customer exposure OFF, outcome activation prohibited**.

## Current metric audit

| Metric | Classification | Current evidence boundary |
| --- | --- | --- |
| Revenue | Eligible for association analysis now | Versioned absolute order revenue with compatible baseline and observation windows. No causal claim. |
| Orders | Eligible for association analysis now | Versioned absolute non-cancelled order count. No traffic denominator or conversion claim. |
| AOV | Eligible for association analysis now | Deterministic revenue/orders definition with a positive baseline. |
| Profit | Eligible only with complete costs | Suppressed when product cost coverage is partial or unavailable. |
| Margin | Eligible only with complete costs | Versioned percentage-point comparison; exact values remain tenant-private. |
| Conversion rate | Requires additional measurement | Reliable visitor/session denominator is unavailable. Orders are never used as a denominator. |
| Refunds/cancellations | Requires additional measurement | Existing statuses are useful operationally, but a stable cross-provider outcome definition is not approved. |
| Referral shown/click, partner conversion, commission | Not suitable | These are commercial/display events and do not prove a storefront intervention or outcome. |

The application has no verified traffic/session dataset. Landing findings are deterministic problem evidence, not outcomes. Reports and snapshots provide private baseline/observation material only when metric versions and completeness match.

## Intervention contract

An intervention is private and tenant scoped. It requires a fixed finding code, fixed intervention code, store scope, event time, version, and one of three verifiable sources: `verified_application_event`, `verified_partner_event`, or `manual_admin_verification`. The latter two describe evidence types; Phase 7G creates no callback or UI. Recommendation display, referral activity, partner conversion, and customer self-assertion are not accepted.

The current allowlist covers only changes the product could later verify: CTA added, trust signals added, SEO title added, and mobile viewport added. Phase 7G does not automatically infer any of them and adds no fake completion button.

## Baseline, washout, and observation

Every private observation stores a baseline window ending before the verified intervention, an explicitly supplied washout of 1–90 days, and a later observation window. The policies are versioned as `outcome_washout_v1_provisional` and `outcome_observation_v1_provisional`. The range and all effect thresholds are **PROVISIONAL**; no product business rule is silently selected.

Effect bands are deterministic. Revenue, orders, AOV, and complete-cost profit use relative change: `<= -10% negative`, `(-10%, 5%) stable`, `[5%, 15%) small_positive`, `[15%, 30%) moderate_positive`, and `>= 30% large_positive`. Complete-cost margin uses percentage-point change: `<= -2 negative`, `(-2, 2) stable`, `[2, 5) small_positive`, `[5, 10) moderate_positive`, and `>= 10 large_positive`.

These are descriptive before/after bands, never causal estimates, significance tests, p-values, or confidence intervals.

## Quality and privacy gates

The private layer may retain exact values only to compute the approved band. The aggregate/pattern layers contain no tenant, store, merchant, analysis, event, URL, free text, timestamp, or exact value. One customer contributes once per semantic outcome cell even with several stores. Replays are stable-ID idempotent.

Incomplete measurements, low quality, incompatible versions, missing/invalid baselines, invalid windows, overlapping verified interventions, multiple major confounders, conversion without a denominator, fewer than 30 distinct tenants, and provisional tenant dominance above 20% of total absolute private change are suppressed. The 30-tenant floor and dominance limit remain provisional.

Deletion removes private intervention/outcome rows, recomputes bounded affected cells, and revalidates patterns. A 30-to-29 transition becomes suppressed. Outcome patterns stop at `validated`; `active` is excluded from the schema and no Phase 7E retrieval or Phase 7F AI path reads them.

## Runtime boundary

`CROSS_STORE_OUTCOME_ENABLED` is server controlled and left `false`. There is no customer API, Admin mutation, scheduler, request-time aggregation, OpenAI request, retrieval change, plan change, or production configuration. Future event capture must be explicitly authorized and must call the private service only after independently proving the intervention.
