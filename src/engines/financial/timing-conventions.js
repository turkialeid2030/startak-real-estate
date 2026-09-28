'use strict';

const { STUDY_TYPE } = require('../../contracts/study-type');

const CASHFLOW_TIMING_VERSION = 'CASHFLOW_TIMING_V1';

const TIMING_CODE = Object.freeze({
  PERIODIC: 'PERIODIC',
  PERIOD_0: 'PERIOD_0',
  ANNUAL_END_OF_PERIOD: 'ANNUAL_END_OF_PERIOD',
  MONTHLY_END_OF_PERIOD_AFTER_INTEREST_ACCRUAL: 'MONTHLY_END_OF_PERIOD_AFTER_INTEREST_ACCRUAL',
  MONTHLY_BEGINNING_OF_PERIOD_BEFORE_INTEREST_ACCRUAL: 'MONTHLY_BEGINNING_OF_PERIOD_BEFORE_INTEREST_ACCRUAL',
  MONTHLY_AFTER_CONSTRUCTION_DRAW_CAPITALIZED: 'MONTHLY_AFTER_CONSTRUCTION_DRAW_CAPITALIZED',
  SUM_MONTHLY_PAYMENTS_BY_MODEL_YEAR: 'SUM_MONTHLY_PAYMENTS_BY_MODEL_YEAR',
  FORWARD_YEAR_N_PLUS_1_STABILIZED_NOI: 'FORWARD_YEAR_N_PLUS_1_STABILIZED_NOI',
  PERIODIC_ANNUAL_NPV: 'PERIODIC_ANNUAL_NPV',
  PERIODIC_ANNUAL_IRR: 'PERIODIC_ANNUAL_IRR',
  MONTHLY: 'MONTHLY',
});

function bilingualDisclosure(studyType, financed) {
  if (studyType === STUDY_TYPE.LAND_DEVELOPMENT) {
    return Object.freeze({
      ar: financed
        ? 'أساس العائد في هذه الدراسة دوري سنوي وليس مؤرخًا: شراء الأرض عند الفترة 0، وتكاليف الإنشاء غير الممولة والتشغيل وقيمة الخروج في نهاية الفترات السنوية. نموذج التمويل منفصل شهريًا؛ سحب تمويل الإنشاء يتم في بداية الشهر قبل احتساب الفائدة، ثم تُرسمل الفائدة شهريًا، وتُجمع خدمة الدين الشهرية إلى سنوات عند عرض التدفقات المرفوعة.'
        : 'أساس العائد في هذه الدراسة دوري سنوي وليس مؤرخًا: شراء الأرض عند الفترة 0، وتكاليف الإنشاء والتشغيل وقيمة الخروج في نهاية الفترات السنوية. NPV وIRR هنا دوريان سنويان وليسا XNPV/XIRR مؤرخين.',
      en: financed
        ? 'Return calculations are periodic annual, not date-aware: land acquisition is at period 0, while unlevered construction costs, operations, and terminal value are annual end-of-period. Financing is modeled separately monthly: construction debt is drawn at the beginning of each month before interest accrual, interest is capitalized monthly, and monthly debt service is aggregated into model years for levered valuation cash flows.'
        : 'Return calculations are periodic annual, not date-aware: land acquisition is at period 0, while construction costs, operations, and terminal value are annual end-of-period. NPV and IRR are periodic annual measures, not dated XNPV/XIRR.',
    });
  }

  return Object.freeze({
    ar: financed
      ? 'أساس العائد في هذه الدراسة دوري سنوي وليس مؤرخًا: الاستحواذ عند الفترة 0، وصافي الدخل التشغيلي وقيمة الخروج في نهاية الفترات السنوية، وتستخدم قيمة الخروج صافي دخل السنة N+1. نموذج الدين منفصل شهريًا، وتُجمع خدمة الدين الشهرية إلى سنوات عند احتساب التدفقات المرفوعة.'
      : 'أساس العائد في هذه الدراسة دوري سنوي وليس مؤرخًا: الاستحواذ عند الفترة 0، وصافي الدخل التشغيلي وقيمة الخروج في نهاية الفترات السنوية، وتستخدم قيمة الخروج صافي دخل السنة N+1. NPV وIRR هنا دوريان سنويان وليسا XNPV/XIRR مؤرخين.',
    en: financed
      ? 'Return calculations are periodic annual, not date-aware: acquisition is at period 0, operating NOI and terminal proceeds are annual end-of-period, and terminal value uses forward Year-(N+1) NOI. Debt is modeled separately monthly, with monthly debt service aggregated into model years for levered valuation cash flows.'
      : 'Return calculations are periodic annual, not date-aware: acquisition is at period 0, operating NOI and terminal proceeds are annual end-of-period, and terminal value uses forward Year-(N+1) NOI. NPV and IRR are periodic annual measures, not dated XNPV/XIRR.',
  });
}

function buildCashflowTimingConvention({ studyType, result } = {}) {
  if (studyType !== STUDY_TYPE.EXISTING_BUILDING && studyType !== STUDY_TYPE.LAND_DEVELOPMENT) {
    throw new TypeError('studyType must be a supported canonical study type');
  }
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new TypeError('result must be an object');
  }

  const financed = typeof result.financingEngineVersion === 'string' && result.financingEngineVersion.length > 0;
  const land = studyType === STUDY_TYPE.LAND_DEVELOPMENT;

  return Object.freeze({
    version: CASHFLOW_TIMING_VERSION,
    returnCalculationBasis: TIMING_CODE.PERIODIC,
    npvConvention: TIMING_CODE.PERIODIC_ANNUAL_NPV,
    irrConvention: TIMING_CODE.PERIODIC_ANNUAL_IRR,
    dateAwareReturns: false,
    dayCountBasis: null,
    initialInvestmentTiming: TIMING_CODE.PERIOD_0,
    unleveredOperatingCashflowTiming: TIMING_CODE.ANNUAL_END_OF_PERIOD,
    unleveredConstructionCostTiming: land ? TIMING_CODE.ANNUAL_END_OF_PERIOD : null,
    terminalValueTiming: TIMING_CODE.ANNUAL_END_OF_PERIOD,
    terminalValueNoiBasis: TIMING_CODE.FORWARD_YEAR_N_PLUS_1_STABILIZED_NOI,
    financingModelApplied: financed,
    debtCalculationFrequency: financed ? TIMING_CODE.MONTHLY : null,
    debtFundingTiming: financed ? TIMING_CODE.PERIOD_0 : null,
    termDebtPaymentTiming: financed ? TIMING_CODE.MONTHLY_END_OF_PERIOD_AFTER_INTEREST_ACCRUAL : null,
    annualDebtServiceAggregation: financed ? TIMING_CODE.SUM_MONTHLY_PAYMENTS_BY_MODEL_YEAR : null,
    leveredValuationCashflowTiming: financed ? TIMING_CODE.ANNUAL_END_OF_PERIOD : null,
    constructionDebtDrawTiming: land && financed
      ? TIMING_CODE.MONTHLY_BEGINNING_OF_PERIOD_BEFORE_INTEREST_ACCRUAL
      : null,
    constructionInterestTiming: land && financed
      ? TIMING_CODE.MONTHLY_AFTER_CONSTRUCTION_DRAW_CAPITALIZED
      : null,
    datedReturnEngineUsed: false,
    xnpvUsed: false,
    xirrUsed: false,
    disclosure: bilingualDisclosure(studyType, financed),
    transactionAuthorized: false,
  });
}

module.exports = {
  CASHFLOW_TIMING_VERSION,
  TIMING_CODE,
  buildCashflowTimingConvention,
};
