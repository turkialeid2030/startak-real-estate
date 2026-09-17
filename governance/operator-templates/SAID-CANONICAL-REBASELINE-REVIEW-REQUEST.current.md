# طلب استكمال مادة المراجعة المستقلة — سعيد — #254

> هذا الملف لا يطلب من سعيد موافقة جديدة. قرار سعيد «اعتمد» مسجل كقرار بشري منقول `APPROVE_REPORTED`. المطلوب الآن هو استكمال مادة المراجعة الفعلية اللازمة لبناء الـcanonical signing payload عبر المسار البرمجي المعتمد. لا يمثل هذا الملف توقيعًا ولا يفعّل خط الأساس ولا يمنح Release/Merge/Deployment/Transaction authority.

## الغرض

استكمال المراجعة البشرية المستقلة للمرشح المتكامل الحالي وفق غرض:

`CANONICAL_REBASELINE_INDEPENDENT_REVIEW`

## المرشح المجمد المطلوب مراجعته

- releaseCandidateId: `startak-real-estate-rc-2026-09-16-e876208c19ff`
- sourceCommitSha: `e876208c19ffbddd0dacd2bf8fce24aba1e52b55`
- artifactSha256: `c3ddcd7b4a66fd58c271fb08b9e5a3efb5e4237f0015d3771e7ab9818412017f`
- environmentRef: `cloudflare-pages:startak-real-estate:production`
- environmentConfigSha256: `819183fb9f4fb09017c636d2d1d841dd086ac4ba4bbccd103dffbc4c5980bc73`
- governedEvidenceCollectorRun: `35127270331`
- evidenceArtifactId: `10460380584`

أي مراجعة مرتبطة بمصدر/Artifact/Environment مختلف لا تخص هذا الطلب.

## السلسلة الحالية المولدة برمجيًا

تم إنشاء current-lineage P24/P25/P26 من الصفر للـtuple أعلاه، دون إعادة استخدام #348/#359:

- proposalId: `p24-startak-real-estate-rc-2026-09-16-e876208c19ff`
- proposalHashSha256: `b6575cb5c7c5ebd2a84ae71b2b31f1cb25a2562dc01d6e82608045e9d4d0557b`
- ownerDecisionHashSha256: `2633792a0dabb50abf9caaef5a0b01ff55d9b2dc992f931c8708c9139dc0feb2`
- reviewRequestId: `p26-review-startak-real-estate-rc-2026-09-16-e876208c19ff-said-1`
- reviewPacketHashSha256: `ed8a0ffb242081d308f89b1e177920d6bf2d6e058bceb5047ddedaf4f0eed107`
- packet status: `READY_FOR_INDEPENDENT_REVIEW`
- expected actor: `human:said`

الملفات المرجعية موجودة تحت:

`governance/operator-templates/current-lineage-review/`

## المراجع المعيّن

- reviewerId: `reviewer-said-2026-09-17`
- reviewerSubjectRef: `human:said`
- reviewerDisplayName: `سعيد`
- publicKeySha256: `fbd4b0eee65ba6a08dfd6f673a80eb538149549f6bfcef26ade26ddacab14af1`
- reviewerRegistry: `governance/operator-templates/canonical-rebaseline-reviewer-registry.current.json`
- custodyRiskAcceptance: `https://github.com/turkialeid2030/startak-real-estate/issues/367`

## القرار المسجل

- reportedDecision: `APPROVE`
- source: `https://github.com/turkialeid2030/startak-real-estate/issues/254#issuecomment-5712743696`
- cryptographicStatus: `NOT_VERIFIED`

هذا القرار المنقول لا يعاد طلبه. لكنه لا يكفي وحده لإنتاج signed review.

## المطلوب الآن من سعيد/مادة المراجعة

يجب توثيق المراجعة الفعلية التي استند إليها قرار `APPROVE`، وتشمل على الأقل:

1. مذكرة مراجعة حقيقية مرتبطة بالـexact tuple أعلاه وبـP26 packet الحالي.
2. الأدلة/المراجع التي تمت مراجعتها فعليًا.
3. المبررات والشروط والتحفظات إن وجدت.
4. `decisionSourceRef` قابل للتتبع للمذكرة/القرار.
5. `decisionArtifactSha256` محسوب من bytes المذكرة الفعلية.
6. `rationaleRef` قابل للتتبع.
7. `decidedAt` الفعلي.

بعد توفر هذه الحقول فقط، يتم إنشاء `unsigned-review-attestation.json` بالنتيجة `APPROVE` ثم تشغيل الأداة المعتمدة:

```bash
node tools/prepare-canonical-rebaseline-review-signing-payload.js \
  --packet review-packet.json \
  --attestation unsigned-review-attestation.json \
  --output review-signing-payload.json
```

ثم يوقع سعيد **بالضبط** الـcanonical bytes الناتجة باستخدام RSA-SHA256 خارج GitHub/CI/chat، ويعاد `signatureBase64` فقط.

## قيود

- لا بناء يدوي للـcanonical payload.
- لا إعادة استخدام Packet قديم أو hash rebinding.
- لا اختلاق review memo/evidence/rationale أو `decisionArtifactSha256`.
- لا إنشاء توقيع بالنيابة عن سعيد.
- لا رفع private key أو passphrase إلى GitHub أو CI أو المحادثة.
- لا ينتقل #254 من HOLD إلا بعد مراجعة حقيقية موقعة وقابلة للتحقق للـexact tuple والـcurrent-lineage packet أعلاه.

`SAID_DECISION=APPROVE_REPORTED`
`CURRENT_LINEAGE_REVIEW_PACKET=READY`
`REVIEW_MEMO=REQUIRED`
`CANONICAL_SIGNING_PAYLOAD=BLOCKED_UNTIL_REVIEW_ARTIFACT_FIELDS_EXIST`
`SIGNED_REVIEW=NOT_YET`
`#254=HOLD`
`E2F=HOLD`
`E2G=HOLD`
`MERGE=HOLD`
`DEPLOY=HOLD`
