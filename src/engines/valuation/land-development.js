'use strict';

// Financial Engine Remediation Wave A.
// Corrects duplicated decision criteria, non-positive-NOI payback behaviour,
// missing post-construction lease-up, and all-variable OPEX. Exit cap remains
// independently modeled and the decision layer now treats IRR/NPV/DSCR as
// hard gates rather than votes in a simple count.
const { computeNPV, computeIRR, amortizationSchedule } = require('../financial');
const { tierVerdict } = require('../recommendation');
const {
  finiteOr,
  leaseUpFactorFromMonths,
  computeCumulativePaybackYears,
  buildExpenseModel,
  grow,
} = require('../financial/model-utils');

const FINANCIAL_MODEL_VERSION = 'LAND_WAVE_A_2.0';

function calcLandDevelopment(inp) {
  const landArea = inp.landLength * inp.landWidth;
  const landMarketValue = landArea * inp.landPricePerSqm;

  const floorPlateArea = landArea * inp.buildableRatio;
  const serviceAreaPerFloor = floorPlateArea * inp.servicesRatioPerFloor;
  const netLeasableAreaPerFloor = floorPlateArea - serviceAreaPerFloor;
  const totalNetLeasableArea = netLeasableAreaPerFloor * inp.officeFloorCount;
  const totalOfficeFloorArea = floorPlateArea * inp.officeFloorCount;
  const totalBasementArea = landArea * inp.basementFloorCount;
  const totalBuiltArea = totalOfficeFloorArea + totalBasementArea;

  const totalConstructionCost = totalBuiltArea * inp.constructionCostPerSqm;
  const landCommission = landMarketValue * inp.landCommissionRate;
  const landTransferFee = landMarketValue * inp.landTransferFeeRate;
  const totalLandAcquisitionCost = landMarketValue + landCommission + landTransferFee + inp.engineeringCost + inp.landValuationCost;
  const totalProjectCost = totalLandAcquisitionCost + totalConstructionCost;
  const costPerSqm = totalNetLeasableArea > 0 ? totalProjectCost / totalNetLeasableArea : 0;

  const leaseUpMonths = Math.max(0, finiteOr(inp.leaseUpMonths));
  const initialLeaseUpFactor = leaseUpFactorFromMonths(leaseUpMonths);
  const variableOpexRate = Number.isFinite(inp.variableOpexRate) ? inp.variableOpexRate : finiteOr(inp.opexRate);
  const fixedOpexPerSqm = Math.max(0, finiteOr(inp.fixedOpexPerSqm));
  const managementFeeRate = Math.max(0, finiteOr(inp.managementFeeRate));
  const insuranceRateOnReplacementCost = Math.max(0, finiteOr(inp.insuranceRateOnReplacementCost));
  const replacementReservePerSqm = Math.max(0, finiteOr(inp.replacementReservePerSqm));
  const opexGrowthRate = finiteOr(inp.opexGrowthRate);
  const replacementCostGrowthRate = finiteOr(inp.replacementCostGrowthRate);

  const grossRentalIncome = totalNetLeasableArea * inp.marketRentPerSqm;
  const stabilizedActualRentalIncome = grossRentalIncome * inp.occupancyRate;
  const stabilizedServiceIncome = stabilizedActualRentalIncome * inp.serviceIncomeRate;
  const stabilizedOperatingRevenue = stabilizedActualRentalIncome + stabilizedServiceIncome;

  function yearEconomics(yearIndex, leaseFactor = 1) {
    const rental = grow(stabilizedActualRentalIncome, inp.rentGrowthRate, yearIndex) * leaseFactor;
    const service = rental * inp.serviceIncomeRate;
    const revenue = rental + service;
    const expense = buildExpenseModel({
      revenue,
      netLeasableArea: totalNetLeasableArea,
      replacementValue: grow(totalConstructionCost, replacementCostGrowthRate, yearIndex),
      fixedOpexPerSqm: grow(fixedOpexPerSqm, opexGrowthRate, yearIndex),
      variableOpexRate,
      managementFeeRate,
      insuranceRateOnReplacementCost,
      replacementReservePerSqm: grow(replacementReservePerSqm, opexGrowthRate, yearIndex),
    });
    return { rental, service, revenue, ...expense, NOI: expense.noiAfterReserve };
  }

  const stabilizedEconomics = yearEconomics(0, 1);
  const firstOperatingYearEconomics = yearEconomics(0, initialLeaseUpFactor);
  const actualRentalIncome = stabilizedActualRentalIncome;
  const serviceIncome = stabilizedServiceIncome;
  const totalOperatingRevenue = stabilizedOperatingRevenue;
  const operatingExpenses = stabilizedEconomics.totalEconomicExpenses;
  const stabilizedNOI = stabilizedEconomics.NOI;
  const firstOperatingYearNOI = firstOperatingYearEconomics.NOI;
  const financialModelStatus = stabilizedNOI > 0 ? 'VALID' : 'INVALID_ECONOMIC_CASE';

  const capRateOnCost = totalProjectCost > 0 ? stabilizedNOI / totalProjectCost : null;
  const marketValueAfterCompletion = inp.marketCapRate > 0 && stabilizedNOI > 0 ? stabilizedNOI / inp.marketCapRate : 0;
  const valueSurplusOverCost = marketValueAfterCompletion - totalProjectCost;
  const projectCostToNoiMultiple = stabilizedNOI > 0 ? totalProjectCost / stabilizedNOI : null;

  // Goal-seek remains a payback/yield boundary but now explicitly solves the
  // full land acquisition load; it is not presented as an appraisal.
  const requiredYield = Math.max(1 / inp.maxPaybackThreshold, 0);
  const targetProjectCost = stabilizedNOI > 0 && requiredYield > 0 ? stabilizedNOI / requiredYield : 0;
  const targetLandAcquisitionCost = targetProjectCost - totalConstructionCost;
  const feeLoad = 1 + inp.landCommissionRate + inp.landTransferFeeRate;
  const targetLandMarketValue = feeLoad > 0
    ? (targetLandAcquisitionCost - inp.engineeringCost - inp.landValuationCost) / feeLoad
    : 0;
  const maxJustifiedLandPricePerSqm = landArea > 0 ? Math.max(0, targetLandMarketValue / landArea) : 0;

  const cashflows = [-totalLandAcquisitionCost];
  const paybackCashflows = [-totalLandAcquisitionCost];
  const constructionYears = Math.max(1, Math.round(inp.constructionPeriod));
  const perYearConstructionDraw = totalConstructionCost / constructionYears;
  for (let y = 0; y < constructionYears; y += 1) {
    cashflows.push(-perYearConstructionDraw);
    paybackCashflows.push(-perYearConstructionDraw);
  }

  const operatingYears = Math.max(1, Math.round(inp.operatingPeriod));
  const operatingNoiCashflows = [];
  let terminalExitValue = 0;
  let terminalNetExitValue = 0;
  for (let y = 1; y <= operatingYears; y += 1) {
    const yearEconomicsResult = yearEconomics(y - 1, y === 1 ? initialLeaseUpFactor : 1);
    const yearNoi = yearEconomicsResult.NOI;
    operatingNoiCashflows.push(yearNoi);
    paybackCashflows.push(yearNoi);
    if (y < operatingYears) {
      cashflows.push(yearNoi);
    } else {
      const forwardStabilizedNOI = yearEconomics(y, 1).NOI;
      terminalExitValue = inp.exitCapRate > 0 && forwardStabilizedNOI > 0 ? forwardStabilizedNOI / inp.exitCapRate : 0;
      const exitTransferFee = terminalExitValue * inp.exitTransferFeeRate;
      terminalNetExitValue = terminalExitValue - exitTransferFee;
      cashflows.push(yearNoi + terminalNetExitValue);
    }
  }

  const simplePaybackYears = stabilizedNOI > 0 ? computeCumulativePaybackYears(paybackCashflows) : null;
  const irr = computeIRR(cashflows);
  const npv = computeNPV(inp.hurdleRate, cashflows);

  // Leverage remains annual in Wave A. Monthly amortization, grace/balloon,
  // Islamic structures, and DSCR-constrained debt sizing are Wave B.
  const loanToCost = inp.ltv;
  const landDebtDraw = totalLandAcquisitionCost * loanToCost;
  const landEquityDraw = totalLandAcquisitionCost - landDebtDraw;
  const perYearConstructionDebtDraw = perYearConstructionDraw * loanToCost;
  const perYearConstructionEquityDraw = perYearConstructionDraw - perYearConstructionDebtDraw;

  let constructionLoanBalance = landDebtDraw;
  for (let y = 0; y < constructionYears; y += 1) {
    constructionLoanBalance = constructionLoanBalance * (1 + inp.loanRate) + perYearConstructionDebtDraw;
  }
  const { payment: debtService, schedule: loanSchedule } = amortizationSchedule(constructionLoanBalance, inp.loanRate, inp.loanTenor);

  const leveredCashflows = [-landEquityDraw];
  for (let y = 0; y < constructionYears; y += 1) leveredCashflows.push(-perYearConstructionEquityDraw);

  let dscrMin = Infinity;
  for (let y = 1; y <= operatingYears; y += 1) {
    const yearNoi = operatingNoiCashflows[y - 1];
    const ds = y <= loanSchedule.length ? debtService : 0;
    if (ds > 0) dscrMin = Math.min(dscrMin, yearNoi / ds);
    const remBalance = y === operatingYears && y <= loanSchedule.length ? loanSchedule[y - 1].balance : 0;
    if (y < operatingYears) {
      leveredCashflows.push(yearNoi - ds);
    } else {
      leveredCashflows.push(yearNoi - ds + terminalNetExitValue - remBalance);
    }
  }
  if (dscrMin === Infinity) dscrMin = null;
  const leveredIRR = computeIRR(leveredCashflows);
  const equityDiscountRate = inp.hurdleRate + inp.equityRiskSpread;
  const leveredNPV = computeNPV(equityDiscountRate, leveredCashflows);

  const c0 = stabilizedNOI > 0;
  const c1 = c0 && simplePaybackYears !== null && simplePaybackYears <= inp.maxPaybackThreshold;
  const c2 = c0 && Number.isFinite(npv) && npv >= 0;
  const c3 = c0 && Number.isFinite(irr) && irr >= inp.hurdleRate;
  const c4 = c0 && marketValueAfterCompletion >= totalProjectCost;
  const c5 = inp.leverageEnabled ? dscrMin !== null && dscrMin >= inp.minDscrThreshold : null;
  const c6 = inp.leverageEnabled ? Number.isFinite(leveredNPV) && leveredNPV >= 0 : null;

  const criteria = [
    { code: 'STABILIZED_NOI_POSITIVE', met: c0, hardGate: true },
    { code: 'CUMULATIVE_PROJECT_PAYBACK', met: c1, hardGate: false },
    { code: 'NPV_NON_NEGATIVE', met: c2, hardGate: true },
    { code: 'IRR_MEETS_HURDLE', met: c3, hardGate: true },
    { code: 'COMPLETION_VALUE_COVERS_COST', met: c4, hardGate: false },
  ];
  if (inp.leverageEnabled) {
    criteria.push({ code: 'DSCR_MINIMUM', met: c5, hardGate: true });
    criteria.push({ code: 'LEVERED_NPV_NON_NEGATIVE', met: c6, hardGate: true });
  }
  const verdictResult = tierVerdict(criteria);

  return {
    financialModelVersion: FINANCIAL_MODEL_VERSION,
    financialModelStatus,
    landArea, landMarketValue, floorPlateArea, serviceAreaPerFloor, netLeasableAreaPerFloor,
    totalNetLeasableArea, totalOfficeFloorArea, totalBasementArea, totalBuiltArea,
    totalConstructionCost, landCommission, landTransferFee, totalLandAcquisitionCost, totalProjectCost, costPerSqm,
    grossRentalIncome, actualRentalIncome, serviceIncome, totalOperatingRevenue,
    leaseUpMonths, initialLeaseUpFactor, firstOperatingYearRevenue: firstOperatingYearEconomics.revenue,
    fixedOperatingExpense: stabilizedEconomics.fixedOperatingExpense,
    variableOperatingExpense: stabilizedEconomics.variableOperatingExpense,
    managementFeeAmount: stabilizedEconomics.managementFeeAmount,
    insuranceAmount: stabilizedEconomics.insuranceAmount,
    replacementReserveAmount: stabilizedEconomics.replacementReserveAmount,
    operatingExpensesBeforeReserve: stabilizedEconomics.operatingExpensesBeforeReserve,
    operatingExpenses, stabilizedNOI, firstOperatingYearNOI, noiBeforeReserve: stabilizedEconomics.noiBeforeReserve,
    capRateOnCost, marketValueAfterCompletion, valueSurplusOverCost, simplePaybackYears, projectCostToNoiMultiple,
    maxJustifiedLandPricePerSqm,
    cashflows, paybackCashflows, operatingNoiCashflows, irr, npv, terminalExitValue, terminalNetExitValue,
    constructionYears, operatingYears,
    loanAmount: landDebtDraw, equityRequired: landEquityDraw, constructionLoanBalance, debtService, dscrMin,
    leveredCashflows, leveredIRR, leveredNPV, equityDiscountRate,
    c0, c1, c2, c3, c4, c5, c6,
    metCount: verdictResult.met,
    totalCriteria: verdictResult.total,
    verdict: verdictResult.verdict,
    decisionStatus: verdictResult.decisionStatus,
    criteriaDetail: verdictResult.criteria,
    failedHardGates: verdictResult.failedHardGates,
    failedSoftCriteria: verdictResult.failedSoftCriteria,
  };
}

module.exports = { FINANCIAL_MODEL_VERSION, calcLandDevelopment };
