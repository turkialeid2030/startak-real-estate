'use strict';

const assert = require('assert/strict');
const path = require('path');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const { ASSUMPTION_MODEL_VERSION } = require('../../src/assumptions/assumption-model');
const corpus = require('../reference/current-model-reference-v1.json');

const V2_REFERENCE_ASSUMPTIONS = Object.freeze({
  maintenanceRate: 0.05,
  managementFeeRate: 0.035,
  fixedOpexPerSqm: 40,
  replacementReservePerSqm: 20,
  opexGrowthRate: 0.02,
});

const VACANCY_MONTHS = Object.freeze({ 'مؤجر': 0, '3 أشهر': 3, '6 أشهر': 6, '9 أشهر': 9, 'سنة': 12 });

function approx(actual, expected, tolerance, label) {
  assert.ok(Number.isFinite(actual), `${label}: actual must be finite`);
  assert.ok(Number.isFinite(expected), `${label}: expected must be finite`);
  const allowed = tolerance + Math.abs(expected) * 1e-12;
  assert.ok(Math.abs(actual - expected) <= allowed, `${label}: ${actual} != ${expected} within ${allowed}`);
}

function independentNpv(rate, cashflows) {
  return cashflows.reduce((sum, flow, i) => sum + flow / Math.pow(1 + rate, i), 0);
}

function independentIrr(cashflows) {
  const value = (rate) => cashflows.reduce((sum, flow, i) => sum + flow / Math.pow(1 + rate, i), 0);
  let lo = -0.999999;
  let hi = 10;
  let flo = value(lo);
  let fhi = value(hi);
  assert.ok(Number.isFinite(flo) && Number.isFinite(fhi) && flo * fhi <= 0, 'independent IRR bracket must contain a root');
  for (let i = 0; i < 240; i += 1) {
    const mid = (lo + hi) / 2;
    const fmid = value(mid);
    if (Math.abs(fmid) < 1e-8) return mid;
    if (flo * fmid <= 0) {
      hi = mid;
      fhi = fmid;
    } else {
      lo = mid;
      flo = fmid;
    }
  }
  return (lo + hi) / 2;
}

function cumulativePayback(cashflows) {
  let cumulative = cashflows[0];
  if (cumulative >= 0) return 0;
  for (let year = 1; year < cashflows.length; year += 1) {
    const flow = cashflows[year];
    const before = cumulative;
    cumulative += flow;
    if (cumulative >= 0 && flow > 0) return (year - 1) + (-before / flow);
  }
  return null;
}

function buildIndependentBuildingReference(raw, overrides) {
  const inp = { ...raw, ...overrides, ...V2_REFERENCE_ASSUMPTIONS };
  const landArea = inp.landLength * inp.landWidth;
  const totalBasementArea = inp.basementCount * inp.basementAreaEach;
  const totalFloorArea = inp.floorCount * inp.floorAreaEach;
  const netLeasableArea = inp.netLeasableOverride > 0 ? inp.netLeasableOverride : totalFloorArea * inp.efficiencyRatio;
  const replacementValue = totalBasementArea * inp.basementConstructionCostPerSqm
    + totalFloorArea * inp.floorConstructionCostPerSqm;
  const totalPurchaseCost = inp.buildingPrice * (1 + inp.commissionRate + inp.transferFeeRate)
    + inp.inspectionCost + inp.valuationCost;
  const stabilizedRental = netLeasableArea * inp.rentPerSqm * inp.occupancyRate;
  const insuranceRate = Number.isFinite(inp.insuranceRateOnReplacementCost)
    ? inp.insuranceRateOnReplacementCost
    : (inp.insuranceRate || 0);
  const replacementGrowth = inp.replacementCostGrowthRate || 0;
  const vacancyMonths = VACANCY_MONTHS[inp.leaseStatus] ?? 0;
  const initialLeaseFactor = Math.max(0, Math.min(1, 1 - vacancyMonths / 12));

  function noi(yearIndex, leaseFactor = 1) {
    const rental = stabilizedRental * Math.pow(1 + (inp.rentGrowthRate || 0), yearIndex) * leaseFactor;
    const revenue = rental * (1 + inp.serviceIncomeRate);
    const fixed = netLeasableArea * inp.fixedOpexPerSqm * Math.pow(1 + inp.opexGrowthRate, yearIndex);
    const variable = revenue * inp.maintenanceRate;
    const management = revenue * inp.managementFeeRate;
    const insurance = replacementValue * Math.pow(1 + replacementGrowth, yearIndex) * insuranceRate;
    const reserve = netLeasableArea * inp.replacementReservePerSqm * Math.pow(1 + inp.opexGrowthRate, yearIndex);
    return revenue - fixed - variable - management - insurance - reserve;
  }

  const hold = Math.max(1, Math.round(inp.holdPeriod));
  const operatingNoi = [];
  for (let y = 1; y <= hold; y += 1) operatingNoi.push(noi(y - 1, y === 1 ? initialLeaseFactor : 1));
  const forwardNoi = noi(hold, 1);
  const terminalSaleValue = forwardNoi / inp.exitCapRate;
  const terminalNetSaleProceeds = terminalSaleValue * (1 - inp.exitTransferFeeRate);
  const cashflows = [-totalPurchaseCost, ...operatingNoi];
  cashflows[cashflows.length - 1] += terminalNetSaleProceeds;

  const paybackNoi = [];
  const paybackHorizon = Math.max(hold, Math.max(1, Math.round(inp.buildingUsefulLife || hold)));
  for (let y = 1; y <= paybackHorizon; y += 1) paybackNoi.push(noi(y - 1, y === 1 ? initialLeaseFactor : 1));

  return {
    landArea,
    totalPurchaseCost,
    replacementValue,
    NOI: noi(0, 1),
    cashflows,
    npv: independentNpv(inp.discountRate, cashflows),
    irr: independentIrr(cashflows),
    cumulativePaybackOnCost: cumulativePayback([-totalPurchaseCost, ...paybackNoi]),
  };
}

function buildIndependentLandReference(inp) {
  const landArea = inp.landLength * inp.landWidth;
  const landMarketValue = landArea * inp.landPricePerSqm;
  const floorPlateArea = landArea * inp.buildableRatio;
  const netPerFloor = floorPlateArea * (1 - inp.servicesRatioPerFloor);
  const totalNetLeasableArea = netPerFloor * inp.officeFloorCount;
  const totalOfficeFloorArea = floorPlateArea * inp.officeFloorCount;
  const totalBasementArea = landArea * inp.basementFloorCount;
  const totalConstructionCost = (totalOfficeFloorArea + totalBasementArea) * inp.constructionCostPerSqm;
  const totalLandAcquisitionCost = landMarketValue * (1 + inp.landCommissionRate + inp.landTransferFeeRate)
    + inp.engineeringCost + inp.landValuationCost;
  const totalProjectCost = totalLandAcquisitionCost + totalConstructionCost;
  const stabilizedRental = totalNetLeasableArea * inp.marketRentPerSqm * inp.occupancyRate;
  const leaseUpMonths = Number.isFinite(inp.leaseUpMonths) ? Math.max(0, inp.leaseUpMonths) : 0;
  const initialLeaseFactor = Math.max(0, Math.min(1, 1 - leaseUpMonths / 12));
  const variableRate = Number.isFinite(inp.variableOpexRate) ? inp.variableOpexRate : (inp.opexRate || 0);
  const fixedRate = Math.max(0, inp.fixedOpexPerSqm || 0);
  const managementRate = Math.max(0, inp.managementFeeRate || 0);
  const insuranceRate = Math.max(0, inp.insuranceRateOnReplacementCost || 0);
  const reserveRate = Math.max(0, inp.replacementReservePerSqm || 0);
  const opexGrowth = inp.opexGrowthRate || 0;
  const replacementGrowth = inp.replacementCostGrowthRate || 0;

  function noi(yearIndex, leaseFactor = 1) {
    const rental = stabilizedRental * Math.pow(1 + inp.rentGrowthRate, yearIndex) * leaseFactor;
    const revenue = rental * (1 + inp.serviceIncomeRate);
    const fixed = totalNetLeasableArea * fixedRate * Math.pow(1 + opexGrowth, yearIndex);
    const variable = revenue * variableRate;
    const management = revenue * managementRate;
    const insurance = totalConstructionCost * Math.pow(1 + replacementGrowth, yearIndex) * insuranceRate;
    const reserve = totalNetLeasableArea * reserveRate * Math.pow(1 + opexGrowth, yearIndex);
    return revenue - fixed - variable - management - insurance - reserve;
  }

  const constructionYears = Math.max(1, Math.round(inp.constructionPeriod));
  const operatingYears = Math.max(1, Math.round(inp.operatingPeriod));
  const perYearConstruction = totalConstructionCost / constructionYears;
  const cashflows = [-totalLandAcquisitionCost];
  const paybackCashflows = [-totalLandAcquisitionCost];
  for (let i = 0; i < constructionYears; i += 1) {
    cashflows.push(-perYearConstruction);
    paybackCashflows.push(-perYearConstruction);
  }
  for (let y = 1; y <= operatingYears; y += 1) {
    const yearNoi = noi(y - 1, y === 1 ? initialLeaseFactor : 1);
    paybackCashflows.push(yearNoi);
    if (y < operatingYears) cashflows.push(yearNoi);
    else {
      const forwardNoi = noi(y, 1);
      const terminal = forwardNoi / inp.exitCapRate * (1 - inp.exitTransferFeeRate);
      cashflows.push(yearNoi + terminal);
    }
  }

  return {
    landArea,
    totalLandAcquisitionCost,
    totalConstructionCost,
    totalProjectCost,
    stabilizedNOI: noi(0, 1),
    constructionYears,
    operatingYears,
    cashflows,
    npv: independentNpv(inp.hurdleRate, cashflows),
    irr: independentIrr(cashflows),
    cumulativeProjectPaybackYears: cumulativePayback(paybackCashflows),
  };
}

function sourceFixture(caseRef) {
  return require(path.join('..', caseRef.sourceFixture.replace(/^tests\//, '')));
}

function runCase(caseRef) {
  const fixture = sourceFixture(caseRef);
  const inputs = { ...fixture.input_set, ...caseRef.inputOverrides };
  const leverageEnabled = inputs.leverageEnabled === true;
  const result = calculateInvestmentCase({
    studyType: caseRef.studyType === 'EXISTING_BUILDING' ? STUDY_TYPE.EXISTING_BUILDING : STUDY_TYPE.LAND_DEVELOPMENT,
    inputs,
    leverageEnabled,
    ...(caseRef.assumptionModelVersion
      ? { assumptionModelVersion: ASSUMPTION_MODEL_VERSION[caseRef.assumptionModelVersion] }
      : {}),
  });
  return { fixture, inputs, result };
}

assert.equal(corpus.schemaVersion, 1);
assert.equal(corpus.referenceVersion, 'CURRENT_MODEL_REFERENCE_V1');
assert.equal(corpus.status, 'VALIDATION_REFERENCE_ONLY');
assert.equal(corpus.legacyReference.path, 'tests/reference/RE-GOLD-baseline.json');
assert.equal(corpus.legacyReference.status, 'IMMUTABLE_HISTORICAL_CHARACTERIZATION');
assert.equal(corpus.legacyReference.overwritten, false);
assert.equal(corpus.authority.commercialGoLive, 'HOLD');
assert.equal(corpus.authority.transactionAuthorized, false);
assert.equal(corpus.authority.publicAi, false);
assert.equal(corpus.authority.canonicalBaselineActivationAuthorized, false);
assert.equal(corpus.cases.length, 4);

for (const caseRef of corpus.cases) {
  const { fixture, inputs, result } = runCase(caseRef);
  const expected = caseRef.expected;
  const moneyTol = corpus.numericTolerance.currencySar;
  const ratioTol = corpus.numericTolerance.ratio;
  const irrTol = corpus.numericTolerance.irr;

  assert.equal(result.financialModelVersion, expected.financialModelVersion, `${caseRef.id}: financial model version`);
  assert.equal(result.financialModelStatus, expected.financialModelStatus, `${caseRef.id}: financial model status`);
  assert.equal(result.decisionStatus, expected.decisionStatus, `${caseRef.id}: decision status`);
  assert.equal(result.verdict, expected.verdict, `${caseRef.id}: verdict`);
  assert.equal(result.metCount, expected.metCount, `${caseRef.id}: metCount`);
  assert.equal(result.totalCriteria, expected.totalCriteria, `${caseRef.id}: totalCriteria`);
  assert.deepEqual(result.failedHardGates, expected.failedHardGates, `${caseRef.id}: hard gates`);
  assert.deepEqual(result.failedSoftCriteria, expected.failedSoftCriteria, `${caseRef.id}: soft criteria`);
  approx(result.npv, expected.npv, moneyTol, `${caseRef.id}: NPV`);
  approx(result.irr, expected.irr, irrTol, `${caseRef.id}: IRR`);
  assert.equal(result.cashflows.length, expected.cashflowLength, `${caseRef.id}: cashflow length`);
  assert.equal(result.priceBasis.metric, expected.priceBasisMetric, `${caseRef.id}: price basis metric`);
  assert.equal(result.priceBasis.outputBasis, expected.priceBasisOutputBasis, `${caseRef.id}: price basis output`);
  assert.equal(result.timingBasis.version, expected.timingBasisVersion, `${caseRef.id}: timing basis version`);
  assert.equal(result.timingBasis.transactionAuthorized, false, `${caseRef.id}: transaction authority must remain false`);

  if (caseRef.studyType === 'EXISTING_BUILDING') {
    assert.equal(result.assumptionModelVersion, 'V2', `${caseRef.id}: V2 assumption model`);
    assert.equal(result.assumptionModelDisclosure.userApprovedAssumptions, false, `${caseRef.id}: no invented approval`);
    assert.equal(result.criticalAssumptionOverrideGovernance.status, expected.criticalOverrideGovernanceStatus);
    assert.equal(result.criticalAssumptionOverrideGovernance.decisionReady, true);
    assert.deepEqual(result.criticalAssumptionOverrideGovernance.blockers, []);

    const independent = buildIndependentBuildingReference(fixture.input_set, caseRef.inputOverrides);
    approx(result.totalPurchaseCost, independent.totalPurchaseCost, moneyTol, `${caseRef.id}: independently recomputed acquisition cost`);
    approx(result.NOI, independent.NOI, moneyTol, `${caseRef.id}: independently recomputed V2 NOI`);
    approx(result.NOI, expected.NOI, moneyTol, `${caseRef.id}: corpus NOI`);
    approx(result.totalPurchaseCost, expected.totalPurchaseCost, moneyTol, `${caseRef.id}: corpus purchase cost`);
    assert.equal(result.cashflows.length, independent.cashflows.length);
    result.cashflows.forEach((flow, i) => approx(flow, independent.cashflows[i], moneyTol, `${caseRef.id}: independent cashflow[${i}]`));
    approx(result.npv, independent.npv, moneyTol, `${caseRef.id}: independent periodic NPV`);
    approx(result.irr, independent.irr, 1e-8, `${caseRef.id}: independent IRR`);
    assert.ok(independent.cumulativePaybackOnCost > inputs.maxPaybackThreshold, `${caseRef.id}: cumulative payback soft failure independently reproduced`);
    assert.ok(result.criteriaDetail.some((item) => item.code === 'CUMULATIVE_PAYBACK' && item.met === false && item.hardGate === false));
  } else {
    const independent = buildIndependentLandReference(inputs);
    approx(result.totalProjectCost, independent.totalProjectCost, moneyTol, `${caseRef.id}: independently recomputed project cost`);
    approx(result.stabilizedNOI, independent.stabilizedNOI, moneyTol, `${caseRef.id}: independently recomputed stabilized NOI`);
    approx(result.stabilizedNOI, expected.stabilizedNOI, moneyTol, `${caseRef.id}: corpus stabilized NOI`);
    approx(result.totalProjectCost, expected.totalProjectCost, moneyTol, `${caseRef.id}: corpus project cost`);
    assert.equal(result.cashflows.length, independent.cashflows.length);
    result.cashflows.forEach((flow, i) => approx(flow, independent.cashflows[i], moneyTol, `${caseRef.id}: independent cashflow[${i}]`));
    approx(result.npv, independent.npv, moneyTol, `${caseRef.id}: independent periodic NPV`);
    approx(result.irr, independent.irr, 1e-8, `${caseRef.id}: independent IRR`);
    assert.ok(independent.cumulativeProjectPaybackYears > inputs.maxPaybackThreshold, `${caseRef.id}: cumulative project payback soft failure independently reproduced`);
    assert.ok(result.criteriaDetail.some((item) => item.code === 'CUMULATIVE_PROJECT_PAYBACK' && item.met === false && item.hardGate === false));
  }

  const expectedFinancingVersion = expected.financingEngineVersion;
  assert.equal(result.financingEngineVersion ?? null, expectedFinancingVersion, `${caseRef.id}: financing engine version`);
  if (expectedFinancingVersion) {
    assert.equal(result.financingRatioBasis, expected.financingRatioBasis, `${caseRef.id}: financing ratio basis`);
    approx(result.financingRatioDenominatorSar, expected.financingRatioDenominatorSar, moneyTol, `${caseRef.id}: financing denominator`);
    approx(result.requestedDebtRatio, expected.requestedDebtRatio, ratioTol, `${caseRef.id}: requested debt ratio`);
    approx(result.loanAmount, expected.loanAmount, moneyTol, `${caseRef.id}: Wave-B loan amount`);
    approx(result.debtService, expected.debtService, moneyTol, `${caseRef.id}: Wave-B debt service`);
    approx(result.dscrMin, expected.dscrMin, 1e-9, `${caseRef.id}: Wave-B DSCR`);
    approx(result.leveredNPV, expected.leveredNPV, moneyTol, `${caseRef.id}: Wave-B levered NPV`);
    approx(result.leveredIRR, expected.leveredIRR, 1e-8, `${caseRef.id}: Wave-B levered IRR`);
    approx(result.equityDiscountRate, expected.equityDiscountRate, ratioTol, `${caseRef.id}: equity discount rate`);
    assert.equal(result.loanSizingConstraint, expected.loanSizingConstraint, `${caseRef.id}: binding financing constraint`);
    assert.ok(result.loanAmount <= result.financingRatioDenominatorSar * result.requestedDebtRatio + moneyTol, `${caseRef.id}: debt cannot exceed requested principal cap`);
    approx(result.actualDebtToBasisRatio, result.loanAmount / result.financingRatioDenominatorSar, 1e-10, `${caseRef.id}: debt ratio identity`);

    if (caseRef.studyType === 'EXISTING_BUILDING') {
      assert.equal(result.loanSizingConstraint, 'LTC');
      approx(result.loanAmount, result.totalPurchaseCost * inputs.ltv, moneyTol, `${caseRef.id}: independently recomputed LTC-bound loan`);
    } else {
      assert.equal(result.loanSizingConstraint, 'DSCR');
      assert.equal(result.constructionDebtSchedule.length, expected.constructionDebtScheduleLength);
      assert.equal(result.annualConstructionDebtDraws.length, expected.annualConstructionDebtDrawsLength);
      const monthlyPrincipal = result.constructionDebtSchedule.reduce((sum, row) => sum + row.constructionDebtDraw, 0);
      const annualPrincipal = result.annualConstructionDebtDraws.reduce((sum, row) => sum + row.debtDraw, 0);
      approx(monthlyPrincipal, result.loanAmount, moneyTol, `${caseRef.id}: monthly principal draw reconciliation`);
      approx(annualPrincipal, result.loanAmount, moneyTol, `${caseRef.id}: annual aggregation reconciliation`);
      approx(result.dscrMin, inputs.minDscrThreshold, 1e-9, `${caseRef.id}: DSCR binding identity`);
      assert.equal(result.timingBasis.constructionDebtDrawTiming, 'MONTHLY_BEGINNING_OF_PERIOD');
      assert.equal(result.timingBasis.constructionInterestCapitalizationTiming, 'MONTHLY_END_OF_PERIOD');
      assert.equal(result.timingBasis.annualConstructionDebtDrawsAreAggregationOnly, true);
    }
  }
}

console.log('CURRENT_MODEL_REFERENCE_CORPUS_P27=PASS');
