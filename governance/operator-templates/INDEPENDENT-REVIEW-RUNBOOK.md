# Independent Review Operator Runbook — RC `e876208c19ff`

This runbook is for Issue #254 and the current integrated RC only.

## Frozen release tuple

- Release Candidate: `startak-real-estate-rc-2026-09-16-e876208c19ff`
- Source SHA: `e876208c19ffbddd0dacd2bf8fce24aba1e52b55`
- Artifact SHA-256: `c3ddcd7b4a66fd58c271fb08b9e5a3efb5e4237f0015d3771e7ab9818412017f`
- Environment: `cloudflare-pages:startak-real-estate:production`
- Environment Config SHA-256: `819183fb9f4fb09017c636d2d1d841dd086ac4ba4bbccd103dffbc4c5980bc73`

Historical #348/#359 material is not valid for this tuple.

## 1. Designate the real independent reviewer

Do not use the default placeholder `reviewer:saeed-pending` / `سعيد المراجع` as proof of a real reviewer.

Once a real reviewer is selected and the current qualified rebaseline proposal is available:

```bash
node tools/prepare-canonical-rebaseline-reviewer-designation.js \
  --proposal proposal.json \
  --owner-ref <EXACT_PROPOSAL_OWNER_REF> \
  --reviewer-ref <REAL_REVIEWER_SUBJECT_REF> \
  --reviewer-name '<REAL_REVIEWER_DISPLAY_NAME>' \
  --designation-id <DESIGNATION_ID> \
  --source-ref <DESIGNATION_SOURCE_REF> \
  --artifact-sha256 <DESIGNATION_ARTIFACT_SHA256> \
  --designated-at <ISO_TIMESTAMP> \
  --output reviewer-designation.json
```

The owner and reviewer references must differ.

## 2. Generate a new current-lineage review packet

The review packet must be generated from the current qualified proposal and owner decision; do not rebind an old packet by editing hashes.

```bash
node tools/prepare-canonical-rebaseline-review-packet.js \
  --proposal proposal.json \
  --owner-decision owner-decision.json \
  --request-id <CURRENT_REVIEW_REQUEST_ID> \
  --requested-at <ISO_TIMESTAMP> \
  --output review-packet.json
```

Expected status:

`READY_FOR_INDEPENDENT_REVIEW`

The resulting packet binds the qualified source commit, release artifact, environment config, owner actor and independent reviewer.

## 3. Prepare reviewer registry

Start from `independent-reviewer-registry.template.json`.

Requirements:

- RSA public key only, minimum suitable strength under the verifier.
- `publicKeySha256` must match the trimmed public-key PEM exactly under the repository hashing contract.
- `allowedPurpose` must be exactly `CANONICAL_REBASELINE_INDEPENDENT_REVIEW`.
- reviewer subject must match the assigned independent reviewer.
- pin the deterministic registry hash independently/out-of-band.

Never place the private key in GitHub, CI, this branch, an issue, or chat.

## 4. Prepare unsigned attestation metadata

Start from `independent-review-attestation.template.json` but leave `signatureBase64` empty or placeholder until after the canonical signing payload has been generated.

The decision artifact must be the real review memo/artifact for this RC. `result` may be `APPROVE`, `REJECT`, or `HOLD` based on the reviewer’s actual conclusion.

## 5. Generate exact canonical signing bytes

```bash
node tools/prepare-canonical-rebaseline-review-signing-payload.js \
  --packet review-packet.json \
  --attestation independent-review-attestation.json \
  --output review-signing-payload.json
```

The reviewer signs the exact `signingBytesUtf8` / canonical payload **outside** the repository with the independently controlled RSA private key using RSA-SHA256.

Return only the Base64 signature plus the public trust material already approved for disclosure.

## 6. Verify the signed review through the current verifier path

Use the current successor review-attestation verifier where the current lineage requires it:

```bash
node tools/successor-fresh-review-attestation.js \
  --mode verify \
  --packet <CURRENT_SUCCESSOR_REVIEW_PACKET.json> \
  --reviewer-registry independent-reviewer-registry.json \
  --expected-reviewer-registry-hash <OUT_OF_BAND_REGISTRY_SHA256> \
  --attestation signed-independent-review-attestation.json \
  --output verified-independent-review.json
```

Accept only a cryptographically verified current-lineage result produced by the applicable current verifier. Do not infer approval merely from a GitHub comment or uploaded PDF.

## Safety boundary

A valid independent review does not by itself authorize release, merge, deployment, transaction execution, canonical activation, professional issuance, or commercial Go-Live. The E2E/E2F/E2G and administrator gates remain separate.
