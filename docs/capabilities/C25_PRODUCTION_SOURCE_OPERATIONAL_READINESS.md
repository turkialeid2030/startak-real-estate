# C25 — Production Source Operational Readiness

## Purpose
C25 implements the P2 source-readiness gate from issue #521. It sits above C2N and determines whether a governed non-API source artifact is ready for use in an isolated pre-production workflow. It does not grant production use, transaction authority, or commercial go-live.

## Evidence-first rule
Public availability of a website or file is not treated as permission to automate, scrape, copy, reuse, or redistribute. C25 consumes the exact C2N source profile and acquisition record and requires an independently hashed operational-readiness record.

## Rights hard gates
The C2N rights mode determines the required C25 disposition:

- `PUBLISHED_OPEN_DATA_REUSE` → `OPEN_DATA_LICENSE_VERIFIED`
- `VERIFIED_RIGHTS_REQUIRED` → `VERIFIED_RIGHTS`
- `WRITTEN_PERMISSION_REQUIRED` → `WRITTEN_PERMISSION_VERIFIED`
- `TERMS_UNVERIFIED` → never ready for pre-production source use

The operational record binds a rights-evidence SHA-256. C25 does not invent a license or infer reuse rights from public access.

## Parser and schema governance
Every operational record contains:

- exact parser/extractor version;
- actual schema fingerprint SHA-256;
- expected schema fingerprint SHA-256;
- data-contract version;
- required-field validation result;
- silent-coercion indicator.

Schema drift, unvalidated parser, missing required-field validation, or silent coercion returns a HOLD. Unknown/mismatched fields are not silently defaulted.

## Freshness and outage
The record binds acquisition/published/review/freshness timestamps. Future records and stale source artifacts fail closed. `DEGRADED` or `OUTAGE` is not silently treated as available, and stale data is never relabeled as current.

## Conflict handling
Conflicting source values remain explicit and independently traceable. C25 does not average, overwrite, or auto-reconcile conflicts. An unresolved conflict returns `HOLD_CONFLICT`.

## Prohibited retrieval behavior
C25 preserves the C2N prohibitions against hidden-endpoint discovery, credential bypass, CAPTCHA bypass, access-control evasion, and rate-limit evasion. The operational-record constructor rejects any attempt to assert those behaviors.

## Integrity and lineage
The operational record exact-binds the C2N acquisition-record SHA-256 and artifact SHA-256 and has its own SHA-256. A tampered record or binding mismatch returns `HOLD_INTEGRITY`.

## Output authority
A successful result means only `READY_FOR_PREPRODUCTION_SOURCE_USE`. It does not establish source authority, certified valuation, legal entitlement, transaction authority, production deployment, Public AI, or commercial go-live.

## Qualification
The exact-head workflow must run:

- C25 rights/schema/parser/freshness/outage/conflict adversarial regression;
- inherited C24 integrated orchestration regression;
- canonical `npm run release:verify` including regression discovery, production build, package verification, audit, and baseline verification.

`MERGE HOLD = ON` and `DEPLOY = NO` remain in force.
