'use strict';

// Financial Engine Remediation Wave A.
// The legacy source remains frozen separately for source-integrity tests. This
// canonical engine intentionally corrects model defects proven by independent
// numerical review: one-time lease-up is no longer capitalized forever,
// terminal value uses stabilized forward NOI and an independent exit cap,
// payback is derived from cumulative cash flow, OPEX is decomposed into fixed
// and variable components, and hard economic gates cannot be overridden by a
// simple criterion count.
const { computeNPV, computeIRR, amortizationSchedule } = require('../financial');
const { tierVerdict } = require('../recommendation');
const {
  finiteOr,
  positiveOrNull,
  leaseUpFactorFromMonths,
  computeCumulativePaybackYears,
  buildExpenseModel,
  grow,
} = require('../financial/model-utils');

const VACANCY_MONTHS_MAP = { 'مؤجر': 0, '3 أشهر': 3, '6 أشهر': 6, '9 أشهر': 9, 'سنة': 12 };
const FINANCIAL_MODEL_VERSION = 'BUILDING_WAVE_A_2.0';

function calcExistingBuilding(inp) {
  const landArea = inp.landLength * inp.landWidth;
  const totalBasementArea = inp.basementCount * inp.basementAreaEach;
  const totalParkingSpots = inp.parkingAreaPerSpot > 0 ? Math.floor(totalBasementArea / inp.parkingAreaPerSpot) : 0;
  const totalFloorArea = inp.floorCount * inp.floorAreaEach;
  const netLeasableArea = inp.netLeasableOverride > 0 ? inp.netLeasableOverride : totalFloorArea * inp.efficiencyRatio;
  const avgNetAreaPerFloor = inp.floorCount > 0 ? netLeasableArea / inp.floorCount : 0;
  const totalBuiltArea = totalBasementArea + totalFloorArea;
  const coverageRatio = landArea > 0 ? totalBuiltArea / landArea : 0;
  const areaCheckOk = netLeasableArea <= totalFloorArea;

  const commissionAmount = inp.buildingPrice * inp.commissionRate;
  const transferFeeAmount = inp.buildingPrice * inp.transferFeeRate;
  const totalPurchaseCost = inp.buildingPrice + commissionAmount + transferFeeAmount + inp.inspectionCost + inp.valuationCost;
  const costPerSqm = netLeasableArea > 0 ? totalPurchaseCost / netLeasableArea : 0;

  const basementConstructionValue = totalBasementArea * inp.basementConstructionCostPerSqm;
  const floorConstructionValue = totalFloorArea * inp.floorConstructionCostPerSqm;
  const totalReplacementConstructionValue = basementConstructionValue + floorConstructionValue;
  const currentLandValue = landArea * inp.currentLandPricePerSqm;
  const totalAppraisedValue = totalReplacementConstructionValue + currentLandValue;
  const annualDepreciation = inp.buildingUsefulLife > 0 ? totalReplacementConstructionValue / inp.buildingUsefulLife : 0;

  const vacancyMonths = VACANCY_MONTHS_MAP[inp.leaseStatus] ?? 0;
  const initialLeaseUpFactor = leaseUpFactorFromMonths(vacancyMonths);
  const variableOpexRate = Number.isFinite(inp.variableOpexRate) ? inp.variableOpexRate : finiteOr(inp.maintenanceRate);
  const insuranceRateOnReplacementCost = Number.isFinite(inp.insuranceRateOnReplacementCost)
    ? inp.insuranceRateOnReplacementCost
    : finiteOr(inp.insuranceRate);
  const fixedOpexPerSqm = Math.max(0, finiteOr(inp.fixedOpexPerSqm));
  const managementFeeRate = Math.max(0, finiteOr(inp.managementFeeRate));
  const replacementReservePerSqm = Math.max(0, finiteOr(inp.replacementReservePerSqm));
  const opexGrowthRate = finiteOr(inp.opexGrowthRate);
  const replacementCostGrowthRate = finiteOr(inp.replacementCostGrowthRate);
  const exitCapRate = positiveOrNull(inp.exitCapRate) || positiveOrNull(inp.marketCapRate);

  const stabilizedGrossRentalIncome = netLeasableArea * inp.rentPerSqm * inp.occupancyRate;
  const stabilizedServiceIncome = stabilizedGrossRentalIncome * inp.serviceIncomeRate;
  const stabilizedTotalAnnualIncome = stabilizedGrossRentalIncome + stabilizedServiceIncome;

  function yearEconomics(yearIndex, leaseFactor = 1) {
    const rental = grow(stabilizedGrossRentalIncome, inp.rentGrowthRate, yearIndex) * leaseFactor;
    const service = rental * inp.serviceIncomeRate;
    const revenue = rental + service;
    const expense = buildExpenseModel({
      revenue,
      netLeasableArea,
      replacementValue: grow(totalReplacementConstructionValue, replacementCostGrowthRate, yearIndex),
      fixedOpexPerSqm: grow(fixedOpexPerSqm, opexGrowthRate, yearIndex),
      variableOpexRate,
      managementFeeRate,
      insuranceRateOnReplacementCost,
      replacementReservePerSqm: grow(replacementReservePerSqm, opexGrowthRate, yearIndex),
    });
    return { rental, service, revenue, ...expense, NOI: expense.noiAfterReserve };
  }

  const stabilizedEconomics = yearEconomics(0, 1);
  const firstYearEconomics = yearEconomics(0, initialLeaseUpFactor);
  const grossRentalIncome = stabilizedGrossRentalIncome;
  const vacancyDeduction = stabilizedGrossRentalIncome - firstYearEconomics.rental;
  const rentalIncomeAfterVacancy = firstYearEconomics.rental;
  const serviceIncome = stabilizedServiceIncome;
  const firstYearServiceIncome = firstYearEconomics.service;
  const totalAnnualIncome = stabilizedTotalAnnualIncome;
  const firstYearTotalAnnualIncome = firstYearEconomics.revenue;
  const vatCollected = firstYearTotalAnnualIncome * inp.vatRate;
  const opexAmount = stabilizedEconomics.totalEconomicExpenses;
  const NOI = stabilizedEconomics.NOI;
  const firstYearNOI = firstYearEconomics.NOI;

  const financialModelStatus = NOI > 0 ? 'VALID' : 'INVALID_ECONOMIC_CASE';
  const netYieldOnCost = totalPurchaseCost > 0 ? NOI / totalPurchaseCost : null;
  const grossYieldOnCost = totalPurchaseCost > 0 ? totalAnnualIncome / totalPurchaseCost : null;
  const netYieldOnPrice = inp.buildingPrice > 0 ? NOI / inp.buildingPrice : null;
  const priceToNoiMultiple = NOI > 0 ? inp.buildingPrice / NOI : NaN;

  const marketValueByIncomeCap = inp.marketCapRate > 0 && NOI > 0 ? NOI / inp.marketCapRate : 0;
  const valueGapVsCost = marketValueByIncomeCap - totalPurchaseCost;

  // Actual hold-period operating sequence used by IRR/NPV.
  const operatingNoiCashflows = [];
  for (let y = 1; y <= inp.holdPeriod; y += 1) {
    operatingNoiCashflows.push(yearEconomics(y - 1, y === 1 ? initialLeaseUpFactor : 1).NOI);
  }

  // Payback is an operating-recovery metric, not a synonym for the holding
  // period. Evaluate it over the declared useful life so a 5-year hold does
  // not automatically turn a 9-12 year payback into "unknown". Terminal sale
  // proceeds are intentionally excluded from payback.
  const paybackHorizonYears = Math.max(
    Math.max(1, Math.round(inp.holdPeriod)),
    Math.max(1, Math.round(inp.buildingUsefulLife || inp.holdPeriod)),
  );
  const paybackNoiCashflows = [];
  for (let y = 1; y <= paybackHorizonYears; y += 1) {
    paybackNoiCashflows.push(yearEconomics(y - 1, y === 1 ? initialLeaseUpFactor : 1).NOI);
  }
  const cumulativePaybackOnCost = NOI > 0
    ? computeCumulativePaybackYears([-totalPurchaseCost, ...paybackNoiCashflows])
    : null;
  const cumulativePaybackOnPrice = NOI > 0
    ? computeCumulativePaybackYears([-inp.buildingPrice, ...paybackNoiCashflows])
    : null;
  // Legacy UI fields historically assume a numeric/non-finite value and use
  // global isFinite() before toFixed(). Preserve that rendering contract with
  // NaN while exposing explicit nullable v2 fields above for machine consumers.
  const paybackOnCost = cumulativePaybackOnCost === null ? NaN : cumulativePaybackOnCost;
  const paybackOnPrice = cumulativePaybackOnPrice === null ? NaN : cumulativePaybackOnPrice;

  const cashflows = [-totalPurchaseCost];
  let terminalSaleValue = 0;
  let terminalNetSaleProceeds = 0;
  for (let y = 1; y <= inp.holdPeriod; y += 1) {
    const yearNoi = operatingNoiCashflows[y - 1];
    if (y < inp.holdPeriod) {
      cashflows.push(yearNoi);
    } else {
      const forwardStabilizedNOI = yearEconomics(y, 1).NOI;
      terminalSaleValue = exitCapRate && forwardStabilizedNOI > 0 ? forwardStabilizedNOI / exitCapRate : 0;
      const saleTransferFee = terminalSaleValue * inp.transferFeeRate;
      terminalNetSaleProceeds = terminalSaleValue - saleTransferFee;
      cashflows.push(yearNoi + terminalNetSaleProceeds);
    }
  }
  const irr = computeIRR(cashflows);
  const npv = computeNPV(inp.discountRate, cashflows);

  const requiredYield = Math.max(inp.minYieldThreshold, 1 / inp.maxPaybackThreshold);
  const targetTotalAcquisitionCost = NOI > 0 && requiredYield > 0 ? NOI / requiredYield : 0;
  const purchaseLoad = 1 + inp.commissionRate + inp.transferFeeRate;
  const maxJustifiedPrice = purchaseLoad > 0
    ? Math.max(0, (targetTotalAcquisitionCost - inp.inspectionCost - inp.valuationCost) / purchaseLoad)
    : 0;

  // Leverage remains annual in Wave A; monthly amortization and DSCR-constrained
  // sizing are explicitly Wave B. The corrected operating/terminal economics
  // are nevertheless used here so leverage no longer inherits the lease-up bug.
  const loanAmount = inp.ltv * totalPurchaseCost;
  const equityRequired = totalPurchaseCost - loanAmount;
  const { payment: debtService, schedule: loanSchedule } = amortizationSchedule(loanAmount, inp.loanRate, inp.loanTenor);
  const leveredCashflows = [-equityRequired];
  let dscrMin = Infinity;
  for (let y = 1; y <= inp.holdPeriod; y += 1) {
    const yearNoi = operatingNoiCashflows[y - 1];
    const ds = y <= loanSchedule.length ? debtService : 0;
    if (ds > 0) dscrMin = Math.min(dscrMin, yearNoi / ds);
    const remBalance = y === inp.holdPeriod && y <= loanSchedule.length ? loanSchedule[y - 1].balance : 0;
    if (y < inp.holdPeriod) {
      leveredCashflows.push(yearNoi - ds);
    } else {
      leveredCashflows.push(yearNoi - ds + terminalNetSaleProceeds - remBalance);
    }
  }
  if (dscrMin === Infinity) dscrMin = null;
  const leveredIRR = computeIRR(leveredCashflows);
  const equityDiscountRate = inp.discountRate + inp.equityRiskSpread;
  const leveredNPV = computeNPV(equityDiscountRate, leveredCashflows);

  const c0 = NOI > 0;
  const c1 = c0 && netYieldOnCost !== null && netYieldOnCost >= inp.minYieldThreshold;
  const c2 = c0 && cumulativePaybackOnCost !== null && cumulativePaybackOnCost <= inp.maxPaybackThreshold;
  const c3 = c0 && Number.isFinite(irr) && irr >= inp.discountRate;
  const c4 = c0 && marketValueByIncomeCap >= totalPurchaseCost;
  const c5 = inp.leverageEnabled ? dscrMin !== null && dscrMin >= inp.minDscrThreshold : null;
  const c6 = c0 && Number.isFinite(npv) && npv >= 0;
  const c7 = inp.leverageEnabled ? Number.isFinite(leveredNPV) && leveredNPV >= 0 : null;

  const criteria = [
    { code: 'STABILIZED_NOI_POSITIVE', met: c0, hardGate: true },
    { code: 'NET_YIELD_ON_COST', met: c1, hardGate: false },
    { code: 'CUMULATIVE_PAYBACK', met: c2, hardGate: false },
    { code: 'IRR_MEETS_HURDLE', met: c3, hardGate: true },
    { code: 'NPV_NON_NEGATIVE', met: c6, hardGate: true },
    { code: 'INCOME_VALUE_COVERS_COST', met: c4, hardGate: false },
  ];
  if (inp.leverageEnabled) {
    criteria.push({ code: 'DSCR_MINIMUM', met: c5, hardGate: true });
    criteria.push({ code: 'LEVERED_NPV_NON_NEGATIVE', met: c7, hardGate: true });
  }
  const verdictResult = tierVerdict(criteria);

  return {
    financialModelVersion: FINANCIAL_MODEL_VERSION,
    financialModelStatus,
    landArea, totalBasementArea, totalParkingSpots, totalFloorArea, netLeasableArea, avgNetAreaPerFloor,
    totalBuiltArea, coverageRatio, areaCheckOk,
    commissionAmount, transferFeeAmount, totalPurchaseCost, costPerSqm,
    grossRentalIncome, stabilizedGrossRentalIncome, vacancyMonths, initialLeaseUpFactor, vacancyDeduction,
    rentalIncomeAfterVacancy, serviceIncome, firstYearServiceIncome, totalAnnualIncome, firstYearTotalAnnualIncome, vatCollected,
    fixedOperatingExpense: stabilizedEconomics.fixedOperatingExpense,
    variableOperatingExpense: stabilizedEconomics.variableOperatingExpense,
    managementFeeAmount: stabilizedEconomics.managementFeeAmount,
    insuranceAmount: stabilizedEconomics.insuranceAmount,
    replacementReserveAmount: stabilizedEconomics.replacementReserveAmount,
    operatingExpensesBeforeReserve: stabilizedEconomics.operatingExpensesBeforeReserve,
    opexAmount, NOI, firstYearNOI, noiBeforeReserve: stabilizedEconomics.noiBeforeReserve,
    netYieldOnCost, grossYieldOnCost,
    cumulativePaybackOnCost, cumulativePaybackOnPrice, paybackHorizonYears, paybackNoiCashflows,
    paybackOnCost, netYieldOnPrice, paybackOnPrice, priceToNoiMultiple,
    marketValueByIncomeCap, valueGapVsCost, exitCapRate, terminalSaleValue, terminalNetSaleProceeds,
    basementConstructionValue, floorConstructionValue, totalReplacementConstructionValue, currentLandValue,
    totalAppraisedValue, annualDepreciation,
    cashflows, operatingNoiCashflows, irr, npv, maxJustifiedPrice,
    loanAmount, equityRequired, debtService, dscrMin, leveredCashflows, leveredIRR, leveredNPV, equityDiscountRate,
    c0, c1, c2, c3, c4, c5, c6, c7,
    metCount: verdictResult.met,
    totalCriteria: verdictResult.total,
    verdict: verdictResult.verdict,
    decisionStatus: verdictResult.decisionStatus,
    criteriaDetail: verdictResult.criteria,
    failedHardGates: verdictResult.failedHardGates,
    failedSoftCriteria: verdictResult.failedSoftCriteria,
  };
}

module.exports = { VACANCY_MONTHS_MAP, FINANCIAL_MODEL_VERSION, calcExistingBuilding };
