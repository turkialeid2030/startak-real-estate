# Financial Integrity P8 — HBU and Maximum Land Bid

P8 evaluates alternative development uses through legal, physical and financial gates before ranking feasible alternatives by residual maximum land bid.

Controls:
- Legal permissibility and physical possibility are explicit gates.
- Financial feasibility uses declared GDV, hard cost, soft cost, finance cost, contingency, selling cost and required developer margin.
- Acquisition-cost loading is separated from development costs.
- Evidence completeness is mandatory and fail-closed.
- Alternative identifiers must be non-empty and unique.
- GDV must be positive and declared development cost fields must be non-negative.
- Maximum land bid is reported in SAR and SAR/sqm.
- A residual maximum land bid is not labelled market value and never authorizes an offer or transaction.

The engine is intentionally conservative: alternatives failing legal/physical gates are not ranked; invalid or ambiguous inputs HOLD the analysis; absence of a financially feasible alternative requires review rather than selecting a negative residual.
