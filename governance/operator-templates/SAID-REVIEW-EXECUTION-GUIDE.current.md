# دليل تنفيذ مراجعة سعيد — #254

> هذا الدليل تشغيلي فقط. لا ينشئ قرارًا أو مراجعة أو توقيعًا نيابة عن سعيد.

## 1) تأكيد المرشح محل المراجعة

قبل أي مراجعة، يجب أن يتأكد سعيد أن كل الأدلة تخص بالضبط:

- releaseCandidateId: `startak-real-estate-rc-2026-09-16-e876208c19ff`
- sourceCommitSha: `e876208c19ffbddd0dacd2bf8fce24aba1e52b55`
- artifactSha256: `c3ddcd7b4a66fd58c271fb08b9e5a3efb5e4237f0015d3771e7ab9818412017f`
- environmentRef: `cloudflare-pages:startak-real-estate:production`
- environmentConfigSha256: `819183fb9f4fb09017c636d2d1d841dd086ac4ba4bbccd103dffbc4c5980bc73`

إذا اختلف أي عنصر، تكون النتيجة `HOLD` حتى تصحيح المطابقة.

## 2) إجراء المراجعة البشرية

على سعيد مراجعة الأدلة الفعلية وتوثيق:

1. الأدلة التي راجعها.
2. نتائج الفحص.
3. الاستثناءات أو التحفظات.
4. المخاطر المتبقية.
5. المبررات.
6. قرار واحد فقط: `APPROVE` أو `REJECT` أو `HOLD`.

يستخدم القالب:

`governance/operator-templates/SAID-INDEPENDENT-REVIEW-MEMO.template.md`

ولا يجوز لأي طرف آخر ملء رأيه أو قراره نيابة عنه.

## 3) تثبيت مذكرة المراجعة

بعد أن ينهي سعيد المذكرة فعليًا، يجب حفظ النسخة النهائية كـ artifact مستقل ثم حساب SHA-256 لها. قيمة الـ SHA-256 الناتجة تصبح:

`decisionArtifactSha256`

في attestation.

لا يجوز حساب hash لقالب فارغ أو لمذكرة لم يعتمدها سعيد.

## 4) تعبئة Attestation

بعد اكتمال المذكرة، يستخدم سعيد القالب:

`governance/operator-templates/canonical-rebaseline-review-attestation.said.template.json`

وتعبأ فقط القيم الفعلية التالية:

- `decisionId`
- `reviewerId`
- `actorRef`
- `result`
- `decisionSourceRef`
- `decisionArtifactSha256`
- `decidedAt`
- `rationaleRef`

ويبقى `signatureBase64` فارغًا/غير نهائي حتى إجراء التوقيع الحقيقي.

## 5) التوقيع

لا يتم التوقيع إلا بعد ثبات محتوى الـ attestation canonical payload وعدم تغييره.

- الخوارزمية: `RSA-SHA256`
- المفتاح الخاص يبقى لدى سعيد فقط.
- لا يرفع المفتاح الخاص إلى GitHub أو CI ولا يرسل في المحادثة.
- يجب أن يتحقق التوقيع بالمفتاح العام المسجل للمراجع `human:said`.

## 6) التحقق بعد التوقيع

بعد استلام attestation موقعة حقيقية، يجب التحقق آليًا من:

1. مطابقة reviewerSubjectRef.
2. مطابقة publicKeySha256 للسجل.
3. مطابقة exact RC tuple.
4. صحة SHA-256 لمذكرة المراجعة.
5. صحة توقيع RSA-SHA256.
6. أن نتيجة المراجعة صادرة فعليًا من سعيد وليست مستنتجة أو مولدة آليًا.

## 7) بوابة #254

- `APPROVE` + توقيع صحيح + أدلة سليمة: يمكن تقييم إغلاق بوابة #254 وفق شروطها الكاملة.
- `REJECT`: يبقى الإصدار موقوفًا وتوثق أسباب الرفض.
- `HOLD`: يبقى الإصدار موقوفًا حتى إزالة السبب ثم إجراء مراجعة جديدة عند الحاجة.

## 8) ما بعد #254

نجاح #254 وحده لا يمنح الإطلاق. بعده تبقى بوابات #364:

- E2F external validation.
- E2G Release approval.
- E2G Merge approval.
- E2G Deployment approval من subject بشري متميز حيث يشترط الفصل.

ولا يتم فتح/دمج/نشر الإصدار النهائي قبل اكتمال البوابات المطبقة.