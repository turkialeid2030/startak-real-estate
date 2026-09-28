'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const { ASSUMPTION_MODEL_VERSION } = require('../../src/assumptions/assumption-model');
const { EXIT_CAP_SOURCE } = require('../../src/engines/valuation/exit-cap-resolver');
const { EXIT_TRANSACTION_COST_SOURCE } = require('../../src/engines/valuation/exit-transaction-cost-resolver');

const fixture = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'characterization', 'fixtures', 'RE-GOLD-002-U.json'),
  'utf8',
));
// This architecture test isolates exit-assumption governance. P23 requires the
// lease to cover the forward Year-(N+1) NOI used by terminal value, so give this
// fixture explicit contractual coverage through that year rather than letting
// lease-roll-forward governance become an unrelated second hold condition.
const baseInputs = {
  ...fixture.input_set,
  leaseYears: fixture.input_set.holdPeriod + 1,
};

function assertFinitePositive(value, name) {
  assert.strictEqual(Number.isFinite(value), true, `${name} must be finite`);
  assert.ok(value > 0, `${name} must be positive`);
}

function run() {
  // Legacy compatibility preserves both historical exit assumptions: market
  // cap may supply exit cap and acquisition transferFeeRate may supply exit
  // transaction cost when no dedicated values were persisted.
  const legacy = calculateInvestmentCase({
    studyType: STUDY_TYPE.EXISTING_BUILDING,
    inputs: { ...baseInputs },
    leverageEnabled: false,
    assumptionModelVersion: ASSUMPTION_MODEL_VERSION.LEGACY,
  });
  assert.strictEqual(legacy.assumptionModelVersion, ASSUMPTION_MODEL_VERSION.LEGACY);
  assert.strictEqual(legacy.exitCapSource, EXIT_CAP_SOURCE.LEGACY_DERIVED);
  assert.strictEqual(legacy.exitTransactionCostSource,
    EXIT_TRANSACTION_COST_SOURCE.LEGACY_ACQUISITION_RATE_FALLBACK);
  assert.strictEqual(legacy.exitCapRequiresVisibleDisclosure, true);
  assert.strictEqual(legacy.exitTransactionCostRequiresVisibleDisclosure, true);
  assert.strictEqual(legacy.exitDependentAnalyticsReady, true);
  assert.strictEqual(legacy.cashflowsIncludeTerminalValue, true);
  assert.strictEqual(legacy.financialModelStatus, 'VALID');
  assert.deepStrictEqual(legacy.incompleteInputs, []);
  assertFinitePositive(legacy.terminalSaleValue, 'legacy.terminalSaleValue');
  assertFinitePositive(legacy.terminalNetSaleProceeds, 'legacy.terminalNetSaleProceeds');
  assert.strictEqual(Number.isFinite(legacy.irr), true);
  assert.strictEqual(Number.isFinite(legacy.npv), true);

  // V2 fail-closed: neither marketCapRate nor acquisition transferFeeRate is
  // permitted to silently manufacture exit assumptions.
  const v2Incomplete = calculateInvestmentCase({
    studyType: STUDY_TYPE.EXISTING_BUILDING,
    inputs: { ...baseInputs },
    leverageEnabled: false,
    assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2,
  });
  assert.strictEqual(v2Incomplete.assumptionModelVersion, ASSUMPTION_MODEL_VERSION.V2);
  assert.strictEqual(v2Incomplete.exitCapSource, EXIT_CAP_SOURCE.MISSING_REQUIRED);
  assert.strictEqual(v2Incomplete.exitTransactionCostSource, EXIT_TRANSACTION_COST_SOURCE.MISSING_REQUIRED);
  assert.strictEqual(v2Incomplete.exitDependentAnalyticsReady, false);
  assert.strictEqual(v2Incomplete.cashflowsIncludeTerminalValue, false);
  assert.strictEqual(v2Incomplete.financialModelStatus, 'INCOMPLETE_INPUTS');
  assert.deepStrictEqual(v2Incomplete.incompleteInputs, ['exitCapRate', 'exitTransferFeeRate']);
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

  const v2IncompleteLevered = calculateInvestmentCase({
    studyType: STUDY_TYPE.EXISTING_BUILDING,
    inputs: { ...baseInputs, leverageEnabled: true },
    leverageEnabled: true,
    assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2,
  });
  assert.strictEqual(v2IncompleteLevered.financialModelStatus, 'INCOMPLETE_INPUTS');
  assert.strictEqual(v2IncompleteLevered.exitCapSource, EXIT_CAP_SOURCE.MISSING_REQUIRED);
  assert.strictEqual(v2IncompleteLevered.exitTransactionCostSource, EXIT_TRANSACTION_COST_SOURCE.MISSING_REQUIRED);
  assert.strictEqual(v2IncompleteLevered.terminalSaleValue, null);
  assert.strictEqual(v2IncompleteLevered.terminalNetSaleProceeds, null);
  assert.strictEqual(v2IncompleteLevered.leveredCashflows, null);
  assert.strictEqual(v2IncompleteLevered.leveredIRR, null);
  assert.strictEqual(v2IncompleteLevered.leveredNPV, null);

  // Both V2 exit assumptions must be explicit before exit-dependent analytics
  // resume. Explicit 0% exit cost is valid evidence.
  const explicitExitCapRate = 0.075;
  const explicitExitTransferFeeRate = 0.02;
  const v2Explicit = calculateInvestmentCase({
    studyType: STUDY_TYPE.EXISTING_BUILDING,
    inputs: {
      ...baseInputs,
      exitCapRate: explicitExitCapRate,
      exitTransferFeeRate: explicitExitTransferFeeRate,
    },
    leverageEnabled: false,
    assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2,
  });
  assert.strictEqual(v2Explicit.assumptionModelVersion, ASSUMPTION_MODEL_VERSION.V2);
  assert.strictEqual(v2Explicit.exitCapSource, EXIT_CAP_SOURCE.EXPLICIT);
  assert.strictEqual(v2Explicit.exitCapRate, explicitExitCapRate);
  assert.strictEqual(v2Explicit.exitTransactionCostSource, EXIT_TRANSACTION_COST_SOURCE.EXPLICIT);
  assert.strictEqual(v2Explicit.exitTransactionCostRate, explicitExitTransferFeeRate);
  assert.strictEqual(v2Explicit.exitDependentAnalyticsReady, true);
  assert.strictEqual(v2Explicit.cashflowsIncludeTerminalValue, true);
  assert.notStrictEqual(v2Explicit.financialModelStatus, 'INCOMPLETE_INPUTS');
  assert.deepStrictEqual(v2Explicit.incompleteInputs, []);
  assertFinitePositive(v2Explicit.terminalSaleValue, 'v2Explicit.terminalSaleValue');
  assertFinitePositive(v2Explicit.terminalNetSaleProceeds, 'v2Explicit.terminalNetSaleProceeds');
  assert.strictEqual(Number.isFinite(v2Explicit.irr), true);
  assert.strictEqual(Number.isFinite(v2Explicit.npv), true);

  console.log('WAVE2_ENGINE_LEGACY_EXIT_COMPATIBILITY=PASS');
  console.log('WAVE2_ENGINE_V2_MISSING_EXIT_ASSUMPTIONS_FAIL_CLOSED=PASS');
  console.log('WAVE2_ENGINE_FINANCING_INCOMPLETE_GUARD=PASS');
  console.log('WAVE2_ENGINE_EXPLICIT_EXIT_ASSUMPTIONS_RECOVERY=PASS');
}

run();
