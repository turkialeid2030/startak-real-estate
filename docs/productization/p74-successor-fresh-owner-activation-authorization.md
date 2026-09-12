# P74 — Successor Fresh Owner Activation Authorization

## Purpose

P74 prepares and verifies a **new, successor-cycle-specific external owner authorization** after the P73 successor fresh cutover safety guard. It is intentionally distinct from the predecessor P56 owner authorization path and does not itself authorize or execute registry mutation.

## Trust and scope

The owner trust registry is external input and is pinned by SHA-256. The registry is scoped to:

- purpose `SUCCESSOR_FRESH_CANONICAL_BASELINE_ACTIVATION_AUTHORIZATION`;
- the exact successor cycle id;
- a specific authority id and actor ref;
- a public RSA key whose normalized PEM bytes are SHA-256 pinned;
- an explicit active period and governance-evidence reference.

Private or secret key material is rejected recursively. Signing is performed outside the repository.

## P73 recomputation

P74 does not accept a P73 `verified=true` flag as sufficient. Before preparing or verifying owner signing bytes it re-runs P73 from:

- the exact current legacy registry object and raw bytes;
- P65 successor review packet;
- P67 reviewer lifecycle lock;
- P68 activation plan;
- P71 successor shadow result;
- P72 cutover rehearsal.

The recomputed P73 safety-guard hash must equal the supplied guard hash. The current registry logical hash and raw-content SHA-256 must remain unchanged.

## Signing payload

The deterministic RSA-SHA256 payload binds:

- successor cycle and schema-v4 target;
- P67 reviewer lifecycle lock;
- P68 activation plan and baseline manifest;
- P69 candidate logical/content identity as carried through P73;
- P70 exact-byte evidence hash;
- P71 shadow evaluation;
- P72 exact logical/raw rollback rehearsal;
- P73 safety-guard hash;
- current legacy logical/raw hashes;
- predecessor incident closeout, human decision, governance reset, RCA and CAPA hashes;
- owner authority/decision identity, evidence references and decision time.

Only `AUTHORIZE_SUCCESSOR_FRESH_CANONICAL_BASELINE_ACTIVATION` is accepted.

## States

Preparation can reach:

`READY_FOR_EXTERNAL_SUCCESSOR_FRESH_OWNER_SIGNATURE`

Cryptographic verification can reach:

`SUCCESSOR_FRESH_OWNER_ACTIVATION_AUTHORIZATION_CRYPTOGRAPHICALLY_VERIFIED_NOT_APPLIED`

The verified record also binds the SHA-256 of the actual signature bytes.

## Authority boundary

Even after a valid external signature:

- `activationAuthorized=false`;
- `activationApplied=false`;
- `reactivationAuthorized=false`;
- registry mutation remains false;
- release/merge/deployment/go-live/transaction authority remains false.

The verified decision is evidence for **P75 — Successor Fresh Activation Change Contract** only. A successor schema-v4 active-mode verifier, controlled executor and post-change Release Verify remain separately required.

## Regression evidence boundary

Regression tests use an ephemeral synthetic RSA keypair and locally generated signature. That proves the code path, deterministic signing bytes, trust-root pinning and signature verification behavior only. It is **not** evidence that a real owner signed or approved an operational activation.
