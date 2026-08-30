# I18N_R6B_DEALS_STORAGE_ERRORS_FINAL_REPORT

## Reconciliation
R6B_ERROR_ROWS = 6 = APP_DEALS_ERROR_ROWS(5) + STORAGE_ERROR_ROWS(1).

## Stable error codes (6, verified unique)
| Code | Producer | Trigger | Reachability |
|---|---|---|---|
| DEAL_NOT_FOUND | onLoadDeal | storage.get returns falsy | BROWSER_REACHABLE |
| DEAL_LOAD_FAILED | onLoadDeal | storage.get throws | BROWSER_REACHABLE |
| DEAL_SAVE_FAILED | onSaveNew | storage.set throws | BROWSER_REACHABLE (verified live) |
| DEAL_UPDATE_FAILED | onUpdateActive | storage.set throws | BROWSER_REACHABLE |
| DEAL_DELETE_FAILED | onDeleteDeal | storage.delete throws | BROWSER_REACHABLE |
| PERSISTENCE_UNAVAILABLE | createStorageProvider | neither provider available | UNREACHABLE_CURRENT_UI (thrown, never caught+displayed in App.jsx) |

## Architecture decision
Chose the smallest compatible shape: `setDealsError({ code, message_ar, message_en })` replacing `setDealsError("...")`. No competing framework built; `ValidationError`'s separate bilingual architecture was left untouched and not merged, per instruction.

## PersistenceUnavailableError
Extended with `.code = 'PERSISTENCE_UNAVAILABLE'`, `.message_ar`, `.message_en` while preserving `.message` (via `super(...)`, unchanged) and `.name` exactly -- any existing `.message`/`.toString()` consumer sees identical behavior. Verified programmatically.

## Live browser proof (not just code review)
Simulated a **real** storage failure by monkey-patching `localStorage.setItem` to throw for deal-prefixed keys (not by editing application logic), triggered an actual save through the UI, and confirmed:
- Arabic: "تعذّر الحفظ، حاول مرة أخرى"
- English (after full locale switch + panel reopen): "Save failed, please try again", with zero Arabic leakage.

This proves `DEAL_SAVE_FAILED` is genuinely `BROWSER_REACHABLE`, not just theoretically triggerable.

## Trigger-condition freeze
Every `if`/catch condition byte-identical to before -- only the argument passed to `setDealsError` changed shape (string → object). No catch was broadened, no new retry logic added, no threshold changed.

## R6-A / Validation / R5 freeze
Confirmed via source: `getDealDisplayName` call site and definition both intact; `validationDisclosure.title` t() call intact; `HostStorageProvider`'s exact `window.storage.get(key, false)` call signature unchanged.

## Regression
53/53 direct (14 new R6-B assertions, 1 self-caught test-logic error fixed same-turn: checked for `getDealDisplayName`'s call site + separate-file definition, not a non-existent in-App.jsx function body). Core 6/6, Secondary 7/7, Storage Provider 6/6, 0 page errors.

## Self-caught production error during implementation
While adding `const { t, locale } = useLocale();` to `DealsPanel`, a `str_replace` briefly deleted the adjacent `if (!open) return null;` guard. Caught immediately via source re-view before any build/test attempt, restored in the same turn.

## Malformed Saved Deal — real production path (final R6-B closure item)
Traced the actual load path structurally: `loadDeal()` → `storageProvider.get("deal:"+id)` → `JSON.parse(value)` → (no further structural validation) → state assignment. **Discovery**: a well-formed-but-incomplete JSON object is silently accepted (merged with defaults) -- the app currently rejects only when `JSON.parse` itself throws. The malformed fixture used (`'{ this is not valid json !!'`) matches this actual condition exactly, not an invented rule.

Injected this fixture directly into `localStorage` under the real `BrowserLocalStorageProvider` namespace (not via any internal helper), then drove the real UI: opened the panel, clicked the deal, triggered the genuine `loadDeal()` catch path. Verified in live Chromium:
- ar-SA: "تعذّر تحميل الصفقة", zero stack-trace/internal leakage.
- en (same raw fixture): "The deal could not be loaded", zero Arabic leakage.
- A well-formed control deal loaded successfully in both locales through the identical path -- rules out a false-positive.

**Second discovery, documented honestly per this task's own instruction**: the language-toggle button sits outside `DealsPanel` and is physically covered by the panel's full-screen overlay while open -- a true "switch locale while the panel is visibly open" click is not achievable in the current UI. This is a pre-existing layout characteristic, not a defect, and was not changed. The active-error roundtrip was instead verified as: close panel (confirmed `dealsError` state is independent of `dealsPanelOpen` -- closing does not clear it) → switch locale → reopen panel → same `DEAL_LOAD_FAILED` message correctly re-rendered in the new language, proving the semantic state truly survives the locale change without altering existing interaction behavior to force a click the UI doesn't support.

Permanent test: `tests/i18n/run_r6b_malformed_saved_deal_real_path.js`, 11/11 PASS, incorporated into `run_r6b_full_closure.js`.

## Gate
I18N_R6B_GATE = PASS
R6-A/B = CLOSED / FROZEN
I18N_R6_GATE = HOLD -- R6-C, R6-D, R6-E remain.

