# E2C Trust-Root Designation Runbook — current

## Purpose

Prepare an owner/external-governance-approved E2C verifier registry for independent out-of-band pinning without creating any validation or production authority.

This runbook does **not** designate a verifier. Issue #371 remains the human/administrator decision gate.

## Required genuine inputs

1. Owner/external-governance decision identifying the verifier subject and authority class.
2. Approved public-key PEM only.
3. Public-key SHA-256 matching the repository normalization rule.
4. Governance evidence reference.
5. Effective `activeFrom` and optional `activeUntil`.
6. Actual reviewer subject refs appearing in the genuine E2B review evidence.

Private keys and passphrases must remain outside GitHub, CI and chat.

## Step 1 — populate the registry

Copy:

`governance/operator-templates/e2c-trusted-verifier-registry.input.template.json`

to an operator working file outside the committed template path and replace every placeholder with genuine approved public values.

The final registry must remain:

`status=EXTERNALLY_GOVERNED`

## Step 2 — populate reviewer subjects

Copy:

`governance/operator-templates/e2c-reviewer-subjects.input.template.json`

and list every real reviewer subject ref present in the E2B review evidence.

This list exists only to detect direct verifier/reviewer collisions before the trust root is pinned.

## Step 3 — normalize through the repository implementation

Run:

```bash
node tools/e2c-trust-root-designation-intake.js \
  --registry <REAL_E2C_REGISTRY.json> \
  --reviewer-subjects <REAL_E2C_REVIEWER_SUBJECTS.json> \
  --out <E2C_TRUST_ROOT_CANDIDATE.json>
```

Accept only:

`READY_FOR_INDEPENDENT_OUT_OF_BAND_PINNING`

The output supplies the deterministic repository `registryHashSha256` but explicitly records:

- `independentOutOfBandPinPresent=false`
- `privateKeyAccepted=false`
- `signingPerformed=false`
- `authorityEffect=NONE`

If a verifier subject collides with a reviewer subject, the tool fails with:

`E2C_VERIFIER_SELF_VALIDATION_RISK:<subject>`

## Step 4 — independent out-of-band pin

The exact `registryHashSha256` must be captured and approved through a channel independent of repository presence before E2C packet mode is allowed to rely on it.

Repository presence, green CI, an issue comment, or this runbook alone is not the out-of-band pin.

## Step 5 — only after genuine E2B evidence exists

Create canonical signing requests using:

`tools/e2c-external-authority-validation-intake.js signing-request`

Obtain genuine external `RSA-SHA256` signatures from the approved verifier(s), then build packet mode with the independently pinned registry hash.

Accept only:

`AUTHORITY_VALIDATION_COMPLETE_PENDING_SUBSTANTIVE_REVIEW`

## Hard boundary

This workflow does not establish substantive legal/professional/accounting/tax/data-governance conclusions and does not activate standards/rules or grant Release, Merge, Deployment, Transaction, professional or commercial authority.

`E2C_TRUST_ROOT_DESIGNATION_TOOLING=READY`
`E2C_VERIFIER_DESIGNATED=false`
`E2C_OUT_OF_BAND_PIN_PRESENT=false`
`E2C_PRODUCTION_ATTESTATIONS_PRESENT=false`
`AUTHORITY_EFFECT=NONE`
