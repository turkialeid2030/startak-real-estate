# STARTAK Real Estate — IA-6 XLSX Dependency Policy Evidence

Status: **ARTIFACT IDENTITY VERIFIED AND PINNED — GOVERNED WRAPPER REQUIRED**

Branch: `chore/integration-architecture-status-ia6`

## Purpose

This document records the policy evidence and machine-enforced provenance boundary established during IA-6 before any XLSX parser dependency may be installed or invoked.

## Preferred candidate

The reviewed candidate is SheetJS Community Edition `0.20.3`, using only the exact official artifact URL:

`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`

Required license: `Apache-2.0`.

The exact reviewed artifact is now pinned by byte-level SHA-256 evidence produced by a dedicated GitHub Actions integrity-review workflow.

## Trusted artifact integrity review

Workflow:

`.github/workflows/xlsx-artifact-integrity-review.yml`

Review execution:

- workflow run id: `33976591390`
- job id: `101334258811`
- result: `SUCCESS`
- exact URL: `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`
- SHA-256: `8dc73fc3b00203e72d176e85b50938627c7b086e607c682e8d3c22c02bb99fe8`
- artifact size: `2,409,319` bytes
- tarball entries: `26`
- package name: `xlsx`
- package version: `0.20.3`
- package license: `Apache-2.0`
- runtime dependencies reported by package metadata: `{}`
- npm lifecycle install scripts (`preinstall`, `install`, `postinstall`): none
- tarball unsafe dot-segment paths: none detected
- tarball absolute paths: none detected
- tarball symlinks: none detected
- top-level license/notice file check: passed

The workflow downloaded the exact official bytes, computed the digest from those bytes, inspected the archive, and did **not** install or execute the SheetJS package.

## Security floor

The machine policy rejects SheetJS CE versions below `0.20.2`.

Rationale recorded from the SheetJS security advisory history:

- CVE-2024-22363 affects releases through `0.20.1` and the remediation is `0.20.2` or later.
- CVE-2023-30533 affects releases through `0.19.2` and the remediation is `0.19.3` or later.

The security floor is a minimum control, not a substitute for exact artifact identity.

## Machine-enforced provenance policy

Implemented at:

`src/integration-governance/spreadsheet/xlsx/dependency-policy.js`

The policy requires all of the following before a candidate can become parser-authorized:

1. package name exactly `xlsx`;
2. reviewed version exactly `0.20.3` for the current IA-6 wave;
3. exact official SheetJS CDN artifact URL;
4. license exactly `Apache-2.0`;
5. SHA-256 digest in valid 64-hex form;
6. digest exactly equals the reviewed pinned value;
7. governed wrapper remains mandatory after the digest match.

Pinned review identity:

- `reviewApprovedSha256 = 8dc73fc3b00203e72d176e85b50938627c7b086e607c682e8d3c22c02bb99fe8`
- `reviewApprovedSizeBytes = 2409319`
- `integrityReviewWorkflowRunId = 33976591390`
- `integrityReviewWorkflowJobId = 101334258811`

For the exact reviewed identity, the dependency policy resolves to:

`APPROVED_WITH_GOVERNED_WRAPPER`

This means dependency identity has passed IA-6. It does **not** mean arbitrary XLSX parsing or direct canonical writes are authorized.

## Passive parser authorization boundary

Implemented at:

`src/integration-governance/spreadsheet/xlsx/parser-authorization.js`

Passive parser invocation is authorized only when both conditions are true:

1. the dependency candidate matches the exact reviewed artifact identity; and
2. the workbook itself has passed the dependency-free OPC preflight with `READY_FOR_PASSIVE_PARSER`.

The authorization object also binds:

- `caseId`
- `projectId`
- source SHA-256
- parser profile id/version

Even on success, the following remain false:

- formula evaluation authorization
- macro execution authorization
- external-link resolution authorization
- source-authority promotion
- evidence verification
- canonical mutation
- transaction authorization

## Fail-closed decisions

The dependency policy rejects:

- package names other than the reviewed `xlsx` package;
- versions below the security floor;
- non-official artifact sources;
- license mismatch;
- malformed SHA-256 values;
- any artifact digest different from the reviewed digest.

An unreviewed newer version is not silently accepted. It resolves to `HOLD_REVIEW_INCOMPLETE` and requires a new review.

A missing digest also remains `HOLD_REVIEW_INCOMPLETE`.

## Regression coverage

Dependency policy:

`tests/architecture/run_xlsx_dependency_policy_v1.js`

Coverage includes:

- semantic version ordering;
- missing digest HOLD;
- wrong digest rejection;
- exact reviewed digest `APPROVED_WITH_GOVERNED_WRAPPER`;
- `0.20.1` rejection;
- stale public npm `0.18.5` rejection;
- wrong source URL rejection;
- `exceljs` rejection by package provenance policy;
- license mismatch rejection;
- malformed digest rejection;
- unreviewed future version HOLD;
- immutable output and no-authority/no-write/no-transaction invariants.

Parser authorization:

`tests/architecture/run_xlsx_parser_authorization_v1.js`

Coverage includes:

- missing dependency digest blocks parser invocation;
- mismatched digest blocks parser invocation;
- stale dependency line blocks parser invocation;
- exact reviewed artifact plus valid OPC preflight authorizes only the passive parser boundary;
- formula/macro/external-link execution remain unauthorized;
- evidence/canonical/transaction authority remains false.

## IA-6 decision

For the exact SheetJS CE 0.20.3 artifact identified above:

**Dependency decision: `APPROVED_WITH_GOVERNED_WRAPPER`.**

IA-6 does not approve:

- a different SheetJS release;
- the stale public npm `xlsx@0.18.5` artifact;
- an artifact from another URL;
- an artifact with a different digest;
- another package with compatible API semantics;
- direct parser invocation that bypasses OPC preflight or STARTAK authorization.

## Next wave — IA-7

IA-7 may now implement the physical passive XLSX adapter for the exact reviewed dependency identity, subject to the existing controls:

1. OPC preflight runs first;
2. dependency identity and digest authorization passes;
3. parser options are versioned and passive;
4. formulas are preserved as metadata, never evaluated;
5. macros / embedded active content / external workbook links remain rejected or quarantined;
6. normalized workbook output preserves A1 provenance, hidden-sheet and merge metadata where supported;
7. exact source SHA-256 and parser/profile attestation are preserved;
8. normalized output enters IA-4 only;
9. no evidence verification upgrade occurs;
10. canonical writes remain human-approved and auditable.

## Boundaries

This IA-6 approval does not install SheetJS in the production application, change `package-lock.json`, parse a production XLSX file, execute formulas, execute macros, resolve external links, verify evidence, mutate canonical data, override deterministic financial/valuation outputs, modify decision-control state, or authorize a transaction.
