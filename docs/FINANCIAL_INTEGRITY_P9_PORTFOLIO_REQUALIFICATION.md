# Financial Integrity P9 — Fresh Main Portfolio Requalification

This branch introduces the governed portfolio decision cockpit directly on the current `main` lineage after the successful P8R merge.

## Scope

- Aggregate portfolio value, NOI and annual debt service.
- Calculate portfolio DSCR from aggregate NOI / aggregate positive annual debt service.
- Measure concentration by single asset, city and asset type.
- Apply declared limits for maximum asset/city/type concentration and minimum portfolio DSCR.
- Fail closed on empty portfolios, invalid limits, duplicate asset IDs, invalid values/NOI, missing classifications and negative debt service.
- Preserve human decision responsibility and keep `transactionAuthorized=false`.

## Verification

Regression coverage includes:

- qualified diversified portfolio;
- single-asset concentration breach;
- city concentration breach;
- asset-type concentration breach;
- DSCR breach;
- invalid limits, duplicate IDs and invalid debt service;
- a 75-case deterministic sensitivity matrix across value, NOI and debt-service shocks;
- concentration and debt-service monotonicity invariants.

This is a risk and decision-support layer. It does not approve acquisitions, disposals, financing, certified valuation conclusions, or transaction execution.