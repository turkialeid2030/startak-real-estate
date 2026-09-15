'use strict';

const assert = require('assert');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const { calculateGovernedInvestmentCase } = require('../../src/decision-governance/investment-case-orchestrator');

// Use the repository's characterized fixture inputs to prove that the wrapper
// does not mutate the canonical financial result contract for legacy deals.
const fixtures = require('../fixtures/golden-fixtures.json');
const buildingFixture = fixtures.find((fixture) => fixture.studyType === STUDY_TYPE.EXISTING_BUILDING || fixture.studyType === 'EXISTING_BUILDING');

assert(buildingFixture, 'Expected an existing-building golden fixture');
const inputs = buildingFixture.inputs || buildingFixture.input;
assert(inputs, 'Golden fixture must expose inputs');

const direct = calculateInvestmentCase({
  studyType: STUDY_TYPE.EXISTING_BUILDING,
  inputs,
  leverageEnabled: inputs.leverageEnabled,
  assumptionModelVersion: buildingFixture.assumptionModelVersion,
});
const governedLegacy = calculateGovernedInvestmentCase({
  studyType: STUDY_TYPE.EXISTING_BUILDING,
  inputs,
  leverageEnabled: inputs.leverageEnabled,
  assumptionModelVersion: buildingFixture.assumptionModelVersion,
});
assert.deepStrictEqual(governedLegacy.financialResult, direct, 'Legacy financial output contract must remain byte-for-byte equivalent at object level');
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
  assumptionModelVersion: buildingFixture.assumptionModelVersion,
}), (error) => error && error.code === 'BUILDING_RETT_DISPOSITION_SEMANTICS_NOT_SEPARATED');

console.log('INVESTMENT_CASE_ORCHESTRATOR_TESTS=PASS');
