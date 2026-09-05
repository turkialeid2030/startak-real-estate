'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const { ASSUMPTION_MODEL_VERSION } = require('../../src/assumptions/assumption-model');
const { EXIT_CAP_SOURCE } = require('../../src/engines/valuation/exit-cap-resolver');

const fixture = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'characterization', 'fixtures', 'RE-GOLD-002-U.json'),
  'utf8',
));
const baseInputs = fixture.input_set;

function assertFinitePositive(value, name) {
  assert.strictEqual(Number.isFinite(value), true, `${name} must be finite`);
  assert.ok(value > 0, `${name} must be positive`);
}

function run() {
  // Legacy compatibility: this fixture intentionally has marketCapRate but no
  // exitCapRate. The old path remains valid and explicitly discloses that the
  // market cap is being used as a compatibility-derived exit cap.
  const legacy = calculateInvestmentCase({
    studyType: STUDY_TYPE.EXISTING_BUILDING,
    inputs: { ...baseInputs },
    leverageEnabled: false,
    assumptionModelVersion: ASSUMPTION_MODEL_VERSION.LEGACY,
  });
  assert.strictEqual(legacy.assumptionModelVersion, ASSUMPTION_MODEL_VERSION.LEGACY);
  assert.strictEqual(legacy.exitCapSource, EXIT_CAP_SOURCE.LEGACY_DERIVED);
  assert.strictEqual(legacy.exitCapRequiresVisibleDisclosure, true);
  assert.strictEqual(legacy.exitDependentAnalyticsReady, true);
  assert.strictEqual(legacy.cashflowsIncludeTerminalValue, true);
  assert.strictEqual(legacy.financialModelStatus, 'VALID');
  assert.deepStrictEqual(legacy.incompleteInputs, []);
  assertFinitePositive(legacy.terminalSaleValue, 'legacy.terminalSaleValue');
  assertFinitePositive(legacy.terminalNetSaleProceeds, 'legacy.terminalNetSaleProceeds');
  assert.strictEqual(Number.isFinite(legacy.irr), true);
  assert.strictEqual(Number.isFinite(legacy.npv), true);

  // V2 fail-closed: the same economic inputs are not allowed to inherit an exit
  // cap from marketCapRate. Operating analytics remain available, while every
  // exit-dependent return metric is deliberately unavailable.
  const v2Incomplete = calculateInvestmentCase({
    studyType: STUDY_TYPE.EXISTING_BUILDING,
    inputs: { ...baseInputs },
    leverageEnabled: false,
    assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2,
  });
  assert.strictEqual(v2Incomplete.assumptionModelVersion, ASSUMPTION_MODEL_VERSION.V2);
  assert.strictEqual(v2Incomplete.exitCapSource, EXIT_CAP_SOURCE.MISSING_REQUIRED);
  assert.strictEqual(v2Incomplete.exitDependentAnalyticsReady, false);
  assert.strictEqual(v2Incomplete.cashflowsIncludeTerminalValue, false);
  assert.strictEqual(v2Incomplete.financialModelStatus, 'INCOMPLETE_INPUTS');
  assert.deepStrictEqual(v2Incomplete.incompleteInputs, ['exitCapRate']);
  assert.strictEqual(v2Incomplete.terminalSaleValue, null);
  assert.strictEqual(v2Incomplete.terminalNetSaleProceeds, null);
  assert.strictEqual(v2Incomplete.irr, null);
  assert.strictEqual(v2Incomplete.npv, null);
  assert.strictEqual(v2Incomplete.leveredIRR, null);
  assert.strictEqual(v2Incomplete.leveredNPV, null);
  assert.strictEqual(v2Incomplete.irrDiagnostics, null);
  assert.strictEqual(v2Incomplete.leveredIrrDiagnostics, null);
  assert.strictEqual(v2Incomplete.verdict, 'INCOMPLETE_INPUTS');
  assert.strictEqual(v2Incomplete.decisionStatus, 'INCOMPLETE_INPUTS');
  assertFinitePositive(v2Incomplete.NOI, 'v2Incomplete.NOI');
  assertFinitePositive(v2Incomplete.marketValueByIncomeCap, 'v2Incomplete.marketValueByIncomeCap');
  assertFinitePositive(v2Incomplete.maxJustifiedPrice, 'v2Incomplete.maxJustifiedPrice');
  assert.strictEqual(Number.isFinite(v2Incomplete.cumulativePaybackOnCost), true);
  assert.strictEqual(v2Incomplete.cashflows.length, baseInputs.holdPeriod + 1);
  assert.strictEqual(v2Incomplete.cashflows[v2Incomplete.cashflows.length - 1], v2Incomplete.operatingNoiCashflows[v2Incomplete.operatingNoiCashflows.length - 1]);

  // Financing remediation is not allowed to manufacture levered returns for an
  // otherwise incomplete deterministic case.
  const v2IncompleteLevered = calculateInvestmentCase({
    studyType: STUDY_TYPE.EXISTING_BUILDING,
    inputs: { ...baseInputs, leverageEnabled: true },
    leverageEnabled: true,
    assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2,
  });
  assert.strictEqual(v2IncompleteLevered.financialModelStatus, 'INCOMPLETE_INPUTS');
  assert.strictEqual(v2IncompleteLevered.exitCapSource, EXIT_CAP_SOURCE.MISSING_REQUIRED);
  assert.strictEqual(v2IncompleteLevered.terminalSaleValue, null);
  assert.strictEqual(v2IncompleteLevered.terminalNetSaleProceeds, null);
  assert.strictEqual(v2IncompleteLevered.leveredCashflows, null);
  assert.strictEqual(v2IncompleteLevered.leveredIRR, null);
  assert.strictEqual(v2IncompleteLevered.leveredNPV, null);
  assert.strictEqual(v2IncompleteLevered.transactionAuthorized, false);

  // Once the V2 exit cap is explicit, the same engine path becomes complete and
  // exit-dependent analytics resume without changing marketCapRate semantics.
  const explicitExitCapRate = 0.075;
  const v2Explicit = calculateInvestmentCase({
    studyType: STUDY_TYPE.EXISTING_BUILDING,
    inputs: { ...baseInputs, exitCapRate: explicitExitCapRate },
    leverageEnabled: false,
    assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2,
  });
  assert.strictEqual(v2Explicit.assumptionModelVersion, ASSUMPTION_MODEL_VERSION.V2);
  assert.strictEqual(v2Explicit.exitCapSource, EXIT_CAP_SOURCE.EXPLICIT);
  assert.strictEqual(v2Explicit.exitCapRate, explicitExitCapRate);
  assert.strictEqual(v2Explicit.exitDependentAnalyticsReady, true);
  assert.strictEqual(v2Explicit.cashflowsIncludeTerminalValue, true);
  assert.notStrictEqual(v2Explicit.financialModelStatus, 'INCOMPLETE_INPUTS');
  assert.deepStrictEqual(v2Explicit.incompleteInputs, []);
  assertFinitePositive(v2Explicit.terminalSaleValue, 'v2Explicit.terminalSaleValue');
  assertFinitePositive(v2Explicit.terminalNetSaleProceeds, 'v2Explicit.terminalNetSaleProceeds');
  assert.strictEqual(Number.isFinite(v2Explicit.irr), true);
  assert.strictEqual(Number.isFinite(v2Explicit.npv), true);
  assert.strictEqual(v2Explicit.transactionAuthorized, false);

  console.log('WAVE2_ENGINE_LEGACY_EXIT_CAP_COMPATIBILITY=PASS');
  console.log('WAVE2_ENGINE_V2_MISSING_EXIT_CAP_FAIL_CLOSED=PASS');
  console.log('WAVE2_ENGINE_FINANCING_INCOMPLETE_GUARD=PASS');
  console.log('WAVE2_ENGINE_EXPLICIT_EXIT_CAP_RECOVERY=PASS');
}

run();
