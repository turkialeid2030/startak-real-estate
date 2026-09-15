# P71 — Successor Fresh Composite Shadow Release Gate

## Purpose

P71 evaluates the P69 schema-v4 successor fresh composite candidate and the P70 exact-byte evidence side-by-side with the still-authoritative legacy canonical baseline. It is a shadow comparison only; it neither mutates the canonical registry nor grants activation, reactivation, release, merge, deployment, go-live or transaction authority.

## Inputs and trust boundary

The evaluator requires:

- the current canonical registry object;
- the exact raw bytes read from `config/governance/canonical-baseline.json`;
- the P69 successor fresh composite candidate;
- the P70 successor fresh composite evidence record.

P71 re-validates the P69 candidate shape/hash and recomputes the deterministic P70 evidence-record hash. It additionally requires the current registry raw bytes to parse to the supplied current-registry object and to match the exact prior raw-content SHA-256 already bound by P69/P70.

P71 does **not** re-create external release-artifact or environment-config bytes. Their exact-byte verification remains the responsibility of P70. A caller-supplied P70 record that is modified after creation fails the P71 deterministic hash check.

## Success state

`SUCCESSOR_FRESH_SHADOW_COMPOSITE_MATCH_NOT_ACTIVE`

This state means only that the following are mutually consistent:

- authoritative legacy logical registry hash;
- authoritative legacy raw-content SHA-256;
- P69 schema-v4 candidate logical/content hashes;
- P70 evidence hash;
- exact successor cycle, reviewer-lifecycle and activation-plan hashes;
- exact observed source commit, release-artifact SHA-256 and environment-config SHA-256;
- predecessor incident closeout, human decision, governance reset, RCA and CAPA hashes.

Even in this state:

- `activationAuthorized=false`;
- `activationApplied=false`;
- `reactivationAuthorized=false`;
- `currentBaselineMutationPerformed=false`;
- every release/merge/deployment/go-live/transaction authority flag is false;
- cutover rehearsal, cutover safety, fresh owner authorization, activation change contract and a successor-specific active-mode verifier remain required.

## Release Verify integration

`tools/successor-fresh-composite-shadow-release-gate.js` exposes a provider-neutral environment-driven gate using a namespace separate from the historical P53 schema-v3 shadow path:

- `SUCCESSOR_FRESH_COMPOSITE_SHADOW_CANDIDATE_PATH`
- `SUCCESSOR_FRESH_COMPOSITE_SHADOW_EVIDENCE_PATH`
- `REQUIRE_SUCCESSOR_FRESH_COMPOSITE_SHADOW=1`

When neither external input is supplied, the Release Verify step reports `NOT_EVALUATED`. When strict mode is requested and inputs are absent, it reports `MISSING_REQUIRED`. Partial input or any mismatch reports `HOLD` and fails the release verification run.

This preserves the existing CI policy: ordinary engineering CI can remain green while correctly reporting that real external successor shadow evidence has not been evaluated.

## Operational safety

The operator reads only bounded regular files, rejects symlinks and private/secret-key style arguments, and can optionally emit a restrictive-permission JSON result. It contains no registry writer and no activation path.

## Evidence limitation

Regression fixtures are synthetic/local evidence. Passing tests or a default Release Verify run does not establish real production provenance, real external reviewer/owner authorization, or permission to activate schema-v4.
