# STARTAK Real Estate — PR #772 vs #773 sibling non-drop review

> 20 November 2026. Evidence-based **partial per-file diff review**, not a merge/cherry-pick or a claim that all historical UI regressions are closed.

## Confirmed structural facts

- [PR #772](https://github.com/turkialeid2030/startak-real-estate/pull/772): Draft; `mergeable=false` at inspection; base `feature/appraisal-input-gaps-20261030`; **5 changed files**.
- [PR #773](https://github.com/turkialeid2030/startak-real-estate/pull/773): Draft; `mergeable=true` at inspection; the **same base** `feature/appraisal-input-gaps-20261030`; **32 changed files**. [PR #767](https://github.com/turkialeid2030/startak-real-estate/pull/767) owns that base.
- File overlap between #772 and #773 is **exactly 2 files**, both E2E browser tests. The three files unique to #772 contain two JSX/UI diagnostic metadata changes and a dedicated workflow.
- GitHub mergeability metadata does not prove the type or location of merge conflicts. A sibling branch must not be dismissed as redundant merely because its parent has successors.

## Per-file disposition

| File from #772 | Overlap with #773 | Verified content of #772 diff | State in current `security/hardening-v1` source | Recommendation |
|---|---|---|---|---|
| `src/components/LocalDocumentEvidenceIntakePanel.jsx` | No | Add `data-reason-code` to OCR alert, parser reason and warning rows | `DiagnosticText.jsx` already emits **nested `data-diagnostic-code`** with localized Arabic/English text for OCR and manual warnings; parent `data-reason-code` alias is absent | **FUNCTIONAL EQUIVALENT FOR DIAGNOSTIC CONTENT; ATTRIBUTE-API DIFFERENCE**. Only port alias if a verified consumer requires it |
| `src/components/LocalDocumentEvidenceWorkspace.jsx` | No | Add `data-reason-code` to visually hidden verification-workflow status | Parent already exposes `data-verification-status`; child `DiagnosticText` emits `data-diagnostic-code='VERIFICATION_NOT_COMPLETE'` with localized explanation | **FUNCTIONAL EQUIVALENT FOR TESTED OUTPUT; ATTRIBUTE-API DIFFERENCE**. Determine if parent selector compatibility is required |
| `tests/e2e/run_audit_20261010_remaining_browser.js` | **Yes** | Replace raw diagnostic-code text checks with Arabic explanation plus `data-reason-code` checks | **Newer test already asserts** localized warnings, absence of raw code in text and nested `data-diagnostic-code` for `MANUAL_TRANSCRIPTION_UNVERIFIED` and `VERIFICATION_NOT_COMPLETE` | **FUNCTIONAL REGRESSION COVERAGE PRESENT** with newer advanced-mode routing; alias parity still unproven |
| `tests/e2e/run_audit_20261020_local_ocr_browser.js` | **Yes** | Assert localized Arabic OCR-page error and `data-reason-code='OCR_PAGE_INVALID'` | **Newer test already asserts** localized error message, no raw `OCR_PAGE_INVALID` in text, and nested `data-diagnostic-code='OCR_PAGE_INVALID'`; #773 advanced-mode routing retained | **FUNCTIONAL REGRESSION COVERAGE PRESENT**; validate any external reliance on old parent attribute before closure |
| `.github/workflows/owner-hidden-diagnostics-verification.yml` | No | Dedicated pinned-browser OCR/manual diagnostics and canonical release-test job | Workflow does not exist on latest security branch | **WORKFLOW COVERAGE REVIEW PENDING**; avoid duplicating already-present release/locale/owner CI without evidence |

## Review protocol and no-loss acceptance

1. Compare the complete content of each file with both branches and evaluate semantic differences against today's application, not against outdated screenshots.
2. **Do not blindly port** parent JSX attributes. `DiagnosticText.jsx` already emits nested `data-diagnostic-code` and localized text. Check whether any consumer actually requires the old parent-level `data-reason-code` name; if not, prefer the tested equivalent contract without duplicating metadata.
3. Retain the current E2E assertions validating localized Arabic explanations, no raw diagnostic strings in text, and nested `data-diagnostic-code`. Re-run them across supported browsers/widths after any future consumer-contract change; preserve #773 advanced-mode navigation.
4. Decide whether the dedicated workflow adds meaningful coverage over existing D04/One Batch/owner browser CI; keep immutable source/PR review evidence either way.
5. Record a reviewer-approved disposition for #772 after exact-head tests; **do not close, delete, rebase, merge, or retarget it automatically**.

## Governance

- This is a **verified difference review**, not completion of historical function parity for all 57 paths (W16) or all 110 PRs (W19/W24).
- #772's **exact DOM attribute name** is not present on #803, but its **user-facing localized diagnostic content and machine-readable code are demonstrably covered through `DiagnosticText` and current browser regression assertions**. Do not call this a missing feature without evidence of an external `data-reason-code` consumer; the separate workflow and formal PR disposition remain to review.
- Production and professional go-live authority: `HOLD_NOT_AUTHORIZED`.

## Follow-up verification: modern equivalent diagnostic contract

- Current `src/components/DiagnosticText.jsx`: wraps localized content in a `<span data-diagnostic-content data-diagnostic-code={diagnostic.code}>`, without displaying the internal code to the user.
- Current `src/i18n/diagnostic-presentation.js`: includes the Arabic messages for `OCR_PAGE_INVALID` and `MANUAL_TRANSCRIPTION_UNVERIFIED` that #772 required.
- Current `run_audit_20261010_remaining_browser.js`: asserts `[data-diagnostic-code="MANUAL_TRANSCRIPTION_UNVERIFIED"]` and `[data-diagnostic-code="VERIFICATION_NOT_COMPLETE"]`, checks localized visible text, and forbids raw code in visible content.
- Current `run_audit_20261020_local_ocr_browser.js`: similarly checks `OCR_PAGE_INVALID` via nested `data-diagnostic-code` with localized text and no raw code exposure.
- Therefore the earlier description "OCR diagnostic functionality missing from modern branch" was too strong and **is superseded by this verification**. The DOM selector/API name differs; old `data-reason-code` contract and dedicated workflow migration are not presumed required or waived.
