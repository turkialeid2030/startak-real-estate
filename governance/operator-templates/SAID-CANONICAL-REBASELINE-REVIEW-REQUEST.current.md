# طلب مراجعة مستقلة — سعيد — #254

> هذا الملف طلب مراجعة فقط. لا يمثل نتيجة مراجعة، ولا موافقة، ولا توقيعًا، ولا يفعّل خط الأساس، ولا يمنح Release/Merge/Deployment/Transaction authority.

## الغرض

إجراء مراجعة بشرية مستقلة للمرشح المتكامل الحالي وفق غرض:

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

## المراجع المعيّن

- reviewerId: `reviewer-said-2026-09-17`
- reviewerSubjectRef: `human:said`
- reviewerDisplayName: `سعيد`
- publicKeySha256: `fbd4b0eee65ba6a08dfd6f673a80eb538149549f6bfcef26ade26ddacab14af1`
- reviewerRegistry: `governance/operator-templates/canonical-rebaseline-reviewer-registry.current.json`
- custodyRiskAcceptance: `https://github.com/turkialeid2030/startak-real-estate/issues/367`

## نطاق المراجعة المطلوب من سعيد

يجب على سعيد مراجعة الأدلة الفعلية للمرشح أعلاه وتوثيق رأيه بنفسه، بما يشمل على الأقل:

1. مطابقة هوية المرشح والـ source/artifact/environment tuple دون إعادة استخدام أدلة قديمة.
2. فحص سلامة الأدلة التقنية والحوكمية ذات الصلة بالمرشح الحالي.
3. تحديد أي فجوات أو تحفظات أو مخاطر تمنع إعادة خط الأساس أو تستوجب HOLD.
4. توثيق المراجع/الأدلة التي استند إليها في مذكرة المراجعة.
5. اختيار نتيجة بشرية فعلية واحدة فقط: `APPROVE` أو `REJECT` أو `HOLD`.
6. توقيع الـ canonical signing payload الفعلي باستخدام RSA-SHA256 بالمفتاح الخاص الموافق للمفتاح العام المسجل، بعد توليد payload من الأداة/المسار المعتمد.

## مخرجات سعيد المطلوبة

- reviewMemoRef: `<TO_BE_SUPPLIED_BY_SAID>`
- reviewArtifactSha256: `<64_HEX_SHA256_OF_GENUINE_REVIEW_ARTIFACT>`
- reviewDecision: `<APPROVE|REJECT|HOLD>`
- rationaleRef: `<TO_BE_SUPPLIED_BY_SAID>`
- decidedAt: `<ISO_8601>`
- signatureAlgorithm: `RSA-SHA256`
- signatureBase64: `<ONLY_AFTER_GENUINE_SIGNATURE>`

## قيود

- لا يجوز للمالك أو المساعد اختيار نتيجة سعيد نيابة عنه.
- لا يجوز إنشاء أو اختلاق review memo أو evidence أو signature نيابة عن سعيد.
- لا يجوز لصق المفتاح الخاص أو كلمة مروره في GitHub أو CI أو المحادثة.
- تسجيل المفتاح أو هذا الطلب لا يغلق #254.
- لا ينتقل #254 من HOLD إلا بعد مراجعة حقيقية موقعة وقابلة للتحقق للـ exact tuple أعلاه.
