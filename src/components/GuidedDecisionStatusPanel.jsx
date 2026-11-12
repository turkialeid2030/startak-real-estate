import React, { useMemo } from 'react';

const { buildGuidedUiStatus } = require('../decision-governance/guided-ui-status');

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
    title: 'مسار القرار المحكوم',
    subtitle: 'يعرض الخطوة التالية في تسلسل القرار فقط. لا يمثل اعتمادًا استثماريًا ولا تفويضًا للتنفيذ.',
    next: 'الخطوة التالية',
    complete: 'اكتملت الخطوات المسجلة في هذا المسار.',
    financial: 'التحليل المالي متاح',
    noFinalDecision: 'لا يُعرض قرار شراء/رفض قبل اكتمال قرار شامل محكوم.',
    steps: Object.freeze({
      ASSET: 'تعريف الأصل',
      PRICE: 'السعر',
      INCOME: 'الدخل',
      EXPENSES: 'المصروفات',
      ASSUMPTIONS: 'الافتراضات',
      FINANCING: 'التمويل',
      VALUATION: 'التقييم',
      EVIDENCE: 'الأدلة',
      RISKS: 'مراجعة المخاطر',
      FINANCIAL_RESULT: 'النتيجة المالية',
      DUE_DILIGENCE: 'العناية الواجبة',
      OVERALL_DECISION: 'القرار الشامل',
    }),
  }),
  en: Object.freeze({
    title: 'Governed Decision Path',
    subtitle: 'Shows sequencing status only. It is not investment approval or execution authority.',
    next: 'Next step',
    complete: 'All recorded steps in this path are complete.',
    financial: 'Financial analysis available',
    noFinalDecision: 'No buy/reject decision is displayed before a governed overall decision exists.',
    steps: Object.freeze({
      ASSET: 'Asset definition',
      PRICE: 'Price',
      INCOME: 'Income',
      EXPENSES: 'Expenses',
      ASSUMPTIONS: 'Assumptions',
      FINANCING: 'Financing',
      VALUATION: 'Valuation',
      EVIDENCE: 'Evidence',
      RISKS: 'Risk review',
      FINANCIAL_RESULT: 'Financial result',
      DUE_DILIGENCE: 'Due diligence',
      OVERALL_DECISION: 'Overall decision',
    }),
  }),
});

export default function GuidedDecisionStatusPanel({ locale = 'ar-SA', runtime = null, valuationCase = null }) {
  const copy = COPY[locale] || COPY.en;
  const status = useMemo(
    () => buildGuidedUiStatus({ runtime, valuationCase, financialResultPresent: true }),
    [runtime, valuationCase],
  );
  const nextLabel = status.nextStep ? (copy.steps[status.nextStep] || status.nextStep) : copy.complete;

  return (
    <section
      data-testid="guided-decision-status"
      className="rounded-2xl mt-4 p-4 md:p-5"
      style={{ background: COLORS.panelRaised, border: `1px solid ${COLORS.hairline}` }}
    >
      <div className="text-sm font-semibold" style={{ color: COLORS.brass }}>{copy.title}</div>
      <div className="text-[10px] mt-1 leading-relaxed" style={{ color: COLORS.slateDim }}>{copy.subtitle}</div>
      <div className="flex flex-wrap gap-3 mt-3 text-[10px]">
        <span style={{ color: status.financialResultPresent ? COLORS.positive : COLORS.caution }}>{copy.financial}</span>
        <span style={{ color: COLORS.parchment }}>{copy.next}: {nextLabel}</span>
      </div>
      {!status.buyRejectDecisionAllowed ? (
        <div className="text-[10px] mt-2 leading-relaxed" style={{ color: COLORS.caution }}>{copy.noFinalDecision}</div>
      ) : null}
    </section>
  );
}
