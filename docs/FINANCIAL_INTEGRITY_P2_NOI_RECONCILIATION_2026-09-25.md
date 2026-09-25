# Financial Integrity P2 — NOI Reconciliation — 2026-09-25

## Purpose

P2 establishes a deterministic reconciliation boundary between the residential-income operating analysis and the canonical Financial Integrity NOI waterfall introduced in P0.

The objective is to prevent two different NOI definitions from silently coexisting in the platform and to ensure direct capitalization can only proceed from a reconciled stabilized NOI.

This wave remains a decision-support engineering control. It does **not** establish professional valuation authority, lender approval, transaction authority, legal/tax advice, or commercial Go-Live.

## Source operating semantics

The existing residential-income acquisition model provides a stabilized operating block containing:

- potential gross income;
- vacancy loss;
- credit loss;
- annual concessions;
- annual other operating income;
- effective gross income;
- normalized annual OPEX;
- stabilized NOI.

P2 maps this block into the canonical Financial Integrity waterfall without mutating the source object.

## Canonical mapping

- `potentialGrossIncomeSar` -> `potentialBaseRentSar`
- `vacancyLossSar` -> `vacancyLossSar`
- `creditLossSar` -> `collectionLossSar`
- `annualConcessionsSar` -> `concessionsSar`
- `annualOtherOperatingIncomeSar` -> `otherOperatingIncomeSar`
- `normalizedAnnualOpexSar` -> governed OPEX allocation
- service-charge recoveries default to zero unless explicitly supplied

The canonical engine then recalculates GPI, EGI, operating expenses and NOI independently.

## Reconciliation gates

The bridge compares source EGI and source stabilized NOI against the canonical recalculation within a default tolerance of SAR 0.01.

A mismatch forces:

- `status = HOLD`
- explicit reconciliation blocker codes;
- no direct-capitalization output.

## OPEX classification control

The legacy operating analysis currently exposes aggregate normalized OPEX. P2 does not invent recoverable/non-recoverable classification.

If no explicit allocation is supplied:

- all aggregate OPEX is temporarily mapped to `otherOperatingExpensesSar`;
- `OPEX_CLASSIFICATION_UNALLOCATED` is emitted.

If an allocation is supplied, the sum of recoverable, non-recoverable and other OPEX must reconcile exactly to source normalized OPEX within tolerance. Otherwise the calculation fails closed.

## Service-charge control

Service-charge recoveries are not treated as free income. If provided, they enter EGI and should be matched by a corresponding recoverable OPEX classification where economics warrant it. The canonical waterfall exposes `netServiceChargeContributionSar` so recovery economics remain visible.

## Direct capitalization control

`directCapFromReconciledNoi()` will only produce a calculation if NOI reconciliation passes. The value is then calculated deterministically as:

`Value = Reconciled Stabilized NOI / Market Cap Rate`

An invalid or non-positive capitalization rate returns `NOT_EVALUATED`.

The result is labelled `QUALIFIED_CALCULATION`, not a certified or final professional valuation conclusion.

## Regression coverage

`tests/defects/financial_integrity_p2_noi_reconciliation.js` covers:

- exact source-to-canonical GPI/EGI/NOI reconciliation;
- source non-mutation;
- aggregate OPEX classification warning;
- explicit OPEX allocation reconciliation;
- OPEX allocation mismatch -> HOLD;
- source EGI mismatch -> HOLD;
- source NOI mismatch -> HOLD;
- direct capitalization from reconciled NOI;
- invalid capitalization rate -> NOT_EVALUATED;
- unreconciled NOI blocks direct capitalization;
- matched service-charge recovery/recoverable OPEX does not silently inflate NOI.

## Next implementation sequence

1. Connect this reconciliation bridge to the active residential-income acquisition workflow and UI.
2. Bind the reconciled NOI output into the existing valuation-intelligence direct-capitalization indication with evidence descriptors.
3. Add explicit Entry Cap and Exit Cap assumption provenance and variance controls.
4. Add a governed DCF reconciliation path using dated cash flows and XNPV/XIRR.
5. Add RETT/VAT boundaries outside property NOI.
6. Promote independent valuation cases into a Golden Validation Corpus with tolerance bands and variance explanations.
7. Add combined stress and Monte Carlo only after deterministic operating/valuation reconciliation remains stable under regression.
