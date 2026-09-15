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

// Governed building RETT that would overwrite the legacy transferFeeRate must
// fail closed because that field also controls terminal-sale cost today.
assert.throws(() => calculateGovernedInvestmentCase({
  studyType: STUDY_TYPE.EXISTING_BUILDING,
  inputs: {
    ...inputs,
    rettRate: 0.05,
    rettEconomicBearer: 'SELLER',
    brokeragePayer: 'UNKNOWN',
  },
  leverageEnabled: inputs.leverageEnabled,
}), (error) => error && error.code === 'BUILDING_RETT_DISPOSITION_SEMANTICS_NOT_SEPARATED');

console.log('INVESTMENT_CASE_ORCHESTRATOR_TESTS=PASS');
