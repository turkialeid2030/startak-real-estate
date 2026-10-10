# Owner financial study and saved valuation drafts

Audit reference: `Startak_Audit_Arabic_2026-10-10(3).docx`, dated 10 October 2026, sections 4–8, 10, 15 and 16. This is a scoped implementation of F03–F07, with the F01/F02 corrections from PR #657 retained. It does not close the entire audit or certify the platform.

## Changed behavior

| Finding | Implementation | Acceptance evidence |
| --- | --- | --- |
| F03 | Show simple cost/first operating NOI, cumulative operating recovery within the actual study, engine recovery horizon, and recovery including sale separately. A recovery relying on an end-of-year sale is recorded at that year end. | Fixed independent ratio, five-year holding period without operating recovery, year-five sale recovery, growing NOI and land calendar boundary regressions. |
| F04 | Valuation-editor and personal-report diagnostic messages have Arabic explanations and retain the original code. Unknown codes remain visible alongside a review explanation. This is not a complete platform-wide language/accessibility acceptance. | Known/unknown reason tests and actual Arabic incomplete-form browser acceptance on the first published candidate. |
| F05 | Saved deal names and user content bypass system-label replacement. Standalone HTML escapes user strings. | Actual DOM guard test including nested user text, mixed-language browser save/load/backup/restore and HTML export. |
| F06 | Keep building configuration while viewing land; preserve the active saved-deal identity and Zakat context per mode. Save optional versioned unapplied editor drafts with building deals and backup/restore. Applying a group retains edits in other groups while updating preserved applied fields. | Draft validation, rebase, real browser switching, reload and restoration from the downloaded backup. |
| F07 | Recalculate a full personal financial export from current inputs in both modes. Include inputs, canonical financial results, construction/operating timeline, financing, Zakat layer, separately labelled payback, calculated sensitivity, explicit stress assumptions and independent additional valuation indicators. | Current-input and invalid-input tests, full-report digest, desktop/mobile JSON and standalone Arabic HTML downloads. |

Unapplied editor data has status `UNAPPLIED_NOT_VERIFIED` and is never passed to the engines. Existing backup version 4 remains readable; the editor draft has its own version. A partial draft cannot become a verified valuation or override applied engine inputs.

An invalid current financial input yields a report with its original input, an explicit hold, `results: null` and no annual flows or scenario calculations. It never exports the previous valid UI result. The financial export contains an input fingerprint, report fingerprint and build trace; these prove internal traceability, not source truth or professional approval.

Sensitivities change one input by ±10%. Occupancy bounds are disclosed with requested and effective values. Stress scenarios are illustrative input tests, not forecasts or probabilities. Zakat uses the existing user-entered layer and does not calculate or assume a legal liability.

## Verification evidence and limits

The first published candidate is `62443d8772d552548dc83c688a2cf9b59ea43073`. Publication followed the owner's explicit authorization. Current source-head CI results are maintained in [PR #659](https://github.com/turkialeid2030/startak-real-estate/pull/659); the following evidence is bound to this first candidate, not an untested future revision.

- [F03–F07 workflow](https://github.com/turkialeid2030/startak-real-estate/actions/runs/38019029527): all jobs and gate succeeded. Focused suite: 47 checks; retained F01/F02 suite: 24 checks.
- Actual Chromium at widths 1366 and 390: 46 checks passed, including current-input JSON, RTL HTML, original mixed-language names, invalid-input export holds, mode switching, saved-draft reload, backup-file restoration and deletion scope. Existing personal export compatibility: 12 checks passed.
- Independent release job: 474/474 discovered regression suites, production build, package verification, release verification and zero reported npm audit vulnerabilities passed. The local release verifier also passed.
- An additional Standards Provenance workflow used Node 20 and failed to load the locked jsdom 30 dependency (`webidl.util.markAsUncloneable is not a function`). That workflow is corrected to Node 24 and the explicit source head; its final success must be verified alongside the other final-head checks.
- Dedicated GitHub workflows bind the exact tested commit and require real-browser and release success. PR evidence is updated only after fresh successful jobs on the final head.
- Some inherited regression scripts contain historical browser observations as fixed assertions. They are labelled `NOT_RERUN`; only the fresh Playwright logs above are current browser evidence.
- External canonical-source evidence and composite cutover evidence remain `NOT_EVALUATED` when their inputs are absent. An engineering gate is not a professional release authorization.
- Width 390 is a real Chromium viewport test, not a physical-device/accessibility/performance certification. Main remains unchanged; no production deployment is claimed.

## Audit work still open

F10/F11: specialist asset models and professional method qualification; F14–F18: market/source records, complete documentary workflow including PDF/OCR, actionable gap closure and institutional identity. Also still open are the complete source/hosting/security review, access and tenant isolation, accessibility and actual device/load testing, governed local rules and taxes, qualified AI roles with measured accuracy, and commercial demand/pricing/cash-plan evidence. None is marked closed by this change.
