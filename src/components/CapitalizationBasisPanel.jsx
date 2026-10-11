import React from 'react';
const {useLocale}=require('../i18n/LocaleContext');
const {geometryReview}=require('../app/capitalization-basis');
export default function CapitalizationBasisPanel({mode,inputs,onChange}) {
  const {locale}=useLocale(),ar=locale==='ar-SA';
  const exception=geometryReview(mode,inputs)==='BASEMENT_FOOTPRINT_REQUIRES_RIGHTS_AND_PERMIT_REVIEW';
  return <section data-testid="capitalization-basis" className="mt-3 rounded-xl border border-amber-700 p-4 text-sm text-slate-200">
    <label className="block">{ar?'أساس الدخل لمعدل الرسملة الحالي':'Current capitalization-rate income basis'}
      <select data-testid="capitalization-basis-select" className="mt-2 w-full rounded border border-slate-600 bg-slate-950 p-2" value={inputs.marketCapNoiBasis||''} onChange={e=>onChange(e.target.value)}>
        <option value="" disabled>{ar?'غير موثق — الحساب السابق بعد الاحتياطي':'Undocumented — legacy calculation after reserve'}</option>
        <option value="AFTER_RESERVE">{ar?'صافي الدخل بعد احتياطي الإحلال':'NOI after replacement reserve'}</option>
        <option value="BEFORE_RESERVE">{ar?'صافي الدخل قبل احتياطي الإحلال':'NOI before replacement reserve'}</option>
      </select>
    </label>
    <p className="mt-2 leading-6">{ar?'يغيّر الاختيار مؤشر قيمة الرسملة الحالية فقط؛ لا يغيّر التدفقات أو الاسترداد أو رسملة التخارج، التي تستخدم الدخل بعد الاحتياطي. طابق الاختيار مع أساس مصدر المعدل وسجّل مرجعه. اختيار المستخدم ليس تحققًا مستقلاً أو اعتماد تقييم.':'Selection changes only the current capitalization indication, not cashflows, payback or exit capitalization, which uses income after reserve. Match the source rate convention and record its reference. User selection is not independent verification or appraisal approval.'}</p>
    {!inputs.marketCapNoiBasis&&<p role="status" className="mt-2 text-amber-200">{ar?'أساس المعدل غير موثق؛ مؤشر القيمة افتراضي ولا يصلح وحده لاعتماد التقييم.':'Rate basis is undocumented; the illustrative value cannot alone support appraisal approval.'}</p>}
    {exception&&<p role="status" data-testid="basement-area-warning" className="mt-2 text-amber-200">{ar?'مساحة القبو الواحد تتجاوز مساحة الأرض. يلزم التحقق من المساحات والحقوق والرخص وتوثيق الاستثناء؛ الحساب لا يثبت سلامة الوضع الهندسي.':'One basement footprint exceeds the plot area. Verify areas, rights and permits and document the exception; arithmetic does not establish engineering validity.'}</p>}
  </section>;
}
