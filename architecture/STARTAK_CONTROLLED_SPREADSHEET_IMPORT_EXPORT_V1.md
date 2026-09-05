# STARTAK Real Estate — Controlled Spreadsheet Import & Export v1

Status: **ARCHITECTURE + CONTROL-PLANE IMPLEMENTATION — NO LIVE XLSX/GSPREAD CONNECTOR YET**

## Purpose

This module defines how spreadsheets may participate in STARTAK Real Estate without becoming an uncontrolled source of truth or silently overriding governed analytical state.

Spreadsheets are treated as **controlled interchange and analysis surfaces**. They may carry proposed canonical inputs or receive governed exports, but they do not become authoritative merely because a value exists in a workbook.

## Governing doctrine

`Workbook Cell → Normalized Candidate → Evidence/Unit/Scope Validation → Import Diff → Proposed Canonical Write → Human Approval → Governed Commit`

For exports:

`Governed STARTAK Record → Provenance Validation → Explicit Mapping → Export Projection → Hash + Audit Envelope → External File/Sheet Adapter (future)`

The spreadsheet layer must never bypass the existing Document Intelligence, evidence, deterministic-engine, decision-control, or human-approval boundaries.

## Import contract

### Explicit mapping only

Each import field requires an explicit contract containing:

- mapping identifier;
- sheet name;
- exact A1 cell address;
- value type;
- unit for numeric values;
- required/optional status;
- evidence requirement;
- canonical target path.

Dynamic inference of target fields from labels, worksheet order, filename, or proximity is not allowed in v1.

### Importable namespaces

Spreadsheet imports may propose values only for canonical input namespaces:

- `property.inputs.*`
- `tenant.inputs.*`
- `regulatory.inputs.*`
- `valuation.inputs.*`
- `financial.inputs.*`
- `scenarioRisk.inputs.*`
- `decisionThresholds.inputs.*`

The schema rejects direct mapping to deterministic outputs, decision-control state, verified facts, or final investment decisions.

### Parser-neutral boundary

The v1 control plane consumes a normalized workbook snapshot. It does **not** claim native XLSX parsing, Google Sheets connectivity, formula evaluation, macro execution, or external workbook persistence.

A future parser/connector must emit the normalized workbook contract and remain separately attributable by parser/adapter ID and version.

### Formula policy

Imported formula cells are held in v1.

Reason: a formula result without a governed workbook-calculation context can hide dependencies, external links, stale recalculation state, circular references, macros, or workbook-specific assumptions. STARTAK therefore requires a literal normalized value at this boundary until a future governed formula-calculation adapter is explicitly implemented and verified.

### Value and unit policy

- Value type must match the mapping exactly.
- Numeric fields require an explicit unit.
- Unit must match exactly.
- No silent percentage/ratio, currency, area, date, or other unit conversion occurs at this layer.
- Normalization uses the existing deterministic Document Intelligence normalization functions.

### Evidence policy

When a mapping requires evidence:

- at least one evidence reference is required;
- every supplied reference must be present in the caller-provided case evidence allow-list;
- unknown or cross-case evidence references hold the import;
- the spreadsheet does not verify or promote evidence by itself.

### Full-batch fail-closed policy

Any material validation failure holds the **entire import batch**.

No partial write proposal is emitted when any required field has:

- a missing cell;
- a formula;
- a value-type mismatch;
- a unit mismatch;
- missing required evidence;
- an unknown evidence reference;
- value-normalization failure;
- an invalid current canonical value.

This prevents a partially accepted workbook from creating an internally inconsistent investment case.

### Diff before write

A valid workbook is compared against the current canonical snapshot.

Results are separated into:

- changed fields;
- unchanged fields;
- validation holds.

No canonical mutation occurs during comparison.

For each changed field, STARTAK creates a governed `PROPOSE_WRITE` envelope targeting `CANONICAL_INPUT` plus an immutable write proposal. The proposal remains in `PROPOSED` status and is not commit-eligible until explicit human approval under the separate write lifecycle.

## Export contract

### Exportable source classes

The v1 projection supports explicitly mapped export of:

- canonical inputs;
- deterministic outputs;
- AI interpretations.

This is an export/read surface only. Export does not grant any write authority back into STARTAK.

### Provenance preservation

Each exported cell carries source provenance, including as applicable:

- source kind;
- source path;
- source reference;
- evidence references;
- verification status;
- data-quality status;
- derivation reference;
- engine version;
- AI context hash;
- explicit `authoritativeForDecision` state.

The exported workbook projection itself is always marked `authoritativeWorkbook: false`.

### Deterministic-output rule

A deterministic output may be exported only when its metadata includes both:

- `derivationRef`;
- `engineVersionRef`.

This preserves the distinction between an engine-produced result and a free-standing spreadsheet number.

### AI-output rule

AI interpretation exports must include:

- evidence references;
- context SHA-256 hash.

AI interpretation is always exported with `authoritativeForDecision: false` regardless of the target workbook or source metadata.

The export process may not upgrade AI narrative into a verified fact, deterministic result, professional opinion, or final investment decision.

### Export packet integrity

The complete workbook projection is hashed with SHA-256 and wrapped in an immutable `EXPORT` integration envelope. This provides a stable identity for the exact exported projection before any future XLSX/Google Sheets writer is introduced.

## Security and governance invariants

- Workbook location is not source authority.
- File name, worksheet title, cell styling, or formula result is not evidence authority.
- Cross-case scope mismatch fails closed.
- Import targets are canonical-input namespaces only.
- Imported formulas are not evaluated or trusted.
- No silent unit conversion.
- Unknown evidence references hold the batch.
- No partial import on validation failure.
- No import directly changes deterministic outputs.
- No export upgrades source authority.
- AI remains non-authoritative.
- `PROPOSE_WRITE` is not a commit.
- Human approval remains mandatory for proposed canonical changes.
- `transactionAuthorized` remains false.

## Current implementation boundary

Implemented in this wave:

1. spreadsheet field/schema contracts;
2. exact A1 mapping validation;
3. controlled parser-neutral import diff;
4. full-batch fail-closed validation;
5. evidence allow-list checks;
6. formula rejection;
7. unit/type enforcement;
8. governed write-proposal generation;
9. provenance-preserving export projection;
10. deterministic-output derivation requirements;
11. AI evidence/context requirements;
12. export projection hashing;
13. regression coverage.

Explicitly not implemented in this wave:

- XLSX/XLS/XLSM/CSV parser adapters;
- Google Sheets API connector;
- Excel Online/Microsoft Graph connector;
- formula calculation engine;
- macro/VBA execution;
- external workbook writes;
- canonical database persistence;
- automatic write approval;
- automatic evidence verification;
- deterministic-engine mutation;
- transaction authorization.

## Next implementation gate

A live spreadsheet parser or external spreadsheet connector may be introduced only after this control-plane wave remains green under the repository release-verification suite.

The preferred next wave is a **governed workbook parser adapter** that binds the parsed workbook bytes to the same SHA-256 identity used by the import envelope and emits only the normalized workbook snapshot accepted by this module. A Google Sheets connector should follow the same contract rather than creating a second spreadsheet decision path.
