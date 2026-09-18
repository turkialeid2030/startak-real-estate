# External Governance Operator Templates — RC #363

هذه الحزمة تشغيلية فقط، ولا تغيّر المرشح المجمد ولا تمنح أي صلاحية إصدار أو دمج أو نشر.

## المرشح المجمد

- `releaseCandidateId`: `startak-real-estate-rc-2026-09-16-e876208c19ff`
- `sourceCommitSha`: `e876208c19ffbddd0dacd2bf8fce24aba1e52b55`
- `artifactSha256`: `c3ddcd7b4a66fd58c271fb08b9e5a3efb5e4237f0015d3771e7ab9818412017f`
- `environmentRef`: `cloudflare-pages:startak-real-estate:production`
- `environmentConfigSha256`: `819183fb9f4fb09017c636d2d1d841dd086ac4ba4bbccd103dffbc4c5980bc73`

## المالك الحالي

- الاسم: `تركي العيد`
- GitHub subject: `github:turkialeid2030`
- الصفة: `OWNER / current accountable operator`
- مرجع الإعلان: `https://github.com/turkialeid2030/startak-real-estate/issues/365#issuecomment-5703765871`
- أدوار E2G المهيأة: `RELEASE_APPROVAL` و`MERGE_APPROVAL`، وكلاهما ما يزال معلقًا حتى اكتمال E2F والتوقيع الخارجي الصحيح.
- لا يُستخدم المالك الحالي بدل المراجع المستقل أو سلطة `DEPLOYMENT_APPROVAL`.

## الحالة الحالية للمراجعة المستقلة #254

تم إنشاء السلسلة الحالية للـRC نفسه دون إعادة استخدام packet تاريخي:

- P24: `READY_FOR_HUMAN_REBASELINE_GOVERNANCE`
- P25: `WAITING_FOR_INDEPENDENT_REVIEW`
- P26: `READY_FOR_INDEPENDENT_REVIEW`
- P26 review-packet SHA-256: `ed8a0ffb242081d308f89b1e177920d6bf2d6e058bceb5047ddedaf4f0eed107`
- المراجع: `human:said`
- القرار المنقول: `APPROVE_REPORTED`
- التوقيع المشفر المقبول: `NOT_YET`

سجل المراجع الحالي:

- الملف: `canonical-rebaseline-reviewer-registry.current.json`
- public-key SHA-256: `fbd4b0eee65ba6a08dfd6f673a80eb538149549f6bfcef26ade26ddacab14af1`
- deterministic verifier registry hash: `62c76efae99b3cf07a2f2fe7182b9c76932b39e9b72bd1eb48ea625dc620b5ca`
- الحالة: `READY_TECHNICALLY_OUT_OF_BAND_PIN_REQUIRED`

القيمة أعلاه قابلة لإعادة الحساب آليًا داخل المستودع، لكنها لا تستبدل ضرورة تثبيت trust-root بشكل مستقل/out-of-band قبل الاعتماد عليها في التحقق النهائي.

لا يجوز توليد canonical signing payload النهائي حتى توجد مذكرة مراجعة حقيقية لسعيد تشمل الأدلة والنتائج والمبررات و`decisionArtifactSha256` الفعلي.

## الملفات

### المراجعة المستقلة / #254
- `INDEPENDENT-REVIEW-RUNBOOK.md`: المسار التشغيلي الحالي الصحيح للـP26.
- `current-lineage-review/proposal.current.json`
- `current-lineage-review/owner-decision.current.json`
- `current-lineage-review/p25-governance.current.json`
- `current-lineage-review/review-packet.current.json`
- `current-lineage-review/chain-summary.current.json`
- `SAID-INDEPENDENT-REVIEW-MEMO.template.md`
- `canonical-rebaseline-review-attestation.said.template.json`
- `canonical-rebaseline-review-governance-artifact.current.json`
- `canonical-rebaseline-reviewer-registry.current.json`
- `independent-reviewer-registry.template.json`
- `independent-review-attestation.template.json`
- `tools/verify-canonical-rebaseline-review-attestation.js`: verifier CLI للـP26 بعد وصول attestation موقعة حقيقية.

**تنبيه:** `tools/successor-fresh-review-attestation.js` خاص بدورة successor-fresh P65/P66 اللاحقة، وليس بديلًا عن verifier الحالي للـP26.

### مسؤول GitHub / #326 + #327
- `github-ruleset-admin-evidence.template.md`
- `github-production-environment-admin-evidence.template.md`
- `OWNER-ADMIN-ACTIONS-NOW.md`: خطوات المالك المباشرة لإغلاق قواعد `main` وEnvironment `production`.

### السلطات البشرية / RACI
- `HUMAN-AUTHORITY-INTAKE.template.md`
- `HUMAN-AUTHORITY-INTAKE.current.md`
- `CURRENT-OWNER-AUTHORITY-DESIGNATION.md`
- `RELEASE-GATE-RACI.md`
- `FINAL-RC-CUTOVER-CHECKLIST.md`

### E2F / #364
- `e2f-verifier-registry.template.json`
- `e2f-verifier-registry.current.json`
- `e2f-validation.template.json`

### E2G / #364
- `e2g-release-authority-registry.template.json`
- `e2g-release-authority-registry.current.template.json`
- `e2g-release-approval.template.json`
- `e2g-merge-approval.template.json`
- `e2g-deployment-approval.template.json`
- `e2g-release-approval.current.template.json`: قالب قرار RELEASE مرتبط بسلطة المالك الحالية دون افتراض النتيجة.
- `e2g-merge-approval.current.template.json`: قالب قرار MERGE مرتبط بسلطة المالك الحالية دون افتراض النتيجة.
- `OWNER-RSA-PUBLIC-KEY-SETUP.md`: تعليمات إنشاء وإدارة المفتاح محليًا واستخراج public-key hash المتوافق مع verifier.
- `EXTERNAL-SIGNING-INSTRUCTIONS.md`

## متطلبات E2F

1. `EXTERNAL_CONFORMANCE_AUTHENTICITY`
2. `PRODUCTION_SECURITY_VALIDATION`
3. `PRODUCTION_PERFORMANCE_VALIDATION`
4. `PRODUCTION_RESILIENCE_VALIDATION`

كلها يجب أن تصل إلى `VERIFIED` من أدلة فعلية موقعة عبر المسار المعتمد. تسجيل مدقق أو مفتاح عام لا يساوي نتيجة تحقق.

## متطلبات E2G

1. `RELEASE_APPROVAL`
2. `MERGE_APPROVAL`
3. `DEPLOYMENT_APPROVAL`

المتحقق الحالي يسمح بأن يكون صاحب RELEASE هو نفسه صاحب MERGE، لكنه يفرض وجود subjectين مختلفين على الأقل، ويمنع أن يكون صاحب MERGE هو نفسه صاحب DEPLOYMENT.

## الحدود الأمنية

- لا مفاتيح خاصة أو tokens أو passwords أو credentials في المستودع أو GitHub أو CI أو المحادثة.
- القوالب غير قابلة للتنفيذ قبل استبدال القيم المطلوبة بوقائع فعلية.
- التوقيع يتم خارج المستودع على canonical signing payload الذي تولده أدوات المشروع.
- يعاد فقط `signatureBase64`.
- لا fixtures أو test keys أو self-approval بديلًا عن الأدلة المستقلة.
- لا إعادة استخدام لأي tuple تاريخي.
- `APPROVE_REPORTED` ليس `VERIFIED_REVIEW_RESPONSE_READY_FOR_P25_REEVALUATION`.

## ترتيب التنفيذ الحالي

1. إبقاء #326 مغلقًا بحالة PASS وعدم تغيير قواعده دون سبب حوكمي.
2. إغلاق المتبقي من #327 بإثبات administrator/required-reviewer boundary الحقيقي.
3. استكمال مذكرة سعيد الفعلية لـ#254 وحساب `decisionArtifactSha256` الحقيقي.
4. توليد canonical signing payload للـP26 من الأدلة الفعلية فقط.
5. توقيع payload خارج المستودع بواسطة سعيد والتحقق عبر `tools/verify-canonical-rebaseline-review-attestation.js`.
6. إعادة تقييم P25 بعد ظهور verified review response صالح.
7. إكمال E2F الحقيقي بأربع فئات التحقق المطلوبة.
8. إكمال E2G: Release + Merge + Deployment بالتوقيعات والـactor separation المطلوبة.
9. فتح PR الإصدار النهائي من RC المجمد إلى `main` فقط بعد إغلاق #327 و#254 و#364 وبقاء #326 سليمًا.
10. يبقى Deployment قرارًا منفصلًا حتى بعد Merge.

PR #366 هو PR توثيق/حوكمة مساعد ويظل Draft دون Merge حتى اكتمال بوابات الحوكمة المطبقة.
