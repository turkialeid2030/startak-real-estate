# E2C Production Trust-Root Handoff — frozen RC #363

> حوكمة تشغيلية فقط. هذا الملف لا يعيّن مدققًا فعليًا، ولا ينشئ اعتمادًا أو توقيعًا أو دليلًا خارجيًا أو سلطة إصدار/دمج/نشر/معاملة.

## 1. الـRC المجمد — لا تغيير

- releaseCandidateId: `startak-real-estate-rc-2026-09-16-e876208c19ff`
- sourceCommitSha: `e876208c19ffbddd0dacd2bf8fce24aba1e52b55`
- artifactSha256: `c3ddcd7b4a66fd58c271fb08b9e5a3efb5e4237f0015d3771e7ab9818412017f`
- environmentRef: `cloudflare-pages:startak-real-estate:production`
- environmentConfigSha256: `819183fb9f4fb09017c636d2d1d841dd086ac4ba4bbccd103dffbc4c5980bc73`

## 2. الحالة الفعلية

أدوات E2B/E2C/E2D موجودة ومؤهلة هندسيًا، لكن E2C الإنتاجي ما زال متوقفًا لأن سياسة E2C الحالية تسجل صراحة:

- `productionTrustedVerifierRegistryConfigured=false`
- `productionExternalAttestationEvidencePresent=false`

كما أن قرار تدوير مفتاح سعيد الموجود في #367، comment `5756532755`، نطاقه **E2F وE2G Deployment فقط**. لذلك لا يجوز تفسيره كاعتماد لسعيد أو لأي شخص آخر كـE2C verifier.

## 3. قرار المالك/الحوكمة المطلوب قبل أي E2C إنتاجي

يجب تسجيل قرار صريح يحدد على الأقل:

1. `registryId` لسجل E2C الإنتاجي؛
2. `verifierId`؛
3. `verifierSubjectRef`؛
4. `authorityClass`؛
5. المفتاح العام PEM المعتمد فقط؛
6. SHA-256 المطابق للمفتاح العام؛
7. `governanceEvidenceRef` لقرار التعيين/المصدر الخارجي؛
8. `activeFrom` الحقيقي؛
9. تأكيد أن الـregistry حالته `EXTERNALLY_GOVERNED`؛
10. فصل المدقق عن المراجع محل التحقق بما يمنع self-validation.

القالب الجاهز:

`governance/operator-templates/e2c-trusted-verifier-registry.input.template.json`

هذا القالب يحتوي placeholders عمدًا وسيتم رفضه بواسطة أداة E2C إلى أن تُستبدل ببيانات حقيقية معتمدة.

## 4. حدود الاستقلالية

E2C يتحقق من أربع فئات إلزامية:

1. `REVIEW_EVIDENCE_AUTHENTICITY`
2. `CREDENTIAL_AUTHENTICITY`
3. `REVIEWER_AUTHORITY`
4. `REVIEWER_INDEPENDENCE`

إذا كان `verifierSubjectRef` هو نفس `reviewerRef` المرتبط بالدليل محل التحقق، فإن محرك E2C يرفض الحالة كـ`SELF_VALIDATION_PROHIBITED`.

لذلك يجب تحديد المدقق بعد معرفة هوية المراجع/المراجعين الفعليين في E2/E2B، أو اعتماد بنية متعددة المدققين تمنع أي تضارب على مستوى كل attestation.

## 5. بناء trust root بعد القرار الحقيقي

بعد اعتماد السجل وإدخال المفتاح العام فقط:

1. احذف `templateOnly` و`instructions` وأي حقول ليست جزءًا من السجل الحاكم إذا كانت النسخة النهائية ستستخدم مباشرة مع المحرك.
2. تأكد من عدم وجود أي placeholder.
3. احسب hash السجل من خلال نفس normalization/`sha256(core)` المستخدم في `normalizeTrustedVerifierRegistry`، وليس raw-file SHA فقط.
4. ثبّت الـregistry hash خارج المستودع Out-of-Band حسب السياسة.
5. لا تنقل private key أو passphrase إلى GitHub/CI/chat.

## 6. إنشاء طلبات التوقيع الحقيقية

بعد وجود E2B envelope حقيقي مؤهل، يُعد كل attestation غير موقع بالحقول الحقيقية، ثم:

```bash
node tools/e2c-external-authority-validation-intake.js signing-request \
  --policy governance/e2c-external-authority-validation-policy-2026-09-08.json \
  --attestation <UNSIGNED_REAL_ATTESTATION.json> \
  --out <SIGNING_REQUEST.json>
```

الأداة تصدر `signingBytesUtf8` canonical فقط. التوقيع يتم خارجيًا بواسطة المدقق الحقيقي باستخدام `RSA-SHA256`.

## 7. بناء E2C النهائي

بعد استلام جميع attestations الحقيقية الموقعة:

```bash
node tools/e2c-external-authority-validation-intake.js packet \
  --policy governance/e2c-external-authority-validation-policy-2026-09-08.json \
  --envelope <QUALIFIED_GENUINE_E2B_ENVELOPE.json> \
  --registry <APPROVED_E2C_VERIFIER_REGISTRY.json> \
  --expected-registry-sha <OUT_OF_BAND_PINNED_REGISTRY_SHA256> \
  --attestations <GENUINE_SIGNED_ATTESTATIONS.json> \
  --packet-id <CURRENT_RC_E2C_PACKET_ID> \
  --prepared-by <REAL_PREPARER_REF> \
  --prepared-at <REAL_ISO_8601_TIME> \
  --out <E2C_FINAL.json>
```

القبول فقط إذا كانت الحالة حرفيًا:

`AUTHORITY_VALIDATION_COMPLETE_PENDING_SUBSTANTIVE_REVIEW`

## 8. ما لا يثبته نجاح E2C

حتى نجاح E2C لا يثبت تلقائيًا:

- legal correctness؛
- professional applicability؛
- standards conformance؛
- Saudi professional licensing؛
- PDPL/tax/financial-reporting compliance؛
- certified valuation authority؛
- rule activation؛
- Release/Merge/Deployment/Transaction Authority؛
- commercial Go-Live.

هذه تبقى بوابات مستقلة لاحقة.

## 9. التسلسل بعد E2C

1. E2D substantive review + genuine activation mappings/evidence.
2. E2E implementation + independent conformance evidence.
3. E2F four genuine external/production validations + signatures.
4. E2G genuine Release/Merge/Deployment decisions + signatures.
5. إغلاق #327 independent production approval boundary.
6. final RC→main sequence فقط بعد PASS كامل للبوابات.

`E2C_PRODUCTION_TRUST_ROOT=OWNER_OR_EXTERNAL_GOVERNANCE_DECISION_REQUIRED`
`E2C_CURRENT_VERIFIER=NOT_DESIGNATED`
`E2C_OUT_OF_BAND_PIN=NOT_PRESENT`
`E2C_PRODUCTION_ATTESTATIONS=NOT_PRESENT`
`E2C=HOLD`
`E2D=HOLD_UPSTREAM_E2C`
`E2E=HOLD`
`E2F=HOLD`
`E2G=HOLD`
`#327=PARTIAL_PASS_OPEN`
`FINAL_RC_TO_MAIN_PR=HOLD`
`MERGE=HOLD`
`DEPLOY=HOLD`
`TRANSACTION_AUTHORITY=false`
`COMMERCIAL_GO_LIVE=HOLD`
