import React from 'react';
const { paybackDisclosure } = require('../app/payback-disclosure');

export default function PaybackDisclosurePanel({ mode, results, locale = 'ar-SA' }) {
  const ar = locale !== 'en', p = paybackDisclosure(mode, results);
  const years = value => value == null ? (ar ? 'غير متحقق ضمن الأفق المحدد' : 'Not recovered within the stated horizon')
    : value.toLocaleString(ar ? 'ar-SA' : 'en-US', { maximumFractionDigits: 2 }) + (ar ? ' سنة' : ' years');
  const rows = [
    [ar ? 'استرداد بسيط: إجمالي التكلفة ÷ صافي دخل أول سنة تشغيل' : 'Simple recovery: total cost / first operating-year NOI', p.simpleCostOverFirstOperatingNoiYears],
    [ar ? 'استرداد تشغيلي تراكمي خلال مدة الدراسة' : 'Cumulative operating recovery within the study', p.cumulativeOperatingWithinStudyYears],
    [ar ? 'استرداد تراكمي مع حصيلة البيع في نهاية السنة' : 'Cumulative recovery including end-of-year sale', p.cumulativeWithTerminalSaleYears],
  ];
  return <section data-testid="payback-disclosure" className="my-4 rounded-xl border border-slate-700 p-4 text-xs text-slate-300">
    <h3 className="mb-3 font-semibold text-slate-100">{ar ? 'تفسير فترات الاسترداد' : 'Recovery periods explained'}</h3>
    <p className="mb-3">{ar ? 'المؤشر التشغيلي الرئيسي يستبعد بيع الأصل. أفق الحساب: ' : 'The main operating recovery metric excludes asset sale. Calculation horizon: '}
      {years(p.engineOperatingHorizonYears)}{ar ? '؛ مدة الدراسة: ' : '; study horizon: '}{years(p.studyHorizonYears)}.
      {mode === 'building' ? (ar ? ' التدفقات الممتدة بعد مدة الدراسة افتراض نموذجي، وليست إثباتًا لعقود ممتدة.' : ' Flows beyond the study period are a model projection, not proof of extended leases.') : ''}</p>
    {rows.map(([label, value]) => <div key={label} className="flex flex-wrap justify-between gap-2 border-t border-slate-800 py-2"><span>{label}</span><span>{years(value)}</span></div>)}
  </section>;
}
