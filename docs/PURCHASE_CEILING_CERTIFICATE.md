# Scoped purchase-ceiling exclusion certificate

This is engineering evidence for a **fixed-input canonical-model price grid**,
not independent market value, a general optimizer, or transaction authority.
`purchaseCeilingCertificate` is in the current building result and hash-bound
financial JSON. Screen and standalone HTML use the same current result.

## Domain and prerequisites

- Existing Building `BUILDING_WAVE_A_2.0`, `PRICE_BASIS_V1`, and, when present,
  `MONTHLY_DSCR_WAVE_B_1.0`. Updating the underlying equations requires review
  of this proof and its version guard; do not merely extend the allowlist.
- Only `buildingPrice` varies. Prices are positive whole halalas, with safe
  integer minor units, within the declared domain. No sub-halala claim.
- All canonical calculations must be finite. Proof evidence money must also
  survive the safe-integer minor-unit round trip without loss.
- Explicit exit capitalization and seller-borne exit cost, and declared lease
  coverage through both the forward terminal-NOI year and the operating
  payback-threshold horizon used by the engine, are mandatory even in LEGACY.
  Coverage need not exceed the engine's available payback sequence. This is a
  stricter evidence-domain guard than legacy numerical compatibility alone.
  Their declarations are not independently verified source evidence.
- Future unlevered flows after the initial purchase must all be nonnegative,
  with at least one positive flow and a reliable canonical IRR. This is stricter
  than merely counting one sign change: early negative operating years are
  withheld too. Missing/ambiguous/unavailable results never receive a certificate.
- The full production engine must pass **every** applicable financial criterion
  at the candidate: six economically unlevered criteria, or eight with debt.

## Exclusion argument, not sampled monotonicity

For fixed inputs in these equations, total acquisition cost is

`C(P) = P + P*commissionRate + P*transferFeeRate + inspectionCost + valuationCost`.

Every coefficient/load is nonnegative and the coefficient on `P` is at least
one, so cost is nondecreasing as price rises. Stabilized NOI `N`, income value
`V`, the future unlevered cash flows `F[t]`, and operating payback flows `K[t]`
do not contain `P`. Guards reconcile these identities in the actual candidate
and next-halala engine outputs. These guards supplement the equation-based
argument; two samples alone are **not** a proof of global monotonicity.

Each of the following is a necessary criterion for an all-criteria pass:

| Gate | Why failure persists at every higher price |
| --- | --- |
| Net yield | `N/C(P)` cannot increase when positive `N` is fixed and cost rises. |
| Income value coverage | Fixed `V` cannot newly cover a larger `C(P)`. |
| Unlevered NPV | Canonical integer-halala NPV is fixed future PV minus rounded initial cost. Rounding is monotone. The proof reconciles these exact BigInts, serialized as decimal strings. |
| Cumulative operating payback | Each dated cumulative operating recovery is fixed. A higher initial cost cannot make the first recovery crossing earlier, including interpolated fractional years and later negative flows. Sale proceeds are excluded. |

NPV follows canonical precision: cash flows and each discounted contribution
are rounded to halalas; the discount rate uses 12 decimal fixed-point units.
Yield/value/payback retain their canonical Number arithmetic. The certificate
claims that model's criteria, not an alternative unrounded mathematical model.

If candidate `P` passes every criterion and the next grid price `P + 0.01`
fails at least one of these four necessary, price-independent gates, all higher
grid prices are excluded by that gate. Therefore `P` is the highest passing
price in the declared domain. This does **not** assume that IRR, debt sizing,
DSCR or equity NPV are globally monotone. Financing can be included only because
all financing gates pass at `P` and an unlevered necessary gate excludes above it.

If the next price fails only IRR/debt criteria, the result is `NOT_PROVEN`.
An unsuccessful search does not prove infeasibility. A verified lower
alternative remains explicitly separate from a ceiling proof. An unproven
case does not borrow a certificate from an earlier input snapshot.

## Remaining qualification

Arbitrary financial models, other asset engines, non-conventional streams,
continuous/sub-halala prices and cases without a supported adjacent exclusion
remain outside scope. This does not verify rent, expense, lease/asset identity,
exit inputs, market accuracy, source licenses, institutional roles or authority.
`transactionAuthorized` and `sourceIndependentlyVerified` remain false.
The separate user-entered Zakat layer and source-dated operating/cash scenarios
do not amend these six/eight aggregate-engine gates and are explicitly excluded
from the price certificate. A certificate must not be presented as optimizing
those separate overlays or reconciling them to independently verified cash.
