# P23 — External Canonical Evidence Operator

## Purpose

P23 does not add another internal approval gate. It operationalizes the already-defined P21 strict canonical-source comparison and P22 E2I signing package into one narrow operator boundary for the real external artifact.

## Operator flow

1. Provide the exact externally controlled canonical source file as local/mounted bytes.
2. Provide an allowlisted JSON context containing the existing E2I release/evidence fields.
3. Run:

```text
node tools/prepare-external-canonical-evidence.js --source <canonical-file> --context <context.json> --output <unsigned-package.json>
```

4. The operator always requires the pinned SHA-256 comparison. Missing or mismatched bytes return `HOLD_CANONICAL_SOURCE_EVIDENCE` and no signing package.
5. Only an actual match can produce `READY_FOR_EXTERNAL_READINESS_VERIFIER_SIGNATURE`.
6. The resulting package remains unsigned and must be signed by an authorized external readiness verifier outside this repository.
7. The existing E2I gate remains responsible for verifier-registry trust-root validation and final evidence acceptance.

## Safety properties

- No optional/non-strict mode exists in this operator.
- Raw external source paths are not returned.
- The CLI context is allowlisted; unknown fields such as bearer tokens, passwords or private keys are rejected.
- No private signing key is accepted or used.
- Output written to disk is created with owner-only mode where supported.
- Caller-supplied authority flags are ignored/not propagated.
- No release, merge, deployment, go-live or transaction authority is granted.

## Current evidence state

Engineering CI cannot close the canonical-source blocker because it does not receive the externally controlled source artifact. Ordinary Release Verify therefore remains `CANONICAL_SOURCE_HASH_VERIFICATION: NOT_EVALUATED`.

The blocker closes only after all of the following occur outside ordinary engineering CI:

- exact canonical bytes are supplied;
- P21 strict hash verification returns `VERIFIED` against the pinned digest;
- P23/P22 produces the exact unsigned E2I signing payload;
- an authorized external readiness verifier signs it with the approved algorithm;
- E2I verifies the signature against the out-of-band pinned verifier registry and accepts the evidence in the exact release-candidate scope.

## Authority boundary

`releaseAuthorized=false`

`mergeAuthorized=false`

`deploymentAuthorized=false`

`goLiveAuthorized=false`

`transactionAuthorized=false`
