# External governance re-entry runbook — current internal-use mode

## Current disposition

The current Startak Real Estate lifecycle is:

`INTERNAL_EVALUATION_AND_CONTINUOUS_DEVELOPMENT`

Canonical record:

`governance/operator-templates/INTERNAL_USE_MODE.current.json`

For this current internal evaluation, testing and continuous-development lifecycle:

- `E2B_EXTERNAL_REVIEW=NOT_APPLICABLE_INTERNAL_USE`
- `E2C_EXTERNAL_ATTESTATION=NOT_APPLICABLE_INTERNAL_USE`
- `INTERNAL_ENGINEERING_CONTINUATION=true`
- `INTERNAL_TESTING=true`
- `INTERNAL_EVALUATION=true`
- `CONTINUOUS_DEVELOPMENT=true`
- `EXTERNAL_PROFESSIONAL_CERTIFICATION=false`
- `TRANSACTION_AUTHORITY=false`
- `EXTERNAL_COMMERCIAL_GO_LIVE=false`

Issue `#371` is closed as `not_planned` for the current operating mode. It is **not** closed as an external-review PASS.

This document is therefore a **re-entry runbook**, not an active blocking checklist for ordinary internal engineering changes.

## Main integration state

The internal-use operating mode was merged to `main` through PR `#366`.

The one-time protected-main bootstrap workflow was then removed through PR `#373`, and the bootstrap transition is complete.

The canonical required-check workflow is:

`.github/workflows/trusted-main-production-governance.yml`

For a valid internal-use declaration, that workflow permits the internal lifecycle without requiring the dormant external E2E/E2F/E2G chain. If the internal-use declaration is absent or invalid, the workflow re-enters the external production-governance path fail-closed.

## When external governance becomes active again

Re-enter this runbook when any of the following occurs:

1. `EXTERNAL_CLIENT_RELIANCE`
2. `PROFESSIONAL_OR_CERTIFIED_OUTPUT_CLAIM`
3. `TRANSACTION_AUTHORIZATION_OR_EXECUTION`
4. `BINDING_LEGAL_REGULATORY_CONTRACTUAL_LENDER_AUDITOR_OR_COURT_REQUIREMENT`
5. `OWNER_CHANGES_OPERATING_MODE`

Until one of those triggers applies, the external chain remains preserved but dormant.

## Preserved frozen external-RC lineage

The historical frozen tuple remains unchanged and is retained for audit/re-entry purposes:

- Release Candidate: `startak-real-estate-rc-2026-09-16-e876208c19ff`
- Source SHA: `e876208c19ffbddd0dacd2bf8fce24aba1e52b55`
- Artifact SHA-256: `c3ddcd7b4a66fd58c271fb08b9e5a3efb5e4237f0015d3771e7ab9818412017f`
- Environment: `cloudflare-pages:startak-real-estate:production`
- Environment Config SHA-256: `819183fb9f4fb09017c636d2d1d841dd086ac4ba4bbccd103dffbc4c5980bc73`

Do not interpret preservation of this tuple as current production authorization.

## Preserved historical governance state

Historical records remain preserved:

- `#326 = PASS_CLOSED`
- `#254 = PASS_CLOSED`
- `#327 = CLOSED_BY_FORMAL_OWNER_POLICY_EXCEPTION`
- Independent GitHub Environment approval: `NOT_PRESENT`
- E2C designated verifier subject: `human:said`
- E2C verifier registry hash: `52d9d9e14e7b2e7667bc85fa9f3a8b3f2a77482eb0cdc7e9ffa879c27b12d1e0`
- E2C pin receipt: `STRUCTURALLY_QUALIFIED_OUT_OF_BAND_PIN_RECEIPT`
- External pin channel authenticated by repository tooling: `false`

The #327 owner exception must not be represented as independent Environment-review approval. The structural pin receipt must not be represented as proof that the external pin channel was authenticated.

## Re-entry stage 1 — E2B genuine external evidence

When a re-entry trigger applies, E2B requires actually issued external review artifact(s) and genuine reviewer credential/authority artifact(s). Templates, owner statements, repository files, CI results, or chat text cannot substitute for those inputs.

Requirements remain defined by:

`governance/e2b-external-review-evidence-requirements-2026-09-08.json`

Allowed evidence classes remain:

- `LEGAL_REVIEW`
- `PROFESSIONAL_REVIEW`
- `ACCOUNTING_REVIEW`
- `TAX_REVIEW`
- `DATA_GOVERNANCE_REVIEW`
- `REFERENCE_CONFIRMATION`

Operator procedure:

1. Create working copies outside the committed template path from:
   - `e2b-review-evidence.input.template.json`
   - `e2b-credential-evidence.input.template.json`
2. Populate only real metadata from actually received external artifacts.
3. Place received artifacts beneath a dedicated local artifact root; do not commit confidential reviewer documents merely to run intake.
4. Set each `artifactRelativePath` relative to that root.
5. Set each `artifactSha256` to the SHA-256 of the exact received bytes.
6. Run the fail-closed intake tool:

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

## Re-entry stage 2 — E2C genuine signed attestations

After a genuine E2B envelope exists, build canonical unsigned E2C signing requests using the repository tooling.

Applicable validation types remain:

- `REVIEW_EVIDENCE_AUTHENTICITY`
- `CREDENTIAL_AUTHENTICITY`
- `REVIEWER_AUTHORITY`
- `REVIEWER_INDEPENDENCE`

Every applicable attestation must be supported by real verification source/artifact evidence and a genuine external `RSA-SHA256` signature from an eligible verifier.

Self-validation remains prohibited. If `human:said` is the reviewer subject for a particular E2B item, Said cannot validate that same reviewer/item in E2C; a distinct eligible verifier is required for that item.

Detailed signing handling remains governed by:

`governance/operator-templates/EXTERNAL-SIGNING-INSTRUCTIONS.md`

## Re-entry downstream order

Only after genuine E2B evidence and required E2C signed attestations are actually present and qualified may the external production sequence continue:

`E2D → E2E → E2F → E2G → E2H → E2I`

No stage may infer, backfill or synthesize evidence from another stage.

## Hard boundaries

- Never fabricate external evidence, credentials, signatures, reviewer authority or professional conclusions.
- Never commit private keys, passphrases or protected production secret values.
- Never paste protected secret values into GitHub issues, PRs, CI logs or chat.
- Never treat CI, repository presence, owner approval or local SHA-256 byte binding as proof of external authenticity.
- Never treat `STRUCTURALLY_QUALIFIED_OUT_OF_BAND_PIN_RECEIPT` as proof that the external pin channel was authenticated.
- Never allow reviewer self-validation in E2C.
- Never treat internal-use merge approval as production deployment, transaction, professional or commercial authority.

## Current mode summary

`OPERATING_MODE=INTERNAL_EVALUATION_AND_CONTINUOUS_DEVELOPMENT`

`#371=CLOSED_NOT_PLANNED_FOR_CURRENT_INTERNAL_MODE`

`E2B_EXTERNAL_REVIEW=NOT_APPLICABLE_INTERNAL_USE`

`E2C_EXTERNAL_ATTESTATION=NOT_APPLICABLE_INTERNAL_USE`

`EXTERNAL_PRODUCTION_GOVERNANCE_CHAIN=DORMANT_UNTIL_REENTRY_TRIGGER`

`INTERNAL_ENGINEERING_CONTINUATION=true`

`INTERNAL_TESTING=true`

`INTERNAL_EVALUATION=true`

`CONTINUOUS_DEVELOPMENT=true`

`EXTERNAL_PROFESSIONAL_CERTIFICATION=false`

`TRANSACTION_AUTHORITY=false`

`EXTERNAL_COMMERCIAL_GO_LIVE=false`
