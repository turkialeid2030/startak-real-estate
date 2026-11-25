import React, { useMemo, useState } from 'react';

const {
  evaluateGovernedValuationReportReadiness,
  buildGovernedValuationReport,
} = require('../decision-governance/valuation-report-export');

const COLORS = Object.freeze({
  panelRaised: '#1C2C4A',
  hairline: '#2B3B5C',
  brass: '#C9A24C',
  parchment: '#EDE6D6',
  slate: '#8C97AC',
  slateDim: '#647089',
  caution: '#D08A3E',
  positive: '#4F9D6E',
});

const COPY = Object.freeze({
  'ar-SA': Object.freeze({
    title: 'تصدير تقرير تقييم محكوم',
    subtitle: 'يصدر لقطة تقييم داعمة للقرار بصيغة JSON مع حدود الصلاحية ومصادر الأدلة وتواريخها. لا يمثل اعتمادًا استثماريًا أو تقييمًا عقاريًا معتمدًا.',
    export: 'تصدير التقرير المحكوم',
    ready: 'التقرير جاهز للتصدير وفق ضوابط المصادر الحالية.',
    notReady: 'التقرير غير جاهز للتصدير المحكوم.',
    reason_VALUATION_RUNTIME_REQUIRED: 'يلزم تشغيل حالة التقييم أولًا.',
    reason_VALUATION_CASE_REQUIRED: 'يلزم إعداد حالة تقييم.',
    reason_VALUATION_EVIDENCE_REQUIRED: 'يلزم إدخال أدلة مصدرية قبل التصدير.',
    reason_REPORT_SOURCE_DATE_REQUIRED: 'يلزم تاريخ مصدر صالح لكل دليل مستخدم في التقرير.',
    failed: 'تعذر إنشاء التقرير المحكوم.',
    exported: 'تم إنشاء التقرير المحكوم محليًا.',
  }),
  en: Object.freeze({
    title: 'Governed Valuation Report Export',
    subtitle: 'Exports a decision-support valuation snapshot as JSON with authority limits, evidence sources and source dates. It is not investment approval or an accredited valuation.',
    export: 'Export governed report',
    ready: 'The report is ready for export under the current source controls.',
    notReady: 'The governed report is not ready for export.',
    reason_VALUATION_RUNTIME_REQUIRED: 'Run the valuation case first.',
    reason_VALUATION_CASE_REQUIRED: 'A valuation case is required.',
    reason_VALUATION_EVIDENCE_REQUIRED: 'Source evidence is required before export.',
    reason_REPORT_SOURCE_DATE_REQUIRED: 'Every evidence source used by the report requires a valid source date.',
    failed: 'The governed report could not be created.',
    exported: 'The governed report was created locally.',
  }),
});

function reasonText(copy, reasonCode) {
  return copy[`reason_${reasonCode}`] || reasonCode || copy.notReady;
}

export default function GovernedReportExportPanel({ locale = 'ar-SA', runtime = null, valuationCase = null }) {
  const copy = COPY[locale] || COPY.en;
  const readiness = useMemo(
    () => evaluateGovernedValuationReportReadiness({ runtime, valuationCase }),
    [runtime, valuationCase],
  );
  const [message, setMessage] = useState(null);

  const exportReport = () => {
    setMessage(null);
    try {
      const payload = buildGovernedValuationReport({ runtime, valuationCase });
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeCaseId = String(payload.dealId || 'valuation').replace(/[^a-zA-Z0-9_-]/g, '-');
      a.href = url;
      a.download = `startak-governed-valuation-report-${safeCaseId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setMessage({ ok: true, text: copy.exported });
    } catch (error) {
      setMessage({ ok: false, text: reasonText(copy, error && error.code) || copy.failed });
    }
  };

  return (
    <section
      data-testid="governed-report-export"
      className="rounded-2xl mt-4 p-4 md:p-5"
      style={{ background: COLORS.panelRaised, border: `1px solid ${COLORS.hairline}` }}
    >
      <div className="text-sm font-semibold" style={{ color: COLORS.brass }}>{copy.title}</div>
      <div className="text-[10px] mt-1 leading-relaxed" style={{ color: COLORS.slateDim }}>{copy.subtitle}</div>
      <div className="text-[10px] mt-3" style={{ color: readiness.ready ? COLORS.positive : COLORS.caution }}>
        {readiness.ready ? copy.ready : `${copy.notReady} ${reasonText(copy, readiness.reasonCode)}`}
      </div>
      <button
        type="button"
        disabled={!readiness.ready}
        onClick={exportReport}
        className="mt-3 px-3 py-2 rounded-xl text-xs font-semibold"
        style={{
          background: readiness.ready ? COLORS.brass : COLORS.hairline,
          color: readiness.ready ? '#0D1526' : COLORS.slate,
          cursor: readiness.ready ? 'pointer' : 'not-allowed',
          opacity: readiness.ready ? 1 : 0.75,
        }}
      >
        {copy.export}
      </button>
      {message ? (
        <div className="text-[10px] mt-2" style={{ color: message.ok ? COLORS.positive : COLORS.caution }}>
          {message.text}
        </div>
      ) : null}
    </section>
  );
}
