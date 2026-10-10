# Owner financial study and saved valuation drafts

Audit reference: `Startak_Audit_Arabic_2026-10-10(3).docx`, dated 10 October 2026, sections 4–8, 10, 15 and 16. This is a scoped implementation of F03–F07, with the F01/F02 corrections from PR #657 retained. It does not close the entire audit or certify the platform.

## Changed behavior

| Finding | Implementation | Acceptance evidence |
| --- | --- | --- |
| F03 | Show simple cost/first operating NOI, cumulative operating recovery within the actual study, engine recovery horizon, and recovery including sale separately. A recovery relying on an end-of-year sale is recorded at that year end. | Fixed independent ratio, five-year holding period without operating recovery, year-five sale recovery, growing NOI and land calendar boundary regressions. |
| F04 | Valuation-editor and personal-report diagnostic messages have Arabic explanations and retain the original code. Unknown codes remain visible alongside a review explanation. This is not a complete platform-wide language/accessibility acceptance. | Known and unknown reason tests; current Arabic incomplete-form browser scenario is prepared but not yet run. |
| F05 | Saved deal names and user content bypass system-label replacement. Standalone HTML escapes user strings. | Actual DOM guard test including nested user text, mixed-language browser save/load/backup/restore and HTML export. |
| F06 | Keep building configuration while viewing land; preserve the active saved-deal identity and Zakat context per mode. Save optional versioned unapplied editor drafts with building deals and backup/restore. Applying a group retains edits in other groups while updating preserved applied fields. | Draft validation, rebase, real browser switching, reload and restoration from the downloaded backup. |
| F07 | Recalculate a full personal financial export from current inputs in both modes. Include inputs, canonical financial results, construction/operating timeline, financing, Zakat layer, separately labelled payback, calculated sensitivity, explicit stress assumptions and independent additional valuation indicators. | Current-input and invalid-input tests, full-report digest, desktop/mobile JSON and standalone Arabic HTML downloads. |

Unapplied editor data has status `UNAPPLIED_NOT_VERIFIED` and is never passed to the engines. Existing backup version 4 remains readable; the editor draft has its own version. A partial draft cannot become a verified valuation or override applied engine inputs.

An invalid current financial input yields a report with its original input, an explicit hold, `results: null` and no annual flows or scenario calculations. It never exports the previous valid UI result. The financial export contains an input fingerprint, report fingerprint and build trace; these prove internal traceability, not source truth or professional approval.

Sensitivities change one input by ±10%. Occupancy bounds are disclosed with requested and effective values. Stress scenarios are illustrative input tests, not forecasts or probabilities. Zakat uses the existing user-entered layer and does not calculate or assume a legal liability.

## Verification status

- Final local full release verification: 474/474 discovered regression suites, production build, package verification and zero reported npm audit vulnerabilities passed with the final runtime changes and draft rebase logic.
- Final focused F03–F07 test: 47 checks passed.
- Dedicated GitHub workflow binds the exact tested commit and requires focused regressions, actual Chromium desktop/mobile workflows, existing personal-export compatibility and full release verification to succeed.
- The new Playwright harness syntax check passed; it has not executed in a real browser. Real-browser and final source-head CI results are pending. No production deployment is claimed here.
- The local branch publication was blocked by automatic approval review for insufficient explicit authorization to publish code externally. The remote branch was confirmed absent; no new pull request or deployment is claimed. All local implementation and permitted validation continue.
- Some inherited regression scripts contain historical browser observations as fixed assertions. Passing those scripts is not evidence of a new browser execution; only a fresh successful Playwright run can close current runtime acceptance.
- The existing release verifier explicitly leaves external canonical-source evidence and composite cutover evidence as `NOT_EVALUATED` when their inputs are absent. A successful engineering gate is not a professional release authorization.

## Audit work still open

F10/F11: specialist asset models and professional method qualification; F14–F18: market/source records, complete documentary workflow including PDF/OCR, actionable gap closure and institutional identity. Also still open are the complete source/hosting/security review, access and tenant isolation, accessibility and actual device/load testing, governed local rules and taxes, qualified AI roles with measured accuracy, and commercial demand/pricing/cash-plan evidence. None is marked closed by this change.
