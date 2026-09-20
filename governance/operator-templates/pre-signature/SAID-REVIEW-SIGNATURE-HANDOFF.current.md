# تسليم مرحلة توقيع مراجعة سعيد — #254

> وثيقة تشغيلية فقط. لا تمثل مراجعة أو قرارًا أو توقيعًا، ولا تنشئ أي صلاحية إصدار/دمج/نشر.

## الحالة المرجعية

- Release Candidate: `startak-real-estate-rc-2026-09-16-e876208c19ff`
- Source SHA: `e876208c19ffbddd0dacd2bf8fce24aba1e52b55`
- Artifact SHA-256: `c3ddcd7b4a66fd58c271fb08b9e5a3efb5e4237f0015d3771e7ab9818412017f`
- Environment: `cloudflare-pages:startak-real-estate:production`
- Environment Config SHA-256: `819183fb9f4fb09017c636d2d1d841dd086ac4ba4bbccd103dffbc4c5980bc73`
- P26 Review Packet SHA-256: `ed8a0ffb242081d308f89b1e177920d6bf2d6e058bceb5047ddedaf4f0eed107`
- Reviewer: `human:said`
- Reviewer ID: `reviewer-said-2026-09-17`
- Reviewer public-key SHA-256: `fbd4b0eee65ba6a08dfd6f673a80eb538149549f6bfcef26ade26ddacab14af1`
- Reviewer registry deterministic hash: `62c76efae99b3cf07a2f2fe7182b9c76932b39e9b72bd1eb48ea625dc620b5ca`

## ما هو جاهز

1. مذكرة المراجعة القالبية:
   `governance/operator-templates/current-lineage-review/SAID-INDEPENDENT-REVIEW-MEMO.template.md`
2. سجل المراجع:
   `governance/operator-templates/canonical-rebaseline-reviewer-registry.current.json`
3. حزمة P26 الحالية:
   `governance/operator-templates/current-lineage-review/review-packet.current.json`
4. أداة إعداد canonical signing payload:
   `tools/prepare-canonical-rebaseline-review-signing-payload.js`
5. أداة التحقق بعد التوقيع:
   `tools/verify-canonical-rebaseline-review-attestation.js`
6. أداة التشغيل المحلية المساعدة:
   `governance/operator-templates/local-tools/prepare-said-review-signing.ps1`

## نقطة التوقف الحقيقية

لا يمكن إنشاء **حزمة توقيع نهائية غير موقعة صالحة** الآن؛ لأن الأداة المحلية تتطلب ملف مذكرة مراجعة مكتملًا ونتيجة فعلية من `APPROVE|REJECT|HOLD`، وترفض صراحةً أي مذكرة تحتوي على علامات القالب غير المكتمل مثل:

- `يستكملها سعيد`
- `يكتب سعيد`
- `TEMPLATE_ONLY=true`
- `- [ ]`

هذا القيد مقصود لمنع تحويل القالب أو القرار المنقول إلى مراجعة بشرية مصطنعة.

## المدخل البشري المطلوب مرة واحدة

على سعيد استكمال النسخة الفعلية من مذكرة المراجعة، متضمنة:

- الأدلة التي راجعها فعليًا؛
- نتيجة البنود الثمانية؛
- الملاحظات/التحفظات؛
- المبررات؛
- نتيجة واحدة فقط من `APPROVE|REJECT|HOLD`.

القرار المنقول سابقًا `APPROVE_REPORTED` محفوظ كسجل فقط ولا يكفي وحده.

## التشغيل بعد استلام المذكرة

من جذر المستودع على جهاز سعيد/المشغل الموثوق:

```powershell
powershell -ExecutionPolicy Bypass -File .\governance\operator-templates\local-tools\prepare-said-review-signing.ps1 `
  -MemoPath "<PATH_TO_COMPLETED_SAID_REVIEW_MEMO>" `
  -Result APPROVE
```

> يجب استبدال `APPROVE` بالنتيجة الحقيقية إذا كانت `REJECT` أو `HOLD`.

هذا التشغيل بدون `-Sign` ينشئ محليًا فقط:

- `said-review-attestation.unsigned.json`
- `said-review-signing-payload.tool-output.json`
- `said-review-signing-payload.canonical.txt`
- `said-review-signing-payload.sha256.txt`
- `said-review-signing-payload.base64.txt`
- `said-review-signing-manifest.json`

ويحسب `decisionArtifactSha256` من bytes المذكرة المكتملة، ثم يستدعي أداة المستودع الرسمية لإنتاج الـcanonical signing payload. لا يعاد بناء الـpayload يدويًا.

## التوقيع

التوقيع يتم بواسطة سعيد فقط وخارج GitHub/CI/chat. يمكنه إعادة التشغيل محليًا مع `-Sign` عندما يكون هو من ينفذ خطوة التوقيع ويكون المفتاح الخاص تحت سيطرته.

لا يُرفع المفتاح الخاص أو العبارة السرية أو أي credential إلى المستودع أو المحادثة.

## التحقق الرسمي بعد التوقيع

```bash
node tools/verify-canonical-rebaseline-review-attestation.js \
  --packet governance/operator-templates/current-lineage-review/review-packet.current.json \
  --reviewer-registry governance/operator-templates/canonical-rebaseline-reviewer-registry.current.json \
  --expected-reviewer-registry-hash 62c76efae99b3cf07a2f2fe7182b9c76932b39e9b72bd1eb48ea625dc620b5ca \
  --attestation <PATH_TO_SIGNED_ATTESTATION_JSON> \
  --output <PATH_TO_VERIFIED_RESPONSE_JSON>
```

لا تعتبر #254 ناجحة إلا إذا كانت الحالة حرفيًا:

`VERIFIED_REVIEW_RESPONSE_READY_FOR_P25_REEVALUATION`

ثم يجب تنفيذ P25 re-evaluation الحاكم. نجاح التوقيع وحده لا يمنح Release/Merge/Deployment/Go-Live/Transaction Authority.

## التسلسل التالي مباشرة بعد #254

1. P25 governed re-evaluation.
2. E2E genuine implementation-conformance packet + pin.
3. E2F أربع validations حقيقية وموقعة.
4. E2G ثلاث قرارات بشرية موقعة مع الفصل بين السلطات.
5. Provision للقيم الحقيقية للأسرار العشرة.
6. إغلاق #327 بعد إثبات approval boundary.
7. Final RC→main PR على SHA المجمد فقط.
8. `release-verify` + `trusted-main-production-governance`.
9. Merge ثم Deployment كخطوتين مستقلتين.
10. E2H / E2I وإثباتات ما بعد النشر.

`#254=BLOCKED_ON_GENUINE_HUMAN_MEMO`
`UNSIGNED_SIGNING_PACKAGE=READY_TO_GENERATE_ONCE_MEMO_EXISTS`
`RC=FROZEN_UNCHANGED`
`MERGE=HOLD`
`DEPLOY=HOLD`
`TRANSACTION_AUTHORITY=false`
`COMMERCIAL_GO_LIVE=HOLD`
