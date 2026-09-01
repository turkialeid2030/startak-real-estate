# Financial Precision Remediation C1

## Decision

The production financial path no longer relies on unconstrained binary floating-point accumulation for core NPV, IRR evaluation, monthly debt cash flows, debt annualization, or construction-facility balance accumulation.

## Implemented boundary

- Monetary arithmetic inside the precision layer uses integer **halalas** (`BigInt`, 2 decimal places).
- Rates use fixed-point `BigInt` at **12 decimal places**.
- NPV discount factors are accumulated in fixed-point arithmetic.
- IRR root evaluation calls the fixed-point NPV function.
- Monthly interest, principal, balloon, balances, totals, and annualized debt service use halala arithmetic.
- Construction debt draws conserve the exact construction-debt principal through remainder allocation; capitalized interest and completion balance use fixed-point arithmetic.
- LTV/DSCR debt sizing resolves to the nearest halala; construction debt-fraction sizing resolves on the 12-decimal rate scale.

## Compatibility boundary

Public engine inputs and outputs remain JavaScript `Number` values to avoid breaking the current UI and result contracts. Conversion to `Number` occurs only at module/API boundaries. This means C1 materially closes NC-001 for core monetary accumulation, but does **not** claim that JavaScript Number has been eliminated from every geometry, ratio, user-input, display, or non-monetary intermediate calculation in the application.

The legacy annual amortization helper remains for raw/frozen compatibility. Production leveraged cases use the Wave B monthly financing overlays.

## Rounding policy

- Money: nearest halala, half away from zero.
- Rates: 12 decimal places, half away from zero.
- Monthly debt cash flows are rounded to halalas as they would be on a monetary ledger.
- Construction draw remainders are explicitly allocated so the monthly draw schedule sums exactly to the approved construction-debt principal.

## Claims not established

This remediation does not establish:

- lender term-sheet equivalence;
- Sharia certification or exact Murabaha/Ijarah contractual cash flows;
- certified valuation accuracy;
- tax/accounting treatment;
- production deployment evidence.

Those remain separate evidence/review domains.
