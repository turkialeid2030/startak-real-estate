# External governance closure runbook — #327 + #371

## Purpose

Provide a deterministic handoff for the two remaining human/administrator gates without changing the frozen RC tuple and without fabricating authority.

This runbook does not designate any person, configure GitHub Environment protection, create an out-of-band pin, sign attestations, or authorize merge/deployment/Go-Live.

## Gate A — #327 production Required Reviewer

1. Copy `production-required-reviewer-designation.input.template.json` to a working file outside the committed template path.
2. Replace every placeholder with a genuine owner/governance-approved distinct GitHub identity.
3. Remove `templateOnly` or set it to `false` in the working copy.
4. Run:

```bash
node tools/production-required-reviewer-designation-intake.js \
  --designation <working-designation.json> \
  --out <normalized-designation.json>
```

5. Accept only:

`READY_FOR_GITHUB_ENVIRONMENT_CONFIGURATION`

6. Administrator configures that genuine identity under repository Settings → Environments → `production` as Required Reviewer.
7. Retain non-secret administrator evidence. Do not capture any secret value.
8. Populate a working copy of `production-required-reviewer-configuration-evidence.input.template.json` from actual administrator evidence.
9. #327 remains open until the configured identity and protection boundary are genuinely evidenced.

## Gate B — #371 E2C production verifier trust root

1. Obtain a genuine governance-approved E2C verifier identity and PUBLIC key only.
2. Populate a working copy of `e2c-trusted-verifier-registry.input.template.json` and remove `templateOnly` from the working copy.
3. Populate reviewer subjects in a working copy of `e2c-reviewer-subjects.input.template.json` so direct self-validation collisions can be rejected before trust-root use.
4. Run:

```bash
node tools/e2c-trust-root-designation-intake.js \
  --registry <working-registry.json> \
  --reviewer-subjects <working-reviewer-subjects.json> \
  --out <normalized-trust-root-candidate.json>
```

5. Accept only:

`READY_FOR_INDEPENDENT_OUT_OF_BAND_PINNING`

6. Independently retain/supply the exact `registryHashSha256` through a genuine out-of-band governance channel.
7. Populate a working copy of `e2c-out-of-band-pin.input.template.json` from the actual pin record; the pinner must be distinct from the governance owner for the qualified intake path.
8. Run:

```bash
node tools/e2c-out-of-band-pin-intake.js \
  --candidate <normalized-trust-root-candidate.json> \
  --pin <working-pin-record.json> \
  --out <qualified-pin-receipt.json>
```

9. Accept only:

`STRUCTURALLY_QUALIFIED_OUT_OF_BAND_PIN_RECEIPT`

This status proves only hash/record consistency. It does not authenticate the external pin channel; that remains genuine external-governance evidence.

## E2B → E2C continuation after both human inputs exist

After genuine external review evidence, credential evidence, trust-root designation and pin evidence exist:

1. Build E2B envelope with `tools/e2b-external-review-credential-intake.js`.
2. Accept only `READY_FOR_EXTERNAL_AUTHORITY_VALIDATION`.
3. Build canonical unsigned E2C attestation signing requests with `tools/e2c-external-authority-validation-intake.js signing-request`.
4. Obtain genuine external `RSA-SHA256` signatures outside the repository/CI/chat.
5. Verify E2C packet using the independently pinned registry hash.
6. Accept only `AUTHORITY_VALIDATION_COMPLETE_PENDING_SUBSTANTIVE_REVIEW`.
7. Continue to E2D only after E2C qualifies.

## Hard boundaries

- Never commit private keys or passphrases.
- Never paste protected production secret values into GitHub issues, PRs, CI logs, or chat.
- Never treat templates, CI, owner statements, or repository presence as proof of external review or administrator configuration.
- Never treat `STRUCTURALLY_QUALIFIED_OUT_OF_BAND_PIN_RECEIPT` as authentication of the out-of-band channel by itself.
- The frozen RC source/artifact/environment tuple remains unchanged.

`#327=HOLD_UNTIL_GENUINE_REQUIRED_REVIEWER_CONFIGURATION_EVIDENCE`
`#371=HOLD_UNTIL_GENUINE_E2C_VERIFIER_AND_OUT_OF_BAND_PIN`
`E2D=HOLD_UPSTREAM_E2C`
`E2E=HOLD`
`E2F=HOLD`
`E2G=HOLD`
`MERGE=HOLD`
`DEPLOY=HOLD`
`TRANSACTION_AUTHORITY=false`
`COMMERCIAL_GO_LIVE=HOLD`
