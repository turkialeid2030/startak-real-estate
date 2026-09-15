# P52 — Fresh Composite Evidence Verifier

P52 verifies that externally supplied exact commit identity, release-artifact bytes and environment-config bytes match the schema-v3 P51 fresh governed-composite registry candidate while the authoritative canonical registry remains the exact legacy baseline.

## Required chain

P52 accepts only P51 `FRESH_COMPOSITE_REGISTRY_CANDIDATE_READY_NOT_ACTIVE` and re-hashes:

- the P51 candidate evidence record;
- the proposed schema-v3 registry logical object;
- the exact canonical JSON content bytes.

It also re-verifies the current registry with the strict legacy evaluator and requires its hash to equal the P51 current-registry binding.

## Evidence verification

P52 requires:

- exact 40-character observed Git commit SHA matching the candidate;
- release-artifact bytes whose SHA-256 matches the candidate;
- environment-config bytes whose SHA-256 matches the candidate;
- cycle and reviewer-lock bindings to remain exact.

The output records only references and cryptographic hashes. It does not embed artifact/config bytes in the result.

## Highest state

`FRESH_COMPOSITE_EVIDENCE_MATCH_NOT_ACTIVE`

This state establishes candidate evidence consistency only. It preserves:

- `candidateOnly=true`;
- `activeRegistryChanged=false`;
- `activationAuthorized=false`;
- `activationApplied=false`;
- `reactivationAuthorized=false`;
- `currentBaselineMutationPerformed=false`;
- `releaseStillBlocked=true`;
- all release/merge/deployment/go-live/transaction authority flags false.

## Operator CLI

`tools/fresh-composite-evidence-verifier.js` reads bounded regular files, rejects symlinks and unknown/duplicate/private-key arguments, limits release-artifact and environment-config input sizes, and writes restrictive JSON output where supported.

It never mutates `config/governance/canonical-baseline.json`.

## Remaining boundary

Fresh shadow verification, cutover rehearsal, cutover-safety evidence, owner activation authorization, an explicit activation-change contract and post-change Release Verify remain mandatory.

**Keep Draft. Do not merge or deploy.**
