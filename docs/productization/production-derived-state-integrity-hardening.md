# Production Derived-State and Top-Level Contract Integrity Hardening

## Purpose

Harden the final production-readiness chain against two classes of mutation that the existing structural packet-hash verifiers do not detect by themselves:

1. mutation of derived status/readiness/authorization/execution fields that sit outside the hashed packet core; and
2. injection or alteration of unrecognized top-level claim fields or the governed packet semantics text.

The existing E2F/E2G/E2H/E2I `verify*PacketIntegrity()` functions recompute SHA-256 from each packet's immutable/core payload. They prove that the selected core is internally hash-consistent. They intentionally do not hash every returned top-level field.

Examples of non-core fields include E2F validation-completion flags, E2G authorization flags, E2H execution flags, E2I `goLiveReady`, and the operator-facing `semantics` boundary text. In addition, the structural verifiers reconstruct a known core object, so an arbitrary extra top-level property can be added without changing the legacy structural hash.

Independent packet SHA-256 pinning remains mandatory, but a pin over the current core hash cannot detect a mutation that leaves that core unchanged.

## Derived-state hardening

`src/qualification/production-stage-derived-state-integrity.js` recomputes the expected derived state from records already covered by the packet hash and requires the declared mutable state to match exactly.

### E2F

The strict check derives validation progress from hashed validation records and requires exact consistency for status, external-conformance/security/performance/resilience flags, production-validation completion, the human-release-authority requirement, and all professional/release/deployment/transaction authority boundaries.

### E2G

The strict check derives human approval progress from hashed decision records and requires exact status and release/merge/deployment authorization, while keeping merge/deployment execution false until E2H and preserving the professional/transaction boundary.

### E2H

The strict check derives execution state from hashed attestation records and verifies merge-before-deployment, merge-commit continuity, smoke/rollback binding to the deployment ID, all execution booleans, and the professional/transaction boundary.

### E2I

The strict check derives readiness from the six hashed E2I evidence classes and verifies the exact missing-evidence set, `goLiveReady`, readiness status, `UNLICENSED_DECISION_SUPPORT`, architectural-stop/no-internal-substitute flags, and the licensing/professional/transaction boundary.

## Closed top-level packet contract

`src/qualification/production-packet-top-level-contract.js` adds a second control: production packets are treated as closed top-level contracts.

For E2F, E2G, E2H and E2I it requires the exact governed top-level field set and the exact factory-produced `semantics` text. This prevents a packet with a still-valid core hash from adding claims such as an invented `goLiveAuthorized`, `officialValuation`, or similar ungoverned property, and prevents replacement of the operator-facing authority disclaimer.

A narrow compatibility exception exists only for explicitly synthetic regression policy IDs containing the `TEST` token: those historical fixtures may omit the non-authority `semantics` field, but they still cannot add any unknown top-level field. Because `policyId` is part of the hashed and independently pinned core, a real production packet cannot enter that compatibility path without invalidating provenance.

## Strict runbook

`src/qualification/production-go-live-runbook-strict.js` wraps the existing pinned production runbook. Before a packet can drive a downstream step, the strict path now requires:

- exact top-level packet contract;
- exact governed semantics text for production packets;
- deterministic derived-state integrity;
- structural packet-hash integrity;
- independent packet SHA-256 pin;
- exact E2F→E2G→E2H→E2I upstream ID/hash linkage; and
- exact release-candidate continuity.

Production operators must use:

```text
node tools/production-go-live-runbook-strict.js ...
```

The strict runbook remains read-only and does not merge, deploy, call Cloudflare, dispatch a production workflow, activate the canonical registry, sign evidence, authorize go-live, or authorize transactions.

Top-level contract failures return `HOLD_PRODUCTION_CHAIN_INTEGRITY` with `<STAGE>_TOP_LEVEL_CONTRACT_INVALID`. Derived-state failures return the same hold state with `<STAGE>_DERIVED_STATE_INTEGRITY_INVALID`.

## Regression proof

The adversarial runtime tests prove that:

1. an E2F packet can retain its legacy structural hash while only its completion/status booleans are escalated, and the strict verifier rejects it;
2. an E2G packet can retain its legacy structural hash while only authorization/status fields are escalated, and the strict verifier rejects it;
3. an E2H packet can retain its legacy structural hash while only execution/status fields are escalated, and the strict verifier rejects it;
4. an incomplete E2I packet can retain its legacy structural hash while only the genuinely derived/unhashed `status` and `goLiveReady` fields are escalated, and the strict verifier rejects it;
5. E2G and E2H signing-request wrappers fail closed before lower-level intake when their upstream derived state is forged;
6. a legitimate waiting E2F packet is still reported as waiting rather than being falsely treated as an integrity failure;
7. adding an arbitrary top-level authority claim leaves the legacy structural hash valid but fails the strict top-level contract;
8. replacing or removing production `semantics` leaves the legacy structural hash valid but fails the strict production contract; and
9. the strict CLI exits non-zero and emits an integrity hold for forged packet state.

The regression also proves that a fully state-consistent, independently pinned synthetic chain can still traverse the read-only strict runbook to `GO_LIVE_READINESS_CONFIRMED_UNLICENSED_DECISION_SUPPORT`, while the runbook's own go-live authority remains false.

## Evidence limitation

This hardening closes internal integrity and claim-injection gaps. It does not create real E2F/E2G/E2H/E2I evidence, establish verifier identity, create human signatures, prove production execution, or reduce any external-evidence requirement.

Synthetic test packets remain code-path evidence only.

## Safety boundary

This change performs no merge, deployment, production workflow dispatch, Cloudflare mutation, canonical-registry mutation, owner signature, external verifier signature, rollback, go-live action or transaction.
