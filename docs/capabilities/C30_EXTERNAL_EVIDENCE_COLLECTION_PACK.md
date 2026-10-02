# C30 External Evidence Collection Pack

## Purpose

This pack operationalizes the eight external evidence gates required to move C30 out of `HOLD` without manufacturing, inferring, or self-approving external evidence.

The current qualified engineering successor is:

`2f066168f6cdca672d668ff5367ab250fe5cb907`

The collection tooling is administrative/governance support only. It does not itself become an external approval and it does not grant merge, deploy, Public AI, transaction, approval, or commercial go-live authority.

## Source tracker

Master tracker: GitHub Issue #541.

Per-gate trackers:

| Evidence gate | Issue | Current state |
|---|---:|---|
| `SECURITY_REVIEW_AUTHORIZATION` | #545 | `NOT_SUPPLIED` |
| `PRIVACY_REVIEW_AUTHORIZATION` | #546 | `NOT_SUPPLIED` |
| `AI_PROVIDER_PRODUCTION_AUTHORIZATION` | #547 | `NOT_SUPPLIED` |
| `SOURCE_RIGHTS_AUTHORIZATION` | #548 | `NOT_SUPPLIED` |
| `UAT_HUMAN_APPROVAL` | #549 | `NOT_SUPPLIED` |
| `HISTORICAL_REPLAY_EVIDENCE` | #550 | `NOT_SUPPLIED` |
| `ROLLBACK_OPERATIONAL_VERIFICATION` | #551 | `NOT_SUPPLIED` |
| `LEGAL_REGULATORY_APPROVAL` | #552 | `NOT_SUPPLIED` |

## Evidence intake contract

The canonical template is:

`release/evidence/c30-external-evidence-manifest.template.json`

Each gate record must include the exact candidate SHA and one of these statuses:

- `SUPPLIED_VERIFIED`
- `NOT_SUPPLIED`
- `REJECTED`

When supplied, the record must contain:

- `evidenceRef`
- `evidenceHashSha256`
- `verifiedByRef`
- `verifiedAt`
- optional `validUntil`

A `NOT_SUPPLIED` record must not contain fabricated evidence reference, artifact hash, verifier, verification time, or validity window.

## Validator

Run:

```bash
C30_EXTERNAL_EXPECTED_CANDIDATE_SHA=2f066168f6cdca672d668ff5367ab250fe5cb907 \
node tools/c30-external-evidence-intake.js release/evidence/c30-external-evidence-manifest.template.json
```

The validator enforces:

1. all eight required gate IDs are present exactly once;
2. no unknown or duplicate gate exists;
3. manifest and item candidate heads match;
4. the candidate head can be pinned externally through `C30_EXTERNAL_EXPECTED_CANDIDATE_SHA`;
5. existing C30 evidence-item validation is reused for hash/reference/verifier/time semantics;
6. `REJECTED` drives `NO_GO` effect;
7. any `NOT_SUPPLIED` drives `HOLD` effect;
8. eight supplied-and-verified records produce only `EVIDENCE_COMPLETE_PENDING_RELEASE_REEVALUATION` — never automatic `GO`;
9. all authority flags remain false.

## Separation of duties

- **Responsible:** domain owner prepares the real evidence artifact.
- **Accountable:** authorized independent reviewer accepts or rejects it.
- **Consulted:** engineering supplies exact build/SHA/context and technical facts.
- **Informed:** release owner/governance committee receives the evidence pack.

Engineering must not convert CI, self-tests, synthetic fixtures, or AI-generated documents into an external authorization.

## Artifact handling procedure

For each gate:

1. obtain the real artifact from the accountable owner;
2. verify that its scope identifies the exact qualified release/product scope;
3. calculate SHA-256 on the actual artifact bytes;
4. retain an immutable/durable evidence reference;
5. record reviewer identity/reference and timestamp;
6. record any validity/expiry;
7. set the gate to `SUPPLIED_VERIFIED` only after independent acceptance;
8. set the gate to `REJECTED` when an accountable reviewer rejects the required evidence;
9. keep it `NOT_SUPPLIED` when the artifact does not exist or has not been independently accepted;
10. rerun the intake validator;
11. only after all eight are verified, rebuild the governed C30 release-candidate evidence pack and re-evaluate `GO/HOLD/NO_GO` separately.

## Invalid substitutes

The following are not external approval evidence by themselves:

- GitHub Actions success;
- `npm audit` result;
- Chromium/Playwright E2E;
- synthetic historical replay;
- AI-generated security/privacy/legal memoranda;
- engineering self-attestation;
- generic policy documents not bound to the exact release;
- a working API key without production-provider authorization;
- a rollback plan that has not actually been executed in a controlled environment.

## Current decision boundary

Until the eight real external gates are independently supplied and verified:

- `C30 = HOLD`
- `MERGE HOLD = ON`
- `DEPLOY = NO`
- `COMMERCIAL_GO_LIVE = HOLD`
- `TRANSACTION_AUTHORITY = FALSE`
- `APPROVAL_AUTHORIZED = FALSE`
- `PUBLIC_AI = FALSE`
- `PRODUCTION_DEPLOYMENT_AUTHORIZED = FALSE`

Even evidence completeness does not itself change these authority states. A separate governed release decision is required.
