'use strict';

const assert = require('assert/strict');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const { calcExistingBuilding } = require('../../src/engines/valuation/existing-building');
const {
  EXIT_TRANSACTION_COST_SOURCE,
  resolveExitTransactionCostRate,
} = require('../../src/engines/valuation/exit-transaction-cost-resolver');
const {
  UI_MODE,
  createUiWorkspace,
  hydrateUiDeal,
  calculateUiInvestmentState,
  applyExitTransactionCostInputText,
} = require('../../src/assumptions/ui-integration-controller');
const { ASSUMPTION_MODEL_VERSION } = require('../../src/assumptions/assumption-model');
const gold = require(require('../config/paths').getGoldBaselinePath());

function close(actual, expected, tolerance, label) {
  assert.ok(Number.isFinite(actual), `${label}: expected finite actual, got ${actual}`);
  assert.ok(Number.isFinite(expected), `${label}: expected finite expected, got ${expected}`);
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${label}: ${actual} != ${expected} within ${tolerance}`);
}

const base = {
  ...gold['RE-GOLD-002_existing_building'].inputs,
  exitCapRate: 0.07,
  leverageEnabled: false,
};

// LEGACY compatibility: if no dedicated exit rate was historically persisted,
// preserve the old economics by falling back to acquisition transferFeeRate.
const legacyResolution = resolveExitTransactionCostRate(base, {
  assumptionModelVersion: ASSUMPTION_MODEL_VERSION.LEGACY,
});
assert.equal(legacyResolution.status,
  EXIT_TRANSACTION_COST_SOURCE.LEGACY_ACQUISITION_RATE_FALLBACK);
assert.equal(legacyResolution.value, base.transferFeeRate);
assert.equal(legacyResolution.statutoryTaxpayerDetermined, false);

const historicalEngine = calcExistingBuilding(base, {
  assumptionModelVersion: ASSUMPTION_MODEL_VERSION.LEGACY,
});
const legacyGoverned = calculateInvestmentCase({
  studyType: STUDY_TYPE.EXISTING_BUILDING,
  inputs: base,
  leverageEnabled: false,
  assumptionModelVersion: ASSUMPTION_MODEL_VERSION.LEGACY,
});
assert.equal(legacyGoverned.exitTransactionCostSource,
  EXIT_TRANSACTION_COST_SOURCE.LEGACY_ACQUISITION_RATE_FALLBACK);
close(legacyGoverned.totalPurchaseCost, historicalEngine.totalPurchaseCost, 0.01, 'legacy acquisition cost');
close(legacyGoverned.terminalNetSaleProceeds, historicalEngine.terminalNetSaleProceeds, 0.01, 'legacy terminal proceeds');
close(legacyGoverned.npv, historicalEngine.npv, 0.05, 'legacy NPV compatibility');

// V2 must not silently reuse the acquisition rate. Missing seller-borne exit
// cost holds all exit-dependent analytics even when an explicit exit cap exists.
const v2MissingExitCost = calculateInvestmentCase({
  studyType: STUDY_TYPE.EXISTING_BUILDING,
  inputs: base,
  leverageEnabled: false,
  assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2,
});
assert.equal(v2MissingExitCost.financialModelStatus, 'INCOMPLETE_INPUTS');
assert.equal(v2MissingExitCost.decisionStatus, 'INCOMPLETE_INPUTS');
assert.equal(v2MissingExitCost.exitTransactionCostSource,
  EXIT_TRANSACTION_COST_SOURCE.MISSING_REQUIRED);
assert.ok(v2MissingExitCost.incompleteInputs.includes('exitTransferFeeRate'));
assert.equal(v2MissingExitCost.terminalNetSaleProceeds, null);
assert.equal(v2MissingExitCost.npv, null);
assert.equal(v2MissingExitCost.irr, null);
assert.equal(v2MissingExitCost.cashflowsIncludeTerminalValue, false);

// Explicitly separate acquisition and exit economics. Acquisition transferFee
// changes purchase cost only; dedicated exitTransferFeeRate changes terminal net
// proceeds only.
const v2Explicit = {
  ...base,
  exitTransferFeeRate: 0.02,
};
const explicit = calculateInvestmentCase({
  studyType: STUDY_TYPE.EXISTING_BUILDING,
  inputs: v2Explicit,
  leverageEnabled: false,
  assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2,
});
assert.equal(explicit.exitTransactionCostSource, EXIT_TRANSACTION_COST_SOURCE.EXPLICIT);
assert.equal(explicit.exitTransactionCostRate, 0.02);
assert.equal(explicit.statuesqueExitTaxpayerDetermined, undefined);
assert.equal(explicit.statutoryExitTaxpayerDetermined, false);
close(explicit.terminalNetSaleProceeds,
  explicit.terminalSaleValue * 0.98,
  0.02,
  '2% seller-borne exit assumption');

const lowerAcquisitionCost = calculateInvestmentCase({
  studyType: STUDY_TYPE.EXISTING_BUILDING,
  inputs: { ...v2Explicit, transferFeeRate: 0.01 },
  leverageEnabled: false,
  assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2,
});
assert.ok(lowerAcquisitionCost.totalPurchaseCost < explicit.totalPurchaseCost,
  'lower acquisition cost assumption must reduce total purchase cost');
close(lowerAcquisitionCost.terminalNetSaleProceeds,
  explicit.terminalNetSaleProceeds,
  0.02,
  'acquisition rate must not alter terminal net proceeds when exit rate is explicit');

const higherExitCost = calculateInvestmentCase({
  studyType: STUDY_TYPE.EXISTING_BUILDING,
  inputs: { ...v2Explicit, exitTransferFeeRate: 0.06 },
  leverageEnabled: false,
  assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2,
});
close(higherExitCost.totalPurchaseCost,
  explicit.totalPurchaseCost,
  0.01,
  'exit cost must not alter acquisition cost');
assert.ok(higherExitCost.terminalNetSaleProceeds < explicit.terminalNetSaleProceeds,
  'higher exit cost must reduce terminal net proceeds');
close(higherExitCost.terminalNetSaleProceeds,
  higherExitCost.terminalSaleValue * 0.94,
  0.02,
  '6% seller-borne exit assumption');
assert.ok(higherExitCost.npv < explicit.npv,
  'higher seller-borne exit cost must reduce NPV');

// Explicit zero is evidence, not missing data.
const zeroExitCost = calculateInvestmentCase({
  studyType: STUDY_TYPE.EXISTING_BUILDING,
  inputs: { ...v2Explicit, exitTransferFeeRate: 0 },
  leverageEnabled: false,
  assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2,
});
assert.equal(zeroExitCost.financialModelStatus, 'VALID');
assert.equal(zeroExitCost.exitTransactionCostRate, 0);
close(zeroExitCost.terminalNetSaleProceeds,
  zeroExitCost.terminalSaleValue,
  0.02,
  'explicit zero exit cost');

// UI and persistence provenance: fresh V2 and V2 saved deals with no persisted
// exit cost must not inherit a default/sample rate. 0% input must round-trip as
// an explicit present assumption.
const defaults = { ...v2Explicit, exitTransferFeeRate: 0.05 };
const fresh = createUiWorkspace({ mode: UI_MODE.BUILDING, defaultInputs: defaults });
assert.equal(Object.prototype.hasOwnProperty.call(fresh.inputs, 'exitCapRate'), false);
assert.equal(Object.prototype.hasOwnProperty.call(fresh.inputs, 'exitTransferFeeRate'), false);

const explicitExitCapInputs = { ...fresh.inputs, exitCapRate: 0.07 };
const uiIncomplete = calculateUiInvestmentState({
  mode: UI_MODE.BUILDING,
  inputs: explicitExitCapInputs,
  assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2,
});
assert.equal(uiIncomplete.exitTransactionCostInputRequired, true);
assert.equal(uiIncomplete.sensitivityReady, false);

const enteredZero = applyExitTransactionCostInputText({
  inputs: explicitExitCapInputs,
  rawText: '0',
  min: 0,
  max: 1,
});
assert.equal(enteredZero.inputValid, true);
assert.equal(enteredZero.exitTransactionCostPresent, true);
assert.equal(enteredZero.inputs.exitTransferFeeRate, 0);
assert.equal(enteredZero.displayValue, '0');
const uiComplete = calculateUiInvestmentState({
  mode: UI_MODE.BUILDING,
  inputs: enteredZero.inputs,
  assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2,
});
assert.equal(uiComplete.exitTransactionCostInputRequired, false);
assert.notEqual(uiComplete.results.financialModelStatus, 'INCOMPLETE_INPUTS');

const hydratedV2Missing = hydrateUiDeal({
  record: {
    id: 'p22-v2-missing-exit-cost',
    name: 'P22 V2 Missing Exit Cost',
    mode: 'building',
    assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2,
    inputs: { ...base, exitCapRate: 0.07 },
    savedAt: '2026-09-28T00:00:00.000Z',
  },
  defaultInputs: defaults,
});
assert.equal(Object.prototype.hasOwnProperty.call(hydratedV2Missing.inputs, 'exitTransferFeeRate'), false);

console.log('BUILDING_EXIT_TRANSACTION_COST_GOVERNANCE_P22=PASS');
