# STARTAK Real Estate — IA-6 Governed XLSX Parser Dependency Review

Status: **DEPENDENCY REVIEW COMPLETE — SHEETJS CE 0.20.3 APPROVED WITH GOVERNED WRAPPER; NO XLSX PARSER INSTALLED**

Baseline main commit: `f4656bcffbcc950c5c0d6f34140d635762931f24`

## 1. Purpose

IA-6 is the mandatory dependency and attack-surface review before STARTAK introduces an XLSX/XLS/XLSM parser package.

The review preserves the integration architecture established in IA-1 through IA-5:

- spreadsheet content is not automatically authoritative;
- parser success is not evidence verification;
- workbook cells cannot directly mutate canonical case state;
- deterministic financial/valuation outputs remain engine-owned;
- human approval remains required before governed canonical writes;
- case/project isolation and source hash identity remain mandatory.

No package is approved merely because it can read `.xlsx` files.

## 2. Required decision outcome

Every candidate dependency ends in exactly one state:

- `APPROVED_DEPENDENCY`
- `APPROVED_WITH_GOVERNED_WRAPPER`
- `REJECTED_DEPENDENCY`
- `HOLD_REVIEW_INCOMPLETE`

## 3. Mandatory review dimensions

### 3.1 Supply-chain and legal

- package provenance and publisher identity;
- license compatibility with STARTAK;
- release/security posture;
- exact artifact identity;
- runtime dependency graph;
- install-time scripts;
- reproducible integrity pinning.

### 3.2 Parser semantics

The selected parser path must allow STARTAK to distinguish at minimum:

- literal values;
- formulas as formulas without evaluation;
- shared strings;
- dates and numeric serial representations without silently changing semantic meaning;
- booleans and blanks;
- sheet names and exact A1 cell coordinates;
- merged-cell metadata where relevant;
- workbook relationships and external-link presence;
- hidden sheets / workbook metadata where relevant to review.

No parser may silently infer evidence grade, source authority, units, business meaning, or canonical field mapping.

### 3.3 Formula and active-content boundary

The governed XLSX path must fail closed or explicitly quarantine:

- formula evaluation;
- macros / VBA;
- DDE or equivalent external execution references;
- external workbook links;
- embedded executable content;
- unsupported active content;
- formula-like content whose interpretation is ambiguous.

Formula text may be preserved as metadata for review, but it must not be executed by the parser boundary.

### 3.4 Hostile-file controls

The implementation defines deterministic container limits for:

- source file size;
- aggregate declared uncompressed archive size;
- per-entry uncompressed size;
- compression ratio / ZIP-bomb signals;
- ZIP entry count;
- entry-path safety;
- encryption;
- active-content parts.

Worksheet/cell/shared-string/XML semantic limits remain an IA-7 parser-wrapper responsibility.

### 3.5 Source identity and scope

Before IA-4 import logic can run:

- exact source bytes must be SHA-256 hashed;
- the hash must match the STARTAK source-document identity;
- `caseId` and `projectId` remain explicitly bound;
- parser ID/version and parsing profile ID/version must be attested;
- parser output must preserve source hash and workbook identity.

Cross-case or cross-project contamination must fail closed.

### 3.6 Determinism

For identical source bytes, parser version and parsing profile, the normalized parser snapshot must be deterministic.

The parser must not depend on locale-sensitive, timezone-sensitive, network-dependent or mutable external state to interpret workbook content.

### 3.7 IA-4 integration boundary

The XLSX adapter may emit only the normalized workbook snapshot required by IA-4.

IA-4 remains responsible for:

- exact cell-to-canonical-field mapping;
- type validation;
- unit validation;
- evidence allow-list checks;
- canonical case/project scope checks;
- full-batch fail-closed validation;
- import diff generation;
- `PROPOSE_WRITE` envelopes.

The XLSX parser itself must not create canonical commits.

## 4. Candidate comparison — final IA-6 decision

### Candidate A — SheetJS Community Edition 0.20.3, exact official artifact

**State: `APPROVED_WITH_GOVERNED_WRAPPER`.**

Reviewed artifact:

- package: `xlsx`
- version: `0.20.3`
- URL: `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`
- license: `Apache-2.0`
- SHA-256: `8dc73fc3b00203e72d176e85b50938627c7b086e607c682e8d3c22c02bb99fe8`
- size: `2,409,319` bytes
- tar entries: `26`
- runtime dependencies reported by package metadata: none
- npm lifecycle install scripts (`preinstall`, `install`, `postinstall`): none

Trusted integrity review:

- GitHub Actions workflow: `XLSX Artifact Integrity Review`
- workflow run id: `33976591390`
- job id: `101334258811`
- result: `SUCCESS`

The integrity workflow downloaded the exact reviewed URL, computed SHA-256 from the received bytes, checked package name/version/license, inspected tar paths and symlink posture, checked top-level license/notice presence, and did not install or execute the package.

The approval is limited to this exact artifact identity. A different version, URL, digest or package requires a new review.

### Candidate B — `exceljs@4.4.0`

**State: `REJECTED_DEPENDENCY` for untrusted STARTAK workbook ingestion at the reviewed version.**

The current IA-6 decision does not authorize ExcelJS as an interchangeable substitute. Any later version requires a distinct dependency review.

### Candidate C — public npm `xlsx@0.18.5`

**State: `REJECTED_DEPENDENCY`.**

The stale registry line is below STARTAK's configured security floor and is not equivalent to the reviewed official SheetJS CE artifact.

### Candidate D — `xlsx-populate@1.21.0`

**State: `REJECTED_DEPENDENCY` for the STARTAK ingestion boundary.**

### Candidate E — unofficial SheetJS/ExcelJS forks or republished packages

**State: `REJECTED_DEPENDENCY` by default unless separately reviewed as a distinct supplier.**

## 5. Machine-enforced dependency policy

Implemented at:

`src/integration-governance/spreadsheet/xlsx/dependency-policy.js`

The policy enforces:

- package exactly `xlsx`;
- reviewed version exactly `0.20.3`;
- security floor `0.20.2`;
- exact reviewed official URL;
- license `Apache-2.0`;
- valid SHA-256 format;
- exact digest match against the pinned reviewed value;
- governed wrapper required after approval.

Unreviewed newer versions resolve to `HOLD_REVIEW_INCOMPLETE` rather than being auto-accepted.

## 6. Passive parser authorization boundary

Implemented at:

`src/integration-governance/spreadsheet/xlsx/parser-authorization.js`

The authorization function independently re-evaluates dependency identity and requires a successful dependency-free OPC preflight.

Only the combination:

`exact approved artifact identity + READY_FOR_PASSIVE_PARSER OPC result`

can produce:

`PASSIVE_PARSER_INVOCATION_AUTHORIZED`

Even then:

- formula evaluation is unauthorized;
- macro execution is unauthorized;
- external-link resolution is unauthorized;
- source-authority promotion is false;
- evidence verification is false;
- canonical mutation is false;
- transaction authorization is false.

## 7. Selected-candidate scorecard

| Gate | Requirement | IA-6 result |
|---|---|---|
| G1 Supply Chain | provenance, license, exact artifact, dependency/install posture | PASS — exact artifact pinned and CI-reviewed |
| G2 Passive Parsing Boundary | parser identity can only enter behind governed authorization | PASS AT AUTHORIZATION LAYER — physical parser behavior remains IA-7 |
| G3 Active Content | macros/external links/embedded content fail closed before parser | PASS FOR CONTAINER-LEVEL SIGNALS — semantic relationship proof remains IA-7 |
| G4 Resource Safety | deterministic anti-bomb/resource limits before parser | PASS FOR OPC CONTAINER PREFLIGHT; semantic parser limits remain IA-7 |
| G5 Determinism | repeatable security/preflight and dependency-policy outputs | PASS FOR IA-6 CONTROL LAYERS; normalized XLSX parse equality remains IA-7 |
| G6 Source Identity | exact dependency hash plus source/parser/profile binding | PASS AT IA-6 AUTHORIZATION CONTRACT; source-document binding remains IA-7 adapter integration |
| G7 Scope Isolation | explicit case/project binding | PASS AT AUTHORIZATION CONTRACT; full adapter path remains IA-7 |
| G8 IA-4 Compatibility | parser output enters existing controlled import path only | DEFERRED TO IA-7 PHYSICAL ADAPTER — no alternate write path authorized |
| G9 Regression Coverage | hostile/control-path regression | PASS FOR IA-6 DEPENDENCY + OPC + AUTHORIZATION; real XLSX parser fixtures required in IA-7 |
| G10 Release Threshold | repository CI green on final IA-6 head | REQUIRED BEFORE PR MERGE |

Dependency decision for the exact reviewed artifact: **`APPROVED_WITH_GOVERNED_WRAPPER`**.

This is dependency approval, not parser implementation approval.

## 8. Governed OPC preflight implementation

IA-6 includes a dependency-free OPC/ZIP central-directory preflight at:

`src/integration-governance/spreadsheet/xlsx/opc-preflight.js`

It executes before any future XLSX parsing library and enforces:

- source byte cap;
- ZIP EOCD and central-directory bounds;
- no multi-disk/spanned archives;
- no ZIP64 in v1;
- entry-count cap;
- per-entry and aggregate uncompressed-size caps;
- compression-ratio cap;
- only STORE/DEFLATE compression methods;
- encrypted-entry rejection;
- path traversal/absolute-path rejection;
- duplicate-entry rejection;
- required XLSX OPC parts;
- rejection of `xl/vbaProject.bin` and VBA signature parts;
- rejection of `xl/externalLinks/` parts;
- rejection of `xl/embeddings/` parts;
- no source-authority promotion;
- no evidence verification;
- no canonical mutation;
- no transaction authorization.

The preflight does not decompress workbook XML and therefore does not claim semantic relationship inspection. That remains an IA-7 gate.

## 9. Initial resource policy

- compressed source file: max 10 MiB;
- total declared uncompressed OPC entries: max 100 MiB;
- single declared uncompressed entry: max 25 MiB;
- compression ratio: max 100:1 per entry;
- ZIP entries: max 5,000;
- entry name: max 4,096 UTF-8 bytes.

Crossing an implemented preflight limit produces a typed error and no parser invocation.

## 10. Regression coverage

IA-6 regression files:

- `tests/architecture/run_xlsx_opc_preflight_v1.js`
- `tests/architecture/run_xlsx_dependency_policy_v1.js`
- `tests/architecture/run_xlsx_parser_authorization_v1.js`

Coverage includes:

- valid deterministic OPC preflight;
- macro/VBA part rejection;
- external-link part rejection;
- embedded-object rejection;
- path traversal rejection;
- duplicate-entry rejection;
- encrypted-entry rejection;
- per-entry resource-limit rejection;
- compression-ratio rejection;
- required-part rejection;
- malformed/trailing-container rejection;
- dependency package/version/source/license controls;
- missing, malformed and mismatched digest controls;
- exact reviewed digest approval;
- unreviewed future-version HOLD;
- stale public npm `xlsx@0.18.5` rejection;
- passive parser invocation blocked unless dependency + preflight gates both pass;
- immutable non-authoritative output invariants.

Real XLSX parser fixtures remain intentionally an IA-7 requirement because IA-6 does not install the physical parser.

## 11. Forbidden outcomes

IA-6/IA-7 must not introduce any path that:

- executes workbook formulas;
- executes macros or active content;
- follows external links to obtain decision data;
- upgrades a workbook value to `VERIFIED_FACT`;
- writes directly to deterministic outputs;
- writes directly to decision-control state;
- writes directly to final investment decisions;
- bypasses IA-4 validation and human approval;
- treats workbook location, filename or worksheet title as source authority.

## 12. Review deliverables status

1. candidate comparison matrix — **COMPLETE**;
2. license/security/provenance evidence — **COMPLETE FOR SELECTED ARTIFACT**;
3. exact selected tarball identity + package metadata review — **COMPLETE**;
4. dependency graph/install-script review — **COMPLETE AT SELECTED ARTIFACT PACKAGE-METADATA LEVEL**;
5. explicit parser threat model — **DEFINED + CONTAINER/POLICY ENFORCEMENT IMPLEMENTED**;
6. selected dependency decision — **APPROVED_WITH_GOVERNED_WRAPPER**;
7. governed wrapper trust-zone design — **DEFINED; Zone A + authorization gate implemented**;
8. no parser package installation before review completion — **PRESERVED**.

## 13. Next implementation wave — IA-7

IA-7 may begin only from the exact reviewed SheetJS CE 0.20.3 identity above.

The physical adapter must:

1. keep OPC preflight ahead of SheetJS invocation;
2. pass the IA-6 dependency/parser-authorization gate;
3. use a versioned passive parsing profile;
4. preserve formulas only as metadata and never calculate them;
5. detect/quarantine relationships and active-content semantics not already blocked by OPC preflight;
6. preserve sheet order/name, hidden status, exact A1 coordinates, merges and typed literal representations;
7. impose worksheet/cell/shared-string/XML semantic resource limits;
8. preserve exact source SHA-256 and parser/profile attestation;
9. emit only the normalized workbook shape expected by IA-4;
10. preserve IA-4 full-batch validation, `PROPOSE_WRITE`, audit and human approval before canonical mutation;
11. leave deterministic valuation/financial outputs engine-owned;
12. keep final investment decisions human and `transactionAuthorized=false`.

Until IA-7 proves those parser-level gates, production XLSX parsing remains intentionally unavailable.
