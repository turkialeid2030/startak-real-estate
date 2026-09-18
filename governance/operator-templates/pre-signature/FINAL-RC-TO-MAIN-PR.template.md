# Final integrated RC → main — release-governance execution

> TEMPLATE ONLY. Do not open or use this PR until #254, #327 and #364 required gates are actually satisfied and the trusted protected inputs are provisioned.

## Exact immutable release candidate

- RC: `startak-real-estate-rc-2026-09-16-e876208c19ff`
- Head branch: `release/decision-governance-integrated-rc-2026-09-16`
- Expected head SHA: `e876208c19ffbddd0dacd2bf8fce24aba1e52b55`
- Base branch: `main`
- Artifact SHA-256: `c3ddcd7b4a66fd58c271fb08b9e5a3efb5e4237f0015d3771e7ab9818412017f`
- Environment: `cloudflare-pages:startak-real-estate:production`
- Environment Config SHA-256: `819183fb9f4fb09017c636d2d1d841dd086ac4ba4bbccd103dffbc4c5980bc73`

## Required evidence before opening

- #326 — main production ruleset: PASS/CLOSED and unchanged.
- #327 — production Environment approval boundary: satisfied and evidenced.
- #254 — exact-tuple independent review: genuine signed review verified and accepted.
- #364 E2F — all four external validation classes cryptographically verified; final E2F packet/pin ready.
- #364 E2G — RELEASE, MERGE and DEPLOYMENT decisions genuinely signed and verified with required subject separation; final E2G packet/pin ready.
- all ten protected packet/registry inputs provisioned from the final verified files without exposing values.

## Required checks on this exact PR head

- `release-verify` = PASS
- `trusted-main-production-governance` = PASS

Both checks must evaluate the exact SHA `e876208c19ffbddd0dacd2bf8fce24aba1e52b55`. If the RC branch moves, stop and start a new governance cycle.

## Merge boundary

Passing checks does not itself authorize an unrecorded merge. The verified `MERGE_APPROVAL` decision must apply to this exact release tuple and remain valid at execution time.

## Deployment boundary

Merge completion does not itself authorize deployment. Deployment requires the distinct verified `DEPLOYMENT_APPROVAL`, production Environment boundary, exact merged-source confirmation, provider deployment identity verification, and post-deployment smoke verification.

## Authority boundary

- No transaction authority is inferred from merge or deployment.
- Public AI remains disabled unless separately governed.
- Commercial / professional / legal / PDPL gates remain separate where applicable.

Tracking: #254, #326, #327, #364, #365.

`TEMPLATE_ONLY=true`
`OPEN_FINAL_PR_NOW=false`
`MERGE_AUTHORITY=false`
`DEPLOYMENT_AUTHORITY=false`
`TRANSACTION_AUTHORITY=false`
`COMMERCIAL_GO_LIVE=HOLD`
