# Cross-Store Intelligence legal-basis and privacy-impact assessment

Status: **TECHNICALLY READY — LEGAL REVIEW REQUIRED**

Assessment date: 2026-10-03

Production authorization: **NO**

This is a technical/legal readiness assessment, not legal advice, a declaration of PDPL compliance, or SDAIA approval. It records the implementation observed in this repository and the legal questions that Saudi privacy counsel must resolve before production activation.

## Official sources used

- [Saudi Personal Data Protection Law](https://dgp.sdaia.gov.sa/wps/portal/pdp/knowledgecenter/details/PDPL/)
- [Implementing Regulation of the PDPL](https://dgp.sdaia.gov.sa/wps/portal/pdp/knowledgecenter/details/PDPL2/)
- [Guide to the Saudi PDPL for Controllers and Processors](https://dgp.sdaia.gov.sa/wps/portal/pdp/knowledgecenter/details/PDPLCP/)
- [Privacy Policy Guideline](https://dgp.sdaia.gov.sa/wps/portal/pdp/knowledgecenter/details/ElaborationandDevelopingPrivacyPolicyGuideline/)
- [Personal Data Destruction, Anonymization and Pseudonymisation Guideline](https://dgp.sdaia.gov.sa/wps/portal/pdp/knowledgecenter/details/PersonalDataDestruction)
- [Personal Data Processing Activities Records Guideline](https://dgp.sdaia.gov.sa/wps/wcm/connect/19ec3250-16a6-47c7-8e8c-b8e1d6f86633/Personal%2BData%2BProcessing%2BActivities%2BRecords%2BGuideline.pdf?CONVERT_TO=url&MOD=AJPERES)
- [Regulation on Personal Data Transfer Outside the Kingdom](https://sdaia.gov.sa/Documents/RegulationonPersonalDataEN.pdf)
- [SDAIA privacy impact-assessment service](https://dgp.sdaia.gov.sa/wps/portal/pdp/services/privacyimpactassessment)

The Implementing Regulation Article 16 conditions legitimate-interest processing on lawfulness, a rights/interests balance, absence of sensitive data, and reasonable expectations. Article 25 requires a written impact assessment in enumerated cases, including collecting, comparing, or linking two or more personal-data datasets from different sources. The SDAIA controller/processor guide states that pseudonymised data remains personal data and anonymisation requires permanent impossibility of identification.

## Purpose and architecture

Purpose: use approved aggregated/de-identified derived indicators from customer usage and store analysis to identify recurring patterns and general best practices, so future iSaudi analysis and recommendations can improve.

Actual path:

`tenant data → deterministic analysis → minimal private contribution → aggregate cell → candidate pattern → privacy validation → active shared pattern → bounded retrieval → optional AI evidence`

This is not sale of customer data, disclosure of raw store data, or training an AI model on raw customer records. Those descriptions would be inaccurate.

## Roles by processing activity

| Flow | Purpose/essential means decided by | Readiness classification |
| --- | --- | --- |
| Merchant account, authentication, security, billing and support | iSaudi | iSaudi is Controller for these operations. |
| Merchant-directed Salla/CSV ingestion, report generation and tenant-specific analytics | Merchant selects the data/service purpose; iSaudi defines service mechanics | iSaudi is likely Processor for end-customer personal data and Controller for its own account/operational data. A DPA and instructions must confirm this. |
| Salla as source/platform | Merchant authorises Salla and iSaudi; Salla's own role is contract-dependent | **LEGAL REVIEW REQUIRED**; repository evidence cannot determine Salla's complete legal role. |
| OpenAI wording of a merchant-specific analysis | iSaudi sends the request to provide the customer feature | iSaudi is Controller or Processor according to the underlying flow; OpenAI is a subprocessor/processor candidate subject to contract and transfer review. |
| Cross-Store purpose, contribution contract, thresholds, patterns and retrieval | iSaudi independently decides purpose and essential means | iSaudi is likely an independent Controller for this secondary processing. Calling iSaudi only a Processor is unsafe. Joint-controller risk is unresolved if customer contracts make merchants participate in determining this purpose. |

If data originally received as a Processor is repurposed for iSaudi's own Cross-Store objective, a merchant instruction or service contract does not automatically supply a lawful basis. Contractual role, legal basis, transparency to affected individuals, and any end-customer notice allocation require counsel approval.

## Actual input and personal-data inventory

| Source | Fields actually handled/persisted | Personal/sensitive data potential | Cross-Store reach |
| --- | --- | --- | --- |
| Salla authorisation | merchant/user identifiers; authorizer name/email/role; encrypted access/refresh tokens; scopes; store name/domain/status | Personal data and secrets; no sensitive category intended | Forbidden from contribution, pattern and AI projection. |
| Salla products first page | Provider JSON may contain product IDs, names, SKUs, prices, inventory and other provider fields | Mostly business data; free text may contain personal data | Used only to verify readable scope/count. Provider records are now discarded at the read boundary and never returned by the client. |
| Salla orders first page | Provider JSON can contain customer name, email, phone, customer IDs, billing/shipping addresses/information, notes and item data depending on provider response | Personal data is reasonably possible; free-text/items could reveal sensitive information in context | Used only to verify readable scope/count. No provider order record is persisted or returned; no field enters Cross-Store. Response is bounded to 512 KiB, no-store, not logged, and discarded after count/pagination projection. |
| CSV products | accepted product type/name/SKU/price/cost/inventory/category/external ID | Business data; arbitrary uploaded columns can contain personal data | Normalised required fields may persist tenant-private. Raw rows never enter Cross-Store. Common customer-identity headers now fail before import. |
| CSV orders/items | order ID, total, date, status, item count, product/SKU/name/quantity | Primarily business transaction data; arbitrary uploads can contain end-customer data | Only the listed analytic fields persist. Customer identity/address/contact headers are rejected; raw CSV and ignored fields never enter contributions. |
| `products`, `orders`, `order_items`, costs | IDs, tenant ownership, product/order measures and tenant-private commercial fields | Generally merchant business data; could become personal when linked to sole traders or individual purchases | Data contract forbids raw identifiers/names/SKUs/exact commercial values. Current prevalence contribution does not read these tables. Future outcome work stores exact values privately and shares only coarse effect bands after gates. |
| Reports/snapshots/AI outputs/chats | tenant IDs, exact metrics, report JSON, prompts, responses and usage | Personal data possible in free text and tenant-linked records | Private documents and prompts are forbidden. Current contribution generator does not read them. |
| Landing analysis | tenant/merchant ID, storefront URL, evidence, findings, timestamps | URLs and tenant linkage are identifying; public-page content may contain personal data | Current contribution uses only allowlisted deterministic `findingCode`, broad platform, coarse month, presence and quality/version fields. |
| Referral/outcome data | user/merchant/analysis/referral/partner/commission details | Tenant/commercial identifiers | Referral, partner and commission data are forbidden. Verified intervention/outcome values remain private; only approved coarse observed-association bands may become candidates. |

Sensitive data is not needed by Cross-Store and no sensitive field is allowlisted. Nevertheless, provider responses and arbitrary CSV/free text may contain sensitive personal data unexpectedly. The legal/operational control must prohibit it and maintain early rejection/minimisation; legitimate interest cannot be used for any sensitive-data processing.

## Layer-by-layer flow, identity, retention and deletion

| Layer | Allowed fields | Identity/privacy state | Retention/deletion |
| --- | --- | --- | --- |
| Raw source | tenant-private provider/upload fields needed for service | Personal/tenant data may exist | Existing service/legal lifecycle only; Cross-Store does not extend it. Unneeded Salla record fields are discarded at projection; common CSV personal-data columns are rejected. |
| Tenant-private analysis | private reports, evidence and deterministic findings | Personal or confidential tenant data | Existing report/analysis lifecycle; deleted with tenant data subject to documented legal exceptions. |
| Private prevalence contribution | tenant ID, coarse month, platform, allowlisted finding, presence, quality and versions | **Pseudonymised/private derived data, not anonymous** | Provisional duration; tenant deletion removes rows. |
| Aggregate cell | coarse dimensions, distinct tenant/observation counts, quality, suppression state | Aggregated/de-identified; not presumed legally anonymous | Recomputed after source changes/deletion; provisional duration. |
| Candidate/validated/active pattern | strict allowlist, sample/diversity, coarse month, observed association, lifecycle/version data | Source identifiers removed; de-identified aggregate; anonymity not claimed | Revalidated; suppressed/staled/retired on failed gates; duration provisional. |
| Retrieval | maximum three active same-platform/same-finding patterns | Bounded shared evidence; no source drill-down | Request-only projection; no arbitrary query API. |
| OpenAI evidence | finding code, recurring-pattern label, exact-platform compatibility, sample band, association class, quality, coarse freshness/applicability | De-identified compact evidence, not asserted anonymous | Included only in one existing request when mode is `on`; omitted in `off`/`shadow` or on failure. Provider retention/location is contract/account dependent. |

## Shared-pattern and re-identification controls

The runtime and machine-readable contract recursively reject identity, tenant/store/merchant/customer/session/token, source URL, raw order/product/customer, private report/prompt/chat, exact timestamp/revenue/order-count/AOV/cost, partner and commission fields. Top-level fields are independently allowlisted.

Controls verified in code/tests: one contribution per tenant/finding/metric/segment/window/version; multi-store owners count once; minimum 20 distinct tenants for prevalence and 30 for outcomes; broad platform-only segment; coarse monthly windows; tenant-dominance checks; equality of observations and tenant diversity; measurement/freshness/version/lifecycle gates; recursive nested-field validation; bounded batches and retrieval; no source drill-down; no arbitrary customer query; deletion/recomputation; failure isolation; tenant-scoped APIs.

Residual risk: cohort membership may still be inferred using auxiliary knowledge, repeated monthly observations, rare findings or differencing. Existing suppression materially reduces this risk but is not proof of legal anonymisation. Risk must be periodically reassessed against realistic auxiliary data; thresholds must not be weakened.

## Purpose compatibility

Original purposes include connecting/importing store data to provide that merchant's analytics, reports and recommendations. Cross-Store uses a minimal derived signal to improve recommendations for other customers. That is a **secondary/additional purpose**, not automatically the same purpose.

Compatibility is plausible because the output is general, bounded, de-identified, does not expose source records and remains closely related to analytics improvement. It is not approved: account-holder expectations, end-customer expectations, original merchant instructions, notice timing and a less-intrusive alternative analysis must be documented.

## Legitimate-interest assessment

| Test | Assessment |
| --- | --- |
| Purpose | Improving accuracy and usefulness of recurring store-analysis recommendations is a real commercial/service interest and is not inherently unlawful. **PASS candidate**. |
| Necessity | Cross-tenant recurrence cannot be established from one tenant alone, but the purpose can use only deterministic findings and coarse counts. Raw records, identity and exact values are unnecessary. **PASS only for the minimised architecture**. |
| Minimisation | Current contribution is finding presence + broad platform + month + quality/version. Direct identifiers and raw data are forbidden. Salla records now stop at count projection and common CSV PII headers are rejected. **PASS with operational monitoring**. |
| Rights/interests balance | Potential harms include unexpected secondary use, processor-role overreach, membership inference, incorrect recommendations, and indirect impact on merchant end customers. No individual-level decisions or source disclosure is intended. **REVIEW**. |
| Reasonable expectations | Merchants may expect service improvement after clear notice; existing customers and merchant end customers may not reasonably expect cross-store secondary use without prior notice/contract allocation. **NOT YET ESTABLISHED**. |
| Sensitive data | Not needed or allowlisted; unexpected sensitive data remains possible at raw ingress. Legitimate interest must not cover it. **CONTROL REQUIRED**. |
| Safeguards | Strong technical gates exist; legal/contractual, transfer, retention and notice controls remain incomplete. **PARTIAL**. |
| Transparency | Public copy now explains purpose, layers, end-customer possibility, status and transfer uncertainty without claiming anonymity. Merchant-to-end-customer notice allocation remains unresolved. **PARTIAL**. |
| Retention | Raw lifecycle is unchanged, but private contribution/aggregate/pattern durations are not approved. **FAIL pending approval**. |
| Deletion | Service and tests remove tenant contributions, recompute cells and now fail closed by suppressing the affected Pattern and validation result when diversity falls below 20. A controlled Staging database exercise and cleanup are recorded below. **PASS at the Cross-Store service layer**; no customer account-deletion HTTP workflow was found, so the operational deletion procedure must invoke both prevalence and outcome deletion services before production activation. |
| Re-identification | Controls reduce risk; legal anonymisation is not established. **REVIEW**. |

Result: **POSSIBLY SUITABLE — LEGAL REVIEW REQUIRED**. This is not approval to rely on legitimate interests.

## Consent, explicit consent, objection and opt-out

Consent is not automatically the only available basis. If counsel approves legitimate interest for the strictly minimised non-sensitive flow, separate consent may not be required. Because reasonable expectations, role allocation, retention and end-customer transparency remain unresolved, the current decision is **LEGAL REVIEW REQUIRED**.

If consent is selected, it must be specific, informed, freely given, evidenced, separable from unrelated purposes and withdrawable. Explicit consent is required if consent is relied upon for sensitive data; sensitive data is not intended or permitted in Cross-Store.

The reviewed official sources establish withdrawal where consent is used, but this assessment did not verify a general PDPL opt-out right specific to this legitimate-interest scenario. Do not invent one. Counsel must determine any objection/restriction mechanism and whether an opt-out should be adopted as a balancing safeguard or contractual commitment.

## Cross-border processing

The repository does not pin or prove the processing geography of Cloudflare or OpenAI. Cloudflare executes the Worker/D1 service and OpenAI may receive the compact evidence only when the feature is `on`. Therefore whether a regulated transfer occurs, the receiving countries, adequacy, minimum-transfer test, transfer-risk assessment, and appropriate safeguard are **UNCERTAIN / LEGAL REVIEW REQUIRED**.

Aggregated or de-identified data is not automatically outside transfer requirements. Treat the evidence as potentially personal until legal anonymisation and provider geography are documented. Obtain the applicable provider terms/data-processing agreement, location/account settings, onward-transfer information and Transfer Regulation assessment before activation.

## DPIA and processing record

**DPIA: REQUIRED on the conservative current classification, subject to counsel confirmation.** Cross-Store compares/links contributions derived from multiple tenant datasets, including pseudonymised tenant-linked contributions, which falls within Implementing Regulation Article 25(1)(b) if those datasets are personal data. Automated technology and the secondary-use risk strengthen the case even though the output is not an individual decision.

Create a RoPA entry containing: Controller/Processor role per layer; purpose; legal basis; merchant and end-customer categories; account/Salla/CSV/landing/derived fields; recipients/processors; transfer countries and safeguards; raw/private/aggregate/pattern retention; deletion/recomputation SLA; security controls; DPIA reference; feature-flag status; and owner/review date.

## Privacy risk and open approvals

- Technical privacy risk: **LOW to MEDIUM**. Strong minimisation and suppression exist; residual membership/differencing risk remains and source ingestion can contain personal data.
- Legal uncertainty: **HIGH**. Lawful basis, reasonable expectations, processor-to-controller transition, end-customer transparency, retention, transfer mechanism and completed DPIA are unresolved.
- Privacy Notice: **CHANGES MADE; COUNSEL APPROVAL REQUIRED**.
- Terms: **MINIMAL CHANGE MADE; DPA/role allocation and counsel approval still required**.
- Retention: **PROVISIONAL / LEGAL REVIEW REQUIRED**; no period is invented here.
- Production flag: **OFF**. Staging may remain `shadow`; no customer exposure is authorized.

## Controlled Staging deletion verification

On 2026-10-03, after the iSaudi Staging account/D1 preflight passed, an isolated fixture with 20 synthetic `.invalid` tenants was created in `isaudi-staging-db`. No real customer or production data was used. The prevalence cell and validation began at 20 distinct tenants. Removing one tenant contribution and rebuilding the bounded monthly scope produced:

- aggregate cell: 19 tenants / 19 observations, `suppressed`, `small_sample`;
- candidate Pattern: sample/diversity 19, `suppressed`, `small_sample`;
- validation result: 19 distinct tenants, `suppressed`, `insufficient`, `small_sample`.

All fixture validation, Pattern, aggregate, contribution and user rows were then removed. Final counts returned to the pre-test state: zero Cross-Store contributions, cells, Patterns and validation results, and zero fixture users. Production was not queried or mutated.

## Release gate

Before production activation: complete/approve the LIA; complete the DPIA; define the RoPA; approve retention/deletion SLA and wire or document the operational account-deletion orchestration; settle Controller/Processor and merchant notice obligations contractually; determine consent and objection/opt-out; complete transfer assessment and provider safeguards; approve Arabic/English notices and effective-date communications; record named legal approver and decision date.
