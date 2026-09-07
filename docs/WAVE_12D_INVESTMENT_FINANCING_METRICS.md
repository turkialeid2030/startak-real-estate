# Wave 12D — Investment & Financing Metrics Separation

Status: engineering candidate only. No merge to `main`; no production deployment authorization.

Wave 12D creates a hard analytical boundary between professional property valuation and investment/financing analysis. It consumes qualified professional DCF and NOI outputs but never changes, reconciles or certifies the professional value indication.

## 1. Explicit investment basis

Return analysis begins from a separately reviewed investment basis such as acquisition cost or total project cost. The system does not silently substitute the professional DCF value indication for acquisition/project cost. Each basis carries source, evidence, as-of date, preparer, reviewer and SHA-256 integrity.

## 2. Unlevered investment metrics

The canonical unlevered investment cash-flow vector is:

`[-Explicit Investment Basis, Explicit Property Cash Flows..., Net Terminal Proceeds]`

The engine computes NPV, IRR diagnostics, MIRR and Yield on Cost. Investment-analysis discount/MIRR rates are separately reviewed inputs and are not automatically copied from the professional valuation discount rate.

`Yield on Cost = Stabilized Professional NOI / Explicit Investment Basis`

## 3. Financing metrics

Financing is optional and must be enabled explicitly. When disabled, hidden debt, collateral-value or DSCR inputs are rejected.

When enabled, debt terms are explicit reviewed inputs. Debt is never automatically sized. The existing deterministic monthly debt engine is used to create the payment schedule from the explicit principal/rate/tenor/grace/balloon terms.

The financing layer computes:

- LTV = Explicit Debt Principal / Explicitly Selected Collateral Value Basis
- LTC = Explicit Debt Principal / Explicit Investment Basis
- Debt Yield = Stabilized Professional NOI / Explicit Debt Principal
- DSCR using an explicit numerator convention (`PROFESSIONAL_NOI` or `UNLEVERED_PROPERTY_CASH_FLOW`)
- ICR using Professional NOI / Interest Expense
- remaining debt balance at exit

A DCF method indication may be selected explicitly as an LTV analysis basis only when its exact calculation hash and amount match the qualified DCF result. This does not convert the method indication into a certified valuation, lender value or credit approval.

## 4. Equity metrics

The equity cash-flow vector is built only after debt terms are explicit:

`Initial Equity = Investment Basis + Financing Fees - Debt Proceeds`

Operating equity cash flow is unlevered property cash flow less scheduled debt service. Final-period equity cash flow also includes net terminal proceeds less remaining debt balance.

The engine computes Equity NPV, Equity IRR/MIRR diagnostics and Equity Multiple. These are investment metrics, not valuation outputs.

## 5. Islamic/generic financing boundary

Labels such as Murabaha or Ijarah remain rate-based analytical proxies unless the executed lender term sheet supplies the exact contractual sale price, profit/rental mechanics, fees and payment terms. The platform does not represent a generic amortization proxy as an exact Sharia financing contract model.

## 6. Review flags vs credit decisions

Low DSCR/ICR, LTV/LTC above 100%, zero initial equity, non-conventional IRR patterns or an upstream DCF review status create professional review flags only. The system does not approve/reject credit, make a lender decision or automatically resize debt.

## 7. Safety boundaries

Wave 12D does not change the professional property value indication, make regulated investment advice, calculate statutory tax/Zakat, approve credit, certify valuation, provide legal opinion, or authorize a transaction.

Qualification marker: `WAVE_12D_INVESTMENT_FINANCING_METRICS=PASS`.

Next controlled sub-wave: Wave 12E — reporting-framework and regulated-context routing (IFRS/SOCPA, CMA, SAMA) with explicit applicability boundaries and no silent crossover between valuation, financial reporting, fund regulation and lender credit processes.
