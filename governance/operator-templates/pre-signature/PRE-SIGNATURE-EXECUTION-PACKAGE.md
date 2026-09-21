# Pre-signature execution package

This package preserves the technically safe execution sequence for the frozen RC. #254 cryptographic review closure is complete; all remaining external validation, release-decision signatures, administrator controls and protected-value provisioning stay fail-closed.

## Frozen tuple — no rebinding

- Release candidate: `startak-real-estate-rc-2026-09-16-e876208c19ff`
- RC branch: `release/decision-governance-integrated-rc-2026-09-16`
- Source SHA: `e876208c19ffbddd0dacd2bf8fce24aba1e52b55`
- Artifact SHA-256: `c3ddcd7b4a66fd58c271fb08b9e5a3efb5e4237f0015d3771e7ab9818412017f`
- Environment: `cloudflare-pages:startak-real-estate:production`
- Environment config SHA-256: `819183fb9f4fb09017c636d2d1d841dd086ac4ba4bbccd103dffbc4c5980bc73`

Any tuple drift requires a new governance cycle.

## Completed

1. Frozen RC engineering qualification preserved.
2. #326 main ruleset closed and governed checks retained.
3. #254 exact-tuple independent review genuinely signed, verified and closed.
4. P25 reached `READY_FOR_EXPLICIT_BASELINE_ACTIVATION_CHANGE` without automatic activation.
5. Said's current public key is registered for the canonical review path.
6. Owner explicitly approved rotating Said's public trust root for E2F and E2G Deployment only in #367 comment `5756532755`.
7. E2F verifier registry is staged with current Said key SHA-256 `0af393bd7c091106c3b16e493b4f99d39570c77675c9c5dee175d5a7727ebbc1` and candidate normalized hash `59de1600dd145c7504c2eb907cb19c4c0df3e98fd85e8aa2331a31a0b14386a9`.
8. E2G owner Release/Merge authority material remains unchanged; Said Deployment authority is staged with the current Said key. Candidate E2G registry hash: `35c28e89061a69e6c001f2db512261f8a67180a08fe7a07cc90d839537cbb781`.
9. E2G release-authority governance artifact raw SHA-256 is `bf8191a4f13021ca7b18abb9857d58770ce9546ad01c2439fc544e61fe74c0c1`.
10. Protected secret-name/source mapping and final RC→main PR template remain prepared without protected values.

The rotated E2F/E2G trust-root candidates still require fresh exact-head CI and independent out-of-band pinning. Rotation itself grants no validation or release authority.

## Remaining execution order

### A. Genuine E2D / E2E upstream closure

Obtain genuine production/external E2D activation-proposal evidence for the exact RC, followed by genuine implementation evidence and independent conformance evidence. Build E2E only with repository tooling and accept only:

`RULE_IMPLEMENTATION_EVIDENCE_READY_FOR_EXTERNAL_CONFORMANCE_VALIDATION`

No fixture or synthetic self-verification may substitute for production evidence.

### B. E2F cryptographic closure

For each required class:

- `EXTERNAL_CONFORMANCE_AUTHENTICITY`
- `PRODUCTION_SECURITY_VALIDATION`
- `PRODUCTION_PERFORMANCE_VALIDATION`
- `PRODUCTION_RESILIENCE_VALIDATION`

bind the genuine verification evidence, generate the canonical signing request, obtain the real RSA-SHA256 signature from the designated verifier using the current Said key, verify trust-registry binding, and build the final E2F packet.

Required final status:

`EXTERNAL_CONFORMANCE_AND_PRODUCTION_VALIDATION_COMPLETE_PENDING_RELEASE_AUTHORITY`

No technical evidence staged in this package is itself an external validation result.

### C. E2G cryptographic closure

After the final E2F packet exists:

- owner signs `RELEASE_APPROVAL`;
- owner signs `MERGE_APPROVAL`;
- distinct Said authority signs `DEPLOYMENT_APPROVAL` using the current Said key;
- verify all three decisions, exact tuple binding and Merge/Deployment subject separation;
- build final E2G packet to `HUMAN_RELEASE_DECISIONS_COMPLETE_PENDING_EXECUTION`.

### D. Resolve #327 production approval boundary

#327 remains separate and `PARTIAL_PASS_OPEN`. Required-reviewer or equivalent approved independent Environment approval boundary must be genuinely evidenced by administrator-side configuration.

### E. Provision final protected inputs

Provision the ten protected E2E/E2F/E2G packet/registry values only from final verified artifacts. Never expose protected values in issues, PRs, commits, logs, artifacts or chat.

### F. Final PR and execution

Only after A–E are satisfied:

1. verify RC head remains `e876208c19ffbddd0dacd2bf8fce24aba1e52b55`;
2. open RC branch → `main` PR using `FINAL-RC-TO-MAIN-PR.template.md`;
3. require `release-verify` PASS on exact head;
4. require `trusted-main-production-governance` PASS on exact head;
5. confirm no tuple drift;
6. merge only under the verified Merge decision;
7. independently re-confirm Deployment decision and production Environment boundary;
8. deploy exact approved merged source;
9. verify provider deployment identity and production HTTP smoke;
10. preserve transaction/commercial authority as false/HOLD unless separately granted.

## Work intentionally not performed

- no synthetic external evidence;
- no inferred E2F result;
- no fabricated signature;
- no private key handling;
- no invented final packet hash;
- no protected value provisioning;
- no final RC→main PR opening;
- no merge;
- no production deployment;
- no automatic canonical-baseline activation.

`PRE_SIGNATURE_TECHNICAL_PREPARATION=UPDATED_AFTER_SAID_E2F_E2G_KEY_ROTATION_PENDING_FRESH_EXACT_HEAD_CI`
`#254=PASS_CLOSED`
`P25=READY_FOR_EXPLICIT_BASELINE_ACTIVATION_CHANGE`
`E2D=HOLD_GENUINE_EXTERNAL_CHAIN_REQUIRED`
`E2E=HOLD_GENUINE_EVIDENCE_REQUIRED`
`E2F=HOLD_GENUINE_VALIDATIONS_AND_SIGNATURES_REQUIRED`
`E2G=HOLD_PENDING_QUALIFIED_E2F_AND_GENUINE_DECISION_SIGNATURES`
`#327=PARTIAL_PASS_OPEN`
`FINAL_RC_TO_MAIN_PR=HOLD`
`MERGE=HOLD`
`DEPLOYMENT=HOLD`
`TRANSACTION_AUTHORITY=false`
`COMMERCIAL_GO_LIVE=HOLD`
