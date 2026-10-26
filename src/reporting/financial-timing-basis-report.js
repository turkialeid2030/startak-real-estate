'use strict';

const {
  FINANCIAL_TIMING_BASIS_VERSION,
  FINANCIAL_TIMING_CONVENTION,
} = require('../contracts/financial-timing-basis');

const FINANCIAL_TIMING_REPORT_SCHEMA_VERSION = 1;

const LABELS = Object.freeze({
  'ar-SA': Object.freeze({
    title: 'منهجية توقيت التدفقات والعوائد',
    initialInvestmentTiming: 'توقيت الاستثمار الأولي',
    unleveredCashflowTiming: 'توقيت التدفقات غير الممولة',
    operatingCashflowTiming: 'توقيت التدفقات التشغيلية',
    constructionCashflowTiming: 'توقيت تدفقات تكلفة الإنشاء في نموذج العائد',
    terminalValueTiming: 'توقيت القيمة النهائية',
    landDebtDrawTiming: 'توقيت سحب تمويل الأرض',
    constructionDebtDrawTiming: 'توقيت سحب تمويل الإنشاء',
    constructionInterestCapitalizationTiming: 'توقيت رسملة فوائد الإنشاء',
    npvConvention: 'منهجية صافي القيمة الحالية',
    irrConvention: 'منهجية معدل العائد الداخلي',
    datedCashflowMethod: 'تدفقات مؤرخة فعليًا',
    noDatedCashflows: 'لا — الفترات متساوية سنويًا',
    transactionAuthority: 'صلاحية المعاملة',
    noTransactionAuthority: 'لا تمنح هذه الإفصاحات أي صلاحية للمعاملة',
  }),
  en: Object.freeze({
    title: 'Cash-flow and return timing methodology',
    initialInvestmentTiming: 'Initial investment timing',
    unleveredCashflowTiming: 'Unlevered cash-flow timing',
    operatingCashflowTiming: 'Operating cash-flow timing',
    constructionCashflowTiming: 'Construction-cost timing in return model',
    terminalValueTiming: 'Terminal-value timing',
    landDebtDrawTiming: 'Land debt draw timing',
    constructionDebtDrawTiming: 'Construction debt draw timing',
    constructionInterestCapitalizationTiming: 'Construction interest capitalization timing',
    npvConvention: 'NPV convention',
    irrConvention: 'IRR convention',
    datedCashflowMethod: 'Date-specific cash flows',
    noDatedCashflows: 'No — equally spaced annual periods',
    transactionAuthority: 'Transaction authority',
    noTransactionAuthority: 'These disclosures do not grant transaction authority',
  }),
});

function normalizeLocale(locale) {
  return locale === 'en' ? 'en' : 'ar-SA';
}

function requireTimingBasis(result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new TypeError('result must be an object');
  }
  const timing = result.timingBasis;
  if (!timing || typeof timing !== 'object' || Array.isArray(timing)) {
    throw new TypeError('result.timingBasis is required');
  }
  if (timing.version !== FINANCIAL_TIMING_BASIS_VERSION) {
    throw new TypeError(`Unsupported timing basis version: ${timing.version}`);
  }
  return timing;
}

function row(code, label, value, applicable = true) {
  return Object.freeze({ code, label, value: applicable ? value : null, applicable });
}

function buildFinancialTimingBasisReportDisclosure(result, { locale = 'ar-SA' } = {}) {
  const timing = requireTimingBasis(result);
  const lang = normalizeLocale(locale);
  const labels = LABELS[lang];
  const landDevelopmentTiming = timing.constructionDebtPeriodsPerYear === 12;

  const rows = [
    row('INITIAL_INVESTMENT_TIMING', labels.initialInvestmentTiming, timing.initialInvestmentTiming),
    row('UNLEVERED_CASHFLOW_TIMING', labels.unleveredCashflowTiming, timing.unleveredCashflowTiming),
    row('OPERATING_CASHFLOW_TIMING', labels.operatingCashflowTiming, timing.operatingCashflowTiming),
    row(
      'CONSTRUCTION_CASHFLOW_TIMING',
      labels.constructionCashflowTiming,
      timing.constructionCashflowTiming,
      timing.constructionCashflowTiming !== FINANCIAL_TIMING_CONVENTION.NOT_APPLICABLE,
    ),
    row('TERMINAL_VALUE_TIMING', labels.terminalValueTiming, timing.terminalValueTiming),
    row(
      'LAND_DEBT_DRAW_TIMING',
      labels.landDebtDrawTiming,
      timing.landDebtDrawTiming,
      timing.landDebtDrawTiming !== FINANCIAL_TIMING_CONVENTION.NOT_APPLICABLE,
    ),
    row(
      'CONSTRUCTION_DEBT_DRAW_TIMING',
      labels.constructionDebtDrawTiming,
      timing.constructionDebtDrawTiming,
      timing.constructionDebtDrawTiming !== FINANCIAL_TIMING_CONVENTION.NOT_APPLICABLE,
    ),
    row(
      'CONSTRUCTION_INTEREST_CAPITALIZATION_TIMING',
      labels.constructionInterestCapitalizationTiming,
      timing.constructionInterestCapitalizationTiming,
      timing.constructionInterestCapitalizationTiming !== FINANCIAL_TIMING_CONVENTION.NOT_APPLICABLE,
    ),
    row('NPV_CONVENTION', labels.npvConvention, timing.npvConvention),
    row('IRR_CONVENTION', labels.irrConvention, timing.irrConvention),
    row('DATED_CASHFLOW_METHOD', labels.datedCashflowMethod, timing.datedCashflowMethod ? 'YES' : labels.noDatedCashflows),
    row('TRANSACTION_AUTHORITY', labels.transactionAuthority, labels.noTransactionAuthority),
  ];

  return Object.freeze({
    schemaVersion: FINANCIAL_TIMING_REPORT_SCHEMA_VERSION,
    timingBasisVersion: timing.version,
    locale: lang,
    title: labels.title,
    rows: Object.freeze(rows),
    methodology: Object.freeze({
      initialInvestmentTiming: timing.initialInvestmentTiming,
      unleveredCashflowTiming: timing.unleveredCashflowTiming,
      operatingCashflowTiming: timing.operatingCashflowTiming,
      constructionCashflowTiming: timing.constructionCashflowTiming,
      terminalValueTiming: timing.terminalValueTiming,
      landDebtDrawTiming: timing.landDebtDrawTiming,
      constructionDebtDrawTiming: timing.constructionDebtDrawTiming,
      constructionInterestCapitalizationTiming: timing.constructionInterestCapitalizationTiming,
      constructionDebtPeriodsPerYear: timing.constructionDebtPeriodsPerYear,
      annualConstructionDebtDrawsAreAggregationOnly: timing.annualConstructionDebtDrawsAreAggregationOnly,
      npvConvention: timing.npvConvention,
      irrConvention: timing.irrConvention,
      datedCashflowMethod: timing.datedCashflowMethod,
      xnpvUsed: timing.xnpvUsed,
      xirrUsed: timing.xirrUsed,
      periodsPerYear: timing.periodsPerYear,
    }),
    reconciliationNote: landDevelopmentTiming
      ? (lang === 'en'
        ? 'Project/equity return cash flows are annual end-of-period entries. Construction financing is a separate monthly schedule: construction principal is drawn before each month’s interest accrual and interest is capitalized monthly. Annual construction-debt rows are reporting aggregations only.'
        : 'تدفقات عائد المشروع وحقوق الملكية سنوية في نهاية الفترة. أما تمويل الإنشاء فهو جدول شهري مستقل: يُسحب أصل تمويل الإنشاء قبل احتساب فائدة الشهر، وتُرسمل الفائدة شهريًا. صفوف تمويل الإنشاء السنوية تجميعات لأغراض العرض فقط.')
      : (lang === 'en'
        ? 'The model uses equally spaced annual return periods with the initial investment at time zero and terminal value in the final hold-year entry.'
        : 'يستخدم النموذج فترات عائد سنوية متساوية، مع الاستثمار الأولي عند الزمن صفر والقيمة النهائية ضمن تدفق سنة الاحتفاظ الأخيرة.'),
    decisionStatus: typeof result.decisionStatus === 'string' ? result.decisionStatus : null,
    analyticalResultsOnly: result.analyticalResultsOnly === true,
    transactionAuthorized: false,
    semantics: 'Report-facing methodology disclosure derived only from result.timingBasis. It does not recalculate financial outputs, supply missing evidence, approve assumptions, create a valuation opinion, or authorize a transaction.',
  });
}

module.exports = {
  FINANCIAL_TIMING_REPORT_SCHEMA_VERSION,
  buildFinancialTimingBasisReportDisclosure,
};
