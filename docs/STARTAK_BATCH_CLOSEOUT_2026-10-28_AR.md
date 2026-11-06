# STARTAK العقاري — سجل تنفيذ دفعة الإغلاق 2026-10-28

> **الحالة الرسمية: HOLD / NOT_AUTHORIZED.** هذا سجل عمل هندسي وتتبّع أدلة، وليس شهادة جاهزية تجارية أو مهنية أو موافقة على دمج PR أو نشر Cloudflare.

## نطاق الدفعة والحدود

- الفرع الأساسي في GitHub: `main` عند بداية المراجعة `abd7cd1715f62f817a24b2dbec7cc891df461d51`.
- PR [#763](https://github.com/turkialeid2030/startak-real-estate/pull/763) متراكم على `main` وغير مدمج؛ CI السابق 12/12 على الرأس المؤهل السابق.
- PR [#764](https://github.com/turkialeid2030/startak-real-estate/pull/764) متراكم على #763، وهو Draft وغير مدمج؛ **579/579** تم إثباتها على الرأس السابق `13574f7781c653cf1bb20078d3a7d344e823c073` فقط.
- أي التزام أحدث يحتاج **GitHub Actions CI جديدة على SHA مطابق**؛ لا تورّث نتائج الرأس القديم. لا توجد في هذا السجل شهادة CI للرأس الجديد.
- السجل [QCR Q01–Q12](https://github.com/turkialeid2030/startak-real-estate/blob/main/docs/QCR_EXECUTION_BOARD_AR_2026-10-27.md) يتضمن 36 أصل دليل مستقلاً، و0 موافقات مستقلة مثبتة، ولا أسماء لمراجعين تم تعيينهم/التحقق منهم.
- لا يُرفع صك عميل أو كشف إيجارات أو مفاتيح/أسرار أو تقارير سرية إلى GitHub العام.

## تغييرات الكود المنفذة في هذه الدفعة

1. **ضبط حجم الاستجابة أثناء النقل، Q09:** `tools/verify-deployed-assets.mjs` لم يعد يستخدم `arrayBuffer()` غير محدود، ويقيّد manifest وHTML والأصول الموقعة وإجابة مسار 404؛ يرفض `Content-Length` المزوّد بحجم يتجاوز السقف ويمنع المسارات غير الداعمة للقراءة المتدفقة.
2. **اختبارات سلبية لتسليم CDN، Q09:** `tests/architecture/run_n11_manifest_failure_evidence_20261024.js` يختبر تدفقًا زائدًا وترويسة حجم غير موثوقة ويضمن عدم تدوين بيانات الجسم في أثر الفشل.
3. **معيار نجاح أدوات اعتماد الإطلاق، Q12:** `tools/production-go-live-runbook-strict.js` يعيد استخدام `shouldExitHold` من مسار الإنتاج الأساس لمنع الرجوع برمز خروج صفر في E2G/E2H/E2I ما لم تكن حالة الاستعداد للطلب وتطابق الأصل مثبتة.
4. **اختبارات سلبية للتوقيع، Q12:** `tests/runtime/run_production_derived_state_strict_wrapper_tests.js` يتحقق من حالات الانتظار وغياب بصمة الأصل والحواجز غير المستوفاة.
5. **التطابق الرقمي:** وحدة `src/validation/numeric-text.js` الحالية ترفض التقاط الفاصلة العربية باعتبارها إزالة حرف؛ تحقق مصدر فقط، وليس تعديلًا جديدًا في هذه الدفعة.

## مصفوفة جميع المسارات — أثر الهندسة مقابل قبول الدليل

| المسار | موضوع القبول | تحديث/دليل هندسي | الإغلاق الحقيقي المطلوب | الوضع |
|---|---|---|---|---|
| Q01 [#750](https://github.com/turkialeid2030/startak-real-estate/issues/750) | مصادر المعاملات وحقوق البيانات | نماذج استيراد بحثية تفصل المؤشرات عن الصفقات | اتفاق استخدام نافذ + صفقات منفذة موثقة + ربط مرخّص | OPEN / NOT_CONNECTED |
| Q02 [#751](https://github.com/turkialeid2030/startak-real-estate/issues/751) | دقة التقييم السوقية | Holdout اصطناعي وتنقية تكرار/تسرب | عينة سعودية قانونية محفوظة لم تُستخدم في التدريب + اعتماد مقيم مستقل | OPEN / NOT_VALIDATED |
| Q03 [#752](https://github.com/turkialeid2030/startak-real-estate/issues/752) | صحة التدفقات والمعادلات | اختبارات رياضية هندسية موثقة في PRs | مطابقة مستندات وعقود ودفاتر ومراجع مالي مستقل | OPEN / EXTERNAL_SIGNOFF |
| Q04 [#753](https://github.com/turkialeid2030/startak-real-estate/issues/753) | الأصول المتخصصة | حجب تقييم آلي غير ملائم لفندق/مول/لوجستيات/محطة | حالات تشغيل حقيقية وتقرير مختص لكل نوع | OPEN / SPECIALIST |
| Q05 [#754](https://github.com/turkialeid2030/startak-real-estate/issues/754) | هوية وسرية الأدلة | عقود تشفير/صلاحيّات على مستوى الاختبار فقط | IdP وKMS وقاعدة دائمة ونسخ واستعادة وفحص اختراق | OPEN / NOT_DEPLOYED |
| Q06 [#755](https://github.com/turkialeid2030/startak-real-estate/issues/755) | خصوصية/امتثال/تراخيص | قواعد منع ادعاء الاعتماد | رأي قانوني متخصص في PDPL ونطاق التراخيص وحقوق السوق | OPEN / LEGAL |
| Q07 [#756](https://github.com/turkialeid2030/startak-real-estate/issues/756) | الذكاء الاصطناعي | حدود ادعاءات وواجهة بحث محدودة | اختبارات حية 18 محورًا وتكاليف/زمن/هلوسة وتوقيع مستقل | OPEN / LIVE_BENCHMARK |
| Q08 [#757](https://github.com/turkialeid2030/startak-real-estate/issues/757) | تجربة المستخدم والتعافي | Browser/RTL regression لمسارات محددة | UAT مستقل وإتاحة ونسخ/استعادة وRTO/RPO | OPEN / UAT |
| Q09 [#758](https://github.com/turkialeid2030/startak-real-estate/issues/758) | تسليم Cloudflare | **إصلاح حد قراءة CDN + الاختبارات الجديدة** | CI على أحدث SHA + فحص الموقع الحقيقي/manifest + سبب جذري وتشخيص | PARTIAL / NO_PROD_SMOKE |
| Q10 [#759](https://github.com/turkialeid2030/startak-real-estate/issues/759) | تجربة السوق والاقتصاديات | مفهوم بحث شخصي دون تسعير مؤسسي معتمد | تجربة مستخدمين/قياس أثر/تكاليف موثقة | OPEN / REAL_MARKET |
| Q11 [#760](https://github.com/turkialeid2030/startak-real-estate/issues/760) | التقرير المهني | قواعد HOLD/الربط والتقارير البحثية غير المعتمدة | مراجعة مقيم مختص لكل نموذج وتقرير ومصدر | OPEN / LICENCED_REVIEW |
| Q12 [#761](https://github.com/turkialeid2030/startak-real-estate/issues/761) | قرار النشر | **منع رمز خروج نجاح زائف في أدوات E2G/E2H/E2I** | تعيين مفوضين حقيقيين وموافقة مكتوبة وسلسلة E2F/E2G ثم نشر وفحص | PARTIAL / NOT_AUTHORIZED |

**مهم:** «PARTIAL» تعني إتمام تعديل برمجي أو وثائقي محدّد، وليست نسبة إنجاز معتمدة للمسار ولا تسويغًا لإغلاق التذكرة.

## إجراءات إغلاق لا يمكن استبدالها بكود

1. الحصول على أصول أدلة المصادر والعقود والحقوق والتكاملات بأذونات حقيقية.
2. تكليف أشخاص محددين بالمراجعة المالية والمهنية والقانونية والأمنية، مع تحقق الاستقلال والاختصاص.
3. إجراء اختبارات الإنتاج الحقيقي والعينة السعودية غير المتسربة وقياس النتائج/الحدود/تاريخ الملاحظة.
4. إكمال الموافقات الموثوقة على Q01–Q12 ثم E2F/E2G ومن بعدها فقط دمج السلسلة `main ← #763 ← #764` بطريقة حاكمة.
5. إثبات النشر الفعلي عبر Manifest SHA وAsset hash وsmoke وRBAC ومراقبة التشغيل وخطة rollback.

## معيار الإغلاق

**لا تساوي:** تحديث issue، نجاح CI، بيانات اصطناعية، تعيين GitHub Assignee، أو تصريح صاحب المشروع موافقة طرف مستقل. تبقى بوابة GO مغلقة إلى أن يتوفر دليل صالح قابل للتدقيق ويجتاز جميع القيود المنطبقة.

روابط المرجع: [#622](https://github.com/turkialeid2030/startak-real-estate/issues/622)، [#747](https://github.com/turkialeid2030/startak-real-estate/issues/747)، [#765](https://github.com/turkialeid2030/startak-real-estate/issues/765).

## إضافة تشغيلية: تجهيز طلبات الأدلة الـ36

تمت إضافة أدوات إصدار قائمة طلبات الأدلة، دون ادعاء إرسالها أو اعتمادها:

```bash
node tools/qcr-evidence-acquisition.js --as-of=2026-10-28 --markdown
node tools/qcr-evidence-acquisition.js --as-of=2026-10-28 --json
node tests/architecture/run_qcr_evidence_acquisition.js
```

تُنشئ هذه الأدوات طلبًا منفصلًا لكل `evidenceType` من المسارات Q01–Q12، وتُظهر الدور الوظيفي المسؤول، وموعد المراجعة، ومعيار القبول، ورابط التذكرة. تبقى كل الطلبات `REQUEST_PREPARED_NOT_SENT`، ولا تسجل أي توقيع أو استلام أو اعتماد مستقل. لا تضع محتويات مستندات العملاء في GitHub العام.
