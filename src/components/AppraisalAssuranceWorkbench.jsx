import React, {useEffect,useMemo,useState} from 'react';
const {auditAppraisal,compareVersions}=require('../market/appraisal-assurance');

// The user must manually transcribe and check every value against the original page.
// This component neither uploads documents nor stores data persistently.
const fresh=()=>({
 reportId:'',valuationDate:'',property:{deedNumber:'',owner:'',rightType:'',areaSqm:''},
 reported:{capitalValueSar:'',marketRentSar:''},
 income:{annualGrossRevenueSar:'',vacancyLossSar:'',operatingExpensesSar:'',annualNoiSar:'',
   capitalizationRatePct:'',indicatedValueSar:'',rentUsesThisEstimate:false,leaseStructure:''},
 marketRent:{annualRentSar:'',capitalValueBasisSar:'',percentOfCapitalValue:'',derivation:'',
   usedAsIncomeApproachEvidence:false},
 pages:{income:'',rent:''}
});
const fields=[
 ['reportId','رقم تقرير التقييم','text'],
 ['valuationDate','تاريخ القيمة (ميلادي)','date'],
 ['property.deedNumber','رقم الصك (اختياري في هذه الدراسة)','text'],
 ['property.owner','اسم المالك (اختياري)','text'],
 ['property.areaSqm','مساحة العقار م²','text'],
 ['reported.capitalValueSar','القيمة الرأسمالية الواردة (ريال)','text'],
 ['reported.marketRentSar','الإيجار السنوي الوارد (ريال)','text'],
 ['income.annualGrossRevenueSar','الإيراد التشغيلي الإجمالي السنوي (ريال)','text'],
 ['income.vacancyLossSar','فاقد الشواغر السنوي (ريال)','text'],
 ['income.operatingExpensesSar','مصروفات المالك التشغيلية السنوية (ريال)','text'],
 ['income.annualNoiSar','صافي الدخل التشغيلي السنوي NOI (ريال)','text'],
 ['income.capitalizationRatePct','معدل الرسملة (%)','text'],
 ['income.indicatedValueSar','القيمة المعلنة بأسلوب الدخل (ريال)','text'],
 ['marketRent.annualRentSar','الإيجار السنوي المستخدم للتقدير (ريال)','text'],
 ['marketRent.capitalValueBasisSar','القيمة المستخدمة أساسًا لاشتقاق الإيجار (ريال)','text'],
 ['marketRent.percentOfCapitalValue','نسبة اشتقاق الإيجار من القيمة (%)','text'],
 ['pages.income','رقم صفحة حساب الدخل في الأصل','text'],
 ['pages.rent','رقم صفحة حساب الإيجار في الأصل','text'],
];
const descriptions=Object.freeze({
 INCOME_CAPITALIZATION_MISMATCH:'تعارض بين قيمة أسلوب الدخل وحاصل قسمة NOI على معدل الرسملة.',
 NOI_RECONCILIATION_MISMATCH:'صافي الدخل لا يساوي الإيراد الإجمالي ناقص الشواغر والمصروفات.',
 RENT_DERIVED_FROM_CAPITAL_NOT_MARKET_EVIDENCE:'الإيجار مشتق من القيمة، وليس شاهدًا سوقيًا مستقلًا.',
 CIRCULAR_VALUATION:'استُخدم إيجار مشتق من القيمة لإثبات القيمة ذاتها؛ استدلال دائري.',
 RENT_PERCENTAGE_ARITHMETIC_MISMATCH:'الإيجار لا يطابق القيمة × النسبة.',
 ZERO_OPERATING_COST_UNSUPPORTED:'مصروفات المالك صفر دون دليل لعقد يحمل المستأجر المصروفات.',
 INDEPENDENT_MARKET_EVIDENCE_NOT_VERIFIED:'لم يجر التحقق الخارجي من المقارنات السوقية.',
 VALUATION_DATE_MISSING:'تاريخ القيمة غير مدخل.',
 FILE_PROVENANCE_MISSING:'لا توجد بصمة مستند مصدر للتحقق من النسخة.',
 INVALID_NUMERIC_INPUT:'يوجد رقم غير صالح أو صفر غير مسموح به.',
 CAP_RATE_INVALID:'معدل الرسملة غير صالح.',
 OWNER_NAME_CHANGED:'تغير اسم المالك بين النسختين؛ يلزم مطابقة حقوق الملكية.',
 REPORT_IDENTITY_COLLISION:'رقم التقرير ذاته يرتبط بصكين مختلفين؛ لا يجوز دمج النسختين.',
 REPORT_ID_MISMATCH:'رقم التقرير مختلف؛ لا تجوز مقارنة عقارين على أنهما نسختان.',
 DEPENDENT_VALUE_UNCHANGED:'تغير افتراض مالي دون تغير القيمة النهائية؛ يلزم توثيق التسوية.',
});
const at=(obj,path)=>path.split('.').reduce((a,b)=>a?.[b],obj);
function update(obj,path,value){
 const chunks=path.split('.');const o={...obj};let x=o,y=obj;
 for(let i=0;i<chunks.length-1;i++){const key=chunks[i];x[key]={...(y?.[key]||{})};y=y?.[key];x=x[key];}
 x[chunks[chunks.length-1]]=value;return o;
}
const money = v => Number.isFinite(v)?new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2}).format(v)+' ر.س':'—';
function FieldSet({stage,setStage,prefix}){
 return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
  {fields.map(([path,label,type])=><label key={path} className="block text-xs text-slate-200">{label}
    <input type={type} data-testid={prefix+'-'+path.replace(/\./g,'-')} aria-label={label}
      inputMode={type==='text' && path.includes('Sar')?'decimal':undefined}
      dir={type==='date'?'ltr':'auto'} value={at(stage,path)??''}
      onChange={e=>setStage(s=>update(s,path,e.target.value))}
      className="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100" />
   </label>)}
  <label className="block text-xs text-slate-200">مصدر الإيجار
   <select aria-label="مصدر الإيجار" value={stage.marketRent.derivation}
    onChange={e=>setStage(s=>update(s,'marketRent.derivation',e.target.value))}
    className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 p-2 text-sm">
    <option value="">غير محدد / يلزم توثيق</option>
    <option value="INDEPENDENT_LEASES">عقود أو مقارنات مستقلة (إقرار دون تحقق)</option>
    <option value="CAPITAL_VALUE_PERCENTAGE">نسبة من القيمة الرأسمالية</option>
   </select>
  </label>
  <label className="flex items-center gap-2 self-center text-xs text-slate-200">
   <input type="checkbox" checked={stage.income.rentUsesThisEstimate===true}
    onChange={e=>setStage(s=>update(s,'income.rentUsesThisEstimate',e.target.checked))}/>
   استُخدم هذا الإيجار نفسه لحساب قيمة أسلوب الدخل
  </label>
  <label className="flex items-center gap-2 self-center text-xs text-slate-200">
   <input type="checkbox" checked={stage.income.leaseStructure==='EVIDENCED_TRIPLE_NET'}
    onChange={e=>setStage(s=>update(s,'income.leaseStructure',e.target.checked?'EVIDENCED_TRIPLE_NET':''))}/>
   يدّعي التقرير وجود عقد صافي ثلاثي موثّق (يلزم فحص العقد)
  </label>
 </div>;
}
function IssueRows({items}){
 return items.length?<ul className="mt-2 space-y-2">
  {items.map((x,i)=><li key={x.code+':'+i} className="rounded border border-slate-700 p-2 text-xs">
   <strong className={x.severity==='BLOCK'?'text-rose-200':'text-amber-200'}>{x.severity==='BLOCK'?'مانع':'للمراجعة'} · {x.code}</strong>
   <p className="mt-1 text-slate-200">{descriptions[x.code]||x.detail}</p>
   {x.pages?.length>0&&<p className="mt-1 text-slate-400">الصفحة المرجعية: {x.pages.join('، ')}</p>}
  </li>)}
 </ul>:<p className="text-xs text-slate-300">لم تظهر تعارضات في الحقول المدخلة. هذا لا يعني صحة التقرير أو اكتمال أدلته.</p>;
}
export default function AppraisalAssuranceWorkbench({intakeRecord=null}){
 const [open,setOpen]=useState(false);
 const [current,setCurrent]=useState(fresh);
 const [previous,setPrevious]=useState(fresh);
 const [compare,setCompare]=useState(false);
 // Reset on any uploaded source change, including clearing the source. No stale report fields cross files.
 const digest=intakeRecord?.digest||'';
 useEffect(()=>{setCurrent(fresh());setPrevious(fresh());setCompare(false);},[digest]);
 const reviewed=useMemo(()=>auditAppraisal({
  ...current,
  provenance:{reportFileHash:digest,comparableEvidenceIndependentlyVerified:false},
  pages:{income:Number(current.pages.income),rent:Number(current.pages.rent)},
 }),[current,digest]);
 const diff=useMemo(()=>compare?compareVersions(previous,current):null,[compare,previous,current]);
 return <section data-testid="appraisal-assurance-workbench" dir="rtl"
  className="mx-auto my-6 w-full max-w-7xl px-4 md:px-8">
  <div className="rounded-2xl border border-slate-700 bg-[#101a2d] p-4 text-slate-100 md:p-5">
   <button type="button" aria-expanded={open} aria-controls="appraisal-assurance-details"
    data-testid="appraisal-assurance-toggle" onClick={()=>setOpen(v=>!v)}
    className="flex w-full items-center justify-between gap-3 rounded p-2 text-right focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300">
    <span className="text-base font-bold text-amber-100">تدقيق تقرير التقييم العقاري — مراجعة يدوية آمنة</span>
    <span className="text-xs text-slate-300">{open?'إغلاق':'فتح'}</span>
   </button>
   {open&&<div id="appraisal-assurance-details" className="mt-3 space-y-4">
    <p className="text-xs leading-6 text-slate-300">أدخل القيم يدويًا بعد مطابقتها مع صفحات الملف الأصلي. لا تُستورد حقول OCR تلقائيًا، ولا تحفظ هذه اللوحة البيانات في الخادم أو الصفقات المحفوظة أو GitHub. نتائجها للتدقيق البحثي فقط وغير معتمدة مهنيًا.</p>
    <p className="rounded border border-slate-700 p-2 text-xs text-slate-300">بصمة ملف المستند المحلي: {digest?<span data-testid="appraisal-document-hash" className="break-all font-mono" dir="ltr">{digest}</span>:'لم يُرفق ملف أو لم يكتمل فحصه'}</p>
    <FieldSet stage={current} setStage={setCurrent} prefix="current"/>
    <div data-testid="appraisal-audit-status" data-status={reviewed.status} role="status"
      className={'rounded border p-3 '+(reviewed.status==='HOLD'?'border-rose-700 text-rose-100':'border-amber-700 text-amber-100')}>
     <strong>{reviewed.status==='HOLD'?'HOLD — توجد موانع حسابية أو منهجية':'REVIEW_REQUIRED — لم تثبت سلامة التقرير مهنيًا'}</strong>
     <p className="mt-1 text-xs">التصديق المهني: NOT_AUTHORIZED. إصدار تقرير تقييم رسمي غير متاح.</p>
    </div>
    <div className="grid gap-2 sm:grid-cols-2">
     <div className="rounded border border-slate-700 p-3 text-sm">القيمة التي تنتج عن NOI / معدل الرسملة
      <strong data-testid="appraisal-calculated-value" className="mt-1 block">{money(reviewed.metrics.capitalizedIncomeValueSar)}</strong>
     </div>
     <div className="rounded border border-slate-700 p-3 text-sm">فرق قيمة أسلوب الدخل
      <strong className="mt-1 block">{money(reviewed.metrics.incomeArithmeticDifferenceSar)}</strong>
     </div>
    </div>
    <section data-testid="appraisal-issues" aria-label="ملاحظات التدقيق">
     <h3 className="text-sm font-semibold">نتائج فحص المعادلات والمصادر</h3>
     <IssueRows items={reviewed.issues}/>
    </section>
    <div className="rounded-lg border border-slate-700 p-3">
     <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" data-testid="appraisal-version-compare" checked={compare} onChange={e=>setCompare(e.target.checked)}/>
      لدي نسخة أخرى من التقرير وأريد فحص الفروق
     </label>
     {compare&&<div className="mt-3 space-y-3">
      <h3 className="text-sm font-semibold">النسخة السابقة — إدخال يدوي</h3>
      <FieldSet stage={previous} setStage={setPrevious} prefix="previous"/>
      <section data-testid="appraisal-version-differences" aria-label="اختلافات النسخ">
       <h3 className="text-sm font-semibold">تسوية النسخ: {diff?.status}</h3>
       <IssueRows items={diff?.flags||[]}/>
       <ul className="mt-2 space-y-1 text-xs">
        {(diff?.changed||[]).map(r=><li key={r.path} className="break-all border-b border-slate-700 py-1">
         {r.path}: <span className="text-slate-400">{String(r.previous??'—')}</span> ← {String(r.current??'—')}
        </li>)}
       </ul>
       <p className="mt-2 text-xs text-amber-200">لا تختار STARTAK النسخة الأحدث تلقائيًا ولا تجمع قيم النسخ في المحفظة.</p>
      </section>
     </div>}
    </div>
    <div className="flex flex-wrap gap-2">
     <button type="button" onClick={()=>{setCurrent(fresh());setPrevious(fresh());setCompare(false);}}
       data-testid="appraisal-reset" className="rounded border border-slate-500 px-3 py-2 text-xs">مسح مدخلات التدقيق المحلية</button>
     <p className="self-center text-xs text-slate-400">لا يوجد زر اعتماد أو تصدير تقرير مهني.</p>
    </div>
   </div>}
  </div>
 </section>;
}
