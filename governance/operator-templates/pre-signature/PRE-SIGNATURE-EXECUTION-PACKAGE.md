# Pre-signature execution package

Owner direction dated 2026-09-18: complete all technically safe work that does not require a human/external cryptographic signature, and defer cryptographic signing to the final phase.

## Frozen tuple — no rebinding

- Release candidate: `startak-real-estate-rc-2026-09-16-e876208c19ff`
- RC branch: `release/decision-governance-integrated-rc-2026-09-16`
- Source SHA: `e876208c19ffbddd0dacd2bf8fce24aba1e52b55`
- Artifact SHA-256: `c3ddcd7b4a66fd58c271fb08b9e5a3efb5e4237f0015d3771e7ab9818412017f`
- Environment: `cloudflare-pages:startak-real-estate:production`
- Environment config SHA-256: `819183fb9f4fb09017c636d2d1d841dd086ac4ba4bbccd103dffbc4c5980bc73`

RC head was re-observed at the expected source SHA on 2026-09-18. Any later drift invalidates this package.

## Completed before cryptographic signing

1. Exact RC freeze/head re-check completed.
2. Main ruleset `21861129` re-check completed: active, strict status checks, `release-verify` + `trusted-main-production-governance`, no bypass actors.
3. Governed-release evidence artifact indexed from Actions run `35127270331`, artifact `10460380584`.
4. Exact-source Release Verify evidence indexed from run `35095503897`, job `104791717508`, conclusion success.
5. Production manifest/environment evidence hashes indexed.
6. Current-lineage P24/P25/P26 package already prepared for the exact tuple.
7. Said public reviewer material and local review-signing helper already prepared.
8. Four-class E2F input structure already prepared; technical evidence references are staged, but no external validation result is inferred.
9. E2G public authority material already prepared for owner Release/Merge and distinct Said Deployment.
10. Protected secret-name/source mapping prepared without values.
11. Final RC→main PR body prepared as a template only; no release PR opened.
12. Final post-signature order below is frozen to prevent accidental reordering of authority gates.

## Deferred signature phase — execute only when owner starts final signature phase

### A. #254 independent review cryptographic closure

- obtain/use Said's completed genuine review memo artifact;
- calculate its SHA-256;
- generate the canonical signing payload with repository tooling;
- Said signs canonical bytes using the registered private key outside GitHub/chat;
- verify RSA-SHA256 against the pinned public key;
- accept only the verifier's valid current-lineage state;
- re-evaluate P25 and close #254 only if the governed state transition permits closure.

### B. E2F cryptographic closure

For each required class, bind the final genuine verification artifact and produce the canonical signing request:

- `EXTERNAL_CONFORMANCE_AUTHENTICITY`
- `PRODUCTION_SECURITY_VALIDATION`
- `PRODUCTION_PERFORMANCE_VALIDATION`
- `PRODUCTION_RESILIENCE_VALIDATION`

Then obtain the real RSA-SHA256 signatures, verify them against the trusted verifier registry, and build the final E2F packet. Required final status:

`EXTERNAL_CONFORMANCE_AND_PRODUCTION_VALIDATION_COMPLETE_PENDING_RELEASE_AUTHORITY`

No technical evidence staged in this package is itself an external validation result.

### C. E2G cryptographic closure

After the final E2F packet hash exists:

- owner signs `RELEASE_APPROVAL`;
- owner signs `MERGE_APPROVAL`;
- distinct Said authority signs `DEPLOYMENT_APPROVAL`;
- verify all three decisions and authority-registry separation;
- build final E2G packet to `HUMAN_RELEASE_DECISIONS_COMPLETE_PENDING_EXECUTION`.

### D. Provision final protected inputs

Provision the ten protected packet/registry values only from final verified artifacts. Never expose secret values in issues, PRs, commits, logs, artifacts, or chat.

### E. Resolve #327 production approval boundary

#327 remains separate and must reach its closure criteria. Required-reviewer or equivalent approved independent Environment approval boundary cannot be declared satisfied merely because signatures exist elsewhere.

### F. Final PR and execution

Only after A–E are satisfied:

1. verify RC head remains `e876208c19ffbddd0dacd2bf8fce24aba1e52b55`;
2. open RC branch → `main` PR using `FINAL-RC-TO-MAIN-PR.template.md`;
3. require `release-verify` PASS on exact head;
4. require `trusted-main-production-governance` PASS on exact head;
5. confirm no tuple drift;
6. execute merge under the verified merge decision;
7. independently re-confirm deployment decision and production Environment boundary;
8. deploy exact approved merged source;
9. verify provider deployment identity and production HTTP smoke;
10. preserve transaction/commercial authority as false/HOLD unless separately granted.

## Non-signature work intentionally not performed

- no synthetic review memo;
- no inferred E2F result;
- no fabricated signature;
- no private key handling;
- no final packet hash invented before constructors can produce it;
- no secret value provisioning;
- no final RC→main PR opening;
- no merge;
- no production deployment.

`PRE_SIGNATURE_TECHNICAL_PREPARATION=COMPLETE_SUBJECT_TO_SUPPORT_BRANCH_CI`
`SIGNATURE_PHASE=DEFERRED_BY_OWNER`
`#254=HOLD_SIGNATURE_PHASE`
`#327=PARTIAL_PASS_OPEN`
`E2F=HOLD_SIGNATURE_PHASE`
`E2G=HOLD_SIGNATURE_PHASE`
`FINAL_RC_TO_MAIN_PR=HOLD`
`MERGE=HOLD`
`DEPLOYMENT=HOLD`
`TRANSACTION_AUTHORITY=false`
`COMMERCIAL_GO_LIVE=HOLD`
