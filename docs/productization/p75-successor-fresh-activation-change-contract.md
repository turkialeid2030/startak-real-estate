# P75 — Successor Fresh Activation Change Contract

## Purpose

P75 converts the cryptographically re-verified P74 successor owner decision into a deterministic, **non-applied activation change contract** for the P69 schema-v4 governed-composite candidate.

It does not execute activation, mutate the canonical registry or grant release authority.

## Inputs and re-verification

P75 requires:

- exact current legacy registry object and raw bytes;
- P65 successor review packet;
- P67 reviewer lifecycle lock;
- P68 activation plan;
- P69 schema-v4 candidate;
- P71 successor shadow result;
- P72 cutover rehearsal;
- P73 safety guard;
- successor-cycle owner trust registry plus pinned registry SHA-256;
- externally signed P74 owner decision.

The P69 candidate is validated and recomputed from P68 plus the exact current registry bytes. P74 is then re-run so the owner RSA-SHA256 signature and cycle-scoped trust root are verified again rather than accepted as a boolean.

## Exact proposed and rollback states

The proposed state is the exact canonical schema-v4 registry content emitted by P69. P75 binds both its logical hash and raw-content SHA-256.

The rollback state is the **exact current legacy raw file content supplied to P75**, not a newly serialized equivalent. P75 therefore binds:

- current legacy logical registry hash;
- exact current legacy raw-content SHA-256;
- exact rollback logical registry hash;
- exact rollback raw-content SHA-256.

A successful contract requires the rollback hashes to reproduce the current authoritative legacy state exactly.

## Contract state

Highest state:

`SUCCESSOR_FRESH_ACTIVATION_CHANGE_CONTRACT_READY_OWNER_AUTH_VERIFIED_NOT_APPLIED`

The deterministic contract hash binds the successor cycle, P67/P68/P69/P73/P74 evidence, schema-v4 target, exact rollback image, trust registry and predecessor P62/P63/RCA/CAPA lineage.

## Authority boundary

Even in the highest state:

- `activationAuthorized=false`;
- `activationApplied=false`;
- `reactivationAuthorized=false`;
- `currentBaselineMutationPerformed=false`;
- release/merge/deployment/go-live/transaction authority remains false.

A successor-specific dual-mode canonical registry verifier is required next. Controlled activation execution and post-change Release Verify remain separate later gates.

## Evidence limitation

Regression coverage uses synthetic local successor-cycle evidence and an ephemeral RSA owner keypair. It proves the deterministic contract and re-verification logic only. It does not establish a real external owner approval or production activation authorization.
