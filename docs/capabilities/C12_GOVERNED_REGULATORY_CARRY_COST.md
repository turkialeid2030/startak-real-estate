# C12 — Governed Regulatory Carry Cost Intelligence

## Purpose
C12 implements roadmap #464 backlog item 6 above the exact qualified C11 dependency head. It quantifies property-level regulatory/statutory carrying costs only when the economic obligation, applicability, source, reviewer, effective interval, evidence validity and calculation basis are explicitly supplied and integrity-bound.

C12 is an analytical support layer. It is not a legal, tax, zakat, licensing, valuation, underwriting or transaction-authority engine.

## Dependency base
- Branch base: `c11-governed-income-asset-intelligence`
- Qualified dependency SHA: `c05509f8805d9538e0df0f90b1d7cf6053d32586`
- Roadmap: #464, extended capability item 6

## Evidence-first contract
Every cost item is bound to:
- case and property;
- explicit category and basis;
- SAR currency in Phase 0;
- exact source authority/reference/evidence reference;
- source version SHA-256;
- source verification and review-after dates;
- external professional/regulatory applicability reviewer;
- review evidence reference and SHA-256;
- review date and validity horizon;
- deterministic cost-evidence SHA-256.

Software never creates or upgrades legal applicability, statutory rates or professional authority.

## Phase-0 deterministic bases
- `FIXED_ANNUAL_SAR`
- `FIXED_ONE_TIME_SAR`
- `PERCENT_OF_EXPLICIT_BASE_ANNUAL`
- `PER_SQM_ANNUAL_SAR`

Percentage calculations require an explicit SAR base. Area calculations require an explicit square-metre denominator. No silent unit conversion or inferred denominator is permitted.

## Explicit annual accrual conventions
Recurring annual items require a caller-selected convention:
- `FULL_CALENDAR_YEAR_IF_ACTIVE`
- `ACTUAL_DAYS_365`

The engine does not infer whether a statutory charge legally prorates. The selected convention is part of the evidence/policy contract and is preserved in output lineage.

## Governed review policy
The selected policy binds:
- exact case/property/as-of context;
- exact analysis horizon;
- exact sorted cost-item hash bindings;
- allowed categories and calculation bases;
- required cost categories, if any;
- allowed accrual conventions;
- optional caller-supplied annual amount/share review thresholds;
- reviewer, review evidence and timestamp;
- policy SHA-256.

No Saudi, statutory, market or risk threshold is hard-coded by C12.

## Fail-closed gates
C12 holds rather than calculates when it detects, among other conditions:
- invalid case/property/as-of/horizon context;
- missing cost evidence;
- duplicate cost item IDs;
- evidence or policy hash tampering;
- case/property mismatch;
- stale/future source evidence;
- future or expired professional review evidence;
- unsupported currency/basis/accrual convention;
- absent explicit percentage base or area denominator;
- cost effective interval outside the analysis horizon;
- cost interval extending beyond its professional evidence validity;
- missing policy-required category;
- non-finite/negative derived cost.

Hold states return no misleading zero economic conclusion: `totalCarryCostSar` is null unless the evidence/policy path is ready.

## Output
When ready, C12 returns:
- calendar-year analysis periods;
- item-level charges and evidence hashes;
- annual total carry cost;
- undiscounted horizon total;
- optional policy-derived review flags;
- exact source/reviewer/policy lineage;
- `READY_FOR_PROFESSIONAL_REGULATORY_CARRY_COST_REVIEW` only.

Risk flags are not evidence failures and do not create an acquisition recommendation.

## Non-goals and boundaries
C12 does not:
- determine whether a law, levy, fee, tax or zakat rule applies;
- invent or hard-code a statutory rate;
- provide legal, tax or zakat advice;
- calculate or override acquisition/RETT/brokerage/exit transaction costs;
- derive discount rates;
- calculate NPV or IRR;
- establish a certified valuation;
- create underwriting adoption, approval or transaction authority;
- activate production connectors, Public AI or Commercial Go-Live.

Required authority flags remain false:
- `TRANSACTION_AUTHORITY = FALSE`
- `APPROVAL_AUTHORIZED = FALSE`
- `PUBLIC_AI = FALSE`
- `CANONICAL_BASELINE_ACTIVATION_AUTHORIZED = FALSE`
- `COMMERCIAL_GO_LIVE = HOLD`

## Qualification gate
Dedicated CI must execute:
1. exact-head checkout/assertion;
2. `node tests/defects/c12_governed_regulatory_carry_cost.js`;
3. canonical `npm run release:verify`.

Technical qualification does not authorize merge or deployment. The PR remains Draft / Merge Hold / No Deploy until separate governed human approval.