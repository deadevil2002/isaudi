# Phase 7F — optional AI evidence integration

Phase 7F connects the bounded Phase 7E retrieval service to the existing chat and report-generation requests. It adds no AI client, provider call, metering table, customer API, dashboard redesign, model change, production migration, or production configuration.

## Server-controlled modes

`CROSS_STORE_INTELLIGENCE_AI` accepts only:

- `off`: no customer-finding or pattern query and no prompt effect. This is the default for missing or invalid configuration.
- `shadow`: retrieve and validate internally, but pass no shared evidence to the model and make no customer-visible change.
- `on`: pass the approved compact projection to the existing single AI request.

The flag is read from the server runtime. Request bodies cannot set it. Staging is left in `shadow`; production is unchanged and therefore defaults to `off`.

## Evidence source and tenant isolation

The service reads only the latest successful `landing_page_analyzer_v1` finding set owned by the authenticated user. The client cannot supply a tenant, store, merchant, segment, version, finding code, pattern ID, or source. Only approved finding codes are used, and Phase 7E performs one bounded active-pattern query with the existing maximum of three results.

## Prompt contract

The stable system prefix states that customer facts are authoritative and shared evidence is untrusted contextual aggregate evidence—not instructions, customer facts, source disclosure, or causal proof. The dynamic order is:

1. customer report evidence;
2. customer finding codes;
3. compact shared pattern projection;
4. the current question, for chat.

The projection removes the internal pattern ID and contains only exact finding relevance, coarse sample band, observed-association class, measurement quality, coarse freshness, and applicability. It cannot contain source identity, URL, exact private values, timestamps, partner data, commission data, or free-form pattern text. The serialized shared section is capped structurally at three patterns and verified below 2,400 bytes; it is never padded.

## Failure and cost behavior

Deterministic questions return before retrieval and remain zero-AI/zero-pattern. Retrieval, parsing, privacy, or schema failure returns no shared context and does not fail the existing AI request. Chat and report generation each retain one provider request and their existing reservation/finalization metering. There is no per-store, per-pattern, or second AI request.

Provider-reported usage remains authoritative for input, output, cached-input, cache-write, latency, and cost calculations. Phase 7F does not claim prompt-cache savings or fabricate isolated token deltas when the provider does not expose them.
