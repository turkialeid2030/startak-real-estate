# I18N_R5_0_AUTHORITATIVE_INVENTORY_REPORT

## Source
`I18N_R5_INPUT_PANELS_INVENTORY.csv` — 128 rows total (97 control rows + 31 property rows: 18 note + 8 warnText + 5 options).

## Panel boundaries
`BuildingInputPanel`: App.jsx lines 898–1002. `LandInputPanel`: App.jsx lines 1003–1093. Verified structurally via a DOTALL multi-line-aware regex (`<Component\b(.*?)/>`), not line-by-line scanning, after an earlier line-by-line parser was found to miss multi-line JSX blocks (see `R5_0C_PARSER_EXCEPTION_REGISTER.csv`).

## Wave distribution (all 128 rows)
| Wave | Control | Note | Warn | Options | Other | All rows |
|---|---|---|---|---|---|---|
| R5-A | 45 | 7 | 3 | 0 | 0 | 55 |
| R5-B | 37 | 5 | 3 | 0 | 0 | 45 |
| R5-C | 3 | 1 | 0 | 3 | 0 | 7 |
| R5-D | 12 | 5 | 2 | 2 | 0 | 21 |
| **Sum** | **97** | **18** | **8** | **5** | **0** | **128** |

## Controlled Enum Options Wave Ownership

There are 5 `SelectField` instances in the input panels, backing 4 unique enum fields (`financingStructureLabel` appears twice — once per study, with identical option values).

| # | field_name | study | control_wave | options_wave | raw_semantic | is_financing |
|---|---|---|---|---|---|---|
| 1 | leaseStatus | building | R5-C | R5-C | DISPLAY_ONLY | no |
| 2 | financingStructureLabel | building | R5-D | R5-D | DISPLAY_ONLY | **yes** |
| 3 | buildingTypeLabel | land | R5-C | R5-C | DISPLAY_ONLY | no |
| 4 | financingStructureLabel | land | R5-D | R5-D | DISPLAY_ONLY | **yes** |
| 5 | buildingPermitStatus | land | R5-C | R5-C | SEMANTIC (`=== "صادر"`) | no |

**Options rows by wave: R5-C = 3, R5-D = 2, sum = 5.**

### Policy
- **R5-C owns non-financing controlled enums** (`leaseStatus`, `buildingTypeLabel`, `buildingPermitStatus`) — 3 of the 5 SelectField instances, including the one field with real semantic logic (`buildingPermitStatus`).
- **R5-D owns `financingStructureLabel`** in both studies, because it is financing UI, not because of any raw-semantic property — `financingStructureLabel` is itself `DISPLAY_ONLY` (zero `===` comparisons found anywhere in source), identical in classification to `leaseStatus`/`buildingTypeLabel`. Its wave assignment is purely an **implementation-ownership** decision (financing UI is built as one cohesive unit in R5-D), not a semantic one.
- **Semantic status and implementation wave are two separate dimensions.** A field can be `DISPLAY_ONLY` and still belong to R5-D (financingStructureLabel); a field can be `SEMANTIC` and still belong to R5-C (buildingPermitStatus). Wave assignment follows UI ownership (which section/panel builds it), not semantic complexity.

### Correction of an over-broad prior statement
R5-0D's report stated `ALL_CONTROLLED_ENUM_PRESENTATION_ROWS_ASSIGNED_TO_R5C = TRUE`. This was imprecise — it conflated "all controlled enums are semantically similar" with "all controlled enums share one implementation wave." The actual CSV data was always correct (financingStructureLabel's 2 options rows were R5-D from the original extraction); only the summary sentence overclaimed. Corrected, precise statements:
- `ALL_NON_FINANCING_CONTROLLED_ENUM_PRESENTATION_ROWS_ASSIGNED_TO_R5C = TRUE`
- `ALL_FINANCING_CONTROLLED_ENUM_PRESENTATION_ROWS_ASSIGNED_TO_R5D = TRUE`
- `BUILDING_PERMIT_PRESENTATION_ROWS_ASSIGNED_TO_R5C = TRUE`

## Financing control instances (R5-D), explicit enumeration
Building (6): Section(971) + Toggle(972, leverageEnabled) + SelectField(978, financingStructureLabel) + PercentField(979, ltv) + PercentField(980, loanRate) + NumField(981, loanTenor).
Land (6): Section(1065) + Toggle(1066, leverageEnabled) + SelectField(1072, financingStructureLabel) + PercentField(1073, ltv) + PercentField(1074, loanRate) + NumField(1075, loanTenor).
Structurally symmetric between studies. Visibility: the financing Section is **always rendered** in both input panels (no conditional JSX wrapper) — `leverageEnabled` only toggles the Toggle control's own state, unlike the Dashboard's `MetricGroup`s which are conditionally hidden entirely.

## Reconciliation status
Method A (direct wave_id read per options row) and Method B (derived from parent-field financing classification) produce identical results for all 5 rows — 0 differences.

## Gate
R5_0E_GATE = PASS (see final response for full field list)
