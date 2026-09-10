# P44 operator usage

Use `tools/post-rollback-canonical-baseline-verification.js` only after a P43 rollback trigger and a real P42 rollback receipt exist.

The command consumes the P39 contract, original activation receipt, P43 rollback decision, P42 rollback receipt, observed registry and post-rollback Release Verify evidence. It produces verification/incident-closeout-readiness evidence only.

It never mutates the registry, closes the incident automatically, restores release authority or permits reactivation. Any future reactivation requires a new governed activation cycle.
