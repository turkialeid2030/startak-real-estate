# C49 — Internal Official Source Data Rights Readiness

## Purpose

C49 adds a fail-closed internal engineering layer for preparing the `SOURCE_RIGHTS_AUTHORIZATION` evidence expected by C30 external gate #548.

It binds the exact release candidate to the complete official-source universe already registered in `src/sources/saudi-official-source-catalog.js`, validates structural evidence integrity, and prevents source use or redistribution from being inferred from technical accessibility.

## Governance boundary

C49 is **internal engineering readiness only**. It does not satisfy external gate #548, does not create a licence, does not provide legal advice, and does not establish a lawful basis for access, processing, storage, derived use, or redistribution.

`C30 remains HOLD` while any required source lacks independently reviewable rights evidence.

Public visibility is not source-rights authorization. A reachable URL, a successful API request, a successful scraper, an official domain, or an engineering assumption that information is public does not establish permission to use, process, store, derive from, or redistribute that data.

## Required source universe

C49 requires complete coverage of the six sources in the existing Saudi official-source catalog:

- `REGA_REAL_ESTATE_INDICATORS`
- `GASTAT_REAL_ESTATE_STATISTICS`
- `ZATCA_REAL_ESTATE_TAX`
- `SAMA_REAL_ESTATE_FINANCE`
- `MOJ_REAL_ESTATE_TRANSACTIONS`
- `EJAR_RENTAL_ECOSYSTEM`

The source catalog remains discovery/governance metadata and does not itself constitute market evidence or rights authorization.

## External evidence expected for each source

For `SUPPLIED_VERIFIED`, the structural record requires:

- exact candidate Git SHA;
- canonical source identifier;
- lawful-basis references for access, processing, storage, derived use, and redistribution;
- licence/terms reference;
- restrictions reference;
- immutable evidence reference and SHA-256;
- accountable reviewer identity;
- verification timestamp and validity window when applicable.

`NOT_SUPPLIED` records cannot carry fabricated approval artifacts. `REJECTED` records require an explicit reason code.

## Decision semantics

- complete internal source-universe configuration → `READY_FOR_INDEPENDENT_SOURCE_RIGHTS_REVIEW`;
- missing/expired/tampered configuration → fail closed;
- any missing required external source → `HOLD_EXTERNAL_RIGHTS_AUTHORIZATION`;
- any rejected source → `REJECTED` and may contribute to C30 `NO_GO`;
- all records structurally `SUPPLIED_VERIFIED` → `READY_FOR_C30_GATE_INGESTION` only.

Even a structurally complete external pack does not make C49 the legal decision-maker. C30 must validate the external authority and the release governance process must separately authorize activation.

## Explicit false authorities

C49 never sets any of these to true:

- source-rights authorization;
- production source-use authorization;
- redistribution authorization;
- deployment authorization;
- commercial go-live authorization.

Production source use remains blocked until C30 external authority is genuinely satisfied and a separate activation decision is made.

## External gate linkage

- tracker: issue #541
- gate: issue #548
- evidence ID: `SOURCE_RIGHTS_AUTHORIZATION`
- current external state: `NOT_SUPPLIED`
- effect: `HOLD`

The accountable owner remains the authorized legal/data-governance function. Engineering may prepare the evidence structure but may not self-approve this gate.
