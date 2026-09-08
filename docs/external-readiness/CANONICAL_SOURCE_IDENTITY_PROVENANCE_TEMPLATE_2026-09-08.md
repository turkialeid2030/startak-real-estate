# STARTAK Real Estate — Canonical Source Identity & Provenance Record

Date: 2026-09-08
Parent tracker: #202
Workstream: #203

## Purpose

Close the provenance gap that exists before any meaningful `CANONICAL_SOURCE_HASH_COMPARISON` can be accepted.

The release verifier currently contains an expected SHA-256 value, but a hash by itself does not identify the authoritative artifact. An independent comparison is valid only after the canonical source is explicitly identified, its provenance is independently established, and custody/acquisition information is recorded.

This record is a template only. It is not evidence until completed and supported by independently verifiable source/custody records.

## A. Canonical artifact identity

```text
Canonical artifact title:
Canonical artifact identifier / reference number:
Issuer / authoritative source:
Jurisdiction / authority domain:
Document/artifact type:
Version / edition:
Publication / issue date:
Effective date (if applicable):
Language / locale:
Official source URL or authority reference:
```

## B. Independent acquisition provenance

```text
Acquired by:
Acquirer organization:
Acquisition date/time:
Acquisition route:
Source location / official portal / controlled handoff:
Was the source independently obtained outside the STARTAK repository? YES / NO
Evidence of acquisition retained at:
Acquisition evidence reference:
```

If the original is supplied by a STARTAK implementation actor without independent source corroboration, the comparison must remain `INCONCLUSIVE` for external-assurance purposes.

## C. Canonical-original integrity

```text
Canonical-original controlled file/reference:
File name / object identifier:
File size:
Hash algorithm: SHA-256
Computed SHA-256:
Hash computed by:
Hash computation tool / version:
Hash computation timestamp:
Was the file altered/normalized before hashing? YES / NO
If YES, explain exactly why and how:
```

Expected repository verifier constant currently observed:

`ac0767d3f13c463259f401a5d7af06c1140ee780a9f86489eb17ad9d7c72dc71`

This expected value must **not** be accepted as proof of canonical identity merely because it is present in code. The external provenance record must establish which authoritative original produced the expected hash and who independently verified that fact.

## D. Expected-hash provenance

```text
Who originally computed/approved the expected hash:
Date originally computed/approved:
Artifact from which it was computed:
Source/custody reference for that artifact:
Independent corroboration available? YES / NO
Corroboration reference:
Reason the expected hash is authoritative:
```

If expected-hash provenance cannot be independently reconstructed, status is:

`HOLD_EXPECTED_HASH_PROVENANCE`

and the existing embedded value may not be treated as an externally proven trust anchor.

## E. Repository/reference artifact to compare

```text
Repository/reference artifact name:
Repository path or controlled reference:
Commit / release candidate:
Artifact SHA-256 before comparison:
Relationship to canonical original:
Expected equivalence rule: BYTE_IDENTICAL / CONTROLLED_TRANSFORMATION / OTHER
If controlled transformation, transformation specification/reference:
```

A byte-hash comparison is meaningful only when `BYTE_IDENTICAL` is the intended equivalence rule. If the repository artifact is a transformed, extracted, normalized, translated or structured derivative, a different independently specified conformance method is required.

## F. Independent verifier

```text
Verifier name:
Verifier organization:
Verifier role:
Independence from implementation actors:
Conflict check reference:
Credential/authority basis (if applicable):
Credential verification source:
Verification date/time:
```

The verifier must not be the actor who created or modified the repository artifact being verified.

## G. Comparison execution

```text
Canonical original SHA-256:
Repository/reference artifact SHA-256:
Comparison tool / version:
Execution environment:
Comparison timestamp:
Result: MATCH / MISMATCH / INCONCLUSIVE
Reason / observations:
```

## H. Required disposition rules

### MATCH
May be recorded only when:
- canonical source identity is independently established;
- acquisition provenance is retained;
- expected-hash provenance is independently supported;
- the equivalence rule is valid for byte-level comparison;
- verifier independence is established;
- computed values match under the declared method.

### MISMATCH
Required when the relevant hashes differ under a valid byte-identical comparison.

### INCONCLUSIVE
Required when any material identity, provenance, custody, equivalence, verifier-independence or method question remains unresolved.

`INCONCLUSIVE` keeps #203 and production readiness on HOLD.

## I. Evidence references

```text
Canonical acquisition evidence reference:
Expected-hash provenance evidence reference:
Verifier identity/independence evidence reference:
Comparison output evidence reference:
Controlled repository/reference location:
Evidence manifest ID:
```

Do not place confidential or sensitive source material in public GitHub solely to complete this record. Store non-sensitive metadata/hashes here and retain the controlled original/evidence in an approved repository.

## Authority boundary

A successful canonical comparison establishes artifact integrity/equivalence only for the explicitly identified artifacts. It does not establish legal approval, professional standards conformance, licensing, PDPL compliance, production security/performance/resilience approval, release authority, deployment authority or transaction authority.
