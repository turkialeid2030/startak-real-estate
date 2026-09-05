# STARTAK IA-7 — Governed XLSX Adapter v1

Status: **IMPLEMENTED / PENDING CI ACCEPTANCE**

Branch: `feat/governed-xlsx-adapter-v1`

Depends on:
- IA-4 Controlled Spreadsheet Import
- IA-6 XLSX Dependency Security Review

## 1. Purpose

IA-7 adds a governed XLSX ingestion adapter to STARTAK without making spreadsheet files authoritative and without allowing spreadsheet parsing to mutate canonical investment data directly.

The adapter converts exact XLSX bytes into a normalized workbook snapshot under an explicit parser profile, binds the result to a governed source-document SHA-256 identity, then hands the snapshot to the existing IA-4 controlled import layer. A successful parse therefore produces, at most, governed write proposals that remain subject to explicit human approval.

## 2. Non-negotiable boundaries

The XLSX parser SHALL NOT:

- evaluate spreadsheet formulas;
- execute macros or VBA;
- resolve external workbook links;
- execute DDE-style formula references;
- infer units;
- infer evidence provenance;
- infer underwriting value types;
- promote a source document to authoritative truth;
- write directly to canonical state;
- authorize a transaction;
- bypass the existing governed write lifecycle or human approval gate.

`READY_FOR_HUMAN_REVIEW` means only that the parsed values passed validation and governed write proposals may be reviewed. It does not mean canonical state changed and it does not authorize an investment or transaction decision.

## 3. Runtime pipeline

```text
Exact XLSX bytes
    ↓
SHA-256 identity
    ↓
IA-6 OPC hostile-container preflight
    ↓
IA-6 exact dependency authorization
    ↓
SheetJS CE 0.20.3 passive read
    ↓
Explicit XLSX parser profile
    ↓
Normalized workbook snapshot
    ↓
Source-document SHA-256 binding
    ↓
IA-4 controlled spreadsheet import
    ↓
Validation / diff
    ↓
Governed PROPOSE_WRITE records
    ↓
Explicit human review
    ↓
Separate governed commit lifecycle
```

## 4. Reviewed SheetJS dependency identity

IA-7 does not add `xlsx` to the repository production dependency manifests.

The only reviewed parser artifact is the IA-6 approved SheetJS CE artifact:

- package: `xlsx`
- version: `0.20.3`
- source: `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`
- license: `Apache-2.0`
- SHA-256: `8dc73fc3b00203e72d176e85b50938627c7b086e607c682e8d3c22c02bb99fe8`
- size: `2409319` bytes

The IA-7 CI workflow downloads this exact artifact, verifies SHA-256 and size before installation, installs it ephemerally with lifecycle scripts disabled, verifies the runtime package identity, and requires `package.json` and `package-lock.json` to remain unchanged.

Any other version, artifact source, package identity, archive hash, or runtime version is outside the IA-7 authorization boundary.

## 5. XLSX parser profile

`src/integration-governance/spreadsheet/xlsx/parser-profile.js` defines an explicit immutable parser profile.

A cell can acquire STARTAK underwriting metadata only when the profile explicitly declares:

- sheet name;
- A1 cell locator;
- `VALUE_TYPE`;
- unit for numeric values;
- evidence references, when applicable.

Unprofiled workbook cells do not acquire inferred units, evidence, or underwriting type.

Duplicate `sheetName!A1` profile locators are rejected.

## 6. Resource ceilings

IA-7 applies bounded parser limits to reduce denial-of-service and hostile-workbook risk:

| Limit | Maximum |
|---|---:|
| Sheets | 100 |
| Rows per sheet | 10,000 |
| Columns per sheet | 500 |
| Total cells | 100,000 |
| Characters per cell | 100,000 |
| Merged ranges per sheet | 10,000 |

A profile may choose stricter values but cannot exceed these ceilings.

## 7. Passive SheetJS adapter

`src/integration-governance/spreadsheet/xlsx/sheetjs-passive-parser.js` is the physical XLSX parser boundary.

Before SheetJS reads workbook content, the adapter requires:

1. valid XLSX input bytes;
2. deterministic SHA-256 calculation;
3. IA-6 OPC preflight success;
4. IA-6 dependency authorization success;
5. exact SheetJS runtime version `0.20.3`;
6. explicit XLSX parser profile.

The adapter preserves formulas as formula metadata when present but never evaluates them for canonical import.

Workbook formulas that contain external-workbook or DDE-style references are rejected by the governed XLSX layer rather than being resolved.

Hidden sheet state and merged ranges may be represented in the normalized workbook snapshot as structural metadata; neither grants data authority.

## 8. Controlled import bridge

`src/integration-governance/spreadsheet/xlsx/governed-xlsx-import.js` binds the XLSX parser to IA-4.

The bridge requires the parsed workbook content hash to match the governed source-document SHA-256 identity. Scope mismatches or hash mismatches fail closed.

The resulting workbook snapshot is then supplied to `buildControlledSpreadsheetImport`.

IA-4 remains responsible for import-level controls including:

- required-cell validation;
- formula-cell prohibition for governed imported values;
- exact value-type matching;
- exact unit matching;
- evidence-reference validation;
- canonical-scope matching;
- change detection;
- governed write proposal creation;
- no partial write proposal when the import contains validation holds.

No canonical mutation occurs inside IA-7.

## 9. Parser and import states

IA-7 preserves fail-closed semantics.

Typical outcomes include:

- parsed / normalized workbook eligible for IA-4 validation;
- IA-4 `READY_FOR_HUMAN_REVIEW` when all controlled-import checks pass and changes exist;
- IA-4 `NO_CHANGES` when governed values match current canonical values;
- IA-4 `HOLD_VALIDATION` when a governed cell fails formula, type, unit, evidence, or required-cell validation;
- parser rejection or exception for malformed, hostile, scope-mismatched, hash-mismatched, dependency-mismatched, or resource-limit-violating input.

None of these states authorizes a transaction.

## 10. Regression verification

`tests/architecture/run_governed_xlsx_adapter_contract_v1.js` provides dependency-free contract coverage for the IA-7 governance boundary, including:

- immutable XLSX profile creation;
- deterministic normalized parsing through an injected runtime boundary;
- exact dependency attestation;
- explicit numeric/SAR/RATIO metadata;
- no inference on undeclared cells;
- hidden-sheet handling;
- merged-range handling;
- source-document SHA binding;
- IA-4 end-to-end controlled import;
- changed versus unchanged values;
- governed write proposal generation;
- formula hold behavior;
- external workbook formula rejection;
- case-scope mismatch;
- source-hash mismatch;
- incorrect SheetJS runtime version;
- immutable outputs;
- no parser decision authority.

## 11. Real SheetJS verification

`tools/verification/xlsx/run_sheetjs_real_adapter_v1.js` verifies the physical parser path with the real reviewed SheetJS runtime.

The verification creates a real XLSX workbook, serializes it to bytes, parses those bytes through the governed adapter, and validates the resulting controlled import path.

Coverage includes:

- real XLSX read/write round-trip for test construction;
- exact runtime version;
- deterministic repeated parse;
- hidden sheets;
- merged ranges;
- formula preservation as metadata;
- formula-driven import hold;
- external-formula rejection;
- source-document hash binding;
- IA-4 controlled import and write-proposal behavior.

## 12. CI acceptance gate

`.github/workflows/xlsx-adapter-verify.yml` is the IA-7 acceptance workflow.

The job must pass all of the following:

1. repository dependencies install with `npm ci`;
2. dependency-free IA-7 contract regression passes;
3. exact SheetJS artifact downloads from the reviewed URL;
4. archive SHA-256 equals the IA-6 pinned hash;
5. archive size equals the IA-6 pinned size;
6. ephemeral install uses `--no-save --package-lock=false --ignore-scripts`;
7. runtime package is exactly `xlsx@0.20.3` with Apache-2.0 license;
8. `package.json` and `package-lock.json` remain unchanged;
9. real SheetJS IA-7 adapter verification passes;
10. repository `release:verify` remains green.

IA-7 is not merge-ready until this workflow and the repository-required checks are green on the pull request head.

## 13. Production dependency posture

IA-7 intentionally does not make SheetJS a normal production dependency in this task.

The implementation defines and verifies the governed parser boundary first. A later task may decide whether and how the reviewed parser artifact is packaged for production runtime. That decision must preserve:

- the exact reviewed artifact identity or trigger a new dependency review;
- OPC preflight;
- passive parser behavior;
- no formula/macro/external-link execution;
- explicit parser profiles;
- source-document hash binding;
- IA-4 validation and write lifecycle;
- human approval;
- auditability.

No future packaging choice may convert spreadsheet files into canonical truth by default.

## 14. IA-7 acceptance decision

IA-7 may be accepted only when:

- implementation files are reviewed;
- contract regression is green;
- real SheetJS CI is green;
- release verification is green;
- no production dependency manifest drift is introduced;
- no direct canonical write path is introduced;
- no transaction authorization path is introduced.

Until then, IA-7 remains **IMPLEMENTED / PENDING CI ACCEPTANCE**.
