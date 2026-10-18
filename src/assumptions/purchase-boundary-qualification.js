'use strict';
const { calculateInvestmentCase, STUDY_TYPE } = require('../engines');
const MESSAGES = {
  POSITIVE_BOUNDARY_REQUIRED: ['لا يتوفر حد شراء موجب قابل للفحص','No positive purchase boundary is available'],
  BOUNDARY_CRITERIA_INCOMPLETE: ['أكمل افتراضات التخارج وتغطية العقود لإتاحة جميع المعايير','Complete exit and lease coverage assumptions to evaluate every criterion'],
  BOUNDARY_CRITERIA_FAILED: ['لم يجتز السعر جميع المعايير المالية','The price did not pass every financial criterion'],
  BOUNDARY_CALCULATION_FAILED: ['تعذر حساب حد الشراء؛ راجع المدخلات','Purchase boundary calculation failed; review inputs'],
  STABILIZED_NOI_POSITIVE: ['صافي الدخل التشغيلي غير موجب','Operating NOI is not positive'],
  NET_YIELD_ON_COST: ['العائد الصافي دون الحد المطلوب','Net yield is below the required threshold'],
  CUMULATIVE_PAYBACK: ['الاسترداد يتجاوز المدة المطلوبة','Payback exceeds the required period'],
  IRR_MEETS_HURDLE: ['العائد الداخلي دون المعدل المطلوب','IRR is below the required rate'],
  NPV_NON_NEGATIVE: ['صافي القيمة الحالية سالب','NPV is negative'],
  INCOME_VALUE_COVERS_COST: ['قيمة الدخل لا تغطي تكلفة الاستحواذ','Income value does not cover acquisition cost'],
  DSCR_MINIMUM: ['تغطية خدمة الدين غير مستوفاة','Debt service coverage is not satisfied'],
  LEVERED_NPV_NON_NEGATIVE: ['صافي القيمة الحالية لحقوق الملكية سالب','Equity NPV is negative'],
};
function purchaseBoundaryMessage(qualification, locale = 'ar-SA') {
  const codes = qualification?.failedCriteria?.length ? qualification.failedCriteria : [qualification?.reason];
  return codes.filter(Boolean).map(code => (MESSAGES[code] || ['تحتاج نتيجة الفحص إلى مراجعة','Review the qualification result'])[locale === 'en' ? 1 : 0]).join(' · ');
}
function qualifyPurchaseBoundary(inputs, assumptionModelVersion, candidatePrice) {
  const base = { candidatePrice: Number.isFinite(candidatePrice) ? candidatePrice : null,
    qualifiedPrice: null, status: 'NOT_QUALIFIED', criteria: [], failedCriteria: [],
    allConstraintsOptimized: false, transactionAuthorized: false };
  if (!Number.isFinite(candidatePrice) || candidatePrice <= 0) return { ...base, reason: 'POSITIVE_BOUNDARY_REQUIRED' };
  try {
    const result = calculateInvestmentCase({ studyType: STUDY_TYPE.EXISTING_BUILDING,
      inputs: { ...inputs, buildingPrice: candidatePrice }, leverageEnabled: Boolean(inputs.leverageEnabled), assumptionModelVersion });
    const criteria = result.criteriaDetail || [];
    const expected = ['STABILIZED_NOI_POSITIVE','NET_YIELD_ON_COST','CUMULATIVE_PAYBACK','IRR_MEETS_HURDLE','NPV_NON_NEGATIVE','INCOME_VALUE_COVERS_COST',
      ...(inputs.leverageEnabled ? ['DSCR_MINIMUM','LEVERED_NPV_NON_NEGATIVE'] : [])];
    const complete = expected.every(code => criteria.filter(c => c.code === code).length === 1);
    const failedCriteria = criteria.filter(c => c.met !== true).map(c => c.code);
    const pass = complete && failedCriteria.length === 0 && result.decisionStatus === 'ALL_CRITERIA_MET';
    return { ...base, status: pass ? 'ALL_CRITERIA_VERIFIED_AT_BOUNDARY' : 'NOT_QUALIFIED',
      qualifiedPrice: pass ? candidatePrice : null, criteria, failedCriteria,
      reason: !complete ? 'BOUNDARY_CRITERIA_INCOMPLETE' : pass ? null : 'BOUNDARY_CRITERIA_FAILED',
      cumulativePaybackYears: result.cumulativePaybackOnCost,
      irr: result.irr, npv: result.npv, minimumDscr: result.dscrMin, equityNpv: result.leveredNPV };
  } catch (error) {
    return { ...base, reason: 'BOUNDARY_CALCULATION_FAILED', errorCode: error.code || error.rule || error.name };
  }
}
module.exports = { qualifyPurchaseBoundary, purchaseBoundaryMessage };
