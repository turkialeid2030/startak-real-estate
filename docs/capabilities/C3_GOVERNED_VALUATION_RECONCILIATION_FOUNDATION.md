# C3 — Automated Valuation Intelligence / Governed Reconciliation Foundation

Status: **Phase-0 engineering foundation only**

Roadmap: #464  
Tracking issue: #470

## Purpose

C3 provides a fail-closed analytical reconciliation layer above the existing canonical valuation indications. It is intentionally narrower than a licensed valuation practice and stricter than a generic weighted-average calculator.

The engine will not create an analytical reconciled indication unless all of the following are satisfied:

1. C1 geospatial evidence is re-evaluated internally and is decision-ready;
2. C2 market evidence is re-evaluated internally and is decision-ready;
3. the C2 market context is explicitly bound to the C3 property by a trusted market-context binder;
4. every weighted upstream valuation method is a recognized canonical model in an accepted reconciliable status;
5. all weighted methods share the same governed valuation-value scope;
6. method outputs are property-bound, valuation-date-bound, hash-referenced and independently verified by an allow-listed method verifier;
7. an external governed reconciliation policy exists;
8. a professional reconciliation instruction exists with explicit weights, rationale, reviewer identity and reference;
9. method/approach coverage satisfies the governed policy;
10. cross-approach divergence remains within the governed policy threshold.

## Recognized upstream method indications and value scope

C3 Phase 0 recognizes the current canonical result contracts only:

- `LAND_SALES_COMPARISON_1.0` → **MARKET**, `LAND_ONLY`;
- `DIRECT_CAPITALIZATION_1.0` → **INCOME**, `WHOLE_PROPERTY`;
- `PROFESSIONAL_DCF_1.0` → **INCOME**, `WHOLE_PROPERTY`;
- `COST_APPROACH_1.0` → **COST**, `WHOLE_PROPERTY`.

Recognition means only that C3 knows how to read the result contract. It does not independently certify the upstream calculation, create professional suitability, or authorize use of that method for a particular asset.

`PROFESSIONAL_DCF_1.0` results in `REVIEW_REQUIRED` are intentionally not accepted as reconciliation-ready in Phase 0.

### Important current limitation

There is currently **no recognized whole-property market-sales-comparison engine** in the upstream canonical engine set.

Therefore, C3 Phase 0 must not reconcile `LAND_SALES_COMPARISON_1.0` directly with whole-property income/cost indications. That would combine a land-only value with whole-property values and create a false analytical conclusion.

For `WHOLE_PROPERTY`, the current technically valid Phase-0 reconciliation set can include the recognized income and cost indications only, subject to policy. A future whole-property market-sales-comparison engine may later add a third approach after its own evidence contract and qualification.

## C1 / C2 dependency rule

C3 does not trust a caller-supplied `READY` flag for geospatial or market evidence.

Instead, it invokes the C1 and C2 evaluators again from the supplied evidence records and governed policy inputs. A fabricated `status: READY` or `decisionReady: true` field cannot bypass the dependency gate.

The C1 subject is required to bind directly to the C3 `propertyRef` so evidence from another property cannot silently enter the valuation reconciliation.

## Property-to-market-context binding

C2 correctly binds its evidence records to a single market context, geography and asset type, but C2 alone does not prove that the selected market context is appropriate for the C3 property.

C3 therefore requires an explicit binding containing:

- binding ID;
- property reference;
- C2 market-context ID;
- geography key;
- asset type;
- trusted binder identity;
- binding reference;
- binding timestamp.

The binding must match the actual C2 input and must be established no earlier than the valuation date and no later than the C3 `asOf` timestamp.

This prevents internally consistent but property-irrelevant market evidence from being silently used in reconciliation.

## Valuation-value scope

C3 enforces one common value scope for all weighted method indications. Current scope vocabulary is:

- `WHOLE_PROPERTY`;
- `LAND_ONLY`;
- `IMPROVEMENTS_ONLY`.

The selected reconciliation policy declares its valuation scope, and every allowed model must map to that same scope. A policy attempting to mix `LAND_ONLY` and `WHOLE_PROPERTY` models fails closed.

## Reconciliation policy

C3 does not hard-code universal weights, method counts, approach counts, dispersion limits or confidence thresholds.

The caller selects a `reconciliationPolicyId`, but the policy contents come from a separately supplied governed policy registry. The policy controls:

- valuation scope;
- allowed canonical model versions;
- required approach families;
- minimum number of method indications;
- minimum number of distinct approach families;
- maximum weight per indication;
- maximum aggregate weight per approach family;
- maximum cross-method spread ratio;
- high/moderate analytical agreement thresholds;
- whether every eligible indication must receive an explicit weight.

This prevents an evidence payload from lowering the control thresholds while reusing an approved policy identifier.

## Professional reconciliation instruction

Weights are never invented automatically in C3 Phase 0.

The engine requires a professional instruction containing:

- instruction ID;
- explicit `weightsByIndicationId`;
- rationale;
- trusted reconciler identity;
- reconciliation reference;
- reconciliation timestamp.

Weights must be positive, sum to 1, target only eligible indications and stay within both indication-level and approach-family concentration limits defined by policy.

## Analytical result

When all gates pass, C3 calculates:

- weighted analytical value indication;
- minimum and maximum included method indications;
- spread ratio = `(max - min) / weighted indication`;
- method count and approach-family coverage;
- analytical agreement class: `HIGH`, `MODERATE` or `LOW`, based only on governed spread thresholds.

The agreement class is **not** a statistical confidence interval, probability of correctness, appraisal certification or market-value opinion.

If any gate fails:

- `decisionReady = false`;
- `analyticalValueIndicationSar = null`;
- `analyticalConfidenceClass = NOT_ESTABLISHED`;
- diagnostics may still expose candidate arithmetic and blockers for review.

## Duplicate / double-count protection

C3 prevents the same upstream calculation hash from being counted twice as separate valuation evidence.

Multiple methods from one approach family are permitted only when they are distinct eligible calculations and policy concentration limits remain satisfied. This is particularly relevant when Direct Capitalization and DCF are both used within the Income Approach.

## Sandbox boundary

The C3 Sandbox supports two non-authorizing draft types:

1. method-indication draft;
2. reconciliation-instruction draft.

A Sandbox method draft may recognize a known model version, approach family and value scope but remains:

- unverified;
- ineligible;
- not decision-ready.

A Sandbox reconciliation instruction may preserve candidate weights/rationale, but cannot set a trusted reconciler, reconciliation reference/timestamp, certification or transaction authority.

## Trust boundary

Phase 0 uses allow-listed verifier, market-context-binder and reconciler identifiers plus verification references as a governance contract. These identifiers are **not cryptographic signatures**.

Before production integration, those identities must be backed by an authenticated authorization mechanism appropriate to the production architecture, with tamper-evident provenance and auditability.

## Explicit non-authority

C3 Phase 0 does not create or imply:

- licensed/certified valuation authority;
- Taqeem-accredited valuation opinion;
- automatic professional method selection;
- automatic reconciliation weights;
- statistical confidence;
- lender approval;
- legal/tax opinion;
- transaction authority;
- canonical-baseline activation;
- production deployment authorization;
- Public AI activation;
- Commercial Go-Live.

Current governance remains:

- `COMMERCIAL_GO_LIVE = HOLD`
- `TRANSACTION_AUTHORITY = FALSE`
- `PUBLIC_AI = FALSE`
- `CANONICAL_BASELINE_ACTIVATION_AUTHORIZED = FALSE`

## Remaining gates before governed integration

1. human review of C1 and C2 Phase-0 contracts and data-source assumptions;
2. authenticated verifier / market-context-binder / reconciler identity and authorization model;
3. approved reconciliation policies by asset/use case and value scope;
4. a qualified whole-property market-sales-comparison engine if three-approach whole-property reconciliation is required;
5. professional review of method-selection and approach-reconciliation semantics;
6. privacy/security/provenance review;
7. integration tests using real governed C1/C2 evidence and canonical method outputs;
8. explicit authorization before merge to production/main.
