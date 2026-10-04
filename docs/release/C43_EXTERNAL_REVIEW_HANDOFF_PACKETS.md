# C43 — Exact-Candidate External Review Handoff Packets

## Purpose

C43 turns the C42 closure-control register into concrete handoff packets for the real external/human actions that remain. It does not create, simulate or infer any approval.

The frozen engineering candidate supplied for review is:

`db05999e5a3c995235ac290c256251ab1592072b`

That exact SHA independently passed C42, C40, C41 and canonical Release Verify before C43 was created. C43 is a governance-only overlay; its workflow rejects product/runtime source modifications relative to the frozen candidate.

## Non-negotiable evidence rule

A request packet is not evidence of delivery, receipt, execution, approval or acceptance. Until genuine external material is returned and verified through the applicable governed intake:

- `externalReceiptConfirmed = false`
- `evidenceSatisfied = false`
- merge/deployment/commercial-go-live/Public-AI authority remains false.

## Handoff packets and order

### 1. Rollback operational verification — Issue #551

Recipient role: Production Operations / Change Authority.

Designated reviewer already governed by C37: `human:said` / `reviewer-said-2026-09-17`.

Send the existing executed-evidence set without modification:

- `release/evidence/c36-rollback-candidate-evidence.json`
- `release/evidence/c36-rollback-independent-review-request.json`
- `release/evidence/c37-rollback-independent-review-payload.json`
- `release/evidence/c37-rollback-reviewer-designation.json`
- `release/evidence/c38-rollback-reviewer-trust.json`
- `release/evidence/c38-rollback-signed-review-response.template.json`

Required return: a genuine substantive RSA-SHA256-signed review accepting or rejecting the executed rollback evidence. The response must pass the C38 trust/signature intake before C30 ingestion.

### 2. Human UAT — Issue #549

Recipient role: Business UAT Acceptance Authority.

Execution pack: `release/evidence/c35-owner-uat-execution-pack.json`.

Required return: executed representative scenarios, observations, defects and genuine human sign-off. Automated Playwright/E2E success is engineering evidence only and is not a substitute.

### 3. Independent security review — Issue #545

Recipient role: Independent Security Review Authority.

Required return: exact-candidate security review, material findings/disposition and explicit production authorization or rejection. Existing engineering security results may be supplied as reviewer input but must not be represented as independent authorization.

### 4. Saudi PDPL/privacy review — Issue #546

Recipient role: Qualified Saudi PDPL / Privacy Review Authority.

Required return: dated exact-scope review covering intended operating scope and relevant data handling, retention, logging and residency posture, with authorization or rejection.

### 5. Saudi legal/regulatory review — Issue #552

Recipient role: Qualified Saudi Legal / Regulatory Approval Authority.

Required return: traceable exact-candidate disposition covering product scope, authority boundaries, disclaimers and intended operating model.

### 6. Source-rights authorization — Issue #548

Recipient role: Legal / Data Rights Authority.

Required return: source-by-source disposition for the exact production source universe. Public availability or visibility alone is not reuse authorization.

### 7. AI provider production authorization — Issue #547

Recipient role: AI Provider / Contract Authorization Holder.

This packet remains blocked until the actual provider, model and production use case are selected. Required authorization must address data handling, retention, training use, residency, logging, credential separation and kill-switch controls. Engineering gateway tests do not satisfy this gate.

### 8. Historical replay evidence — Issue #550

Recipient role: Business Data Owner plus Independent Model / Business Validation Authority.

This packet remains blocked until real historical cases are supplied with provenance and observed outcomes. Required completion includes predeclared replay measures, execution against the frozen candidate and independent review of material deviations.

### 9–13. C31 canonical evidence inputs

The canonical-input packets preserve the exact variable/flag contract from `release/evidence/c31-canonical-evidence-input-map.json`:

- `CANONICAL_SOURCE_HASH`: actual external bytes at `CANONICAL_ORIGINAL_PATH`, expected SHA-256 `ac0767d3f13c463259f401a5d7af06c1140ee780a9f86489eb17ad9d7c72dc71`, with `REQUIRE_CANONICAL_SOURCE_HASH=1`.
- `COMPOSITE_BASELINE_SHADOW`: real candidate/evidence pair with `REQUIRE_COMPOSITE_BASELINE_SHADOW=1`.
- `FRESH_COMPOSITE_SHADOW`: real fresh-cycle pair with `REQUIRE_FRESH_COMPOSITE_SHADOW=1`.
- `SUCCESSOR_FRESH_COMPOSITE_SHADOW`: real successor-fresh pair with `REQUIRE_SUCCESSOR_FRESH_COMPOSITE_SHADOW=1`.
- `COMPOSITE_CUTOVER_SAFETY`: complete reviewer-lifecycle, activation-plan, shadow and rehearsal set with `REQUIRE_COMPOSITE_CUTOVER_SAFETY=1`.

Even a successful cutover-safety evaluation does not itself authorize activation.

## Current packet-state summary

- Total packets: 13.
- C30 packets: 8.
- C31 packets: 5.
- Ready for reviewer/human execution or assignment: 6.
- Blocked pending real external inputs/selections: 7.
- Confirmed external receipts: 0.
- Satisfied governing gates: 0.

## Authority boundary

C43 is preparation and integrity control only. It grants no release decision, merge, deployment, commercial go-live, transaction, canonical activation, approval or Public-AI authority.
