# C37 — Rollback Independent Reviewer Designation

## Purpose

C37 records the owner's reviewer-designation decision after C36 persisted the real rollback rehearsal as durable candidate evidence.

The repository owner remains accountable for the project. Independence is preserved by assigning the substantive rollback review to a distinct human reviewer rather than allowing owner/engineering self-approval.

## Owner decision

Owner: `github:turkialeid2030`

Decision: `APPROVE_SAID_FOR_ROLLBACK_REVIEW`

Decision record: issue #592.

This decision designates a reviewer only. It does not accept the evidence, satisfy the C30 gate, authorize release, or expand runtime authority.

## Designated reviewer

- reviewer ref: `human:said`
- reviewer ID: `reviewer-said-2026-09-17`
- existing validated review history: issue #254
- current public-key SHA-256 recorded by #254: `0af393bd7c091106c3b16e493b4f99d39570c77675c9c5dee175d5a7727ebbc1`
- scope: `ROLLBACK_OPERATIONAL_VERIFICATION`
- purpose: `INDEPENDENT_OPERATIONAL_ROLLBACK_REHEARSAL_ACCEPTANCE`

The prior custody exception in #367 is historical governance context. C37 does not reinterpret it as review acceptance and does not fabricate a new signature.

## Evidence tuple under review

- target candidate: `2f066168f6cdca672d668ff5367ab250fe5cb907`
- rollback point: `ba617ef387843b6916bb8da0bf08b16e0922260f`
- C36 qualified head: `fe63dcc441cc8c8d665430a63e126fbe814aac13`
- C36 candidate artifact SHA-256: `4475f40dcbc5d6b2b2edfc1a6584686b6c7f7c29afab1861b4f16ece1ad52409`
- source rehearsal report SHA-256: `a0ba299578af8577de23a467bd3f7e410c636b85fa92e8b107ce73ed1498fe76`
- source workflow run: `37046492311`
- source workflow job: `110969106434`

## Review payload

`release/evidence/c37-rollback-independent-review-payload.json` is intentionally unsigned and unanswered.

The designated human reviewer must independently answer the five review questions and issue a genuine substantive decision. A future signed/authorized response must be processed through a separate governed intake step. C37 itself cannot create `SUPPLIED_VERIFIED` evidence.

## Fail-closed rules

C37 fails if any of the following occurs:

- reviewer is replaced with the owner;
- reviewer identity, authority reference, key fingerprint, candidate SHA, rollback SHA, source run/job or artifact hash changes without a new governed decision;
- review answers, approval, timestamps or signatures are pre-populated;
- any authority flag becomes true;
- the C36 candidate artifact bytes no longer match their SHA-256;
- C30 rollback status is escalated before genuine review acceptance.

## Current state

`REVIEWER_DESIGNATED_REVIEW_PAYLOAD_READY_AWAITING_HUMAN_REVIEW`

The following remain false:

- substantive review completed;
- independent review accepted;
- evidence satisfied;
- release decision authorized;
- canonical baseline activation authorized;
- merge authorized;
- deployment authorized;
- commercial go-live authorized;
- transaction authority;
- approval authority;
- Public AI authorized.

C30 remains `NOT_SUPPLIED_PENDING_INDEPENDENT_REVIEW` for the rollback gate.
