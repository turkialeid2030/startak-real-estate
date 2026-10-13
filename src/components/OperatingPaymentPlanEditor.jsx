import React from 'react';
import {replaceOperatingPaymentPlan} from '../residential-income-acquisition/operating-payment-plan';
const inputClass='w-full min-w-0 rounded border border-slate-600 bg-slate-950 p-2 text-xs';
export default function OperatingPaymentPlanEditor({operatingCase,onReplaceOperatingCase,dir}){
  const ar=dir==='rtl',t=(a,b)=>ar?a:b;
  const budgetItems=operatingCase.operatingExpenses.filter(x=>x.basis==='BUDGET'&&x.annualAmount.unit==='SAR/year');
  const signature=JSON.stringify([operatingCase.operatingPaymentPlan||null,operatingCase.operatingExpenses]);
  const initial=()=>({entries:(operatingCase.operatingPaymentPlan?.entries||[]).map(e=>({...e,amount:String(e.amountMinor/100)})),sourceRef:'',reviewRef:'',confirmed:false,signature});
  const [draft,setDraft]=React.useState(initial),[feedback,setFeedback]=React.useState(null),[saving,setSaving]=React.useState(false),busy=React.useRef(false);
  const change=patch=>{setDraft(current=>({...current,...patch,confirmed:false}));setFeedback(null);};
  const edit=(index,patch)=>change({entries:draft.entries.map((e,i)=>i===index?{...e,...patch}:e)});
  const errors={OPERATING_PLAN_BUDGET_ITEM_REQUIRED:t('اختر بند موازنة تشغيلية؛ لا تستخدم الفعلي أو المعياري.','Select a budget expense; actual and normalized items are excluded.'),OPERATING_PLAN_PAST_DATE:t('تاريخ الدفع يسبق تاريخ الحالة؛ راجع الخطة ولا تفترض أنه دُفع.','Payment predates the case; review the plan rather than assuming payment.'),OPERATING_PLAN_DUPLICATE_DATE:t('اجمع دفعات البند في التاريخ نفسه بسطر واحد.','Combine same-item payments on the same date.'),OPERATING_PLAN_STALE:t('تغيرت المصروفات أو الخطة؛ أعد تحميل المسودة.','Expenses or plan changed; reload the draft.'),EXPLICIT_VERIFICATION_CONFIRMATION_REQUIRED:t('أكّد مراجعة الخطة بعد آخر تعديل.','Confirm review after the last edit.')};
  const submit=async e=>{
    e.preventDefault();if(busy.current)return;busy.current=true;setSaving(true);
    try{
      if(draft.signature!==signature)throw new Error('OPERATING_PLAN_STALE');
      const candidate=replaceOperatingPaymentPlan(operatingCase,draft);
      if(typeof onReplaceOperatingCase!=='function')throw new Error('OPERATING_CASE_UPDATE_HANDLER_REQUIRED');
      const response=await onReplaceOperatingCase(candidate,'OPERATING_PLAN_UPDATED');
      if(response?.ok!==true)throw new Error(response?.code||'OPERATING_CASE_UPDATE_REJECTED');
      setDraft(current=>({...current,confirmed:false,sourceRef:'',reviewRef:'',signature:JSON.stringify([candidate.operatingPaymentPlan,candidate.operatingExpenses])}));setFeedback({ok:true});
    }catch(error){setFeedback({ok:false,code:String(error.message||error).slice(0,160)});}
    finally{busy.current=false;setSaving(false);}
  };
  return <form onSubmit={submit} data-testid="operating-plan-editor" className="rounded-xl border border-slate-700 p-4"><fieldset disabled={saving} className="min-w-0">
    <legend className="text-sm font-semibold">{t('دفعات المصروفات التشغيلية المخططة','Planned operating payments')}</legend>
    <p className="my-2 text-xs leading-6 text-slate-300">{t('أدخل الدفعات المستقبلية لبنود الموازنة التشغيلية من خطة موثقة. لا نحول المبلغ السنوي إلى دفعات تلقائيًا ولا نفترض سنة موازنة أو اكتمال التغطية. المبلغ بجانب البند مرجع سنوي فقط؛ مبالغ الخطة مستقلة ويلزم مراجعتها مع مصدرها.','Enter future payments for budget expense items from a documented plan. Annual budgets are not automatically converted to payments; no budget year or complete coverage is inferred. The amount beside the item is an annual reference only; review the independent planned amounts against their source.')}</p>
    <p className="mb-2 text-xs leading-6 text-amber-200">{t('تعرض الخطة المدفوعات المخططة المدخلة فقط؛ ليست مصروفات فعلية أو تفويض صرف أو توقع رصيد نقدي. لا تُضاف إلى المصروف المعياري ولا تغيّر صافي الدخل. الخطة الفارغة تعني عدم توفر البيانات، والمبالغ خارج الأفق تظهر منفصلة.','The plan covers entered planned payments only, not actual costs, spending authority or a cash-balance forecast. It is not added to normalized OPEX and does not alter NOI. An empty plan means unavailable data; amounts outside the horizon are separate.')}</p>
    {draft.entries.map((entry,index)=><div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 mb-2" key={index}>
      <label className="text-xs">{t('البند','Item')}<select data-testid={`operating-item-${index}`} className={inputClass} required value={entry.expenseId} onChange={e=>edit(index,{expenseId:e.target.value})}><option value="">—</option>{budgetItems.map(item=><option data-user-content translate="no" key={item.expenseId} value={item.expenseId}>{item.expenseId} · {item.annualAmount.value??'—'} {t('ريال/سنة','SAR/year')}</option>)}</select></label>
      <label className="text-xs">{t('تاريخ الدفع المخطط','Planned payment date')}<input data-testid={`operating-date-${index}`} className={inputClass} type="date" required value={entry.date} onChange={e=>edit(index,{date:e.target.value})}/></label>
      <label className="text-xs">{t('المبلغ بالريال','Amount in SAR')}<input data-testid={`operating-amount-${index}`} className={inputClass} type="number" min="0.01" step="0.01" required value={entry.amount} onChange={e=>edit(index,{amount:e.target.value})}/></label>
      <button type="button" className="rounded border border-slate-600 p-2 text-xs" onClick={()=>change({entries:draft.entries.filter((_,i)=>i!==index)})}>{t('حذف السطر','Remove row')}</button>
    </div>)}
    <button data-testid="operating-add" type="button" disabled={!budgetItems.length||draft.entries.length>=2000} className="rounded border border-slate-600 p-2 text-xs mb-3" onClick={()=>change({entries:[...draft.entries,{expenseId:'',date:'',amount:''}]})}>{t('إضافة دفعة مخططة','Add planned payment')}</button>
    <div className="grid gap-3 md:grid-cols-2"><label className="text-xs">{t('مرجع الخطة','Plan reference')}<input data-testid="operating-source" className={inputClass} required value={draft.sourceRef} onChange={e=>change({sourceRef:e.target.value})}/></label><label className="text-xs">{t('مرجع المراجعة المحلية','Local review reference')}<input data-testid="operating-review" className={inputClass} required value={draft.reviewRef} onChange={e=>change({reviewRef:e.target.value})}/></label></div>
    <label className="flex items-start gap-2 my-3 text-xs"><input data-testid="operating-confirm" type="checkbox" checked={draft.confirmed} onChange={e=>setDraft({...draft,confirmed:e.target.checked})}/>{t('راجعت مبالغ الدفعات وتواريخها ومصدرها وحدود التغطية المحلية.','I reviewed payment amounts, dates, source and local coverage limits.')}</label>
    <div className="flex flex-wrap gap-2"><button data-testid="operating-save" type="submit" className="rounded border border-amber-700 p-2 text-xs">{t('حفظ خطة الدفع','Save payment plan')}</button><button type="button" className="rounded border border-slate-600 p-2 text-xs" onClick={()=>{setDraft(initial());setFeedback(null);}}>{t('إعادة تحميل المسودة','Reload draft')}</button></div>
  </fieldset>{feedback&&<p data-testid="operating-feedback" data-diagnostic-content translate="no" role="status" className="mt-2 text-xs">{feedback.ok?t('تم حفظ خطة الدفع.','Payment plan saved.'):<>{errors[feedback.code]||t('تعذر الحفظ؛ راجع المبالغ والتواريخ والمراجع.','Save failed; check amounts, dates and references.')} <code dir="ltr">{feedback.code}</code></>}</p>}</form>;
}
