# C36 — Rollback Candidate Evidence & Independent Review Handoff

## Purpose

C36 persists the real C35 controlled non-production rollback rehearsal as durable candidate operational evidence and prepares it for genuine independent review.

C36 **does not** approve the evidence and **does not** change the C30 rollback gate to `SUPPLIED_VERIFIED`.

## Source execution

The source execution is the completed C35 GitHub Actions run:

- workflow: `C35 Owner Execution Wave Verify`;
- run: `37046492311`;
- job: `110969106434`;
- C35 control head: `bc64c4556d74b5d662a578c89c7fefa4a979eb7e`;
- C30 target candidate: `2f066168f6cdca672d668ff5367ab250fe5cb907`;
- rollback point: `ba617ef387843b6916bb8da0bf08b16e0922260f`;
- target verification: PASS, 86 seconds;
- rollback verification: PASS, 85 seconds;
- restored target verification: PASS, 85 seconds;
- source report SHA-256: `a0ba299578af8577de23a467bd3f7e410c636b85fa92e8b107ce73ed1498fe76`.

## Durable candidate artifact

`release/evidence/c36-rollback-candidate-evidence.json`

This file records only facts already produced by the real workflow execution. Its validator rejects changes to:

- run/job identity;
- candidate and rollback SHAs;
- execution timestamps and measured durations;
- source report SHA-256;
- stage PASS states;
- evidence state;
- authority flags.

The candidate state must remain:

`EXECUTED_CANDIDATE_EVIDENCE_PENDING_INDEPENDENT_REVIEW`

and the C30 rollback state must remain:

`NOT_SUPPLIED_PENDING_INDEPENDENT_REVIEW`

## Independent review request

`release/evidence/c36-rollback-independent-review-request.json`

The request is intentionally blank for reviewer identity, authority evidence, review decision, review timestamp, signed artifact, signature/hash and reason code.

Its required state is:

`REVIEWER_REQUIRED`

C36 will fail closed if those blank fields are populated in the repository template or if any approval/evidence-satisfied/authority flag is raised.

## What a real reviewer must do

A genuine independent operations/release reviewer must inspect the executed evidence and determine whether:

1. target → rollback → target-restore was actually executed in the declared environment;
2. the exact source/build SHAs are correctly bound;
3. build and canonical release verification passed in all three stages;
4. any material operational defect or limitation prevents acceptance;
5. the evidence is accepted only for the declared non-production rehearsal scope.

If accepted, the reviewer must provide a traceable signed/authorized artifact. Only then may the existing C30 evidence intake be populated and re-evaluated.

## Invalid substitutes

The following are not independent acceptance:

- engineering self-attestation;
- this C36 validator passing;
- GitHub Actions success by itself;
- an AI-written approval;
- an unsigned draft review;
- the repository owner acting as the independent reviewer when independence is required.

## Authority boundary

C36 grants none of the following:

- release approval;
- merge approval;
- deployment approval;
- commercial go-live;
- transaction authority;
- professional approval;
- Public AI activation;
- canonical-baseline activation.

The project remains fail-closed until real external evidence and governed acceptance are completed.
