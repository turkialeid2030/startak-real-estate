# E2B Genuine External Evidence Handoff

## Purpose

This handoff is for the genuine external material that is still required before E2B can be treated as ready for E2C external-authority validation.

No repository tool may manufacture, infer, backfill, or upgrade a human/external review, reviewer credential, reviewer authority, reviewer independence, or authenticity determination.

## Required external inputs

For every triggered E2 candidate, obtain the review artifact(s) required by `governance/e2b-external-review-evidence-requirements-2026-09-08.json`. The material must be actually issued by the identified reviewer or firm and must include the real scope, findings/conclusion where applicable, issuance date, and source/reference information.

For every reviewer referenced by review evidence, obtain genuine credential/authority evidence sufficient to identify the reviewer and the claimed authority or professional qualification. Repository completeness is not credential verification; authenticity and authority remain E2C/external-governance facts.

## Local byte-binding intake

The E2B operator templates now include `artifactRelativePath`. This field is local-only and is never included in the governed E2B envelope.

Place received artifacts beneath a dedicated local directory. Do not commit confidential reviewer documents, credentials, private keys, or other sensitive external artifacts to the repository merely to run intake.

For each review and credential record:

1. Populate the real metadata in the corresponding operator input JSON.
2. Set `artifactRelativePath` to the received file path relative to the dedicated artifact root.
3. Set `artifactSha256` to the SHA-256 digest of that exact received file.
4. Run the intake with `--artifact-root <directory>`.

Example operator form:

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

With `--artifact-root`, intake fails closed if an artifact path is missing, absolute, escapes the root, contains a symlink component, is not a regular file, exceeds the bounded artifact size, or computes to a SHA-256 different from the declared digest. Supplying `artifactRelativePath` without `--artifact-root` is also rejected.

## What a PASS means

`E2B_LOCAL_ARTIFACT_BYTE_BINDING=PASS` means only that the local bytes read by the tool match the SHA-256 declared in the submitted evidence record and that the evidence record then passed repository structural/completeness processing.

It does **not** establish any of the following:

- external-document authenticity;
- credential authenticity or current validity;
- reviewer identity, authority, licensing, or independence;
- legal, accounting, tax, valuation, data-governance, or other professional correctness;
- production attestation or signature;
- release, merge, deployment, transaction, or commercial-go-live authority.

Those boundaries remain fail-closed and must not be inferred from byte binding.

## Current gate rule

Until genuine external review artifacts and genuine reviewer credential/authority artifacts are received and entered, E2B remains not present for production-governance purposes. E2C production attestations remain not present, downstream E2D-E2G remain on HOLD, transaction authority remains false, and merge/deploy/commercial go-live remain on HOLD.
