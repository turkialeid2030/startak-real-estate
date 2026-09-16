# External Governance Operator Templates — RC #363

هذه الحزمة مساعدة تشغيلية فقط ولا تغيّر المرشح المجمد ولا تمنح أي صلاحية Release/Merge/Deployment.

## Frozen release tuple

- `releaseCandidateId`: `startak-real-estate-rc-2026-09-16-e876208c19ff`
- `sourceCommitSha`: `e876208c19ffbddd0dacd2bf8fce24aba1e52b55`
- `artifactSha256`: `c3ddcd7b4a66fd58c271fb08b9e5a3efb5e4237f0015d3771e7ab9818412017f`
- `environmentRef`: `cloudflare-pages:startak-real-estate:production`
- `environmentConfigSha256`: `819183fb9f4fb09017c636d2d1d841dd086ac4ba4bbccd103dffbc4c5980bc73`

## Files

### Independent review / #254

- `INDEPENDENT-REVIEW-RUNBOOK.md`: مسار التشغيل الكامل للمراجع المستقل على الـRC الحالي.
- `independent-reviewer-registry.template.json`: سجل ثقة المراجع المستقل بالمفتاح العام فقط.
- `independent-review-attestation.template.json`: قالب قرار المراجع المرتبط بمذكرة/أثر مراجعة حقيقي.

### GitHub administrator / #326 + #327

- `github-ruleset-admin-evidence.template.md`: نموذج إثبات تعديل Ruleset `21861129` بعد إضافة البوابة الموثوقة.
- `github-production-environment-admin-evidence.template.md`: نموذج إثبات ضوابط Environment `production` دون كشف الأسرار.

### Human authority / RACI

- `HUMAN-AUTHORITY-INTAKE.template.md`: نموذج موحد لجمع بيانات السلطات العامة وغير السرية للمراجع والمدققين وسلطات E2G والمسؤول الإداري.
- `RELEASE-GATE-RACI.md`: مصفوفة مسؤوليات وفصل صلاحيات لكل بوابة إصدار.
- `FINAL-RC-CUTOVER-CHECKLIST.md`: قائمة القطع النهائي من RC المجمد إلى `main` ثم، بشكل مستقل، إلى النشر الإنتاجي.

### E2F / #364

- `e2f-verifier-registry.template.json`: سجل المدققين الخارجيين بالمفاتيح العامة فقط.
- `e2f-validation.template.json`: قالب سجل تحقق واحد؛ يكرر لكل نوع من أنواع E2F الأربعة.

### E2G / #364

- `e2g-release-authority-registry.template.json`: سجل سلطات القرار البشري بالمفاتيح العامة فقط.
- `e2g-release-approval.template.json`: قرار `RELEASE_APPROVAL` غير موقع.
- `e2g-merge-approval.template.json`: قرار `MERGE_APPROVAL` غير موقع.
- `e2g-deployment-approval.template.json`: قرار `DEPLOYMENT_APPROVAL` غير موقع.
- `EXTERNAL-SIGNING-INSTRUCTIONS.md`: ضوابط التوقيع الخارجي RSA-SHA256 ومنع تسريب المفاتيح الخاصة.

## Required E2F validation types

1. `EXTERNAL_CONFORMANCE_AUTHENTICITY`
2. `PRODUCTION_SECURITY_VALIDATION`
3. `PRODUCTION_PERFORMANCE_VALIDATION`
4. `PRODUCTION_RESILIENCE_VALIDATION`

`result` المقبول للإكمال هو `VERIFIED` لكل الأنواع الأربعة.

## Required E2G decision types

1. `RELEASE_APPROVAL`
2. `MERGE_APPROVAL`
3. `DEPLOYMENT_APPROVAL`

لا يجوز أن يكون `authoritySubjectRef` الذي يملك MERGE هو نفسه الذي يملك DEPLOYMENT.

## Safety boundary

- لا تضع أي private key أو token أو password أو credential في هذه الملفات أو GitHub أو CI أو chat.
- القوالب غير قابلة للتنفيذ قبل استبدال جميع قيم `REPLACE_...`.
- SHA-256 للمفتاح العام يجب أن يطابق النص الفعلي لـPEM وفق verifier الحالي.
- التوقيع يتم خارج المستودع على canonical signing payload الذي تولده أدوات المشروع؛ لا توقع JSON يدويًا من القالب.
- يعاد فقط `signatureBase64` بعد التوقيع.
- لا تستخدم fixture/test key/self-approval.
- لا تستخدم أي حزمة أو توقيع من tuple تاريخي.
- `سعيد المراجع` / `reviewer:saeed-pending` placeholder تاريخي وليس إثبات هوية مراجع حقيقي.

## Execution order

1. أكمل #326 بواسطة Repository Admin ثم أثبت النتيجة بـlive read.
2. أكمل #327 بواسطة Environment Admin مع أدلة غير حساسة.
3. عيّن مراجعًا مستقلاً حقيقيًا لـ#254 وأنشئ review packet جديدًا ثم canonical signing payload وتحقق من التوقيع الخارجي.
4. أكمل E2E الحقيقي للـtuple الحالي.
5. أنشئ E2F verifier registry وأثبت hash خارج القناة.
6. أنشئ سجلات E2F الأربعة ووقع canonical payloads خارج المستودع، ثم ابنِ `e2f-final.json`.
7. أنشئ E2G release-authority registry وأثبت hash خارج القناة.
8. مرر القرارات غير الموقعة عبر `tools/e2g-release-authority-decision-intake.js decision` للحصول على canonical signing payload لكل قرار.
9. يوقع أصحاب السلطات البشرية payloads خارج المستودع.
10. ابنِ E2G final packet وتحقق من `HUMAN_RELEASE_DECISIONS_COMPLETE_PENDING_EXECUTION`.
11. حمّل القيم العشر إلى GitHub Actions secrets فقط بعد تحقق الحزم.
12. لا تفتح **PR الإصدار النهائي من RC المجمد إلى `main`** قبل إغلاق #326 و#327 و#254 و#364. يمكن إبقاء PRs توثيق/حوكمة مساعدة منفصلة بحالة Draft دون Merge، مثل PR #366.
