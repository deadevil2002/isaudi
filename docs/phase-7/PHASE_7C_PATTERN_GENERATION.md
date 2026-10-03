# Phase 7C deterministic candidate pattern generation

Status: staging-only candidate generation. No validation, activation, ranking, customer retrieval, AI wording, or production processing is authorized.

The generator consumes only Phase 7B aggregate cells. It never queries tenant, store, order, product, report, referral, partner, or AI tables. Changed cells can be regenerated directly; the bounded fallback reads at most 100 aggregate cells and performs one batched upsert operation per candidate set.

Eligible prevalence cells become `candidate`; insufficient or unsafe cells become `suppressed`. The canonical pattern key contains only the approved finding, broad platform segment, coarse monthly window, metric, analyzer, and version identifiers. Its SHA-256-derived ID identifies the semantic pattern and contains no contributor identity.

No prevalence ratio is invented because Phase 7B has no approved total-segment denominator. The candidate therefore records `direction=observed`, `effectBand=not_applicable_prevalence`, exact approved sample/diversity counts, and separate deterministic quality components. It makes no outcome, effect, improvement, or causal claim.

Phase 7B currently emits only the broadest approved platform segment, so there is no narrower segment to fall back from. Sparse platform cells are suppressed; unsupported or combined segments fail closed. Freshness remains `provisional_not_approved` and `unvalidated` because no retention/freshness duration is approved. Every pattern remains non-active.

The candidate table mirrors only `shared_pattern_v1` fields. It stores no data-contract version because that field is not in the machine-readable shared-pattern allowlist; the generator instead requires the exact contract version at its input boundary. Incompatible source versions fail before any write.
