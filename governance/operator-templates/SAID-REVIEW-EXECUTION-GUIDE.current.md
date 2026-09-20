# دليل تنفيذ مراجعة سعيد — #254

> هذا الدليل تشغيلي فقط. لا ينشئ قرارًا أو مراجعة أو توقيعًا نيابة عن سعيد.

## 1) تأكيد المرشح محل المراجعة

قبل أي مراجعة أو توقيع، يجب أن تكون الحزمة مرتبطة حرفيًا بالـtuple التالي:

- releaseCandidateId: `startak-real-estate-rc-2026-09-16-e876208c19ff`
- sourceCommitSha: `e876208c19ffbddd0dacd2bf8fce24aba1e52b55`
- artifactSha256: `c3ddcd7b4a66fd58c271fb08b9e5a3efb5e4237f0015d3771e7ab9818412017f`
- environmentRef: `cloudflare-pages:startak-real-estate:production`
- environmentConfigSha256: `819183fb9f4fb09017c636d2d1d841dd086ac4ba4bbccd103dffbc4c5980bc73`
- reviewPacketHashSha256: `ed8a0ffb242081d308f89b1e177920d6bf2d6e058bceb5047ddedaf4f0eed107`

إذا اختلف أي عنصر، تكون النتيجة `HOLD` ولا يجوز إعادة ربط التوقيع يدويًا.

## 2) المراجعة البشرية الفعلية

على سعيد استكمال مذكرة المراجعة بنفسه بعد مراجعة الأدلة الفعلية. القالب:

`governance/operator-templates/current-lineage-review/SAID-INDEPENDENT-REVIEW-MEMO.template.md`

يجب توثيق ما يلي فعليًا:

1. الأدلة التي تمت مراجعتها.
2. نتيجة كل بند في قائمة المراجعة.
3. الملاحظات والاستثناءات والمخاطر المتبقية.
4. المراجع الفنية الإضافية، إن وجدت.
5. المبررات.
6. قرار واحد فقط: `APPROVE` أو `REJECT` أو `HOLD`.

لا يجوز لأي طرف آخر إنشاء رأي سعيد أو مبرراته أو وضع علامة اكتمال نيابة عنه.

## 3) تثبيت المذكرة المكتملة

بعد اكتمال المذكرة الحقيقية، تحفظ كملف مستقل ثابت ثم يحسب SHA-256 للنسخة المكتملة. هذه القيمة تصبح:

`decisionArtifactSha256`

لا يجوز استخدام SHA لقالب أو ملف غير مكتمل.

## 4) إنشاء الـattestation غير الموقعة

تعبأ القيم الفعلية فقط:

- `decisionId`
- `reviewerId = reviewer-said-2026-09-17`
- `actorRef = human:said`
- `purpose = CANONICAL_REBASELINE_INDEPENDENT_REVIEW`
- `result`
- `decisionSourceRef`
- `decisionArtifactSha256`
- `decidedAt`
- `rationaleRef`
- `signatureAlgorithm = RSA-SHA256`

ويبقى `signatureBase64` فارغًا حتى التوقيع الحقيقي.

## 5) المصدر الوحيد المعتمد للـcanonical signing payload

الأداة المرجعية الوحيدة لإنتاج bytes التوقيع هي:

`tools/prepare-canonical-rebaseline-review-signing-payload.js`

التشغيل من جذر المستودع:

```bash
node tools/prepare-canonical-rebaseline-review-signing-payload.js \
  --packet governance/operator-templates/current-lineage-review/review-packet.current.json \
  --attestation <PATH_TO_UNSIGNED_ATTESTATION_JSON> \
  --output <PATH_TO_SIGNING_REQUEST_JSON>
```

القيمة `signingBytesUtf8` الناتجة من هذه الأداة هي bytes المرجعية التي يوقعها سعيد. يمنع بناء payload بديل يدويًا أو إعادة ترتيب الحقول أو إعادة stringify بأداة أخرى قبل التوقيع.

الأداة المحلية:

`governance/operator-templates/local-tools/prepare-said-review-signing.ps1`

أصبحت تستدعي أداة المستودع الرسمية أعلاه بدل إعادة تنفيذ شكل الـpayload يدويًا. يمكن استخدامها لتجهيز الملفات المحلية غير الموقعة، لكنها لا تنشئ مراجعة أو قرارًا من تلقاء نفسها.

## 6) التوقيع الحقيقي

- الخوارزمية: `RSA-SHA256`.
- المفتاح الخاص يبقى لدى سعيد فقط.
- لا يدخل المفتاح الخاص أو passphrase إلى GitHub أو CI أو ChatGPT أو artifacts.
- يوقّع سعيد `signingBytesUtf8` نفسها دون تعديل.
- المفتاح العام المسجل يجب أن يطابق البصمة المعتمدة:
  `fbd4b0eee65ba6a08dfd6f673a80eb538149549f6bfcef26ade26ddacab14af1`.

## 7) التحقق الرسمي بعد التوقيع

سجل المراجع الحالي:

`governance/operator-templates/canonical-rebaseline-reviewer-registry.current.json`

البصمة الحاكمة المحسوبة بواسطة تنفيذ المستودع:

`62c76efae99b3cf07a2f2fe7182b9c76932b39e9b72bd1eb48ea625dc620b5ca`

أداة التحقق الرسمية:

```bash
node tools/verify-canonical-rebaseline-review-attestation.js \
  --packet governance/operator-templates/current-lineage-review/review-packet.current.json \
  --reviewer-registry governance/operator-templates/canonical-rebaseline-reviewer-registry.current.json \
  --expected-reviewer-registry-hash 62c76efae99b3cf07a2f2fe7182b9c76932b39e9b72bd1eb48ea625dc620b5ca \
  --attestation <PATH_TO_SIGNED_ATTESTATION_JSON> \
  --output <PATH_TO_VERIFIED_RESPONSE_JSON>
```

القبول يكون فقط إذا كانت الحالة حرفيًا:

`VERIFIED_REVIEW_RESPONSE_READY_FOR_P25_REEVALUATION`

أي حالة أخرى تبقي #254 على HOLD.

## 8) حدود ما يتحقق منه verifier

الـverifier يثبت تشفيريًا:

- أن القرار مربوط بنفس P26 packet؛
- أن المراجع موجود في trust registry المربوط بالبصمة المتوقعة؛
- أن subject والغرض والفترة الزمنية متطابقة؛
- أن المالك والمراجع المستقل مختلفان؛
- أن توقيع RSA-SHA256 صالح.

لكنه لا يدّعي أنه تحقق آليًا من جودة المحتوى المهني للمذكرة نفسها. لذلك تبقى المذكرة الفعلية والأدلة والمبررات جزءًا من سجل الحوكمة البشري.

## 9) إعادة تقييم P25

نجاح verifier لا يغلق #254 تلقائيًا. يجب تمرير الـverified response إلى مسار P25 الحاكم وقبول الانتقال المحدد في المستودع. لا يترتب على نجاح #254 وحده:

- Canonical activation تلقائي؛
- Release Approval؛
- Merge Approval؛
- Deployment Approval؛
- Go-Live؛
- Transaction Authority.

## 10) ما بعد #254

بعد نجاح #254 ينتقل المسار إلى #364 بالترتيب:

1. E2E genuine conformance packet.
2. E2F: أربع validations حقيقية وموقعة.
3. E2G: Release ثم Merge ثم Deployment decisions موقعة وفق الفصل بين السلطات.
4. تحديث القيم المحمية العشر من artifacts النهائية فقط.
5. إغلاق #327.
6. Final RC→main PR ثم الفحوصات الحاكمة ثم Merge ثم Deployment ثم E2H/E2I.

`#254=HOLD_UNTIL_GENUINE_MEMO_AND_SIGNATURE`
`CANONICAL_PAYLOAD_SOURCE=REPOSITORY_TOOL_ONLY`
`MERGE=HOLD`
`DEPLOYMENT=HOLD`
`TRANSACTION_AUTHORITY=false`
`COMMERCIAL_GO_LIVE=HOLD`
