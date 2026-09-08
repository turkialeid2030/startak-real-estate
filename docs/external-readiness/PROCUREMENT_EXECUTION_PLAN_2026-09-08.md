# STARTAK Real Estate — External Readiness Procurement Execution Plan

Date: 2026-09-08
Parent tracker: #202
Procurement tracker: #210
Workstreams: #203–#208

## Objective

Move from engineering-qualified / evidence-missing status to independently evidenced production readiness without adding synthetic engineering gates.

## Parallel execution model

### Lane A — Legal / regulatory
Workstream: #204
Primary output: Saudi legal operating-mode and licensing-boundary disposition.

Sequence:
1. send RFP to at least two qualified Saudi legal candidates;
2. obtain named reviewer, conflict check and scope acceptance;
3. select provider using the vendor scorecard;
4. execute NDA / controlled information exchange;
5. provide actual product scope, commercial model, UI/output samples, terms and Issue #13 boundary;
6. receive draft findings;
7. convert material conditions into remediation issues;
8. complete remediation and targeted legal re-review where required;
9. receive final signed/controlled conclusion;
10. run evidence acceptance checklist and disposition #204.

### Lane B — Privacy / PDPL
Workstream: #205
Primary output: production-oriented PDPL/data-governance control review.

Sequence:
1. RFP to qualified privacy/data-governance providers;
2. confirm actual data-flow/system-control review is included;
3. identify controller/processor questions and required system evidence;
4. complete NDA / secure evidence channel;
5. provide data inventory, architecture, access model, retention/deletion, processor/subprocessor and transfer information;
6. receive control matrix/findings;
7. remediate material findings;
8. independent retest/closure where required;
9. receive final disposition;
10. accept or reject evidence under #205.

### Lane C — Professional valuation scope
Workstream: #206
Primary output: professional scope/applicability disposition for the intended Saudi use cases.

Sequence:
1. shortlist licensed valuation facilities / named professionals from official Taqeem sources;
2. verify reviewer standing and independence;
3. issue #206 review pack;
4. provide actual workflows, valuation indications, reports/exports, standards router outputs and claim language;
5. receive applicability/scope matrix;
6. remediate terminology/workflow/report boundary findings;
7. receive final conclusion;
8. accept/reject evidence under #206.

### Lane D — Security / performance / resilience
Workstream: #207
Primary output: independent measured production validation.

Sequence:
1. appoint security provider and, if necessary, separate performance/resilience specialist;
2. freeze the release candidate to be tested;
3. document target environment/configuration and test window;
4. execute penetration testing/security assessment;
5. execute measured performance/load tests against agreed SLOs;
6. execute resilience/failure-mode/recovery/rollback tests;
7. remediate all Critical/High security findings and material performance/resilience failures;
8. independent retest;
9. obtain final exact-candidate evidence;
10. accept/reject evidence under #207.

### Lane E — Canonical source comparison
Workstream: #203
Primary output: independently verified canonical-source MATCH.

Sequence:
1. identify canonical original and owner/source;
2. deliver canonical original to independent verifier out-of-band;
3. verifier hashes both canonical and compared artifact;
4. verifier records tool/method/version and provenance;
5. result = MATCH / MISMATCH / INCONCLUSIVE;
6. only MATCH may close #203.

### Lane F — Final human release/execution
Workstream: #208
Starts only after material blockers from #203–#207 are cleared.

Sequence:
1. assemble evidence acceptance summary;
2. identify human release authority and separation-of-duties roles;
3. explicit RELEASE decision;
4. explicit MERGE decision;
5. actual merge and resulting commit recorded;
6. explicit DEPLOYMENT decision;
7. actual deployment and provider/deployment ID recorded;
8. post-deployment smoke validation;
9. rollback-readiness validation;
10. confirm deployed claims remain within approved operating mode;
11. close #208 only after execution evidence is complete.

## Critical-path logic

Lanes A–E should run in parallel.

Lane F cannot complete until:
- #203 accepted;
- #204 accepted or accepted with all material conditions closed;
- #205 accepted or accepted with all material conditions closed;
- #206 accepted or accepted with all material conditions closed;
- #207 accepted with Critical=0, High=0 and no material unresolved performance/resilience blocker.

## Release-candidate freeze rule

External reviewers must be told which immutable candidate they are reviewing.

If a material remediation changes relevant code/configuration after a review:
- create a new source commit/artifact hash;
- mark the old evidence scope as superseded or partial where appropriate;
- retest/re-review affected controls;
- do not silently carry an old PASS to a materially changed release candidate.

## Evidence storage rule

GitHub should store:
- evidence metadata;
- non-sensitive conclusions;
- hashes;
- stable controlled references;
- remediation/closure status.

Do not store sensitive penetration-test details, personal data, privileged legal advice or confidential system information in a public repository merely to satisfy traceability.

## Procurement sequence for authorized sender

1. Approve outreach list and authorized sender.
2. Send RFP templates from `RFP_OUTREACH_EMAIL_TEMPLATES_2026-09-08.md`.
3. Record proposals in #210 without publishing confidential commercial terms.
4. Complete scorecard for each candidate.
5. Perform conflict/credential checks before award.
6. Obtain commercial approval and NDA outside the public repository.
7. Record only engagement status and non-sensitive scope metadata in #210.
8. Move each workstream from `NOT_RECEIVED` to `RECEIVED_UNVERIFIED` only when real evidence arrives.

## Status model

Use:
- `OUTREACH_NOT_STARTED`
- `RFP_SENT`
- `PROPOSAL_RECEIVED`
- `CANDIDATE_EVALUATION`
- `SELECTED_PENDING_CONTRACT`
- `ENGAGED`
- `REVIEW_IN_PROGRESS`
- `EVIDENCE_RECEIVED_UNVERIFIED`
- `EVIDENCE_VERIFICATION_IN_PROGRESS`
- `EVIDENCE_ACCEPTED`
- `EVIDENCE_ACCEPTED_WITH_CONDITIONS`
- `EVIDENCE_REJECTED`

## Current status

At creation of this plan:
- reviewer packs: prepared;
- candidate shortlist: started;
- external outreach: not executed by repository automation;
- external firms engaged: none evidenced;
- real external evidence received: none evidenced;
- production authorization: HOLD;
- `main`: unchanged by this procurement plan;
- operating mode: `UNLICENSED_DECISION_SUPPORT`.
