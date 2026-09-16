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
- أدوار E2G المهيأة: `RELEASE_APPROVAL` و`MERGE_APPROVAL`، وكلاهما ما يزال معلقًا حتى اكتمال E2F وتسجيل المفتاح العام والتوقيع الخارجي.
- لا يُستخدم المالك الحالي بدل المراجع المستقل أو مدققي E2F أو سلطة `DEPLOYMENT_APPROVAL`.

## الملفات

### المراجعة المستقلة / #254
- `INDEPENDENT-REVIEW-RUNBOOK.md`
- `independent-reviewer-registry.template.json`
- `independent-review-attestation.template.json`

### مسؤول GitHub / #326 + #327
- `github-ruleset-admin-evidence.template.md`
- `github-production-environment-admin-evidence.template.md`

### السلطات البشرية / RACI
- `HUMAN-AUTHORITY-INTAKE.template.md`
- `HUMAN-AUTHORITY-INTAKE.current.md`
- `CURRENT-OWNER-AUTHORITY-DESIGNATION.md`
- `RELEASE-GATE-RACI.md`
- `FINAL-RC-CUTOVER-CHECKLIST.md`

### E2F / #364
- `e2f-verifier-registry.template.json`
- `e2f-validation.template.json`

### E2G / #364
- `e2g-release-authority-registry.template.json`
- `e2g-release-authority-registry.current.template.json`
- `e2g-release-approval.template.json`
- `e2g-merge-approval.template.json`
- `e2g-deployment-approval.template.json`
- `EXTERNAL-SIGNING-INSTRUCTIONS.md`

## متطلبات E2F

1. `EXTERNAL_CONFORMANCE_AUTHENTICITY`
2. `PRODUCTION_SECURITY_VALIDATION`
3. `PRODUCTION_PERFORMANCE_VALIDATION`
4. `PRODUCTION_RESILIENCE_VALIDATION`

كلها يجب أن تصل إلى `VERIFIED` من مدققين خارجيين صالحين.

## متطلبات E2G

1. `RELEASE_APPROVAL`
2. `MERGE_APPROVAL`
3. `DEPLOYMENT_APPROVAL`

المتحقق الحالي يسمح بأن يكون صاحب RELEASE هو نفسه صاحب MERGE، لكنه يفرض وجود subjectين مختلفين على الأقل، ويمنع أن يكون صاحب MERGE هو نفسه صاحب DEPLOYMENT.

## الحدود الأمنية

- لا مفاتيح خاصة أو tokens أو passwords أو credentials في المستودع أو GitHub أو CI أو المحادثة.
- القوالب غير قابلة للتنفيذ قبل استبدال قيم `REPLACE_...`.
- التوقيع يتم خارج المستودع على canonical signing payload الذي تولده أدوات المشروع.
- يعاد فقط `signatureBase64`.
- لا fixtures أو test keys أو self-approval بديلًا عن الأدلة المستقلة.
- لا إعادة استخدام لأي tuple تاريخي.

## ترتيب التنفيذ

1. إغلاق #326 بواسطة المالك الحالي بصفته Repository Admin ثم إثبات الحالة بقراءة حية.
2. إغلاق #327 بواسطة المالك الحالي بصفته Repository/Environment Admin مع أدلة غير حساسة.
3. تعيين مراجع مستقل حقيقي لـ#254 منفصل عن `github:turkialeid2030`.
4. إكمال E2E الحقيقي للـtuple الحالي.
5. إكمال E2F والتوقيعات الخارجية.
6. إكمال سجل E2G بالمفتاح العام للمالك وسلطة Deployment مختلفة.
7. توليد canonical signing payloads وتوقيعها خارج المستودع.
8. الوصول إلى `HUMAN_RELEASE_DECISIONS_COMPLETE_PENDING_EXECUTION`.
9. تحميل الأسرار العشرة في GitHub Actions secrets فقط بعد اكتمال الحزم.
10. فتح PR الإصدار النهائي من RC المجمد إلى `main` فقط بعد إغلاق #326 و#327 و#254 و#364.
11. يبقى Deployment قرارًا منفصلًا حتى بعد Merge.

PR #366 هو PR توثيق/حوكمة مساعد ويظل Draft دون Merge حتى يقرر المالك خلاف ذلك ضمن الضوابط.
