import React from 'react';
import {calculateLeaseCalendar} from '../residential-income-acquisition/lease-calendar';
export default function LeaseCalendarPanel({operatingCase:c,dir}){
  const t=(a,b)=>dir==='rtl'?a:b,r=calculateLeaseCalendar(c);
  const actions={REVIEW_DECLARED_STATE:t('مراجعة حالة العقد المسجلة','Review declared lease state'),REVIEW_START_WITHIN_90_DAYS:t('بدء العقد خلال 90 يومًا — راجع التسليم','Starts within 90 days — review handover'),REVIEW_END_WITHIN_90_DAYS:t('انتهاء خلال 90 يومًا — راجع خيارات المتابعة','Ends within 90 days — review follow-up options'),NO_NEAR_MILESTONE:t('لا موعد قريب ضمن 90 يومًا','No milestone within 90 days')};
  const download=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({format:'STARTAK_LEASE_CALENDAR',version:1,sourceOperatingCase:c,result:r},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='lease-calendar.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  return <section data-testid="lease-calendar" className="rounded border border-slate-700 p-3 text-xs space-y-3">
    <h3>{t('متابعة مواعيد العقود والفترات غير المغطاة','Lease dates and uncovered periods')}</h3>
    <p>{t('المواعيد محسوبة من تاريخ الحالة لا من ساعة الجهاز. نهاية العقد غير مشمولة. الفترة غير المغطاة تعني عدم وجود عقد مؤهل مدخل، ولا تثبت شغورًا فعليًا أو خسارة دخل. لا تجديد تلقائي أو تغيير لحالة العقد أو إرسال إشعار قانوني.','Dates use the case date, not the device clock. Lease ends are exclusive. Uncovered periods mean no supplied qualifying contract, not actual vacancy or lost income. No automatic renewal, lease-state change or legal notice delivery.')}</p>
    <p data-testid="lease-calendar-status">{r.status==='DERIVED_DOCUMENTED_CALENDAR'?t('متابعة مشتقة من العقود المدخلة فقط','Calendar derived from entered leases only'):t('يلزم مراجعة العقود قبل حساب التغطية','Review leases before calculating coverage')}</p>
    {r.issues.map((x,i)=><p key={i} data-diagnostic-content translate="no"><code>{x.code} {x.refId}</code></p>)}
    <div className="overflow-x-auto"><table className="w-full"><thead><tr>{[t('العقد','Lease'),t('الوحدة','Unit'),t('بداية العقد','Start'),t('النهاية غير المشمولة','Exclusive end'),t('أيام حتى النهاية','Days to end'),t('إجراء المتابعة','Follow-up')].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{r.leaseRows.map(x=><tr key={x.leaseId}><td data-user-content translate="no">{x.leaseId}</td><td data-user-content translate="no">{x.unitId}</td><td dir="ltr">{x.startDate}</td><td dir="ltr">{x.endDateExclusive}</td><td>{x.daysToEnd}</td><td>{actions[x.actionCode]}</td></tr>)}</tbody></table></div>
    <p>{t('مجموع أيام الوحدات غير المغطاة بعقد مؤهل','Total unit-days without qualifying contract coverage')}: <strong data-testid="lease-calendar-uncovered">{r.totalUncoveredUnitDays??'—'}</strong></p>
    {r.unitRows.map(u=><div key={u.unitId}><span data-user-content translate="no">{u.unitId}</span>: {u.uncoveredDays} {t('يومًا','days')}{u.gaps.map(g=><p key={g.start} dir="ltr">{g.start} — {g.endExclusive} ({g.days})</p>)}</div>)}
    <p>{t('العقود المستبعدة لتصريح الانتهاء أو الإنهاء','Excluded declared expired or terminated leases')}: <span data-user-content translate="no">{r.excludedLeaseIds.join(', ')||'—'}</span></p>
    <button data-testid="lease-calendar-export" type="button" onClick={download}>{t('تصدير المتابعة ومصادرها','Export calendar and sources')}</button>
  </section>;
}
