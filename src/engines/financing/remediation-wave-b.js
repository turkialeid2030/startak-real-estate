'use strict';

const { computeNPV, computeIRR, sizeDebtByLtvAndDscr, classifyFinancingModel } = require('../financial');
const { tierVerdict } = require('../recommendation');
const { STUDY_TYPE } = require('../../contracts/study-type');

const FINANCING_ENGINE_VERSION = 'MONTHLY_DSCR_WAVE_B_1.0';

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
  return {
    criteria,
    verdictResult,
  };
}

function applyExistingBuildingFinancing(inputs, baseResult) {
  const annualNoi = buildAnnualNoiForDebtSizing(baseResult, inputs);
  const gracePeriodMonths = inputs.gracePeriodMonths == null ? 0 : inputs.gracePeriodMonths;
  const graceType = inputs.graceType || 'INTEREST_ONLY';
  const balloonPct = inputs.balloonPct == null ? 0 : inputs.balloonPct;
  const financingClassification = classifyFinancingModel(inputs.financingStructureLabel);

  const sizing = sizeDebtByLtvAndDscr({
    costBase: baseResult.totalPurchaseCost,
    ltv: inputs.ltv,
    annualNoi,
    minDscrThreshold: inputs.minDscrThreshold,
    annualRate: inputs.loanRate,
    tenorYears: inputs.loanTenor,
    options: { gracePeriodMonths, graceType, balloonPct },
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

  const firstYearDebtService = sizing.plan.annualDebtService[0] || 0;
  const debtServicePeak = sizing.plan.annualDebtService.length
    ? Math.max(...sizing.plan.annualDebtService)
    : 0;

  return {
    ...baseResult,
    financingEngineVersion: FINANCING_ENGINE_VERSION,
    financingModelType: financingClassification.modelType,
    financingModelBoundary: financingClassification.boundary,
    exactContractModel: financingClassification.exactContractModel,
    loanSizingConstraint: sizing.bindingConstraint,
    ltvLoanLimit: sizing.ltvLimit,
    dscrLoanLimit: sizing.dscrLimit,
    loanAmount,
    equityRequired,
    tenorMonths: sizing.plan.tenorMonths,
    gracePeriodMonths,
    graceType,
    balloonPct,
    balloonAmount: sizing.plan.balloonAmount,
    scheduledMonthlyPayment: sizing.plan.scheduledMonthlyPayment,
    annualDebtService: sizing.plan.annualDebtService,
    annualDebtSchedule: sizing.plan.annualSchedule,
    debtService: firstYearDebtService,
    debtServiceBasis: 'YEAR_1_ACTUAL',
    debtServicePeak,
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

function applyFinancingRemediation({ studyType, inputs, engineResult }) {
  if (!inputs.leverageEnabled) return engineResult;
  if (studyType === STUDY_TYPE.EXISTING_BUILDING) {
    return applyExistingBuildingFinancing(inputs, engineResult);
  }
  // Land-development construction financing requires a drawdown/refinancing
  // model and is intentionally not replaced by a false generic term-loan model
  // in Wave B1. The raw construction financing remains until Wave B2.
  return engineResult;
}

module.exports = {
  FINANCING_ENGINE_VERSION,
  getRemainingBalanceAtYear,
  buildAnnualNoiForDebtSizing,
  applyExistingBuildingFinancing,
  applyFinancingRemediation,
};
