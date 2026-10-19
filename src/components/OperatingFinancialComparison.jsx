import React from 'react';

export default function OperatingFinancialComparison({ operatingReport, locale = 'ar-SA' }) {
  if (!operatingReport) return null;
  const en = locale === 'en';
  const t = (ar, english) => en ? english : ar;
  const money = n => typeof n === 'number' && Number.isFinite(n)
    ? n.toLocaleString(en ? 'en-US' : 'ar-SA', { maximumFractionDigits: 2 }) : t('غير متاح', 'Unavailable');
  const horizon = operatingReport.horizonReconciliation;
  const years = horizon?.years || [];
  const title = t('مقارنة التشغيل مع الدراسة المالية', 'Operating and financial study comparison');
  const tables = [
    { caption: t('أساس الاستحقاق السنوي — ريال سعودي', 'Annual accrual basis — SAR'),
      headers: [t('السنة', 'Year'), t('إيجار العقود', 'Contract rent'), t('المصروف دون الاحتياطي', 'OPEX before reserve'), t('الصافي قبل الاحتياطي والإنفاق', 'Net before reserve and CAPEX')],
      keys: ['contractRent', 'normalizedOpex', 'netBeforeReserveAndCapex'] },
    { caption: t('الاحتياطي والإنفاق منفصلان — ريال سعودي', 'Reserve and capital spending shown separately — SAR'),
      headers: [t('السنة', 'Year'), t('الاحتياطي المسجل', 'Recorded reserve'), t('الإنفاق الرأسمالي', 'Scheduled CAPEX'), t('الصافي بعد الإنفاق وقبل الاحتياطي', 'Net after CAPEX before reserve'), t('صافي النموذج بعد الاحتياطي', 'Model NOI after reserve')],
      keys: ['sourceReplacementReserve', 'scheduledCapex', 'netAfterScheduledCapexBeforeReserve', 'modelNoiAfterReserve'] },
  ];
  return <details data-testid="operating-financial-comparison" className="mt-4 rounded-xl border border-slate-700 p-3 text-xs text-slate-200">
    <summary className="cursor-pointer font-semibold">{title}</summary>
    <p className="mt-3 leading-6">{t(
      'تُقارن العقود المسجلة والمصروفات المعيارية بالدراسة الحالية على فترات سنوية متطابقة. لا يُفترض تجديد العقود، وتبقى المصروفات المعيارية ثابتة. التحصيل التاريخي وخطة الرصيد النقدي لا يُضافان إلى صافي الاستحقاق. الاحتياطي والإنفاق الرأسمالي معروضان منفصلين؛ عوائد الدراسة المجمعة لم تتغير. تطابق هوية الأصل وصحة المصادر لم يتحققا مستقلًا.',
      'Entered leases and flat normalized expenses are compared with the current study over identical annual periods. Renewals are not assumed. Historical collections and the cash-balance plan are not added to accrual net income. Reserve and CAPEX are separate; aggregate study returns are unchanged. Asset identity and source validity have not been independently verified.')}</p>
    {!years.length ? <p role="status" className="mt-2 text-amber-200">{t(
      'المقارنة غير متاحة. طابق بداية تقويم الدراسة مع تاريخ الحالة، واستكمل بيانات المصروفات والاحتياطي وفترات الدراسة.',
      'Comparison is unavailable. Align the study calendar start with the case date and complete expense, reserve and annual-period inputs.')}</p> : <>
      <p data-testid="operating-financial-comparison-status" className="mt-2">{horizon.status === 'ARITHMETIC_HORIZON_COMPLETE'
        ? t('اكتملت التسوية الحسابية للسنوات المعروضة؛ ليست تحققًا من المصادر أو اعتمادًا استثماريًا.', 'Arithmetic reconciliation is complete for the displayed years; this is not source verification or investment approval.')
        : t('التسوية جزئية؛ تبقى القيم غير المتاحة دون افتراض صفر.', 'Reconciliation is partial; unavailable amounts are not assumed to be zero.')}</p>
      {tables.map(table => <div key={table.caption} tabIndex={0} role="region" aria-label={table.caption} className="mt-3 max-w-full overflow-x-auto">
        <table className="w-full text-start">
          <caption className="py-2 text-start">{table.caption}</caption>
          <thead><tr>{table.headers.map(label => <th key={label} scope="col" className="p-2 text-start">{label}</th>)}</tr></thead>
          <tbody>{years.map(year => <tr key={year.year} className="border-t border-slate-700">
            <th scope="row" className="p-2 text-start">{year.year}</th>
            {table.keys.map(key => <td key={key} className="p-2">{money(year[key])}</td>)}
          </tr>)}</tbody>
        </table>
      </div>)}
    </>}
  </details>;
}
