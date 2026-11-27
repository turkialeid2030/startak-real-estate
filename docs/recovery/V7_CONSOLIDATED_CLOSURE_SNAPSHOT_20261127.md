# V7 consolidation snapshot — 2026-11-27
## Exact qualified baseline
Candidate 07b93a6c9c1916b449f384ecae48f2def0e86cc6 (PR #875), Release Verify 46050389656 PASS 745/745, 60 named evidence, 35 assets. PostgreSQL 46050389645 PASS 15/15 in disposable database with synthetic data. Reporting 46050389649 PASS across Chromium/Firefox/WebKit. Product control census 46050390058 PASS in 3 browsers; each scope 108 states/240 navigation checks, not full control side-effect acceptance. History 46050389650 FAIL.
## Active stack (not independent versions)
| PR | Head | Base |
|---|---|---|
| #871 | 15e714e29af8eec07a19630f6ea9511633474093 | 9068a953d8597b5b10416af6a3290b1d724e867a |
| #872 | 03a9a908326485e087f2dcb362d30cadb219c95d | 15e714e29af8eec07a19630f6ea9511633474093 |
| #873 | c45ab00ff5e7511dd4c54ab90ae72a9ddd01173e | 03a9a908326485e087f2dcb362d30cadb219c95d |
| #874 | db10e93f25b08574dba6321e065279d6e3d2f134 | c45ab00ff5e7511dd4c54ab90ae72a9ddd01173e |
| #875 | 07b93a6c9c1916b449f384ecae48f2def0e86cc6 | db10e93f25b08574dba6321e065279d6e3d2f134 |
All draft and unmerged at inspection. Main b8ab7d3156a751ca57dec93ba9d9a7ad230b1566; compare ahead 1516, behind 0, merge base matches main; REST returned 300 files, NOT full diff count. Retain all refs and original issue scope; no main merge/force push/branch removal. New exact-tree diff census in dedicated read-only CI fetches main tree and compares candidate, outputs aggregate counts and digest only. This is not content review or ancestry/secret verification. Recompute on changed SHA.
## Acceptance mapping (original #835 remains authoritative)
| ID | Evidence observed | Outstanding (not closed) |
|---|---|---|
| QA01 | 108 states, 240 navigation checks per browser | all conditional controls and source-to-runtime disposition |
| QA02 | C26 synthetic role and MFA-labelled contract | actual roles, IAM and tenant journeys |
| QA03 | report stale-result/blocked export browser tests | all save/reload/restore/clone/delete and cross-case flows |
| QA04 | financial regression and synthetic reference cases | independent oracle and protected 17+4 cases, protected IRR |
| QA05 | planning, income, source and AI structural integration | all end-to-end integrations and authorized live sources |
| QA06 | three-browser AR/EN report and census | accessibility, screen reader, real phone/print UAT |
| QA07 | disposable PostgreSQL 15 groups, scoped code checks | credential remediation, live tenant isolation, independent security and DR |
| QA08 | C23/C26 synthetic AI review | approved real provider, live canary and benchmarks |
| QA09 | research report browser flows | complete business journeys and measured effects |
| QA10 | isolated backup/restore and regression | actual target SLO, fault and concurrent journeys |
| QA11 | historic register 22 restored unqualified /24 modern parity unverified /10 custody /1 retirement | functional parity and 457 candidate review |
| QA12 | exact-head canonical release PASS | all 125 gate dispositions and real independent evidence |
No acceptance credit granted by this mapping. All QA01–QA12 remain OPEN.
## QCR external blockers
Original #747 and #750–#761 inspected individually: 12 open; each states 0/3 independently verified and NO PERSON APPOINTED. Total 0/36 independently accepted in the issue register, 0/12 appointments recorded. Actual evidence may exist in authorized external custody, which was not inspected. No secret findings or property files copied to public repo. These are not 36 additional product gates or proof that no work was performed outside the repo.
Release remains HOLD_NOT_AUTHORIZED. Do not use this snapshot to replace the original 125-gate inventory, legal/technical gates or independent signatures. 
