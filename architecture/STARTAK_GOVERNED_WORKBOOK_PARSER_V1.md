# STARTAK Real Estate — Governed Workbook Parser v1

Status: **CONTROL-PLANE + ACTUAL CSV PARSER IMPLEMENTATION — XLSX/XLS/XLSM NOT YET SUPPORTED**

## Purpose

IA-5 connects real spreadsheet source bytes to the IA-4 controlled spreadsheet import path without allowing a parser to become a source of authority, execute workbook logic, infer evidence, or bypass human approval.

The first supported physical format is deliberately narrow:

- UTF-8 CSV: supported through a deterministic literal parser.
- XLSX/XLS/XLSM: unsupported in this wave.
- Google Sheets / Excel Online: no live connector in this wave.

This scope provides an actual parser while avoiding an unreviewed third-party workbook dependency.

## Governing pipeline

`Source Document → exact bytes → SHA-256 → UTF-8 decode → literal CSV parse → explicit cell profile → normalized workbook snapshot → source-hash binding → IA-4 validation/diff → PROPOSE_WRITE → human approval → governed commit`

No step before the separately governed commit mutates canonical STARTAK state.

## Cryptographic source binding

The parser hashes the exact input bytes using the existing STARTAK SHA-256 implementation.

The resulting hash is carried in:

- `workbookSnapshot.contentHashSha256`;
- parser attestation `inputContentHashSha256`;
- parser attestation `outputContentHashSha256`;
- the downstream IA-4 import envelope.

The governed CSV bridge additionally requires an existing STARTAK source-document record and compares the parser hash against `sourceDocument.contentHashSha256`.

Any mismatch fails closed with `PARSER_SOURCE_HASH_MISMATCH` before a write proposal can be emitted.

## Parser identity and attestation

Current parser:

- `parserId = parser.csv-literal.v1`
- `parserVersion = 1.0.0`
- format = `CSV_UTF8`

The parser attests that it did **not** perform:

- formula evaluation;
- macro execution;
- external-link resolution;
- unit inference;
- evidence inference;
- semantic type inference.

These are explicit negative capabilities, not implied limitations.

## Explicit cell profiles

CSV itself does not contain governed STARTAK units, evidence references, or authoritative semantic types.

Therefore selected cells may receive metadata only through a separately supplied parser profile containing:

- exact A1 cell;
- explicit STARTAK value type;
- explicit unit for numeric values;
- explicit evidence references.

Unprofiled cells remain `STRING` with no unit and no evidence references.

The parser does not infer metadata from column names, labels, neighboring cells, formatting, filename, or content patterns.

## Formula handling

CSV values are parsed as literals. Nothing is executed.

An equals-prefixed value is marked as formula-like in the normalized workbook snapshot. IA-4 then fails closed with its existing `FORMULA_CELL_NOT_ALLOWED` control.

This prevents a parser from silently evaluating a formula or using an ungoverned calculated value as a canonical input.

## CSV parsing behavior

The parser supports:

- UTF-8 input;
- optional UTF-8 BOM removal for parsing while preserving the hash of the exact original bytes;
- configurable single-character delimiter;
- quoted fields;
- doubled quote escaping;
- commas/delimiters inside quoted fields;
- CRLF, LF and CR record endings;
- newlines inside quoted fields.

Malformed quoting fails closed.

Invalid UTF-8 fails closed.

NUL characters fail closed.

## Resource limits

To reduce parser abuse and unbounded memory use, v1 enforces deterministic limits:

- maximum bytes: 5 MiB;
- maximum rows: 10,000;
- maximum columns per row: 500;
- maximum characters per cell: 100,000.

Files exceeding a limit are rejected rather than partially parsed.

## Case isolation

The governed bridge requires:

- parser case ID = source-document case ID;
- parser case/project = downstream workbook case/project;
- canonical snapshot case/project = workbook case/project through IA-4.

A source document from another case fails closed with `PARSER_SOURCE_SCOPE_MISMATCH`.

Cross-case source reuse is not silently accepted even when file bytes are identical.

## Authority boundary

A successful parse means only that STARTAK deterministically interpreted the supplied CSV bytes according to an explicit profile.

It does **not** mean:

- the source is true;
- the source is current;
- the source is legally authoritative;
- the evidence is verified;
- the proposed values are approved;
- deterministic financial outputs may be overwritten;
- an investment decision has been made.

The parser sets:

- `sourceAuthorityPromoted=false`
- `canonicalMutationPerformed=false`
- `transactionAuthorized=false`

The governed bridge sets:

- `sourceDocumentBound=true` only after exact hash match;
- `evidenceVerifiedByParser=false`;
- `directWriteAuthorized=false`.

## Integration with IA-4

Once source binding succeeds, the parser snapshot enters the existing controlled spreadsheet import gate unchanged.

IA-4 remains responsible for:

- exact schema mapping;
- value type compatibility;
- unit compatibility;
- evidence allow-list checks;
- formula hold;
- canonical current-value comparison;
- full-batch fail-closed validation;
- diff generation;
- `PROPOSE_WRITE` envelope generation;
- human-review requirement.

IA-5 does not create a parallel write path.

## Implemented in this wave

1. governed parser/profile contracts;
2. deterministic UTF-8 CSV literal parser;
3. exact source-byte SHA-256 identity;
4. parser attestation;
5. explicit cell metadata profile;
6. malformed-CSV and invalid-UTF-8 fail-closed behavior;
7. parser resource limits;
8. formula-like literal marking without execution;
9. source-document hash binding;
10. source-document case isolation;
11. direct bridge into IA-4 controlled import;
12. architecture regression coverage.

## Explicitly not implemented

- native XLSX parsing;
- XLS/XLSM parsing;
- macro/VBA execution;
- Excel formula evaluation;
- external workbook link resolution;
- Google Sheets API connection;
- Microsoft Graph / Excel Online connection;
- automatic unit inference;
- automatic evidence inference;
- automatic source authority verification;
- canonical persistence;
- automatic write approval;
- transaction authorization.

## Next gate

The next workbook wave should be **IA-6 — Governed XLSX Parser Dependency Review + Adapter**.

Before any XLSX library is added, the dependency must be reviewed for:

- maintained security posture;
- supported file types and ZIP/XML attack surface;
- formula/macro behavior;
- external-link behavior;
- deterministic parsing characteristics;
- package-lock impact;
- audit vulnerability threshold;
- browser/server bundle impact;
- ability to disable or ignore active content;
- resource-limit enforcement.

The XLSX adapter must emit the same normalized workbook contract used by IA-4 and IA-5. It must not create a separate spreadsheet authority or decision path.
