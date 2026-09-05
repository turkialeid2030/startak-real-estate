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

The candidate remains `HOLD_REVIEW_INCOMPLETE`, not approved, until G3, G4, G5, G8, G9 and G10 are proven end-to-end.

## 6. Selected-candidate scorecard

| Gate | Requirement | SheetJS CE 0.20.3 current result |
|---|---|---|
| G1 Supply Chain | provenance, license, maintenance, advisories, dependency graph | PASS WITH PINNING REQUIREMENT |
| G2 Passive Parsing | literal/formula distinction without evaluation | PASS BY DOCUMENTED CAPABILITY; CODE PROOF PENDING |
| G3 Active Content | macros/external links/DDE fail closed or quarantine | PARTIAL PASS — dependency-free OPC preflight rejects known macro/external-link/embedded parts; relationship-content proof still pending |
| G4 Resource Safety | deterministic anti-bomb/resource limits | PARTIAL PASS — central-directory preflight enforces source, per-entry, aggregate, compression-ratio and entry-count limits before parser invocation |
| G5 Determinism | repeatable normalized output | PARTIAL PASS — preflight output is deterministic; parser-normalization equality remains pending |
| G6 Source Identity | exact hash + parser/profile attestation | PASS BY EXISTING IA-5 CONTRACT; XLSX BINDING PENDING |
| G7 Scope Isolation | case/project mismatch fails closed | PASS BY EXISTING IA-4/IA-5 CONTRACT; XLSX BINDING PENDING |
| G8 IA-4 Compatibility | parser output enters existing controlled import path only | HOLD — IA-7 ADAPTER PROOF REQUIRED |
| G9 Regression Coverage | hostile + valid workbook fixtures covered | PARTIAL PASS — OPC preflight regressions added; real XLSX parser fixtures remain pending |
| G10 Release Threshold | release verify + audit + deep/comprehensive gates green | IN CI ON CURRENT BRANCH HEAD |

Dependency decision: **`HOLD_REVIEW_INCOMPLETE`**.

## 7. Governed preflight implementation added in IA-6

IA-6 now includes a dependency-free OPC/ZIP central-directory preflight at:

`src/integration-governance/spreadsheet/xlsx/opc-preflight.js`

It executes before any future XLSX parsing library and currently enforces:

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
- rejection of `xl/vbaProject.bin` and VBA signature part;
- rejection of `xl/externalLinks/` parts;
- rejection of `xl/embeddings/` parts;
- no source-authority promotion;
- no evidence verification;
- no canonical mutation;
- no transaction authorization.

The preflight does not decompress XML and therefore does not claim semantic relationship inspection. That remains an explicit IA-7 gate.

## 8. Required governed wrapper design

The IA-7 wrapper must remain split into two trust zones.

### Zone A — container preflight before SheetJS

The dependency-free preflight is the first implementation of this zone. IA-7 must extend it as needed without weakening current controls.

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

## 9. Initial resource-policy proposal implemented for preflight

- compressed source file: max 10 MiB;
- total declared uncompressed OPC entries: max 100 MiB;
- single declared uncompressed entry: max 25 MiB;
- compression ratio: max 100:1 per entry;
- ZIP entries: max 5,000;
- entry name: max 4,096 UTF-8 bytes.

The remaining worksheet/cell/shared-string/XML semantic limits belong to IA-7 after the selected parser is pinned.

Crossing any implemented preflight limit produces a typed error and no parser invocation.

## 10. Regression coverage added

`tests/architecture/run_xlsx_opc_preflight_v1.js` covers:

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
- immutable non-authoritative output invariants.

Real SheetJS/XLSX fixtures are intentionally not added until the dependency is approved and pinned.

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

1. candidate comparison matrix — **COMPLETE v1**;
2. license/maintenance/security evidence — **COMPLETE FOR PRIMARY CANDIDATES, subject to final pin review**;
3. dependency graph review — **COMPLETE AT PACKAGE-METADATA LEVEL; exact selected tarball review pending**;
4. explicit parser threat model — **DEFINED + PARTIAL CODE ENFORCEMENT**;
5. selected dependency or documented rejection — **PREFERRED CANDIDATE IDENTIFIED, final approval on HOLD**;
6. governed wrapper design — **DEFINED v1 + Zone A preflight implemented**;
7. no package-lock change until candidate passes review gate — **PRESERVED**.

## 13. Next implementation wave

IA-7 should now add real XLSX fixtures and a passive-parser proof around a pinned SheetJS CE 0.20.3 artifact only after final digest/provenance verification.

The physical adapter must bind the parser behind the existing preflight, preserve exact source SHA-256 and parser/profile attribution, detect formula/relationship/hidden-sheet metadata without evaluation, emit the IA-4 normalized workbook shape, and preserve human-approved writes only.

Until those gates pass, XLSX parsing remains intentionally unavailable rather than silently falling back to an ungoverned library.
