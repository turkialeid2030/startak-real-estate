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
| `src/components/LocalDocumentEvidenceIntakePanel.jsx` | No | Add `data-reason-code` to OCR alert, parser reason and warning rows | No `data-reason-code` currently found in this file | **PORT/TEST PENDING**, preserve message localization and machine-readable code separately |
| `src/components/LocalDocumentEvidenceWorkspace.jsx` | No | Add `data-reason-code` to visually hidden verification-workflow status | Existing `data-verification-status`, missing `data-reason-code` | **PORT/TEST PENDING**, validate UI behavior and downstream readers |
| `tests/e2e/run_audit_20261010_remaining_browser.js` | **Yes** | Replace raw diagnostic-code text checks with Arabic explanation plus `data-reason-code` checks | Latest branch contains old raw-code checks and lacks `data-reason-code` assertions | **RECONCILE TEST PATCH** with #773 advanced-mode routing, not an unreviewed cherry-pick |
| `tests/e2e/run_audit_20261020_local_ocr_browser.js` | **Yes** | Assert localized Arabic OCR-page error and `data-reason-code='OCR_PAGE_INVALID'` | Latest branch retains old raw diagnostic text check; #773 altered advanced-mode routing | **RECONCILE TEST PATCH** with #773 navigation and current Arabic copies |
| `.github/workflows/owner-hidden-diagnostics-verification.yml` | No | Dedicated pinned-browser OCR/manual diagnostics and canonical release-test job | Workflow does not exist on latest security branch | **WORKFLOW COVERAGE REVIEW PENDING**; avoid duplicating already-present release/locale/owner CI without evidence |

## Review protocol and no-loss acceptance

1. Compare the complete content of each file with both branches and evaluate semantic differences against today's application, not against outdated screenshots.
2. Port the tiny JSX metadata attributes *only* after confirming exact diagnostic-code contracts and whether they may expose sensitive values (no customer text in attributes).
3. Preserve #773 advanced-mode navigation and its dependent follow-on changes. Bring over E2E assertions only after validating current localized output; run all browsers and test both widths where feasible.
4. Decide whether the dedicated workflow adds meaningful coverage over existing D04/One Batch/owner browser CI; keep immutable source/PR review evidence either way.
5. Record a reviewer-approved disposition for #772 after exact-head tests; **do not close, delete, rebase, merge, or retarget it automatically**.

## Governance

- This is a **verified difference review**, not completion of historical function parity for all 57 paths (W16) or all 110 PRs (W19/W24).
- #772's state remains unresolved; it carries source changes not demonstrably present on #803.
- Production and professional go-live authority: `HOLD_NOT_AUTHORIZED`.
