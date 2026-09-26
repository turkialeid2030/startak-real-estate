# Financial Integrity P9 — Portfolio Decision Cockpit

P9 aggregates asset-level values, NOI and debt service into portfolio diagnostics while preserving human investment authority.

Controls:
- Maximum single-asset concentration.
- Maximum city concentration.
- Maximum asset-type concentration.
- Minimum portfolio DSCR.
- Invalid asset records fail closed.
- Breaches produce REVIEW_REQUIRED, not automatic disposal or rejection.
- The cockpit never authorizes investment or transaction execution.

This layer is deliberately diagnostic. Investment Committee approval, delegated authorities, conflicts, legal due diligence and transaction execution remain separately governed controls.