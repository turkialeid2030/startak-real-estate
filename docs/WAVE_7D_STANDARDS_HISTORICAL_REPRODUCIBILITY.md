# Wave 7D — Standards Historical Reproducibility

Status: **DRAFT / NON-PRODUCTION / NON-CERTIFYING**

## Purpose

Wave 7D preserves the exact standards/rules/context package used for a standards-routing decision so that a later reviewer can verify integrity, replay the stored decision deterministically, and detect router/runtime drift without silently consulting the then-current standards registry.

This is a governance and audit primitive. It does not establish legal applicability, professional authority, certified valuation status, or transaction authority.

## Replay package

A `StandardsReplayPackage` contains:

- case and engagement scope;
- assignment scope version;
- the immutable `StandardsSnapshot`;
- full normalized standard records used for routing;
- full normalized `StandardRule` records used for routing;
- exact routing context and conflict records;
- stored normalized route result;
- application/code artifact reference;
- a SHA-256 content hash over the full semantic payload.

The replay policy is explicit:

`STORED_FACTS_RULES_CONTEXT_ONLY_NO_CURRENT_REGISTRY_FALLBACK`

Historical replay therefore cannot silently substitute a newer standard, newer rule, current registry record, or different purpose context.

## Reproducibility states

- `REPRODUCIBLE` — package integrity is valid and the current router implementation reproduces the stored route result from the captured historical package.
- `DRIFT_DETECTED` — package integrity is valid but re-execution differs from the stored route result; this requires review and should not be silently normalized away.
- `HOLD_INTEGRITY_FAILURE` — package or snapshot integrity failed; replay is halted before routing.

Exact executable reconstruction also requires the captured code artifact/reference because a future application version may intentionally or unintentionally alter routing semantics.

## Append-only historical ledger

The library also provides an immutable, case-isolated hash-chained ledger for persisted replay-package references. Each entry records package hash, snapshot hash, code artifact reference, persistence actor/time, previous entry hash and sequence. Ledger verification checks sequence, previous-hash linkage, entry hashes and head hash.

This is an adapter-neutral persistence contract. A later storage implementation must preserve append-only semantics and must not overwrite historical packages in place.

## Production boundary

This Wave remains `NON_ENFORCING_HISTORY_LIBRARY_ONLY` and does not connect history/replay output to valuation calculations, reporting, saved deals, customer-facing decisions, or production enforcement.

The existing operating boundary remains unchanged:

- `UNLICENSED_DECISION_SUPPORT`;
- professional/certified valuation authority not established;
- legal approval not established by this library;
- `transactionAuthorized:false`;
- commercial external launch remains subject to the existing human legal/regulatory review gate.

## Regression coverage

`tests/architecture/run_standards_historical_reproducibility_v1.js` covers snapshot/package integrity, semantic tamper detection, current-registry isolation, deterministic replay, simulated router drift, integrity-hold behavior, snapshot/router version mismatch, append-only chain creation, case isolation, duplicate prevention, and ledger tamper detection.
