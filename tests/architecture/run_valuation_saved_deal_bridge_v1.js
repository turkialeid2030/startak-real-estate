'use strict';

const assert = require('assert');
const {
  valuationCaseFromSavedDeal,
  withValuationCase,
} = require('../../src/app/valuation-saved-deal-bridge');

function valuationCase(projectId = 'PROJECT-BRIDGE-001') {
  return {
    schemaVersion: 1,
    projectId,
    classification: {
      assetClass: 'OFFICE',
      lifecycleStage: 'STABILIZED',
      investmentStrategy: 'CORE_INCOME',
      incomeModel: 'LEASE_INCOME',
    },
    incomePolicy: {
      expenseTreatment: 'ACTUAL_LANDLORD_OPEX',
      basis: 'MARKET_VALUE',
      currency: 'SAR',
      valuationDate: null,
    },
    evidencePolicy: {
      minEvidenceCount: 3,
      maxAssumptionBurdenRatio: 1,
      maxLowGradeRatio: 1,
    },
    singleMethodPolicy: {
      allowedMethod: 'INCOME_DIRECT_CAPITALIZATION',
      justification: 'Explicit professional acceptance for this test case.',
    },
  };
}

(function testLegacyBuildingDealRemainsLegacyWithoutAutoMigration() {
  const deal = { id: 'D1', mode: 'building', inputs: { buildingPrice: 1 } };
  assert.strictEqual(valuationCaseFromSavedDeal(deal), null);
  assert.deepStrictEqual(withValuationCase(deal, null), deal);
})();

(function testLoadedValuationCaseIsClonedAndPreserved() {
  const config = valuationCase();
  const deal = { id: 'D2', mode: 'building', inputs: {}, valuationCase: config };
  const loaded = valuationCaseFromSavedDeal(deal);
  assert.deepStrictEqual(loaded, config);
  assert.notStrictEqual(loaded, config);
  loaded.projectId = 'MUTATED';
  assert.strictEqual(deal.valuationCase.projectId, 'PROJECT-BRIDGE-001');
})();

(function testAttachingValuationCaseIsBuildingOnlyAndNonDestructive() {
  const config = valuationCase('PROJECT-BRIDGE-002');
  const source = { id: 'D3', mode: 'building', inputs: { rentPerSqm: 1000 } };
  const attached = withValuationCase(source, config);
  assert.deepStrictEqual(attached.inputs, source.inputs);
  assert.strictEqual(attached.valuationCase.projectId, 'PROJECT-BRIDGE-002');
  assert.notStrictEqual(attached.valuationCase, config);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(source, 'valuationCase'), false);
})();

(function testDisablingValuationRemovesOnlyTheOptionalExtension() {
  const source = {
    id: 'D4',
    mode: 'building',
    inputs: { buildingPrice: 10 },
    operatingCase: { schemaVersion: 1 },
    valuationCase: valuationCase(),
  };
  const disabled = withValuationCase(source, null);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(disabled, 'valuationCase'), false);
  assert.deepStrictEqual(disabled.inputs, source.inputs);
  assert.deepStrictEqual(disabled.operatingCase, source.operatingCase);
})();

(function testLandNeverCarriesBuildingValuationExtension() {
  const source = { id: 'L1', mode: 'land', inputs: { landPricePerSqm: 100 }, valuationCase: valuationCase() };
  assert.strictEqual(valuationCaseFromSavedDeal(source), null);
  const sanitized = withValuationCase(source, valuationCase());
  assert.strictEqual(Object.prototype.hasOwnProperty.call(sanitized, 'valuationCase'), false);
})();

console.log('VALUATION_SAVED_DEAL_BRIDGE_V1=PASS');
