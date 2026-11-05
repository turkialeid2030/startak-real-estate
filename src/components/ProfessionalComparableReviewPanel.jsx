import React,{useMemo,useState} from 'react';
const {number}=require('../market/instant-market-study');
const {ADJUSTMENT_KEYS,compareAdjustments,costReplacementScenario}=
  require('../market/professional-comparable-review');

const INPUT='w-full rounded-lg border border-slate-600 bg-[#101c30] px-3 py-2 min-h-[40px] text-sm text-slate-100 mt-1';
const short={financingPct:'التمويل',marketConditionsPct:'ظروف السوق',transactionTypePct:'نوع العملية',
  areaPct:'فرق المساحة',accessPct:'الوصول',frontagePct:'الواجهات',roadWidthPct:'عرض الشارع',
  topographyPct:'طبوغرافية الأرض',usePct:'الاستخدام',buildabilityPct:'نظام البناء',otherPct:'أخرى'};
const blank=i=>({id:'P'+(i+1),date:'',sourceUrl:'',transactionStatus:'EXECUTED',
  pricePerSqm:'',comparableArea:'',weightPct:i===0?'40':i===1?'35':'25',
  financingPct:'0',marketConditionsPct:'0',transactionTypePct:'0',
  areaPct:'0',accessPct:'0',frontagePct:'0',roadWidthPct:'0',
  topographyPct:'0',usePct:'0',buildabilityPct:'0',otherPct:'0'});
const fmt=new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2});
const money=value=>Number.isFinite(value)?fmt.format(value)+' ر.س':'لا تتوفر نتيجة';
function Input({title,value,onChange,type='text',placeholder=''}) {
 return <label className="text-xs text-slate-300 block min-w-0">{title}
  <input className={INPUT} value={value} onChange={e=>onChange(e.target.value)}
    type={type} placeholder={placeholder} dir={type==='date'?'ltr':'auto'}/>
 </label>;
}
function Select({title,value,onChange,options}) {
 return <label className="text-xs text-slate-300 block min-w-0">{title}
  <select className={INPUT} value={value} onChange={e=>onChange(e.target.value)}>
   {options.map(([k,v])=><option key={k} value={k}>{v}</option>)}
  </select>
 </label>;
}
const showComparableIssue=code=>labels[code]||
 (String(code).startsWith('ROW_INVALID_')?
 'مقارنة غير مكتملة: راجع الرابط والتاريخ والسعر والمساحة':
 'ملاحظة فنية على المقارنة تتطلب مراجعة بشرية');
const labels={
 SUBJECT_AREA_INVALID:'المساحة غير صالحة',COMPARABLE_COUNT_3_TO_20:'يلزم 3 إلى 20 مقارنة',
 WEIGHTS_MUST_SUM_TO_100:'مجموع الأوزان يجب أن يساوي 100%',
 INSUFFICIENT_EXECUTED_COMPARABLES:'أقل من ثلاث صفقات بيع منفذة',
 OFFERS_NOT_EXECUTED:'بعض البيانات عروض وليست صفقات منفذة',
 OFFERS_REQUIRE_NEGOTIATION_AND_SOURCE_REVIEW:'العروض تتطلب توثيقًا وتسوية بشرية',
 COMPARABLE_AREA_NOT_VERIFIED:'مساحة المقارنة غير موثقة',
 EXTREME_AREA_RATIO_REQUIRES_EXPERT_REVIEW:'فارق كبير جدًا بين مساحة الأصل ومساحة المقارنة؛ يلزم مراجعة متخصص',
 COMPARABLE_OLDER_THAN_365_DAYS:'بعض المقارنات أقدم من عام',
};
export default function ProfessionalComparableReviewPanel({subject,sales=[]}){
 const [basis,setBasis]=useState('LAND_SQM');
 const [rows,setRows]=useState([blank(0),blank(1),blank(2)]);
 const [costInputs,setCostInputs]=useState({
  landPricePerSqm:'',replacementCostSarPerBuiltSqm:'',physicalDepreciationPct:'',
  functionalObsolescencePct:'',economicObsolescencePct:'',
 });
 const [note,setNote]=useState('');
 const area=basis==='LAND_SQM'?subject.landArea:
  basis==='BUILT_SQM'?subject.builtArea:subject.rentableArea;
 const readyRows=rows.map(row=>({...row,basis}));
 const result=useMemo(()=>compareAdjustments({
  subjectArea:area,basis,comparables:readyRows,
 }),[area,basis,rows]);
 const cost=useMemo(()=>costReplacementScenario({
  landArea:subject.landArea,
  landMarketSarPerSqm:costInputs.landPricePerSqm,
  grossBuiltArea:subject.builtArea,
  replacementCostSarPerBuiltSqm:costInputs.replacementCostSarPerBuiltSqm,
  physicalDepreciationPct:costInputs.physicalDepreciationPct,
  functionalObsolescencePct:costInputs.functionalObsolescencePct,
  economicObsolescencePct:costInputs.economicObsolescencePct,
 }),[subject.landArea,subject.builtArea,costInputs]);
 const update=(i,k,v)=>setRows(prev=>prev.map((row,j)=>j===i?{...row,[k]:v}:row));
 const fromSales=()=>{
  const eligible=sales.filter(x=>number(x.price)>0&&number(
    basis==='LAND_SQM'?x.landArea:basis==='BUILT_SQM'?x.builtArea:x.rentableArea)>0);
  if(eligible.length<3){setNote('لا توجد ثلاث مقارنات بيع صالحة ذات مساحة مطابقة في المدخلات الحالية.');return;}
  const take=eligible.slice(0,Math.min(eligible.length,10));
  const weights=take.map((_,i)=>Math.round(100/take.length*100)/100);
  weights[weights.length-1]=Math.round((100-weights.slice(0,-1).reduce((a,b)=>a+b,0))*100)/100;
  setRows(take.map((x,i)=>({
   ...blank(i),id:'S'+(i+1),pricePerSqm:String(number(x.price)/number(
    basis==='LAND_SQM'?x.landArea:basis==='BUILT_SQM'?x.builtArea:x.rentableArea)),
   comparableArea:String(number(basis==='LAND_SQM'?x.landArea:basis==='BUILT_SQM'?x.builtArea:x.rentableArea)),
   weightPct:String(weights[i]),date:x.date||'',sourceUrl:x.sourceUrl||'',
   transactionStatus:x.status==='EXECUTED'?'EXECUTED':'OFFER',
  })));
  setNote('نُقلت الأسعار والمراجع من المقارنات المدخلة؛ نسب التسوية بقيت صفرًا وتتطلب مستندات وحكمًا مهنيًا.');
 };
 return <details dir="rtl" data-testid="professional-comparables" className="mt-5 rounded-xl border border-slate-600 bg-[#192841] p-3 md:p-4 text-slate-100">
 <summary className="cursor-pointer min-h-[44px] flex items-center font-bold text-amber-100 text-sm">
  مراجعة المقارنات المهنية — جدول التسويات والأوزان وتكلفة الإحلال
 </summary>
 <p className="text-xs text-slate-300 leading-6 mt-3">منهج مرحلي لمقارنة أصول متشابهة: سعر المتر ← ظروف التمويل والسوق ونوع العملية ← فروقات المساحة والوصول والواجهة والشارع والاستعمال ← وزن كل مقارنة. لا تُستنتج نسب التسوية آليًا من المرفقات ولا يُصدر تثمين معتمد.</p>
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
  <Select title="أساس المقارنة (مطابق لكل المقارنات)" value={basis} onChange={setBasis}
   options={[['LAND_SQM','سعر متر الأرض'],['BUILT_SQM','سعر متر البناء الإجمالي'],['RENTABLE_SQM','سعر متر المساحة التأجيرية']]}/>
  <div className="text-xs text-slate-300 p-3 rounded-lg border border-slate-700">
   مساحة الأصل بحسب الأساس: <strong className="block">{area||'غير مدخلة'} م²</strong>
  </div>
  <button type="button" aria-label="إحضار مقارنات البيع المدخلة للمراجعة" className="rounded-lg min-h-[44px] border border-amber-600 text-xs text-amber-100 px-3 py-2"
   onClick={fromSales}>إحضار مقارنات البيع المدخلة للمراجعة</button>
 </div>
 <p className="text-xs text-slate-300 mt-2" role="status">{note}</p>
 <div className="space-y-3 mt-4">
  {rows.map((row,i)=><div key={row.id} className="rounded-lg border border-slate-700 p-3">
    <div className="flex justify-between items-center gap-2">
      <strong className="text-sm text-amber-100">المقارن {i+1}</strong>
      {rows.length>3&&<button type="button" className="text-xs text-rose-300 min-h-[36px] px-3"
        onClick={()=>setRows(old=>old.filter((_,j)=>j!==i))}>حذف</button>}
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mt-2">
      <Input title="سعر المتر قبل التسوية (ر.س)" value={row.pricePerSqm} onChange={v=>update(i,'pricePerSqm',v)}/>
      <Input title="مساحة المقارنة الفعلية (م²)" value={row.comparableArea} onChange={v=>update(i,'comparableArea',v)}/>
      <Input title="الوزن النسبي (%)" value={row.weightPct} onChange={v=>update(i,'weightPct',v)}/>
      <Input title="تاريخ المقارنة" type="date" value={row.date} onChange={v=>update(i,'date',v)}/>
      <Select title="نوع الدليل" value={row.transactionStatus} onChange={v=>update(i,'transactionStatus',v)}
        options={[['EXECUTED','صفقة بيع منفذة'],['OFFER','عرض غير منفذ — سيناريو فقط']]}/>
      <div className="sm:col-span-2 lg:col-span-4">
        <Input title="رابط دليل الصفقة أو العرض" value={row.sourceUrl} onChange={v=>update(i,'sourceUrl',v)}
          placeholder="https://..."/>
      </div>
      {ADJUSTMENT_KEYS.map(k=><Input key={k} title={short[k]+' (%)'} value={row[k]}
        onChange={v=>update(i,k,v)}/>)}
    </div>
    <p className="mt-2 text-xs text-slate-300">السعر بعد التسويات: <strong>{money(result.analysed[i]?.adjustedPricePerSqm)}</strong> /م².
    {result.analysed[i]?.problems?.length>0?' يلزم استكمال البيانات والتحقق من أساس المساحة وتاريخ المصدر.':''}</p>
  </div>)}
 </div>
 <button type="button" aria-label="إضافة مقارنة جديدة للمراجعة" className="mt-3 min-h-[40px] rounded-lg border border-slate-600 px-3 py-2 text-xs"
  onClick={()=>setRows(old=>old.length<20?[...old,blank(old.length)]:old)}>+ إضافة مقارنة</button>
 <div className="mt-4 rounded-lg bg-[#102035] p-4" role="status">
  <p className="text-xs text-slate-300">نتيجة مراجعة المقارنات</p>
  <strong className="block mt-2 text-xl text-amber-100">{money(result.scenarioValueSar)}</strong>
  <p className="text-xs text-slate-300 mt-2">سعر المتر المرجّح بعد التقريب إلى هللتين: {money(result.weightedPricePerSqm)} /م²</p>
  <p className="mt-2 text-xs text-amber-200">حالة الدليل: {result.status==='INVALID'?'المدخلات غير مكتملة':
   result.status==='ILLUSTRATIVE_HUMAN_REVIEW_REQUIRED'?'عرض حسابي يتطلب مراجعة بشرية':'حساب أولي غير معتمد'}.
  الصفقات المنفذة: {result.executedComparableCount} | العروض: {result.offerComparableCount}.</p>
  {!!result.errors.length&&<p className="text-xs text-rose-200 mt-2">أخطاء: {result.errors.map(x=>showComparableIssue(x)).join('؛ ')}</p>}
  {!!result.warnings.length&&<p className="text-xs text-amber-200 mt-2">ملاحظات: {result.warnings.map(x=>showComparableIssue(x)).join('؛ ')}</p>}
  <p className="text-xs text-slate-400 mt-3">هذه نتيجة لجدول مستقل للمراجعة والتعلم؛ لا تحل محل القيمة الأساسية أو تقرير المقيم المعتمد. لا يتم نسخ نتائج ملفات خاصة إلى المستودع العام.</p>
 </div>
 {subject.assetType!=='LAND'&&<details className="mt-4 border border-slate-700 rounded-lg p-3">
  <summary className="cursor-pointer min-h-[40px] text-sm text-amber-100">فحص مستقل لأسلوب التكلفة — الأرض + تكلفة الإحلال − الإهلاك</summary>
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
   {Object.entries({landPricePerSqm:'قيمة متر الأرض في السوق (ر.س)',replacementCostSarPerBuiltSqm:'تكلفة إحلال المتر المبني (ر.س)',
    physicalDepreciationPct:'الإهلاك المادي %',functionalObsolescencePct:'التقادم الوظيفي %',
    economicObsolescencePct:'التقادم الاقتصادي %'}).map(([k,title])=><Input key={k} title={title} value={costInputs[k]}
       onChange={v=>setCostInputs(old=>({...old,[k]:v}))}/>)}
  </div>
  <p className="mt-2 text-xs text-slate-300">مؤشر التكلفة الحسابي: <strong>{money(cost.valueSar)}</strong>.
   تفصل هذه النتيجة الأرض عن تكاليف الإنشاء والإهلاك، ولا تعتبر نتيجة سوقية دون أدلة تكاليف وإهلاك.</p>
 </details>}
 </details>;
}
