'use strict';

const assert = require('assert');
const { validateSavedDealRecord, SavedDealValidationError } = require('../../src/validation/saved-deal-schema');
const {
  VALUATION_CASE_SCHEMA_VERSION,
  SAVED_DEAL_VALUATION_MODE,
  getSavedDealValuationMode,
  attachValuationCase,
} = require('../../src/valuation-intelligence');
const {
  buildExportPayload,
  planRestore,
  BACKUP_FORMAT,
  BACKUP_VERSION,
} = require('../../src/storage/saved-deals-backup');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const gold = require('../reference/RE-GOLD-baseline.json');

function valuationCase(projectId = 'PROJECT-SAVED-VAL-001') {
  return {
    schemaVersion: VALUATION_CASE_SCHEMA_VERSION,
    projectId,
    classification: {
      assetClass: 'OFFICE',
      lifecycleStage: 'STABILIZED',
      investmentStrategy: 'CORE_INCOME',
      incomeModel: 'LEASE_INCOME',
      jurisdiction: { country: 'SA', city: 'Riyadh' },
    },
    incomePolicy: {
      expenseTreatment: 'MARKET_ESTIMATE',
      basis: 'MARKET_VALUE',
      currency: 'SAR',
      valuationDate: '2026-09-05',
    },
    evidencePolicy: {
      minEvidenceCount: 3,
      maxAssumptionBurdenRatio: 1,
      maxLowGradeRatio: 1,
    },
  };
}

function mockProvider(store) {
  return {
    get: async (key) => store[key] || null,
    set: async (key, value) => { store[key] = value; },
  };
}

(async () => {
  const B = gold['RE-GOLD-002_existing_building'].inputs;
  const legacy = { id: 'legacy-1', name: 'Legacy', mode: 'building', inputs: B, savedAt: '2026-09-05' };
  const legacyBefore = JSON.stringify(legacy);

  assert.strictEqual(validateSavedDealRecord(legacy), legacy);
  assert.strictEqual(JSON.stringify(legacy), legacyBefore);
  assert.strictEqual(getSavedDealValuationMode(legacy), SAVED_DEAL_VALUATION_MODE.LEGACY_ONLY);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(legacy, 'valuationCase'), false);

  const baselineResult = calculateInvestmentCase({
    studyType: STUDY_TYPE.EXISTING_BUILDING,
    inputs: legacy.inputs,
    leverageEnabled: false,
  });

  const extended = attachValuationCase(legacy, valuationCase());
  assert.notStrictEqual(extended, legacy);
  assert.strictEqual(JSON.stringify(legacy), legacyBefore);
  assert.strictEqual(getSavedDealValuationMode(extended), SAVED_DEAL_VALUATION_MODE.VALUATION_V1);
  assert.strictEqual(validateSavedDealRecord(extended), extended);

  const resultWithExtensionPresent = calculateInvestmentCase({
    studyType: STUDY_TYPE.EXISTING_BUILDING,
    inputs: extended.inputs,
    leverageEnabled: false,
  });
  assert.strictEqual(resultWithExtensionPresent.NOI, baselineResult.NOI);
  assert.strictEqual(resultWithExtensionPresent.irr, baselineResult.irr);
  assert.strictEqual(resultWithExtensionPresent.npv, baselineResult.npv);
  assert.strictEqual(resultWithExtensionPresent.verdict, baselineResult.verdict);

  const invalidVersion = {
    ...legacy,
    valuationCase: { ...valuationCase(), schemaVersion: 999 },
  };
  assert.throws(
    () => validateSavedDealRecord(invalidVersion),
    (error) => error instanceof SavedDealValidationError && error.reasonCode === 'INVALID_VALUATION_CASE',
  );

  const landWithValuation = {
    id: 'land-1',
    name: 'Land',
    mode: 'land',
    inputs: {},
    savedAt: '2026-09-05',
    valuationCase: valuationCase('PROJECT-LAND-INVALID'),
  };
  assert.throws(
    () => validateSavedDealRecord(landWithValuation),
    (error) => error instanceof SavedDealValidationError && error.reasonCode === 'VALUATION_CASE_REQUIRES_BUILDING_MODE',
  );

  const store = { 'deal:extended-1': JSON.stringify({ ...extended, id: 'extended-1' }) };
  const exported = await buildExportPayload([{ id: 'extended-1' }], mockProvider(store));
  assert.strictEqual(BACKUP_VERSION, 3);
  assert.strictEqual(exported.backupVersion, 3);
  assert.deepStrictEqual(exported.deals[0].valuationCase, extended.valuationCase);

  const legacyV2Backup = {
    format: BACKUP_FORMAT,
    backupVersion: 2,
    deals: [{ id: 'legacy-v2', name: 'Legacy v2', mode: 'building', inputs: B, savedAt: '2026-09-05' }],
  };
  const legacyPlan = planRestore(legacyV2Backup, [], new Map());
  assert.strictEqual(legacyPlan.toWrite.length, 1);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(legacyPlan.toWrite[0].record, 'valuationCase'), false);

  const valuationV3Backup = {
    format: BACKUP_FORMAT,
    backupVersion: 3,
    deals: [{ ...extended, id: 'valuation-v3' }],
  };
  const valuationPlan = planRestore(valuationV3Backup, [], new Map());
  assert.strictEqual(valuationPlan.toWrite.length, 1);
  assert.deepStrictEqual(valuationPlan.toWrite[0].record.valuationCase, extended.valuationCase);

  console.log('VALUATION_CASE_SAVED_DEAL_COMPATIBILITY_V1=PASS');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
