# STARTAK Real Estate — IA-6 XLSX Dependency Policy Evidence

Status: **ACTIVE REVIEW — FAIL-CLOSED POLICY ENFORCED, ARTIFACT DIGEST NOT YET PINNED**

Branch: `chore/integration-architecture-status-ia6`

## Purpose

This document records the policy evidence and machine-enforced provenance boundary added during IA-6 before any XLSX parser dependency may be installed or invoked.

## Preferred candidate

The preferred candidate remains SheetJS Community Edition `0.20.3`, using only the exact official artifact URL:

`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`

The SheetJS installation documentation identifies the SheetJS CDN as the authoritative distribution source for current releases and recommends vendoring the tarball for stability / supply-chain reduction.

Required license: `Apache-2.0`.

## Security floor

The machine policy rejects SheetJS CE versions below `0.20.2`.

Rationale recorded from the SheetJS security advisory history:

- CVE-2024-22363 affects releases through `0.20.1` and the remediation is `0.20.2` or later.
- CVE-2023-30533 affects releases through `0.19.2` and the remediation is `0.19.3` or later.

This security floor is a minimum gate, not an approval by itself.

## Machine-enforced provenance policy

Implemented at:

`src/integration-governance/spreadsheet/xlsx/dependency-policy.js`

The policy requires all of the following before any candidate can become parser-authorized:

1. package name exactly `xlsx`;
2. reviewed version exactly `0.20.3` for the current IA-6 wave;
3. exact official SheetJS CDN artifact URL;
4. license exactly `Apache-2.0`;
5. SHA-256 digest in valid 64-hex form;
6. digest must match a separately reviewed and pinned `reviewApprovedSha256` constant;
7. governed wrapper remains mandatory even after a digest match.

The current `reviewApprovedSha256` is intentionally `null`.

Therefore the exact preferred candidate still resolves to:

`HOLD_REVIEW_INCOMPLETE`

and `parserInvocationAuthorized=false`.

## Fail-closed decisions

The policy rejects:

- package names other than the reviewed `xlsx` package;
- versions below the security floor;
- non-official artifact sources;
- license mismatch;
- malformed SHA-256 values;
- a future artifact whose digest differs from the review-approved digest.

An unreviewed newer version is not silently accepted. It resolves to `HOLD_REVIEW_INCOMPLETE` and requires a new review.

## Regression coverage

Implemented at:

`tests/architecture/run_xlsx_dependency_policy_v1.js`

Coverage includes:

- semantic version ordering;
- missing digest HOLD;
- valid-but-not-yet-approved digest HOLD;
- `0.20.1` rejection;
- stale public npm `0.18.5` rejection;
- wrong source URL rejection;
- `exceljs` rejection by package provenance policy;
- license mismatch rejection;
- malformed digest rejection;
- unreviewed future version HOLD;
- immutable output and no-authority/no-write/no-transaction invariants.

## Artifact digest blocker

The official artifact digest has not been pinned in this branch because the connected execution environment could not independently download the CDN tarball for byte-level hashing during this review run.

STARTAK must not guess, copy an unverified third-party checksum, or approve the dependency without reproducing the digest from the exact artifact bytes.

The next approved action is therefore:

1. obtain the exact official tarball bytes through a trusted build/review environment;
2. compute SHA-256 locally;
3. record file size and archive metadata;
4. inspect package metadata / dependency graph / scripts;
5. pin the reviewed digest in `SHEETJS_CE_POLICY.reviewApprovedSha256`;
6. run the dependency-policy regression again;
7. only then begin the IA-7 parser implementation behind the existing OPC preflight.

## Boundaries

This IA-6 policy does not install SheetJS, change `package-lock.json`, parse an XLSX file, execute formulas, execute macros, resolve external links, verify evidence, mutate canonical data, override deterministic financial/valuation outputs, modify decision-control state, or authorize a transaction.
