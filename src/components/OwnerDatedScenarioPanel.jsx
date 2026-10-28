import React,{useState} from 'react';
const {reviewOwnerDatedScenario}=require('../valuation-intelligence/dated-scenario-review');
const emptyRow=()=>({date:'',amount:'',sourceReference:''});
const money=n=>typeof n==='number'&&Number.isFinite(n)?n.toLocaleString('ar-SA',{maximumFractionDigits:2}):'—';
export default function OwnerDatedScenarioPanel({locale='ar-SA'}){
 const en=locale==='en';
 const [rows,setRows]=useState([emptyRow(),emptyRow()]);
 const [discount,setDiscount]=useState('');
 const [rights,setRights]=useState(false);
 const [review,setReview]=useState(null);
 const patch=(i,key,value)=>{setRows(old=>old.map((r,j)=>i===j?{...r,[key]:value}:r));setReview(null)};
 const updateDiscount=value=>{setDiscount(value);setReview(null)};
 return <section data-testid="dated-scenario-review" dir={en?'ltr':'rtl'}
  className="mt-5 rounded-2xl border border-amber-700/60 bg-[#141F35] p-4 text-slate-100">
  <h2 className="text-sm font-bold text-amber-100">
   {en?'D05 — Optional dated return research (unverified)':'D05 — بحث اختياري في عوائد التدفقات المؤرخة (غير معتمد)'}
  </h2>
  <p className="my-3 text-xs text-slate-300">
   {en?'Enter actual dates, signed amounts (negative outflows; positive inflows) and your source reference for EACH cash flow. No dates, amounts, source rights, or validation are inferred. Results never replace the canonical annual IRR/NPV or the monthly construction-financing model. Do not treat the output as a valuation or purchase authority.':
    'أدخل التاريخ الفعلي والمبلغ الموقّع (السالب للمصروف والموجب للمقبوض) ومرجع المصدر لكل تدفق. لا تستنتج المنصة التواريخ أو المبالغ أو الحقوق أو التوثيق. النتيجة لا تستبدل IRR/NPV السنوي أو تمويل الإنشاء الشهري ولا تمثل تثمينًا أو تفويض شراء.'}
  </p>
  <label className="block text-xs mb-3">
   {en?'Annual discount rate as decimal: 0 to below 1 (0.10 = 10%; do not enter 10)':'معدل الخصم السنوي ككسر بين 0 وأقل من 1 (0.10 = 10%؛ لا تكتب 10)'}
   <input data-testid="dated-discount-rate" value={discount} onChange={e=>updateDiscount(e.target.value)}
    inputMode="decimal" className="mt-1 block w-full rounded border border-slate-600 bg-[#101c30] p-2" />
  </label>
  <div className="space-y-2">
   {rows.map((r,i)=><div key={i} className="grid grid-cols-1 gap-2 rounded border border-slate-700 p-2 sm:grid-cols-3">
    <label className="text-xs">{en?'Cash-flow date':'تاريخ التدفق'}
     <input data-testid={'dated-row-date-'+i} type="date" value={r.date}
      onChange={e=>patch(i,'date',e.target.value)}
      className="mt-1 w-full rounded border border-slate-600 bg-[#101c30] p-2" />
    </label>
    <label className="text-xs">{en?'Signed amount (SAR)':'المبلغ الموقّع بالريال'}
     <input data-testid={'dated-row-amount-'+i} value={r.amount} inputMode="decimal"
      onChange={e=>patch(i,'amount',e.target.value)}
      className="mt-1 w-full rounded border border-slate-600 bg-[#101c30] p-2"/>
    </label>
    <label className="text-xs">{en?'Document / source reference':'مرجع مستند أو مصدر التدفق'}
     <input data-testid={'dated-row-source-'+i} value={r.sourceReference}
      onChange={e=>patch(i,'sourceReference',e.target.value)}
      maxLength={240} className="mt-1 w-full rounded border border-slate-600 bg-[#101c30] p-2"/>
    </label>
   </div>)}
  </div>
  <div className="mt-3 flex flex-wrap gap-2">
   <button type="button" data-testid="dated-add-row" disabled={rows.length>=36}
    className="rounded border border-amber-600 px-3 py-2 text-xs disabled:opacity-50"
    onClick={()=>{setRows(old=>[...old,emptyRow()]);setReview(null)}}>
    {en?'Add dated cash flow':'إضافة تدفق مؤرخ'}
   </button>
   <button type="button" disabled={rows.length<=2} className="rounded border border-slate-600 px-3 py-2 text-xs disabled:opacity-50"
    onClick={()=>{setRows(old=>old.slice(0,-1));setReview(null)}}>
    {en?'Remove last row':'حذف آخر تدفق'}
   </button>
  </div>
  <label className="mt-3 flex items-center gap-2 text-xs">
   <input data-testid="dated-source-attestation" type="checkbox" checked={rights}
    onChange={e=>{setRights(e.target.checked);setReview(null)}} />
   {en?'I confirm that I am allowed to use these source documents and entered all applicable dated cash flows; this is a user attestation, not independent authentication.':
    'أقر بحقي في استخدام المستندات وبإدخال جميع التدفقات المؤرخة ذات الصلة؛ إقرار المستخدم لا يعني تحققًا مستقلاً.'}
  </label>
  <button type="button" data-testid="dated-calculate" onClick={()=>setReview(reviewOwnerDatedScenario({
    rows,annualDiscountRate:discount,rightsConfirmed:rights
   }))}
   className="mt-3 rounded bg-amber-700 px-4 py-2 text-xs font-semibold text-white">
   {en?'Calculate research scenario only':'احسب السيناريو البحثي فقط'}
  </button>
  {review&&<div data-testid="dated-review-result" role="status" className="mt-3 rounded border border-slate-600 p-3 text-xs">
   <p>{en?'Status':'الحالة'}: <code dir="ltr">{review.status}</code></p>
   {review.status==='UNVERIFIED_DATED_SCENARIO_CALCULATED'?<>
    <p>{en?'Unverified dated XIRR':'XIRR المؤرخ غير المتحقق'}: {(review.xirr*100).toFixed(4)}%</p>
    <p>{en?'Unverified dated XNPV (SAR)':'XNPV المؤرخ غير المتحقق (ريال)'}: {money(review.xnpvSar)}</p>
   </>:<p data-testid="dated-review-blockers" className="text-rose-200">{review.blockers.join(' / ')}</p>}
   <p className="mt-2 text-amber-200">
    {en?'No independent proof, no reconciliation to the annual model, no certified value and no transaction authority.':
     'لا تحقق مستقل ولا تسوية مع النموذج السنوي ولا قيمة عقارية معتمدة ولا صلاحية معاملة.'}
   </p>
  </div>}
 </section>;
}
