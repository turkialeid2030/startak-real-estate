# E2E → E2F Execution Handoff — frozen RC #363

> تشغيل/استلام حوكمي فقط. لا ينشئ هذا الملف أي evidence خارجي أو نتيجة تحقق أو توقيع أو سلطة إطلاق.

## 1. الـRC المجمد — لا تغيير

- releaseCandidateId: `startak-real-estate-rc-2026-09-16-e876208c19ff`
- sourceCommitSha: `e876208c19ffbddd0dacd2bf8fce24aba1e52b55`
- artifactSha256: `c3ddcd7b4a66fd58c271fb08b9e5a3efb5e4237f0015d3771e7ab9818412017f`
- environmentRef: `cloudflare-pages:startak-real-estate:production`
- environmentConfigSha256: `819183fb9f4fb09017c636d2d1d841dd086ac4ba4bbccd103dffbc4c5980bc73`

أي evidence أو packet أو توقيع مربوط بtuple مختلف غير صالح لهذا الإصدار.

## 2. #254 — مكتمل

المراجعة المستقلة الحالية أغلقت حوكمياً وشفرياً:

- `#254=PASS_CLOSED`
- reviewer: `human:said`
- current reviewer public-key SHA-256: `0af393bd7c091106c3b16e493b4f99d39570c77675c9c5dee175d5a7727ebbc1`
- reviewer registry SHA-256: `2cd45d81863afb8d41a30404d5b1cf2113c216abf6ae13e51d6f41e0962d0f53`
- verifier: `VERIFIED_REVIEW_RESPONSE_READY_FOR_P25_REEVALUATION`
- P25: `READY_FOR_EXPLICIT_BASELINE_ACTIVATION_CHANGE`

هذا لا يفعّل canonical baseline تلقائياً ولا يمنح Release/Merge/Deployment/Go-Live/Transaction Authority.

## 3. نقطة التوقف الحقيقية قبل E2E

الـrepository يملك محرك E2E واختبارات هندسية، لكن لا يوجد production E2E evidence صالح للاستعاضة به عن السلسلة الخارجية الحقيقية.

المطلوب قبل بناء E2E النهائي:

1. E2D activation proposal packet حقيقي وسليم؛
2. حالته حرفياً `ACTIVATION_PROPOSAL_READY_FOR_IMPLEMENTATION_GOVERNANCE`؛
3. implementation evidence حقيقي لكل activation proposal؛
4. independent conformance evidence حقيقي من actor مختلف عن implementer؛
5. rule coverage مطابق للـproposal؛
6. implementation `sourceCommitSha` يطابق `e876208c19ffbddd0dacd2bf8fce24aba1e52b55`.

بدون هذه المدخلات تبقى E2E على HOLD.

## 4. أداة E2E fail-closed

الأداة:

`tools/e2e-rule-implementation-conformance-intake.js`

تشغيلها يكون بعد وصول المدخلات الحقيقية فقط:

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

والـpin اللاحق يجب أن يساوي `evidencePacketHashSha256` الحقيقي للـpacket النهائي.

## 5. الانتقال إلى E2F

لا يبدأ `EXTERNAL_CONFORMANCE_AUTHENTICITY` قبل وجود E2E packet حقيقي مؤهل. أما technical references للأمن/الأداء/المرونة فهي staged فقط ولا تتحول إلى external validation تلقائياً.

### E2F trust root الحالي بعد تدوير مفتاح سعيد

اعتمد المالك تدوير مفتاح سعيد لمسار E2F في #367، comment `5756532755`.

- verifier: `human:said`
- verifierId: `e2f-verifier-said-2026-09-17`
- previous publicKeySha256: `fbd4b0eee65ba6a08dfd6f673a80eb538149549f6bfcef26ade26ddacab14af1`
- current publicKeySha256: `0af393bd7c091106c3b16e493b4f99d39570c77675c9c5dee175d5a7727ebbc1`
- E2F verifier registry deterministic SHA-256 candidate: `59de1600dd145c7504c2eb907cb19c4c0df3e98fd85e8aa2331a31a0b14386a9`
- out-of-band pinning: `STILL_REQUIRED`

التدوير يغيّر public trust material فقط؛ لا ينشئ validation أو signature.

## 6. أداة E2F signing-request / packet intake

الأداة:

`tools/e2f-validation-intake.js`

بعد أن يراجع سعيد evidence الحقيقي ويقرر فعلياً `VERIFIED` أو `REJECTED` أو `INCONCLUSIVE`، يُنشأ unsigned validation record مكتمل بدون `signatureBase64` ثم:

```bash
node tools/e2f-validation-intake.js signing-request \
  --policy governance/e2f-external-conformance-production-validation-policy-2026-09-08.json \
  --validation <UNSIGNED_REAL_VALIDATION.json> \
  --out <SIGNING_REQUEST.json>
```

يجب توقيع نفس canonical bytes خارج GitHub/CI/chat باستخدام المفتاح الخاص المقابل للمفتاح العام الحالي. لا يُعاد استخدام أي payload أو signature مرتبط بالمفتاح السابق.

الأنواع الأربعة المطلوبة:

1. `EXTERNAL_CONFORMANCE_AUTHENTICITY`
2. `PRODUCTION_SECURITY_VALIDATION`
3. `PRODUCTION_PERFORMANCE_VALIDATION`
4. `PRODUCTION_RESILIENCE_VALIDATION`

فصل الأدوار يبقى إلزامياً: إذا كان `human:said` هو E2F verifier فلا يجوز استخدامه كـself-authenticator لنفس E2E conformance evidence.

بعد أربع validations حقيقية وموقعة ومتحقق منها:

```bash
node tools/e2f-validation-intake.js packet \
  --policy governance/e2f-external-conformance-production-validation-policy-2026-09-08.json \
  --upstream <E2E_FINAL.json> \
  --release <E2F_RELEASE_CANDIDATE.json> \
  --registry governance/operator-templates/e2f-verifier-registry.current.json \
  --expected-registry-sha 59de1600dd145c7504c2eb907cb19c4c0df3e98fd85e8aa2331a31a0b14386a9 \
  --validations <FOUR_SIGNED_VALIDATIONS.json> \
  --packet-id <CURRENT_RC_E2F_PACKET_ID> \
  --prepared-by <REAL_PREPARER_REF> \
  --prepared-at <REAL_ISO_8601_TIME> \
  --out <E2F_FINAL.json>
```

القبول فقط إذا كانت الحالة:

`EXTERNAL_CONFORMANCE_AND_PRODUCTION_VALIDATION_COMPLETE_PENDING_RELEASE_AUTHORITY`

## 7. ترتيب التنفيذ الحالي

1. استكمال upstream E2D الحقيقي المطلوب للإصدار الحالي.
2. تشغيل E2E intake على implementation + independent conformance evidence الحقيقيين.
3. تثبيت E2E packet hash out-of-band حسب السياسة.
4. إكمال أربع E2F validations الحقيقية وإنشاء canonical signing requests.
5. سعيد يوقع كل canonical payload فعلياً بالمفتاح الحالي خارج المستودع/المحادثة.
6. بناء E2F final packet والتحقق منه.
7. الانتقال إلى E2G فقط بعد E2F PASS.
8. إغلاق #327 قبل final RC→main release sequence.

نجاح runtime fixtures أو CI لا يساوي production evidence ولا يمنح authority.

`RC=FROZEN_UNCHANGED`
`#254=PASS_CLOSED`
`E2D_PRODUCTION_UPSTREAM=MISSING_GENUINE_EXTERNAL_CHAIN`
`E2E=HOLD_UNTIL_GENUINE_UPSTREAM_AND_EVIDENCE`
`E2F=HOLD_UNTIL_GENUINE_E2E_AND_FOUR_SIGNED_VALIDATIONS`
`E2G=HOLD_UPSTREAM_E2F`
`#327=PARTIAL_PASS_OPEN`
`MERGE=HOLD`
`DEPLOY=HOLD`
`TRANSACTION_AUTHORITY=false`
`COMMERCIAL_GO_LIVE=HOLD`
