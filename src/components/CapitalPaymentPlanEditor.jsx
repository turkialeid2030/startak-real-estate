import React from 'react';
import {replaceCapitalPaymentPlan} from '../residential-income-acquisition/capital-payment-plan';
const inputClass='w-full min-w-0 rounded border border-slate-600 bg-slate-950 p-2 text-xs';
export default function CapitalPaymentPlanEditor({operatingCase,onReplaceOperatingCase,dir}){
  const ar=dir==='rtl',t=(a,b)=>ar?a:b;
  const signature=JSON.stringify([operatingCase.capitalPaymentPlan||null,operatingCase.capexItems]);
  const initial=()=>({entries:(operatingCase.capitalPaymentPlan?.entries||[]).map(e=>({...e,amount:String(e.amountMinor/100)})),sourceRef:'',reviewRef:'',confirmed:false,signature});
  const [draft,setDraft]=React.useState(initial),[feedback,setFeedback]=React.useState(null),[saving,setSaving]=React.useState(false),busy=React.useRef(false);
  const change=patch=>{setDraft(current=>({...current,...patch,confirmed:false}));setFeedback(null);};
  const edit=(index,patch)=>change({entries:draft.entries.map((e,i)=>i===index?{...e,...patch}:e)});
  const errors={CAPITAL_PLAN_COST_MISMATCH:t('مجموع الدفعات لا يطابق التكلفة المقدرة لكل بند.','Payments must equal each item’s estimated cost.'),CAPITAL_PLAN_COST_UNQUALIFIED:t('استكمل تكلفة البند ووحدتها ومصدرها ومراجعتها أولًا.','Complete the item cost, currency, source and adoption first.'),CAPITAL_PLAN_PAST_DATE:t('يوجد دفع مخطط قبل تاريخ الحالة؛ راجع الخطة ولا تعتبره مدفوعًا تلقائيًا.','A planned payment predates the case; review it instead of assuming payment.'),CAPITAL_PLAN_DUPLICATE_DATE:t('لا تكرر تاريخًا للبند نفسه؛ اجمع المبلغ في سطر واحد.','Combine duplicate dates for the same item into one row.'),CAPITAL_PLAN_STALE:t('تغيرت البنود أو الخطة؛ أعد تحميل المسودة.','Items or plan changed; reload the draft.'),EXPLICIT_VERIFICATION_CONFIRMATION_REQUIRED:t('أكّد مراجعة الخطة بعد آخر تعديل.','Confirm review after the last edit.')};
  const submit=async e=>{
    e.preventDefault();if(busy.current)return;busy.current=true;setSaving(true);
    try{
      if(draft.signature!==signature)throw new Error('CAPITAL_PLAN_STALE');
      const candidate=replaceCapitalPaymentPlan(operatingCase,draft);
      if(typeof onReplaceOperatingCase!=='function')throw new Error('OPERATING_CASE_UPDATE_HANDLER_REQUIRED');
      const response=await onReplaceOperatingCase(candidate,'CAPITAL_PLAN_UPDATED');
      if(response?.ok!==true)throw new Error(response?.code||'OPERATING_CASE_UPDATE_REJECTED');
      setDraft(current=>({...current,confirmed:false,sourceRef:'',reviewRef:'',signature:JSON.stringify([candidate.capitalPaymentPlan,candidate.capexItems])}));setFeedback({ok:true});
    }catch(error){setFeedback({ok:false,code:String(error.message||error).slice(0,160)});}
    finally{busy.current=false;setSaving(false);}
  };
  return <form onSubmit={submit} data-testid="capital-plan-editor" className="rounded-xl border border-slate-700 p-4"><fieldset disabled={saving} className="min-w-0">
    <legend className="text-sm font-semibold">{t('توقيت النفقات الرأسمالية المخططة','Planned capital payment dates')}</legend>
    <p className="my-2 text-xs leading-6 text-slate-300">{t('وزّع تكلفة كل بند رأسمالي مدرج على تواريخ دفع صريحة. يجب أن يساوي مجموع الدفعات تكلفة البند. تاريخ الحاجة للصيانة لا يُعامل كتاريخ دفع. الصافي بعد الخطة تحليلي وليس رصيدًا نقديًا.','Distribute each listed capital item’s cost across explicit payment dates. Payments must equal the item cost. A maintenance deadline is not a payment date. Net after this plan is analytical, not a cash balance.')}</p>
    <p className="mb-2 text-xs leading-6 text-amber-200">{t('المراجعة محلية ولا تثبت اكتمال حصر الأعمال أو اعتماد الصرف. حفظ خطة فارغة يعني صفرًا للبنود المدرجة فقط، ويُرفض إذا بقيت تكلفة غير موزعة أو مجهولة. الدفعات خارج أفق الإسقاط تُفصح منفصلة.','Local review does not establish completeness or spending authorization. An empty plan declares zero only for the listed inventory; unallocated or unknown cost blocks it. Payments outside the projection horizon are disclosed separately.')}</p>
    {draft.entries.map((entry,index)=><div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 mb-2" key={index}>
      <label className="text-xs">{t('البند','Item')}<select data-testid={`capital-item-${index}`} className={inputClass} required value={entry.capexItemId} onChange={e=>edit(index,{capexItemId:e.target.value})}><option value="">—</option>{operatingCase.capexItems.map(item=><option data-user-content translate="no" key={item.capexItemId} value={item.capexItemId}>{item.capexItemId} · {item.estimatedCost.value??'—'} SAR</option>)}</select></label>
      <label className="text-xs">{t('تاريخ الدفع المخطط','Planned payment date')}<input data-testid={`capital-date-${index}`} className={inputClass} type="date" required value={entry.date} onChange={e=>edit(index,{date:e.target.value})}/></label>
      <label className="text-xs">{t('المبلغ بالريال','Amount in SAR')}<input data-testid={`capital-amount-${index}`} className={inputClass} type="number" min="0.01" step="0.01" required value={entry.amount} onChange={e=>edit(index,{amount:e.target.value})}/></label>
      <button type="button" className="rounded border border-slate-600 p-2 text-xs" onClick={()=>change({entries:draft.entries.filter((_,i)=>i!==index)})}>{t('حذف السطر','Remove row')}</button>
    </div>)}
    <button data-testid="capital-add" type="button" disabled={!operatingCase.capexItems.length||draft.entries.length>=2000} className="rounded border border-slate-600 p-2 text-xs mb-3" onClick={()=>change({entries:[...draft.entries,{capexItemId:'',date:'',amount:''}]})}>{t('إضافة دفعة مخططة','Add planned payment')}</button>
    <div className="grid gap-3 md:grid-cols-2"><label className="text-xs">{t('مرجع الخطة','Plan reference')}<input data-testid="capital-source" className={inputClass} required value={draft.sourceRef} onChange={e=>change({sourceRef:e.target.value})}/></label><label className="text-xs">{t('مرجع المراجعة المحلية','Local review reference')}<input data-testid="capital-review" className={inputClass} required value={draft.reviewRef} onChange={e=>change({reviewRef:e.target.value})}/></label></div>
    <label className="flex items-start gap-2 my-3 text-xs"><input data-testid="capital-confirm" type="checkbox" checked={draft.confirmed} onChange={e=>setDraft({...draft,confirmed:e.target.checked})}/>{t('راجعت البنود والتكلفة وتواريخ الدفع وحدود الخطة.','I reviewed the items, costs, payment dates and plan boundaries.')}</label>
    <div className="flex flex-wrap gap-2"><button data-testid="capital-save" type="submit" className="rounded border border-amber-700 p-2 text-xs">{t('حفظ خطة الدفع','Save payment plan')}</button><button type="button" className="rounded border border-slate-600 p-2 text-xs" onClick={()=>{setDraft(initial());setFeedback(null);}}>{t('إعادة تحميل المسودة','Reload draft')}</button></div>
  </fieldset>{feedback&&<p data-testid="capital-feedback" data-diagnostic-content translate="no" role="status" className="mt-2 text-xs">{feedback.ok?t('تم حفظ خطة الدفع.','Payment plan saved.'):<>{errors[feedback.code]||t('تعذر الحفظ؛ راجع المبالغ والتواريخ والمراجع.','Save failed; check amounts, dates and references.')} <code dir="ltr">{feedback.code}</code></>}</p>}</form>;
}
