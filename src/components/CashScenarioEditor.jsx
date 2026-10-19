import React from 'react';
import NumericDraftInput from './NumericDraftInput';
import {replaceCashScenario,formatCashMinor} from '../residential-income-acquisition/cash-scenario';
import {CASH_OTHER_FLOW_CATEGORIES} from '../residential-income-acquisition/cash-other-flows';
import CashOtherFlowsEditor from './CashOtherFlowsEditor';
import CashInvestmentReturnEditor from './CashInvestmentReturnEditor';
import {defaultCashHorizonEnd} from '../residential-income-acquisition/cash-horizon';
import {investmentReturnContextFromDraft} from '../residential-income-acquisition/entered-investment-returns';
const cls='w-full min-w-0 rounded border border-slate-600 bg-slate-950 p-2 text-xs';
const returnDraft=c=>({enabled:Boolean(c),acquisitionAmount:c?formatCashMinor(c.acquisitionMinor):'',acquisitionSourceRef:c?.acquisitionSourceRef||'',discountPercent:c?String(c.discountRate*100):'',discountSourceRef:c?.discountSourceRef||'',reviewRef:c?.reviewRef||'',exitTreatment:c?.exitTreatment||'NO_SALE_INCLUDED',saleDate:c?.saleDate||'',netSaleAmount:c?.netSaleMinor!=null?formatCashMinor(c.netSaleMinor):'',saleSourceRef:c?.saleSourceRef||''});
export default function CashScenarioEditor({operatingCase:c,onReplaceOperatingCase,dir}){
  const t=(a,b)=>dir==='rtl'?a:b,caseSignature=x=>JSON.stringify([x.cashScenario||null,x.leases.map(l=>l.leaseId),x.asOfDate,x.operatingPaymentPlan||null,x.capitalPaymentPlan||null]),signature=caseSignature(c);
  const initial=()=>({openingDate:c.cashScenario?.openingDate||c.asOfDate.slice(0,10),horizonEndExclusive:c.cashScenario?.horizonEndExclusive||defaultCashHorizonEnd(c.asOfDate.slice(0,10)),returnDraft:returnDraft(c.cashScenario?.investmentReturnContext),openingAmount:c.cashScenario?formatCashMinor(c.cashScenario.openingMinor):'',entries:(c.cashScenario?.entries||[]).map(e=>({...e,amount:formatCashMinor(e.amountMinor)})),otherFlows:{schemaVersion:1,entries:(c.cashScenario?.otherFlows?.entries||[]).map(e=>({...e,amount:formatCashMinor(e.amountMinor)})),categoryReviews:c.cashScenario?.otherFlows?.categoryReviews||CASH_OTHER_FLOW_CATEGORIES.map(category=>({category,status:'NOT_REVIEWED'}))},sourceRef:'',reviewRef:'',confirmed:false,signature:c.cashScenario?signature:null});
  const [draft,setDraft]=React.useState(initial),[feedback,setFeedback]=React.useState(null),[saving,setSaving]=React.useState(false),busy=React.useRef(false);
  const change=patch=>{setDraft(d=>({...d,...patch,signature:d.signature??signature,confirmed:false}));setFeedback(null);};
  const edit=(i,patch)=>change({entries:draft.entries.map((e,n)=>n===i?{...e,...patch}:e)});
  const submit=async e=>{
    e.preventDefault();if(busy.current)return;busy.current=true;setSaving(true);
    try{
      if(draft.signature!==signature)throw new Error('CASH_DRAFT_STALE');
      const next=replaceCashScenario(c,{...draft,...(draft.returnDraft.enabled?{investmentReturnContext:investmentReturnContextFromDraft(draft.returnDraft,draft.openingDate,draft.horizonEndExclusive)}:{})});
      if(typeof onReplaceOperatingCase!=='function')throw new Error('OPERATING_CASE_UPDATE_HANDLER_REQUIRED');
      const response=await onReplaceOperatingCase(next,'CASH_SCENARIO_UPDATED');
      if(response?.ok!==true)throw new Error(response?.code||'OPERATING_CASE_UPDATE_REJECTED');
      setDraft(d=>({...d,confirmed:false,sourceRef:'',reviewRef:'',signature:caseSignature(next)}));setFeedback({ok:true});
    }catch(error){setFeedback({ok:false,code:String(error.message||error).slice(0,160)});}finally{busy.current=false;setSaving(false);}
  };
  return <form onSubmit={submit} className="rounded border border-slate-700 p-3 text-xs"><fieldset disabled={saving} className="min-w-0 space-y-3">
    <legend>{t('سيناريو التحصيل والرصيد للمدخلات فقط','Receipts and balance scenario for entered data only')}</legend>
    <p>{t('أدخل الرصيد في بداية تاريخ الحالة والتحصيل المستقبلي المفترض بالريال. لا يُستنتج التحصيل من الإيجار أو الفواتير أو المقبوضات التاريخية. السطر مرتبط بعقد، وقد يمثل متأخرات؛ مرجعه فريد داخل الخطة. عدم إدخال سطور مع التأكيد يعني افتراض عدم التحصيل خلال الأفق.','Enter opening balance at the start of the case date and assumed future receipts in SAR. Receipts are not inferred from rent, invoices or historical collections. Each line links to a lease, may include arrears, and needs a unique plan reference. Confirming no lines explicitly assumes no receipts in the horizon.')}</p>
    <p>{t('حدد نهاية أفق النقد صراحة، بحد أقصى 50 سنة؛ البداية تاريخ الحالة. يلزم تطابق موازنة التشغيل مع الأفق وخطة رأسمالية مؤهلة لحساب الناتج. أدرج التدفقات الأخرى أدناه وراجع تغطيتها؛ كل تدفق غير مدخل مستبعد. لا تُمدد العقود تلقائيًا، ولا يثبت السيناريو اكتمال المصادر أو رصيد البنك الفعلي.','Set an explicit cash-horizon end, up to 50 years from the case date. Calculation requires a matched operating budget for that exact horizon and a qualified capital plan. Enter and review additional flows below; every unentered flow is excluded. Leases are not automatically renewed. The scenario does not establish source completeness or actual bank funds.')}</p>
    <label className="block">{t('تاريخ الرصيد الافتتاحي','Opening balance date')}<input data-testid="cash-date" className={cls} type="date" required value={draft.openingDate} onChange={e=>change({openingDate:e.target.value})}/></label>
    <label className="block">{t('نهاية أفق النقد — غير مشمولة','Cash horizon end — exclusive')}<input data-testid="cash-horizon-end" className={cls} type="date" required value={draft.horizonEndExclusive} onChange={e=>change({horizonEndExclusive:e.target.value})}/></label>
    <label className="block">{t('الرصيد الافتتاحي بالريال — الصفر والسالب صريحان','Opening balance SAR — explicit zero or negative allowed')}<NumericDraftInput data-testid="cash-opening" locale={dir==='rtl'?'ar-SA':'en'} min={null} className={cls} required value={draft.openingAmount} onChange={e=>change({openingAmount:e.target.value})}/></label>
    {draft.entries.map((entry,i)=><div key={i} className="grid gap-2 sm:grid-cols-2">
      <label>{t('العقد','Lease')}<select data-testid={`cash-lease-${i}`} className={cls} required value={entry.leaseId} onChange={e=>edit(i,{leaseId:e.target.value})}><option value="">—</option>{c.leases.map(l=><option key={l.leaseId} data-user-content translate="no" value={l.leaseId}>{l.leaseId}</option>)}</select></label>
      <label>{t('تاريخ التحصيل المفترض','Assumed receipt date')}<input data-testid={`cash-receipt-date-${i}`} className={cls} type="date" required value={entry.date} onChange={e=>edit(i,{date:e.target.value})}/></label>
      <label>{t('المبلغ بالريال','Amount SAR')}<NumericDraftInput data-testid={`cash-amount-${i}`} locale={dir==='rtl'?'ar-SA':'en'} min={0.01} className={cls} required value={entry.amount} onChange={e=>edit(i,{amount:e.target.value})}/></label>
      <label>{t('مرجع التحصيل المخطط','Planned receipt reference')}<input data-testid={`cash-reference-${i}`} className={cls} required maxLength={500} value={entry.reference} onChange={e=>edit(i,{reference:e.target.value})}/></label>
      <button type="button" onClick={()=>change({entries:draft.entries.filter((_,n)=>i!==n)})}>{t('حذف السطر','Remove row')}</button>
    </div>)}
    <button data-testid="cash-add" type="button" disabled={draft.entries.length>=2000||!c.leases.length} onClick={()=>change({entries:[...draft.entries,{leaseId:'',date:'',amount:'',reference:''}]})}>{t('إضافة تحصيل مفترض','Add assumed receipt')}</button>
    <CashOtherFlowsEditor value={draft.otherFlows} onChange={otherFlows=>change({otherFlows})} dir={dir}/>
    <CashInvestmentReturnEditor value={draft.returnDraft} onChange={returnDraft=>change({returnDraft})} dir={dir}/>
    <label className="block">{t('مرجع الرصيد وخطة التحصيل','Opening balance and receipt plan source')}<input data-testid="cash-source" required maxLength={500} className={cls} value={draft.sourceRef} onChange={e=>change({sourceRef:e.target.value})}/></label>
    <label className="block">{t('مرجع المراجعة المحلية','Local review reference')}<input data-testid="cash-review" required maxLength={500} className={cls} value={draft.reviewRef} onChange={e=>change({reviewRef:e.target.value})}/></label>
    <label className="flex gap-2"><input data-testid="cash-confirm" type="checkbox" checked={draft.confirmed} onChange={e=>setDraft({...draft,confirmed:e.target.checked})}/>{t('راجعت الرصيد والتحصيل والتدفقات الأخرى ومصادرها، وتصريحات التغطية وعدم ازدواج الحركات مع خطط التشغيل والرأسمالي؛ هذه افتراضات وليست قيود قبض أو دفع فعلية.','I reviewed the opening balance, receipts, other flows, sources, coverage declarations and absence of double-counting with operating or capital plans; these are assumptions, not actual receipts or payments.')}</label>
    <button data-testid="cash-save" type="submit" className="rounded border p-2">{t('حفظ السيناريو','Save scenario')}</button> <button data-testid="cash-reload" type="button" onClick={()=>{setDraft(initial());setFeedback(null);}}>{t('إعادة تحميل المسودة','Reload draft')}</button>
  </fieldset>{feedback&&<p data-testid="cash-feedback" role="status" data-diagnostic-content translate="no">{feedback.ok?t('تم حفظ السيناريو.','Scenario saved.'):<>{t('تعذر الحفظ؛ راجع المدخلات والتأكيد أو أعد تحميل المسودة.','Save failed; check inputs and confirmation or reload the draft.')} <code>{feedback.code}</code></>}</p>}</form>;
}
