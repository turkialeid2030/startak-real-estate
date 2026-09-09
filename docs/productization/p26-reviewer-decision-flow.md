# P26 Reviewer Decision Flow

`P24 proposal + owner decision` → `P25 WAITING_FOR_INDEPENDENT_REVIEW` → `P26 deterministic review packet` → `external independent reviewer` → `P26 normalized response` → `P25 re-evaluation`.

Only if P25 subsequently reaches `READY_FOR_EXPLICIT_BASELINE_ACTIVATION_CHANGE` may a separate reviewed baseline-activation change be prepared. No step in P26 itself changes the active baseline.
