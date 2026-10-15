import React from 'react';
import {formatCashMinor} from '../residential-income-acquisition/cash-scenario';
import {cashCategoryLabels} from './CashOtherFlowsEditor';
export default function CashOtherFlowsSummary({coverage,dir}){
  if(!coverage)return null;
  const t=(a,b)=>dir==='rtl'?a:b;
  const labels={NOT_REVIEWED:t('لم يُراجع','Not reviewed'),ENTERED:t('رُوجعت التدفقات المدخلة','Entered flows reviewed'),NONE_EXPECTED:t('لا تدفقات متوقعة — افتراض صريح','None expected — explicit assumption')};
  return <div className="my-3 rounded border border-slate-600 p-3" data-testid="cash-other-coverage">
    <p data-testid="cash-other-review-status">{coverage.status==='REVIEW_DECLARED'?t('أُعلنت مراجعة جميع بنود التدفقات الأخرى','Review declared for all additional flow categories'):t('مراجعة التدفقات الأخرى غير مكتملة','Additional flow review incomplete')} ({coverage.reviewedCategoryCount}/{coverage.totalCategories})</p>
    <p>{t('تصريح المستخدم للأفق المحدد؛ لا يثبت اكتمال المخزون أو صحة المصادر أو المعالجة الضريبية أو توفر التمويل. البنود غير المراجعة ليست صفرًا مؤكدًا. عند إتاحة الحساب تدخل المبالغ المؤهلة في الرصيد وفحص العجز، والتأمينات ليست إيراد إيجار.','User declaration for this horizon; it does not verify completeness, sources, tax treatment or financing availability. Unreviewed categories are not confirmed zero. When calculation is available, eligible amounts enter the balance and shortfall check; deposits are not rental income.')}</p>
    <div className="overflow-x-auto"><table className="w-full"><thead><tr>{[t('البند','Category'),t('المراجعة','Review'),t('عدد الحركات','Movement count'),t('داخل بالريال','Inflows SAR'),t('خارج بالريال','Outflows SAR')].map(x=><th className="p-2 text-start" key={x}>{x}</th>)}</tr></thead><tbody>{coverage.categories.map(row=><tr key={row.category}><td>{t(...cashCategoryLabels[row.category])}</td><td>{labels[row.reviewStatus]}</td><td>{row.entryCount}</td><td>{formatCashMinor(row.inflowsMinor)}</td><td>{formatCashMinor(row.outflowsMinor)}</td></tr>)}</tbody></table></div>
  </div>;
}
