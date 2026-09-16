import React, { useMemo } from 'react';

const { evaluateValuationEvidenceFreshness } = require('../decision-governance/valuation-data-freshness');

const COLORS = Object.freeze({
  panelRaised: '#1C2C4A',
  hairline: '#2B3B5C',
  brass: '#C9A24C',
  parchment: '#EDE6D6',
  slate: '#8C97AC',
  slateDim: '#647089',
  caution: '#D08A3E',
  negative: '#B4544A',
  positive: '#4F9D6E',
});

const COPY = Object.freeze({
  'ar-SA': Object.freeze({
    title: 'حداثة مصادر الأدلة',
    subtitle: 'تعرض أعمار مصادر الأدلة المؤرخة فقط، ولا ترفع درجة الدليل ولا تمثل تقييمًا عقاريًا معتمدًا.',
    empty: 'لا توجد أدلة مصدرية مؤرخة في حالة التقييم الحالية.',
    source: 'المصدر',
    date: 'تاريخ المصدر',
    age: 'العمر بالأيام',
    current: 'حديث',
    aging: 'متقادم نسبيًا',
    stale: 'قديم',
    unknown: 'غير معروف',
    allDated: 'جميع مصادر الأدلة الحالية تحمل تاريخ مصدر صالحًا.',
    missingDates: 'يوجد دليل واحد أو أكثر بدون تاريخ مصدر صالح؛ لا يُعامل كمؤشر سوق مادي موثق.',
  }),
  en: Object.freeze({
    title: 'Evidence Source Freshness',
    subtitle: 'Shows the age of dated evidence sources only. It does not upgrade evidence quality or constitute an accredited valuation.',
    empty: 'No dated source evidence is present in the current valuation case.',
    source: 'Source',
    date: 'Source date',
    age: 'Age (days)',
    current: 'Current',
    aging: 'Aging',
    stale: 'Stale',
    unknown: 'Unknown',
    allDated: 'All current evidence sources carry a valid source date.',
    missingDates: 'One or more evidence items lack a valid source date and are not treated as documented material market indicators.',
  }),
});

function labelForStatus(status, copy) {
  if (status === 'CURRENT') return copy.current;
  if (status === 'AGING') return copy.aging;
  if (status === 'STALE') return copy.stale;
  return copy.unknown;
}

function statusColor(status) {
  if (status === 'CURRENT') return COLORS.positive;
  if (status === 'AGING') return COLORS.caution;
  if (status === 'STALE') return COLORS.negative;
  return COLORS.slate;
}

export default function DataFreshnessPanel({ locale = 'ar-SA', valuationCase = null }) {
  const copy = COPY[locale] || COPY.en;
  const summary = useMemo(() => evaluateValuationEvidenceFreshness(valuationCase), [valuationCase]);

  return (
    <section
      data-testid="valuation-data-freshness"
      className="rounded-2xl mt-4 p-4 md:p-5"
      style={{ background: COLORS.panelRaised, border: `1px solid ${COLORS.hairline}` }}
    >
      <div className="text-sm font-semibold" style={{ color: COLORS.brass }}>{copy.title}</div>
      <div className="text-[10px] mt-1 leading-relaxed" style={{ color: COLORS.slateDim }}>{copy.subtitle}</div>

      {summary.items.length === 0 ? (
        <div className="text-xs mt-3" style={{ color: COLORS.slate }}>{copy.empty}</div>
      ) : (
        <>
          <div className="mt-3 space-y-2">
            {summary.items.map((item) => (
              <div key={item.field} className="grid grid-cols-1 md:grid-cols-4 gap-2 rounded-xl px-3 py-2" style={{ border: `1px solid ${COLORS.hairline}` }}>
                <div>
                  <div className="text-[9px]" style={{ color: COLORS.slateDim }}>{copy.source}</div>
                  <div className="text-[11px]" style={{ color: COLORS.parchment }}>{item.sourceName || item.field}</div>
                </div>
                <div>
                  <div className="text-[9px]" style={{ color: COLORS.slateDim }}>{copy.date}</div>
                  <div className="text-[11px] rf-num" style={{ color: COLORS.slate }}>{item.sourceDate || '—'}</div>
                </div>
                <div>
                  <div className="text-[9px]" style={{ color: COLORS.slateDim }}>{copy.age}</div>
                  <div className="text-[11px] rf-num" style={{ color: COLORS.slate }}>{item.ageInDays == null ? '—' : item.ageInDays}</div>
                </div>
                <div className="md:text-end">
                  <span className="text-[10px] font-semibold" style={{ color: statusColor(item.freshnessStatus) }}>
                    {labelForStatus(item.freshnessStatus, copy)}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="text-[10px] mt-3 leading-relaxed" style={{ color: summary.allMaterialSourcesDated ? COLORS.positive : COLORS.caution }}>
            {summary.allMaterialSourcesDated ? copy.allDated : copy.missingDates}
          </div>
        </>
      )}
    </section>
  );
}
