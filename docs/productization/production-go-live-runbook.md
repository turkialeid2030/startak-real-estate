# Production Go-Live Runbook

## Purpose

This is the canonical **read-only production execution/runbook interface** for the final E2F → E2G → E2H → E2I chain. It does not perform any production mutation. Its purpose is to make the next permitted step explicit, bind every downstream stage to independently pinned upstream packet hashes, and prevent a self-consistent but locally re-hashed packet from being treated as trusted production provenance.

## Critical provenance rule

The existing stage `verify*PacketIntegrity()` functions prove that a packet is internally hash-consistent. A self-hash alone is **not an independent trust root** because a modified packet can be re-hashed by the party presenting it.

Therefore this runbook requires an independently supplied SHA-256 pin for every supplied production packet:

- E2F validation packet hash;
- E2G human decision packet hash;
- E2H execution closeout packet hash;
- E2I readiness packet hash.

A packet whose internal hash is valid but does not equal its independent pin is rejected as `HOLD_PRODUCTION_CHAIN_PROVENANCE_PIN` before the next operational step is prepared.

The independent pin must come from a trust path separate from the JSON packet being evaluated—for example an approved immutable evidence ledger, controlled release record, independently retained artifact manifest, or equivalent governed source. Supplying a packet and a hash computed from that same packet in the same untrusted step does not create independent provenance.

## Stage sequence

The runbook enforces this order:

1. **E2F real production validation** — external conformance authenticity plus production security, performance and resilience evidence.
2. **E2G human authority decisions** — separate cryptographically signed release, merge and deployment approvals.
3. **External execution** — the runbook does not execute it. A human/operator performs only the exact authorized merge and deployment through the approved provider path.
4. **E2H execution closeout** — signed merge execution, deployment execution, post-deployment smoke and rollback-readiness attestations.
5. **E2I final external readiness evidence** — the six real readiness evidence classes.
6. **Readiness confirmation** — `GO_LIVE_READINESS_CONFIRMED_UNLICENSED_DECISION_SUPPORT` means the E2I readiness packet is pinned, integrity-valid and reports the approved operating mode. It still does not cause this runbook to expose the system, authorize professional valuation issuance, or authorize transactions.

## Status evaluator

```text
node tools/production-go-live-runbook.js status \
  --e2f e2f.json --e2f-pin <PINNED_E2F_SHA256> \
  --e2g e2g.json --e2g-pin <PINNED_E2G_SHA256> \
  --e2h e2h.json --e2h-pin <PINNED_E2H_SHA256> \
  --e2i e2i.json --e2i-pin <PINNED_E2I_SHA256> \
  --out runbook-status.json
```

Later-stage files are optional until they exist. Stage gaps are fail-closed. Every supplied packet requires its pin.

The status evaluator also requires the exact release candidate to remain unchanged across E2F, E2G, E2H and E2I. Commit, artifact, environment and environment configuration therefore cannot silently drift between stages.

## Pinned signing-request interfaces

For production operations, use these runbook modes rather than presenting an unpinned upstream packet directly to the lower-level intake tools.

### E2G decision signing request

```text
node tools/production-go-live-runbook.js e2g \
  --policy governance/e2g-human-release-authority-deployment-decision-policy-2026-09-08.json \
  --upstream e2f-production-validation.json \
  --upstream-pin <INDEPENDENTLY_PINNED_E2F_PACKET_SHA256> \
  --registry release-authority-registry.json \
  --registry-pin <OUT_OF_BAND_RELEASE_AUTHORITY_REGISTRY_SHA256> \
  --decision unsigned-release-decision.json \
  --out e2g-signing-request.json
```

### E2H attestation signing request

```text
node tools/production-go-live-runbook.js e2h \
  --policy governance/e2h-execution-attestation-post-deployment-closeout-policy-2026-09-08.json \
  --upstream e2g-human-release-decision-packet.json \
  --upstream-pin <INDEPENDENTLY_PINNED_E2G_PACKET_SHA256> \
  --registry execution-attestor-registry.json \
  --registry-pin <OUT_OF_BAND_EXECUTION_ATTESTOR_REGISTRY_SHA256> \
  --attestation unsigned-execution-attestation.json \
  --out e2h-signing-request.json
```

### E2I readiness-evidence signing request

```text
node tools/production-go-live-runbook.js e2i \
  --policy governance/e2i-production-evidence-go-live-readiness-policy-2026-09-08.json \
  --upstream e2h-production-closeout.json \
  --upstream-pin <INDEPENDENTLY_PINNED_E2H_PACKET_SHA256> \
  --registry readiness-verifier-registry.json \
  --registry-pin <OUT_OF_BAND_READINESS_VERIFIER_REGISTRY_SHA256> \
  --evidence unsigned-readiness-evidence.json \
  --out e2i-signing-request.json
```

The runbook verifies the upstream packet pin **before** invoking the lower-level intake. Private keys are never accepted by the lower-level intake packages and no signatures are created by the runbook.

## Runbook outputs

The evaluator records:

- last verified stage;
- exact release candidate and deterministic candidate hash;
- verified packet pins;
- observed upstream authorization/execution/readiness flags;
- missing E2I evidence types when applicable;
- next required external or human action;
- `productionMutationPerformed=false`;
- all runbook authority flags false.

## Operational interpretation

`READY_FOR_AUTHORIZED_EXECUTION_SEQUENCE` means valid pinned E2F and E2G evidence exists and the E2G packet records the required human approvals. It does **not** mean this runbook may merge or deploy.

`GO_LIVE_READINESS_CONFIRMED_UNLICENSED_DECISION_SUPPORT` means the complete pinned chain reaches an E2I packet whose status is `GO_LIVE_READY_FOR_UNLICENSED_DECISION_SUPPORT`. It does not establish accredited valuation authority, Saudi professional licensing, external professional valuation issuance, regulatory approval, or transaction authority.

## Test limitation

Regression tests deliberately construct synthetic self-hashed packets to test the state machine. They also prove that a different independently supplied pin blocks a re-hashed synthetic packet. Those fixtures are not real production evidence and must never be represented as such.

## Safety boundary

The runbook never calls the GitHub merge API, deployment APIs, Cloudflare, workflow-dispatch endpoints, canonical-registry mutation paths, rollback actions, transaction systems or signing keys. It is an evidence/provenance state evaluator and signing-request guard only.
