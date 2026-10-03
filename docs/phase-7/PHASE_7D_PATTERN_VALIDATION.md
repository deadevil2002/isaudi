# Phase 7D deterministic pattern validation and privacy gates

Status: staging-only validation. No activation, customer retrieval, AI wording, outcome learning, or production processing is authorized.

The bounded validator reads only candidate patterns and their aggregate-derived evidence. It evaluates schema, the machine-readable contract boundary, provisional sample/diversity, contribution dominance, broad-segment rarity, re-identification, measurement quality, provisional freshness, version compatibility, deletion consistency, and causality separation. One failed gate suppresses the pattern.

Freshness has no approved duration. A passing Staging validation is therefore labeled `provisional_validated_no_activation`; it is never evidence that a pattern may be active. Validation confidence is qualitative and deterministic, not a statistical or AI confidence score.

The current platform segment is already the broadest approved fallback. Unsupported or combined dimensions are rejected rather than merged. Differencing and membership inference are constrained by bounded tenant contributions, coarse windows, a non-queryable internal pattern layer, and the absence of any customer retrieval API. These controls do not claim legal anonymity.

Validation results are operational records separate from `shared_pattern_v1`. They contain gate names, versions, counts, quality, and coarse validation windows, but no source tenant, store, merchant, URL, raw evidence, partner, commission, or customer data. A newly validated compatible semantic version marks older validated versions `stale`; a privacy-policy mismatch suppresses the old version pending independent revalidation.
