# Decision Governance, Saudi Alignment & Release Hardening Wave — CI Evidence

Date: 2026-09-15

## Evidence baseline

Evaluated branch head before this evidence-only commit:

`e697c1c571a0fbb89d8b163c43bc464c221cddbf`

PR: #359

## Workflow results

| Workflow | Run | Result |
|---|---:|---|
| Zakat Layer Verify | #86 | PASS |
| Release Verify | #986 | FAIL |
| Comprehensive Verify | #401 | FAIL |
| Deep Platform Verify | #356 | FAIL |
| Standards Provenance Verify | #76 | FAIL |

## Canonical Release Verify #986

- Regression total: 438
- Regression passed: 437
- Regression failed: 1
- Production build: PASS
- Package verification: PASS
- npm audit: 0 critical / 0 high / 0 moderate / 0 low
- Canonical baseline registry: VERIFIED / PASS
- Composite baseline shadow verification: NOT_EVALUATED — inputs not supplied
- Fresh composite shadow verification: NOT_EVALUATED — inputs not supplied
- Successor fresh composite shadow verification: NOT_EVALUATED — inputs not supplied
- Composite cutover safety guard: NOT_EVALUATED — inputs not supplied
- External canonical source hash evidence: NOT_EVALUATED — external canonical source not supplied
- RELEASE_VERIFY_RESULT: FAIL

## Blocking regression

`tests/decision-governance/app-cutover-source-contract.test.js`

Failure:

`App must import the governed workspace cutover boundary`

Classification: `CODE_DEFECT` / incomplete runtime cutover, not a test defect.

The guard is intentionally fail-closed. It must not be weakened or removed to qualify the release.

## P1-07 status

`PARTIAL`

Completed:

- governed New Deal workspace boundary;
- explicit Demo workspace boundary;
- explicit legacy hydration boundary;
- calculation-readiness boundary;
- regression guard preventing Demo defaults from silently returning as New Deal defaults.

Still required before PASS:

- wire `src/app/App.jsx` to the governed workspace boundary;
- remove Demo defaults from fresh New Deal initialization;
- remove Demo calculation fallback after validation failure;
- route built-in sample studies through explicit Demo workspace;
- route old saved deals through explicit legacy hydration defaults;
- make Reset return an unsaved real deal to a blank New Deal workspace;
- prove the resulting runtime with regression and browser E2E.

## Release disposition

`NOT_READY`

No merge or deployment is authorized by this evidence record.
