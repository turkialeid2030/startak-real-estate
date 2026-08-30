# I18N_R6A_SAVED_DEALS_FINAL_REPORT

## Inventory
14/14 rows localized. Full list in `I18N_R6_UI_STRING_INVENTORY.csv` (ids R6-DEAL-001 through 014, plus R6-GAP-001).

## Critical: DEAL_NAME_USER_EDITABLE investigation, resolved as CASE A
Exhaustive source search found **zero rename mechanism** anywhere in the codebase. The only writer of the literal `"صفقة"` is `updateActiveDeal()`'s defensive fallback (`existing ? existing.name : "صفقة"`), reachable only when `activeDealId` no longer resolves in `savedDeals` -- itself only possible via a rare cross-tab/session race, never a normal single-user flow (the function guards with `if (!activeDealId) return;`, and `activeDealId` is always set either from an existing `savedDeals` entry or immediately after a successful save). The "Save New" button is `disabled` while `saveNameInput` is empty, so a user can never directly create a deal literally named "صفقة" through the primary flow either.

**Conclusion: `DEAL_NAME_USER_EDITABLE = FALSE`** for this specific literal. Reclassified as `SYSTEM_GENERATED_PERSISTED_LABEL` per the request's Case A instructions.

## Implementation
Added `getDealDisplayName(deal, t)` to `domain-presentation.js` -- intentionally **different** in shape from the other four enum mappers (`getVerdictLabel`, `getBuildingPermitStatusLabel`, etc.): those throw on an unrecognized raw value because their domain is a closed, finite set. This function instead **passes through unchanged** for any name other than the exact literal `"صفقة"`, because any other name is legitimate user content -- not an error case. This distinction is deliberate and documented in the function's own comment.

Raw persisted record shape is byte-identical to before (`{ id, name, mode, inputs, savedAt }` in both save and update paths) -- confirmed via source grep, not just visual inspection. Only the **list rendering** call site was changed, from `{d.name}` to `{getDealDisplayName(d, t)}`.

## Dictionary
14 keys added under `savedDeals` in both `ar-SA` and `en`, exact parity confirmed programmatically.

## Browser proof
Real Chromium: saved a deal with genuine user-entered Arabic content ("مشروعي الأول"), closed the panel, switched to English, reopened the panel, and confirmed the name still displayed in Arabic exactly as entered -- while every surrounding application string (section labels, buttons) correctly switched to English. This is the critical proof that user content and application text are correctly separated.

## R6-B / R6-validation-disclosure / R5 freeze guards
Confirmed via source: all 5 `setDealsError(...)` calls remain hardcoded Arabic (R6-B's scope, untouched). The prior targeted validation-disclosure fix (`t("validationDisclosure.title")` etc.) remains intact. R5's closure tests were not touched.

## Gap closure
The pre-existing documented i18n gap (`activeDealId`-conditional reset-button title, flagged since the very first session summary) is now closed via `t("savedDeals.resetButtonTitleActive")`.

## Regression
52/52 direct (13 new R6-A assertions). Core 6/6, Secondary 7/7, Storage Provider 6/6, 0 page errors. Canonical source unchanged.

## Gate
I18N_R6A_GATE = PASS
R6-A = CLOSED / FROZEN
I18N_R6_GATE = HOLD -- R6-B (5 dealsError rows), R6-C, R6-D, R6-E remain.
