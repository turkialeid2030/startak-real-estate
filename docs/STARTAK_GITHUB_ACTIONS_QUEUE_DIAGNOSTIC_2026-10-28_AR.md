# STARTAK — تشخيص منع تأهيل إصدار PR #763

التاريخ: 28 أكتوبر 2026. المرجع: `feature/location-market-valuation-20261027`.

## الأدلة المرصودة
- أحدث الـPR لا يزال `Draft / Not merged / Mergeable`.
- بعد دفع آخر التغييرات أعادت GitHub إنشاء 12 فحصًا بوضع `queued` مع `conclusion=null`؛ منها `Location Market Study Verify` و`Comprehensive Verify` و`Release Verify` و`Deep Platform Verify`. لا توجد نتيجة تشغيل مكتملة على الرأس الحالي.
- مثال تشغيل موقع السوق: https://github.com/turkialeid2030/startak-real-estate/actions/workflows/location-market-study-verify.yml
- مثال تشغيل محدد سابق في وضع قائمة انتظار: https://github.com/turkialeid2030/startak-real-estate/actions/runs/40590351100
- فُحصت وظيفة `Location Market Study Verify`: تحتوي خطوة `tests` واحدة تعمل نظريًا على `ubuntu-latest`. مع ذلك لم تظهر قيمة `started_at` ولا `runner_name` في بيانات المهمة المعلقة. لم تصل المهمة إلى تنفيذ `npm ci`.
- صفحة https://www.githubstatus.com/ العامة عرضت خدمة Actions بوضع تشغيل طبيعي عند التحقق؛ هذا لا يثبت حالة الحساب أو المستودع أو توفر الرصيد.
- تعذّر حسم السبب من أدوات الاستعلام المتاحة. لا يوجد دليل قاطع حاليًا على أن المشكلة في المنصة أو إعدادات المشغّلات أو استخدام الدقائق أو سياسة المؤسسة.

## ما تم تصحيحه
- في `location-market-study-verify.yml` جرى تثبيت مرجعي `actions/checkout` و`actions/setup-node` إلى SHA المسموح والمتبع في سير عمل الإصدار، مع `persist-credentials: false`.
- أُضيفت اختبارات عزل ملحق الدراسة عن السجل المالي الرئيسي، واستبداله بموافقة صريحة، والتحقق من استعادة مدخلاته فقط. نجاح اختبارات JavaScript المحلية المنعزلة ليس إثباتًا لسلامة المتصفح أو `npm run build`.

## فحص إعدادات GitHub المطلوب عند استمرار Queued
1. افتح https://github.com/turkialeid2030/startak-real-estate/actions ثم اختر آخر تشغيل من كل Workflow، وتأكد من نص التعطيل أو انتظار المشغّل إن ظهر.
2. افتح https://github.com/turkialeid2030/startak-real-estate/settings/actions/general وتحقق من سماح المستودع بتشغيل GitHub-hosted runners وسياسات Actions بدون تعطيل أمان سلسلة التوريد.
3. إذا ظهرت مطالبة إدارية أو مالية، راجع GitHub Billing / Actions usage من إعدادات مالك المستودع — لا يُفترض وجود مطالبة إلا إذا أظهرها الموقع.
4. تحقق من وجود تشغيل للمشغّلات `ubuntu-latest` و`ubuntu-24.04` دون قيود في حساب المالك.
5. بعد حل سبب الانتظار: شغّل/أعد تشغيل فحوص نفس الرأس وحدد نتائج `npm ci`, `npm run build`, وPlaywright، ثم تحقق من ملفات الأدلة والمانيفست قبل قرار الدمج.
6. **لا يُستعاض عن الفحوص الحية بتعديل إعداداتها لتعطيلها أو نقلها إلى نجاح شكلي.**

## حالات الإغلاق
- `ENGINEERING_SOURCE_COMMITTED`: نعم، البحث والسجلات البرمجية موجودة في الفرع.
- `ARCHITECTURE_SYNTHETIC_TEST`: اجتاز مسار الملحق البحثي اختبارات مبدئية منعزلة.
- `GITHUB_CI_LATEST_HEAD`: غير مُثبت.
- `PLAYWRIGHT_REAL_BROWSER`: غير مُثبت.
- `CLOUDFLARE_PREVIEW_DEPLOYED_SHA`: غير مُثبت.
- `PROFESSIONAL_OR_COMMERCIAL_LAUNCH`: `HOLD / NOT_AUTHORIZED`.

لا يثبت هذا المستند عدم وجود أخطاء، ولا يرخص تجاوز المراجعات المهنية أو حقوق مصادر الصفقات.
