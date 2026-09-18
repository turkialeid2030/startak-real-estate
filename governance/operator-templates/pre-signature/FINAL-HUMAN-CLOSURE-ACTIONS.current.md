# Final human closure actions — frozen RC

This runbook consolidates only the remaining human/external actions after completion of the non-signature technical preparation. It does not create review substance, validation results, signatures, trust pins, release authority, merge authority, deployment authority, transaction authority or commercial Go-Live.

## Frozen tuple

- Release candidate: `startak-real-estate-rc-2026-09-16-e876208c19ff`
- Source SHA: `e876208c19ffbddd0dacd2bf8fce24aba1e52b55`
- Artifact SHA-256: `c3ddcd7b4a66fd58c271fb08b9e5a3efb5e4237f0015d3771e7ab9818412017f`
- Environment: `cloudflare-pages:startak-real-estate:production`
- Environment-config SHA-256: `819183fb9f4fb09017c636d2d1d841dd086ac4ba4bbccd103dffbc4c5980bc73`
- P26 review packet SHA-256: `ed8a0ffb242081d308f89b1e177920d6bf2d6e058bceb5047ddedaf4f0eed107`

Any tuple drift invalidates this closure runbook.

## Phase 1 — #254 independent-review closure

Owner relay now records that Said's review activity is complete and the relayed decision is `APPROVE`. This remains non-authoritative until the current verifier accepts a genuine signed review record.

Required human inputs:

1. Said supplies the completed review memo/artifact for this exact tuple.
2. Said supplies the evidence/references actually reviewed and the rationale/conditions actually adopted.
3. Calculate SHA-256 of that completed artifact.
4. Populate a real attestation with:
   - `decisionId`
   - `reviewerId=reviewer-said-2026-09-17`
   - `actorRef=human:said`
   - `purpose=CANONICAL_REBASELINE_INDEPENDENT_REVIEW`
   - `result=APPROVE` only if this remains Said's actual decision
   - `decisionSourceRef`
   - `decisionArtifactSha256`
   - actual `decidedAt`
   - actual `rationaleRef`
   - `signatureAlgorithm=RSA-SHA256`
5. Generate canonical bytes using the repository payload-preparation tool.
6. Said signs those bytes outside GitHub/chat using the registered private key.
7. Verify the signature using the repository verifier and accept only `VERIFIED_REVIEW_RESPONSE_READY_FOR_P25_REEVALUATION`.
8. Re-evaluate P25 through the repository governed transition; close #254 only if accepted.

No private key or passphrase is to be placed in GitHub, CI, logs, artifacts or chat.

## Phase 2 — E2F external conformance / production validation closure

After #254 is accepted, create final genuine validation records for all four required classes:

1. `EXTERNAL_CONFORMANCE_AUTHENTICITY`
2. `PRODUCTION_SECURITY_VALIDATION`
3. `PRODUCTION_PERFORMANCE_VALIDATION`
4. `PRODUCTION_RESILIENCE_VALIDATION`

For each record:
- cite the actual evidence used;
- record the actual result `VERIFIED|REJECTED|INCONCLUSIVE`;
- record actual verification source/hash/time;
- generate repository canonical signing bytes;
- obtain genuine RSA-SHA256 signature from the designated trusted verifier;
- verify the signature and trust-registry binding.

Build the final E2F packet only after all four are genuine and verified. Required downstream state is the repository-defined complete validation status pending release authority.

Verified public E2F verifier-registry hash:
`fb544ff5555be8f71fb9afbda1f5f2edc60aa8465bd7d91ea392c6865873fbaa`

Out-of-band trust/pinning remains a separate requirement.

## Phase 3 — E2G human release decisions

Only after a qualified final E2F packet exists:

- Owner `github:turkialeid2030` signs `RELEASE_APPROVAL` using the registered owner key.
- Owner `github:turkialeid2030` signs `MERGE_APPROVAL` using the registered owner key.
- Distinct authority `human:said` signs `DEPLOYMENT_APPROVAL` using Said's registered key.

The repository must verify:
- all signatures;
- exact release-candidate binding;
- Release before Merge;
- Merge before Deployment;
- Merge and Deployment subjects are different.

Verified public E2G release-authority registry hash:
`5125ae7c55541f37fee2ed571107cd846bfb5d91b2a1399633e20eacc67a0d3e`

## Phase 4 — #327 production approval boundary

Before deployment execution, #327 must be resolved by administrator-side evidence for Environment `production`, including the required-reviewer/equivalent independent approval boundary and the remaining six closure controls in issue #327.

The connected integration cannot legitimately alter or attest the sensitive Environment/secrets administration settings from this chat.

## Phase 5 — protected inputs and final release execution

After Phases 1–4 are all satisfied:

1. Provision the ten protected E2E/E2F/E2G packet/registry values from final verified artifacts only.
2. Re-check frozen RC head equals `e876208c19ffbddd0dacd2bf8fce24aba1e52b55`.
3. Open the final RC branch → `main` pull request using the prepared final PR template.
4. Require `release-verify` PASS on the exact head.
5. Require `trusted-main-production-governance` PASS on the exact head.
6. Confirm no tuple drift.
7. Execute merge only under the verified Merge approval.
8. Re-confirm Deployment approval and #327 boundary.
9. Deploy the exact approved merged source.
10. Verify deployment identity and production smoke checks.
11. Keep transaction/commercial authority false/HOLD unless separately granted.

## Current boundary

`REVIEW_ACTIVITY=REPORTED_COMPLETE`
`REVIEW_DECISION=APPROVE_REPORTED`
`SIGNED_REVIEW=NOT_YET`
`E2F=HOLD_SIGNATURE_PHASE`
`E2G=HOLD_SIGNATURE_PHASE`
`#327=PARTIAL_PASS_OPEN`
`FINAL_RELEASE_PR=HOLD`
`MERGE=HOLD`
`DEPLOYMENT=HOLD`
`TRANSACTION_AUTHORITY=false`
`COMMERCIAL_GO_LIVE=HOLD`
