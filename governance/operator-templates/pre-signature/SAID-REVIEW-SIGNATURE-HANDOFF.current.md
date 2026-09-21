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
- Reviewer current public-key SHA-256: `0af393bd7c091106c3b16e493b4f99d39570c77675c9c5dee175d5a7727ebbc1`
- Reviewer previous public-key SHA-256: `fbd4b0eee65ba6a08dfd6f673a80eb538149549f6bfcef26ade26ddacab14af1`
- Reviewer current registry deterministic hash: `2cd45d81863afb8d41a30404d5b1cf2113c216abf6ae13e51d6f41e0962d0f53`
- Current key effectiveFrom: `2026-09-21T09:01:00+03:00`
- Owner key-rotation evidence: `https://github.com/turkialeid2030/startak-real-estate/issues/367#issuecomment-5756079007`

## حالة المذكرة

المذكرة المكتملة المقدمة في مسار التشغيل الحالي لها SHA-256:

`3e992e93dd701283215d95d3d3cf2ab0fe1d7ccda605866ab829f4e743a16aec`

تم تقديم قرار `APPROVE` من المراجع، لكن التحقق التشفيري من هوية الموقّع لم يحدث بعد. لذلك #254 ما زال HOLD.

## أثر تدوير المفتاح

حزمة التوقيع غير الموقعة التي أُنشئت قبل تدوير المفتاح لا تستخدم للتوقيع النهائي إذا كان `decidedAt` فيها يسبق `effectiveFrom` للمفتاح الحالي. يجب إعادة تشغيل أداة الإعداد بعد تدوير المفتاح للحصول على attestation وcanonical payload جديدين.

## إعادة إنشاء الحزمة غير الموقعة

من جذر المستودع على الجهاز الموثوق:

```powershell
powershell -ExecutionPolicy Bypass -File .\governance\operator-templates\local-tools\prepare-said-review-signing.ps1 `
  -MemoPath "$HOME\Desktop\SAID-INDEPENDENT-REVIEW-MEMO.completed.md" `
  -Result APPROVE
```

هذا التشغيل بدون `-Sign` ينشئ محليًا:

- `said-review-attestation.unsigned.json`
- `said-review-signing-payload.tool-output.json`
- `said-review-signing-payload.canonical.txt`
- `said-review-signing-payload.sha256.txt`
- `said-review-signing-payload.base64.txt`
- `said-review-signing-manifest.json`

## التوقيع بالمفتاح الحالي

التوقيع يتم بواسطة سعيد فقط محليًا. لا يُرفع المفتاح الخاص أو العبارة السرية أو أي credential إلى المستودع أو المحادثة.

استخدم المفتاحين المحليين الحاليين:

- private: `$HOME\Documents\STARTAK-SAID-KEYS\startak-said-review-private.pem`
- public: `$HOME\Documents\STARTAK-SAID-KEYS\startak-said-review-public.pem`

مع الأداة:

```powershell
powershell -ExecutionPolicy Bypass -File .\governance\operator-templates\local-tools\prepare-said-review-signing.ps1 `
  -MemoPath "$HOME\Desktop\SAID-INDEPENDENT-REVIEW-MEMO.completed.md" `
  -Result APPROVE `
  -Sign `
  -PrivateKeyPath "$HOME\Documents\STARTAK-SAID-KEYS\startak-said-review-private.pem" `
  -PublicKeyPath "$HOME\Documents\STARTAK-SAID-KEYS\startak-said-review-public.pem"
```

## التحقق الرسمي بعد التوقيع

```bash
node tools/verify-canonical-rebaseline-review-attestation.js \
  --packet governance/operator-templates/current-lineage-review/review-packet.current.json \
  --reviewer-registry governance/operator-templates/canonical-rebaseline-reviewer-registry.current.json \
  --expected-reviewer-registry-hash 2cd45d81863afb8d41a30404d5b1cf2113c216abf6ae13e51d6f41e0962d0f53 \
  --attestation <PATH_TO_SIGNED_ATTESTATION_JSON> \
  --output <PATH_TO_VERIFIED_RESPONSE_JSON>
```

لا تعتبر #254 ناجحة إلا إذا كانت الحالة حرفيًا:

`VERIFIED_REVIEW_RESPONSE_READY_FOR_P25_REEVALUATION`

ثم يجب تنفيذ P25 re-evaluation الحاكم. نجاح التوقيع وحده لا يمنح Release/Merge/Deployment/Go-Live/Transaction Authority.

`#254=HOLD_SIGNATURE_AND_P25_REEVALUATION`
`KEY_ROTATION=OWNER_APPROVED`
`CANONICAL_PAYLOAD_REGENERATION_REQUIRED=true`
`RC=FROZEN_UNCHANGED`
`MERGE=HOLD`
`DEPLOY=HOLD`
`TRANSACTION_AUTHORITY=false`
`COMMERCIAL_GO_LIVE=HOLD`
