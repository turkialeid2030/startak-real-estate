import React from 'react';
import {appendReceivablesEvent,calculateReceivablesLedger} from '../residential-income-acquisition/receivables-ledger';

const fieldClass='w-full min-w-0 rounded border border-slate-600 bg-slate-950 p-2 text-xs';
const blank=()=>({type:'CHARGE',id:'',date:'',leaseId:'',reference:'',amount:'',periodStart:'',periodEndExclusive:'',dueDate:'',chargeId:'',receiptId:'',targetId:'',reason:'',sourceRef:'',reviewRef:'',confirmed:false,signature:null});
export default function ReceivablesLedgerPanel({operatingCase,onReplaceOperatingCase,dir}) {
  const ar=dir==='rtl',t=(a,b)=>ar?a:b;
  const result=React.useMemo(()=>calculateReceivablesLedger(operatingCase),[operatingCase]);
  const signature=JSON.stringify([operatingCase.receivablesLedger||null,operatingCase.leases]);
  const [draft,setDraft]=React.useState(blank),[feedback,setFeedback]=React.useState(null),[saving,setSaving]=React.useState(false);
  const busy=React.useRef(false);
  const change=patch=>{setDraft(current=>({...current,...patch,confirmed:false,signature:current.signature??signature}));setFeedback(null);};
  const money=minor=>minor==null?'—':(minor/100).toLocaleString(ar?'ar-SA':'en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const types={CHARGE:t('مستحق إيجار','Rent charge'),RECEIPT:t('دفعة مقبوضة','Receipt'),ALLOCATION:t('تخصيص دفعة','Payment allocation'),CREDIT:t('تخفيض مستحق موثق','Documented charge reduction'),REFUND:t('تسجيل مبلغ مردود','Record completed refund'),REVERSAL:t('عكس قيد خاطئ','Reverse incorrect entry')};
  const errors={
    LEDGER_OVERCREDIT:t('التخفيض يتجاوز المتبقي غير المسدد. راجع التخصيصات أولًا.','Reduction exceeds the unpaid balance. Review allocations first.'),
    LEDGER_CREDIT_REFERENCE_INVALID:t('اختر مستحقًا أصليًا قائمًا لربط التخفيض به.','Select an active original charge.'),
    LEDGER_REVERSE_CREDITS_FIRST:t('يوجد تخفيض نشط؛ صحح قيوده أولًا إذا كانت خاطئة قبل عكس المستحق.','An active reduction exists; correct its entries first if incorrect before reversing the charge.'),
    LEDGER_OVERREFUND:t('المبلغ المردود يتجاوز الرصيد غير المخصص من الدفعة.','Refund exceeds the unallocated receipt balance.'),
    LEDGER_REFUND_REFERENCE_INVALID:t('اختر دفعة أصلية قائمة لربط المبلغ المردود بها.','Select an active original receipt.'),
    LEDGER_REVERSE_REFUNDS_FIRST:t('اعكس قيود الرد المرتبطة أولًا إذا كانت خاطئة؛ عكس السجل لا يسترد المال.','Correct related refund entries first if incorrect; reversal does not recover cash.'),
    EXPLICIT_VERIFICATION_CONFIRMATION_REQUIRED:t('أكّد مراجعة القيد بعد آخر تعديل.','Confirm review after the last edit.'),
    LEDGER_OVERALLOCATION:t('المبلغ يتجاوز المتبقي في المستحق أو الدفعة.','Amount exceeds the charge or receipt balance.'),
    LEDGER_CROSS_LEASE_ALLOCATION:t('يجب أن ينتمي المستحق والدفعة إلى العقد نفسه.','Charge and receipt must belong to the same lease.'),
    LEDGER_REVERSE_ALLOCATIONS_FIRST:t('اعكس تخصيصات القيد أولًا قبل عكس المستحق أو الدفعة.','Reverse allocations before reversing the charge or receipt.'),
    LEDGER_DUPLICATE_ID:t('معرّف القيد مستخدم سابقًا.','Entry ID already exists.'),
    LEDGER_DUPLICATE_REFERENCE:t('مرجع المستند مسجل سابقًا؛ لا تسجل المبلغ مرتين.','Document reference already exists; do not enter it twice.'),
    LEDGER_OVERLAPPING_CHARGES:t('تتداخل فترة المستحق مع قيد إيجار قائم للعقد.','Charge period overlaps another active charge for this lease.'),
    LEDGER_PERIOD_OUTSIDE_LEASE:t('يجب أن تكون الفترة داخل العقد، ونهايتها غير شاملة.','Period must lie within the lease; the end is exclusive.'),
    LEDGER_FUTURE_EVENT:t('تاريخ القيد يتجاوز تاريخ الحالة. غيّر تاريخ الحالة فقط بأدلة مناسبة.','Entry date exceeds the case as-of date.'),
    LEDGER_EVENT_CHRONOLOGY:t('التاريخ يسبق القيد المرجعي أو حركة مرتبطة بالرد أو التخفيض.','Date precedes the source entry or a related refund or reduction movement.'),
    LEDGER_AMOUNT_INVALID:t('أدخل مبلغًا موجبًا بمنزلتين عشريتين كحد أقصى.','Enter a positive amount with at most two decimals.'),
    LEDGER_DISTINCT_REVIEW_REQUIRED:t('مرجع المراجعة يجب أن يختلف عن مرجع المستند.','Review reference must differ from source reference.'),
    LEDGER_DRAFT_STALE:t('تغير العقد أو السجل. امسح المسودة وأعد مراجعتها.','Lease or ledger changed. Clear the draft and review again.'),
  };
  const submit=async e=>{
    e.preventDefault();if(busy.current)return;busy.current=true;setSaving(true);
    try {
      if(draft.signature!==signature)throw new Error('LEDGER_DRAFT_STALE');
      const candidate=appendReceivablesEvent(operatingCase,draft);
      if(typeof onReplaceOperatingCase!=='function')throw new Error('OPERATING_CASE_UPDATE_HANDLER_REQUIRED');
      const response=await onReplaceOperatingCase(candidate,'LEDGER_UPDATED');
      if(response?.ok!==true)throw new Error(response?.code||'OPERATING_CASE_UPDATE_REJECTED');
      setDraft(blank());setFeedback({ok:true});
    }catch(error){setFeedback({ok:false,code:String(error.message||error).slice(0,160)});}
    finally{busy.current=false;setSaving(false);}
  };
  const download=()=>{
    const url=URL.createObjectURL(new Blob([JSON.stringify({format:'STARTAK_RECEIVABLES_LEDGER',version:1,sourceOperatingCase:operatingCase,result},null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='receivables-ledger.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const input=(key,label,type='text')=><label className="block min-w-0 text-xs" key={key}>{label}<input className={fieldClass} data-testid={`ledger-${key}`} type={type} required value={draft[key]} onChange={e=>change({[key]:e.target.value})} {...(type==='number'?{min:'0.01',step:'0.01'}:{})}/></label>;
  const select=(key,label,options)=><label className="block min-w-0 text-xs" key={key}>{label}<select className={fieldClass} data-testid={`ledger-${key}`} required value={draft[key]} onChange={e=>change({[key]:e.target.value})}><option value="">—</option>{options.map(([id,label])=><option data-user-content translate="no" key={id} value={id}>{label}</option>)}</select></label>;
  const entries=operatingCase.receivablesLedger?.events||[];
  const active=entries.filter(e=>e.type!=='REVERSAL'&&!result.reversedIds.includes(e.id));
  return <section className="rounded-xl border border-slate-700 p-4" data-testid="receivables-ledger">
    <h3 className="text-sm font-semibold">{t('سجل المستحقات والقبض','Charges and receipts register')}</h3>
    <p className="my-2 text-xs leading-6">{t('التخفيض الموثق يقلل المديونية فقط ولا يثبت قبضًا أو ردًا نقديًا. يلزم مستند وسبب ومرجع مراجعة، ولا يصدر هذا السجل إشعارًا دائنًا ضريبيًا أو يمنح صلاحية إسقاط دين. لتخفيض جزء مسدد، راجع تخصيصه أولًا؛ ولا تُعدّل قيمة العقد تلقائيًا.','A documented reduction lowers the receivable only; it is not a receipt or cash refund. A document, reason and review reference are required. This register does not issue tax credit notes or grant debt-waiver authority. Review allocations before reducing paid amounts; lease terms are not automatically changed.')}</p>
    <p className="my-2 text-xs leading-6">{t('تسجيل الرد يوثق مبلغًا أُعيد بالفعل من دفعة أصلية، ولا ينفذ تحويلًا بنكيًا أو يلغي المستحق. المبلغ المخصص لا يتاح للرد قبل عكس تخصيصه؛ عكس التخصيص يعيد المديونية. أدخل الحركات المرتبطة بالرد بترتيب تواريخها.','A refund entry documents money already returned from an original receipt; it does not execute a bank transfer or cancel a charge. Reverse an allocation before refunding its amount; this reopens the debt. Enter refund-related movements in date order.')}</p>
    <p className="my-2 text-xs leading-6 text-slate-300">{t('سجّل مستحقات الإيجار الصافية والدفعات الفعلية من مستنداتها، ثم خصّص الدفعة للمستحق. لا يُستنتج القبض من الإيجار المتوقع. لا يشمل السجل الضرائب والتأمينات والرسوم، ولا يصدر فاتورة ضريبية.','Enter net rent charges and actual receipts from their documents, then allocate receipts to charges. Expected rent is not received cash. Taxes, deposits and fees are excluded; this register does not issue tax invoices.')}</p>
    <p className="mb-3 text-xs leading-6 text-amber-200">{t('السجل محلي وضمن القيود المدخلة فقط؛ لا يثبت اكتمال الحساب أو صحة المستند أو هوية المراجع. يُعرض منفصلًا عن مجاميع التحصيل السابقة ولا يُجمع معها. عكس القيد تصحيح للسجل وليس ردًا نقديًا.','This local register covers entered records only; it does not establish completeness, source authenticity or reviewer identity. It remains separate from period collection aggregates. Reversal corrects an entry and is not a cash refund.')}</p>
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4 text-xs mb-3">
      {Object.entries({charged:t('إجمالي المستحقات الأصلية','Gross original charges'),credited:t('التخفيضات الموثقة','Documented reductions'),netCharged:t('صافي المستحقات بعد التخفيض','Net charges after reductions'),received:t('إجمالي القبض المسجل','Gross recorded receipts'),refunded:t('المبالغ المردودة','Recorded refunds'),netReceived:t('صافي القبض بعد الرد','Net receipts after refunds'),outstanding:t('المتبقي غير المسدد','Outstanding charges'),unallocated:t('قبض متاح غير مخصص','Available unallocated receipts')}).map(([key,label])=><div className="rounded bg-slate-950 p-2" key={key}><p>{label}</p><strong data-testid={`ledger-total-${key}`}>{money(result.totalsMinor?.[key])}</strong></div>)}
    </div>
    {result.totalsMinor&&<div className="grid grid-cols-2 gap-2 md:grid-cols-3 text-xs mb-3">{Object.entries({notDue:t('لم يستحق بعد','Not yet due'),dueToday:t('مستحق اليوم','Due today'),days1to30:t('متأخر 1–30 يومًا','1–30 days overdue'),days31to60:t('متأخر 31–60 يومًا','31–60 days overdue'),days61to90:t('متأخر 61–90 يومًا','61–90 days overdue'),daysOver90:t('متأخر أكثر من 90 يومًا','Over 90 days overdue')}).map(([key,label])=><p key={key}>{label}: {money(result.agingMinor[key])}</p>)}</div>}
    <form onSubmit={submit}>
      <fieldset disabled={saving} className="min-w-0">
        <legend className="mb-2 text-xs">{t('إضافة قيد موثق — المبالغ بالريال','Add documented entry — amounts in SAR')}</legend>
        <label className="block text-xs">{t('نوع القيد','Entry type')}<select data-testid="ledger-type" className={fieldClass} value={draft.type} onChange={e=>{setDraft({...blank(),type:e.target.value,signature});setFeedback(null);}}>{Object.entries(types).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 my-3">
          {input('id',t('معرّف قيد فريد','Unique entry ID'))}{input('date',t('تاريخ القيد أو القبض','Entry or receipt date'),'date')}
          {['CHARGE','RECEIPT'].includes(draft.type)&&<>{select('leaseId',t('العقد','Lease'),operatingCase.leases.map(l=>[l.leaseId,l.leaseId]))}{input('reference',t('رقم المستند أو العملية الفريد','Unique document or transaction reference'))}</>}
          {draft.type==='CHARGE'&&<>{input('periodStart',t('بداية فترة الإيجار','Rent period start'),'date')}{input('periodEndExclusive',t('نهاية الفترة غير شاملة','Exclusive period end'),'date')}{input('dueDate',t('تاريخ الاستحقاق','Due date'),'date')}</>}
          {draft.type==='ALLOCATION'&&<>{select('chargeId',t('المستحق','Charge'),result.chargeRows.filter(x=>x.outstandingMinor>0).map(x=>[x.id,`${x.id} · ${money(x.outstandingMinor)}`]))}{select('receiptId',t('الدفعة','Receipt'),result.receiptRows.filter(x=>x.unallocatedMinor>0).map(x=>[x.id,`${x.id} · ${money(x.unallocatedMinor)}`]))}</>}
          {draft.type==='REFUND'&&<>{select('receiptId',t('الدفعة الأصلية — الرصيد المتاح للرد','Original receipt — refundable balance'),result.receiptRows.filter(x=>x.unallocatedMinor>0).map(x=>[x.id,`${x.id} · ${money(x.unallocatedMinor)}`]))}{input('reference',t('مرجع عملية الرد الفريد','Unique refund transaction reference'))}{input('reason',t('سبب الرد','Refund reason'))}</>}
          {draft.type==='CREDIT'&&<>{select('chargeId',t('المستحق الأصلي — المتبقي غير المسدد','Original charge — unpaid balance'),result.chargeRows.filter(x=>x.outstandingMinor>0).map(x=>[x.id,`${x.id} · ${money(x.outstandingMinor)}`]))}{input('reference',t('مرجع مستند التخفيض الفريد','Unique reduction document reference'))}{input('reason',t('سبب التخفيض','Reduction reason'))}</>}
          {draft.type==='REVERSAL'?<>{select('targetId',t('القيد المطلوب عكسه','Entry to reverse'),active.map(x=>[x.id,x.id]))}{input('reason',t('سبب التصحيح','Correction reason'))}</>:input('amount',t('المبلغ بالريال','Amount in SAR'),'number')}
          {input('sourceRef',t('مرجع المصدر','Source reference'))}{input('reviewRef',t('مرجع المراجعة المحلية','Local review reference'))}
        </div>
        <label className="flex items-start gap-2 text-xs leading-5"><input type="checkbox" data-testid="ledger-confirm" checked={draft.confirmed} onChange={e=>setDraft({...draft,confirmed:e.target.checked})}/>{t('راجعت المستند والمبلغ والتاريخ والعقد والتخصيص، وأقر بحدود المراجعة المحلية.','I reviewed the document, amount, date, lease and allocation, within the limits of local review.')}</label>
        <div className="flex flex-wrap gap-2 my-3"><button type="submit" data-testid="ledger-save" className="rounded border border-amber-700 p-2 text-xs">{t('حفظ القيد','Save entry')}</button><button type="button" className="rounded border border-slate-600 p-2 text-xs" onClick={()=>{setDraft(blank());setFeedback(null);}}>{t('مسح المسودة','Clear draft')}</button></div>
      </fieldset>
    </form>
    {feedback&&<p role="status" data-testid="ledger-feedback" data-diagnostic-content translate="no" className="my-2 text-xs">{feedback.ok?t('تم حفظ القيد.','Entry saved.'):<>{errors[feedback.code]||t('تعذر الحفظ؛ راجع المراجع والحقول.','Save failed; check references and fields.')} <code dir="ltr">{feedback.code}</code></>}</p>}
    <details className="text-xs"><summary>{t('القيود وسجل التصحيحات','Entries and corrections')} ({entries.length})</summary><div className="max-h-72 overflow-auto"><table className="w-full text-xs"><thead><tr><th>{t('القيد','Entry')}</th><th>{t('النوع','Type')}</th><th>{t('التاريخ','Date')}</th><th>{t('المبلغ','Amount')}</th><th>{t('الحالة','Status')}</th></tr></thead><tbody>{entries.map(e=><tr key={e.id}><td className="break-all" data-user-content translate="no">{e.id}</td><td>{types[e.type]}</td><td>{e.date}</td><td>{money(e.amountMinor)}</td><td>{result.reversedIds.includes(e.id)?t('معكوس','Reversed'):t('مسجل','Recorded')}</td></tr>)}</tbody></table></div></details>
    <button type="button" data-testid="ledger-export" onClick={download} className="mt-3 rounded border border-slate-600 p-2 text-xs">{t('تصدير السجل والأرصدة والمصادر','Export register, balances and sources')}</button>
  </section>;
}
