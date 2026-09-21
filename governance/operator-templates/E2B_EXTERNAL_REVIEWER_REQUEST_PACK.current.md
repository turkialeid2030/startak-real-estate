# E2B External Reviewer Request Pack — Production Gate #371

## Purpose

This package is the controlled request to an actual external reviewer/firm for the genuine evidence required by E2B before E2C external-authority validation can begin.

It is not a review, credential, attestation, approval, signature, or authority grant. It must not be completed by repository automation on behalf of the external reviewer.

## Frozen release candidate

- Release Candidate: `startak-real-estate-rc-2026-09-16-e876208c19ff`
- Source SHA: `e876208c19ffbddd0dacd2bf8fce24aba1e52b55`
- Artifact SHA-256: `c3ddcd7b4a66fd58c271fb08b9e5a3efb5e4237f0015d3771e7ab9818412017f`
- Environment: `cloudflare-pages:startak-real-estate:production`
- Environment Config SHA-256: `819183fb9f4fb09017c636d2d1d841dd086ac4ba4bbccd103dffbc4c5980bc73`

## Material requested from the external reviewer / firm

For each applicable E2 candidate, provide an actually issued review artifact containing, at minimum:

1. reviewer identity/reference;
2. issuing firm/entity reference where applicable;
3. review class and scope;
4. the candidate/item reviewed;
5. findings and conclusion where applicable;
6. issuance date;
7. source/reference information sufficient to trace the issued artifact.

The repository supports the following governed evidence classes:

- `LEGAL_REVIEW`
- `PROFESSIONAL_REVIEW`
- `ACCOUNTING_REVIEW`
- `TAX_REVIEW`
- `DATA_GOVERNANCE_REVIEW`
- `REFERENCE_CONFIRMATION`

The exact classes required for a candidate are determined by `governance/e2b-external-review-evidence-requirements-2026-09-08.json` and the qualified E2 applicability packet. Do not claim a class that was not actually performed.

## Reviewer credential / authority material

For every reviewer referenced by a review artifact, provide genuine evidence sufficient to identify the reviewer and substantiate the claimed authority or professional qualification. The evidence package must permit recording of:

- `subjectReviewerRef`
- `authorityRef`
- `credentialClass`
- credential `artifactId`
- credential artifact SHA-256 after receipt
- observation date/time
- `verificationSourceRef`

Examples may include an actually issued professional credential, employer/firm authority record, official registry extract, or another genuine authority source appropriate to the claimed role. Repository intake does not itself establish authenticity or current validity.

## Minimum review-evidence metadata captured by the operator after receipt

- `evidenceId`
- `candidateId`
- `evidenceClass`
- `reviewerRef`
- `issuerOrFirmRef`
- `artifactId`
- `artifactSha256`
- `scopeRef`
- `issuedAt`
- `receivedAt`

## Integrity intake after genuine receipt

The operator stores the received artifacts outside the repository in a dedicated artifact root, computes SHA-256 from the exact received bytes, records only the required metadata, and runs:

```text
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

The expected maximum internal status is:

`READY_FOR_EXTERNAL_AUTHORITY_VALIDATION`

That status proves structural/completeness and byte-integrity processing only. It does not authenticate the external document, credential, reviewer authority, reviewer independence, professional conclusion, or legal correctness.

## E2C follow-on

Only after genuine E2B evidence qualifies may canonical unsigned E2C signing requests be built. Applicable E2C validation types include:

- `REVIEW_EVIDENCE_AUTHENTICITY`
- `CREDENTIAL_AUTHENTICITY`
- `REVIEWER_AUTHORITY`
- `REVIEWER_INDEPENDENCE`

Each production attestation requires genuine verification source/artifact evidence and an eligible external verifier's genuine `RSA-SHA256` signature. Direct self-validation is prohibited.

## Submission safety boundary

Do not place private keys, passphrases, passwords, protected production secrets, or unnecessary personal data in GitHub issues, PRs, CI logs, or chat. Confidential review/credential artifacts should remain outside the repository; use the controlled metadata/hash intake path.

## Current gate state

`E2B_EXTERNAL_REQUEST_PACK=READY`
`E2B_GENUINE_EXTERNAL_EVIDENCE=NOT_PRESENT`
`E2C_PRODUCTION_ATTESTATIONS=NOT_PRESENT`
`#371=OPEN_ATTESTATIONS_AND_GENUINE_E2B_INPUTS_REQUIRED`
`E2D=HOLD_UPSTREAM_E2C`
`MERGE=HOLD`
`DEPLOY=HOLD`
`TRANSACTION_AUTHORITY=false`
`COMMERCIAL_GO_LIVE=HOLD`
