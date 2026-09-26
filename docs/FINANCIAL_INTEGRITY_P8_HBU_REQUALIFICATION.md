# Financial Integrity P8 — Fresh Main Requalification

This branch reintroduces the governed Highest and Best Use (HBU) / Maximum Land Bid capability directly on the current `main` base after P7.

## Scope

- Legal permissibility and physical possibility are hard gates.
- Evidence completeness is fail-closed.
- Financial feasibility uses declared GDV, hard cost, soft cost, finance cost, contingency, selling cost and required developer margin.
- Acquisition costs are loaded separately from development costs.
- Maximum land bid is reported in SAR and SAR/m².
- Non-positive residuals are not selected as a recommended use.
- Outputs never authorize a transaction and always preserve human decision responsibility.

## Verification

Regression coverage includes:

- missing evidence;
- invalid land area, developer margin and acquisition-cost rates;
- illegal / physically invalid alternatives;
- duplicate IDs and missing gate evidence;
- negative cost and zero-GDV rejection;
- infeasible downside cases;
- a 75-case sensitivity matrix across GDV, cost and margin shocks;
- monotonicity checks proving that higher acquisition load, developer margin, or hard costs cannot increase the maximum land bid.

The purpose of this branch is to obtain a fresh CI qualification directly against the active `main` lineage and avoid relying on stale stacked-PR status contexts.