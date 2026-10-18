'use strict';
const { calculateInvestmentCase, STUDY_TYPE } = require('../engines');
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
module.exports = { qualifyPurchaseBoundary };
