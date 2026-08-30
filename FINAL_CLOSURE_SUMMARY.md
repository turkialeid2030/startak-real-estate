# FINAL_CLOSURE_SUMMARY

This supersedes FINAL_DEFECT_REMEDIATION_REPORT.md's defect table with the corrected, truly final state after D5 (verification) and D6 (correct execution) and D7 (cleanup).

## Final defect state
| Defect | Final status | Convention |
|---|---|---|
| DEF-001 | RESOLVED | Both studies: Forward NOI Cap (`saleValue/exitValue = noiYear*(1+g)/capRate`) |
| DEF-002 | RESOLVED | occupancyRate bounded [0,1] at engine boundary + bounded sensitivity |
| DEF-003 | RESOLVED | Number.isFinite() validation at engine boundary |
| DEF-004 | RESOLVED | maxPaybackThreshold strictly >0, both studies |
| COV-001 | RESOLVED | Permanent test: run_cov001_forward_noi.js |
| COV-002 | OPEN (untouched, out of scope) |
| OBS-001 | OBSERVATION (untouched, out of scope) |

## Correction of the historical record
D4 (an earlier wave) standardized both studies on Direct Cap. D5 (read-only verification) found this did not match the actually-required Forward NOI semantic. D6 executed the corrected decision: Existing Building's engine was modified for the first time in this entire session (adding the forwardNOI step it never had), and Land Development was reverted to its original Forward NOI behavior. D7 cleaned up: deleted the now-obsolete D4-era test, fixed two stale/misleading log messages in run_dual_path.js and run_triple_path.js that still described the superseded D4 state.

## Both engine files' change history (complete)
- `existing-building.js`: touched exactly once, in D6, to add the forwardNOI step. md5sum before: `303bc61d5a3ea3dba8c38de3d0a578a1`, after: `e71b703c0a641fe1123e664aec51252a`.
- `land-development.js`: touched twice -- D4 removed forwardNOI, D6 restored it, net effect is IDENTICAL to the original pre-remediation source for this specific formula.

## Final verification (this pass)
REGRESSION_TOTAL = 22/22 PASS (0 stale/expected failures remaining)
CORE_RUNTIME_E2E = 6/6 PASS (real Chromium)
SECONDARY_E2E = 7/7 PASS (real Chromium)
PAGE_ERRORS = 0
CANONICAL_SOURCE_HASH_UNCHANGED = TRUE (verified this pass, as every pass before it)

## Files removed this pass
`tests/defects/def001_decision_verification.js` -- explicitly authorized deletion, superseded by run_cov001_forward_noi.js.

NO_COMMIT = TRUE
