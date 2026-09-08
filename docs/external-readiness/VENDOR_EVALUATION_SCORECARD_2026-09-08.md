# STARTAK Real Estate — External Reviewer Vendor Evaluation Scorecard

Date: 2026-09-08
Parent tracker: #202
Procurement tracker: #210
Related workstreams: #203–#208

## Purpose

Provide a controlled, auditable scoring method for selecting external reviewers and assurance providers. This scorecard does not itself approve a vendor, establish reviewer independence, validate credentials or create accepted evidence.

## Mandatory disqualifiers

A candidate is **DISQUALIFIED** regardless of weighted score if any of the following applies:

- cannot identify the named reviewer(s) before engagement;
- material conflict of interest is unresolved;
- reviewer credentials/licence cannot be independently verified where the scope requires them;
- provider refuses to bind the work to the exact release candidate / source commit / artifact / environment;
- provider will not issue an explicit disposition or severity-ranked findings;
- provider will not provide remediation/retest terms for material findings where applicable;
- provider requires STARTAK implementation actors to self-certify the provider's conclusion;
- provider cannot support confidential evidence handling through an approved controlled channel;
- provider proposes to satisfy legal, professional, privacy, security, performance or resilience conclusions solely through document review when the workstream requires implemented-system or measured evidence.

## Weighted evaluation

Score each criterion from 0 to 5 and multiply by the weight.

| Criterion | Weight | 0 | 3 | 5 |
|---|---:|---|---|---|
| Scope competence | 20% | no demonstrated competence | relevant but partial | directly proven competence for exact scope |
| Saudi regulatory / market relevance | 15% | no Saudi relevance | some Saudi work | strong current Saudi regulatory/professional context |
| Reviewer credentials & verifiability | 15% | unclear/unverifiable | generally qualified | named reviewer, independently verifiable credentials |
| Independence & conflicts | 10% | material unresolved conflict | manageable with controls | clear independence and documented conflict check |
| Evidence quality & auditability | 15% | narrative only | partial structured evidence | explicit evidence matrix, hashes/references, limitations and disposition |
| Exact-candidate binding | 10% | generic assessment | partial environment binding | exact commit/artifact/environment/config binding |
| Remediation & retest capability | 5% | none | limited | clear retest process and closure evidence |
| Delivery plan & responsiveness | 5% | undefined | reasonable | clear milestones, dependencies and turnaround |
| Commercial reasonableness | 5% | materially disproportionate | acceptable | strong value relative to required assurance depth |

### Scoring formula

`Weighted Score = sum((criterion score / 5) × criterion weight)`

Maximum = 100.

## Decision bands

| Score | Procurement disposition |
|---:|---|
| 85–100 | Preferred candidate, subject to mandatory checks and commercial approval |
| 75–84 | Acceptable candidate; compare risks/conditions before award |
| 65–74 | Conditional / reserve candidate |
| <65 | Do not appoint without documented exception |

A high score never overrides a mandatory disqualifier.

## Workstream-specific mandatory capabilities

### #203 — Canonical source comparison
- receives canonical original independently/out-of-band;
- produces source provenance and SHA-256 values;
- records tool/method/version;
- returns MATCH / MISMATCH / INCONCLUSIVE;
- verifier independent from implementation actors.

### #204 — Saudi legal operating-mode review
- Saudi-qualified legal reviewer or law firm appropriate to the scope;
- evaluates actual product behavior, commercial model, terms, customer journey and output claims;
- explicitly addresses REGA / Taqeem licensing boundaries and context-specific CMA/SAMA triggers where applicable;
- returns ACCEPT CURRENT MODE / ACCEPT WITH CONDITIONS / HOLD / NOT ACCEPTABLE.

### #205 — PDPL & data governance
- actual data-flow and production-control review;
- controller/processor characterization, lawful basis, retention/deletion, data-subject rights, subprocessors and cross-border transfer analysis;
- findings severity and remediation/retest;
- controlled handling of sensitive privacy evidence.

### #206 — Professional valuation / standards scope
- named reviewer with verifiable professional standing appropriate to the reviewed scope;
- reviews actual valuation/analysis workflows and report/output terminology;
- separates analytical indication from formal/certified valuation;
- documents applicable standards/versions and Saudi precedence;
- returns explicit scope/applicability disposition.

### #207 — Security / performance / resilience
- security: independent pentest with Critical=0 and High=0 release threshold;
- performance: measured workload, concurrency, throughput and p50/p95/p99 or appropriate equivalent;
- resilience: failure-mode, recovery and rollback validation;
- exact production candidate/environment binding;
- remediation and independent retest.

### #208 — Human release authority & execution chain
This is not competitively scored as an external consulting vendor unless a governance/assurance party is engaged. The controlling requirements are authority, separation of duties, exact-candidate binding and actual execution evidence.

## Evaluation record template

```text
Candidate:
Legal entity:
Workstream(s):
Named reviewer(s):
Credential verification source:
Conflict review result:
Mandatory disqualifier present? YES / NO

Scope competence: __/5
Saudi relevance: __/5
Credentials: __/5
Independence: __/5
Evidence quality: __/5
Exact-candidate binding: __/5
Remediation/retest: __/5
Delivery: __/5
Commercial: __/5

Weighted score: __/100
Conditions:
Risks:
Decision: PREFERRED / ACCEPTABLE / CONDITIONAL / REJECT
Approved by:
Date:
```

## Governance boundary

Selection of a vendor is not acceptance of its future evidence. Each delivered artifact must still pass the evidence-acceptance checks in #202 and the relevant workstream issue before any blocker is closed.
