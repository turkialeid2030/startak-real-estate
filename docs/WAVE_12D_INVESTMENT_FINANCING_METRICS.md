# Wave 12D — Separated Investment & Financing Metrics

Status: engineering candidate only. No merge to `main`; no production deployment authorization.

Wave 12D separates investment and financing analytics from the professional valuation indication. The professional DCF value indication remains unchanged and is treated as a read-only external reference for investment analysis only.

## Boundaries

The professional valuation layer remains unlevered and produces only a method indication. Wave 12D may calculate investment, debt and equity metrics, but those metrics must not alter the professional property value indication, professional DCF cash flows, discount rate, exit cap, terminal NOI, or valuation conclusion.

No automatic lending approval, credit decision, debt sizing authorization, legal opinion, certified valuation or transaction authority is produced.

## Metric families

### Unlevered investment metrics

- NPV
- IRR with reliability diagnostics
- MIRR
- Yield on Cost

These metrics are computed from explicit unlevered project cash flows and remain separate from professional valuation DCF arithmetic.

### Debt metrics

- LTV
- LTC
- DSCR
- ICR
- Debt Yield
- explicit debt-service schedule
- outstanding debt balance at exit

Financing inputs must be explicit and reviewed. Generic amortizing debt, Murabaha-rate proxy, and Ijarah-rate proxy classifications are supported only as analytical financing models. Exact lender/contract economics require the executed term sheet.

### Equity metrics

- Equity NPV
- Equity IRR with reliability diagnostics
- Equity MIRR
- Equity Multiple

Equity cash flows are derived only after an explicit financing case exists.

## Governance controls

- professional property value indication is immutable inside Wave 12D
- financing cannot change the professional valuation indication
- LTV requires an explicit value basis classification and exact supporting value/hash binding
- LTC requires explicit cost basis
- debt service cannot enter professional NOI or professional valuation DCF
- income tax and Zakat are not calculated here
- no automatic debt approval or lender decision
- no automatic financing model selection
- IRR diagnostics surface non-computable or multiple-root cases; MIRR is retained as the safer presentation metric where appropriate
- financing model boundaries are disclosed explicitly

## Calculation integrity

Canonical financial primitives remain under `src/engines/financial`. Wave 12D orchestration must use those canonical primitives instead of implementing independent UI/AI formulas.

The investment/financing packet and result are content-hashed for deterministic integrity and full provenance.

Qualification marker: `WAVE_12D_INVESTMENT_FINANCING_METRICS=PASS`.

Next controlled sub-wave: Wave 12E — financial-reporting and regulated-context routers (IFRS/SOCPA, CMA, SAMA) as applicability and reporting gates only, without allowing those routers to silently modify valuation arithmetic or issue legal/regulatory conclusions.