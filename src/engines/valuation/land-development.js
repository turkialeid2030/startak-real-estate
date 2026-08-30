// src/engines/valuation/land-development.js -- EXTRACTED VERBATIM from platform-source.jsx lines 264-383.
// (calcLandDevelopment -- valuation AND financing logic are interleaved in the original function body
// and are NOT split here; see REBASE_CHANGE_MANIFEST.csv row for this file.)
// Module-linkage require() added -- this is wiring, not a formula change (see manifest).
const { computeNPV, computeIRR, amortizationSchedule } = require('../financial');
const { tierVerdict } = require('../recommendation');

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

  const grossRentalIncome = totalNetLeasableArea * inp.marketRentPerSqm;
  const actualRentalIncome = grossRentalIncome * inp.occupancyRate;
  const serviceIncome = actualRentalIncome * inp.serviceIncomeRate;
  const totalOperatingRevenue = actualRentalIncome + serviceIncome;
  const operatingExpenses = totalOperatingRevenue * inp.opexRate;
  const stabilizedNOI = totalOperatingRevenue - operatingExpenses;

  const capRateOnCost = totalProjectCost > 0 ? stabilizedNOI / totalProjectCost : 0;

  // --- Goal-seek: max land price/sqm that still clears the payback/cap-rate-on-cost criteria (mirrors building's maxJustifiedPrice) ---
  const targetProjectCost = stabilizedNOI * inp.maxPaybackThreshold;
  const targetLandAcquisitionCost = targetProjectCost - totalConstructionCost;
  const feeLoad = 1 + inp.landCommissionRate + inp.landTransferFeeRate;
  const targetLandMarketValue = (targetLandAcquisitionCost - inp.engineeringCost - inp.landValuationCost) / feeLoad;
  const maxJustifiedLandPricePerSqm = landArea > 0 ? targetLandMarketValue / landArea : 0;
  const marketValueAfterCompletion = inp.marketCapRate > 0 ? stabilizedNOI / inp.marketCapRate : 0;
  const valueSurplusOverCost = marketValueAfterCompletion - totalProjectCost;
  const simplePaybackYears = stabilizedNOI > 0 ? totalProjectCost / stabilizedNOI : 0;

  const cashflows = [-totalLandAcquisitionCost];
  const constructionYears = Math.max(1, Math.round(inp.constructionPeriod));
  const perYearConstructionDraw = totalConstructionCost / constructionYears;
  for (let y = 0; y < constructionYears; y++) cashflows.push(-perYearConstructionDraw);

  const operatingYears = Math.max(1, Math.round(inp.operatingPeriod));
  let noiYear = stabilizedNOI;
  for (let y = 1; y <= operatingYears; y++) {
    if (y > 1) noiYear = noiYear * (1 + inp.rentGrowthRate);
    if (y < operatingYears) {
      cashflows.push(noiYear);
    } else {
      const forwardNOI = noiYear * (1 + inp.rentGrowthRate);
      const exitValue = inp.exitCapRate > 0 ? forwardNOI / inp.exitCapRate : 0;
      const exitTransferFee = exitValue * inp.exitTransferFeeRate;
      const netExitValue = exitValue - exitTransferFee;
      cashflows.push(noiYear + netExitValue);
    }
  }
  const irr = computeIRR(cashflows);
  const npv = computeNPV(inp.hurdleRate, cashflows);

  // --- Leverage (always computed; UI/recommendation show it only when leverageEnabled) ---
  const loanToCost = inp.ltv;
  const landDebtDraw = totalLandAcquisitionCost * loanToCost;
  const landEquityDraw = totalLandAcquisitionCost - landDebtDraw;
  const perYearConstructionDebtDraw = perYearConstructionDraw * loanToCost;
  const perYearConstructionEquityDraw = perYearConstructionDraw - perYearConstructionDebtDraw;

  let constructionLoanBalance = landDebtDraw;
  for (let y = 0; y < constructionYears; y++) {
    constructionLoanBalance = constructionLoanBalance * (1 + inp.loanRate) + perYearConstructionDebtDraw;
  }
  const { payment: debtService, schedule: loanSchedule } = amortizationSchedule(constructionLoanBalance, inp.loanRate, inp.loanTenor);

  const leveredCashflows = [-landEquityDraw];
  for (let y = 0; y < constructionYears; y++) leveredCashflows.push(-perYearConstructionEquityDraw);

  let noiYearL = stabilizedNOI;
  let dscrMin = Infinity;
  for (let y = 1; y <= operatingYears; y++) {
    if (y > 1) noiYearL = noiYearL * (1 + inp.rentGrowthRate);
    const ds = y <= loanSchedule.length ? debtService : 0;
    if (ds > 0) dscrMin = Math.min(dscrMin, noiYearL / ds);
    const remBalance = y === operatingYears && y <= loanSchedule.length ? loanSchedule[y - 1].balance : 0;
    if (y < operatingYears) {
      leveredCashflows.push(noiYearL - ds);
    } else {
      const forwardNOIL = noiYearL * (1 + inp.rentGrowthRate);
      const exitValueL = inp.exitCapRate > 0 ? forwardNOIL / inp.exitCapRate : 0;
      const netExitValueL = exitValueL - exitValueL * inp.exitTransferFeeRate;
      leveredCashflows.push(noiYearL - ds + netExitValueL - remBalance);
    }
  }
  if (dscrMin === Infinity) dscrMin = null;
  const leveredIRR = computeIRR(leveredCashflows);
  const equityDiscountRate = inp.hurdleRate + inp.equityRiskSpread;
  const leveredNPV = computeNPV(equityDiscountRate, leveredCashflows);

  const c1 = simplePaybackYears <= inp.maxPaybackThreshold;
  const c2 = capRateOnCost >= (1 / inp.maxPaybackThreshold);
  const c3 = irr >= inp.hurdleRate;
  const c4 = marketValueAfterCompletion >= totalProjectCost;
  const criteria = [c1, c2, c3, c4];
  const c5 = inp.leverageEnabled ? dscrMin !== null && dscrMin >= inp.minDscrThreshold : null;
  if (inp.leverageEnabled) criteria.push(c5);
  const { met: metCount, total: totalCriteria, verdict } = tierVerdict(criteria);

  return {
    landArea, landMarketValue, floorPlateArea, serviceAreaPerFloor, netLeasableAreaPerFloor,
    totalNetLeasableArea, totalOfficeFloorArea, totalBasementArea, totalBuiltArea,
    totalConstructionCost, landCommission, landTransferFee, totalLandAcquisitionCost, totalProjectCost, costPerSqm,
    grossRentalIncome, actualRentalIncome, serviceIncome, totalOperatingRevenue, operatingExpenses, stabilizedNOI,
    capRateOnCost, marketValueAfterCompletion, valueSurplusOverCost, simplePaybackYears, maxJustifiedLandPricePerSqm,
    cashflows, irr, npv,
    constructionYears, operatingYears,
    loanAmount: landDebtDraw, equityRequired: landEquityDraw, constructionLoanBalance, debtService, dscrMin,
    leveredCashflows, leveredIRR, leveredNPV, equityDiscountRate,
    c1, c2, c3, c4, c5, metCount, totalCriteria, verdict,
  };
}

module.exports = { calcLandDevelopment };
