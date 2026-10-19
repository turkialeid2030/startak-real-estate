import NumericDraftInput from './NumericDraftInput';
import React from 'react';
import {addDocumentedFutureLease} from '../residential-income-acquisition/operating-case-editor';
const cls='w-full min-w-0 rounded border border-slate-600 bg-slate-950 p-2 text-xs';
const blank=()=>({previousLeaseId:'',leaseId:'',tenantId:'',startDate:'',endDate:'',baseRent:'',sourceRef:'',adoptionDecisionRef:'',confirmed:false,signature:null});
export default function FutureLeaseEditor({operatingCase,onReplaceOperatingCase,dir}) {
 const ar=dir==='rtl',t=(a,b)=>ar?a:b,signature=JSON.stringify([operatingCase.leases,operatingCase.units,operatingCase.tenants]);
 const [draft,setDraft]=React.useState(blank),[feedback,setFeedback]=React.useState(null),[saving,setSaving]=React.useState(false),busy=React.useRef(false);
 const change=patch=>{setDraft(current=>({...current,...patch,confirmed:false,signature:current.signature??signature}));setFeedback(null);};
 const previous=operatingCase.leases.find(x=>x.leaseId===draft.previousLeaseId);
 const errors={FUTURE_LEASE_DUPLICATE_ID:t('معرّف العقد مستخدم.','Lease ID already exists.'),FUTURE_LEASE_DATES_INVALID:t('يجب أن يبدأ العقد بعد تاريخ الحالة وعند انتهاء السابق أو بعده، وينتهي بعد بدايته.','Start must be after the case date and on or after previous expiry; end must follow start.'),FUTURE_LEASE_OVERLAP:t('الفترة تتداخل مع عقد آخر للوحدة.','Period overlaps another lease for this unit.'),FUTURE_LEASE_STALE:t('تغيرت العقود؛ امسح المسودة وراجعها مجددًا.','Leases changed; clear and review the draft.'),EXPLICIT_VERIFICATION_CONFIRMATION_REQUIRED:t('أكّد مراجعة العقد بعد آخر تعديل.','Confirm review after the last edit.')};
 const submit=async e=>{
  e.preventDefault();if(busy.current)return;busy.current=true;setSaving(true);
  try {
   if(draft.signature!==signature)throw new Error('FUTURE_LEASE_STALE');
   const candidate=addDocumentedFutureLease(operatingCase,draft);
   if(typeof onReplaceOperatingCase!=='function')throw new Error('OPERATING_CASE_UPDATE_HANDLER_REQUIRED');
   const response=await onReplaceOperatingCase(candidate,'LEASE_UPDATED');
   if(response?.ok!==true)throw new Error(response?.code||'OPERATING_CASE_UPDATE_REJECTED');
   setDraft(blank());setFeedback({ok:true});
  }catch(error){setFeedback({ok:false,code:String(error.message||error).slice(0,160)});}
  finally{busy.current=false;setSaving(false);}
 };
 return <form onSubmit={submit} className="rounded-xl border border-slate-700 p-4" data-testid="future-lease-editor"><fieldset disabled={saving} className="min-w-0"><legend className="text-sm font-semibold">{t('إضافة عقد لاحق موثق للوحدة','Add documented successor lease')}</legend>
  <p className="my-2 text-xs leading-6 text-slate-300">{t('أضف عقدًا لاحقًا من مستنده، للمستأجر نفسه أو مستأجر مدرج آخر. يُحفظ العقد السابق وتظهر أي فجوة زمنية دون إيجار تعاقدي. مبلغ العقد الجديد ثابت حسب دورية العقد السابق؛ يمكن إدخال جدول مؤرخ له بعد الحفظ. لا تُنسخ ضمانات أو زيادات العقد السابق.','Add a successor lease from its document for the same or another listed tenant. The previous lease is retained; gaps have no contractual rent. New rent uses the previous frequency and starts fixed; a dated schedule can be added after saving. Previous security and escalations are not copied.')}</p>
  <p className="mb-3 text-xs leading-6 text-amber-200">{t('لا يفترض تجديدًا تلقائيًا أو إذن زيادة، ولا يثبت صحة العقد قانونيًا. لا يغير الإشغال الحالي أو الدراسة الرئيسية.','No automatic renewal, rent-increase permission or legal authentication. Current occupancy and the main study remain unchanged.')}</p>
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
   <label className="text-xs">{t('العقد السابق للوحدة','Previous unit lease')}<select data-testid="future-previous" required className={cls} value={draft.previousLeaseId} onChange={e=>change({previousLeaseId:e.target.value})}><option value="">—</option>{operatingCase.leases.filter(x=>x.endDate).map(x=><option data-user-content translate="no" key={x.leaseId} value={x.leaseId}>{x.leaseId}</option>)}</select></label>
   <label className="text-xs">{t('المستأجر المسجل','Listed tenant')}<select data-testid="future-tenant" required className={cls} value={draft.tenantId} onChange={e=>change({tenantId:e.target.value})}><option value="">—</option>{operatingCase.tenants.map(x=><option data-user-content translate="no" key={x.tenantId} value={x.tenantId}>{x.tenantId}</option>)}</select></label>
   {Object.entries({leaseId:[t('معرّف العقد الجديد','New lease ID'),'text'],startDate:[t('بداية العقد','Lease start'),'date'],endDate:[t('نهاية العقد غير شاملة','Exclusive lease end'),'date'],baseRent:[t('إيجار الفترة الجديدة','New periodic rent'),'number'],sourceRef:[t('مرجع العقد الجديد','New contract reference'),'text'],adoptionDecisionRef:[t('مرجع المراجعة المحلية','Local review reference'),'text']}).map(([key,[label,type]])=><label className="text-xs" key={key}>{label}{type==='number'?<NumericDraftInput data-testid={`future-${key}`} required className={cls} locale={dir==='rtl'?'ar-SA':'en'} min={0}  value={draft[key]} onChange={e=>change({[key]:e.target.value})}/>:<input data-testid={`future-${key}`} required className={cls} type={type}  value={draft[key]} onChange={e=>change({[key]:e.target.value})}/>}</label>)}
  </div>{previous&&<p className="mt-2 text-xs" data-user-content translate="no">{previous.unitId} · {previous.endDate} · {previous.baseRent.unit}</p>}
  <label className="flex items-start gap-2 my-3 text-xs"><input data-testid="future-confirm" type="checkbox" checked={draft.confirmed} onChange={e=>setDraft({...draft,confirmed:e.target.checked})}/>{t('راجعت العقد الجديد والمستأجر والتواريخ والمبلغ ومصدرها.','I reviewed the new lease, tenant, dates, amount and source.')}</label>
  <div className="flex flex-wrap gap-2"><button data-testid="future-save" type="submit" className="rounded border border-amber-700 p-2 text-xs">{t('حفظ العقد اللاحق','Save successor lease')}</button><button type="button" className="rounded border border-slate-600 p-2 text-xs" onClick={()=>{setDraft(blank());setFeedback(null);}}>{t('مسح المسودة','Clear draft')}</button></div>
 </fieldset>{feedback&&<p role="status" data-testid="future-feedback" data-diagnostic-content translate="no" className="mt-2 text-xs">{feedback.ok?t('تم حفظ العقد اللاحق.','Successor lease saved.'):<>{errors[feedback.code]||t('تعذر الحفظ؛ راجع بيانات العقد.','Save failed; review the lease inputs.')} <code dir="ltr">{feedback.code}</code></>}</p>}</form>;
}
