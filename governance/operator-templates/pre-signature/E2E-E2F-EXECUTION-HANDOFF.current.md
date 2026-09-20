# E2E → E2F Execution Handoff — frozen RC #363

> تشغيل/استلام حوكمي فقط. لا ينشئ هذا الملف أي مراجعة بشرية أو evidence خارجي أو توقيع أو سلطة إطلاق.

## 1. الـRC المجمد — لا تغيير

- releaseCandidateId: `startak-real-estate-rc-2026-09-16-e876208c19ff`
- sourceCommitSha: `e876208c19ffbddd0dacd2bf8fce24aba1e52b55`
- artifactSha256: `c3ddcd7b4a66fd58c271fb08b9e5a3efb5e4237f0015d3771e7ab9818412017f`
- environmentRef: `cloudflare-pages:startak-real-estate:production`
- environmentConfigSha256: `819183fb9f4fb09017c636d2d1d841dd086ac4ba4bbccd103dffbc4c5980bc73`

أي evidence أو packet أو توقيع مربوط بtuple مختلف غير صالح لهذا الإصدار.

## 2. نقطة التوقف الحقيقية قبل E2E

الـrepository يملك محرك E2E واختبارات هندسية صحيحة، لكن ذلك لا يعني وجود production E2E evidence.

القضية #363 تسجل صراحة أن E2E الإنتاجي يحتاج أولًا **real Saudi/external substantive-review and activation-mapping chain**. لذلك لا يجوز استخدام fixture المعماري أو تكوين E2D مصطنع للوصول شكليًا إلى READY.

المطلوب فعليًا قبل بناء E2E النهائي:

1. E2D activation proposal packet حقيقي وسليم cryptographically/integrity-wise؛
2. حالته حرفيًا `ACTIVATION_PROPOSAL_READY_FOR_IMPLEMENTATION_GOVERNANCE`؛
3. لكل activation proposal سجل implementation evidence حقيقي؛
4. لكل implementation سجل independent conformance evidence حقيقي من actor مختلف عن implementer؛
5. كل rule coverage مطابق حرفيًا للـproposal؛
6. implementation `sourceCommitSha` لهذا الإصدار يطابق `e876208c19ffbddd0dacd2bf8fce24aba1e52b55`.

بدون هذه المدخلات تبقى E2E على HOLD. لا يوجد في حزمة الدعم الحالية production E2D packet يجوز اعتباره بدلًا عنها.

## 3. أداة E2E fail-closed الجديدة

الأداة:

`tools/e2e-rule-implementation-conformance-intake.js`

هي wrapper تشغيلي يستدعي مباشرة:

`createRuleImplementationConformanceEvidencePacket`

من تنفيذ المستودع الرسمي. لا تنشئ evidence من تلقاء نفسها ولا تقبل placeholders.

التشغيل بعد وصول المدخلات الحقيقية فقط:

```bash
node tools/e2e-rule-implementation-conformance-intake.js \
  --policy governance/e2e-rule-implementation-conformance-evidence-policy-2026-09-08.json \
  --upstream <QUALIFIED_GENUINE_E2D_PACKET.json> \
  --implementation <GENUINE_IMPLEMENTATION_EVIDENCE.json> \
  --conformance <GENUINE_INDEPENDENT_CONFORMANCE_EVIDENCE.json> \
  --packet-id <CURRENT_RC_E2E_PACKET_ID> \
  --prepared-by <REAL_PREPARER_REF> \
  --prepared-at <REAL_ISO_8601_TIME> \
  --expected-source-sha e876208c19ffbddd0dacd2bf8fce24aba1e52b55 \
  --out <E2E_FINAL.json>
```

القبول فقط إذا كانت الحالة:

`RULE_IMPLEMENTATION_EVIDENCE_READY_FOR_EXTERNAL_CONFORMANCE_VALIDATION`

ويجب أن يكون pin المحمي لاحقًا هو نفس:

`evidencePacketHashSha256`

### E2E record contract

Implementation record لكل candidate يحتاج على الأقل:

- `implementationId`
- `candidateId`
- `ruleSetId`
- `implementedRuleRefs`
- `sourceCommitSha`
- `codeArtifactSha256`
- `implementationEvidenceRef`
- `implementedByRef`
- `implementedAt`

Independent conformance record لكل candidate يحتاج على الأقل:

- `conformanceId`
- `candidateId`
- `ruleSetId`
- `testedRuleRefs`
- `testSuiteRef`
- `testArtifactSha256`
- `conformanceEvidenceRef`
- `conformanceArtifactSha256`
- `verifiedByRef`
- `verifiedAt`
- `result = PASS|FAIL|INCONCLUSIVE`

`implementedByRef` و`verifiedByRef` لا يجوز أن يكونا نفس actor عندما تكون self-verification ممنوعة، كما هو الحال في السياسة الحالية.

## 4. الانتقال إلى E2F

لا يبدأ `EXTERNAL_CONFORMANCE_AUTHENTICITY` نهائيًا قبل وجود E2E packet حقيقي مؤهل. أما technical candidate references للأمن/الأداء/المرونة فهي staged فقط في:

`governance/operator-templates/pre-signature/TECHNICAL-EVIDENCE-INDEX.current.json`

ولا تتحول إلى external validation تلقائيًا.

### trust root الحالي

- verifier: `human:said`
- verifierId: `e2f-verifier-said-2026-09-17`
- publicKeySha256: `fbd4b0eee65ba6a08dfd6f673a80eb538149549f6bfcef26ade26ddacab14af1`
- E2F verifier registry deterministic SHA-256: `fb544ff5555be8f71fb9afbda1f5f2edc60aa8465bd7d91ea392c6865873fbaa`

هذا public trust material فقط. Out-of-band pinning ما زال مطلوبًا.

## 5. أداة E2F signing-request / packet intake

الأداة:

`tools/e2f-validation-intake.js`

### 5.1 إنشاء طلب توقيع واحد

بعد أن يراجع سعيد evidence الحقيقي ويقرر فعليًا `VERIFIED` أو `REJECTED` أو `INCONCLUSIVE`، يُنشأ unsigned validation record مكتمل بدون `signatureBase64` ثم:

```bash
node tools/e2f-validation-intake.js signing-request \
  --policy governance/e2f-external-conformance-production-validation-policy-2026-09-08.json \
  --validation <UNSIGNED_REAL_VALIDATION.json> \
  --out <SIGNING_REQUEST.json>
```

الأداة تستدعي `createValidationSigningPayload` من implementation المستودع وتصدر:

- normalized `payload`
- `signingBytesUtf8`
- `signingPayloadBase64`
- `signingPayloadHashSha256`

ولا تقبل private key ولا تنفذ signing.

على سعيد توقيع **نفس `signingBytesUtf8`** بـRSA-SHA256 خارج GitHub/CI/chat ثم إعادة `signatureBase64` فقط إلى validation record.

### 5.2 الأنواع الأربعة المطلوبة

1. `EXTERNAL_CONFORMANCE_AUTHENTICITY`
2. `PRODUCTION_SECURITY_VALIDATION`
3. `PRODUCTION_PERFORMANCE_VALIDATION`
4. `PRODUCTION_RESILIENCE_VALIDATION`

تنبيه فصل الأدوار: الشخص الذي سجل E2E conformance evidence لا يجوز أن يكون هو نفسه من self-authenticates ذلك السجل في `EXTERNAL_CONFORMANCE_AUTHENTICITY`. لذلك إذا كان `human:said` هو E2F verifier، يجب أن يكون E2E conformance verifier subject مختلفًا عنه.

### 5.3 بناء E2F packet بعد التوقيعات الأربعة

قالب release candidate الحالي:

`governance/operator-templates/e2f-release-candidate.current.template.json`

يُستبدل placeholder الوحيد فيه بقيمة `evidencePacketHashSha256` من E2E النهائي، ثم:

```bash
node tools/e2f-validation-intake.js packet \
  --policy governance/e2f-external-conformance-production-validation-policy-2026-09-08.json \
  --upstream <E2E_FINAL.json> \
  --release <E2F_RELEASE_CANDIDATE.json> \
  --registry governance/operator-templates/e2f-verifier-registry.current.json \
  --expected-registry-sha fb544ff5555be8f71fb9afbda1f5f2edc60aa8465bd7d91ea392c6865873fbaa \
  --validations <FOUR_SIGNED_VALIDATIONS.json> \
  --packet-id <CURRENT_RC_E2F_PACKET_ID> \
  --prepared-by <REAL_PREPARER_REF> \
  --prepared-at <REAL_ISO_8601_TIME> \
  --out <E2F_FINAL.json>
```

القبول فقط إذا كانت الحالة:

`EXTERNAL_CONFORMANCE_AND_PRODUCTION_VALIDATION_COMPLETE_PENDING_RELEASE_AUTHORITY`

ويجب أن يكون pin النهائي مساويًا لـ:

`validationPacketHashSha256`

## 6. حدود الأدلة الحالية

الدليل التقني الحالي يثبت أشياء مهمة، منها exact-source engineering qualification والـdeterministic release artifact وread-only Cloudflare provider posture. لكنه لا يثبت تلقائيًا:

- external conformance authenticity؛
- independent E2E conformance؛
- production security validation decision by Said؛
- production performance validation decision by Said؛
- production resilience validation decision by Said؛
- أي توقيع RSA-SHA256 بشري؛
- release/merge/deployment approval.

لذلك لا يجوز تحويل technical evidence index إلى `VERIFIED` آليًا.

## 7. ترتيب التنفيذ من هنا

1. إغلاق #254 بتوقيع سعيد الحقيقي ثم P25 re-evaluation.
2. استكمال upstream E2D الحقيقي المطلوب للإصدار الحالي.
3. تشغيل E2E intake على implementation + independent conformance evidence الحقيقيين.
4. تثبيت E2E packet hash out-of-band حسب السياسة.
5. إكمال أربع E2F validations الحقيقية وإنشاء signing requests.
6. سعيد يوقع كل canonical payload فعليًا.
7. بناء E2F final packet والتحقق منه.
8. الانتقال إلى E2G فقط بعد E2F PASS.
9. إغلاق #327 قبل final RC→main release sequence.

## 8. منع الالتباس

نجاح الأدوات أو الاختبارات على synthetic runtime fixtures لا يساوي production evidence. اختبارات runtime الجديدة هدفها إثبات أن wrappers تستخدم contracts الحاكمة وأن canonical E2F signing bytes تتوافق مع verifier implementation؛ ولا تمنح أي authority effect.

`RC=FROZEN_UNCHANGED`
`#254=HOLD_GENUINE_MEMO_AND_SIGNATURE`
`E2D_PRODUCTION_UPSTREAM=MISSING_GENUINE_EXTERNAL_CHAIN`
`E2E=HOLD_UNTIL_GENUINE_UPSTREAM_AND_EVIDENCE`
`E2F=HOLD_UNTIL_GENUINE_E2E_AND_FOUR_SIGNED_VALIDATIONS`
`E2G=HOLD_UPSTREAM_E2F`
`MERGE=HOLD`
`DEPLOY=HOLD`
`TRANSACTION_AUTHORITY=false`
`COMMERCIAL_GO_LIVE=HOLD`
