import React from 'react';
const {useLocale}=require('../i18n/LocaleContext');
const {assuranceLabel,assuranceMoney}=require('../i18n/assurance-workflow-presentation');
const methodArabic=Object.freeze({
 MARKET_COMPARABLES:'منهج مقارنة الصفقات السوقية',
 MARKET_AND_INCOME:'الجمع بين دليلي المقارنة السوقية والدخل',
 INCOME_AND_MARKET:'منهج الدخل مدعومًا بمقارنات السوق',
 SEGMENTED_PROPERTY_SPECIFIC:'التقييم بحسب شرائح واستخدامات العقار',
 SPECIALIST_HOTEL_DCF:'التدفقات النقدية الفندقية المتخصصة',
 SPECIALIST_HEALTHCARE:'منهج متخصص للأصول الصحية',
 SPECIALIST_REAL_PROPERTY_AND_OPERATOR_SEPARATION:'فصل العقار عن نشاط المشغل المتخصص',
 SPECIALIST_INDUSTRIAL:'منهج متخصص للأصول الصناعية',
});
export default function ValuationQualityPanel({readiness,quality,studyAsOf}) {
 const {locale,dir}=useLocale();
 const L=value=>assuranceLabel(value,locale);
 const money=value=>assuranceMoney(value,locale,0);
 const passed=quality.items.filter(x=>x.status==='PRESENT_USER_DECLARED').length;
 return <section data-testid="valuation-quality-gates" dir={dir}
  className="mt-5 rounded-xl border border-amber-700/70 bg-[#15273D] p-4 text-slate-100">
  <h3 className="text-base font-bold text-amber-100">{L("بوابة جودة أدلة التقييم وتدقيق التقرير")}</h3>
  <p className="mt-2 text-xs leading-6 text-slate-300">
   {L("تصنيف أولي يعتمد على بيانات الدراسة وما أقر به المستخدم. لا يجري فحصًا مستقلًا لمصداقية المستندات أو صكوك الملكية، ولا يمنح نسبة دقة أو اعتمادًا مهنيًا. نتائج الموقع والبيع والإيجار تخضع لبوابة واحدة قبل عرض السعر.")}
  </p>
  <p className="mt-3 text-xs text-slate-300">
    {L("تاريخ مرجع المقارنات:")} <strong>{studyAsOf?.date||L('غير محدد')}</strong> —
    {studyAsOf?.origin==='USER_VALUATION_DATE'?L('تاريخ القيمة الذي حدده المستخدم'):
      L('تاريخ فتح الدراسة حسب ساعة الجهاز')}{L(". تعني قراءة البيانات عند الطلب أنها بيانات منشورة ومتاحة، ولا تعني أن كل صفقة منفذة في هذا اليوم.")}
  </p>
  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
   <div className="rounded-lg border border-slate-600 p-3">
    <p className="text-xs text-slate-300">{L("حالة إصدار قيمة حسابية أولية")}</p>
    <strong className="mt-1 block text-sm text-amber-100">
     {readiness.status==='PRELIMINARY_CALCULATION_UNVERIFIED'?L('مسموح للبحث الشخصي فقط'):L('موقوفة — الأدلة غير كافية أو متعارضة')}
    </strong>
   </div>
   <div className="rounded-lg border border-slate-600 p-3">
    <p className="text-xs text-slate-300">{L("القيمة الواحدة بعد بوابات الجودة")}</p>
    <strong className="mt-1 block text-lg">{money(readiness.preliminaryValueSar)}</strong>
   </div>
   <div className="rounded-lg border border-slate-600 p-3">
    <p className="text-xs text-slate-300">{L("الإيجار السوقي السنوي الجديد")}</p>
    <strong className="mt-1 block text-lg">{money(readiness.newAnnualMarketRentSar)}</strong>
    <p className="mt-1 text-xs text-slate-400">
     {readiness.rentSource==='SEGMENTED_EXECUTED_LEASE_COMPARABLES'?L('عقود مماثلة لكل فئة وحدات'):
       readiness.rentSource==='WHOLE_ASSET_EXECUTED_LEASE_COMPARABLES'?L('مقارنات إيجار عامة لنفس الفئة'):
       readiness.rentSource==='CONFLICT_REQUIRES_REVIEW'?L('تعارض التقدير العام مع إيجار فئات الوحدات'):L('لا توجد مقارنة إيجار مؤهلة')}
    </p>
   </div>
  </div>
  <p className="mt-3 text-xs text-slate-300">
   {L("منهجية الأصل:")} <strong>{L(methodArabic[readiness.methodPolicy?.primary])||L('تحتاج منهجية هذا العقار إلى مراجعة متخصصة')}</strong>{L(". عدد صفقات البيع المؤهلة:")} {readiness.evidenceCounts.salesQualifiedByExistingCalculator}{L("، وعدد عقود الإيجار العامة المؤهلة:")} {readiness.evidenceCounts.rentalsQualifiedByExistingCalculator}.
  </p>
  {Number.isFinite(readiness.methodGapPct)&&<p className="mt-2 text-xs text-slate-300">
    {L("فرق منهجي السوق والدخل:")} {readiness.methodGapPct.toFixed(1)}%.
  </p>}
  {Number.isFinite(readiness.rentGapPct)&&<p className="mt-2 text-xs text-slate-300">
    {L("فرق الإيجار العام عن الإيجار المصنف بحسب الوحدات:")} {readiness.rentGapPct.toFixed(1)}%.
  </p>}
  {readiness.issueDescriptions.length>0&&<div className="mt-3 rounded-lg border border-rose-800/60 p-3">
   <strong className="text-xs text-rose-200">{L("موانع إصدار نتيجة موحدة")}</strong>
   <ul className="mt-2 list-inside list-disc text-xs text-rose-100 space-y-1">
    {readiness.issueDescriptions.map((x,i)=><li key={i}>{L(x)}</li>)}
   </ul>
  </div>}
  {readiness.noticeDescriptions.length>0&&<details className="mt-3 border border-slate-700 rounded-lg p-3">
   <summary className="min-h-[36px] cursor-pointer text-xs text-amber-200">
    {L("التحفظات على الأدلة —")} {readiness.noticeDescriptions.length}
   </summary>
   <ul className="mt-2 list-inside list-disc text-xs text-slate-300 space-y-1">
    {readiness.noticeDescriptions.map((x,i)=><li key={i}>{L(x)}</li>)}
   </ul>
  </details>}
  <details className="mt-4 border border-slate-600 rounded-lg p-3" data-testid="appraisal-report-checklist">
   <summary className="min-h-[44px] cursor-pointer text-sm font-semibold text-amber-100">
    {L("فحص اكتمال تقرير التقييم —")} {passed} {L("من")} {quality.items.length} {L("عناصر مذكورة")}
   </summary>
   <p className="mt-2 text-xs text-slate-300">
    {L("اكتمال الحقول لا يثبت الصحة. لا تستطيع هذه النسخة إصدار تقرير تقييم عقاري مهني معتمد.")}
   </p>
   <div className="mt-2 space-y-2">
    {quality.items.map(row=><div key={row.id} className="flex flex-wrap justify-between gap-2 border-b border-slate-700 pb-2 text-xs">
     <div><strong>{L(row.label)}</strong><p className="mt-1 text-slate-400">{L(row.criterion)}</p></div>
     <span className={row.status==='PRESENT_USER_DECLARED'?'text-sky-200':
       row.status==='REQUIRES_EXTERNAL_REVIEW'?'text-amber-200':'text-rose-200'}>
       {row.status==='PRESENT_USER_DECLARED'?L('مذكور — غير متحقق'):
        row.status==='REQUIRES_EXTERNAL_REVIEW'?L('يتطلب مراجعة خارجية'):L('ناقص / غير مثبت')}
     </span>
    </div>)}
   </div>
   <p className="mt-3 text-xs text-amber-200">{L("لا يوجد اعتماد آلي ولا إتاحة لتصدير تقرير تثمين مهني. التصدير المتاح ملف دراسة شخصية فقط.")}</p>
  </details>
 </section>;
}