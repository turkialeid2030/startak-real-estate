# C10 — Governed Market Interpretation / Liquidity

## Purpose

C10 implements extended-capability backlog item 4 from roadmap #464 above the exact qualified C9 head `bcc5ca11094201b50bdaa1aa8b41b9523143231a`.

C10 is a deterministic professional-review aid. It converts explicit, authoritative market metrics into policy-defined classifications only after the existing C2 market-evidence engine has passed provenance, source-scope, verification, freshness, conflict and minimum-evidence gates.

C10 does **not** create a certified valuation, investment recommendation, underwriting adoption, forecast, HBU conclusion, transaction authority or production authority.

## Upstream dependency

C10 internally evaluates the supplied market-evidence input through `evaluateMarketEvidenceBundle`.

Progression is impossible unless the C2 result is:

- `status = READY`; and
- `decisionReady = true`.

This means a C10 classification cannot bypass C2 evidence governance by directly supplying a claimed market metric.

## Governed interpretation policy

The evaluator selects `interpretationPolicyId` from a separately supplied `governedInterpretationPolicies` registry.

The selected policy must contain:

- version `C10_MARKET_INTERPRETATION_POLICY_V1`;
- exact policy ID;
- exact market context, geography and asset type;
- SHA-256 hash of the exact evaluated C2 result;
- accountable reviewer, review reference and review timestamp;
- one or more explicit interpretation rules;
- SHA-256 integrity hash of the policy itself.

A raw metric or evidence payload cannot create or silently change thresholds.

## Interpretation rules

Each rule explicitly declares:

- rule ID;
- interpretation dimension;
- authoritative evidence ID;
- expected authoritative evidence type;
- top-level numeric metric field;
- top-level unit field;
- exact expected unit;
- classification bands.

Supported dimensions and evidence classes are deliberately narrow:

- `LIQUIDITY` → `MARKET_LIQUIDITY_INDICATOR`;
- `SALE_MARKET_MOVEMENT` → `SALE_PRICE_INDEX` or `SALE_MARKET_AGGREGATE`;
- `RENT_MARKET_MOVEMENT` → `RENT_INDEX` or `RENT_MARKET_AGGREGATE`;
- `MARKET_ACTIVITY` → sale/rent aggregate or market-liquidity indicator.

The referenced evidence type must also be an upstream C2 **required** evidence type. This prevents an incidental authoritative record that was not subject to the selected minimum-count gate from silently becoming the basis of C10 interpretation.

## No invented thresholds or units

C10 does not supply default Saudi liquidity bands, price-movement thresholds, weights, composite scores or benchmark values.

Every threshold is supplied by the governed policy. Every metric must be a finite numeric value and the evidence unit must exactly match the policy unit.

No percentage/ratio, period, currency, area, count or other unit conversion is performed silently.

## Band semantics

Classification bands use deterministic half-open intervals:

`[minInclusive, maxExclusive)`

`null` may be used for an unbounded lower or upper end.

Overlapping bands fail policy validation. A metric value falling into no band fails closed. A boundary value equal to a band's `maxExclusive` belongs to the next band whose `minInclusive` equals that value.

## Evidence authority and lineage

Rules may bind only to records present in C2 `authoritativeEvidence`.

Supplemental asking/listing evidence cannot produce an authoritative C10 classification.

Each successful interpretation emits lineage including:

- source ID;
- source reference and URL;
- verification reference;
- effective, observed and valid-until timestamps;
- series and period keys;
- normalized-value hash.

## Fail-closed states

- `HOLD_UPSTREAM_EVIDENCE`
- `HOLD_POLICY`
- `HOLD_INTEGRITY`
- `HOLD_EVIDENCE_BINDING`
- `HOLD_METRIC`
- `HOLD_UNIT_COMPATIBILITY`

The only progression state is:

- `READY_FOR_PROFESSIONAL_MARKET_REVIEW`

This state means that the explicit authoritative metrics were deterministically classified under the supplied governed policy. It is not a market-standard declaration, valuation opinion or investment decision.

## Explicit non-goals

C10 does not:

- infer official source licensing, API or redistribution rights;
- blend asking evidence into authoritative market evidence;
- invent source priority beyond C2 governance;
- forecast future market conditions;
- generate a hidden composite liquidity score;
- determine market value;
- recommend acquisition, sale or financing;
- write financial-engine inputs automatically;
- authorize a transaction or approval;
- activate production or a canonical baseline.

## Authority boundary

Every C10 result keeps:

- `certifiedValuationEstablished=false`
- `professionalValuationOpinion=false`
- `automaticUnderwritingAdoption=false`
- `automaticAcquisitionRecommendation=false`
- `highestBestUseEstablished=false`
- `transactionAuthorized=false`
- `approvalAuthorized=false`
- `decisionBinding=false`
- `productionAuthorityGranted=false`
- `publicAiAuthorized=false`
- `commercialGoLiveAuthorized=false`
- `canonicalBaselineActivationAuthorized=false`

Project-level posture remains:

- `COMMERCIAL_GO_LIVE = HOLD`
- `TRANSACTION_AUTHORITY = FALSE`
- `PUBLIC_AI = FALSE`
- `CANONICAL_BASELINE_ACTIVATION_AUTHORIZED = FALSE`

## Qualification gate

The dedicated C10 workflow must pass on the exact candidate head:

1. `node tests/defects/c10_governed_market_interpretation_liquidity.js`
2. canonical `npm run release:verify`

The branch and PR remain **Draft / Merge Hold / No Deploy** until a separate explicit authorization.
