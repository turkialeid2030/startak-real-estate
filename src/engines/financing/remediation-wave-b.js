'use strict';

const {
  computeNPV,
  computeIRR,
  sizeDebtByLtvAndDscr,
  classifyFinancingModel,
  sizeConstructionFacilityByLtcAndDscr,
  buildAnnualConstructionDebtDraws,
} = require('../financial');
const { tierVerdict } = require('../recommendation');
const { STUDY_TYPE } = require('../../contracts/study-type');

const BUILDING_FINANCING_ENGINE_VERSION = 'MONTHLY_DSCR_WAVE_B_1.0';
const LAND_FINANCING_ENGINE_VERSION = 'CONSTRUCTION_MONTHLY_DSCR_WAVE_B_2.0';

function getRemainingBalanceAtYear(plan, year) {
  if (!plan || !Array.isArray(plan.annualSchedule) || year <= 0) return 0;
  const row = plan.annualSchedule[year - 1];
  if (row) return row.balance;
  return 0;
}

function buildAnnualNoiForDebtSizing(baseResult, inputs) {
  const tenorYears = Math.max(1, Math.ceil(inputs.loanTenor));
  const source = Array.isArray(baseResult.paybackNoiCashflows) && baseResult.paybackNoiCashflows.length
    ? baseResult.paybackNoiCashflows
    : baseResult.operatingNoiCashflows;
  if (!Array.isArray(source) || source.length === 0) return [];
  const out = source.slice(0, tenorYears);
  while (out.length < tenorYears) out.push(out[out.length - 1]);
  return out;
}

function updateDecisionForFinancing(baseResult, dscrMet, leveredNpvMet) {
  const criteria = (baseResult.criteriaDetail || []).map((item) => {
    if (item.code === 'DSCR_MINIMUM') return { ...item, met: dscrMet };
    if (item.code === 'LEVERED_NPV_NON_NEGATIVE') return { ...item, met: leveredNpvMet };
    return { ...item };
  });
  const verdictResult = tierVerdict(criteria);
  return { criteria, verdictResult };
}

function commonFinancingOptions(inputs) {
  return {
    gracePeriodMonths: inputs.gracePeriodMonths == null ? 0 : inputs.gracePeriodMonths,
    graceType: inputs.graceType || 'INTEREST_ONLY',
    balloonPct: inputs.balloonPct == null ? 0 : inputs.balloonPct,
  };
}

function commonFinancingEvidence(inputs, plan, classification) {
  return {
    financingModelType: classification.modelType,
    financingModelBoundary: classification.boundary,
    exactContractModel: classification.exactContractModel,
    tenorMonths: plan.tenorMonths,
    gracePeriodMonths: inputs.gracePeriodMonths == null ? 0 : inputs.gracePeriodMonths,
    graceType: inputs.graceType || 'INTEREST_ONLY',
    balloonPct: inputs.balloonPct == null ? 0 : inputs.balloonPct,
    balloonAmount: plan.balloonAmount,
    scheduledMonthlyPayment: plan.scheduledMonthlyPayment,
    annualDebtService: plan.annualDebtService,
    annualDebtSchedule: plan.annualSchedule,
    debtService: plan.annualDebtService[0] || 0,
    debtServiceBasis: 'YEAR_1_ACTUAL',
    debtServicePeak: plan.annualDebtService.length ? Math.max(...plan.annualDebtService) : 0,
  };
}

function applyExistingBuildingFinancing(inputs, baseResult) {
  const annualNoi = buildAnnualNoiForDebtSizing(baseResult, inputs);
  const options = commonFinancingOptions(inputs);
  const financingClassification = classifyFinancingModel(inputs.financingStructureLabel);

  const sizing = sizeDebtByLtvAndDscr({
    costBase: baseResult.totalPurchaseCost,
    ltv: inputs.ltv,
    annualNoi,
    minDscrThreshold: inputs.minDscrThreshold,
    annualRate: inputs.loanRate,
    tenorYears: inputs.loanTenor,
    options,
  });

  const loanAmount = sizing.loanAmount;
  const equityRequired = baseResult.totalPurchaseCost - loanAmount;
  const holdYears = Math.max(1, Math.round(inputs.holdPeriod));
  const leveredCashflows = [-equityRequired];

  for (let year = 1; year <= holdYears; year += 1) {
    const noi = baseResult.operatingNoiCashflows[year - 1] ?? 0;
    const debtService = sizing.plan.annualDebtService[year - 1] || 0;
    if (year < holdYears) {
      leveredCashflows.push(noi - debtService);
    } else {
      const remainingBalance = getRemainingBalanceAtYear(sizing.plan, year);
      leveredCashflows.push(noi - debtService + baseResult.terminalNetSaleProceeds - remainingBalance);
    }
  }

  const leveredIRR = computeIRR(leveredCashflows);
  const equityDiscountRate = inputs.discountRate + inputs.equityRiskSpread;
  const leveredNPV = computeNPV(equityDiscountRate, leveredCashflows);
  const dscrMin = sizing.dscrAtLoanAmount;
  const c5 = dscrMin !== null && dscrMin >= inputs.minDscrThreshold;
  const c7 = Number.isFinite(leveredNPV) && leveredNPV >= 0;
  const { criteria, verdictResult } = updateDecisionForFinancing(baseResult, c5, c7);

  return {
    ...baseResult,
    financingEngineVersion: BUILDING_FINANCING_ENGINE_VERSION,
    ...commonFinancingEvidence(inputs, sizing.plan, financingClassification),
    loanSizingConstraint: sizing.bindingConstraint,
    ltvLoanLimit: sizing.ltvLimit,
    dscrLoanLimit: sizing.dscrLimit,
    loanAmount,
    equityRequired,
    dscrMin,
    leveredCashflows,
    leveredIRR,
    leveredNPV,
    equityDiscountRate,
    c5,
    c7,
    criteriaDetail: criteria,
    metCount: verdictResult.met,
    totalCriteria: verdictResult.total,
    verdict: verdictResult.verdict,
    decisionStatus: verdictResult.decisionStatus,
    failedHardGates: verdictResult.failedHardGates,
    failedSoftCriteria: verdictResult.failedSoftCriteria,
  };
}

function applyLandDevelopmentFinancing(inputs, baseResult) {
  const options = commonFinancingOptions(inputs);
  const financingClassification = classifyFinancingModel(inputs.financingStructureLabel);
  const sizing = sizeConstructionFacilityByLtcAndDscr({
    landCost: baseResult.totalLandAcquisitionCost,
    constructionCost: baseResult.totalConstructionCost,
    maxDebtFraction: inputs.ltv,
    annualRate: inputs.loanRate,
    constructionYears: inputs.constructionPeriod,
    termTenorYears: inputs.loanTenor,
    annualNoi: baseResult.operatingNoiCashflows,
    minDscrThreshold: inputs.minDscrThreshold,
    termOptions: options,
  });

  const facility = sizing.facility;
  const termPlan = sizing.termPlan;
  const constructionYears = Math.max(1, Math.round(inputs.constructionPeriod));
  const operatingYears = Math.max(1, Math.round(inputs.operatingPeriod));
  const debtFraction = sizing.debtFraction;

  const initialLandEquity = baseResult.totalLandAcquisitionCost * (1 - debtFraction);
  const totalConstructionEquity = baseResult.totalConstructionCost * (1 - debtFraction);
  const perYearConstructionEquity = totalConstructionEquity / constructionYears;
  const equityRequired = initialLandEquity + totalConstructionEquity;
  const leveredCashflows = [-initialLandEquity];
  for (let year = 0; year < constructionYears; year += 1) {
    leveredCashflows.push(-perYearConstructionEquity);
  }

  for (let year = 1; year <= operatingYears; year += 1) {
    const noi = baseResult.operatingNoiCashflows[year - 1] ?? 0;
    const debtService = termPlan.annualDebtService[year - 1] || 0;
    if (year < operatingYears) {
      leveredCashflows.push(noi - debtService);
    } else {
      const remainingBalance = getRemainingBalanceAtYear(termPlan, year);
      leveredCashflows.push(noi - debtService + baseResult.terminalNetExitValue - remainingBalance);
    }
  }

  const leveredIRR = computeIRR(leveredCashflows);
  const equityDiscountRate = inputs.hurdleRate + inputs.equityRiskSpread;
  const leveredNPV = computeNPV(equityDiscountRate, leveredCashflows);
  const dscrMin = sizing.dscrAtDebtFraction;
  const c5 = dscrMin !== null && dscrMin >= inputs.minDscrThreshold;
  const c6 = Number.isFinite(leveredNPV) && leveredNPV >= 0;
  const { criteria, verdictResult } = updateDecisionForFinancing(baseResult, c5, c6);

  return {
    ...baseResult,
    financingEngineVersion: LAND_FINANCING_ENGINE_VERSION,
    ...commonFinancingEvidence(inputs, termPlan, financingClassification),
    loanSizingConstraint: sizing.bindingConstraint,
    ltcPrincipalLimit: baseResult.totalProjectCost * inputs.ltv,
    constructionDebtFraction: debtFraction,
    loanAmount: facility.principalDebtDraws,
    equityRequired,
    initialEquityRequired: initialLandEquity,
    totalConstructionEquity,
    constructionLoanBalance: facility.completionBalance,
    termRefinanceBalance: facility.completionBalance,
    capitalizedConstructionInterest: facility.capitalizedInterest,
    constructionDebtSchedule: facility.schedule,
    annualConstructionDebtDraws: buildAnnualConstructionDebtDraws(facility),
    dscrMin,
    leveredCashflows,
    leveredIRR,
    leveredNPV,
    equityDiscountRate,
    c5,
    c6,
    criteriaDetail: criteria,
    metCount: verdictResult.met,
    totalCriteria: verdictResult.total,
    verdict: verdictResult.verdict,
    decisionStatus: verdictResult.decisionStatus,
    failedHardGates: verdictResult.failedHardGates,
    failedSoftCriteria: verdictResult.failedSoftCriteria,
  };
}

function applyFinancingRemediation({ studyType, inputs, engineResult }) {
  if (!inputs.leverageEnabled) return engineResult;
  if (studyType === STUDY_TYPE.EXISTING_BUILDING) {
    return applyExistingBuildingFinancing(inputs, engineResult);
  }
  if (studyType === STUDY_TYPE.LAND_DEVELOPMENT) {
    return applyLandDevelopmentFinancing(inputs, engineResult);
  }
  return engineResult;
}

module.exports = {
  BUILDING_FINANCING_ENGINE_VERSION,
  LAND_FINANCING_ENGINE_VERSION,
  getRemainingBalanceAtYear,
  buildAnnualNoiForDebtSizing,
  applyExistingBuildingFinancing,
  applyLandDevelopmentFinancing,
  applyFinancingRemediation,
};
