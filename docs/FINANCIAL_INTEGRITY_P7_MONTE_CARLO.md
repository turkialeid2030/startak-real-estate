# Financial Integrity P7 — Governed Monte Carlo Risk

## Purpose
P7 adds reproducible uncertainty diagnostics after P6 deterministic stress and golden validation.

## Controls
- Seed is mandatory and returned in output for reproducibility.
- Iterations are bounded to 100–100,000.
- Input distributions are explicit and governed: fixed, uniform, normal, or triangular.
- Required drivers: NOI growth, exit capitalization rate, and discount rate.
- Invalid economic draws fail closed rather than being silently discarded.
- Probability thresholds for NPV < 0, IRR below hurdle, and DSCR below minimum are explicit inputs.
- Outputs expose P05/P50/P95 and breach probabilities.
- Results never create investment approval, certified valuation, lender approval, or transaction authority.

## Known modelling boundary
The P7 IRR statistic is an explicitly approximate terminal-wealth annualized return, not a full periodic-cash-flow IRR solver. It must not be labelled or consumed downstream as exact IRR until a governed dated cash-flow IRR/XIRR implementation is added and independently validated.

## Release condition
P7 remains a stacked Draft until its final head passes canonical verification. P6 must merge first, then P7 can be retargeted to main and independently qualified for merge.
