# P29 — Reviewer Designation Ledger and Owner Operator

P29 operationalizes the owner's reviewer-selection authority introduced in P28 without treating a reviewer designation as an independent review.

## What it adds

- append-only reviewer-designation ledger bound to the exact P24 proposal and owner;
- deterministic `ledgerHashSha256`;
- strict replacement chain: each replacement must reference the immediately prior designation hash;
- duplicate designation IDs/hashes are rejected;
- replacement timestamps must increase;
- the ledger exposes only the current workflow reviewer plus the ordered designation history;
- operator CLI for preparing a new owner designation or replacement designation without accepting passwords, tokens, private keys or connection strings.

## Current reviewer

The current P28 designation remains:

- display name: `سعيد المراجع`
- reviewer ref: `reviewer:saeed-pending`

The owner may replace this reviewer later before an independent review is accepted. A replacement creates a new designation record and new designation hash. P26 must then generate a fresh review packet for that reviewer.

## Operator

```text
node tools/prepare-canonical-rebaseline-reviewer-designation.js \
  --proposal <proposal.json> \
  --owner-ref <owner-ref> \
  --reviewer-ref <reviewer-ref> \
  --reviewer-name <display-name> \
  --designation-id <id> \
  --source-ref <governance-reference> \
  --artifact-sha256 <sha256> \
  --designated-at <iso-timestamp> \
  [--prior-designation <prior-designation.json>] \
  [--output <designation.json>]
```

When `--prior-designation` is supplied, the new record is bound to the prior designation hash.

## Authority boundary

P29 does not create or approve an independent review. It does not verify the reviewer's identity or competence, does not change the canonical baseline, and does not authorize release, merge, deployment, go-live, professional issuance or transactions. P27 trust-registry and signed-attestation controls still apply to the final reviewer decision.
