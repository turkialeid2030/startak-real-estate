import React from 'react';
const labels={ACQUISITION:['شراء الأصل','Asset acquisition'],RENT_RECEIPT:['تحصيل إيجار مفترض','Assumed rent receipt'],OPERATING_PAYMENT:['دفعة تشغيل','Operating payment'],CAPITAL_PAYMENT:['دفعة رأسمالية','Capital payment'],TAX:['ضريبة مدخلة','Entered tax'],FEES:['رسوم مدخلة','Entered fee'],NET_SALE_PROCEEDS:['صافي البيع المفترض','Assumed net sale proceeds']};
export default function EnteredInvestmentReturnsPanel({result,dir}) {
  if(!result||result.status==='NOT_PROVIDED')return null;
  const ar=dir==='rtl',t=(a,b)=>ar?a:b;
  const number=n=>typeof n==='number'&&Number.isFinite(n)?n.toLocaleString(ar?'ar-SA':'en-US',{maximumFractionDigits:2}):t('غير متاح','Unavailable');
  return <details data-testid="cash-investment-returns" className="mt-3 rounded border border-slate-700 p-3 text-xs">
    <summary>{t('عائد السيناريو النقدي المدخل — غير ممول','Entered cash scenario return — unlevered')}</summary>
    <p className="my-2">{t('حساب مستقل بتواريخ المدخلات وفق الأيام الفعلية مقسومة على 365.2425 يومًا. لا يشمل الرصيد الافتتاحي أو التمويل أو التأمينات أو الاحتياطي أو الاستحقاقات أو التحصيل التاريخي. العوائد الرئيسية لم تتغير. المصادر وتغطية التكاليف وهوية الأصل غير متحققة مستقلًا؛ النتيجة ليست تفويضًا أو تقييمًا سوقيًا.','Independent dated calculation using ACT/365.2425. Excludes opening balance, financing, deposits, reserves, accruals, normalized expenses and historical collections. Main-study returns are unchanged. Sources, cost coverage and asset identity are not independently verified; this is not investment authority or a market valuation.')}</p>
    {result.status!=='CALCULATED_ENTERED_SCENARIO'?<p role="status">{t('العائد محجوب: أكمل الخطط المتطابقة ومراجعة التصنيفات، وافصل أي حركة «أخرى»، وتحقق من عدم وجود حركة عقارية بعد البيع.','Return withheld: complete matched plans and category reviews, classify OTHER movements, and check property flows after sale.')}</p>:<>
      <p>{result.exitValueIncluded?t('يتضمن صافي بيع مدخلًا صراحة؛ ليس تقديرًا تلقائيًا لقيمة التخارج.','Includes explicitly entered net sale proceeds, not an automatic exit valuation.'):t('لا بيع ولا قيمة أصل متبقية ضمن التدفقات؛ النتيجة تخص التدفقات الجزئية فقط.','No sale or retained asset value is included; the result covers partial flows only.')}</p>
      <p>{t('صافي القيمة الحالية بالريال','Dated NPV in SAR')}: <strong data-testid="cash-return-npv">{number(result.npvSar)}</strong></p>
      <p>{t('العائد السنوي المؤرخ','Dated annual return')}: <strong data-testid="cash-return-xirr">{result.xirr===null?t('غير متاح','Unavailable'):number(result.xirr*100)+'%'}</strong></p>
      <p>{t('معدل الخصم المدخل','Entered discount rate')}: {number(result.context.discountRate*100)}% · {t('مرجع الافتراض','Assumption source')}: <span data-user-content translate="no">{result.context.discountSourceRef}</span></p>
      <p>{t('مرجع المراجعة المحلية','Local review reference')}: <span data-user-content translate="no">{result.context.reviewRef}</span></p>
      {result.xirr===null&&<p>{t('لم تثبت قيمة وحيدة للعائد ضمن حدود الحل؛ لا يُفترض عائد صفري.','No unique qualified return was established within solver bounds; zero return is not assumed.')} <code data-diagnostic-content>{result.xirrDiagnostics?.blockers.join(' · ')}</code></p>}
      <div tabIndex={0} role="region" aria-label={t('التدفقات المستخدمة في العائد','Cash flows used in return')} className="mt-2 overflow-x-auto">
        <table className="w-full"><caption>{t('التدفقات المصدرية المستخدمة فقط — ريال سعودي','Only the sourced flows used — SAR')}</caption>
          <thead><tr>{[t('التاريخ','Date'),t('النوع','Type'),t('المبلغ','Amount'),t('مرجع المصدر','Source reference')].map(label=><th key={label} scope="col" className="p-2 text-start">{label}</th>)}</tr></thead>
          <tbody>{result.flows.map((flow,i)=><tr key={i}><td dir="ltr">{flow.date}</td><td>{labels[flow.kind]?.[ar?0:1]||flow.kind}</td><td>{number(flow.amountMinor/100)}</td><td data-user-content translate="no">{flow.sourceRef}</td></tr>)}</tbody>
        </table>
      </div>
    </>}
    {result.blockers.map(code=><p key={code} data-diagnostic-content><code>{code}</code></p>)}
  </details>;
}
