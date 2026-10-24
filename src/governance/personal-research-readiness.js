'use strict';

// Personal research overlay. This never replaces the established engine,
// verifies authentic Saudi market comparables or authorizes a real transaction.
const PERSONAL_STATUS = Object.freeze({
  HOLD: 'HOLD_INPUT_OR_FINANCIAL_INTEGRITY',
  CAUTION: 'PERSONAL_RESEARCH_CAUTION',
  RESEARCH: 'PERSONAL_RESEARCH_MATH_CHECKED',
});
function finite(value) { return typeof value === 'number' && Number.isFinite(value); }
function near(a,b) {
  return finite(a) && finite(b) &&
    Math.abs(a-b) <= Math.max(0.05,Math.max(Math.abs(a),Math.abs(b))*1e-10);
}
function hold(reasonCodes, checks = []) {
  return Object.freeze({
    status:PERSONAL_STATUS.HOLD,
    reasonCodes:Object.freeze(reasonCodes),
    checks:Object.freeze(checks),
    computationChecked:false,
    personalResearchAllowed:false,
    independentlyVerifiedMarketAccuracy:false,
    realDataSourceVerified:false,
    financialDecisionAuthorized:false,
    professionalValuationCertified:false,
    commercialProductionAuthorized:false,
    externalReviewRequiredBeforeIrreversibleDecision:true,
  });
}
function evaluatePersonalResearchReadiness({ mode, results, inputs, validationError } = {}) {
  if (validationError || !results || !inputs ||
      typeof results !== 'object' || typeof inputs !== 'object') {
    return hold(['INPUT_OR_CALCULATION_NOT_AVAILABLE']);
  }
  if (!['building','land'].includes(mode)) return hold(['STUDY_MODE_UNSUPPORTED']);
  if (results.financialModelStatus !== 'VALID') {
    return hold(['MODEL_INCOMPLETE_OR_INVALID']);
  }
  const checks = [];
  const check = (id, actual, expected) =>
    checks.push({id,pass:near(actual,expected),
      actual:finite(actual)?actual:null,expected:finite(expected)?expected:null});
  if(mode==='building') {
    check('ACQUISITION_COST_ROLLUP',
      results.totalPurchaseCost,
      inputs.buildingPrice+results.commissionAmount+results.transferFeeAmount+
        inputs.inspectionCost+inputs.valuationCost);
    check('NOI_RECONCILIATION',results.NOI,
      results.totalAnnualIncome-results.opexAmount);
  } else {
    check('PROJECT_COST_ROLLUP',results.totalProjectCost,
      results.totalLandAcquisitionCost+results.totalConstructionCost);
    check('STABILIZED_NOI_RECONCILIATION',results.stabilizedNOI,
      results.totalOperatingRevenue-results.operatingExpenses);
  }
  const cashflowOk = Array.isArray(results.cashflows) &&
    results.cashflows.length >= 2 && results.cashflows.every(finite);
  checks.push({id:'CASHFLOW_VALUES_FINITE',pass:cashflowOk});
  const criteriaOk = Number.isInteger(results.totalCriteria) &&
    results.totalCriteria > 0 &&
    Array.isArray(results.criteriaDetail) &&
    results.criteriaDetail.length === results.totalCriteria &&
    results.criteriaDetail.every(c => c && typeof c.met==='boolean');
  checks.push({id:'FINANCIAL_CRITERIA_COMPLETE',pass:criteriaOk});
  const failed = checks.filter(c => !c.pass);
  if(failed.length) return hold(failed.map(c=>c.id),checks);
  const riskReasons = [];
  if(Array.isArray(results.failedHardGates) && results.failedHardGates.length)
    riskReasons.push('FINANCIAL_HARD_GATES_NOT_MET');
  if(results.criteriaDetail.some(c=>c.hardGate===true && c.met===false) &&
      !riskReasons.includes('FINANCIAL_HARD_GATES_NOT_MET'))
    riskReasons.push('FINANCIAL_HARD_GATES_NOT_MET');
  if (!finite(results.npv)) riskReasons.push('NPV_NOT_ESTABLISHED');
  if (!finite(results.irr)) riskReasons.push('IRR_NOT_ESTABLISHED');
  if(results.irrMultipleRootRisk===true || results.irrReliability==='UNRELIABLE')
    riskReasons.push('IRR_REQUIRES_MANUAL_REVIEW');
  if (mode==='building' && results.exitDependentAnalyticsReady !== true)
    riskReasons.push('EXIT_ANALYSIS_NOT_READY');
  // Independently verified market inputs are not established by user-edited
  // numeric fields; even a green calculation means research, never BUY.
  const result = {
    status:riskReasons.length ? PERSONAL_STATUS.CAUTION:PERSONAL_STATUS.RESEARCH,
    reasonCodes:Object.freeze(riskReasons),
    checks:Object.freeze(checks),
    computationChecked:true,
    personalResearchAllowed:true,
    independentlyVerifiedMarketAccuracy:false,
    realDataSourceVerified:false,
    financialDecisionAuthorized:false,
    professionalValuationCertified:false,
    commercialProductionAuthorized:false,
    externalReviewRequiredBeforeIrreversibleDecision:true,
  };
  return Object.freeze(result);
}
module.exports={PERSONAL_STATUS,evaluatePersonalResearchReadiness};
