# P62 — Fresh Post-Rollback Verification & Incident Closeout Gate

P62 verifies the **fresh-cycle rollback path** after P61 emits a deterministic rollback trigger and P60 applies the exact P57-prebound legacy rollback image. It then evaluates post-rollback Release Verify evidence and, only when restoration and evidence are consistent, prepares a deterministic packet for separate human incident closeout.

P62 does not close an incident automatically, does not allow reactivation, and grants no release, merge, deployment, go-live, or transaction authority.

## Required chain

P62 requires the exact P57 activation-change contract, the original applied P60 activation receipt, the P61 rollback decision/trigger, and an applied P60 rollback receipt.

The P61 trigger is re-hashed and must remain bound to:

- the original P60 activation execution receipt;
- the P57 fresh activation-change contract;
- the same fresh governance cycle;
- the exact P57 legacy rollback logical/content hashes;
- the original normalized rollback reason codes.

The P60 rollback receipt must be non-dry-run, mutation-applied, post-write P58-verified, and bound to the same P57 contract/cycle/reviewer lock/activation plan/owner authorization/trust root. Its prior state must be the P57 schema-v3 target and its target plus observed state must be the exact P57 legacy rollback image. P62 recomputes the P60 receipt hash.

## Exact legacy restoration

P62 requires the observed post-rollback registry object and exact raw bytes. It verifies:

- P58 legacy verification succeeds;
- logical registry hash equals `rollbackRegistryHashSha256` from P57;
- raw-content hash equals `rollbackRegistryContentSha256` from P57;
- raw content exactly equals the P57 rollback content;
- logical object identity exactly equals the P57 rollback registry.

Any restoration mismatch yields:

`FRESH_POST_ROLLBACK_VERIFICATION_FAILED_INCIDENT_OPEN`

The incident remains open and the failed fresh activation cycle cannot be reused.

## Post-rollback Release Verify evidence

P62 uses a dedicated schema-v1 legacy Release Verify evidence record. A successful consistency result requires:

- Release Verify, regression, production build, package verification, npm-audit threshold, and canonical-registry gate all `PASS`;
- `activeMode=LEGACY_FILE_SHA256`;
- `registrySchemaVersion=1`;
- `verificationMode=LEGACY_STRICT`;
- registry logical/content hashes equal the exact restored legacy state;
- evidence source commit equals an explicit caller-pinned `expectedReleaseVerifyCommitSha`;
- completion time is not earlier than the P60 rollback execution.

The explicit expected commit is treated as a supplied trust input, not independently authenticated by P62. `releaseVerifyEvidenceAuthenticityVerifiedHere=false` and `productionEvidenceEstablishedHere=false` therefore remain explicit.

Missing post-rollback Release Verify evidence produces a fail-closed HOLD and never makes the incident closeout-ready.

## Incident closeout packet

After exact restoration and consistent Release Verify evidence, P62 returns:

`FRESH_POST_ROLLBACK_RELEASE_VERIFY_EVIDENCE_CONSISTENT_INCIDENT_CLOSEOUT_READY`

The deterministic packet binds:

- incident ID/reference and preparer/timestamp;
- fresh governance cycle ID/hash;
- P57 activation-change contract hash;
- original P60 activation receipt hash;
- P61 rollback trigger hash;
- P60 rollback receipt hash;
- restored legacy registry logical/content hashes;
- post-rollback Release Verify evidence hash/run/commit/timestamp;
- the P61 rollback reason codes.

The packet explicitly records `incidentClosed=false`, `humanIncidentCloseoutRequired=true`, `automaticIncidentCloseoutPerformed=false`, `failedFreshActivationCycleReusable=false`, `reactivationAllowed=false`, `reactivationRequiresNewGovernanceCycle=true`, and `releaseStillBlocked=true`.

## Operator

`tools/fresh-post-rollback-verification-incident-closeout.js` reads bounded regular JSON files, preserves the exact observed registry bytes, rejects symlinks and private/secret signing-key arguments, and emits deterministic P62 output only. It performs no registry mutation.

## Governance boundary

P62 proves evidence consistency only. It does not authenticate the external Release Verify provider, does not close the incident, does not authorize reuse of the failed cycle, and does not grant operational authority. A separate human incident-closeout decision is required before any future fresh governance cycle can be considered.
