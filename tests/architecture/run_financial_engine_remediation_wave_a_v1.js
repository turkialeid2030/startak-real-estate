'use strict';

const assert = require('assert');
const { calcExistingBuilding } = require('../../src/engines/valuation/existing-building');
const { calcLandDevelopment } = require('../../src/engines/valuation/land-development');

function buildingBase() {
  return {
    projectTitle: 'test',
    landLength: 100, landWidth: 53.26, buildingAge: 1,
    basementCount: 2, basementAreaEach: 7800, parkingAreaPerSpot: 60,
    floorCount: 3, floorAreaEach: 3060, efficiencyRatio: 0.85, netLeasableOverride: 7800,
    serviceElevators: 6,
    buildingPrice: 140000000, commissionRate: 0.025, transferFeeRate: 0.05, inspectionCost: 75000, valuationCost: 60000,
    rentPerSqm: 1800, occupancyRate: 1.0, leaseStatus: 'مؤجر', leaseYears: 5, vatRate: 0.15, serviceIncomeRate: 0.12,
    maintenanceRate: 0.05, insuranceRate: 0.005,
    fixedOpexPerSqm: 120, variableOpexRate: 0.02, managementFeeRate: 0.01,
    insuranceRateOnReplacementCost: 0.005, replacementReservePerSqm: 40,
    opexGrowthRate: 0.025, replacementCostGrowthRate: 0.025,
    marketCapRate: 0.07, exitCapRate: 0.075, discountRate: 0.08, holdPeriod: 5, rentGrowthRate: 0.02,
    basementConstructionCostPerSqm: 3000, floorConstructionCostPerSqm: 2000, currentLandPricePerSqm: 15000, buildingUsefulLife: 30,
    minYieldThreshold: 0.09, maxPaybackThreshold: 10,
    leverageEnabled: false, ltv: 0.5, loanRate: 0.06, loanTenor: 10, financingStructureLabel: 'مرابحة',
    minDscrThreshold: 1.25, equityRiskSpread: 0.02,
  };
}

function landBase() {
  return {
    projectTitle: 'test land',
    landLength: 30, landWidth: 60, landPricePerSqm: 20000,
    buildableRatio: 0.6, buildingTypeLabel: 'برج مكتبي', officeFloorCount: 7, servicesRatioPerFloor: 0.15, basementFloorCount: 2,
    constructionCostPerSqm: 5500,
    landCommissionRate: 0.025, landTransferFeeRate: 0.05, engineeringCost: 200000, landValuationCost: 60000,
    marketRentPerSqm: 1800, occupancyRate: 1.0, serviceIncomeRate: 0.12, opexRate: 0.05,
    fixedOpexPerSqm: 100, variableOpexRate: 0.02, managementFeeRate: 0.01,
    insuranceRateOnReplacementCost: 0.003, replacementReservePerSqm: 35,
    opexGrowthRate: 0.025, replacementCostGrowthRate: 0.025,
    marketCapRate: 0.08, leaseUpMonths: 6,
    constructionPeriod: 2, rentGrowthRate: 0.03, operatingPeriod: 10, exitCapRate: 0.085, hurdleRate: 0.12,
    exitTransferFeeRate: 0.05,
    maxPaybackThreshold: 9,
    leverageEnabled: false, ltv: 0.6, loanRate: 0.065, loanTenor: 8, financingStructureLabel: 'مرابحة',
    minDscrThreshold: 1.25, equityRiskSpread: 0.02,
  };
}

let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
  console.log(`PASS ${name}`);
}

check('one-time vacancy reduces first year only and does not zero stabilized/terminal value', () => {
  const leased = calcExistingBuilding(buildingBase());
  const vacantInput = buildingBase();
  vacantInput.leaseStatus = 'سنة';
  const vacant = calcExistingBuilding(vacantInput);

  assert.strictEqual(vacant.initialLeaseUpFactor, 0);
  assert.ok(vacant.firstYearNOI < leased.firstYearNOI);
  assert.ok(vacant.NOI > 0);
  assert.strictEqual(vacant.NOI, leased.NOI);
  assert.strictEqual(vacant.marketValueByIncomeCap, leased.marketValueByIncomeCap);
  assert.strictEqual(vacant.terminalSaleValue, leased.terminalSaleValue);
  assert.ok(vacant.terminalSaleValue > 0);
});

check('negative NPV is a hard gate and cannot produce a conditional positive verdict', () => {
  const input = buildingBase();
  input.discountRate = 0.30;
  const result = calcExistingBuilding(input);
  assert.ok(result.npv < 0);
  assert.strictEqual(result.c6, false);
  assert.ok(result.failedHardGates.includes('NPV_NON_NEGATIVE'));
  assert.strictEqual(result.decisionStatus, 'HARD_GATE_FAILED');
  assert.strictEqual(result.verdict, 'لا يوصى بالشراء');
});

check('non-positive stabilized NOI never becomes zero-year payback or passing criterion', () => {
  const b = buildingBase();
  b.rentPerSqm = 0;
  const br = calcExistingBuilding(b);
  assert.ok(br.NOI <= 0);
  assert.strictEqual(br.cumulativePaybackOnCost, null);
  assert.strictEqual(br.cumulativePaybackOnPrice, null);
  assert.ok(Number.isNaN(br.paybackOnCost));
  assert.ok(Number.isNaN(br.paybackOnPrice));
  assert.strictEqual(br.c0, false);
  assert.strictEqual(br.c2, false);
  assert.strictEqual(br.financialModelStatus, 'INVALID_ECONOMIC_CASE');
  assert.strictEqual(br.decisionStatus, 'HARD_GATE_FAILED');

  const l = landBase();
  l.marketRentPerSqm = 0;
  const lr = calcLandDevelopment(l);
  assert.ok(lr.stabilizedNOI <= 0);
  assert.strictEqual(lr.cumulativeProjectPaybackYears, null);
  assert.ok(Number.isNaN(lr.simplePaybackYears));
  assert.strictEqual(lr.c0, false);
  assert.strictEqual(lr.c1, false);
  assert.strictEqual(lr.financialModelStatus, 'INVALID_ECONOMIC_CASE');
});

check('land decision criteria are independent and no duplicate cap-rate/payback vote exists', () => {
  const result = calcLandDevelopment(landBase());
  const codes = result.criteriaDetail.map((item) => item.code);
  assert.strictEqual(new Set(codes).size, codes.length);
  assert.ok(codes.includes('CUMULATIVE_PROJECT_PAYBACK'));
  assert.ok(codes.includes('NPV_NON_NEGATIVE'));
  assert.ok(codes.includes('IRR_MEETS_HURDLE'));
  assert.ok(!codes.includes('CAP_RATE_ON_COST_RECIPROCAL_PAYBACK'));
  if (result.cumulativeProjectPaybackYears !== null) {
    assert.notStrictEqual(result.cumulativeProjectPaybackYears, result.projectCostToNoiMultiple);
  }
});

check('fixed expense component does not fall when rent falls', () => {
  const base = buildingBase();
  const high = calcExistingBuilding(base);
  const lowInput = buildingBase();
  lowInput.rentPerSqm = base.rentPerSqm * 0.5;
  const low = calcExistingBuilding(lowInput);

  assert.strictEqual(low.fixedOperatingExpense, high.fixedOperatingExpense);
  assert.strictEqual(low.insuranceAmount, high.insuranceAmount);
  assert.strictEqual(low.replacementReserveAmount, high.replacementReserveAmount);
  assert.ok(low.variableOperatingExpense < high.variableOperatingExpense);
  assert.ok(low.opexAmount / low.totalAnnualIncome > high.opexAmount / high.totalAnnualIncome);
});

check('building exit cap is independent and higher exit cap lowers terminal value', () => {
  const lowCapInput = buildingBase();
  lowCapInput.exitCapRate = 0.07;
  const highCapInput = buildingBase();
  highCapInput.exitCapRate = 0.09;
  const lowCap = calcExistingBuilding(lowCapInput);
  const highCap = calcExistingBuilding(highCapInput);
  assert.ok(highCap.terminalSaleValue < lowCap.terminalSaleValue);
  assert.ok(highCap.irr < lowCap.irr);
});

check('land lease-up reduces first operating year but not stabilized NOI or terminal value basis', () => {
  const zeroLeaseInput = landBase();
  zeroLeaseInput.leaseUpMonths = 0;
  const sixLeaseInput = landBase();
  sixLeaseInput.leaseUpMonths = 6;
  const zero = calcLandDevelopment(zeroLeaseInput);
  const six = calcLandDevelopment(sixLeaseInput);
  assert.ok(six.firstOperatingYearNOI < zero.firstOperatingYearNOI);
  assert.strictEqual(six.stabilizedNOI, zero.stabilizedNOI);
  assert.strictEqual(six.marketValueAfterCompletion, zero.marketValueAfterCompletion);
  assert.strictEqual(six.terminalExitValue, zero.terminalExitValue);
});

check('price-to-NOI multiple is distinct from cumulative cash-flow payback', () => {
  const result = calcExistingBuilding(buildingBase());
  assert.ok(Number.isFinite(result.priceToNoiMultiple));
  assert.ok(result.paybackHorizonYears >= result.buildingUsefulLife || result.paybackHorizonYears >= 30);
  if (result.cumulativePaybackOnPrice !== null) {
    assert.notStrictEqual(result.priceToNoiMultiple, result.cumulativePaybackOnPrice);
  }
});

console.log(`FINANCIAL_ENGINE_REMEDIATION_WAVE_A_V1=PASS checks=${checks}`);
