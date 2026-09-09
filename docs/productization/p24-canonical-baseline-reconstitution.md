# P24 — Governed Canonical Baseline Reconstitution

## Context

The historical canonical-original file required by the legacy SHA-256 comparison is not available to the repository owner. The legacy pinned digest remains:

`ac0767d3f13c463259f401a5d7af06c1140ee780a9f86489eb17ad9d7c72dc71`

Absence of the original bytes must not be converted into a fabricated verification and must not permanently masquerade as a successful comparison.

## P24 decision

P24 introduces a governed reconstitution proposal rather than pretending the historical file can still be verified.

The proposed successor baseline is bound to:

- an exact qualified Git commit SHA;
- a release-artifact SHA-256;
- an environment-configuration SHA-256;
- a named proposer;
- a separate independent reviewer;
- a deterministic proposal hash.

This changes **nothing automatically**. The active legacy baseline is not altered by creating the proposal.

## Required governance before any successor baseline can activate

1. authoritative owner approval;
2. independent review approval by a different person;
3. explicit governance decision that the unavailable historical file baseline is being superseded rather than verified;
4. an explicit reviewed code change that activates the successor baseline semantics;
5. complete post-change release verification;
6. corresponding E2I policy/evidence update if the canonical evidence contract is changed.

## Explicit non-claims

P24 does not:

- prove the legacy canonical file hash;
- close the existing legacy canonical-source blocker;
- alter `EXPECTED_CANONICAL_SHA256`;
- satisfy E2I `CANONICAL_SOURCE_HASH_COMPARISON`;
- grant release, merge, deployment, go-live, professional, or transaction authority.

Until the human governance steps above occur, the correct state is:

`LEGACY_CANONICAL_SOURCE_UNAVAILABLE_REBASELINE_REQUIRED`

The proposal maximum state is:

`READY_FOR_HUMAN_REBASELINE_GOVERNANCE`
