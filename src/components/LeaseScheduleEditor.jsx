import React from 'react';
import {updateVerifiedLeaseSchedule} from '../residential-income-acquisition/operating-case-editor';

const inputClass='w-full min-w-0 rounded border border-slate-600 bg-slate-950 p-2 text-xs';
const blank=()=>({leaseId:'',entries:[{effectiveDate:'',rent:''}],sourceRef:'',adoptionDecisionRef:'',confirmed:false,snapshot:''});
export default function LeaseScheduleEditor({operatingCase,onReplaceOperatingCase,dir}){
  const ar=dir==='rtl',t=(a,b)=>ar?a:b;
  const [draft,setDraft]=React.useState(blank),[feedback,setFeedback]=React.useState(null),[saving,setSaving]=React.useState(false);
  const busy=React.useRef(false);
  const change=patch=>setDraft(current=>({...current,...patch,confirmed:false}));
  const select=id=>{
    const lease=operatingCase.leases.find(x=>x.leaseId===id);
    setDraft({...blank(),leaseId:id,snapshot:lease?JSON.stringify(lease):'',entries:lease?.escalation.schedule.length?lease.escalation.schedule.map(x=>({effectiveDate:x.effectiveDate.slice(0,10),rent:String(x.rent.value??'')})):blank().entries});
    setFeedback(null);
  };
  const selected=operatingCase.leases.find(x=>x.leaseId===draft.leaseId);
  const errors={
    EXPLICIT_VERIFICATION_CONFIRMATION_REQUIRED:t('أكّد مراجعة الجدول بعد آخر تعديل.','Confirm review after the last edit.'),
    LEASE_SCHEDULE_OUTSIDE_TERM:t('يجب أن تقع التواريخ داخل مدة العقد وقبل تاريخ نهايته.','Dates must lie within the lease, before its end.'),
    LEASE_SCHEDULE_DATES_NOT_INCREASING:t('رتّب التواريخ تصاعديًا دون تكرار.','Dates must increase without duplicates.'),
    LEASE_SCHEDULE_REQUIRED:t('أدخل من سطر واحد إلى 200 سطر.','Enter 1 to 200 rows.'),
    LEASE_SCHEDULE_DRAFT_STALE:t('تغيّر العقد منذ فتح المسودة؛ أعد اختياره وراجع الجدول.','The lease changed; reselect it and review the schedule.'),
    LEASE_SCHEDULE_TYPE_UNSUPPORTED:t('نوع العقد أو الزيادة لا يدعم هذا المحرر.','This lease or escalation type is unsupported.'),
    OPERATING_AMOUNT_REQUIRED:t('أدخل مبلغًا صالحًا؛ الفراغ ليس صفرًا.','Enter a valid amount; blank is not zero.'),
  };
  const submit=async event=>{
    event.preventDefault();if(busy.current)return;busy.current=true;setSaving(true);
    try{
      if(!selected||JSON.stringify(selected)!==draft.snapshot)throw new Error('LEASE_SCHEDULE_DRAFT_STALE');
      const candidate=updateVerifiedLeaseSchedule(operatingCase,draft);
      if(typeof onReplaceOperatingCase!=='function')throw new Error('OPERATING_CASE_UPDATE_HANDLER_REQUIRED');
      const response=await onReplaceOperatingCase(candidate,'LEASE_UPDATED');
      if(response?.ok!==true)throw new Error(response?.code||'OPERATING_CASE_UPDATE_REJECTED');
      setDraft(current=>({...current,confirmed:false,sourceRef:'',adoptionDecisionRef:'',snapshot:JSON.stringify(candidate.leases.find(x=>x.leaseId===current.leaseId))}));
      setFeedback({ok:true});
    }catch(error){setFeedback({ok:false,code:String(error.code||error.message||error).slice(0,160)});}
    finally{busy.current=false;setSaving(false);}
  };
  return <form onSubmit={submit} data-testid="lease-schedule-editor" className="rounded-xl border border-slate-700 p-4">
    <fieldset disabled={saving} className="min-w-0">
      <legend className="text-sm font-semibold">{t('جدول الإيجار وفترات السماح','Rent schedule and rent-free periods')}</legend>
      <p className="my-2 text-xs leading-6 text-slate-300">{t('كل سطر يستبدل إيجار الفترة من تاريخه حتى السطر التالي أو نهاية العقد. أدخل صفرًا لفترة السماح، ثم مبلغ العودة في تاريخ انتهائها. المبلغ حسب دورية العقد، وليس نسبة زيادة أو مبلغ تحصيل. الحفظ يستبدل الجدول كاملًا، ويُبقي الإيجار الأساسي قبل أول سطر.','Each row replaces periodic rent from its date until the next row or lease expiry. Enter zero for a rent-free period and a restart amount at its end. Amounts use the lease frequency, not a percentage or collected cash. Saving replaces the complete schedule; base rent applies before the first row.')}</p>
      <p className="mb-3 text-xs leading-6 text-amber-200">{t('هذه مراجعة محلية لا توثق الهوية أو صحة العقد أو جواز الزيادة نظاميًا. لا تجديد تلقائي ولا تعديل للدراسة الرئيسية.','Local review does not authenticate identity, contract validity or legally permissible increases. No automatic renewal or main-study mutation.')}</p>
      <label className="block text-xs">{t('العقد','Lease')}<select data-testid="schedule-lease" aria-label={t('العقد','Lease')} className={inputClass} value={draft.leaseId} onChange={e=>select(e.target.value)} required><option value="">—</option>{operatingCase.leases.filter(x=>['ACTIVE','FUTURE'].includes(x.lifecycleStatus)&&['NONE','STEP_RENT','MANUAL_SCHEDULE'].includes(x.escalation.type)).map(x=><option data-user-content translate="no" key={x.leaseId} value={x.leaseId}>{x.leaseId}</option>)}</select></label>
      {selected&&<p className="mt-2 text-xs" data-user-content translate="no">{selected.startDate} → {selected.endDate} · {selected.baseRent.unit}</p>}
      <div className="mt-3 space-y-2">{draft.entries.map((entry,index)=><div key={index} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <label className="text-xs">{t('تاريخ السريان','Effective date')}<input data-testid={`schedule-date-${index}`} aria-label={t(`تاريخ السريان ${index+1}`,`Effective date ${index+1}`)} type="date" required className={inputClass} value={entry.effectiveDate} onChange={e=>change({entries:draft.entries.map((x,i)=>i===index?{...x,effectiveDate:e.target.value}:x)})}/></label>
        <label className="text-xs">{t('إيجار الفترة','Periodic rent')}<input data-testid={`schedule-rent-${index}`} aria-label={t(`إيجار الفترة ${index+1}`,`Periodic rent ${index+1}`)} type="number" min="0" step="0.01" required className={inputClass} value={entry.rent} onChange={e=>change({entries:draft.entries.map((x,i)=>i===index?{...x,rent:e.target.value}:x)})}/></label>
        <button type="button" className="rounded border border-slate-600 p-2 text-xs" disabled={draft.entries.length===1} aria-label={t(`حذف السطر ${index+1}`,`Remove row ${index+1}`)} onClick={()=>change({entries:draft.entries.filter((_,i)=>i!==index)})}>{t('حذف السطر','Remove row')}</button>
      </div>)}</div>
      <button type="button" data-testid="schedule-add-row" disabled={draft.entries.length>=200} onClick={()=>change({entries:[...draft.entries,{effectiveDate:'',rent:''}]})} className="my-3 rounded border border-slate-600 p-2 text-xs">{t('إضافة تاريخ ومبلغ','Add date and amount')}</button>
      <div className="grid gap-3 md:grid-cols-2"><label className="text-xs">{t('مرجع المستند أو الشرط','Document or clause reference')}<input data-testid="schedule-source" required className={inputClass} value={draft.sourceRef} onChange={e=>change({sourceRef:e.target.value})}/></label><label className="text-xs">{t('مرجع المراجعة المحلية','Local review reference')}<input data-testid="schedule-adoption" required className={inputClass} value={draft.adoptionDecisionRef} onChange={e=>change({adoptionDecisionRef:e.target.value})}/></label></div>
      <label className="my-3 flex items-start gap-2 text-xs leading-5"><input data-testid="schedule-confirm" type="checkbox" checked={draft.confirmed} onChange={e=>setDraft({...draft,confirmed:e.target.checked})}/>{t('راجعت جميع التواريخ والمبالغ ومصدرها وحدود هذا الحساب.','I reviewed all dates, amounts, sources and calculation boundaries.')}</label>
      <button type="submit" data-testid="schedule-save" className="rounded border border-amber-700 p-2 text-xs">{t('حفظ جدول الإيجار','Save rent schedule')}</button>
    </fieldset>
    {feedback&&<p role="status" data-testid="schedule-feedback" data-diagnostic-content translate="no" className="mt-3 text-xs leading-6">{feedback.ok?t('تم حفظ جدول الإيجار.','Rent schedule saved.'):<>{errors[feedback.code]||t('تعذر الحفظ؛ راجع المدخلات والمرجع قبل إعادة المحاولة.','Save failed; check inputs and references.')} <code dir="ltr">{feedback.code}</code></>}</p>}
  </form>;
}
