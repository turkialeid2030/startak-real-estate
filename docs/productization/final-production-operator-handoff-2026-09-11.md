# Final Production Operator Handoff — 2026-09-11

## Purpose

This document is the final operator-facing handoff after the qualified production-chain integrity hardening. It converts the remaining work into a single externally executable checklist without creating another internal engineering gate.

It does not authorize merge, deployment, go-live, canonical-registry mutation, professional valuation issuance, or transactions.

## Qualified engineering starting point

The minimum strict production-trust implementation is:

- branch: `productization/production-derived-state-integrity-hardening`
- commit: `5d6ee418d29dd341062ae1368bfb830b1d9867b5`
- Release Verify: `#811` — PASS
- regression: `408 / 408`
- production build: PASS
- package verification: PASS
- npm audit: `0 critical / 0 high / 0 moderate / 0 low`

This reference supersedes the earlier structural-only production runbook as the minimum operator trust boundary. Documentation-only commits may advance after this reference; that does not reduce the requirement to use the strict runbook and its derived-state checks.

The checked-in canonical baseline remains unchanged:

- active mode: `LEGACY_FILE_SHA256`
- canonical registry SHA-256: `20664dcc406d01de485f9abd8031cbe74d5d677c01bb355e44b70f2fd4f5a343`

No production mutation is implied by this handoff.

## Operator sequence

The only valid production sequence from this point is:

1. **Real E2F production validation**
   - obtain the real external-conformance/security/performance/resilience packet;
   - retain its exact `validationPacketHashSha256` in an independently governed location;
   - the packet hash presented with the JSON packet is not, by itself, an independent trust root;
   - require strict derived-state verification before E2F may drive E2G.

2. **E2G human release authority**
   - prepare a real release-authority registry containing only public RSA material;
   - independently pin the normalized registry SHA-256;
   - obtain separate signed `RELEASE_APPROVAL`, `MERGE_APPROVAL`, and `DEPLOYMENT_APPROVAL` decisions;
   - preserve merge/deployment authority-subject separation;
   - independently pin the resulting E2G decision-packet SHA-256;
   - require strict derived-state verification before any authorization field is relied upon.

3. **Authorized external execution**
   - merge only the exact authorized source commit through the approved GitHub path;
   - deploy only the exact authorized artifact/environment/configuration tuple through the approved provider path;
   - retain immutable provider-side IDs, timestamps, logs and artifact references;
   - do not infer execution from CI success, a signing request, or an unverified packet boolean.

4. **E2H execution closeout**
   - prepare the real execution-attestor registry using public RSA material only;
   - independently pin its normalized registry SHA-256;
   - collect signed attestations for merge execution, deployment execution, post-deployment smoke, and rollback readiness;
   - deployment and smoke must be attested by different subjects;
   - independently pin the final E2H closeout-packet SHA-256;
   - require strict derived-state verification before execution flags are accepted.

5. **E2I external production readiness**
   - prepare the real readiness-verifier registry and pin its normalized SHA-256 outside the consuming workflow;
   - obtain exactly one signed response for every required E2I evidence class:
     - `CANONICAL_SOURCE_HASH_COMPARISON`
     - `SAUDI_LEGAL_OPERATING_MODE_REVIEW`
     - `PDPL_DATA_GOVERNANCE_REVIEW`
     - `PROFESSIONAL_STANDARDS_SCOPE_REVIEW`
     - `PRODUCTION_EXECUTION_CHAIN_CONFIRMATION`
     - `OPERATING_MODE_CLAIMS_RESTRICTION_CONFIRMATION`
   - use at least two distinct verifier subjects across the complete evidence set;
   - every evidence record must bind to the exact E2H closeout hash and exact release candidate;
   - independently pin the final E2I readiness-packet SHA-256;
   - require strict derived-state verification before `goLiveReady` is relied upon.

6. **Final read-only strict runbook evaluation**
   - supply E2F/E2G/E2H/E2I packets together with their independent packet-hash pins to `tools/production-go-live-runbook-strict.js status`;
   - require all five trust conditions: structural packet hash integrity, independent packet-hash pin, derived-state integrity, exact upstream packet binding, and release-candidate continuity;
   - the earlier `tools/production-go-live-runbook.js` is retained only for structural/pinning compatibility and must not be used as the complete production trust boundary;
   - the highest permitted engineering result is `GO_LIVE_READINESS_CONFIRMED_UNLICENSED_DECISION_SUPPORT`;
   - that result still does not itself perform or authorize the operational go-live action.

## Mandatory release-candidate tuple

The following values must remain exact across the complete chain:

- `releaseCandidateId`
- `sourceCommitSha`
- `artifactSha256`
- `environmentRef`
- `environmentConfigSha256`

A change in any one of these values requires a new evidence chain for the changed release candidate. Re-labeling or re-hashing a changed candidate does not preserve prior authorization.

## Independent pin rule

For every production packet and every public-key registry, the trusted expected SHA-256 must be retained through a control path independent from the JSON file being consumed.

Acceptable governance patterns include an approved immutable release record, controlled evidence ledger, independently retained artifact manifest, or equivalent separated trust path.

A JSON file plus a hash calculated from that same JSON by the same untrusted step is not an independent provenance control.

Independent pinning is necessary but is not sufficient by itself. The strict runbook must also verify that every derived status/authorization/execution/readiness field is consistent with the records already covered by the packet core hash.

## Private-key boundary

The repository intake tools and runbook must never receive:

- RSA private keys;
- passwords;
- API tokens;
- provider credentials;
- signing secrets.

Only public keys, public-key hashes, signed response records, independent registry/packet pins, and opaque evidence references belong in the handoff artifacts.

## Human approvals that remain external

The following cannot be manufactured by the repository or CI:

- identity and authority of the release/merge/deployment decision makers;
- legal conclusion for the Saudi operating model;
- PDPL/data-governance conclusion;
- professional-standards/valuation boundary conclusion;
- independent production execution-chain confirmation;
- production UI/report/marketing claims-restriction confirmation;
- the owner's final operational decision to expose the already validated deployment.

## Stop conditions

Stop the production sequence immediately if any of the following occurs:

- a packet or registry SHA-256 does not match its independent pin;
- a packet fails its structural integrity verifier;
- a packet fails strict derived-state integrity verification;
- any reported status/authorization/execution/readiness boolean disagrees with the hashed records from which it must be derived;
- a downstream packet references the wrong upstream packet ID or hash;
- the release-candidate tuple changes between stages;
- a required external signature is missing or invalid;
- a signer/verifier is outside the active period or allowed scope;
- deployment and post-deployment smoke use the same E2H subject;
- all E2I evidence is supplied by one verifier subject;
- any E2I result is `REJECTED` or remains `INCONCLUSIVE` when go-live readiness is requested;
- the operating mode differs from `UNLICENSED_DECISION_SUPPORT`;
- a required real external artifact is replaced by a synthetic test fixture.

If strict derived-state integrity fails, do not repair the JSON by editing booleans or status fields. Recreate the packet using the governed factory from trusted upstream inputs, pinned registries, signatures and evidence.

## Merge/deploy boundary

The current stacked PRs remain Draft. This handoff does not mark them ready for review, merge them, dispatch a deployment workflow, change Cloudflare, change the canonical registry, or expose the system publicly.

Those actions require separate explicit authorization after the relevant real evidence and human approvals exist.

## Machine-readable handoff template

Use:

`docs/productization/templates/production-go-live-handoff.template.json`

Template version 2 points explicitly to `tools/production-go-live-runbook-strict.js` and records a per-stage `derivedStateIntegrityVerified` field. It remains intentionally unpopulated and has `evidenceStatus=NOT_EVIDENCE`. Filling fields does not make them trusted; every packet/registry still requires the applicable cryptographic verification, independent pinning and strict derived-state verification described above.
