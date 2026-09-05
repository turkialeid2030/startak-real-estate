# STARTAK Real Estate — IA-6 Governed XLSX Parser Dependency Review

Status: **ACTIVE REVIEW — PREFERRED CANDIDATE IDENTIFIED, NO XLSX DEPENDENCY INSTALLED**

Baseline main commit: `f4656bcffbcc950c5c0d6f34140d635762931f24`

## 1. Purpose

IA-6 is a mandatory dependency and attack-surface review before STARTAK introduces any XLSX/XLS/XLSM parser package.

The review exists to preserve the integration architecture established in IA-1 through IA-5:

- spreadsheet content is not automatically authoritative;
- parser success is not evidence verification;
- workbook cells cannot directly mutate canonical case state;
- deterministic financial/valuation outputs remain engine-owned;
- human approval remains required before governed canonical writes;
- case/project isolation and source hash identity remain mandatory.

No package is approved merely because it can read `.xlsx` files.

## 2. Required decision outcome

Every candidate dependency must end in exactly one state:

- `APPROVED_DEPENDENCY`
- `APPROVED_WITH_GOVERNED_WRAPPER`
- `REJECTED_DEPENDENCY`
- `HOLD_REVIEW_INCOMPLETE`

`HOLD_REVIEW_INCOMPLETE` is the default until all mandatory review evidence is present.

## 3. Mandatory review dimensions

### 3.1 Supply-chain and legal

- package provenance and publisher identity;
- license compatibility with STARTAK;
- release cadence and current maintenance status;
- security advisory history and unresolved vulnerabilities;
- transitive dependency graph and install-time scripts;
- package integrity and lockfile reproducibility.

### 3.2 Parser semantics

The selected parser must allow STARTAK to distinguish at minimum:

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

The implementation must define deterministic limits for at least:

- source file size;
- uncompressed archive size;
- compression ratio / ZIP-bomb protection;
- sheet count;
- row count;
- column count;
- total parsed cells;
- characters per cell;
- shared-string table size;
- relationship count;
- XML nesting / parser resource constraints where exposed by the dependency.

Limit violations must produce a typed HOLD/error result and no downstream write proposals.

### 3.5 Source identity and scope

Before IA-4 import logic can run:

- exact source bytes must be SHA-256 hashed;
- the hash must match the existing STARTAK source-document identity;
- `caseId` must match the owning source document;
- project scope must remain consistent;
- parser ID/version and parsing profile ID/version must be attested;
- parser output must preserve source hash and workbook identity.

Cross-case or cross-project contamination must fail closed.

### 3.6 Determinism

For identical source bytes, parser version and parsing profile, the normalized parser snapshot must be deterministic.

The parser must not depend on locale-sensitive, timezone-sensitive, network-dependent or mutable external state unless that state is explicitly versioned and prohibited from changing the interpreted workbook content.

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

## 4. Candidate comparison — evidence review 2026-09-05

### Candidate A — SheetJS Community Edition 0.20.3 from the official SheetJS distribution endpoint

**Provisional state:** `HOLD_REVIEW_INCOMPLETE` — preferred candidate for the IA-7 proof only if the governed wrapper and hostile-file gates pass.

Observed evidence:

- SheetJS documentation identifies its own CDN tarball as the authoritative current module source and states that the public npm `xlsx` package is stale at `0.18.5`.
- Current documentation shows installation of `xlsx-0.20.3.tgz` from `cdn.sheetjs.com` and recommends vendoring for stability.
- License: Apache-2.0.
- SheetJS CE is data-oriented and supports reading formulas as metadata; formula evaluation is not a required CE parsing behavior for this path.
- VBA payload extraction requires an explicit `bookVBA: true` option; the default does not expose the VBA blob.
- Workbook metadata exposes hidden sheet state and exact sheet/cell structures needed for governed normalization.
- Known older `xlsx` advisories are documented as fixed in later SheetJS releases; STARTAK must not use the stale npm `xlsx@0.18.5` line.

Remaining blockers before approval:

- independently pin and verify the exact tarball digest/vendor copy before package introduction;
- establish deterministic pre-parse ZIP/container limits outside the parser;
- prove that the chosen parse options do not evaluate formulas or pull active content;
- detect and quarantine external relationships before data reaches IA-4;
- execute hostile workbook fixtures and deterministic-repeat tests;
- run repository release/security gates after the exact dependency is introduced.

### Candidate B — `exceljs@4.4.0`

**State:** `REJECTED_DEPENDENCY` for untrusted STARTAK workbook ingestion at the current version.

Reasons:

- latest stable release remains 4.4.0;
- its published package has multiple transitive dependencies and open 2026 issues concerning vulnerable/outdated transitive packages;
- a 2026 high-severity advisory reports uncontrolled resource consumption in `Workbook.xlsx.load()` on crafted XLSX archives, with no patched upstream stable version identified in that advisory;
- this directly conflicts with STARTAK G4 resource-safety requirements for user-supplied workbooks.

This rejection is version-specific and may be revisited if upstream ships a patched release that satisfies IA-6.

### Candidate C — public npm `xlsx@0.18.5`

**State:** `REJECTED_DEPENDENCY`.

Reasons:

- the public npm line is stale relative to the current SheetJS CE distribution;
- known prototype-pollution / ReDoS issues were fixed after that line;
- using the stale registry artifact would fail STARTAK's supply-chain/security baseline.

### Candidate D — `xlsx-populate@1.21.0`

**State:** `REJECTED_DEPENDENCY` for the STARTAK ingestion boundary.

Reasons:

- original npm package is materially stale, with its last publish years ago;
- it brings additional dependency and maintenance risk without a security advantage over the preferred candidate;
- recent namespace/fork publications are not treated as equivalent to original upstream provenance and would require a separate supply-chain review.

### Candidate E — unofficial SheetJS/ExcelJS forks or republished packages

**State:** `REJECTED_DEPENDENCY` by default unless separately reviewed as a distinct supplier.

STARTAK will not adopt an unofficial security fork solely because it advertises patched dependencies. Publisher identity, provenance, release process and long-term maintenance must independently pass G1.

## 5. Current decision

No XLSX package is installed by IA-6.

The current preferred path is:

`SheetJS CE 0.20.3 official tarball/vendor candidate -> STARTAK governed preflight wrapper -> passive parse -> normalized workbook -> IA-4 controlled import`

The candidate remains `HOLD_REVIEW_INCOMPLETE`, not approved, until G4, G8, G9 and G10 are proven with code and hostile fixtures.

## 6. Selected-candidate scorecard

| Gate | Requirement | SheetJS CE 0.20.3 current result |
|---|---|---|
| G1 Supply Chain | provenance, license, maintenance, advisories, dependency graph | PASS WITH PINNING REQUIREMENT |
| G2 Passive Parsing | literal/formula distinction without evaluation | PASS BY DOCUMENTED CAPABILITY; CODE PROOF PENDING |
| G3 Active Content | macros/external links/DDE fail closed or quarantine | HOLD — WRAPPER PROOF REQUIRED |
| G4 Resource Safety | deterministic anti-bomb/resource limits | HOLD — PREFLIGHT REQUIRED |
| G5 Determinism | repeatable normalized output | HOLD — FIXTURE PROOF REQUIRED |
| G6 Source Identity | exact hash + parser/profile attestation | PASS BY EXISTING IA-5 CONTRACT; XLSX BINDING PENDING |
| G7 Scope Isolation | case/project mismatch fails closed | PASS BY EXISTING IA-4/IA-5 CONTRACT; XLSX BINDING PENDING |
| G8 IA-4 Compatibility | parser output enters existing controlled import path only | HOLD — IA-7 ADAPTER PROOF REQUIRED |
| G9 Regression Coverage | hostile + valid workbook fixtures covered | HOLD |
| G10 Release Threshold | release verify + audit + deep/comprehensive gates green | HOLD UNTIL DEPENDENCY INTRODUCTION |

Dependency decision: **`HOLD_REVIEW_INCOMPLETE`**.

## 7. Required governed wrapper design

The IA-7 wrapper must be split into two trust zones.

### Zone A — container preflight before SheetJS

This zone must inspect the OPC/ZIP container without executing workbook semantics and reject before parser invocation when any limit or active-content policy fails.

Minimum checks:

- exact source byte SHA-256;
- MIME/extension policy;
- ZIP signature/container validity;
- compressed source byte limit;
- total declared uncompressed bytes;
- per-entry uncompressed bytes;
- compression-ratio ceiling;
- entry count;
- relationship count;
- required workbook parts;
- reject `.xlsm` / VBA parts in v1;
- reject `xl/vbaProject.bin`;
- quarantine external-link relationship parts;
- reject embedded OLE/executable payload parts;
- reject unsupported encryption/password-protected workbooks in v1.

### Zone B — passive SheetJS normalization

Only a workbook that passes Zone A may be passed to the parser.

The adapter must use an exact, versioned parse profile and normalize only:

- sheet names/order;
- hidden sheet metadata;
- A1 coordinates;
- literal values;
- raw numeric/date representation;
- formula text/flags without execution;
- merged ranges;
- explicit hyperlink/external-reference metadata where exposed;
- source hash + parser/profile attestation.

No automatic canonical field mapping, unit inference, evidence promotion or decision write is allowed.

## 8. Initial resource-policy proposal for IA-7 tests

These values are security defaults for the first hostile-fixture implementation and may only be changed through an explicit versioned parser profile:

- compressed source file: max 10 MiB;
- total uncompressed OPC entries: max 100 MiB;
- single uncompressed entry: max 25 MiB;
- compression ratio: max 100:1 per entry and aggregate;
- ZIP entries: max 5,000;
- worksheets: max 100;
- rows per worksheet: max 100,000;
- columns per worksheet: max 1,000;
- total materialized cells: max 1,000,000;
- characters per cell: max 100,000;
- relationships: max 10,000;
- shared strings: max 1,000,000 entries and 50 MiB decoded text aggregate.

Crossing any limit must produce a typed parser HOLD and no `PROPOSE_WRITE` envelopes.

## 9. Required regression fixtures for IA-7

The eventual XLSX adapter must include fixtures for:

- valid literals across multiple sheets;
- quoted/text edge cases;
- dates and numeric cells;
- formulas preserved but not evaluated;
- formula-only cells producing the expected IA-4 HOLD where applicable;
- hidden sheet metadata;
- merged-cell behavior;
- malformed ZIP container;
- malformed XML;
- oversized workbook;
- excessive rows/columns/cells;
- compression-bomb style expansion;
- external workbook links;
- macro-enabled workbook rejection/quarantine;
- embedded object rejection/quarantine;
- encrypted/password-protected workbook HOLD;
- source SHA mismatch;
- case mismatch;
- project mismatch;
- duplicate source handling;
- deterministic repeated parse equality.

## 10. Forbidden outcomes

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

## 11. Review deliverables status

1. candidate comparison matrix — **COMPLETE v1**;
2. license/maintenance/security evidence — **COMPLETE FOR PRIMARY CANDIDATES, subject to final pin review**;
3. dependency graph review — **COMPLETE AT PACKAGE-METADATA LEVEL; exact selected tarball review pending**;
4. explicit parser threat model — **DEFINED; code enforcement pending**;
5. selected dependency or documented rejection — **PREFERRED CANDIDATE IDENTIFIED, final approval on HOLD**;
6. governed wrapper design — **DEFINED v1**;
7. no package-lock change until candidate passes review gate — **PRESERVED**.

## 12. Next implementation wave

IA-7 may now begin as a **dependency-free preflight and fixture wave first**. The preferred parser dependency must not be added until the container preflight, active-content classifier and hostile fixtures exist and can fail closed independently.

After that proof is green, IA-7 may pin the exact SheetJS CE 0.20.3 official tarball/vendor artifact, record its integrity, bind it behind the preflight wrapper, and rerun all release/security gates.

Until those gates pass, XLSX parsing remains intentionally unavailable rather than silently falling back to an ungoverned library.
