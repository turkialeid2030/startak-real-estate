# Current Owner Authority Designation — RC #363

## Frozen release tuple

- Release Candidate: `startak-real-estate-rc-2026-09-16-e876208c19ff`
- Source SHA: `e876208c19ffbddd0dacd2bf8fce24aba1e52b55`
- Artifact SHA-256: `c3ddcd7b4a66fd58c271fb08b9e5a3efb5e4237f0015d3771e7ab9818412017f`
- Environment: `cloudflare-pages:startak-real-estate:production`
- Environment Config SHA-256: `819183fb9f4fb09017c636d2d1d841dd086ac4ba4bbccd103dffbc4c5980bc73`

## Current accountable owner

- Display name: `تركي العيد`
- GitHub subject: `github:turkialeid2030`
- Repository role: `OWNER / current accountable operator`
- Owner declaration evidence: `https://github.com/turkialeid2030/startak-real-estate/issues/365#issuecomment-5703765871`

## Roles designated to the current owner

The current owner is designated as the accountable operator for repository-administration execution and as the intended human authority for:

1. `RELEASE_APPROVAL`
2. `MERGE_APPROVAL`

Both E2G roles remain **pending** until all upstream prerequisites are satisfied and a real RSA public key is registered, pinned, and later matched to an external signature over the canonical payload.

## Roles explicitly not assigned to the current owner

The current owner must not be used as a substitute for:

- the independent reviewer required by #254;
- an independent E2F verifier required by #364;
- the `DEPLOYMENT_APPROVAL` authority.

The Deployment authority must be a distinct human/subject from `github:turkialeid2030`.

## Current validator compatibility

The current E2G intake enforces:

- coverage for all three decision types;
- at least two distinct authority subjects;
- prohibition on the same subject holding both `MERGE_APPROVAL` and `DEPLOYMENT_APPROVAL`.

It does not prohibit the same subject from holding `RELEASE_APPROVAL` and `MERGE_APPROVAL`.

## Safety boundary

This designation is not itself a release decision, merge decision, deployment decision, signature, credential, ruleset mutation, Environment mutation, or transaction authority.

No private key, token, password, secret, credential, recovery material, or Cloudflare secret may be recorded here.

`OWNER_ACCOUNTABLE=github:turkialeid2030`
`RELEASE_AUTHORITY=DESIGNATED_PENDING_PREREQUISITES`
`MERGE_AUTHORITY=DESIGNATED_PENDING_PREREQUISITES`
`DEPLOYMENT_AUTHORITY=REQUIRES_DISTINCT_HUMAN`
`INDEPENDENT_REVIEW=REQUIRES_EXTERNAL_HUMAN`
`E2F=REQUIRES_EXTERNAL_VALIDATORS`
`MERGE=HOLD`
`DEPLOY=HOLD`
