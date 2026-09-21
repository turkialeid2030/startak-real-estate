# Final human closure actions — frozen RC

This runbook records only the remaining genuine human/external actions. It does not create external evidence, validation results, signatures, release authority, merge authority, deployment authority, transaction authority or commercial Go-Live.

## Frozen tuple

- Release candidate: `startak-real-estate-rc-2026-09-16-e876208c19ff`
- Source SHA: `e876208c19ffbddd0dacd2bf8fce24aba1e52b55`
- Artifact SHA-256: `c3ddcd7b4a66fd58c271fb08b9e5a3efb5e4237f0015d3771e7ab9818412017f`
- Environment: `cloudflare-pages:startak-real-estate:production`
- Environment-config SHA-256: `819183fb9f4fb09017c636d2d1d841dd086ac4ba4bbccd103dffbc4c5980bc73`

Any tuple drift invalidates the release-governance sequence.

## Phase 0 — #254 independent-review closure: COMPLETE

Current governed state:

- `#254=PASS_CLOSED`
- completed review memo SHA-256: `3e992e93dd701283215d95d3d3cf2ab0fe1d7ccda605866ab829f4e743a16aec`
- reviewer: `human:said`
- decision: `APPROVE`
- current Said public-key SHA-256: `0af393bd7c091106c3b16e493b4f99d39570c77675c9c5dee175d5a7727ebbc1`
- canonical reviewer registry SHA-256: `2cd45d81863afb8d41a30404d5b1cf2113c216abf6ae13e51d6f41e0962d0f53`
- RSA-SHA256 verification: `PASS`
- verifier state: `VERIFIED_REVIEW_RESPONSE_READY_FOR_P25_REEVALUATION`
- P25 state: `READY_FOR_EXPLICIT_BASELINE_ACTIVATION_CHANGE`
- P25 governance decision SHA-256: `a933ef596c623c9e2a732b2685236682174be2263a418ae0a91c037e2c36983b`

This closure does **not** automatically activate the canonical baseline and grants no release/merge/deployment/go-live/transaction authority.

## Phase 1 — genuine E2D / E2E production evidence

Before E2F, the current RC still requires the genuine upstream external chain:

1. qualified E2D activation-proposal packet for the exact frozen tuple;
2. genuine implementation evidence for every governed activation proposal;
3. genuine independent conformance evidence from an actor distinct from the implementer;
4. E2E packet built by repository tooling;
5. final E2E status exactly `RULE_IMPLEMENTATION_EVIDENCE_READY_FOR_EXTERNAL_CONFORMANCE_VALIDATION`;
6. final E2E packet hash pinned according to policy.

Repository fixtures or CI results are not substitutes for these external production inputs.

## Phase 2 — E2F external conformance / production validation

Owner-approved Said key rotation for E2F is recorded in issue #367 comment `5756532755`.

Current E2F public trust root:

- verifier: `human:said`
- verifierId: `e2f-verifier-said-2026-09-17`
- current public-key SHA-256: `0af393bd7c091106c3b16e493b4f99d39570c77675c9c5dee175d5a7727ebbc1`
- previous public-key SHA-256: `fbd4b0eee65ba6a08dfd6f673a80eb538149549f6bfcef26ade26ddacab14af1`
- E2F verifier-registry SHA-256 candidate: `59de1600dd145c7504c2eb907cb19c4c0df3e98fd85e8aa2331a31a0b14386a9`
- out-of-band pinning: `STILL_REQUIRED`

After E2E qualifies, create genuine validation records for all four required classes:

1. `EXTERNAL_CONFORMANCE_AUTHENTICITY`
2. `PRODUCTION_SECURITY_VALIDATION`
3. `PRODUCTION_PERFORMANCE_VALIDATION`
4. `PRODUCTION_RESILIENCE_VALIDATION`

For each record:
- cite the actual evidence reviewed;
- record the actual result `VERIFIED|REJECTED|INCONCLUSIVE`;
- record genuine source/hash/time;
- generate canonical signing bytes using repository tooling;
- obtain the genuine RSA-SHA256 signature outside GitHub/CI/chat;
- verify the signature against the current verifier registry.

Required final E2F state:

`EXTERNAL_CONFORMANCE_AND_PRODUCTION_VALIDATION_COMPLETE_PENDING_RELEASE_AUTHORITY`

No payload or signature bound to Said's previous key may be reused after the rotation.

## Phase 3 — E2G human release decisions

E2G starts only after a qualified final E2F packet exists.

Current public authority design:

- `RELEASE_APPROVAL`: `github:turkialeid2030`
- `MERGE_APPROVAL`: `github:turkialeid2030`
- `DEPLOYMENT_APPROVAL`: `human:said`
- owner public-key SHA-256: `194f78b203841fbefebd9c360e591748b1f787be5f1b310a620ea91589aefccf`
- Said deployment public-key SHA-256: `0af393bd7c091106c3b16e493b4f99d39570c77675c9c5dee175d5a7727ebbc1`
- previous Said deployment key SHA-256: `fbd4b0eee65ba6a08dfd6f673a80eb538149549f6bfcef26ade26ddacab14af1`
- E2G release-authority registry SHA-256 candidate: `35c28e89061a69e6c001f2db512261f8a67180a08fe7a07cc90d839537cbb781`
- E2G release-authority governance artifact raw SHA-256: `bf8191a4f13021ca7b18abb9857d58770ce9546ad01c2439fc544e61fe74c0c1`
- rotation evidence: issue #367 comment `5756532755`

Required genuine decisions:

1. Owner signs `RELEASE_APPROVAL` over the repository canonical payload.
2. Owner signs `MERGE_APPROVAL` over the repository canonical payload.
3. Said signs `DEPLOYMENT_APPROVAL` over the repository canonical payload with his current key.
4. Repository verifies exact tuple binding, signatures and Merge/Deployment actor separation.

Required final E2G state:

`HUMAN_RELEASE_DECISIONS_COMPLETE_PENDING_EXECUTION`

## Phase 4 — #327 production approval boundary

#327 remains `PARTIAL_PASS_OPEN`.

Before deployment execution, administrator-side evidence must establish the required-reviewer or equivalent independent production approval boundary for Environment `production`. No signature elsewhere substitutes for this Environment control.

## Phase 5 — protected inputs and final release execution

Only after Phases 1–4 are genuinely satisfied:

1. provision the ten protected E2E/E2F/E2G packet/registry values from final verified artifacts only;
2. re-check frozen RC head equals `e876208c19ffbddd0dacd2bf8fce24aba1e52b55`;
3. open the final RC branch → `main` pull request using the prepared template;
4. require `release-verify` PASS on the exact RC head;
5. require `trusted-main-production-governance` PASS on the same exact head;
6. confirm no tuple drift;
7. merge only under verified `MERGE_APPROVAL`;
8. re-confirm valid `DEPLOYMENT_APPROVAL` and #327 boundary;
9. deploy the exact approved merged source;
10. capture provider deployment identity and production smoke evidence;
11. preserve transaction/commercial authority as false/HOLD unless separately and explicitly granted.

No private key, passphrase, token or protected production secret belongs in GitHub issues, PRs, commits, CI logs or chat.

`#254=PASS_CLOSED`
`P25=READY_FOR_EXPLICIT_BASELINE_ACTIVATION_CHANGE`
`E2D=HOLD_GENUINE_EXTERNAL_CHAIN_REQUIRED`
`E2E=HOLD_GENUINE_EVIDENCE_REQUIRED`
`E2F=HOLD_GENUINE_VALIDATIONS_AND_SIGNATURES_REQUIRED`
`E2G=HOLD_PENDING_QUALIFIED_E2F_AND_GENUINE_DECISIONS`
`#327=PARTIAL_PASS_OPEN`
`FINAL_RELEASE_PR=HOLD`
`MERGE=HOLD`
`DEPLOYMENT=HOLD`
`TRANSACTION_AUTHORITY=false`
`COMMERCIAL_GO_LIVE=HOLD`
