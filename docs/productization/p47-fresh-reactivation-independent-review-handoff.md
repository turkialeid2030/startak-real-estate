# P47 — Fresh Reactivation Independent Review Handoff

P47 creates the independent-review handoff for the fresh P46 reactivation cycle. It deliberately does not reuse the reviewer, review result, activation plan, owner authorization, cutover evidence or activation contract from the failed historical cycle.

## Required P46 state

P47 accepts only:

`FRESH_REACTIVATION_GOVERNANCE_CYCLE_OPEN_NOT_AUTHORIZED`

P47 re-hashes the deterministic P46 cycle core and requires the P46 authority boundary to remain intact. The current authoritative mode must remain `LEGACY_FILE_SHA256`, the requested future mode must remain `GOVERNED_COMPOSITE_BASELINE`, and no reactivation or release authority may already exist.

## Fresh reviewer designation

The P46 cycle owner must explicitly designate a reviewer for this fresh cycle. The designation binds:

- designation ID;
- P46 cycle ID and cycle hash;
- designating owner reference;
- independent reviewer reference and display name;
- designation timestamp;
- designation source reference;
- designation artifact SHA-256.

The reviewer must differ from the P46 cycle owner. The designation cannot predate the fresh-cycle opening.

The reviewer remains replaceable until a later cryptographically verified review is accepted. Any replacement requires a new designation and a newly generated P47 review packet; an earlier packet cannot silently follow the replacement.

## Explicit prior-cycle non-reuse

P47 rejects reviewer-designation inputs that attempt to carry forward old governance artifacts, including prior reviewer lock/approval, activation plan, owner authorization, cutover-safety or activation-contract hashes.

The historical cycle remains evidence only and contributes no authority to P47.

## Review packet

The deterministic P47 packet binds:

- review request ID and timestamp;
- P46 fresh-cycle ID/hash;
- owner actor;
- current legacy baseline mode and registry hash;
- requested target mode;
- exact qualified Git commit;
- release artifact SHA-256;
- environment configuration SHA-256;
- fresh-cycle evidence artifact SHA-256;
- prior P45 governance-reset hash;
- fresh reviewer designation hash;
- independent reviewer identity reference;
- a mandatory review checklist.

The checklist requires the reviewer to confirm that the previous activation cycle is historical/non-reusable, the legacy baseline is still authoritative, the exact commit/artifact/config scope is understood, owner/reviewer separation exists, and no release authority has been granted.

## Highest state

`FRESH_REACTIVATION_REVIEW_PACKET_READY_NOT_APPROVED`

This state is only a handoff. It explicitly keeps:

- reviewer identity cryptographic verification false;
- reviewer trust-root verification false;
- independent review acceptance false;
- reactivation authorization false;
- baseline mutation false;
- all release/merge/deployment/go-live/transaction authority false.

A later slice must cryptographically verify an external reviewer decision against a pinned fresh-reviewer trust registry and the exact P47 packet.

## Operator

`tools/fresh-reactivation-independent-review-handoff.js` reads bounded regular JSON, rejects symlink/unknown/duplicate/private-key arguments, and writes restrictive JSON output where supported. It performs no baseline mutation, merge or deployment.
