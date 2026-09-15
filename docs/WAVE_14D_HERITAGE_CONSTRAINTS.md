# Wave 14D — Heritage Constraint Governance

## Scope

Wave 14D adds an evidence-backed heritage constraint register on top of the qualified Wave 14A specialized-asset evidence packet. It applies only to `HERITAGE_ASSET` and is intentionally non-calculative.

## Constraint taxonomy

The register can represent:

- designation or restriction
- protected elements
- conservation requirements
- adaptive-reuse requirements
- permitted-use constraints
- prohibited works
- approval/consent dependencies
- accessibility / fire / life-safety interfaces

Every constraint records case/property binding, source and evidence references, effective dates, professional preparation/review provenance, impact domains and SHA-256 integrity.

## Temporal control

Applicability is evaluated at the valuation date. Future and expired constraints are preserved but cannot satisfy current mandatory requirements. The packet separates effective, future and expired constraint IDs.

## Minimum professional completeness

A heritage asset requires at least one qualified effective:

1. `DESIGNATION_OR_RESTRICTION`
2. `CONSERVATION_REQUIREMENT`

If adaptive reuse is explicitly proposed, the packet additionally requires qualified effective:

3. `ADAPTIVE_REUSE_REQUIREMENT`
4. `APPROVAL_OR_CONSENT`

Only `VERIFIED` or `PROFESSIONAL_REVIEWED` records can satisfy these requirements. `ASSUMED` and `CLIENT_PROVIDED_UNVERIFIED` do not.

## Fail-closed controls

The workflow fails closed on:

- non-ready or tampered Wave 14A specialized packet
- cross-case or cross-property constraints
- invalid constraint hashes
- duplicate IDs
- constraint review after packet review
- missing required valuation-date constraints
- required constraints supported only by unverified/assumed evidence
- invalid temporal intervals

## Governance boundary

This layer does **not**:

- establish legal validity of a heritage designation
- establish heritage-authority approval or planning permission
- interpret statutes, permits or authority conditions as legal advice
- perform adaptive-reuse financial feasibility
- write valuation inputs
- perform valuation arithmetic
- select a valuation method
- certify a valuation
- authorize a transaction

The output is a professional constraint register for later HBU, planning, cost, development, valuation and reporting review workflows.

## Qualification marker

`WAVE_14D_HERITAGE_CONSTRAINTS=PASS`

Wave 14D remains an engineering candidate and must not be merged or deployed to production without explicit authorization.
