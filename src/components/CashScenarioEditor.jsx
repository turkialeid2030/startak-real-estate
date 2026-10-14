import React from 'react';
import {replaceCashScenario} from '../residential-income-acquisition/cash-scenario';
const cls='w-full min-w-0 rounded border border-slate-600 bg-slate-950 p-2 text-xs';
export default function CashScenarioEditor({operatingCase:c,onReplaceOperatingCase,dir}){
  const t=(a,b)=>dir==='rtl'?a:b,signature=JSON.stringify([c.cashScenario||null,c.leases]);
  const initial=()=>({openingDate:c.cashScenario?.openingDate||c.asOfDate.slice(0,10),openingAmount:c.cashScenario?String(c.cashScenario.openingMinor/100):'',entries:(c.cashScenario?.entries||[]).map(e=>({...e,amount:String(e.amountMinor/100)})),sourceRef:'',reviewRef:'',confirmed:false,signature});
  const [draft,setDraft]=React.useState(initial),[feedback,setFeedback]=React.useState(null),[saving,setSaving]=React.useState(false),busy=React.useRef(false);
  const change=patch=>{setDraft(d=>({...d,...patch,confirmed:false}));setFeedback(null);};
  const edit=(i,patch)=>change({entries:draft.entries.map((e,n)=>n===i?{...e,...patch}:e)});
  const submit=async e=>{
    e.preventDefault();if(busy.current)return;busy.current=true;setSaving(true);
    try{
      if(draft.signature!==signature)throw new Error('CASH_DRAFT_STALE');
      const next=replaceCashScenario(c,draft);
      if(typeof onReplaceOperatingCase!=='function')throw new Error('OPERATING_CASE_UPDATE_HANDLER_REQUIRED');
      const response=await onReplaceOperatingCase(next,'CASH_SCENARIO_UPDATED');
      if(response?.ok!==true)throw new Error(response?.code||'OPERATING_CASE_UPDATE_REJECTED');
      setDraft(d=>({...d,confirmed:false,sourceRef:'',reviewRef:'',signature:JSON.stringify([next.cashScenario,next.leases])}));setFeedback({ok:true});
    }catch(error){setFeedback({ok:false,code:String(error.message||error).slice(0,160)});}finally{busy.current=false;setSaving(false);}
  };
  return <form onSubmit={submit} className="rounded border border-slate-700 p-3 text-xs"><fieldset disabled={saving} className="min-w-0 space-y-3">
    <legend>{t('سيناريو التحصيل والرصيد للمدخلات فقط','Receipts and balance scenario for entered data only')}</legend>
    <p>{t('أدخل الرصيد في بداية تاريخ الحالة والتحصيل المستقبلي المفترض بالريال. لا يُستنتج التحصيل من الإيجار أو الفواتير أو المقبوضات التاريخية. السطر مرتبط بعقد، وقد يمثل متأخرات؛ مرجعه فريد داخل الخطة. عدم إدخال سطور مع التأكيد يعني افتراض عدم التحصيل خلال الأفق.','Enter opening balance at the start of the case date and assumed future receipts in SAR. Receipts are not inferred from rent, invoices or historical collections. Each line links to a lease, may include arrears, and needs a unique plan reference. Confirming no lines explicitly assumes no receipts in the horizon.')}</p>
    <p>{t('الأفق نفس 12 شهرًا تقويميًا للإسقاط. يلزم تطابق موازنة التشغيل مع الأفق وخطة رأسمالية مؤهلة لحساب الناتج. تُستبعد التدفقات غير المدخلة، ومنها التمويل والضرائب والتأمينات والرسوم. لا يثبت الرصيد سيولة داخل الشهر أو رصيد البنك الفعلي.','The horizon matches the 12-calendar-month projection. Calculation requires a matched operating budget for that exact horizon and a qualified capital plan. Unentered financing, taxes, deposits, fees and other flows are excluded. The balance does not establish intramonth liquidity or actual bank funds.')}</p>
    <label className="block">{t('تاريخ الرصيد الافتتاحي','Opening balance date')}<input data-testid="cash-date" className={cls} type="date" required value={draft.openingDate} onChange={e=>change({openingDate:e.target.value})}/></label>
    <label className="block">{t('الرصيد الافتتاحي بالريال — الصفر والسالب صريحان','Opening balance SAR — explicit zero or negative allowed')}<input data-testid="cash-opening" className={cls} required value={draft.openingAmount} onChange={e=>change({openingAmount:e.target.value})}/></label>
    {draft.entries.map((entry,i)=><div key={i} className="grid gap-2 sm:grid-cols-2">
      <label>{t('العقد','Lease')}<select data-testid={`cash-lease-${i}`} className={cls} required value={entry.leaseId} onChange={e=>edit(i,{leaseId:e.target.value})}><option value="">—</option>{c.leases.map(l=><option key={l.leaseId} data-user-content translate="no" value={l.leaseId}>{l.leaseId}</option>)}</select></label>
      <label>{t('تاريخ التحصيل المفترض','Assumed receipt date')}<input data-testid={`cash-receipt-date-${i}`} className={cls} type="date" required value={entry.date} onChange={e=>edit(i,{date:e.target.value})}/></label>
      <label>{t('المبلغ بالريال','Amount SAR')}<input data-testid={`cash-amount-${i}`} className={cls} required value={entry.amount} onChange={e=>edit(i,{amount:e.target.value})}/></label>
      <label>{t('مرجع التحصيل المخطط','Planned receipt reference')}<input data-testid={`cash-reference-${i}`} className={cls} required maxLength={500} value={entry.reference} onChange={e=>edit(i,{reference:e.target.value})}/></label>
      <button type="button" onClick={()=>change({entries:draft.entries.filter((_,n)=>i!==n)})}>{t('حذف السطر','Remove row')}</button>
    </div>)}
    <button data-testid="cash-add" type="button" disabled={draft.entries.length>=2000||!c.leases.length} onClick={()=>change({entries:[...draft.entries,{leaseId:'',date:'',amount:'',reference:''}]})}>{t('إضافة تحصيل مفترض','Add assumed receipt')}</button>
    <label className="block">{t('مرجع الرصيد وخطة التحصيل','Opening balance and receipt plan source')}<input data-testid="cash-source" required maxLength={500} className={cls} value={draft.sourceRef} onChange={e=>change({sourceRef:e.target.value})}/></label>
    <label className="block">{t('مرجع المراجعة المحلية','Local review reference')}<input data-testid="cash-review" required maxLength={500} className={cls} value={draft.reviewRef} onChange={e=>change({reviewRef:e.target.value})}/></label>
    <label className="flex gap-2"><input data-testid="cash-confirm" type="checkbox" checked={draft.confirmed} onChange={e=>setDraft({...draft,confirmed:e.target.checked})}/>{t('راجعت الرصيد والتحصيل المفترض ومصادرهما وحدود التغطية؛ ليست قيود قبض فعلية.','I reviewed the opening balance, receipt assumptions, sources and coverage limits; these are not actual receipts.')}</label>
    <button data-testid="cash-save" type="submit" className="rounded border p-2">{t('حفظ السيناريو','Save scenario')}</button> <button type="button" onClick={()=>{setDraft(initial());setFeedback(null);}}>{t('إعادة تحميل المسودة','Reload draft')}</button>
  </fieldset>{feedback&&<p data-testid="cash-feedback" role="status" data-diagnostic-content translate="no">{feedback.ok?t('تم حفظ السيناريو.','Scenario saved.'):<>{t('تعذر الحفظ؛ راجع المدخلات والتأكيد أو أعد تحميل المسودة.','Save failed; check inputs and confirmation or reload the draft.')} <code>{feedback.code}</code></>}</p>}</form>;
}
