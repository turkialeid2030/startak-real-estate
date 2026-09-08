# STARTAK Real Estate — External Reviewer Solicitation Pack

Parent tracker: #202
Baseline PR: #201
Qualified E2I head: `f910a086039b0cbde93faa063b468bfd0c28a3f9`
Operating mode: `UNLICENSED_DECISION_SUPPORT`

## Purpose

Use this cover pack to solicit independent reviewers for Issues #203–#207. It is not an engagement letter and does not replace procurement, confidentiality, conflict, legal or commercial terms.

## Project description for reviewers

STARTAK Real Estate is an analytical real-estate decision-support platform for Saudi use cases. The current engineering chain has completed internal qualification, but the product is deliberately **not** asserting licensed real-estate consultancy, certified valuation authority, legal advice, transaction authority or formal professional standards conformance.

The current external-readiness program seeks independent evidence before any production go-live decision.

## Reviewer response requested

Please provide:

1. legal entity / firm name;
2. office / jurisdiction;
3. proposed lead reviewer and team;
4. relevant Saudi professional qualifications, licences or authority basis;
5. independent verification sources for claimed credentials where applicable;
6. conflicts-of-interest disclosure;
7. confirmation that the engagement team is independent of STARTAK implementation actors;
8. proposed scope and methodology;
9. exclusions / assumptions;
10. evidence required from STARTAK;
11. estimated review duration;
12. commercial proposal under a separate controlled channel;
13. proposed deliverables;
14. whether the final deliverable can include an explicit PASS / FAIL / HOLD / INCONCLUSIVE or equivalent conclusion;
15. confidentiality / data-handling requirements;
16. whether a report SHA-256 and stable controlled evidence reference can be provided after issuance.

## Available review scopes

### A — Canonical-source integrity (#203)

Independent artifact provenance and SHA-256 comparison. See `CANONICAL_SOURCE_HASH_COMPARISON_REQUEST.md`.

### B — Saudi legal operating mode (#204)

Review actual product behavior, commercialization model, REGA/Taqeem boundaries and purpose-specific regulatory triggers. See `SAUDI_LEGAL_OPERATING_MODE_REVIEW_REQUEST.md`.

### C — PDPL / data governance (#205)

Review real data flows, role characterization, lawful basis, minimization, retention, rights, isolation, subprocessors/transfers and production configuration. See `PDPL_DATA_GOVERNANCE_REVIEW_REQUEST.md`.

### D — Professional valuation / standards scope (#206)

Review analytical-vs-formal valuation boundary, standards routing, report language, applicable valuation workflows and licensed-valuer escalation. See `PROFESSIONAL_VALUATION_STANDARDS_REVIEW_REQUEST.md`.

### E — Security / performance / resilience (#207)

Independent penetration/security assessment plus measured performance and resilience validation for the exact production candidate. See `PRODUCTION_SECURITY_PERFORMANCE_RESILIENCE_SOW.md`.

## Independence and evidence requirements

A reviewer proposal should explicitly state whether:

- the firm or reviewer participated in building STARTAK;
- the reviewer has any financial interest in STARTAK or its release decision;
- there is any relationship that could impair independence;
- subcontractors will be used;
- the final conclusion will be independently signed/approved;
- reviewer credentials can be externally verified;
- the reviewed release candidate and environment can be uniquely identified in the final report.

## Evidence handling

Sensitive reports should remain in an approved controlled repository. The public GitHub repository should contain only non-sensitive metadata, hashes, accepted conclusions and stable evidence references.

The common intake envelope is `EVIDENCE_SUBMISSION_MANIFEST_TEMPLATE.json`.

## Non-negotiable release rules

- missing evidence = HOLD;
- `INCONCLUSIVE` is not PASS;
- no implementation-actor self-certification;
- legal review cannot be replaced by disclaimers;
- PDPL review cannot be replaced by citation of the law;
- professional review cannot be replaced by possession of standards documents;
- open Critical/High production security findings prohibit production authorization;
- CI success does not authorize release, merge or deployment;
- all evidence must bind to the exact product/release candidate actually reviewed.

## Contact / procurement fields

To be completed outside this repository before sending:

- STARTAK commercial/contact person:
- NDA required: Yes / No
- proposal due date:
- target review start:
- target review completion:
- secure document exchange method:
- procurement reference:

Do not place personal contact details, confidential commercial terms or access credentials in the public repository.