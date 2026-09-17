# Independent Review Operator Runbook — RC `e876208c19ff`

This runbook is for Issue #254 and the current integrated RC only.

## Frozen release tuple

- Release Candidate: `startak-real-estate-rc-2026-09-16-e876208c19ff`
- Source SHA: `e876208c19ffbddd0dacd2bf8fce24aba1e52b55`
- Artifact SHA-256: `c3ddcd7b4a66fd58c271fb08b9e5a3efb5e4237f0015d3771e7ab9818412017f`
- Environment: `cloudflare-pages:startak-real-estate:production`
- Environment Config SHA-256: `819183fb9f4fb09017c636d2d1d841dd086ac4ba4bbccd103dffbc4c5980bc73`

Historical #348/#359 material is not valid for this tuple.

## Current exact P24/P25/P26 chain

The current-lineage chain is already generated and must be used unchanged unless the frozen tuple changes:

- P24 proposal: `governance/operator-templates/current-lineage-review/proposal.current.json`
- proposal hash: `b6575cb5c7c5ebd2a84ae71b2b31f1cb25a2562dc01d6e82608045e9d4d0557b`
- P25 owner decision: `governance/operator-templates/current-lineage-review/owner-decision.current.json`
- owner-decision hash: `2633792a0dabb50abf9caaef5a0b01ff55d9b2dc992f931c8708c9139dc0feb2`
- P26 review packet: `governance/operator-templates/current-lineage-review/review-packet.current.json`
- review-packet hash: `ed8a0ffb242081d308f89b1e177920d6bf2d6e058bceb5047ddedaf4f0eed107`
- owner actor: `github:turkialeid2030`
- independent reviewer actor: `human:said`

Do not regenerate or edit these artifacts merely to accommodate a review response. A tuple change requires a new governed lineage.

## 1. Reviewer trust record

The current reviewer trust material is registered at:

`governance/operator-templates/canonical-rebaseline-reviewer-registry.current.json`

Current reviewer:

- reviewer ID: `reviewer-said-2026-09-17`
- reviewer subject: `human:said`
- allowed purpose: `CANONICAL_REBASELINE_INDEPENDENT_REVIEW`
- public-key SHA-256: `fbd4b0eee65ba6a08dfd6f673a80eb538149549f6bfcef26ade26ddacab14af1`
- governance artifact SHA-256: `284b5995b9d964481c42aa9ef3820206ef1db12c4b7aadf68f44ca6e50695e68`
- deterministic verifier registry hash: `62c76efae99b3cf07a2f2fe7182b9c76932b39e9b72bd1eb48ea625dc620b5ca`

The registry hash must still be pinned independently/out-of-band before relying on it as the verifier trust root. Recording the same value in this repository is a reproducibility aid, not a substitute for independent pinning.

Never place the private key, passphrase, token, secret, or recovery material in GitHub, CI, this branch, an issue, or chat.

## 2. Genuine review artifact is still required

The relayed decision from Said is recorded as `APPROVE_REPORTED`, but it is not yet a verified independent review.

Said must complete a genuine review artifact/memo containing the evidence actually reviewed, findings, exceptions/risks, decision, rationale and decision time. Use:

`governance/operator-templates/SAID-INDEPENDENT-REVIEW-MEMO.template.md`

After the completed memo is fixed, calculate its actual SHA-256. That value becomes `decisionArtifactSha256`.

Do not hash the blank template and do not infer review substance from the relayed word `اعتمد`.

## 3. Prepare unsigned attestation metadata

Start from:

`governance/operator-templates/canonical-rebaseline-review-attestation.said.template.json`

Fill only genuine values produced by the completed review:

- `decisionId`
- `reviewerId`
- `actorRef`
- `result`
- `decisionSourceRef`
- `decisionArtifactSha256`
- `decidedAt`
- `rationaleRef`
- `signatureAlgorithm = RSA-SHA256`

Leave `signatureBase64` empty until the canonical payload is generated and actually signed.

## 4. Generate exact canonical signing bytes

For this P26 packet, use the repository-defined canonical rebaseline signing-payload tool:

```bash
node tools/prepare-canonical-rebaseline-review-signing-payload.js \
  --packet governance/operator-templates/current-lineage-review/review-packet.current.json \
  --attestation unsigned-independent-review-attestation.json \
  --output review-signing-payload.json
```

The reviewer signs the exact `signingBytesUtf8` bytes outside the repository using the RSA private key corresponding to the registered public key and algorithm `RSA-SHA256`.

Return only `signatureBase64` plus public trust material already approved for disclosure.

## 5. Verify the signed P26 review through the correct verifier

The current P24/P25/P26 packet is verified by the canonical-rebaseline verifier path, not by the later successor-fresh P65/P66 verifier.

Use:

```bash
node tools/verify-canonical-rebaseline-review-attestation.js \
  --packet governance/operator-templates/current-lineage-review/review-packet.current.json \
  --reviewer-registry governance/operator-templates/canonical-rebaseline-reviewer-registry.current.json \
  --expected-reviewer-registry-hash 62c76efae99b3cf07a2f2fe7182b9c76932b39e9b72bd1eb48ea625dc620b5ca \
  --attestation signed-independent-review-attestation.json \
  --output verified-independent-review.json
```

Accepted status for the current P26 path:

`VERIFIED_REVIEW_RESPONSE_READY_FOR_P25_REEVALUATION`

The verifier checks the exact review packet, pinned reviewer registry hash, reviewer subject/purpose, public-key scope and the RSA-SHA256 signature. It does not independently validate the substantive truth of the external memo; the genuine review artifact remains a separate evidence obligation.

The `tools/successor-fresh-review-attestation.js` path is reserved for a later successor-fresh P65/P66 governance cycle and must not be substituted for this P26 verifier.

## 6. P25 re-evaluation remains separate

A cryptographically verified review response is still only an input to the governed P25 re-evaluation. It does not itself activate a baseline or grant release authority.

Only after the verified review exists may the next governed re-evaluation step be executed against the same proposal/owner/reviewer lineage.

## Safety boundary

A valid independent review does not by itself authorize release, merge, deployment, transaction execution, canonical activation, professional issuance, legal approval, PDPL approval, or commercial Go-Live. The E2E/E2F/E2G and administrator gates remain separate.
