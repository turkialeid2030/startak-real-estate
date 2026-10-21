import React from 'react';
import {recordDocumentedLeaseLifecycle} from '../residential-income-acquisition/operating-case-editor';
const cls='w-full min-w-0 rounded border border-slate-600 bg-slate-950 p-2 text-xs';
const blank=()=>({action:'EARLY_END',leaseId:'',date:'',sourceRef:'',adoptionDecisionRef:'',reason:'',confirmed:false,signature:null});
export default function LeaseLifecycleEditor({operatingCase:c,onReplaceOperatingCase,dir}){
 const ar=dir==='rtl',t=(a,b)=>ar?a:b,signature=React.useMemo(()=>JSON.stringify(c),[c]);
 const [draft,setDraft]=React.useState(blank),[feedback,setFeedback]=React.useState(null),[saving,setSaving]=React.useState(false),busy=React.useRef(false);
 const change=patch=>{setDraft(current=>({...current,...patch,confirmed:false,signature:current.signature??signature}));setFeedback(null);};
 const actions={EARLY_END:t('تسجيل نهاية مبكرة موثقة','Record documented early end'),CANCEL_FUTURE:t('تسجيل إلغاء عقد مستقبلي','Record future lease cancellation'),REVIEW_DATE:t('مراجعة الحالات في تاريخ دراسة جديد','Review states at a new case date'),RESTORE_PREVIOUS:t('تصحيح باسترجاع الشروط السابقة','Correct by restoring previous terms')};
 const states={ACTIVE:t('نشط مسجل','Declared active'),FUTURE:t('مستقبلي مسجل','Declared future'),EXPIRED:t('منتهٍ مسجل','Declared expired'),TERMINATED:t('إنهاء مسجل','Declared terminated'),UNKNOWN:t('غير محدد','Unknown')};
 const kinds={TERMS_REPLACED:t('تصحيح الشروط','Terms replacement'),SCHEDULE_REPLACED:t('استبدال جدول الإيجار','Rent schedule replacement'),EARLY_END_RECORDED:actions.EARLY_END,FUTURE_CANCELLED:actions.CANCEL_FUTURE,STATE_REVIEWED:actions.REVIEW_DATE,PREVIOUS_TERMS_RESTORED:actions.RESTORE_PREVIOUS};
 const eligible=c.leases.filter(lease=>draft.action==='EARLY_END'?lease.lifecycleStatus==='ACTIVE':draft.action==='CANCEL_FUTURE'?lease.lifecycleStatus==='FUTURE'&&lease.startDate?.slice(0,10)>c.asOfDate.slice(0,10):Boolean(lease.changeLog?.length&&lease.changeLog.at(-1).kind!=='STATE_REVIEWED'&&lease.changeLog.at(-1).caseDateAfter===c.asOfDate.slice(0,10)));
 const selected=c.leases.find(lease=>lease.leaseId===draft.leaseId);
 const events=c.leases.flatMap(lease=>(lease.changeLog||[]).map(event=>({...event,leaseId:lease.leaseId})));
 const errors={
  LEASE_LIFECYCLE_DRAFT_STALE:t('تغيرت الحالة منذ بدء المسودة؛ امسحها وراجع البيانات الحالية.','The case changed after drafting; clear the draft and review current data.'),
  LEASE_EARLY_END_INVALID:t('اختر عقدًا نشطًا ونهاية بعد بدايته وقبل نهايته المسجلة.','Choose an active lease and an end after its start and before its recorded end.'),
  LEASE_CANCEL_FUTURE_INVALID:t('الإلغاء هنا لعقد مستقبلي لم يبدأ في تاريخ الحالة فقط.','Cancellation here requires a future lease not started at the case date.'),
  LEASE_REVIEW_DATE_INVALID:t('التاريخ يجب أن يكون صحيحًا ولا يسبق تاريخ الحالة الحالي.','Use a valid date on or after the current case date.'),
  LEASE_LIFECYCLE_TERMS_REQUIRED:t('أكمل تواريخ العقود وحالاتها قبل المراجعة.','Complete lease dates and states before review.'),
  LEASE_LIFECYCLE_OVERLAP:t('ينتج تداخل لعقدين على الوحدة نفسها؛ راجع المدد قبل الحفظ.','Two leases would overlap on the same unit; review the terms before saving.'),
  LEASE_RESTORE_PREVIOUS_INVALID:t('لا تتوفر شروط سابقة قابلة للاسترجاع في تاريخ الحالة الحالي. لا يُعكس تاريخ الدراسة بهذا الإجراء.','Previous terms cannot be restored at this case date. This action does not reverse the case date.'),
  EXPLICIT_VERIFICATION_CONFIRMATION_REQUIRED:t('أكّد المراجعة بعد آخر تعديل.','Confirm review after the last edit.'),
  LEASE_HISTORY_LIMIT:t('وصل السجل إلى 100 مراجعة للعقد؛ احتفظ بالتصدير وراجع الحالة قبل متابعة التعديل.','This lease reached 100 revisions; retain an export and review the case before further changes.'),
  LEASE_LIFECYCLE_NO_REVIEWABLE_LEASE:t('لا يوجد عقد نشط أو مستقبلي لمراجعته.','No active or future lease is available for review.'),
 };
 const submit=async event=>{
  event.preventDefault();if(busy.current)return;busy.current=true;setSaving(true);setFeedback(null);
  try{
   if(draft.signature!==signature)throw new TypeError('LEASE_LIFECYCLE_DRAFT_STALE');
   const candidate=recordDocumentedLeaseLifecycle(c,draft);
   if(typeof onReplaceOperatingCase!=='function')throw new TypeError('OPERATING_CASE_UPDATE_HANDLER_REQUIRED');
   const response=await onReplaceOperatingCase(candidate,'LEASE_UPDATED');
   if(response?.ok!==true)throw new TypeError(response?.code||'OPERATING_CASE_UPDATE_REJECTED');
   setDraft(blank());setFeedback({ok:true});
  }catch(error){const code=String(error.code||error.message||error).slice(0,160);setFeedback({ok:false,code,message:code.startsWith('COLLECTION_PERIOD_EXCEEDS_LEASE')?t('النهاية المقترحة تتعارض مع فترة تحصيل مدخلة. لم تُمحَ التحصيلات؛ راجع مصدرها أولًا.','The proposed end conflicts with an entered collection period. Collections were retained; review their source first.'):errors[code]});}
  finally{busy.current=false;setSaving(false);}
 };
 const download=()=>{
  const blob=new Blob([JSON.stringify({format:'STARTAK_LOCAL_LEASE_CHANGE_LOG',version:1,caseId:c.caseId,asOfDate:c.asOfDate,events,sourceAuthenticated:false,legalEffectEstablished:false,externalActionPerformed:false},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='lease-change-log.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 return <section className="rounded-xl border border-slate-700 p-4 space-y-3" data-testid="lease-lifecycle-editor">
  <form onSubmit={submit}><fieldset disabled={saving} className="min-w-0">
   <legend className="text-sm font-semibold">{t('دورة العقد وسجل تغييراته','Lease lifecycle and change history')}</legend>
   <p className="my-2 text-xs leading-6">{t('تُحفظ الشروط السابقة والجديدة ومراجع المصدر والمراجعة لكل تعديل. النهاية المبكرة توقف الإسقاط عند تاريخها غير المشمول، وتُحفظ أسطر الجدول اللاحقة ضمن النسخة السابقة. إلغاء العقد المستقبلي يستبعده من الإسقاط دون حذفه. مراجعة تاريخ الدراسة تُصنّف العقود النشطة والمستقبلية من تواريخها المدخلة.','Every change retains previous/new terms and source/review references. Early end stops run-off at its exclusive date; later schedule rows remain in the prior version. Future cancellation excludes the lease without deleting it. Case-date review classifies active/future leases from entered dates.')}</p>
   <p className="mb-3 text-xs leading-6 text-amber-200">{t('هذا تسجيل محلي لمستنداتك؛ لا ينهي أو يجدد عقدًا لدى جهة خارجية، ولا يرسل إشعارًا أو يثبت إشغال الوحدة أو اعتمادًا قانونيًا. لا تُعدّل التحصيلات والمستحقات أو الموازنة وخطة النقد تلقائيًا؛ قد يلزم إعادة مراجعة فتراتها بعد تغيير التاريخ.','This locally records your documents; it does not terminate/renew an external contract, deliver notices, establish unit occupancy or legal approval. Collections, charges, budgets and cash plans are not automatically rewritten; their periods may need review after a date change.')}</p>
   <div className="grid gap-3 sm:grid-cols-2">
    <label className="text-xs">{t('الإجراء المسجل','Recorded action')}<select data-testid="lifecycle-action" className={cls} value={draft.action} onChange={e=>change({action:e.target.value,leaseId:'',date:''})}>{Object.entries(actions).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    {draft.action!=='REVIEW_DATE'&&<label className="text-xs">{t('العقد','Lease')}<select data-testid="lifecycle-lease" required className={cls} value={draft.leaseId} onChange={e=>change({leaseId:e.target.value})}><option value="">—</option>{eligible.map(lease=><option data-user-content translate="no" key={lease.leaseId} value={lease.leaseId}>{lease.leaseId}</option>)}</select></label>}
    {['EARLY_END','REVIEW_DATE'].includes(draft.action)&&<label className="text-xs">{draft.action==='EARLY_END'?t('النهاية المبكرة غير المشمولة','Exclusive early end'):t('تاريخ الدراسة الجديد','New case date')}<input data-testid="lifecycle-date" type="date" required className={cls} value={draft.date} onChange={e=>change({date:e.target.value})}/></label>}
    <label className="text-xs">{t('مرجع المستند','Document reference')}<input data-testid="lifecycle-source" required className={cls} value={draft.sourceRef} onChange={e=>change({sourceRef:e.target.value})}/></label>
    <label className="text-xs">{t('مرجع المراجعة المحلية','Local review reference')}<input data-testid="lifecycle-review" required className={cls} value={draft.adoptionDecisionRef} onChange={e=>change({adoptionDecisionRef:e.target.value})}/></label>
    <label className="text-xs sm:col-span-2">{t('سبب التسجيل أو التصحيح','Reason for recording or correction')}<textarea data-testid="lifecycle-reason" required maxLength={1000} className={cls} value={draft.reason} onChange={e=>change({reason:e.target.value})}/></label>
   </div>
   {selected&&<p className="my-2 text-xs" data-testid="lifecycle-current"><span data-user-content translate="no">{selected.leaseId}</span> · {states[selected.lifecycleStatus]} · <span dir="ltr">{selected.startDate} → {selected.endDate}</span></p>}
   <label className="my-3 flex items-start gap-2 text-xs"><input data-testid="lifecycle-confirm" type="checkbox" checked={draft.confirmed} onChange={e=>setDraft({...draft,confirmed:e.target.checked})}/>{t('راجعت المستند والتاريخ وأثره، وأفهم أن هذا التسجيل لا ينفذ إجراءً خارجيًا.','I reviewed the document, date and effect and understand that this record performs no external action.')}</label>
   <div className="flex flex-wrap gap-2"><button data-testid="lifecycle-save" type="submit" className="rounded border border-amber-700 p-2 text-xs">{t('حفظ الإجراء في الحالة','Save action in case')}</button><button data-testid="lifecycle-clear" type="button" className="rounded border border-slate-600 p-2 text-xs" onClick={()=>{setDraft(blank());setFeedback(null);}}>{t('مسح المسودة','Clear draft')}</button></div>
  </fieldset>{feedback&&<p data-testid="lifecycle-feedback" data-code={feedback.code||'LEASE_LIFECYCLE_SAVED'} role={feedback.ok?'status':'alert'} className="mt-3 text-xs leading-6">{feedback.ok?t('حُفظ الإجراء وسجل الشروط السابقة. احفظ الصفقة للاحتفاظ به بعد إعادة الفتح.','Action and previous terms retained. Save the deal to retain it after reopening.'):<>{feedback.message||t('تعذر الحفظ؛ راجع البيانات ومصدرها.','Save failed; review inputs and sources.')} <code data-diagnostic-content translate="no" dir="ltr">{feedback.code}</code></>}</p>}</form>
  <div className="overflow-x-auto" role="region" aria-label={t('سجل تغييرات العقود','Lease change history')} tabIndex={0}><table className="w-full text-start text-xs"><thead><tr>{[t('العقد','Lease'),t('المراجعة','Revision'),t('نوع التسجيل','Change'),t('النهاية السابقة','Previous end'),t('النهاية الجديدة','New end')].map(label=><th scope="col" className="p-2" key={label}>{label}</th>)}</tr></thead><tbody>{events.map(event=><tr key={event.leaseId+':'+event.revision}><th scope="row" className="p-2" data-user-content translate="no">{event.leaseId}</th><td className="p-2">{event.revision}</td><td className="p-2">{kinds[event.kind]}</td><td className="p-2" dir="ltr">{event.before.endDate}</td><td className="p-2" dir="ltr">{event.after.endDate}</td></tr>)}</tbody></table></div>
  <button data-testid="lifecycle-export" type="button" className="rounded border border-slate-600 p-2 text-xs" disabled={saving} onClick={download}>{t('تصدير سجل التغييرات المحلي','Export local change history')}</button>
 </section>;
}
