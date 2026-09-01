# Controlled Production Activation v1 — Claim Boundary

This layer closes the sequencing gap between the recorded human go-live decision and an actual production deployment.

A positive `READY_FOR_CONTROLLED_PRODUCTION_ACTIVATION` state requires:

- a scoped human go-live decision with an approval outcome;
- complete **STAGING** deployment/runtime evidence, not evidence that production was already deployed before the human decision;
- an immutable source-bound release manifest that exactly matches the staged release version and full source commit SHA;
- all conditional-approval items resolved before the planned execution time;
- an explicitly declared production target;
- an approved, timezone-explicit change window with a planned execution time after the human decision;
- a verified accountable human deployment operator and authorization-basis reference;
- a complete evidence-reference chain.

## What the state does not establish

The module does not deploy software, independently grant operator authority, prove that a production deployment occurred, certify production security, establish legal approval, establish a certified valuation, authorize production use by itself, or authorize an investment transaction.

Actual production deployment remains a human-controlled operational action. Post-deployment health, smoke, real-browser, observability, rollback/recovery, artifact identity, and live-environment evidence must be captured separately after execution.
