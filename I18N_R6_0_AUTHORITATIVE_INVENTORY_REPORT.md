# I18N_R6_0_AUTHORITATIVE_INVENTORY_REPORT

## Method correction (learned from the earlier false negative)
The prior session's claim that `activeValidationError` was "never rendered" was itself a false negative from an incomplete `grep`. This inventory used **line-by-line Arabic-character scanning** across the complete structural boundaries of `DealsPanel` (1207–1326) and `App()` (1327–end), not pattern-based extraction alone — the first-pass regex for `DealsPanel` found only 6 of the actual 13 Arabic lines present.

## Authoritative totals
```
R6_TOTAL_INVENTORY_ROWS = 33
R6_SAVED_DEALS_ROWS = 14
R6_ERROR_ROWS = 6
R6_VALIDATION_ROWS = 5 (all 5 already LOCALIZED via the prior targeted fix)
R6_WARNING_ROWS = 0 (none discovered distinct from R6_ERROR)
R6_RECOVERY_ROWS = 0 (recovery IS the validation disclosure, counted under R6-VALIDATION)
R6_USER_CONTENT_EXCLUDED = 1 (d.name)
R6_INTERNAL_ONLY = 1 (PersistenceUnavailableError, unreachable in current UI)
R6_R7_DEFERRED = 6

DEALSPANEL_UNIQUE_CONCEPTS = 13 (12 static + 1 user-content exclusion)
VALIDATION_PRODUCERS = 3 (FINITE_NUMBER_REQUIRED, OUT_OF_RANGE, STRICTLY_POSITIVE_REQUIRED)
SAVED_DEAL_PERSISTED_FIELDS = 5 (id, name, mode, inputs, savedAt)
TRANSLATABLE_PERSISTED_FIELDS = 0
```

## Critical discovery: a persisted-schema-touching string, not just presentation
`App.jsx:1467` — `name: existing ? existing.name : "صفقة"` — this literal is written **into the Saved Deal record itself** when updating a deal that (edge case) has no resolvable existing name. Unlike every other R6-Saved-Deals string, translating this changes what gets **persisted**, not just what's momentarily shown. Deals already saved with this default name would keep "صفقة" forever regardless of future locale, since it's stored as plain text, not a translation key. This requires a deliberate implementation decision in the next R6 wave (leave as an Arabic default forever, since Saved Deal schema is frozen; or make the default locale-aware at write-time only, going forward) rather than a blind presentation swap.

## Second discovery: the pre-existing documented gap, now formally in scope
`title={activeDealId ? "التراجع عن التعديلات غير المحفوظة" : t("actions.reset")}` (line 1551) — confirmed still present, exactly as flagged in the original session summary's "Known i18n Gap." It's Saved-Deal-state-dependent (`activeDealId`), so it belongs under R6-SAVED-DEALS, not a separate miscellaneous bucket.

## Reused architecture confirmed sufficient
`ValidationError` already carries `message_ar` + `message_en` + a stable `rule` string (`FINITE_NUMBER_REQUIRED`, `OUT_OF_RANGE`, `STRICTLY_POSITIVE_REQUIRED`) — no new architecture needed for validation; R6-VAL-001 through 005 are already closed via the prior targeted fix session.

## dealsError architecture gap (unlike ValidationError)
The 5 `setDealsError(...)` call sites (R6-ERR-001 through 005) pass **plain Arabic strings directly**, not a bilingual object like `ValidationError`. This is architecturally different from validation errors and will need its own small bilingual-payload pattern (e.g. an object `{ message_ar, message_en }` or a stable-code + dictionary-key approach) — a minimal, non-breaking change to `setDealsError` call sites only.

## Approved invariant confirmed
The language-toggle button's `title` attribute intentionally shows the **destination** language name ("Switch to English" while in Arabic mode, "التبديل إلى العربية" while in English mode) — this is correct existing design, not a leak, and requires no change.

## R7-deferred items (explicitly out of R6 scope)
6 general-purpose disclaimer/heading strings inside `App`'s main render (lines 1585–1617) are unrelated to Saved Deals, Validation, Errors, Warnings, or Recovery — they belong to a future general sweep, not R6.

## Storage provider surface
`PersistenceUnavailableError`'s single Arabic message is the only Arabic string across all 4 storage-provider files — but it is thrown and never caught+displayed anywhere in current `App.jsx`. Classified `UNREACHABLE_CURRENT_UI`; not required for browser-matrix coverage per the request's own reachability-classification rule.

## Zero production changes
`App.jsx` MD5 unchanged from entry (`23416251c2884287a39b4f407d168049`) throughout this entire inventory pass. Canonical source SHA256 unchanged. Regression 51/51 maintained.

## R6-0 Gate
I18N_R6_0_GATE = PASS
R6_0 = CLOSED / FROZEN

## Recommended R6 implementation decomposition (for the next wave, not yet executed)
- **R6-A**: DealsPanel static presentation (13 concepts, straightforward `t()` swap, same pattern as R1-R5)
- **R6-B**: dealsError bilingual restructuring (5 call sites + display site — small, contained architecture addition)
- **R6-C**: the `activeDealId`-conditional reset-button title gap closure (1 string)
- **R6-D**: explicit decision + implementation for the persisted-default-name edge case (R6-DEAL-014)
- **R6-E**: integrated closure (mirroring R5-E's pattern)

I18N_R6_GATE remains HOLD pending this implementation.
