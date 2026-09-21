# External Governance Operator Templates — RC #363

هذه الحزمة تشغيلية/حوكمية فقط. لا تغيّر المرشح المجمد ولا تمنح صلاحية إصدار أو دمج أو نشر أو تعامل تجاري.

## المرشح المجمد

- `releaseCandidateId`: `startak-real-estate-rc-2026-09-16-e876208c19ff`
- `sourceCommitSha`: `e876208c19ffbddd0dacd2bf8fce24aba1e52b55`
- `artifactSha256`: `c3ddcd7b4a66fd58c271fb08b9e5a3efb5e4237f0015d3771e7ab9818412017f`
- `environmentRef`: `cloudflare-pages:startak-real-estate:production`
- `environmentConfigSha256`: `819183fb9f4fb09017c636d2d1d841dd086ac4ba4bbccd103dffbc4c5980bc73`

## الحالة الحالية المختصرة

- #326: `PASS_CLOSED`
- #254: `PASS_CLOSED`
- P25: `READY_FOR_EXPLICIT_BASELINE_ACTIVATION_CHANGE`
- automatic canonical activation: `false`
- #327: `PARTIAL_PASS_OPEN`
- E2D production upstream: `HOLD_GENUINE_EXTERNAL_CHAIN_REQUIRED`
- E2E: `HOLD_GENUINE_EVIDENCE_REQUIRED`
- E2F: `HOLD_GENUINE_VALIDATIONS_AND_SIGNATURES_REQUIRED`
- E2G: `HOLD_PENDING_QUALIFIED_E2F_AND_GENUINE_DECISION_SIGNATURES`
- Final RC → main PR: `HOLD`
- Merge: `HOLD`
- Deployment: `HOLD`
- Transaction authority: `false`
- Commercial Go-Live: `HOLD`

## المالك الحالي

- الاسم: `تركي العيد`
- GitHub subject: `github:turkialeid2030`
- الصفة: `OWNER / current accountable operator`
- أدوار E2G المهيأة: `RELEASE_APPROVAL` و`MERGE_APPROVAL`
- owner public-key SHA-256: `194f78b203841fbefebd9c360e591748b1f787be5f1b310a620ea91589aefccf`

تسجيل السلطة والمفتاح العام لا يساوي قرار Release أو Merge فعلي.

## المراجعة المستقلة #254 — مكتملة

السلسلة الحالية للـexact tuple:

- P24 proposal hash: `b6575cb5c7c5ebd2a84ae71b2b31f1cb25a2562dc01d6e82608045e9d4d0557b`
- P25 owner-decision hash: `2633792a0dabb50abf9caaef5a0b01ff55d9b2dc992f931c8708c9139dc0feb2`
- P26 review-packet SHA-256: `ed8a0ffb242081d308f89b1e177920d6bf2d6e058bceb5047ddedaf4f0eed107`
- reviewer: `human:said`
- completed review memo SHA-256: `3e992e93dd701283215d95d3d3cf2ab0fe1d7ccda605866ab829f4e743a16aec`
- decision: `APPROVE`
- current public-key SHA-256: `0af393bd7c091106c3b16e493b4f99d39570c77675c9c5dee175d5a7727ebbc1`
- current reviewer registry SHA-256: `2cd45d81863afb8d41a30404d5b1cf2113c216abf6ae13e51d6f41e0962d0f53`
- RSA-SHA256 verification: `PASS`
- verifier: `VERIFIED_REVIEW_RESPONSE_READY_FOR_P25_REEVALUATION`
- P25 result: `READY_FOR_EXPLICIT_BASELINE_ACTIVATION_CHANGE`
- P25 governance decision SHA-256: `a933ef596c623c9e2a732b2685236682174be2263a418ae0a91c037e2c36983b`

إغلاق #254 لا يفعّل baseline تلقائياً ولا يمنح Release/Merge/Deployment authority.

## تدوير مفتاح سعيد لـE2F وE2G

اعتمد المالك تدوير public trust material لسعيد لمسارين فقط:

- `E2F_EXTERNAL_VERIFIER`
- `E2G_DEPLOYMENT_APPROVAL`

المرجع: issue #367 comment `5756532755`.

- previous Said public-key SHA-256: `fbd4b0eee65ba6a08dfd6f673a80eb538149549f6bfcef26ade26ddacab14af1`
- current Said public-key SHA-256: `0af393bd7c091106c3b16e493b4f99d39570c77675c9c5dee175d5a7727ebbc1`
- E2F verifier-registry SHA-256 candidate: `59de1600dd145c7504c2eb907cb19c4c0df3e98fd85e8aa2331a31a0b14386a9`
- E2G release-authority registry SHA-256 candidate: `35c28e89061a69e6c001f2db512261f8a67180a08fe7a07cc90d839537cbb781`
- E2G release-authority governance artifact raw SHA-256: `bf8191a4f13021ca7b18abb9857d58770ce9546ad01c2439fc544e61fe74c0c1`

هذه القيم تحتاج fresh exact-head repository verification بعد آخر تغييرات الدعم، كما يبقى out-of-band pinning متطلباً مستقلاً. التدوير وحده لا ينشئ validation أو signature أو approval.

## الملفات التشغيلية الرئيسية

### #254
- `INDEPENDENT-REVIEW-RUNBOOK.md`
- `SAID-CANONICAL-REBASELINE-REVIEW-REQUEST.current.md`
- `SAID-REVIEW-EXECUTION-GUIDE.current.md`
- `current-lineage-review/`
- `canonical-rebaseline-reviewer-registry.current.json`
- `canonical-rebaseline-review-governance-artifact.current.json`
- `tools/prepare-canonical-rebaseline-review-signing-payload.js`
- `tools/verify-canonical-rebaseline-review-attestation.js`

### #326 / #327
- `github-ruleset-admin-evidence.template.md`
- `github-production-environment-admin-evidence.template.md`
- `OWNER-ADMIN-ACTIONS-NOW.md`

### E2F / #364
- `e2f-verifier-registry.current.json`
- `e2f-validation-evidence-input.said.template.json`
- `SAID-E2F-VALIDATION-REPORT.template.md`
- `tools/e2f-validation-intake.js`

### E2G / #364
- `release-authority-governance-artifact.current.json`
- `e2g-release-authority-registry.current.template.json`
- `e2g-release-approval.current.template.json`
- `e2g-merge-approval.current.template.json`
- `e2g-deployment-approval.current.template.json`
- `tools/e2g-release-authority-decision-intake.js`

### Pre-signature / final execution
- `pre-signature/PRE-SIGNATURE-READINESS.current.json`
- `pre-signature/PRE-SIGNATURE-EXECUTION-PACKAGE.md`
- `pre-signature/FINAL-HUMAN-CLOSURE-ACTIONS.current.md`
- `pre-signature/E2E-E2F-EXECUTION-HANDOFF.current.md`
- `pre-signature/PROTECTED-SECRET-MAPPING.current.md`
- `pre-signature/FINAL-RC-TO-MAIN-PR.template.md`

## E2F substantive requirements

All four require genuine evidence, real verifier decisions and genuine RSA-SHA256 signatures:

1. `EXTERNAL_CONFORMANCE_AUTHENTICITY`
2. `PRODUCTION_SECURITY_VALIDATION`
3. `PRODUCTION_PERFORMANCE_VALIDATION`
4. `PRODUCTION_RESILIENCE_VALIDATION`

## E2G substantive requirements

Only after qualified E2F:

1. `RELEASE_APPROVAL`
2. `MERGE_APPROVAL`
3. `DEPLOYMENT_APPROVAL`

Release and Merge may be owned by `github:turkialeid2030`; Deployment remains a distinct subject `human:said`.

## ترتيب التنفيذ الحالي

1. استكمال production E2D الحقيقي.
2. بناء E2E من implementation evidence وindependent conformance evidence حقيقيين.
3. تثبيت E2E pin حسب السياسة.
4. تنفيذ أربع E2F validations حقيقية وتوقيع canonical payloads بالمفتاح الحالي.
5. بناء E2F النهائي والتحقق منه.
6. تنفيذ E2G Release/Merge/Deployment decisions بتوقيعات حقيقية.
7. إغلاق #327 بدليل administrator-side فعلي.
8. Provision القيم المحمية النهائية من artifacts المتحققة فقط.
9. فتح final RC → `main` PR وتشغيل checks على exact RC head.
10. Merge ثم Deployment فقط تحت السلطات المتحققة، مع بقاء transaction/commercial authority منفصلة.

PR #366 يبقى Draft support/governance PR ولا يُفسر كـfinal release PR.
