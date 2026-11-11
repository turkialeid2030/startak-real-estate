'use strict';

const assert = require('assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const { ASSUMPTION_MODEL_VERSION } = require('../../src/assumptions/assumption-model');
const corpus = require('../reference/current-model-reference-v1.json');

const ROOT = path.join(__dirname, '..', '..');
const V2 = Object.freeze({ maintenanceRate: 0.05, managementFeeRate: 0.035, fixedOpexPerSqm: 40, replacementReservePerSqm: 20, opexGrowthRate: 0.02 });
const VACANCY = Object.freeze({ 'مؤجر': 0, '3 أشهر': 3, '6 أشهر': 6, '9 أشهر': 9, 'سنة': 12 });

function approx(actual, expected, tolerance, label) {
  assert.ok(Number.isFinite(actual), `${label}: actual must be finite`);
  assert.ok(Number.isFinite(expected), `${label}: expected must be finite`);
  const allowed = tolerance + Math.abs(expected) * 1e-12;
  assert.ok(Math.abs(actual - expected) <= allowed, `${label}: ${actual} != ${expected} within ${allowed}`);
}

function npv(rate, cashflows) {
  return cashflows.reduce((sum, flow, i) => sum + flow / Math.pow(1 + rate, i), 0);
}

function irr(cashflows) {
  const f = (rate) => npv(rate, cashflows);
  let lo = -0.999999;
  let hi = 10;
  let flo = f(lo);
  let fhi = f(hi);
  assert.ok(Number.isFinite(flo) && Number.isFinite(fhi) && flo * fhi <= 0, 'IRR root bracket required');
  for (let i = 0; i < 240; i += 1) {
    const mid = (lo + hi) / 2;
    const fm = f(mid);
    if (Math.abs(fm) < 1e-8) return mid;
    if (flo * fm <= 0) {
      hi = mid;
      fhi = fm;
    } else {
      lo = mid;
      flo = fm;
    }
  }
  return (lo + hi) / 2;
}

function payback(cashflows) {
  let cumulative = cashflows[0];
  for (let i = 1; i < cashflows.length; i += 1) {
    const before = cumulative;
    cumulative += cashflows[i];
    if (cumulative >= 0 && cashflows[i] > 0) return (i - 1) + (-before / cashflows[i]);
  }
  return null;
}

function gitBlobSha1(buffer) {
  return crypto.createHash('sha1').update(Buffer.from(`blob ${buffer.length}\0`)).update(buffer).digest('hex');
}

function loadFixture(caseRef) {
  const filename = path.join(ROOT, caseRef.sourceFixture);
  const raw = fs.readFileSync(filename);
  assert.equal(gitBlobSha1(raw), caseRef.sourceFixtureGitBlobSha1, `${caseRef.id}: fixture provenance hash`);
  return JSON.parse(raw.toString('utf8'));
}

function buildingReference(raw, overrides) {
  const inp = { ...raw, ...overrides, ...V2 };
  const basementArea = inp.basementCount * inp.basementAreaEach;
  const floorArea = inp.floorCount * inp.floorAreaEach;
  const nla = inp.netLeasableOverride > 0 ? inp.netLeasableOverride : floorArea * inp.efficiencyRatio;
  const replacementValue = basementArea * inp.basementConstructionCostPerSqm + floorArea * inp.floorConstructionCostPerSqm;
  const purchaseCost = inp.buildingPrice * (1 + inp.commissionRate + inp.transferFeeRate) + inp.inspectionCost + inp.valuationCost;
  const stabilizedRental = nla * inp.rentPerSqm * inp.occupancyRate;
  const vacancyFactor = Math.max(0, Math.min(1, 1 - ((VACANCY[inp.leaseStatus] ?? 0) / 12)));
  const insuranceRate = Number.isFinite(inp.insuranceRateOnReplacementCost) ? inp.insuranceRateOnReplacementCost : inp.insuranceRate;
  const replacementGrowth = inp.replacementCostGrowthRate || 0;

  function yearNoi(y, leaseFactor = 1) {
    const rental = stabilizedRental * Math.pow(1 + (inp.rentGrowthRate || 0), y) * leaseFactor;
    const revenue = rental * (1 + inp.serviceIncomeRate);
    const fixed = nla * inp.fixedOpexPerSqm * Math.pow(1 + inp.opexGrowthRate, y);
    const variable = revenue * inp.maintenanceRate;
    const management = revenue * inp.managementFeeRate;
    const insurance = replacementValue * Math.pow(1 + replacementGrowth, y) * insuranceRate;
    const reserve = nla * inp.replacementReservePerSqm * Math.pow(1 + inp.opexGrowthRate, y);
    return revenue - fixed - variable - management - insurance - reserve;
  }

  const hold = Math.max(1, Math.round(inp.holdPeriod));
  const cashflows = [-purchaseCost];
  for (let y = 1; y <= hold; y += 1) cashflows.push(yearNoi(y - 1, y === 1 ? vacancyFactor : 1));
  const terminal = yearNoi(hold, 1) / inp.exitCapRate * (1 - inp.exitTransferFeeRate);
  cashflows[cashflows.length - 1] += terminal;

  const paybackNoi = [];
  const horizon = Math.max(hold, Math.max(1, Math.round(inp.buildingUsefulLife || hold)));
  for (let y = 1; y <= horizon; y += 1) paybackNoi.push(yearNoi(y - 1, y === 1 ? vacancyFactor : 1));

  return { purchaseCost, NOI: yearNoi(0, 1), cashflows, npv: npv(inp.discountRate, cashflows), irr: irr(cashflows), payback: payback([-purchaseCost, ...paybackNoi]) };
}

function landReference(inp) {
  const area = inp.landLength * inp.landWidth;
  const landValue = area * inp.landPricePerSqm;
  const floorPlate = area * inp.buildableRatio;
  const nla = floorPlate * (1 - inp.servicesRatioPerFloor) * inp.officeFloorCount;
  const officeArea = floorPlate * inp.officeFloorCount;
  const basementArea = area * inp.basementFloorCount;
  const constructionCost = (officeArea + basementArea) * inp.constructionCostPerSqm;
  const acquisitionCost = landValue * (1 + inp.landCommissionRate + inp.landTransferFeeRate) + inp.engineeringCost + inp.landValuationCost;
  const projectCost = acquisitionCost + constructionCost;
  const stabilizedRental = nla * inp.marketRentPerSqm * inp.occupancyRate;
  const leaseFactor = Math.max(0, Math.min(1, 1 - ((Number.isFinite(inp.leaseUpMonths) ? inp.leaseUpMonths : 0) / 12)));
  const variableRate = Number.isFinite(inp.variableOpexRate) ? inp.variableOpexRate : inp.opexRate;
  const fixedRate = inp.fixedOpexPerSqm || 0;
  const managementRate = inp.managementFeeRate || 0;
  const insuranceRate = inp.insuranceRateOnReplacementCost || 0;
  const reserveRate = inp.replacementReservePerSqm || 0;
  const opexGrowth = inp.opexGrowthRate || 0;
  const replacementGrowth = inp.replacementCostGrowthRate || 0;

  function yearNoi(y, factor = 1) {
    const rental = stabilizedRental * Math.pow(1 + inp.rentGrowthRate, y) * factor;
    const revenue = rental * (1 + inp.serviceIncomeRate);
    return revenue
      - nla * fixedRate * Math.pow(1 + opexGrowth, y)
      - revenue * variableRate
      - revenue * managementRate
      - constructionCost * Math.pow(1 + replacementGrowth, y) * insuranceRate
      - nla * reserveRate * Math.pow(1 + opexGrowth, y);
  }

  const constructionYears = Math.max(1, Math.round(inp.constructionPeriod));
  const operatingYears = Math.max(1, Math.round(inp.operatingPeriod));
  const constructionAnnual = constructionCost / constructionYears;
  const cashflows = [-acquisitionCost];
  const recovery = [-acquisitionCost];
  for (let y = 0; y < constructionYears; y += 1) {
    cashflows.push(-constructionAnnual);
    recovery.push(-constructionAnnual);
  }
  for (let y = 1; y <= operatingYears; y += 1) {
    const noi = yearNoi(y - 1, y === 1 ? leaseFactor : 1);
    recovery.push(noi);
    if (y < operatingYears) cashflows.push(noi);
    else cashflows.push(noi + yearNoi(y, 1) / inp.exitCapRate * (1 - inp.exitTransferFeeRate));
  }

  return { acquisitionCost, constructionCost, projectCost, NOI: yearNoi(0, 1), cashflows, npv: npv(inp.hurdleRate, cashflows), irr: irr(cashflows), payback: payback(recovery) };
}

assert.equal(corpus.schemaVersion, 1);
assert.equal(corpus.referenceVersion, 'CURRENT_MODEL_REFERENCE_V1');
assert.equal(corpus.status, 'VALIDATION_REFERENCE_ONLY');
assert.equal(corpus.legacyReference.status, 'IMMUTABLE_HISTORICAL_CHARACTERIZATION');
assert.equal(corpus.legacyReference.overwritten, false);
assert.equal(corpus.authority.commercialGoLive, 'HOLD');
assert.equal(corpus.authority.transactionAuthorized, false);
assert.equal(corpus.authority.publicAi, false);
assert.equal(corpus.authority.canonicalBaselineActivationAuthorized, false);
assert.equal(corpus.cases.length, 4);

for (const caseRef of corpus.cases) {
  const fixture = loadFixture(caseRef);
  const inputs = { ...fixture.input_set, ...caseRef.inputOverrides };
  const studyType = caseRef.studyType === 'EXISTING_BUILDING' ? STUDY_TYPE.EXISTING_BUILDING : STUDY_TYPE.LAND_DEVELOPMENT;
  const request = { studyType, inputs, leverageEnabled: inputs.leverageEnabled === true };
  if (caseRef.assumptionModelVersion) request.assumptionModelVersion = ASSUMPTION_MODEL_VERSION.V2;
  const result = calculateInvestmentCase(request);
  const expected = caseRef.expected;
  const money = corpus.numericTolerance.currencySar;

  for (const key of ['financialModelVersion', 'financialModelStatus', 'decisionStatus', 'verdict', 'metCount', 'totalCriteria']) {
    assert.equal(result[key], expected[key], `${caseRef.id}: ${key}`);
  }
  assert.deepEqual(result.failedHardGates, expected.failedHardGates, `${caseRef.id}: hard gates`);
  assert.deepEqual(result.failedSoftCriteria, expected.failedSoftCriteria, `${caseRef.id}: soft criteria`);
  approx(result.npv, expected.npv, money, `${caseRef.id}: corpus NPV`);
  approx(result.irr, expected.irr, corpus.numericTolerance.irr, `${caseRef.id}: corpus IRR`);
  assert.equal(result.cashflows.length, expected.cashflowLength, `${caseRef.id}: cashflow length`);
  assert.equal(result.priceBasis.metric, expected.priceBasisMetric, `${caseRef.id}: price metric basis`);
  assert.equal(result.priceBasis.outputBasis, expected.priceBasisOutputBasis, `${caseRef.id}: price output basis`);
  assert.equal(result.timingBasis.version, expected.timingBasisVersion, `${caseRef.id}: timing version`);
  assert.equal(result.timingBasis.transactionAuthorized, false, `${caseRef.id}: transaction authority`);

  const independent = studyType === STUDY_TYPE.EXISTING_BUILDING
    ? buildingReference(fixture.input_set, caseRef.inputOverrides)
    : landReference(inputs);
  const resultCost = studyType === STUDY_TYPE.EXISTING_BUILDING ? result.totalPurchaseCost : result.totalProjectCost;
  const referenceCost = studyType === STUDY_TYPE.EXISTING_BUILDING ? independent.purchaseCost : independent.projectCost;
  const expectedCost = studyType === STUDY_TYPE.EXISTING_BUILDING ? expected.totalPurchaseCost : expected.totalProjectCost;
  const resultNoi = studyType === STUDY_TYPE.EXISTING_BUILDING ? result.NOI : result.stabilizedNOI;
  const expectedNoi = studyType === STUDY_TYPE.EXISTING_BUILDING ? expected.NOI : expected.stabilizedNOI;
  approx(resultCost, referenceCost, money, `${caseRef.id}: independent cost identity`);
  approx(resultCost, expectedCost, money, `${caseRef.id}: corpus cost`);
  approx(resultNoi, independent.NOI, money, `${caseRef.id}: independent NOI identity`);
  approx(resultNoi, expectedNoi, money, `${caseRef.id}: corpus NOI`);
  assert.equal(result.cashflows.length, independent.cashflows.length, `${caseRef.id}: independent cashflow length`);
  result.cashflows.forEach((flow, i) => approx(flow, independent.cashflows[i], money, `${caseRef.id}: cashflow[${i}]`));
  approx(result.npv, independent.npv, money, `${caseRef.id}: independent NPV`);
  approx(result.irr, independent.irr, 1e-8, `${caseRef.id}: independent IRR`);
  assert.ok(independent.payback > inputs.maxPaybackThreshold, `${caseRef.id}: soft payback failure independently reproduced`);

  const softCode = studyType === STUDY_TYPE.EXISTING_BUILDING ? 'CUMULATIVE_PAYBACK' : 'CUMULATIVE_PROJECT_PAYBACK';
  assert.ok(result.criteriaDetail.some((item) => item.code === softCode && item.met === false && item.hardGate === false), `${caseRef.id}: soft criterion semantics`);

  if (studyType === STUDY_TYPE.EXISTING_BUILDING) {
    assert.equal(result.assumptionModelVersion, 'V2');
    assert.equal(result.assumptionModelDisclosure.userApprovedAssumptions, false, `${caseRef.id}: no invented approval`);
    assert.equal(result.criticalAssumptionOverrideGovernance.status, expected.criticalOverrideGovernanceStatus);
    assert.equal(result.criticalAssumptionOverrideGovernance.decisionReady, true);
  }

  assert.equal(result.financingEngineVersion ?? null, expected.financingEngineVersion, `${caseRef.id}: financing engine version`);
  if (expected.financingEngineVersion) {
    assert.equal(result.financingRatioBasis, expected.financingRatioBasis, `${caseRef.id}: financing ratio basis`);
    approx(result.financingRatioDenominatorSar, expected.financingRatioDenominatorSar, money, `${caseRef.id}: financing denominator`);
    approx(result.requestedDebtRatio, expected.requestedDebtRatio, corpus.numericTolerance.ratio, `${caseRef.id}: requested debt ratio`);
    approx(result.loanAmount, expected.loanAmount, money, `${caseRef.id}: loan amount`);
    approx(result.debtService, expected.debtService, money, `${caseRef.id}: debt service`);
    approx(result.dscrMin, expected.dscrMin, 1e-9, `${caseRef.id}: DSCR`);
    approx(result.leveredNPV, expected.leveredNPV, money, `${caseRef.id}: levered NPV`);
    approx(result.leveredIRR, expected.leveredIRR, 1e-8, `${caseRef.id}: levered IRR`);
    assert.equal(result.loanSizingConstraint, expected.loanSizingConstraint, `${caseRef.id}: financing binding constraint`);
    approx(result.actualDebtToBasisRatio, result.loanAmount / result.financingRatioDenominatorSar, 1e-10, `${caseRef.id}: debt-ratio identity`);

    if (studyType === STUDY_TYPE.EXISTING_BUILDING) {
      assert.equal(result.loanSizingConstraint, 'LTC');
      approx(result.loanAmount, result.totalPurchaseCost * inputs.ltv, money, `${caseRef.id}: LTC-bound debt`);
    } else {
      assert.equal(result.loanSizingConstraint, 'DSCR');
      assert.equal(result.constructionDebtSchedule.length, expected.constructionDebtScheduleLength);
      assert.equal(result.annualConstructionDebtDraws.length, expected.annualConstructionDebtDrawsLength);
      const monthlyConstructionPrincipal = result.constructionDebtSchedule.reduce((sum, row) => sum + row.constructionDebtDraw, 0);
      const annualConstructionPrincipal = result.annualConstructionDebtDraws.reduce((sum, row) => sum + row.debtDraw, 0);
      approx(monthlyConstructionPrincipal, annualConstructionPrincipal, money, `${caseRef.id}: monthly/annual construction draw reconciliation`);
      const landDebtAtTimeZero = result.loanAmount - monthlyConstructionPrincipal;
      approx(landDebtAtTimeZero, result.totalLandAcquisitionCost * result.constructionDebtFraction, money, `${caseRef.id}: time-zero land debt identity`);
      approx(landDebtAtTimeZero + monthlyConstructionPrincipal, result.loanAmount, money, `${caseRef.id}: total principal reconciliation`);
      approx(result.dscrMin, inputs.minDscrThreshold, 1e-9, `${caseRef.id}: DSCR binding identity`);
      assert.equal(result.timingBasis.landDebtDrawTiming, 'TIME_ZERO');
      assert.equal(result.timingBasis.constructionDebtDrawTiming, 'MONTHLY_BEGINNING_OF_PERIOD');
      assert.equal(result.timingBasis.constructionInterestCapitalizationTiming, 'MONTHLY_END_OF_PERIOD');
      assert.equal(result.timingBasis.annualConstructionDebtDrawsAreAggregationOnly, true);
    }
  }
}

console.log('CURRENT_MODEL_REFERENCE_CORPUS_P27=PASS');
