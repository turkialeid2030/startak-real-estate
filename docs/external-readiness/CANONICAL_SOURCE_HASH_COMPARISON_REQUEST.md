# External Evidence Request — Canonical Source Hash Comparison

Issue: #203
Parent tracker: #202
Qualified E2I head: `f910a086039b0cbde93faa063b468bfd0c28a3f9`

## Objective

Independently compare the repository/source artifact used for qualification against the actual canonical original supplied from an authoritative external source or controlled archival source.

A skipped CI comparison, repository-generated copy, reconstructed text, self-supplied substitute or internally generated hash is not sufficient.

## Inputs to be supplied to verifier

1. Canonical-original artifact, or controlled immutable reference to it.
2. Provenance showing where and when the canonical original was acquired.
3. Exact repository/source artifact to be compared.
4. Exact commit / release-candidate reference under review.

## Required procedure

The verifier should:

1. Record canonical-original identifier, source and acquisition date.
2. Compute SHA-256 of the canonical original using a named tool/version.
3. Compute SHA-256 of the repository/source artifact being compared.
4. Confirm whether the compared byte streams are intended to be identical artifacts or whether an approved normalization method is required.
5. If normalization is required, document the normalization algorithm and preserve both pre-normalization and post-normalization hashes.
6. Produce an explicit result:
   - `MATCH`
   - `MISMATCH`
   - `INCONCLUSIVE`
7. Record verifier identity, independence statement and verification timestamp.

## Required evidence fields

- evidence ID
- verifier name / organization
- verifier role
- independence statement
- canonical source authority
- canonical source URL/reference
- acquisition date
- canonical original filename / identifier
- canonical original SHA-256
- compared artifact filename / identifier
- compared artifact SHA-256
- comparison tool and version
- normalization method, if any
- exact release-candidate / commit reference
- result
- exceptions / limitations
- evidence artifact SHA-256 or controlled evidence reference
- verification date/time

## Acceptance rule

Only `MATCH` closes #203.

`MISMATCH` or `INCONCLUSIVE` keeps release readiness on HOLD and requires investigation before any release authorization.

## Specific unresolved condition

Current Release Verify output has repeatedly stated that `CANONICAL_ORIGINAL_PATH` was not supplied/found. Those CI passes therefore do **not** establish external canonical-source equivalence.