'use strict';

const assert = require('assert/strict');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const { ASSUMPTION_MODEL_VERSION } = require('../../src/assumptions/assumption-model');

const buildingU = require('../characterization/fixtures/RE-GOLD-002-U.json');
const buildingL = require('../characterization/fixtures/RE-GOLD-002-L.json');
const landU = require('../characterization/fixtures/RE-GOLD-001-U.json');
const landL = require('../characterization/fixtures/RE-GOLD-001-L.json');

function summarize(id, result) {
  return {
    id,
    financialModelVersion: result.financialModelVersion ?? null,
    financialModelStatus: result.financialModelStatus ?? null,
    decisionStatus: result.decisionStatus ?? null,
    verdict: result.verdict ?? null,
    metCount: result.metCount ?? null,
    totalCriteria: result.totalCriteria ?? null,
    npv: result.npv ?? null,
    irr: result.irr ?? null,
    NOI: result.NOI ?? null,
    stabilizedNOI: result.stabilizedNOI ?? null,
    totalPurchaseCost: result.totalPurchaseCost ?? null,
    totalProjectCost: result.totalProjectCost ?? null,
    cashflowLength: Array.isArray(result.cashflows) ? result.cashflows.length : null,
    loanAmount: result.loanAmount ?? null,
    debtService: result.debtService ?? null,
    dscrMin: result.dscrMin ?? null,
    leveredNPV: result.leveredNPV ?? null,
    leveredIRR: result.leveredIRR ?? null,
    equityDiscountRate: result.equityDiscountRate ?? null,
    financingEngineVersion: result.financingEngineVersion ?? null,
    loanSizingConstraint: result.loanSizingConstraint ?? null,
    constructionDebtScheduleLength: Array.isArray(result.constructionDebtSchedule) ? result.constructionDebtSchedule.length : null,
    annualConstructionDebtDrawsLength: Array.isArray(result.annualConstructionDebtDraws) ? result.annualConstructionDebtDraws.length : null,
    priceBasis: result.priceBasis ?? null,
    timingBasis: result.timingBasis ?? null,
    criticalAssumptionOverrideGovernance: result.criticalAssumptionOverrideGovernance ?? null,
  };
}

const cases = [];

for (const [id, fixture, leverageEnabled] of [
  ['BUILDING_V2_UNLEVERED', buildingU, false],
  ['BUILDING_V2_WAVEB', buildingL, true],
]) {
  const inputs = {
    ...fixture.input_set,
    leaseYears: fixture.input_set.holdPeriod + 1,
    exitCapRate: 0.07,
    exitTransferFeeRate: 0.05,
    leverageEnabled,
  };
  const result = calculateInvestmentCase({
    studyType: STUDY_TYPE.EXISTING_BUILDING,
    inputs,
    leverageEnabled,
    assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2,
  });
  assert.ok(Number.isFinite(result.npv));
  assert.ok(Number.isFinite(result.irr));
  cases.push(summarize(id, result));
}

for (const [id, fixture, leverageEnabled] of [
  ['LAND_CURRENT_UNLEVERED', landU, false],
  ['LAND_CURRENT_WAVEB', landL, true],
]) {
  const inputs = { ...fixture.input_set, leverageEnabled };
  const result = calculateInvestmentCase({
    studyType: STUDY_TYPE.LAND_DEVELOPMENT,
    inputs,
    leverageEnabled,
  });
  assert.ok(Number.isFinite(result.npv));
  assert.ok(Number.isFinite(result.irr));
  cases.push(summarize(id, result));
}

throw new Error(`P27_CURRENT_REFERENCE_PROBE=${JSON.stringify(cases)}`);
