# STARTAK Real Estate — External Evidence Acceptance Checklist

Date: 2026-09-08
Parent tracker: #202
Workstreams: #203–#208

## Purpose

Define the minimum checks that must be completed before an external artifact is accepted as evidence and before any related blocker is closed.

## Universal intake checks

An evidence item is not accepted until all applicable checks below are completed.

### Identity and authority
- [ ] provider legal entity identified;
- [ ] named reviewer / verifier identified;
- [ ] reviewer role and authority appropriate to the scope;
- [ ] credentials / licences independently verified where relevant;
- [ ] conflicts and independence documented;
- [ ] implementation actor is not self-validating the result.

### Scope binding
- [ ] workstream ID identified (#203–#208);
- [ ] exact scope reviewed is stated;
- [ ] exact release candidate/source commit identified where applicable;
- [ ] release artifact SHA-256 identified where applicable;
- [ ] production or production-like environment identified where applicable;
- [ ] environment configuration reference/hash identified where applicable;
- [ ] reviewed dates and evidence issue date recorded.

### Artifact integrity
- [ ] final external artifact or controlled evidence reference exists;
- [ ] SHA-256 calculated for the received artifact where feasible;
- [ ] artifact provenance recorded;
- [ ] version/finality state recorded (DRAFT / FINAL / SUPERSEDED);
- [ ] confidential evidence stored in an approved controlled location rather than exposed in public GitHub;
- [ ] repository retains only appropriate metadata/hash/reference for sensitive material.

### Conclusion quality
- [ ] explicit disposition/result is present;
- [ ] assumptions and limitations are stated;
- [ ] exclusions are stated;
- [ ] material findings are severity-ranked or otherwise prioritized;
- [ ] INCONCLUSIVE is not treated as PASS;
- [ ] REJECTED/FAIL result keeps the workstream on HOLD;
- [ ] any condition required for acceptance is converted into a tracked remediation item.

### Remediation and retest
- [ ] remediation owner identified for each material finding;
- [ ] target release/commit for remediation tracked;
- [ ] retest required where the original scope calls for it;
- [ ] retest performed by an appropriately independent party where required;
- [ ] retest evidence bound to the remediated candidate;
- [ ] no Critical/High security finding remains open before production authorization.

## Workstream-specific acceptance

### #203 — Canonical source hash comparison
Required:
- [ ] canonical original provenance established;
- [ ] canonical original supplied independently/out-of-band;
- [ ] canonical original SHA-256 recorded;
- [ ] compared STARTAK artifact SHA-256 recorded;
- [ ] comparison tool/method/version recorded;
- [ ] result is MATCH, MISMATCH or INCONCLUSIVE;
- [ ] only MATCH may satisfy #203.

### #204 — Saudi legal operating-mode review
Required:
- [ ] Saudi-qualified legal reviewer / firm accepted;
- [ ] actual implemented behavior and commercial model reviewed;
- [ ] Issue #13 control boundary reviewed;
- [ ] REGA/Taqeem licensing boundary expressly addressed;
- [ ] relevant CMA/SAMA triggers addressed where applicable;
- [ ] prohibited claims / workflows and required professional escalation points identified;
- [ ] explicit disposition present: ACCEPT CURRENT MODE / ACCEPT WITH CONDITIONS / HOLD / NOT ACCEPTABLE;
- [ ] all material legal conditions tracked before release.

### #205 — PDPL & data governance
Required:
- [ ] actual data inventory/data-flow scope reviewed;
- [ ] controller/processor roles assessed;
- [ ] lawful basis / consent where applicable assessed;
- [ ] purpose limitation/minimization assessed;
- [ ] retention/deletion assessed;
- [ ] data-subject rights handling assessed;
- [ ] access control/tenant isolation assessed;
- [ ] processor/subprocessor and cross-border transfer issues addressed;
- [ ] incident/breach and privacy notice/operating procedure controls addressed;
- [ ] no unresolved material PDPL blocker remains.

### #206 — Professional valuation / standards-scope review
Required:
- [ ] reviewer competence/professional standing verified;
- [ ] actual valuation/analysis workflows reviewed;
- [ ] actual report/output language reviewed;
- [ ] analytical indication vs formal/certified valuation boundary addressed;
- [ ] purpose/intended use/basis of value/valuation date/property rights routing addressed;
- [ ] applicable standards and versions identified;
- [ ] Saudi-law precedence and context-specific regulatory frameworks addressed;
- [ ] licensed/accredited valuer escalation conditions documented;
- [ ] explicit disposition present;
- [ ] formal standards conformance is not inferred solely from source-document evidence.

### #207 — Security / performance / resilience
Security:
- [ ] exact candidate/environment tested;
- [ ] authenticated/unauthenticated surfaces included where applicable;
- [ ] API/authz/tenant-isolation/storage/upload/export/infrastructure scope included as applicable;
- [ ] findings reproducible and severity-ranked;
- [ ] Critical=0;
- [ ] High=0;
- [ ] material findings independently retested.

Performance:
- [ ] workload model documented;
- [ ] concurrency/throughput/latency targets documented;
- [ ] measured p50/p95/p99 or equivalent captured;
- [ ] saturation/bottleneck behavior recorded;
- [ ] PASS/FAIL/INCONCLUSIVE issued against agreed SLOs.

Resilience:
- [ ] dependency/network/datastore or applicable failure modes exercised;
- [ ] timeout/retry/degraded-mode behavior evaluated;
- [ ] recovery/restore/rollback evidence captured where relevant;
- [ ] RTO/RPO assumptions and evidence documented where defined;
- [ ] PASS/FAIL/INCONCLUSIVE issued.

### #208 — Human authority and production execution
Required before actual software go-live:
- [ ] #203–#207 accepted or explicitly dispositioned under authorized governance without open material blocker;
- [ ] named human release authority identified;
- [ ] authority basis/scope documented;
- [ ] RELEASE decision explicitly recorded;
- [ ] MERGE decision explicitly recorded;
- [ ] DEPLOYMENT decision explicitly recorded;
- [ ] separation of duties satisfied;
- [ ] actual merge result and resulting commit recorded;
- [ ] actual deployment ID/provider reference recorded;
- [ ] deployed artifact/environment binding recorded;
- [ ] post-deployment smoke passed;
- [ ] rollback readiness verified;
- [ ] deployed claims remain within approved operating mode;
- [ ] `transactionAuthorized=false` unless separately established through an independent authority process.

## Evidence status values

Use only:
- `NOT_RECEIVED`
- `RECEIVED_UNVERIFIED`
- `VERIFICATION_IN_PROGRESS`
- `ACCEPTED`
- `ACCEPTED_WITH_CONDITIONS`
- `REJECTED`
- `INCONCLUSIVE`
- `SUPERSEDED`

`RECEIVED_UNVERIFIED`, `INCONCLUSIVE` and `ACCEPTED_WITH_CONDITIONS` with open material conditions do not permit closing the relevant production blocker.

## Closeout record

For each accepted workstream retain:

```text
Workstream:
Provider:
Reviewer(s):
Credential verification:
Conflict review:
Reviewed candidate/commit/artifact/environment:
Artifact/control reference:
Artifact SHA-256:
Final disposition:
Open conditions:
Retest reference:
Accepted by:
Acceptance date:
Issue closure reference:
```

## Boundary

Acceptance of evidence for software go-live readiness does not by itself establish Saudi professional valuation licensing, certified valuation authority, regulated investment advice authority, brokerage authority, legal-opinion authority, automatic standards activation or transaction authority.
