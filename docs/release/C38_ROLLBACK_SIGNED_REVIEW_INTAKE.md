# C38 — Signed Rollback Review Intake

## Purpose

C38 prepares the cryptographic intake boundary for the genuine substantive rollback review that must be produced by the C37-designated reviewer `human:said`.

C38 does not write Said's answers, decision, timestamp or signature. It validates only real future material supplied to the intake path.

## Exact evidence tuple

- evidence ID: `ROLLBACK_OPERATIONAL_VERIFICATION`
- purpose: `INDEPENDENT_OPERATIONAL_ROLLBACK_REHEARSAL_ACCEPTANCE`
- reviewer: `human:said`
- reviewer ID: `reviewer-said-2026-09-17`
- owner: `github:turkialeid2030`
- owner designation: issue #592
- candidate: `2f066168f6cdca672d668ff5367ab250fe5cb907`
- rollback point: `ba617ef387843b6916bb8da0bf08b16e0922260f`
- C36 candidate artifact SHA-256: `4475f40dcbc5d6b2b2edfc1a6584686b6c7f7c29afab1861b4f16ece1ad52409`
- C37 unanswered review payload raw-file SHA-256: `ba03306c60c65507823c0fb434d0bac09c599fef6fdc0956722f727606b979c9`
- source rehearsal report SHA-256: `a0ba299578af8577de23a467bd3f7e410c636b85fa92e8b107ce73ed1498fe76`

The C37 raw-file SHA above is the value emitted by the exact-head C37 validator itself. Earlier coordination text that cited `b991831cab7386973e4478614c335ef431ade9f8e34d2b403f19a8b967db3a67` was corrected and must not be used as the raw-file integrity anchor.

## Said public trust material

The current Said public key is non-secret public trust material. It was previously committed and verified in the canonical reviewer lineage at commit:

`5ee9ad2dc5db71c6e0d627f4c27c24d507ee541e`

Public key SHA-256:

`0af393bd7c091106c3b16e493b4f99d39570c77675c9c5dee175d5a7727ebbc1`

Historical normalized reviewer registry SHA-256:

`2cd45d81863afb8d41a30404d5b1cf2113c216abf6ae13e51d6f41e0962d0f53`

C38 copies only the public key and provenance into a rollback-specific trust record. It does not reuse Said's prior review decision. The prior decision under #254 remains evidence for that historical purpose only.

The private key must never be placed in the repository, CI, issue text, PR text, or chat.

## Human response template

`release/evidence/c38-rollback-signed-review-response.template.json`

is intentionally blank for:

- all five answers;
- reviewer notes;
- decision;
- reason code;
- review timestamp;
- RSA signature.

It is not evidence.

The reviewer must answer all five questions. An `APPROVE` decision is internally consistent only when:

- Q1 execution reality = `YES`;
- Q2 SHA binding = `YES`;
- Q3 recovery result = `YES`;
- Q4 material blocking defect = `NO`;
- Q5 scope acceptance = `YES`.

A `REJECT` or `HOLD` decision requires a non-empty reason code.

## Deterministic signing payload

The repository tool:

`tools/c38-rollback-signed-review-intake.js`

constructs deterministic signing bytes with stable key ordering from the completed substantive response, excluding the signature itself and excluding verifier-derived authority/status outputs.

A completed-but-unsigned local response can be converted to exact signing bytes with:

```bash
node tools/c38-rollback-signed-review-intake.js --print-signing-payload <completed-response.json>
```

Those exact UTF-8 bytes are what the designated reviewer must sign with RSA-SHA256 using the corresponding private key outside the repository.

## Verification

After a genuine signed response exists:

```bash
node tools/c38-rollback-signed-review-intake.js --response <signed-response.json>
```

The verifier checks:

1. reviewer identity and owner/reviewer separation;
2. exact purpose and evidence ID;
3. candidate and rollback SHAs;
4. C36 candidate artifact integrity;
5. C37 review payload integrity;
6. source workflow/run binding;
7. complete five-question response;
8. decision consistency;
9. review timestamp after designation and not materially in the future;
10. exact pinned Said public-key SHA-256;
11. RSA-SHA256 signature over deterministic signing bytes;
12. no authority escalation in the supplied artifact.

## Decision routing

A cryptographically valid future review does not directly grant C30 evidence satisfaction.

- `APPROVE` -> `SIGNED_REVIEW_VERIFIED_READY_FOR_GOVERNED_C30_INTAKE`
- `REJECT` -> `SIGNED_REVIEW_VERIFIED_REJECTED_READY_FOR_C30_NO_GO_INTAKE`
- `HOLD` -> `SIGNED_REVIEW_VERIFIED_HOLD_READY_FOR_C30_HOLD_INTAKE`

The C30 evidence status remains pending until the existing governed C30 intake validates and records the supplied evidence.

## Test-only cryptography

Regression coverage may generate an ephemeral RSA key pair in memory solely to verify the cryptographic implementation. Such keys and signatures are explicitly synthetic, are not persisted, and are never release evidence.

## Current state

Until Said genuinely completes and signs the rollback review:

`AWAITING_GENUINE_SIGNED_REVIEW`

and:

- signed review verified = false;
- governed C30 intake ready = false;
- evidence satisfied = false;
- C30 rollback gate = `NOT_SUPPLIED_PENDING_INDEPENDENT_REVIEW`;
- release decision authorized = false;
- canonical activation authorized = false;
- merge authorized = false;
- deployment authorized = false;
- commercial go-live authorized = false;
- transaction authority = false;
- approval authority = false;
- Public AI authorized = false.
