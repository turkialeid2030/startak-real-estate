import React,{useMemo,useState} from 'react';
const {useLocale}=require('../i18n/LocaleContext.js');
const {advancedMarketLabel,advancedMarketMoney}=require('../i18n/advanced-market-presentation');
const {number}=require('../market/instant-market-study');
const {detailedReplacementCost,reconcileValuationMethods}=
 require('../market/value-reconciliation-audit');
const FIELD='w-full rounded-lg border border-slate-600 bg-[#101c30] px-3 py-2 min-h-[40px] mt-1 text-sm text-slate-100';
const initial={
 landPricePerSqm:'',buildingCostPerSqm:'',professionalFeePct:'',utilityPct:'',
 managementPct:'',financingPct:'',contractorProfitPct:'',depreciationPct:'',
 netOperatingIncome:'',capRatePct:'',rentComparableUnitAnnual:'',
 rentPctOfValue:'',operatingExpensePct:'',
};
const reasons={
 MATERIAL_VALUATION_METHOD_GAP_20PCT:'فرق جوهري ≥20% بين منهجين ويستوجب تفسيرًا موثقًا',
 VALUATION_METHOD_GAP_10PCT:'فرق ≥10% بين نتائج المنهجيات',
 CAPITALIZED_INCOME_ARITHMETIC_MISMATCH:'عدم تطابق قيمة رسملة الدخل مع المعادلة',
 RENT_METHODOLOGY_GAP_REQUIRES_RECONCILIATION:'اختلاف ملحوظ بين إيجار المقارنات وإيجار نسبة القيمة',
 ZERO_OPEX_NEEDS_TRIPLE_NET_LEASE_EVIDENCE:'مصروفات تشغيل صفر: يلزم إثبات تحمل المستأجر جميع المصروفات',
 SOURCE_EVIDENCE_NOT_INDEPENDENTLY_VERIFIED:'المدخلات لم تتحقق منها جهة مستقلة',
 NLA_EXCEEDS_GFA:'المساحة التأجيرية أكبر من المساحة المبنية',
 LOW_NLA_EFFICIENCY_REQUIRES_SURVEY:'نسبة المساحة التأجيرية منخفضة، تحقق من مسح المساحات',
 HIGH_DEPRECIATION_REQUIRES_CONDITION_REPORT:'إهلاك مرتفع، راجع حالة العقار وتكاليف التأهيل',
 SOFT_COST_RATE_REQUIRES_EVIDENCE:'تكاليف إضافية مرتفعة، يلزم تدقيق مصدر الافتراضات',
};
function F({title,value,onChange}) {
 const {locale}=useLocale();const L=(value,code)=>advancedMarketLabel(value,locale,code);
 return <label className="block min-w-0 text-xs text-slate-300">{L(title)}
 <input aria-label={L(title)} className={FIELD} value={value} onChange={e=>onChange(e.target.value)} dir="auto"/>
 </label>;
}
export default function CrossMethodEvidencePanel({subject,report}){
 const {locale}=useLocale();const en=locale==='en';
 const L=(value,code)=>advancedMarketLabel(value,locale,code);
 const money=value=>advancedMarketMoney(value,locale);

 const [v,setV]=useState(initial);
 const set=(k,value)=>setV(p=>({...p,[k]:value}));
 const cost=useMemo(()=>detailedReplacementCost({
  landArea:subject.landArea,landPricePerSqm:v.landPricePerSqm,
  components:[{area:subject.builtArea,ratePerSqm:v.buildingCostPerSqm}],
  feeRatesPct:{
   professional:v.professionalFeePct||0,utilities:v.utilityPct||0,
   management:v.managementPct||0,financing:v.financingPct||0,
   contractor:v.contractorProfitPct||0,
  },
  depreciationPct:v.depreciationPct,finalRoundingStep:1000,
 }),[subject.landArea,subject.builtArea,v]);
 const evidence=useMemo(()=>reconcileValuationMethods({
  marketValueSar:report.saleIndicationSar,
  costValueSar:cost.valueSar,
  annualNoiSar:v.netOperatingIncome,capitalizationRatePct:v.capRatePct,
  marketRentPerSqmYear:v.rentComparableUnitAnnual,
  rentableArea:subject.rentableArea,fullBuildingArea:subject.builtArea,
  baseValueSar:cost.valueSar,annualRentPctOfValue:v.rentPctOfValue,
  operatingExpenseRatio:number(v.operatingExpensePct)===null?undefined:
   number(v.operatingExpensePct)/100,
 }),[report.saleIndicationSar,subject.rentableArea,subject.builtArea,cost.valueSar,v]);
 const details=[
  ['landPricePerSqm','سعر المتر للأرض وفق مقارنة موثقة (ريال/م²)'],
  ['buildingCostPerSqm','تكلفة إحلال متر المبنى (ريال/م²)'],
  ['professionalFeePct','أتعاب مهنية (%)'],['utilityPct','خدمات ومرافق (%)'],
  ['managementPct','تكاليف إدارة الإنشاء (%)'],['financingPct','تكاليف تمويل أثناء التطوير (%)'],
  ['contractorProfitPct','ربح المقاول (%)'],['depreciationPct','الإهلاك المادي والوظيفي الإجمالي (%)'],
 ];
 return <details dir={en?'ltr':'rtl'} data-testid="cross-method-reconciliation"
  className="mt-5 rounded-xl border border-slate-600 bg-[#182941] p-3 text-slate-100">
  <summary className="cursor-pointer min-h-[44px] text-sm font-bold text-amber-100">{L("تدقيق اختلاف المنهجيات والإيجار السوقي — تكلفة / سوق / دخل")}</summary>
  <p className="mt-3 text-xs text-slate-300 leading-6">{L("يجري هذا الفحص إعادة حساب السيناريوهات الثلاثة بصورة مستقلة، ويكشف الفروق الجوهرية بين القيمة بأسلوب السوق وتكلفة الإحلال والدخل. الإيجار المستمد من مقارنات مستقلة يُفصل عن «نسبة من قيمة العقار»؛ ولا يُعتمد متوسط آلي بين المنهجيات.")}</p>
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
   {details.map(([k,title])=><F key={k} title={title} value={v[k]} onChange={x=>set(k,x)}/>)}
  </div>
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
   <F title="صافي الدخل التشغيلي السنوي (NOI) بالريال" value={v.netOperatingIncome} onChange={x=>set('netOperatingIncome',x)}/>
   <F title="معدل الرسملة (%)" value={v.capRatePct} onChange={x=>set('capRatePct',x)}/>
   <F title="مصروفات التشغيل نسبة من الإيراد (%)" value={v.operatingExpensePct} onChange={x=>set('operatingExpensePct',x)}/>
   <F title="إيجار المقارنات السنوي (ريال/م² تأجيري)" value={v.rentComparableUnitAnnual} onChange={x=>set('rentComparableUnitAnnual',x)}/>
   <F title="إيجار افتراضي كنسبة من قيمة التكلفة (%) — سيناريو منفصل" value={v.rentPctOfValue} onChange={x=>set('rentPctOfValue',x)}/>
  </div>
  <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
   <div className="rounded-lg border border-slate-600 p-3"><p className="text-slate-300">{L("السوق — مقارنات البيع")}</p>
    <strong className="block text-base mt-1">{money(evidence.methodsSar.market)}</strong></div>
   <div className="rounded-lg border border-slate-600 p-3"><p className="text-slate-300">{L("التكلفة — بعد الإهلاك")}</p>
    <strong className="block text-base mt-1">{money(evidence.methodsSar.cost)}</strong></div>
   <div className="rounded-lg border border-slate-600 p-3"><p className="text-slate-300">{L("الدخل — NOI ÷ معدل الرسملة")}</p>
    <strong className="block text-base mt-1">{money(evidence.methodsSar.income)}</strong></div>
  </div>
  <div className="mt-3 rounded-lg border border-slate-600 p-3 text-xs leading-7">
   <p>{L("إيجار مقارنات السوق:")} <strong>{money(evidence.metrics.comparableMarketAnnualRentSar)}</strong></p>
   <p>{L("الإيجار المحسوب كنسبة من قيمة التكلفة:")} <strong>{money(evidence.metrics.valuePercentageAnnualRentSar)}</strong></p>
   <p>{L("فارق الإيجارين:")} <strong>{money(evidence.metrics.annualRentGapSar)}</strong>{L("— ليس مبررًا لتغيير الإيجار تلقائيًا.")}</p>
   <p>{L("نسبة المساحة التأجيرية إلى المبنية:")} {Number.isFinite(evidence.metrics.rentableEfficiencyPct)?
     evidence.metrics.rentableEfficiencyPct+'%':L('غير متاحة')}.</p>
   <p>{L("إجمالي تكلفة الإنشاء قبل الإهلاك:")} {money(cost.grossBuildingBeforeDepreciationSar)}.
    {L('صافي المباني بعد الإهلاك:')} {money(cost.netBuildingValueSar)}.</p>
   {evidence.differences.length>0&&<div className="mt-2 space-y-1">
    {evidence.differences.map((x,i)=><p key={i}>{L("فرق")} {en?({market:'Market',cost:'Cost',income:'Income'}[x.first]||x.first):({market:'السوق',cost:'التكلفة',income:'الدخل'}[x.first]||x.first)} {L('و')} {en?({market:'Market',cost:'Cost',income:'Income'}[x.second]||x.second):({market:'السوق',cost:'التكلفة',income:'الدخل'}[x.second]||x.second)}:
     {money(x.absoluteGapSar)} ({x.gapPctOfHigher}% {L('من الأكبر')})</p>)}
   </div>}
   <p className="mt-2 font-semibold text-amber-200">{L("بوابة التدقيق:")} {evidence.status==='RECONCILIATION_HOLD'?L('وقف التسوية الآلية بسبب فرق جوهري'):
    evidence.status==='INSUFFICIENT_METHODS'?L('أدخل منهجين مكتملين على الأقل'):L('للمراجعة البشرية فقط')}.
   </p>
   {evidence.issues.filter(k=>k!=='SOURCE_EVIDENCE_NOT_INDEPENDENTLY_VERIFIED').length>0&&
    <p className="text-rose-200 mt-1">{L("ملاحظات:")} {evidence.issues.filter(k=>k!=='SOURCE_EVIDENCE_NOT_INDEPENDENTLY_VERIFIED')
     .map(k=>L(reasons[k]||k)).join('؛ ')}.</p>}
   <p className="text-slate-400 mt-2">{L("لا تنشئ هذه الورقة تقرير تثمين معتمدًا أو قيمة سوقية نهائية. اعتمد مستندات المساحات والإشغال ومصروفات التشغيل والحقوق العقارية قبل القرار.")}</p>
  </div>
 </details>;
}
