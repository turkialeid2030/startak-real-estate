# Production Derived-State Integrity Hardening

## Purpose

Harden the final production-readiness chain against a field-level authority/readiness escalation that is not detected by the existing structural packet-hash verifiers alone.

The existing E2F/E2G/E2H/E2I `verify*PacketIntegrity()` functions recompute SHA-256 from each packet's immutable/core payload fields. They prove that the core is internally hash-consistent, but the derived fields returned beside that core are not themselves part of the packet hash. Those derived fields include status/readiness/authorization/execution booleans such as:

- E2F production-validation completion flags;
- E2G release/merge/deployment authorization flags;
- E2H merge/deployment/smoke/rollback completion flags;
- E2I `goLiveReady`, readiness status and operating-mode boundary fields.

Therefore a copied packet could retain the same valid core hash while a presenter changes only a derived field. Independent packet SHA-256 pinning remains necessary, but a pin over the current core hash alone does not detect a derived-only mutation because the hash value itself does not change.

## Hardening model

`src/qualification/production-stage-derived-state-integrity.js` recomputes the expected derived state from the records that are actually covered by each packet hash and verifies that all mutable derived fields exactly match that recomputed state.

### E2F

The strict check derives validation progress from the hashed validation records and requires exact consistency for:

- status;
- external-conformance/security/performance/resilience flags;
- production-validation completion;
- human release-authority requirement;
- all professional/release/deployment/transaction boundary flags remaining false.

Rejected or duplicate validation records cannot be represented as a normal hashed non-hold packet.

### E2G

The strict check derives human approval progress from the hashed decision records and requires exact consistency for:

- status;
- release/merge/deployment authorization flags;
- merge/deployment execution remaining false;
- post-decision attestation requirement;
- professional and transaction boundary flags remaining false.

Only the governed factory's non-hold approval-state semantics are accepted.

### E2H

The strict check derives execution state from the hashed attestation records and verifies:

- merge before deployment;
- exact merge-commit continuity into deployment;
- smoke and rollback-readiness binding to the verified deployment ID;
- status and all execution booleans;
- release/merge/deployment authorization still present from the upstream decision boundary;
- professional/transaction authority remaining false.

### E2I

The strict check derives readiness from the six hashed E2I evidence classes and verifies:

- unique evidence IDs and evidence types;
- no rejected record in a normal hashed packet;
- exact missing-evidence set;
- exact `goLiveReady` and readiness status;
- `UNLICENSED_DECISION_SUPPORT` operating mode;
- architectural-stop and no-internal-substitute flags;
- professional, licensing, external professional issuance and transaction authority remaining false.

## Strict runbook

`src/qualification/production-go-live-runbook-strict.js` wraps the existing pinned production runbook and adds derived-state validation before any stage can drive the next step.

Production operators should use:

```text
node tools/production-go-live-runbook-strict.js ...
```

rather than relying on structural packet-hash verification alone.

The strict runbook preserves all existing controls:

- independent packet SHA-256 pins;
- exact E2F→E2G→E2H→E2I packet linking;
- exact release-candidate continuity;
- no private-key handling;
- no merge/deployment/Cloudflare/workflow-dispatch action;
- no go-live or transaction authority.

It adds one further fail-closed condition:

`HOLD_PRODUCTION_CHAIN_INTEGRITY` with `<STAGE>_DERIVED_STATE_INTEGRITY_INVALID` whenever a packet's mutable derived state is inconsistent with its hashed records.

## Regression proof

The runtime regression includes adversarial cases that deliberately:

1. create a structurally hash-valid waiting E2F packet and flip only completion/status booleans;
2. create a structurally hash-valid waiting E2G packet and flip only authorization/status fields;
3. create a structurally hash-valid waiting E2H packet and flip only execution/status fields;
4. create a structurally hash-valid incomplete E2I packet and flip only `goLiveReady`, status and missing-evidence fields.

The legacy structural hash verifier still reports those cores as hash-consistent, demonstrating why the additional derived-state check is required. The strict verifier rejects every escalation.

The regression also proves that a fully state-consistent, independently pinned synthetic chain can still traverse the read-only runbook to `GO_LIVE_READINESS_CONFIRMED_UNLICENSED_DECISION_SUPPORT`, while the runbook's own go-live authority remains false.

## Evidence limitation

This hardening closes an internal integrity gap. It does not create real E2F/E2G/E2H/E2I evidence and does not reduce the external-evidence requirements already documented by the project.

Synthetic test packets remain code-path evidence only.

## Safety boundary

This change performs no merge, deployment, production workflow dispatch, Cloudflare mutation, canonical-registry mutation, owner signature, external verifier signature, rollback, go-live action or transaction.
