# C30 Release Candidate Freeze and GO/HOLD/NO-GO Evidence Pack

## Purpose

C30 is the final engineering release-candidate evidence gate above the qualified C29 chain and the qualified integrated-review UI closure. It freezes one candidate Git commit, records its dependency chain and technical qualification evidence, exposes every required external evidence slot, and returns a deterministic `GO`, `HOLD`, or `NO_GO` readiness decision.

A technically qualified release candidate is not production authorization. C30 never merges, deploys, activates a canonical baseline, authorizes transactions, authorizes investment approval, enables Public AI, or changes commercial go-live from `HOLD`.

## Exact dependency chain

The C30 contract requires an explicit qualification record for every upstream stage:

1. C22 generative orchestration;
2. C23 AI provider gateway and proof grounding;
3. C24 integrated case/property orchestration;
4. C25 source readiness;
5. C26 governed operator workspace;
6. C27 observability and operational safety;
7. C28 comprehensive integration qualification;
8. C29 shadow simulation and UAT harness;
9. the integrated case-review UI closure.

Each upstream record carries its Git SHA, qualification state and evidence hash. Git commit SHAs and SHA-256 evidence hashes remain separate domains.

## Required technical gates

C30 requires records for:

- C29 shadow simulation;
- integrated case-review UI;
- C28 comprehensive integration;
- C23 AI proof grounding;
- production build;
- package verification;
- dependency audit;
- canonical release verification;
- repository Release Verify.

Every technical record is exact-bound to the C30 candidate Git SHA. A failed or tampered technical record produces `NO_GO`. A missing or `NOT_EVALUATED` technical record produces `HOLD`.

## Required external evidence

The following are deliberately modeled as real external evidence slots and are never synthesized by C30:

- `SECURITY_REVIEW_AUTHORIZATION`
- `PRIVACY_REVIEW_AUTHORIZATION`
- `AI_PROVIDER_PRODUCTION_AUTHORIZATION`
- `SOURCE_RIGHTS_AUTHORIZATION`
- `UAT_HUMAN_APPROVAL`
- `HISTORICAL_REPLAY_EVIDENCE`
- `ROLLBACK_OPERATIONAL_VERIFICATION`
- `LEGAL_REGULATORY_APPROVAL`

`NOT_SUPPLIED` records must contain a reason and are forbidden from carrying an evidence reference, evidence hash, verifier or verification timestamp. This prevents a missing external review from being represented as fabricated evidence.

The unit regression includes synthetic fixtures solely to prove the `GO` and `NO_GO` branches of the deterministic gate. Those fixtures are test data and do not constitute release evidence. The actual modeled C30 posture remains `HOLD` until real external evidence is supplied and independently verified.

## Decision semantics

### GO

Returned only when all required upstream qualifications and technical gates are valid and passing, all required external evidence items are supplied and verified, and no open blocker exists.

`GO` means the evidence pack is complete enough for a separate authorized activation decision. It still does **not** set deployment or go-live authority.

### HOLD

Returned when a required technical item is missing or not evaluated, an external evidence item is not supplied or expired, or a declared non-fatal blocker remains open.

### NO_GO

Returned when a technical/upstream qualification fails, an external review is rejected, evidence integrity is broken, candidate-head binding is wrong, a duplicate corrupts the register, or future-dated evidence is used relative to the freeze time.

## Registers

The output includes:

- exact release-candidate Git SHA;
- dependency-chain manifest and manifest SHA-256;
- technical gate evidence hashes;
- external evidence hashes;
- unresolved blocker register;
- `NOT_EVALUATED` / `NOT_SUPPLIED` register;
- immutable release-candidate pack SHA-256.

## Qualification workflow

The exact-head C30 workflow runs:

1. exact candidate-head assertion;
2. C30 GO/HOLD/NO-GO regression with the actual Git head injected as `C30_EXPECTED_HEAD_SHA`;
3. integrated review UI regression;
4. C29 shadow/UAT regression;
5. C28 integration regression;
6. C23 AI proof-grounding regression;
7. production build;
8. package verification;
9. dependency audit;
10. canonical release verification.

Repository `Release Verify` also runs independently on the pull request head and performs full regression discovery.

## Authority boundary

The C30 output always preserves:

- `MERGE HOLD = ON`
- `DEPLOY = NO`
- `COMMERCIAL_GO_LIVE = HOLD`
- `TRANSACTION_AUTHORITY = FALSE`
- `APPROVAL_AUTHORIZED = FALSE`
- `PUBLIC_AI = FALSE`
- `PRODUCTION_DEPLOYMENT_AUTHORIZED = FALSE`
- `CANONICAL_BASELINE_ACTIVATION_AUTHORIZED = FALSE`
- `ACTIVATION_AUTHORIZED = FALSE`
