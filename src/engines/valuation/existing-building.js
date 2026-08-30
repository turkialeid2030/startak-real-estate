// src/engines/valuation/existing-building.js -- EXTRACTED VERBATIM from platform-source.jsx lines 147-259.
// (VACANCY_MONTHS_MAP + calcExistingBuilding -- valuation AND financing logic are interleaved in the
// original function body and are NOT split here; see REBASE_CHANGE_MANIFEST.csv row for this file.)
// Module-linkage require() added -- this is wiring, not a formula change (see manifest).
const { computeNPV, computeIRR, amortizationSchedule } = require('../financial');
const { tierVerdict } = require('../recommendation');

const VACANCY_MONTHS_MAP = { "مؤجر": 0, "3 أشهر": 3, "6 أشهر": 6, "9 أشهر": 9, "سنة": 12 };

// ============================================================
// SCENARIO A: EXISTING BUILDING PURCHASE (verified vs source file)
// ============================================================
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

  const vacancyMonths = VACANCY_MONTHS_MAP[inp.leaseStatus] ?? 0;
  const grossRentalIncome = netLeasableArea * inp.rentPerSqm * inp.occupancyRate;
  const vacancyDeduction = grossRentalIncome * (vacancyMonths / 12);
  const rentalIncomeAfterVacancy = grossRentalIncome - vacancyDeduction;
  const serviceIncome = rentalIncomeAfterVacancy * inp.serviceIncomeRate;
  const totalAnnualIncome = rentalIncomeAfterVacancy + serviceIncome;
  const vatCollected = totalAnnualIncome * inp.vatRate;

  const opexAmount = totalAnnualIncome * (inp.maintenanceRate + inp.insuranceRate);
  const NOI = totalAnnualIncome - opexAmount;

  const netYieldOnCost = totalPurchaseCost > 0 ? NOI / totalPurchaseCost : 0;
  const grossYieldOnCost = totalPurchaseCost > 0 ? totalAnnualIncome / totalPurchaseCost : 0;
  const paybackOnCost = NOI > 0 ? totalPurchaseCost / NOI : 0;
  const netYieldOnPrice = inp.buildingPrice > 0 ? NOI / inp.buildingPrice : 0;
  const paybackOnPrice = NOI > 0 ? inp.buildingPrice / NOI : 0;

  const marketValueByIncomeCap = inp.marketCapRate > 0 ? NOI / inp.marketCapRate : 0;
  const valueGapVsCost = marketValueByIncomeCap - totalPurchaseCost;

  const basementConstructionValue = totalBasementArea * inp.basementConstructionCostPerSqm;
  const floorConstructionValue = totalFloorArea * inp.floorConstructionCostPerSqm;
  const totalReplacementConstructionValue = basementConstructionValue + floorConstructionValue;
  const currentLandValue = landArea * inp.currentLandPricePerSqm;
  const totalAppraisedValue = totalReplacementConstructionValue + currentLandValue;
  const annualDepreciation = inp.buildingUsefulLife > 0 ? totalReplacementConstructionValue / inp.buildingUsefulLife : 0;

  const cashflows = [-totalPurchaseCost];
  let noiYear = NOI;
  for (let y = 1; y <= inp.holdPeriod; y++) {
    if (y > 1) noiYear = noiYear * (1 + inp.rentGrowthRate);
    if (y < inp.holdPeriod) {
      cashflows.push(noiYear);
    } else {
      const forwardNOI = noiYear * (1 + inp.rentGrowthRate);
      const saleValue = inp.marketCapRate > 0 ? forwardNOI / inp.marketCapRate : 0;
      const saleTransferFee = saleValue * inp.transferFeeRate;
      const netSaleProceeds = saleValue - saleTransferFee;
      cashflows.push(noiYear + netSaleProceeds);
    }
  }
  const irr = computeIRR(cashflows);
  const npv = computeNPV(inp.discountRate, cashflows);
  const maxJustifiedPrice = NOI / Math.max(inp.minYieldThreshold, 1 / inp.maxPaybackThreshold);

  // --- Leverage (always computed; UI/recommendation show it only when leverageEnabled) ---
  const loanAmount = inp.ltv * totalPurchaseCost;
  const equityRequired = totalPurchaseCost - loanAmount;
  const { payment: debtService, schedule: loanSchedule } = amortizationSchedule(loanAmount, inp.loanRate, inp.loanTenor);
  const leveredCashflows = [-equityRequired];
  let noiYearL = NOI;
  let dscrMin = Infinity;
  for (let y = 1; y <= inp.holdPeriod; y++) {
    if (y > 1) noiYearL = noiYearL * (1 + inp.rentGrowthRate);
    const ds = y <= loanSchedule.length ? debtService : 0;
    if (ds > 0) dscrMin = Math.min(dscrMin, noiYearL / ds);
    const remBalance = y === inp.holdPeriod && y <= loanSchedule.length ? loanSchedule[y - 1].balance : 0;
    if (y < inp.holdPeriod) {
      leveredCashflows.push(noiYearL - ds);
    } else {
      const forwardNOIL = noiYearL * (1 + inp.rentGrowthRate);
      const saleValueL = inp.marketCapRate > 0 ? forwardNOIL / inp.marketCapRate : 0;
      const netSaleProceedsL = saleValueL - saleValueL * inp.transferFeeRate;
      leveredCashflows.push(noiYearL - ds + netSaleProceedsL - remBalance);
    }
  }
  if (dscrMin === Infinity) dscrMin = null;
  const leveredIRR = computeIRR(leveredCashflows);
  const equityDiscountRate = inp.discountRate + inp.equityRiskSpread;
  const leveredNPV = computeNPV(equityDiscountRate, leveredCashflows);

  const c1 = netYieldOnPrice >= inp.minYieldThreshold;
  const c2 = paybackOnPrice <= inp.maxPaybackThreshold;
  const c3 = irr >= inp.discountRate;
  const c4 = marketValueByIncomeCap >= totalPurchaseCost;
  const criteria = [c1, c2, c3, c4];
  const c5 = inp.leverageEnabled ? dscrMin !== null && dscrMin >= inp.minDscrThreshold : null;
  if (inp.leverageEnabled) criteria.push(c5);
  const { met: metCount, total: totalCriteria, verdict } = tierVerdict(criteria);

  return {
    landArea, totalBasementArea, totalParkingSpots, totalFloorArea, netLeasableArea, avgNetAreaPerFloor,
    totalBuiltArea, coverageRatio, areaCheckOk,
    commissionAmount, transferFeeAmount, totalPurchaseCost, costPerSqm,
    grossRentalIncome, vacancyDeduction, rentalIncomeAfterVacancy, serviceIncome, totalAnnualIncome, vatCollected,
    opexAmount, NOI, netYieldOnCost, grossYieldOnCost, paybackOnCost, netYieldOnPrice, paybackOnPrice,
    marketValueByIncomeCap, valueGapVsCost,
    basementConstructionValue, floorConstructionValue, totalReplacementConstructionValue, currentLandValue,
    totalAppraisedValue, annualDepreciation,
    cashflows, irr, npv, maxJustifiedPrice,
    loanAmount, equityRequired, debtService, dscrMin, leveredCashflows, leveredIRR, leveredNPV, equityDiscountRate,
    c1, c2, c3, c4, c5, metCount, totalCriteria, verdict,
  };
}

module.exports = { VACANCY_MONTHS_MAP, calcExistingBuilding };
