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
function findVerifiedPurchaseAlternative(inputs, assumptionModelVersion, qualification) {
  const empty = { status: 'NOT_SEARCHED', price: null, evaluations: 0,
    globalMaximumEstablished: false, transactionAuthorized: false };
  if (qualification?.qualifiedPrice != null || qualification?.reason !== 'BOUNDARY_CRITERIA_FAILED') return empty;
  const upperMinor = Math.floor(qualification.candidatePrice * 100);
  if (!Number.isSafeInteger(upperMinor) || upperMinor <= 1) return empty;
  let high = upperMinor, low = 0, verified = null, evaluations = 0;
  // Find a passing lower point; do not infer infeasibility from sampling failure.
  for (let candidate = Math.floor(high / 2); candidate >= 1 && evaluations < 40; candidate = Math.floor(candidate / 2)) {
    const q = qualifyPurchaseBoundary(inputs, assumptionModelVersion, candidate / 100); evaluations++;
    if (q.qualifiedPrice != null) { low = candidate; verified = q; break; }
    if (q.reason !== 'BOUNDARY_CRITERIA_FAILED') return { ...empty, status: 'SEARCH_INCOMPLETE', evaluations };
    high = candidate;
  }
  if (!verified) return { ...empty, status: 'NO_VERIFIED_ALTERNATIVE_FOUND', evaluations };
  // Refine only the found pass/fail interval. No global monotonicity claim.
  while (high - low > 1 && evaluations < 90) {
    const mid = low + Math.floor((high - low) / 2);
    const q = qualifyPurchaseBoundary(inputs, assumptionModelVersion, mid / 100); evaluations++;
    if (q.qualifiedPrice != null) { low = mid; verified = q; }
    else if (q.reason === 'BOUNDARY_CRITERIA_FAILED') high = mid;
    else return { ...empty, status: 'SEARCH_INCOMPLETE', evaluations };
  }
  return { ...empty, status: 'VERIFIED_LOWER_PRICE', price: verified.qualifiedPrice, evaluations,
    qualification: verified, originalBoundary: qualification.candidatePrice,
    failingUpperPrice: high / 100, searchResolutionSar: (high - low) / 100 };
}
module.exports = { qualifyPurchaseBoundary, purchaseBoundaryMessage, findVerifiedPurchaseAlternative };
