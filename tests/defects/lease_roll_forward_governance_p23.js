'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const { calcExistingBuilding } = require('../../src/engines/valuation/existing-building');
const { ASSUMPTION_MODEL_VERSION } = require('../../src/assumptions/assumption-model');
const { LEASE_ROLL_FORWARD_STATUS } = require('../../src/engines/valuation/existing-building-lease-roll-forward-governance');
const {
  UI_MODE,
  calculateUiInvestmentState,
  buildUiDisclosureViewModel,
} = require('../../src/assumptions/ui-integration-controller');

const fixture = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'characterization', 'fixtures', 'RE-GOLD-002-U.json'),
  'utf8',
));

const supportedInputs = {
  ...fixture.input_set,
  leaseYears: 5,
  holdPeriod: 5,
  exitCapRate: 0.07,
  exitTransferFeeRate: 0.05,
};
const expiredInputs = { ...supportedInputs, leaseYears: 1 };

// 1) Document the raw Wave-A coverage gap independently: leaseYears is accepted
// but does not change the raw hold-period economics at all.
const rawFiveYearLease = calcExistingBuilding(supportedInputs, { assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2 });
const rawOneYearLease = calcExistingBuilding(expiredInputs, { assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2 });
assert.deepEqual(rawOneYearLease.cashflows, rawFiveYearLease.cashflows);
assert.equal(rawOneYearLease.npv, rawFiveYearLease.npv);
assert.equal(rawOneYearLease.irr, rawFiveYearLease.irr);
assert.equal(rawOneYearLease.terminalSaleValue, rawFiveYearLease.terminalSaleValue);
console.log('P23_RAW_WAVE_A_LEASEYEARS_COVERAGE_GAP=PROVEN');

// 2) LEGACY preserves historical economics but explicitly marks rollover as
// unmodeled compatibility behavior.
const legacy = calculateInvestmentCase({
  studyType: STUDY_TYPE.EXISTING_BUILDING,
  inputs: expiredInputs,
  leverageEnabled: false,
  assumptionModelVersion: ASSUMPTION_MODEL_VERSION.LEGACY,
});
assert.equal(legacy.leaseRollForwardStatus, LEASE_ROLL_FORWARD_STATUS.LEGACY_UNMODELED_ROLLOVER);
assert.equal(legacy.contractCoversHoldPeriod, false);
assert.equal(legacy.leaseSupportedThroughYear, 1);
assert.equal(legacy.leaseRollForwardModeled, false);
assert.equal(legacy.leaseDependentAnalyticsReady, false);
assert.equal(legacy.leaseRollForwardRequiresVisibleDisclosure, true);
assert.equal(Number.isFinite(legacy.npv), true);
assert.equal(Number.isFinite(legacy.irr), true);
console.log('P23_LEGACY_ROLLOVER_DISCLOSURE=PASS');

// 3) V2 fails closed rather than inventing renewal/downtime/market-reset/TI/free
// rent/leasing-commission assumptions after the one-year lease expires.
const v2Incomplete = calculateInvestmentCase({
  studyType: STUDY_TYPE.EXISTING_BUILDING,
  inputs: expiredInputs,
  leverageEnabled: false,
  assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2,
});
assert.equal(v2Incomplete.leaseRollForwardStatus, LEASE_ROLL_FORWARD_STATUS.MISSING_REQUIRED);
assert.equal(v2Incomplete.financialModelStatus, 'INCOMPLETE_INPUTS');
assert.equal(v2Incomplete.decisionStatus, 'INCOMPLETE_INPUTS');
assert.equal(v2Incomplete.verdict, 'INCOMPLETE_INPUTS');
assert.equal(v2Incomplete.leaseDependentAnalyticsReady, false);
assert.ok(v2Incomplete.incompleteInputs.includes('leaseRollForwardAssumptions'));
assert.equal(v2Incomplete.npv, null);
assert.equal(v2Incomplete.irr, null);
assert.equal(v2Incomplete.terminalSaleValue, null);
assert.equal(v2Incomplete.terminalNetSaleProceeds, null);
assert.equal(v2Incomplete.cumulativePaybackOnCost, null);
assert.equal(v2Incomplete.maxJustifiedPrice, null);
assert.deepEqual(v2Incomplete.cashflows, [-v2Incomplete.totalPurchaseCost, v2Incomplete.operatingNoiCashflows[0]]);
assert.equal(v2Incomplete.cashflowsIncludeTerminalValue, false);
console.log('P23_V2_POST_EXPIRY_FAIL_CLOSED=PASS');

// 4) If the contractual lease covers the entire hold period, P23 must not alter
// the supported economics.
const v2Supported = calculateInvestmentCase({
  studyType: STUDY_TYPE.EXISTING_BUILDING,
  inputs: supportedInputs,
  leverageEnabled: false,
  assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2,
});
assert.equal(v2Supported.leaseRollForwardStatus, LEASE_ROLL_FORWARD_STATUS.CONTRACT_COVERS_HOLD);
assert.equal(v2Supported.contractCoversHoldPeriod, true);
assert.equal(v2Supported.leaseDependentAnalyticsReady, true);
assert.equal(v2Supported.leaseRollForwardRequiresVisibleDisclosure, false);
assert.equal(Number.isFinite(v2Supported.npv), true);
assert.equal(Number.isFinite(v2Supported.irr), true);
console.log('P23_CONTRACT_COVERS_HOLD_UNCHANGED=PASS');

// 5) Financing is downstream of governance and must not manufacture a levered
// decision from the incomplete V2 case.
const financedIncomplete = calculateInvestmentCase({
  studyType: STUDY_TYPE.EXISTING_BUILDING,
  inputs: { ...expiredInputs, leverageEnabled: true },
  leverageEnabled: true,
  assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2,
});
assert.equal(financedIncomplete.decisionStatus, 'INCOMPLETE_INPUTS');
assert.equal(financedIncomplete.financingEngineVersion, undefined);
assert.equal(financedIncomplete.leveredIRR, null);
assert.equal(financedIncomplete.leveredNPV, null);
assert.equal(financedIncomplete.leveredCashflows, null);
console.log('P23_FINANCING_CANNOT_BYPASS_LEASE_HOLD=PASS');

// 6) The UI governance path must carry a visible bilingual lease notice and
// suppress sensitivity outputs while the post-expiry model is unsupported.
const uiState = calculateUiInvestmentState({
  mode: UI_MODE.BUILDING,
  inputs: expiredInputs,
  assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2,
});
assert.equal(uiState.leaseRollForwardRequired, true);
assert.equal(uiState.sensitivityReady, false);
const arDisclosure = buildUiDisclosureViewModel({ governance: uiState.governance, locale: 'ar-SA' });
const enDisclosure = buildUiDisclosureViewModel({ governance: uiState.governance, locale: 'en' });
assert.equal(arDisclosure.leaseRollForwardStatus, LEASE_ROLL_FORWARD_STATUS.MISSING_REQUIRED);
assert.ok(arDisclosure.leaseRollForwardNotice.includes('ينتهي عقد الإيجار قبل نهاية فترة الاحتفاظ'));
assert.ok(arDisclosure.exitTransactionCostNotice.includes('ينتهي عقد الإيجار قبل نهاية فترة الاحتفاظ'));
assert.ok(enDisclosure.leaseRollForwardNotice.includes('lease expires before the hold period ends'));
assert.equal(arDisclosure.sensitivityReady, false);
console.log('P23_UI_DISCLOSURE_AND_SENSITIVITY_HOLD=PASS');

console.log('LEASE_ROLL_FORWARD_GOVERNANCE_P23=PASS');
