'use strict';

const assert = require('assert');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const {
  calculateUiInvestmentState,
} = require('../../src/assumptions/ui-integration-controller');

const fixture = require('../characterization/fixtures/RE-GOLD-002-U.json');
const baseInputs = fixture.input_set;

const directLegacy = calculateInvestmentCase({
  studyType: STUDY_TYPE.EXISTING_BUILDING,
  inputs: baseInputs,
  leverageEnabled: Boolean(baseInputs.leverageEnabled),
});

const uiLegacy = calculateUiInvestmentState({
  mode: 'building',
  inputs: baseInputs,
});

assert.deepStrictEqual(uiLegacy.results, directLegacy, 'Legacy UI financial output must remain equivalent');
assert.strictEqual(uiLegacy.acquisitionCostGovernance.legacyCompatibility, true);
assert.strictEqual(uiLegacy.transactionAuthority, 'ANALYSIS_ONLY');
assert.strictEqual(uiLegacy.transactionAuthorized, false);

const governedUnknown = calculateUiInvestmentState({
  mode: 'building',
  inputs: {
    ...baseInputs,
    rettRate: 0.05,
    rettEconomicBearer: 'UNKNOWN',
    brokerageRate: 0.025,
    brokeragePayer: 'UNKNOWN',
  },
});

assert.strictEqual(governedUnknown.acquisitionCostGovernance.legacyCompatibility, false);
assert.strictEqual(governedUnknown.acquisitionCostGovernance.governed.rett.buyerEconomicAmount, 0);
assert.strictEqual(governedUnknown.acquisitionCostGovernance.governed.brokerage.buyerEconomicAmount, 0);
assert.strictEqual(governedUnknown.acquisitionCostGovernance.warnings.length, 2);
assert.strictEqual(governedUnknown.transactionAuthority, 'ANALYSIS_ONLY');
assert.strictEqual(governedUnknown.transactionAuthorized, false);

const governedBuyer = calculateUiInvestmentState({
  mode: 'building',
  inputs: {
    ...baseInputs,
    rettRate: 0.05,
    rettEconomicBearer: 'BUYER',
    brokerageRate: 0.025,
    brokeragePayer: 'BUYER',
  },
});

assert.strictEqual(governedBuyer.acquisitionCostGovernance.governed.rett.buyerEconomicAmount, baseInputs.buildingPrice * 0.05);
assert.strictEqual(governedBuyer.acquisitionCostGovernance.governed.brokerage.buyerEconomicAmount, baseInputs.buildingPrice * 0.025);
assert.strictEqual(governedBuyer.transactionAuthority, 'ANALYSIS_ONLY');
assert.strictEqual(governedBuyer.transactionAuthorized, false);

console.log('UI_GOVERNED_ACQUISITION_ORCHESTRATION_TESTS=PASS');
