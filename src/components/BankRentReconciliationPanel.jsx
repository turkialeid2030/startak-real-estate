import React from 'react';
import {calculateBankRentReconciliation,replaceBankRentStatement} from '../residential-income-acquisition/bank-rent-reconciliation';
import {calculateReceivablesLedger} from '../residential-income-acquisition/receivables-ledger';
import {formatCashMinor} from '../residential-income-acquisition/cash-scenario';
const cls='w-full min-w-0 rounded border border-slate-600 bg-slate-950 p-2 text-xs';
export default function BankRentReconciliationPanel({operatingCase:c,onReplaceOperatingCase,dir}){
  const t=(a,b)=>dir==='rtl'?a:b,result=calculateBankRentReconciliation(c),ledger=calculateReceivablesLedger(c);
  const signature=JSON.stringify([c.bankRentStatement||null,c.receivablesLedger||null,c.leases,c.asOfDate]);
  const initial=()=>({periodStart:c.bankRentStatement?.periodStart||'',periodEndExclusive:c.bankRentStatement?.periodEndExclusive||'',accountRef:c.bankRentStatement?.accountRef||'',sourceRef:'',reviewRef:'',confirmed:false,signature,
    entries:(c.bankRentStatement?.entries||[]).map(e=>({...e,amount:formatCashMinor(e.amountMinor)}))});
  const [draft,setDraft]=React.useState(initial),[feedback,setFeedback]=React.useState(null),[saving,setSaving]=React.useState(false),busy=React.useRef(false);
  const change=patch=>{setDraft(d=>({...d,...patch,confirmed:false}));setFeedback(null);};
  const edit=(i,patch)=>change({entries:draft.entries.map((e,n)=>n===i?{...e,...patch}:e)});
  const submit=async e=>{
    e.preventDefault();if(busy.current)return;busy.current=true;setSaving(true);
    try{
      if(draft.signature!==signature)throw new Error('BANK_DRAFT_STALE');
      const candidate=replaceBankRentStatement(c,draft);
      if(typeof onReplaceOperatingCase!=='function')throw new Error('OPERATING_CASE_UPDATE_HANDLER_REQUIRED');
      const response=await onReplaceOperatingCase(candidate,'BANK_RENT_STATEMENT_UPDATED');
      if(response?.ok!==true)throw new Error(response?.code||'OPERATING_CASE_UPDATE_REJECTED');
      setDraft(d=>({...d,confirmed:false,sourceRef:'',reviewRef:'',signature:JSON.stringify([candidate.bankRentStatement,candidate.receivablesLedger||null,candidate.leases,candidate.asOfDate])}));setFeedback({ok:true});
    }catch(error){setFeedback({ok:false,code:String(error.message||error).slice(0,160)});}finally{busy.current=false;setSaving(false);}
  };
  const download=()=>{const u=URL.createObjectURL(new Blob([JSON.stringify({format:'STARTAK_BANK_RENT_RECONCILIATION',version:1,sourceOperatingCase:c,result},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download='bank-rent-reconciliation.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};
  return <section className="rounded border border-slate-700 p-3 text-xs space-y-3">
    <p>{t('مطابقة محلية لحركات إيجارية مدخلة من كشف حساب محدد، مع المقبوضات والمبالغ المردودة في سجل الحالة. يجب أن يتطابق التاريخ والمبلغ والاتجاه لكل حركة. لا اتصال بالبنك، ولا تحقق من أصالة الكشف أو اكتماله أو رصيد الحساب؛ الحركات الأخرى تحتاج مراجعة محاسبية منفصلة.','Local matching of entered rent statement movements against this case’s receipts and refunds. Date, amount and direction must match per movement. No bank connection, statement authentication, completeness or bank balance verification; other movements need separate accounting review.')}</p>
    <form onSubmit={submit}><fieldset disabled={saving} className="space-y-3 min-w-0"><legend>{t('إدخال الكشف والربط','Statement entry and links')}</legend>
      <div className="grid gap-2 sm:grid-cols-2">{[['periodStart',t('بداية الفترة','Period start')],['periodEndExclusive',t('نهاية الفترة غير المشمولة','Exclusive period end')],['accountRef',t('مرجع الحساب المحلي','Local account reference')],['sourceRef',t('مرجع الكشف','Statement source reference')],['reviewRef',t('مرجع المراجعة المحلية','Local review reference')]].map(([key,label])=><label key={key}>{label}<input data-testid={`bank-${key}`} className={cls} required maxLength={500} type={key.startsWith('period')?'date':'text'} value={draft[key]} onChange={e=>change({[key]:e.target.value})}/></label>)}</div>
      {draft.entries.map((entry,i)=><div key={i} className="grid gap-2 rounded border border-slate-700 p-2 sm:grid-cols-2">
        {[['id',t('معرف حركة الكشف','Statement movement ID')],['reference',t('مرجع حركة الكشف','Statement movement reference')],['date',t('تاريخ الحركة','Movement date')],['amount',t('المبلغ بالريال','Amount in SAR')]].map(([key,label])=><label key={key}>{label}<input data-testid={`bank-${key}-${i}`} className={cls} required maxLength={500} type={key==='date'?'date':'text'} inputMode={key==='amount'?'decimal':undefined} value={entry[key]} onChange={e=>edit(i,{[key]:e.target.value})}/></label>)}
        <label>{t('الاتجاه','Direction')}<select data-testid={`bank-direction-${i}`} className={cls} value={entry.direction} onChange={e=>edit(i,{direction:e.target.value,ledgerEventId:''})}><option value="CREDIT">{t('إيداع / مقبوض','Credit / receipt')}</option><option value="DEBIT">{t('خصم / مبلغ مردود','Debit / refund')}</option></select></label>
        <label>{t('القيد المقابل','Matching ledger entry')}<select data-testid={`bank-link-${i}`} className={cls} value={entry.ledgerEventId||''} onChange={e=>edit(i,{ledgerEventId:e.target.value})}><option value="">{t('غير مرتبط — للمراجعة','Unlinked — review needed')}</option>{(entry.direction==='CREDIT'?ledger.receiptRows:ledger.refundRows).map(x=><option key={x.id} value={x.id}>{x.id} — {x.date} — {formatCashMinor(x.amountMinor)}</option>)}</select></label>
        <button type="button" onClick={()=>change({entries:draft.entries.filter((_,n)=>n!==i)})}>{t('حذف سطر المسودة','Remove draft row')}</button>
      </div>)}
      <button data-testid="bank-add" type="button" onClick={()=>change({entries:[...draft.entries,{id:'',reference:'',date:'',amount:'',direction:'CREDIT',ledgerEventId:''}]})}>{t('إضافة حركة كشف','Add statement movement')}</button>
      <label className="flex gap-2"><input data-testid="bank-confirm" type="checkbox" checked={draft.confirmed} onChange={e=>setDraft({...draft,confirmed:e.target.checked})}/>{t('راجعت الكشف والفترة والربط وحدود النطاق. الكشف الفارغ يعني تصريحًا بعدم وجود حركات في البيانات المدخلة فقط.','I reviewed the statement, period, links and scope limits. Empty entries declare no movements in supplied data only.')}</label>
      <button data-testid="bank-save" type="submit" className="rounded border p-2">{t('حفظ وإعادة المطابقة','Save and reconcile')}</button> <button type="button" onClick={()=>{setDraft(initial());setFeedback(null);}}>{t('إعادة تحميل المسودة','Reload draft')}</button>
    </fieldset></form>
    {feedback&&<p data-testid="bank-feedback" role="status" data-diagnostic-content translate="no">{feedback.ok?t('تم حفظ الكشف وإعادة المطابقة.','Statement saved and reconciled.'):<>{t('تعذر الحفظ؛ راجع المدخلات والتأكيد أو أعد تحميل المسودة.','Save failed; review inputs and confirmation or reload the draft.')} <code>{feedback.code}</code></>}</p>}
    <p data-testid="bank-status">{result.status==='MATCHED_ENTERED_RENT_MOVEMENTS'?t('مطابقة الحركات الإيجارية المدخلة فقط','Entered rent movements matched'):result.status==='NOT_AVAILABLE'?t('لم يسجل كشف للمطابقة','No statement recorded'):t('فروق أو حركات تحتاج مراجعة','Differences or movements need review')}</p>
    <div className="overflow-x-auto"><table className="w-full"><thead><tr>{[t('الحركة','Movement'),t('القيد','Ledger entry'),t('الكشف','Statement'),t('السجل','Ledger'),t('الحالة','Status')].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{result.rows.map(row=><tr key={row.id}><td data-user-content translate="no">{row.id}</td><td data-user-content translate="no">{row.ledgerEventId||'—'}</td><td>{formatCashMinor(row.amountMinor)}</td><td>{row.ledgerAmountMinor===null?'—':formatCashMinor(row.ledgerAmountMinor)}</td><td data-diagnostic-content translate="no"><code>{row.status}</code></td></tr>)}</tbody></table></div>
    {result.totalsMinor&&<p>{t('فرق الإيداعات / فرق المردودات بالهللة','Credit / refund differences in halalas')}: {result.totalsMinor.creditDifference} / {result.totalsMinor.debitDifference}</p>}
    <p>{t('قيود السجل غير المطابقة','Unmatched ledger entries')}: <span data-user-content translate="no">{result.unmatchedLedgerIds.join(', ')||'—'}</span></p>
    <button data-testid="bank-export" type="button" onClick={download}>{t('تصدير المطابقة ومصادرها','Export reconciliation and sources')}</button>
  </section>;
}
