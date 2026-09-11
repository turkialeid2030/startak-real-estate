# P26 Independent Review Operator Checklist

1. Confirm the P24 proposal identifies a reviewer distinct from the owner/proposer.
2. Export the qualified P24 proposal JSON and the owner-decision JSON from the governed evidence process.
3. Generate the deterministic review packet with `tools/prepare-canonical-rebaseline-review-packet.js`.
4. Provide the packet to the named independent reviewer outside automated CI.
5. Reviewer must review the exact proposal hash, commit SHA, release-artifact SHA-256 and environment-config SHA-256.
6. Reviewer must explicitly understand that the legacy canonical original is unavailable and is **not** being retrospectively verified.
7. Reviewer records APPROVE, REJECT or HOLD with an auditable decision source and artifact SHA-256.
8. Normalize the response through P26 and submit it back to P25 for re-evaluation.
9. Do not activate a new baseline unless P25 reaches `READY_FOR_EXPLICIT_BASELINE_ACTIVATION_CHANGE` and a separate reviewed activation change is approved.
10. Do not interpret P26, CI PASS, issue comments or test fixtures as release, merge, deployment, go-live, professional or transaction authority.
