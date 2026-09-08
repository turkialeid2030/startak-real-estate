# STARTAK Real Estate — External Evidence Execution Board

Observed: 2026-09-08
Parent tracker: #202
Procurement tracker: #210
Dispatch authorization: #212
Canonical provenance owner task: #213
Response triage control: #214
Controlled evidence storage/hash registry: #215
Remediation conversion control: #216
Documentation PR: #209

## Purpose

Provide one live, non-authoritative execution view for external production-readiness evidence. This board does not itself create external evidence, reviewer independence, legal/professional approval, release authority or deployment authority.

## Current state

| Workstream | Objective | Prepared route | Current state | Next valid transition |
|---|---|---|---|---|
| #203 | Canonical source identity/provenance + independent hash comparison | provenance template + verifier request | `HOLD_CANONICAL_IDENTITY_AND_PROVENANCE` | authoritative source/provenance owner established; controlled original acquired; independent comparison executed |
| #204 | Saudi legal operating-mode/licensing review | K&A + Al Tamimi | `RFP_READY / OUTREACH_NOT_STARTED` | explicit human dispatch authorization, then real outreach |
| #205 | PDPL/data-governance review | KPMG Saudi + PwC Saudi/Middle East | `RFP_READY / OUTREACH_NOT_STARTED` | explicit human dispatch authorization, then real outreach |
| #206 | Professional valuation/standards-scope review | Qiam + Barcode | `RFP_READY / OUTREACH_NOT_STARTED` | explicit human dispatch authorization; named reviewer/credential/competence/independence check |
| #207 Security | independent production security validation | sirar by stc | `RFP_READY / OUTREACH_NOT_STARTED` | explicit human dispatch authorization, then scoped RFP |
| #207 Performance | measured performance/load validation | Crewformance + Vast Edge | `RFP_READY / OUTREACH_NOT_STARTED` | explicit human dispatch authorization, then scoped RFP |
| #207 Resilience | failure-mode/resilience validation | separately scoped sirar inquiry / bidder confirmation | `SCOPE_CONFIRMATION_REQUIRED / OUTREACH_NOT_STARTED` | explicit human dispatch authorization + confirmed resilience scope |
| #208 | human release/merge/deploy authority + actual execution chain | none until blockers clear | `BLOCKED_BY_#203_#204_#205_#206_#207` | only after accepted real evidence and remediation closure |

## Dispatch authorization gate

No RFP or contact-form submission may be treated as authorized merely because the recipient is listed here or in the candidate matrix. Issue #212 is the controlled authorization record.

Valid authorization tokens:
- `AUTHORIZE_OUTREACH_ALL_PREPARED_RFPS`
- `AUTHORIZE_OUTREACH_#204`
- `AUTHORIZE_OUTREACH_#205`
- `AUTHORIZE_OUTREACH_#206`
- `AUTHORIZE_OUTREACH_#207`

Authorization is for outreach only. It does not authorize engagement, spending, evidence acceptance, merge, deployment or production release.

## Response-state machine

After actual dispatch, use issue #214 and the procurement tracker to record one of:

`NO_RESPONSE → ACKNOWLEDGED / NDA_REQUIRED / SCOPE_QUESTION / PROPOSAL_RECEIVED / REJECTED_BY_VENDOR → SHORTLISTED_FOR_EVALUATION → ENGAGEMENT_APPROVAL_REQUIRED → ENGAGED → EVIDENCE_SUBMITTED → EVIDENCE_ACCEPTED | EVIDENCE_REJECTED`

A proposal, quotation, NDA, credentials page or acknowledgment is not substantive external evidence.

## Evidence storage and integrity

Use issue #215 controls:
- confidential or privileged external reports stay in an approved controlled repository;
- GitHub stores only non-sensitive metadata, stable controlled references, hashes and disposition;
- immutable external artifacts require SHA-256;
- exact release candidate / commit / environment binding is mandatory;
- reviewer identity and independence/conflict disposition must be recorded.

## Findings and remediation

Use issue #216 for all material external findings. `ACCEPT WITH CONDITIONS` is not unconditional PASS. Every material condition must become a tracked remediation item with implementation evidence, regression/retest evidence, and external retest when required.

Release remains HOLD for:
- unresolved legal HOLD / NOT ACCEPTABLE finding;
- unresolved material PDPL blocker;
- unresolved professional-scope HOLD / NOT ACCEPTABLE finding;
- any open Critical or High security finding;
- failed or materially inconclusive performance/resilience conclusion against agreed SLOs.

## #203 special control

The verifier contains expected SHA-256 `ac0767d3f13c463259f401a5d7af06c1140ee780a9f86489eb17ad9d7c72dc71`, but that constant is not sufficient to establish authoritative identity/provenance. Issue #213 must identify the authoritative artifact, source/version, acquisition/custody and expected-hash provenance before an independent `MATCH` can close #203.

## Current overall disposition

`HOLD — INTERNAL PREPARATION COMPLETE; EXTERNAL DISPATCH / CANONICAL PROVENANCE / REAL REVIEW EVIDENCE / HUMAN AUTHORITY OUTSTANDING`

PR #209 must remain Draft. Do not merge or deploy this documentation as a substitute for external review.