# STARTAK Real Estate — IA-6 Governed XLSX Parser Dependency Review

Status: **DRAFT SECURITY / ARCHITECTURE GATE — NO XLSX DEPENDENCY APPROVED YET**

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

## 4. Forbidden outcomes

IA-6 must not introduce any path that:

- executes workbook formulas;
- executes macros or active content;
- follows external links to obtain decision data;
- upgrades a workbook value to `VERIFIED_FACT`;
- writes directly to deterministic outputs;
- writes directly to decision-control state;
- writes directly to final investment decisions;
- bypasses IA-4 validation and human approval;
- treats workbook location, filename or worksheet title as source authority.

## 5. Candidate scorecard

Each candidate must be scored and evidenced across these gates:

| Gate | Requirement | Result |
|---|---|---|
| G1 Supply Chain | provenance, license, maintenance, advisories, dependency graph | HOLD |
| G2 Passive Parsing | literal/formula distinction without evaluation | HOLD |
| G3 Active Content | macros/external links/DDE fail closed or quarantine | HOLD |
| G4 Resource Safety | deterministic anti-bomb/resource limits | HOLD |
| G5 Determinism | repeatable normalized output | HOLD |
| G6 Source Identity | exact hash + parser/profile attestation | HOLD |
| G7 Scope Isolation | case/project mismatch fails closed | HOLD |
| G8 IA-4 Compatibility | parser output enters existing controlled import path only | HOLD |
| G9 Regression Coverage | hostile + valid workbook fixtures covered | HOLD |
| G10 Release Threshold | release verify + audit + deep/comprehensive gates green | HOLD |

A dependency may be accepted only when every mandatory gate is PASS.

## 6. Required regression fixtures for the implementation wave

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
- source SHA mismatch;
- case mismatch;
- project mismatch;
- duplicate source handling;
- deterministic repeated parse equality.

## 7. Review deliverables

IA-6 dependency review is complete only when the branch contains:

1. candidate comparison matrix;
2. evidence for license/maintenance/security posture;
3. dependency graph review;
4. explicit parser threat model;
5. selected dependency or documented rejection of all candidates;
6. governed wrapper design if a package is selected;
7. no package-lock change until a candidate passes the review gate.

## 8. Next implementation wave

Only after IA-6 is approved should IA-7 implement the physical XLSX adapter.

IA-7 must bind the selected dependency to the IA-5 parser contract and IA-4 controlled import path while preserving:

- exact source SHA-256 identity;
- parser/profile attribution;
- passive parsing only;
- fail-closed active-content handling;
- resource limits;
- exact A1 provenance;
- evidence/source boundaries;
- human-approved canonical writes only;
- `transactionAuthorized=false`.

Until the dependency review is approved, XLSX parsing remains intentionally unavailable rather than silently falling back to an ungoverned library.
