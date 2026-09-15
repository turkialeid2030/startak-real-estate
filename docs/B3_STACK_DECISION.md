# B-3 Stack Decision Record

Date: 2026-09-07

## Qualified inputs

### Wave A — PR #125

Qualified head:

`13c75790bce0f445e04b47b161e90e84e42a4a21`

Verified candidate gates at that head included:

- Deep Platform Verify: PASS
- Release Verify: PASS
- Comprehensive Verify: PASS

### Wave B2 — PR #126

Qualified head:

`146f4929a2f7893cb7f82db045a4a88d6184dc7e`

Verified candidate gates at that head included:

- Zakat Layer Verify: PASS
- Release Verify: PASS

Wave B2 remains stacked on Wave A and preserves the contract that STARTAK does not calculate statutory Zakat; optional Zakat information remains user-entered post-NOI metadata with mandatory provenance.

## B-3 decision

**CONTINUE ENGINEERING AS A STACKED, NON-PRODUCTION LINEAGE.**

Wave 7A is based directly on the exact qualified Wave B2 head rather than merging the stack into `main`.

Rationale:

1. preserves exact qualified lineage;
2. avoids an implicit production deployment through `main`;
3. keeps Wave A and Wave B2 isolated and reviewable;
4. allows standards architecture work to proceed without weakening existing no-merge/no-deploy governance;
5. provides a clean decision point before eventual stack landing.

## Landing boundary

This record does not authorize:

- merging PR #125;
- merging PR #126;
- merging Wave 7A;
- production deployment;
- external commercial launch.

Before landing the stack, re-run canonical qualification against the final landing topology and verify that no branch-retargeting or merge changes alter the qualified behavior.

## Next engineering step

Wave 7A — Standards Foundation:

- canonical Standards Registry schema;
- lifecycle state machine;
- DRAFT/FUTURE production exclusion;
- governed FUTURE→ACTIVE activation;
- historical standards snapshot;
- standards freshness warning;
- StandardRule traceability foundation;
- permanent architecture regression coverage.
