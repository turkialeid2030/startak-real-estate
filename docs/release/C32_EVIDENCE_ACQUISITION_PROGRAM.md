# C32 — Evidence Acquisition Program

## Purpose

C32 exists because the program currently has **13 required real evidence/input items that are not available**:

- 8 C30 external evidence items;
- 5 C31 canonical activation/source input families.

The correct response to that absence is not to fabricate evidence, downgrade gates, or infer approval from engineering tests. C32 turns the missing evidence into an explicit acquisition program with a deterministic blocker ledger.

## Current real posture

- C30 supplied/verified: **0 / 8**.
- C31 verified canonical gates: **0 / 5**.
- Total satisfied: **0 / 13**.
- Program state: `WAITING_FOR_REAL_EXTERNAL_EVIDENCE`.
- Release / merge / deploy / go-live / transaction / approval / Public AI / canonical activation authorities: **false**.

## What engineering can do without the evidence

Engineering can:

1. define the exact evidence request and acceptance boundary;
2. identify the accountable independent owner role;
3. provide a secure collection and hashing path;
4. validate metadata, exact-candidate binding and file-byte integrity;
5. execute the existing governed evaluators when real inputs are supplied;
6. produce a deterministic blocker ledger and route remediation;
7. preserve separation of duties and authority boundaries.

Engineering cannot:

- create an independent security/privacy/legal approval for itself;
- turn CI, Playwright, unit tests or synthetic fixtures into UAT;
- create historical replay evidence without approved real historical cases/data;
- claim production rollback verification from a written plan alone;
- manufacture source-rights evidence or provider production authorization;
- replace the real canonical source file with a copied hash string;
- activate the canonical baseline merely because all technical gates are green.

## 13-item operating sequence

For every item in `release/evidence/c32-evidence-acquisition-map.json`:

1. Open the linked GitHub issue.
2. Send the described `requestPackage` to the accountable `ownerRole`.
3. Receive the actual artifact/input from that owner or from the executed governed process.
4. Store it in the controlled evidence staging location outside synthetic test fixtures.
5. Record the governed metadata required by C30/C31.
6. Compute/verify SHA-256 from actual bytes where applicable.
7. Run the existing gate.
8. If the gate is `HOLD`, `MISMATCH`, or evidence is rejected, remediate and resubmit.
9. If the gate is `VERIFIED`/`SUPPLIED_VERIFIED`, retain it as evidence readiness only.
10. Do not grant release, activation or production authority until the separate independent decision is recorded.

## State model

C32 intentionally exposes only three program states:

- `WAITING_FOR_REAL_EXTERNAL_EVIDENCE` — one or more required real items remain unavailable and none is in remediation failure;
- `BLOCKED_REMEDIATION_REQUIRED` — at least one supplied/evaluated item was rejected, mismatched or held by its governed evaluator;
- `EVIDENCE_COMPLETE_AWAITING_INDEPENDENT_DECISIONS` — all 13 are satisfied, but release and activation are still not automatically authorized.

There is deliberately **no automatic GO state**.

## Source trackers

- C30 external evidence tracker: issue #541.
- C31 canonical input tracker: issue #558.
- C32 engineering/acquisition issue: #564.

The item-level issues are:

- #545 security review authorization;
- #546 privacy review authorization;
- #547 AI-provider production authorization;
- #548 source-rights authorization;
- #549 human UAT approval;
- #550 historical replay evidence;
- #551 rollback operational verification;
- #552 legal/regulatory approval;
- #559 composite baseline shadow;
- #560 fresh composite shadow;
- #561 successor fresh composite shadow;
- #562 composite cutover safety;
- #563 canonical source hash.

## Governance boundary

A green C32 ledger means only that the evidence/input acquisition program is complete enough for independent decision makers to act. It does not itself authorize:

- merge;
- production deployment;
- commercial go-live;
- transaction execution;
- approval;
- Public AI;
- canonical baseline activation.

Those authorities remain false until separately and explicitly granted under the applicable governance process.
