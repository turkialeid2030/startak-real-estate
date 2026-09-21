# Final integrated RC → main — release-governance execution

> TEMPLATE ONLY. #254 is already `PASS_CLOSED`. Do not open or use this PR until #327 and #364 E2D/E2E/E2F/E2G required gates are actually satisfied and the final protected inputs are provisioned from verified artifacts.

## Exact immutable release candidate

- RC: `startak-real-estate-rc-2026-09-16-e876208c19ff`
- Head branch: `release/decision-governance-integrated-rc-2026-09-16`
- Expected head SHA: `e876208c19ffbddd0dacd2bf8fce24aba1e52b55`
- Base branch: `main`
- Artifact SHA-256: `c3ddcd7b4a66fd58c271fb08b9e5a3efb5e4237f0015d3771e7ab9818412017f`
- Environment: `cloudflare-pages:startak-real-estate:production`
- Environment Config SHA-256: `819183fb9f4fb09017c636d2d1d841dd086ac4ba4bbccd103dffbc4c5980bc73`

## Already completed

- #326 — main production ruleset: `PASS_CLOSED`.
- #254 — exact-tuple independent review: `PASS_CLOSED`; genuine signed review verified.
- P25 — `READY_FOR_EXPLICIT_BASELINE_ACTIVATION_CHANGE`; no automatic baseline switch is authorized.

## Required evidence before opening

- #327 — production Environment independent approval boundary satisfied and evidenced.
- #364 E2D/E2E — genuine exact-tuple external/implementation/independent-conformance chain qualified.
- #364 E2F — all four external validation classes genuinely evidenced, RSA-SHA256 signed and verified; final E2F packet/pin ready.
- #364 E2G — RELEASE, MERGE and DEPLOYMENT decisions genuinely signed and verified with required subject separation; final E2G packet/pin ready.
- final E2F/E2G public registries independently pinned out-of-band.
- all ten protected packet/registry inputs provisioned from the final verified files without exposing values.

Current staged public trust-root candidates after owner-approved Said rotation:

- Said E2F/E2G public-key SHA-256: `0af393bd7c091106c3b16e493b4f99d39570c77675c9c5dee175d5a7727ebbc1`
- E2F verifier-registry SHA-256 candidate: `59de1600dd145c7504c2eb907cb19c4c0df3e98fd85e8aa2331a31a0b14386a9`
- E2G release-authority registry SHA-256 candidate: `35c28e89061a69e6c001f2db512261f8a67180a08fe7a07cc90d839537cbb781`

These candidates do not grant authority and must be fresh-CI verified and independently pinned before final use.

## Required checks on the final RC PR exact head

- `release-verify` = PASS
- `trusted-main-production-governance` = PASS

Both checks must evaluate the exact SHA `e876208c19ffbddd0dacd2bf8fce24aba1e52b55`. If the RC branch moves, stop and start a new governance cycle.

## Merge boundary

Passing checks does not itself authorize merge. Verified `MERGE_APPROVAL` must apply to this exact release tuple and remain valid at execution time.

## Deployment boundary

Merge completion does not itself authorize deployment. Deployment requires the distinct verified `DEPLOYMENT_APPROVAL`, production Environment boundary, exact merged-source confirmation, provider deployment identity verification and post-deployment smoke verification.

## Authority boundary

- No transaction authority is inferred from merge or deployment.
- Public AI remains disabled unless separately governed.
- Commercial / professional / legal / PDPL gates remain separate where applicable.

Tracking: #254, #326, #327, #364, #365, #367.

`TEMPLATE_ONLY=true`
`#254=PASS_CLOSED`
`OPEN_FINAL_PR_NOW=false`
`MERGE_AUTHORITY=false`
`DEPLOYMENT_AUTHORITY=false`
`TRANSACTION_AUTHORITY=false`
`COMMERCIAL_GO_LIVE=HOLD`
