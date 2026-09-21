# External governance closure runbook — current #371 path

## Purpose

Provide the deterministic operational path from the current repository state to the next genuine external-governance transition without changing the frozen RC tuple and without fabricating external evidence, credentials, signatures, authority, or production approval.

This runbook is support-governance only. It does not authorize merge, deployment, transaction authority, professional authority, or commercial Go-Live.

## Frozen RC — unchanged

- Release Candidate: `startak-real-estate-rc-2026-09-16-e876208c19ff`
- Source SHA: `e876208c19ffbddd0dacd2bf8fce24aba1e52b55`
- Artifact SHA-256: `c3ddcd7b4a66fd58c271fb08b9e5a3efb5e4237f0015d3771e7ab9818412017f`
- Environment: `cloudflare-pages:startak-real-estate:production`
- Environment Config SHA-256: `819183fb9f4fb09017c636d2d1d841dd086ac4ba4bbccd103dffbc4c5980bc73`

## Closed upstream items

- `#326 = PASS_CLOSED`
- `#254 = PASS_CLOSED`
- `#327 = CLOSED_BY_FORMAL_OWNER_POLICY_EXCEPTION`
- GitHub production governance model: `SINGLE_OWNER`
- Independent GitHub Environment approval: `NOT_PRESENT`

The #327 owner exception must not be represented as independent Environment-review approval.

## E2C trust root — designated

Current designated verifier:

- `verifierId = verifier-said-e2c-2026-09-21`
- `verifierSubjectRef = human:said`
- `authorityClass = E2C_EXTERNAL_AUTHORITY_VALIDATOR`
- `publicKeySha256 = 0af393bd7c091106c3b16e493b4f99d39570c77675c9c5dee175d5a7727ebbc1`
- `registryId = startak-e2c-production-verifiers-2026-09-21`
- `registryHashSha256 = 52d9d9e14e7b2e7667bc85fa9f3a8b3f2a77482eb0cdc7e9ffa879c27b12d1e0`

Current pin receipt:

`STRUCTURALLY_QUALIFIED_OUT_OF_BAND_PIN_RECEIPT`

Repository records:

- `e2c-trusted-verifier-registry.designated.current.json`
- `e2c-trust-root-candidate.current.json`
- `e2c-out-of-band-pin.said.current.json`
- `e2c-out-of-band-pin.receipt.current.json`

Evidence boundary remains explicit:

- `externalChannelAuthenticatedByTool = false`
- `signatureCreatedByTool = false`
- `validationAuthorityGranted = false`
- `authorityEffect = NONE`

The pin receipt proves repository structural/hash consistency only. It is not itself an E2C production attestation.

## Current hard gate — E2B genuine external evidence

E2B now requires actually issued external review artifact(s) and genuine reviewer credential/authority artifact(s). Templates, owner statements, repository files, CI results, or chat text cannot substitute for these inputs.

For each triggered E2 candidate, obtain the evidence class required by:

`governance/e2b-external-review-evidence-requirements-2026-09-08.json`

Allowed evidence classes are:

- `LEGAL_REVIEW`
- `PROFESSIONAL_REVIEW`
- `ACCOUNTING_REVIEW`
- `TAX_REVIEW`
- `DATA_GOVERNANCE_REVIEW`
- `REFERENCE_CONFIRMATION`

For every reviewer referenced by the review evidence, obtain genuine credential/authority evidence containing the actual reviewer identity/reference, authority or professional qualification, issuing/verification source, and the real artifact.

### E2B operator procedure

1. Create working copies outside the committed template path from:
   - `e2b-review-evidence.input.template.json`
   - `e2b-credential-evidence.input.template.json`
2. Populate only real metadata from the actually received external artifacts.
3. Place the actual received artifacts beneath a dedicated local artifact root. Do not commit confidential reviewer documents merely to run intake.
4. Set each `artifactRelativePath` relative to that root.
5. Set each `artifactSha256` to the SHA-256 of the exact received bytes.
6. Run:

```bash
node tools/e2b-external-review-credential-intake.js \
  --requirements governance/e2b-external-review-evidence-requirements-2026-09-08.json \
  --applicability <qualified-e2-applicability-packet.json> \
  --review-evidence <real-review-evidence-input.json> \
  --credential-evidence <real-credential-evidence-input.json> \
  --envelope-id <real-envelope-id> \
  --prepared-by <real-operator-ref> \
  --prepared-at <real-iso-8601-time> \
  --artifact-root <directory-containing-actually-received-files> \
  --out <e2b-envelope-output.json>
```

7. Accept only:

`READY_FOR_EXTERNAL_AUTHORITY_VALIDATION`

Local byte binding is an integrity check only. It does not authenticate the external document, credential, reviewer identity, reviewer authority, reviewer independence, or substantive professional correctness.

## Next hard gate — E2C genuine signed attestations

After a genuine E2B envelope exists, create canonical unsigned E2C signing requests using the existing E2C intake tool. The applicable validation types are:

- `REVIEW_EVIDENCE_AUTHENTICITY`
- `CREDENTIAL_AUTHENTICITY`
- `REVIEWER_AUTHORITY`
- `REVIEWER_INDEPENDENCE`

Each attestation must be supported by real verification source/artifact evidence and a genuine external `RSA-SHA256` signature from an eligible verifier.

Self-validation remains prohibited. If `human:said` is the reviewer subject for a particular E2B item, Said cannot validate that same reviewer/item in E2C. A distinct eligible verifier is then required for that item.

### E2C operator procedure

1. Build the canonical unsigned signing request with:

```bash
node tools/e2c-external-authority-validation-intake.js signing-request \
  <use the repository tool arguments required by the qualified E2B packet and current pinned verifier registry>
```

2. Transfer the exact canonical payload to the eligible external verifier outside repository/CI/chat signing context.
3. Obtain the genuine `RSA-SHA256` signature and actual verification-source/artifact references.
4. Populate the real E2C attestation input. Do not leave placeholders and do not synthesize timestamps, sources, signatures, or authority facts.
5. Verify the signed packet against the independently pinned registry hash.
6. Accept only the repository-qualified E2C completion state produced by the verifier path; do not promote a structural or partial status into substantive approval.

Detailed signing handling remains governed by:

`governance/operator-templates/EXTERNAL-SIGNING-INSTRUCTIONS.md`

## Downstream transition rule

Do not advance E2D until genuine E2B evidence and required E2C signed attestations are actually present and qualified.

After E2C qualifies, continue in order:

`E2D → E2E → E2F → E2G → E2H → E2I`

No stage may infer or backfill evidence from a later stage.

## Hard boundaries

- Never commit private keys or passphrases.
- Never paste protected production secret values into GitHub issues, PRs, CI logs, or chat.
- Never treat templates, CI, repository presence, or owner approval as proof of external review or credential authenticity.
- Never treat `STRUCTURALLY_QUALIFIED_OUT_OF_BAND_PIN_RECEIPT` as proof that the external pin channel was authenticated by the repository/tool.
- Never treat local SHA-256 byte binding as proof of external authenticity.
- Never allow reviewer self-validation in E2C.
- Never change the frozen RC source/artifact/environment tuple as part of evidence intake.

## Current disposition

`OWNER_E2C_DESIGNATION=COMPLETE`
`E2C_CURRENT_VERIFIER=human:said`
`E2C_PIN_RECEIPT=STRUCTURALLY_QUALIFIED_OUT_OF_BAND_PIN_RECEIPT`
`E2C_PIN_CHANNEL_AUTHENTICATED_BY_TOOL=false`
`E2B_LOCAL_ARTIFACT_BYTE_BINDING=AVAILABLE_FAIL_CLOSED`
`E2B_GENUINE_EXTERNAL_EVIDENCE=NOT_PRESENT`
`E2C_PRODUCTION_ATTESTATIONS=NOT_PRESENT`
`#371=OPEN_ATTESTATIONS_AND_GENUINE_E2B_INPUTS_REQUIRED`
`E2D=HOLD_UPSTREAM_E2C`
`E2E=HOLD`
`E2F=HOLD`
`E2G=HOLD`
`E2H=HOLD_PENDING_AUTHORIZED_EXECUTION_PATH`
`E2I=HOLD_EXTERNAL_INPUTS_AND_GENUINE_E2H`
`FINAL_RC_TO_MAIN_PR=HOLD`
`MERGE=HOLD`
`DEPLOY=HOLD`
`TRANSACTION_AUTHORITY=false`
`COMMERCIAL_GO_LIVE=HOLD`
