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

يجب توثيق الأدلة التي تمت مراجعتها، نتائج البنود الثمانية، الملاحظات والاستثناءات، المبررات، وقرار واحد فقط من `APPROVE|REJECT|HOLD`.

## 3) تثبيت المذكرة المكتملة

بعد اكتمال المذكرة الحقيقية، تحفظ كملف مستقل ثابت ثم يحسب SHA-256 للنسخة المكتملة. النسخة الحالية التي قدّمها المراجع في مسار التشغيل لها SHA-256:

`3e992e93dd701283215d95d3d3cf2ab0fe1d7ccda605866ab829f4e743a16aec`

هذه القيمة تصبح `decisionArtifactSha256` عند إعادة إنشاء حزمة التوقيع بعد تدوير المفتاح.

## 4) حالة مفتاح المراجع بعد التدوير

تمت موافقة المالك على تدوير مفتاح `human:said` للمسار `CANONICAL_REBASELINE_INDEPENDENT_REVIEW`.

- المفتاح السابق SHA-256: `fbd4b0eee65ba6a08dfd6f673a80eb538149549f6bfcef26ade26ddacab14af1`
- المفتاح الحالي SHA-256: `0af393bd7c091106c3b16e493b4f99d39570c77675c9c5dee175d5a7727ebbc1`
- effectiveFrom: `2026-09-21T09:01:00+03:00`
- owner rotation evidence: `https://github.com/turkialeid2030/startak-real-estate/issues/367#issuecomment-5756079007`

أي unsigned attestation أو canonical payload تم إنشاؤه بوقت قرار يسبق `effectiveFrom` يجب التخلص منه وإعادة إنشائه. لا يجوز إعادة استخدام payload السابق بعد التدوير.

## 5) إنشاء الـattestation غير الموقعة

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

## 6) المصدر الوحيد المعتمد للـcanonical signing payload

الأداة المرجعية الوحيدة لإنتاج bytes التوقيع هي:

`tools/prepare-canonical-rebaseline-review-signing-payload.js`

الأداة المحلية:

`governance/operator-templates/local-tools/prepare-said-review-signing.ps1`

يجب إعادة تشغيلها بعد key rotation حتى يكون `decidedAt` داخل فترة صلاحية المفتاح الحالي.

## 7) التوقيع الحقيقي

- الخوارزمية: `RSA-SHA256`.
- المفتاح الخاص يبقى محليًا ولا يدخل GitHub أو CI أو ChatGPT أو artifacts.
- يوقّع سعيد `signingBytesUtf8` نفسها دون تعديل.
- المفتاح العام المسجل يجب أن يطابق البصمة الحالية:
  `0af393bd7c091106c3b16e493b4f99d39570c77675c9c5dee175d5a7727ebbc1`.

## 8) التحقق الرسمي بعد التوقيع

سجل المراجع الحالي:

`governance/operator-templates/canonical-rebaseline-reviewer-registry.current.json`

البصمة الحاكمة المحسوبة بواسطة تنفيذ المستودع بعد تدوير المفتاح:

`2cd45d81863afb8d41a30404d5b1cf2113c216abf6ae13e51d6f41e0962d0f53`

أداة التحقق الرسمية:

```bash
node tools/verify-canonical-rebaseline-review-attestation.js \
  --packet governance/operator-templates/current-lineage-review/review-packet.current.json \
  --reviewer-registry governance/operator-templates/canonical-rebaseline-reviewer-registry.current.json \
  --expected-reviewer-registry-hash 2cd45d81863afb8d41a30404d5b1cf2113c216abf6ae13e51d6f41e0962d0f53 \
  --attestation <PATH_TO_SIGNED_ATTESTATION_JSON> \
  --output <PATH_TO_VERIFIED_RESPONSE_JSON>
```

القبول يكون فقط إذا كانت الحالة حرفيًا:

`VERIFIED_REVIEW_RESPONSE_READY_FOR_P25_REEVALUATION`

أي حالة أخرى تبقي #254 على HOLD.

## 9) حدود ما يتحقق منه verifier

الـverifier يثبت تشفيريًا ربط القرار بنفس P26 packet، وجود المراجع في trust registry، تطابق subject والغرض والفترة الزمنية، فصل المالك عن المراجع، وصحة توقيع RSA-SHA256. لا يثبت آليًا جودة المحتوى المهني للمذكرة.

## 10) إعادة تقييم P25 وما بعده

نجاح verifier لا يغلق #254 تلقائيًا. يجب تمرير الـverified response إلى مسار P25 الحاكم. ولا ينتج عن نجاح #254 وحده أي Canonical activation أو Release/Merge/Deployment/Go-Live/Transaction Authority.

`#254=HOLD_UNTIL_GENUINE_RSA_SIGNATURE_AND_P25_REEVALUATION`
`CANONICAL_PAYLOAD_MUST_BE_REGENERATED_AFTER_KEY_ROTATION=true`
`CANONICAL_PAYLOAD_SOURCE=REPOSITORY_TOOL_ONLY`
`MERGE=HOLD`
`DEPLOYMENT=HOLD`
`TRANSACTION_AUTHORITY=false`
`COMMERCIAL_GO_LIVE=HOLD`
