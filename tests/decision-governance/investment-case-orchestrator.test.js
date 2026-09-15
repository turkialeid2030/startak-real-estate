'use strict';

const assert = require('assert');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const { calculateGovernedInvestmentCase } = require('../../src/decision-governance/investment-case-orchestrator');

// Reuse the repository's existing characterized building fixture rather than
// inventing a parallel fixture. This proves legacy-equivalence against the same
// source inputs used by the canonical characterization suite.
const buildingFixture = require('../characterization/fixtures/RE-GOLD-002-U.json');
const inputs = buildingFixture.input_set;
assert.strictEqual(buildingFixture.study_type, 'building');
assert(inputs, 'Characterized building fixture must expose input_set');

const direct = calculateInvestmentCase({
  studyType: STUDY_TYPE.EXISTING_BUILDING,
  inputs,
  leverageEnabled: inputs.leverageEnabled,
});
const governedLegacy = calculateGovernedInvestmentCase({
  studyType: STUDY_TYPE.EXISTING_BUILDING,
  inputs,
  leverageEnabled: inputs.leverageEnabled,
});
assert.deepStrictEqual(governedLegacy.financialResult, direct, 'Legacy financial output contract must remain object-equivalent');
assert.strictEqual(governedLegacy.acquisitionCostGovernance.legacyCompatibility, true);
assert.strictEqual(Object.prototype.hasOwnProperty.call(governedLegacy.financialResult, 'acquisitionCostGovernance'), false);

// Governed acquisition burden must be carried independently from the legacy
// rates. Those legacy rates may still drive disposition/compatibility behavior
// and therefore must not be rewritten by RETT/brokerage governance.
const sellerBorne = calculateGovernedInvestmentCase({
  studyType: STUDY_TYPE.EXISTING_BUILDING,
  inputs: {
    ...inputs,
    rettRate: 0.05,
    rettEconomicBearer: 'SELLER',
    brokerageRate: 0.025,
    brokeragePayer: 'SELLER',
  },
  leverageEnabled: inputs.leverageEnabled,
});
assert.strictEqual(sellerBorne.acquisitionCostGovernance.legacyCompatibility, false);
assert.strictEqual(sellerBorne.acquisitionCostGovernance.governed.rett.buyerEconomicAmount, 0);
assert.strictEqual(sellerBorne.acquisitionCostGovernance.governed.brokerage.buyerEconomicAmount, 0);

const unknownBorne = calculateGovernedInvestmentCase({
  studyType: STUDY_TYPE.EXISTING_BUILDING,
  inputs: {
    ...inputs,
    rettRate: 0.05,
    rettEconomicBearer: 'UNKNOWN',
    brokerageRate: 0.025,
    brokeragePayer: 'UNKNOWN',
  },
  leverageEnabled: inputs.leverageEnabled,
});
assert.strictEqual(unknownBorne.acquisitionCostGovernance.governed.rett.buyerEconomicAmount, 0);
assert.strictEqual(unknownBorne.acquisitionCostGovernance.governed.brokerage.buyerEconomicAmount, 0);
assert.strictEqual(unknownBorne.acquisitionCostGovernance.warnings.length, 2);

const buyerBorne = calculateGovernedInvestmentCase({
  studyType: STUDY_TYPE.EXISTING_BUILDING,
  inputs: {
    ...inputs,
    rettRate: 0.05,
    rettEconomicBearer: 'BUYER',
    brokerageRate: 0.025,
    brokeragePayer: 'BUYER',
  },
  leverageEnabled: inputs.leverageEnabled,
});
assert.strictEqual(buyerBorne.acquisitionCostGovernance.governed.rett.buyerEconomicAmount, inputs.buildingPrice * 0.05);
assert.strictEqual(buyerBorne.acquisitionCostGovernance.governed.brokerage.buyerEconomicAmount, inputs.buildingPrice * 0.025);

// Governance metadata must remain outside the characterized financial contract.
assert.strictEqual(Object.prototype.hasOwnProperty.call(sellerBorne.financialResult, 'acquisitionCostGovernance'), false);
assert.strictEqual(Object.prototype.hasOwnProperty.call(buyerBorne.financialResult, 'acquisitionCostGovernance'), false);

console.log('INVESTMENT_CASE_ORCHESTRATOR_TESTS=PASS');
