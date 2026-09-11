# P21 — Canonical Source Evidence Hardening

## Purpose

P21 corrects an evidence-semantics defect in the canonical release verifier: when the external canonical source file was absent, the canonical-source step logged a skip but the generic step wrapper still printed `PASS`. That made an unevaluated external comparison look stronger than it was.

P21 does not supply or fabricate the external canonical source. It changes the engineering contract so absence is represented truthfully and a stricter external-evidence run can fail closed.

## Implemented

### Canonical evidence evaluator

`tools/canonical-source-evidence.js` provides a small deterministic evaluator with four states:

- `VERIFIED` — a supplied file exists and its SHA-256 equals the pinned expected canonical digest.
- `NOT_EVALUATED` — no usable external source was supplied and strict evidence is not required for this engineering run.
- `MISSING_REQUIRED` — strict mode requires the external source but it is absent or unavailable.
- `MISMATCH` — a supplied source was hashed and did not match the pinned digest.

The evaluator does not return the raw external file path.

### Release verifier semantics

`tools/release-verify.js` now:

- prints `CANONICAL_SOURCE_HASH_VERIFICATION: NOT_EVALUATED` when the external source is absent in ordinary engineering CI;
- preserves `RELEASE_VERIFY_RESULT=PASS` for engineering checks when the external source is not required;
- fails closed when `REQUIRE_CANONICAL_SOURCE_HASH=1` and `CANONICAL_ORIGINAL_PATH` is missing/unavailable;
- fails closed on any supplied-source hash mismatch;
- prints `PASS` for the canonical-source step only after an actual matching hash comparison.

This intentionally separates **engineering verification** from **external canonical-source evidence**.

## Regression coverage

`tests/runtime/run_canonical_source_evidence_semantics_tests.js` covers:

- optional missing evidence -> `NOT_EVALUATED`;
- strict missing evidence -> `MISSING_REQUIRED`;
- verified supplied fixture;
- mismatch detection;
- invalid expected digest rejection;
- path minimization / no raw path propagation.

## External evidence boundary

P21 does **not** close `CANONICAL_EXTERNAL_SOURCE_HASH_COMPARISON`. That blocker can close only when the actual external canonical source is supplied to a controlled strict run and matches the pinned digest.

It also does not establish production security, legal/PDPL/professional approval, reviewer authority, release, merge, deployment, go-live, or transaction authority.

Authority remains fail-closed:

- `releaseAuthorized=false`
- `mergeAuthorized=false`
- `deploymentAuthorized=false`
- `goLiveAuthorized=false`
- `transactionAuthorized=false`

The practical next action for this blocker is to run the verifier in an authorized evidence environment with both `CANONICAL_ORIGINAL_PATH` and `REQUIRE_CANONICAL_SOURCE_HASH=1` set to the externally controlled source artifact.
