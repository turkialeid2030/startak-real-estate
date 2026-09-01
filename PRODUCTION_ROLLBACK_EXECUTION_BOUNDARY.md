# Production Rollback Execution Evidence v1 — Claim Boundary

This layer records caller-supplied evidence for a rollback that follows an explicit human `REQUIRE_ROLLBACK` outcome.

It accepts a rollback requirement originating from either:
- a post-deployment human review; or
- a production-service continuity decision.

The layer requires:
- exact case/project scope;
- a valid human rollback decision;
- an approved rollback plan with accountable operator and evidence;
- distinct current and target release identities;
- exact binding of the executed target to the approved target release;
- timezone-explicit execution timing after the human decision;
- post-rollback health, smoke, and real-browser verification with zero fatal/page errors;
- observation of the exact target build ID and full source commit;
- a complete evidence-reference chain.

The positive state is `EVIDENCE_PACK_COMPLETE` and only makes the record eligible for accountable human rollback review.

It does **not** independently attest that an external rollback occurred, authorize production use, certify production security, establish legal/regulatory approval, establish a certified valuation, or authorize an investment transaction.
