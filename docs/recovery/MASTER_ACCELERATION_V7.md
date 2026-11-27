# MASTER ACCELERATION V7.0 — Controlled parallel closure

Baseline: V6.74 exact source 15e714e29af8eec07a19630f6ea9511633474093. Release Verify 46045542138 PASS 740/740, 55 named evidence, 35 assets. History scan 46045542226 FAIL. Production and merge remain HOLD.

## Workstreams and ownership
| Lane | Accountable role (assignment, not actual staffing) | Scope | Exit evidence | Depends on |
|---|---|---|---|---|
| A | Engineering lead | regression, bugs, hygiene, CI duplication | zero outstanding release-blocking defects, exact-head full regression/build | none |
| B | Security lead | tenant/IAM, secrets, PDPL/NCA, custody | isolation, rotated affected credentials, history scan and independent security signoff | G, external operators |
| C | Recovery lead | 57 known historical paths, 457 candidate files | reviewed dispositions, parity or justified retirement, tests and UI use | D, E, F |
| D | Valuation/finance lead | acquisition, valuation, financing, tax, decision engines | independently reviewed reference cases, arithmetic and integration | C, licensed source evidence |
| E | AI lead | model/provider and agent tools, redaction, evaluation, authorization | real provider receipts, benchmarks, adversarial tests, cost limits | B, G |
| F | Product lead | UX, all roles, buttons, reports, locales | browser matrix, end-to-end flows and independent UAT | C, D, E |
| G | Platform lead | API, DB, PostgreSQL, backup, DR, integrations | isolated and real staging evidence, RPO/RTO, observation | B, external infrastructure |
| H | Release owner | 125 acceptance gates, audit, exact-head integration and deployment | all mandatory gates, external approvals, release signoff | A–G |

Workstream statuses remain OPEN until their exit evidence is accepted. No real personnel assignments or production approvals are inferred. Preserve existing 125-gate register and detailed 57-path manifest; do not replace or inflate counts. Each task requires a unique original requirement, scope, status, commit, test result, blockers and reviewer. No duplicate closure credit.

## Execution
Use independent branches from the exact qualified baseline for disjoint work; integrate compatible changes by verified non-force updates and run full qualification at integration checkpoints. Avoid updating an in-progress qualification head. For overlapping files, coordinate before integration. No unapproved main merge, deployment, credential changes or history rewrite.

For preflight use `node tools/v7-ci-acceleration.js --targeted suite:architecture` or exact discovered test paths. `--list-targeted` prints the selection. Targeted success is diagnostic, never full qualification. Canonical release retains both pre-build and post-build regression suites, mandatory evidence, source binding, npm audit, manifest checks and all external gates. Reuse only the fresh build from the same canonical invocation; standalone package verification still builds. The static workflow census exposes literal duplicate calls for review, not proof of redundant equivalence. Do not disable workflow checks or skip tests solely because names match. Measure durations and actual runner minutes before further deduplication.

Parallelism means independent deliverables and isolated CI jobs; do not run unreviewed tests concurrently in a shared checkout. No calendar-time reduction claimed until measured. Prioritize blockers, not new features outside frozen release scope.


## V7.0 integration candidate — lanes B/D/E/F cross-lane hardening
Added nested forecast constructor replay (income, vacancy, expense) and explicit non-null halala totals in valuation source replay; operator session/action/evaluation plain-JSON boundary and strict calendar dates, future evaluation blocked; proof-grounded AI wrapper captures only own data descriptors before gateway, rejects malformed/accessor records without provider invocation. Added mandatory synthetic cross-lane test. Expected 742 regression files, 57 mandatory. Existing operator and AI evidence contracts are not production IAM or actual provider service. No live keys, UI workflow changes, external approvals or new closure credits. V7.0 CI still pending at preparation; stage separately to preserve exact-head qualification.
