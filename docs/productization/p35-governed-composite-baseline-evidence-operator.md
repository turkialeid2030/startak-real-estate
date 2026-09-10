# P35 — Governed Composite Baseline Evidence Operator

P35 operationalizes the P34 candidate-only verifier without activating the governed composite baseline.

## Operator command

```text
node tools/prepare-governed-composite-baseline-evidence.js \
  --candidate <p32-candidate.json> \
  --artifact <release-artifact> \
  --environment-config <environment-config-artifact> \
  --commit <exact-40-char-git-sha> \
  --verification-id <id> \
  --verified-by <actor-ref> \
  --verified-at <iso-time> \
  --output <evidence.json>
```

The command always evaluates the repository's fixed current registry at `config/governance/canonical-baseline.json` and delegates digest/binding validation to P34.

## Fail-closed rules

- every documented argument is required exactly once;
- unknown arguments are rejected, including private-key style inputs;
- candidate/environment files are bounded in size;
- release artifacts are bounded before being read;
- symlinked inputs and output targets are rejected;
- malformed candidate JSON fails closed;
- P34 HOLD results exit non-zero and no evidence output file is written;
- input/IO exception details are reduced to safe error codes.

## Sensitive-data handling

The environment configuration and release artifact are read as raw bytes solely for SHA-256 comparison. Their contents are never serialized into the evidence JSON or stdout/stderr. The output contains the verified digests and governance bindings only.

## Governance boundary

The highest successful output remains P34's:

`COMPOSITE_BASELINE_EVIDENCE_VERIFIED_CANDIDATE_ONLY`

P35 does not activate `GOVERNED_COMPOSITE_BASELINE`, change the current P33 legacy release gate, close the missing historical canonical evidence, accept an independent review, satisfy E2I, or authorize release/merge/deploy/go-live/transactions.
