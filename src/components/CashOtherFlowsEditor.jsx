import React from 'react';
import {CASH_OTHER_FLOW_CATEGORIES} from '../residential-income-acquisition/cash-other-flows';
const cls='w-full min-w-0 rounded border border-slate-600 bg-slate-950 p-2 text-xs';
export const cashCategoryLabels={FINANCING:['التمويل: سحب وسداد وتكلفة','Financing: drawdown, repayment and cost'],TAX:['الضرائب: دفع واسترداد','Taxes: payment and refund'],DEPOSIT:['التأمينات: استلام ورد','Deposits: receipt and return'],FEES:['الرسوم والعمولات','Fees and commissions'],OTHER:['تدفقات أخرى','Other flows']};
export default function CashOtherFlowsEditor({value,onChange,dir}){
  const t=(a,b)=>dir==='rtl'?a:b;
  const resetReviews=categories=>value.categoryReviews.map(r=>categories.includes(r.category)?{...r,status:'NOT_REVIEWED'}:r);
  const edit=(i,patch)=>onChange({...value,entries:value.entries.map((e,n)=>n===i?{...e,...patch}:e),categoryReviews:resetReviews([value.entries[i].category,patch.category])});
  return <section className="space-y-3 rounded border border-slate-600 p-3" aria-label={t('التدفقات الأخرى ومراجعة التغطية','Other flows and coverage review')}>
    <h4>{t('التدفقات الأخرى بالريال','Other flows in SAR')}</h4>
    <p>{t('أدخل فقط التدفقات غير المدرجة في التحصيل الإيجاري أو خطط التشغيل والرأسمالي؛ راجع عدم ازدواجها. لا تُحسب الضريبة أو فوائد التمويل تلقائيًا. التأمين المستلم تدفق نقدي وليس إيراد إيجار، ويجب إدخال رده عند توقعه. مبالغ التمويل افتراضات ولا تثبت توفره.','Enter only flows absent from rent receipts and operating or capital plans; review for double-counting. Taxes and financing costs are not calculated automatically. A deposit received is a cash flow, not rental income; enter its return when expected. Financing amounts are assumptions and do not establish availability.')}</p>
    {value.entries.map((entry,i)=><div key={i} className="grid gap-2 rounded border border-slate-700 p-2 sm:grid-cols-2">
      <label>{t('البند','Category')}<select className={cls} data-testid={`cash-other-category-${i}`} required value={entry.category} onChange={e=>edit(i,{category:e.target.value})}><option value="">—</option>{CASH_OTHER_FLOW_CATEGORIES.map(category=><option key={category} value={category}>{t(...cashCategoryLabels[category])}</option>)}</select></label>
      <label>{t('الاتجاه','Direction')}<select className={cls} data-testid={`cash-other-direction-${i}`} value={entry.direction} onChange={e=>edit(i,{direction:e.target.value})}><option value="INFLOW">{t('داخل','Inflow')}</option><option value="OUTFLOW">{t('خارج','Outflow')}</option></select></label>
      <label>{t('التاريخ المتوقع','Expected date')}<input className={cls} data-testid={`cash-other-date-${i}`} type="date" required value={entry.date} onChange={e=>edit(i,{date:e.target.value})}/></label>
      <label>{t('المبلغ بالريال — موجب؛ الاتجاه يحدد الإشارة','Amount SAR — positive; direction determines sign')}<input className={cls} data-testid={`cash-other-amount-${i}`} required value={entry.amount} onChange={e=>edit(i,{amount:e.target.value})}/></label>
      <label>{t('وصف الحركة','Movement description')}<input className={cls} data-testid={`cash-other-description-${i}`} required maxLength={500} value={entry.description} onChange={e=>edit(i,{description:e.target.value})}/></label>
      <label>{t('مرجع فريد للحركة','Unique movement reference')}<input className={cls} data-testid={`cash-other-reference-${i}`} required maxLength={500} value={entry.reference} onChange={e=>edit(i,{reference:e.target.value})}/></label>
      <label>{t('مصدر المبلغ والتاريخ','Amount and date source')}<input className={cls} data-testid={`cash-other-source-${i}`} required maxLength={500} value={entry.sourceRef} onChange={e=>edit(i,{sourceRef:e.target.value})}/></label>
      <button data-testid={`cash-other-remove-${i}`} type="button" onClick={()=>onChange({...value,entries:value.entries.filter((_,n)=>i!==n),categoryReviews:resetReviews([entry.category])})}>{t('حذف الحركة','Remove movement')}</button>
    </div>)}
    <button data-testid="cash-other-add" type="button" disabled={value.entries.length>=2000} onClick={()=>onChange({...value,entries:[...value.entries,{category:'',direction:'OUTFLOW',date:'',amount:'',description:'',reference:'',sourceRef:''}]})}>{t('إضافة تدفق آخر','Add other flow')}</button>
    <p>{t('راجع كل بند للأفق نفسه. عدم المراجعة يظل ظاهرًا ولا يُعامل كصفر. «لا تدفقات متوقعة» افتراض صريح لهذا الأفق فقط. تعديل حركة يلغي مراجعة بندها والتأكيد حتى تعيد المراجعة.','Review each category for the same horizon. An unreviewed category remains visible and is not treated as zero. “None expected” is an explicit assumption for this horizon only. Editing a movement resets its category review and confirmation.')}</p>
    {value.categoryReviews.map(r=><label key={r.category} className="block">{t(...cashCategoryLabels[r.category])}<select className={cls} data-testid={`cash-category-review-${r.category}`} value={r.status} onChange={e=>onChange({...value,categoryReviews:value.categoryReviews.map(x=>x.category===r.category?{...x,status:e.target.value}:x)})}>
      <option value="NOT_REVIEWED">{t('لم يُراجع','Not reviewed')}</option><option value="ENTERED">{t('رُوجعت التدفقات المدخلة','Entered flows reviewed')}</option><option value="NONE_EXPECTED">{t('لا تدفقات متوقعة لهذا البند','No flows expected for this category')}</option>
    </select></label>)}
  </section>;
}
