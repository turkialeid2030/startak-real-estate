# C5 — Governed Decision UI & Export Integration

## Purpose

C5 operationalizes the qualified C4 governed-decision snapshot in the existing-building valuation UI and in a deterministic JSON export path. It is an application and presentation integration layer only; it does not add valuation mathematics or decision/transaction authority.

Dependency base: `c4-governed-deal-decision-report-integration` @ `7d284563907bd1002694b944ecfea0d5208ef71e`.

## Runtime path

1. The canonical Saved Deal validator validates any optional `governedDealDecision` before application state is hydrated.
2. C4 metadata is accepted only for `building` mode and requires a valuation case whose `projectId` matches the governed snapshot.
3. `valuationCaseFromSavedDeal()` associates the exact loaded valuation-case object with the validated saved-record provenance in a session-only `WeakMap`.
4. `ValuationIntelligencePanel` mounts `GovernedDecisionOperationsPanel` for that loaded provenance context.
5. The operational evaluator re-validates the C4 snapshot and adds current-time freshness checks. A C4 snapshot that was valid when generated can therefore become operationally stale and is blocked from export.
6. Export is built through the canonical C4 governed report projection and wrapped in a deterministic C5 export envelope with a hash of the saved-deal state used for that export.
7. An unchanged saved deal may preserve its C4 snapshot on update. Any material saved-deal state change or valuation-case object replacement drops the session provenance association and prevents the prior C4 snapshot from being carried forward.

## Saved-record state hash

`computeSavedDealStateHash()` hashes the saved record after excluding only:

- `governedDealDecision` — excluded to avoid circular self-binding;
- `name` — presentation metadata;
- `savedAt` — persistence timestamp.

The remaining saved-deal content, including economic inputs and valuation/governance extensions, participates in the deterministic state hash. A material change therefore changes the hash.

## UI semantics

The C5 panel is Arabic-first and explicitly states that it represents the loaded saved-record snapshot. Unsaved edits are not claimed to be included. It displays:

- case/project/property identifiers;
- C4 snapshot status;
- analytical value indication and range;
- analytical confidence classification;
- eligible valuation approaches;
- human reviewer recommendation, if any;
- explicit authority boundary;
- C4 snapshot hash and saved-deal state hash;
- operational blockers when export is unavailable.

The reviewer recommendation is never rendered or interpreted as approval.

## Export classification

Every successful C5 export is classified:

`NON_AUTHORIZING_ANALYTICAL_OUTPUT`

The export includes the canonical C4 report, source saved-deal state hash, C4 snapshot hash, C4 report hash, deterministic C5 export hash and explicit disclosures.

## Fail-closed rules

Export is blocked when any of the following applies:

- no C4 governed snapshot is attached;
- saved-deal mode is not `building`;
- C4 hash/lineage/authority validation fails;
- valuation-case project binding is missing or mismatched;
- expected case/project/property context mismatches;
- snapshot or reconciliation time is in the future;
- reconciliation is stale relative to the current operational time;
- C4 report classification is not the non-authorizing analytical classification.

Malformed governed-decision saved records are rejected at the canonical Saved Deal validation boundary rather than repaired or silently stripped.

## Authority boundary

C5 preserves the following hard boundaries:

- `COMMERCIAL_GO_LIVE = HOLD`
- `TRANSACTION_AUTHORITY = FALSE`
- `PUBLIC_AI = FALSE`
- `CANONICAL_BASELINE_ACTIVATION_AUTHORIZED = FALSE`
- `APPROVAL_AUTHORIZED = FALSE`
- `FINAL_VALUATION_CONCLUSION_ESTABLISHED = FALSE`
- `CERTIFIED_VALUATION_ESTABLISHED = FALSE`

A successful export is permission to download a governed analytical artifact only. It is not authority to transact, approve, publish public AI, activate a canonical baseline, or issue a licensed/certified valuation.

## Release gate

C5 is technically qualified only when the exact PR head passes:

- C5 governed decision UI/export regression;
- C4 governed decision/report regression;
- canonical `npm run release:verify`.

The PR remains Draft/open/unmerged until separate merge authorization. No deployment is implied by technical qualification.
