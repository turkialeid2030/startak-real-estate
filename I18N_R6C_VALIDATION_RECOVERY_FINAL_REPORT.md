# I18N_R6C_VALIDATION_RECOVERY_FINAL_REPORT

## Nature of this wave
Formal qualification only -- `PRODUCTION_CODE_CHANGES = 0`. `App.jsx` MD5 confirmed byte-identical before and after this wave. No defect was found requiring correction.

## Inventory
5/5 R6-VALIDATION rows reconciled, zero duplicates.

## Producer re-discovery (structural, not assumed)
Grep-counted exactly 3 `throw new ValidationError` sites in `numeric-safety.js`: `requireFinite`, `requireRange`, and the direct `STRICTLY_POSITIVE_DIVISOR_FIELDS` check -- matching the R6-0 inventory exactly.

## Boundary matrix (10/10, direct engine)
| Field | Value | Expected | Result |
|---|---|---|---|
| occupancyRate | 0, 1 | valid | PASS |
| occupancyRate | -0.0001, 1.0001 | invalid (OUT_OF_RANGE) | PASS |
| maxPaybackThreshold | 0.0001 | valid | PASS |
| maxPaybackThreshold | 0, -5 | invalid (STRICTLY_POSITIVE_REQUIRED) | PASS |
| buildingPrice | Infinity, -Infinity, NaN | invalid (FINITE_NUMBER_REQUIRED) | PASS |

## ValidationError contract
Confirmed: `field`, `value`, `rule`, `message_ar`, `message_en` all preserved on the thrown instance. Not merged with R6-B's `dealsError` -- confirmed two independent state variables (`activeValidationError` vs `dealsError`) in source.

## Live browser evidence (this session)
Triggered `occupancyRate=150%` in ar-SA: title, dynamic field-specific message ("قيمة حقل \"occupancyRate\" (1.5) خارج النطاق المسموح [0, 1]"), and stale-result suffix all rendered correctly; last-valid NOI (14,859,936) remained displayed, unchanged, throughout the invalid state.

**Active roundtrip** (ar→en→ar, error kept active): same field/rule, only presentation language changed; the raw invalid input value `150` itself remained in the input element unchanged across both switches -- read directly via `inputValue()`, not inferred from display text.

**Recovery** (corrected to 88%): disclosure cleared AND NOI changed to a new value (13,076,744, distinct from both the original 14,859,936 and any cached number) -- proving genuine recalculation occurred, not merely that the warning banner was hidden.

Zero cross-locale text leakage in either direction. Zero page errors across the entire session.

## Prior-wave freeze (all re-executed fresh, not assumed)
`run_r6a_full_closure.js` (13/13), `run_r6b_full_closure.js` (14/14, includes the malformed-deal real-path check), `run_r5e_full_closure.js` (17/17), `run_r6_validation_disclosure.js` (20/20) -- all PASS in this session.

## Financial/recommendation freeze
Unlevered engine output finite and well-formed; raw verdict remains a defined Arabic string -- confirmed unaffected by any R6-C qualification activity (none of which touched engine code).

## Regression
55/55 direct (17 new R6-C orchestrated assertions). Core 6/6, Secondary 7/7, Storage Provider 6/6, 0 page errors. Canonical source and `App.jsx` both unchanged.

## Gate
I18N_R6C_GATE = PASS
R6-A/B/C = CLOSED / FROZEN
I18N_R6_GATE = HOLD -- R6-D, R6-E remain.
