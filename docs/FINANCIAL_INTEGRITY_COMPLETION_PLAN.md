# Financial Integrity — Completion Boundary

The Financial Integrity sequence is finite. It is complete when the following layers are merged and independently release-verified:

1. P4 Governed dated DCF — merged.
2. P5 Workflow reconciliation and transaction-cost boundaries — merged.
3. P6 Golden validation and deterministic stress — awaiting merge after successful checks.
4. P7 Seeded reproducible Monte Carlo risk — stacked, must pass release verification.
5. P8 HBU / residual maximum land bid — stacked, must pass release verification.
6. P9 Portfolio decision cockpit — stacked, must pass release verification.

No P10 feature wave is authorized by this completion plan. After P9, work changes from feature creation to qualification and closure only:

- Merge P6 after required checks.
- Retarget P7 to main, verify, merge.
- Retarget P8 to main, verify, merge.
- Retarget P9 to main, verify, merge.
- Run final post-merge canonical verification on main.
- Record any external/manual validation dependencies as explicit operational gates rather than inventing further engineering waves.

Known boundary: P7 currently exposes an approximate terminal-wealth annualized return statistic. Exact dated IRR/XIRR must not be claimed until separately implemented and independently validated. This known limitation is a closure item if exact IRR is required for production decisioning.