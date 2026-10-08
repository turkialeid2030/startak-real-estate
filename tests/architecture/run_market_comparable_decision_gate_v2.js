'use strict';

const assert = require('node:assert/strict');
const {
  BASIS_OF_VALUE,
  EVIDENCE_GRADE,
  INDICATION_STATUS,
  TRANSACTION_STATUS,
  WEIGHTING_POLICY,
  createComparable,
  calculateMarketComparableIndication,
  MARKET_COMPARABLE_DECISION_STATUS,
  assessMarketComparableDecisionReadiness,
} = require('../../src/valuation-intelligence');

const date = '2026-09-01';
function comparable(id, status = TRANSACTION_STATUS.EXECUTED_SALE, options = {}) {
  return createComparable({
    comparableId: id,
    unitValue: options.unitValue || 10000,
    transactionStatus: status,
    evidenceGrade: options.grade || EVIDENCE_GRADE.B_VERIFIED_TRANSACTION,
    transactionDate: options.date === undefined ? '2026-08-15' : options.date,
    sourceRef: options.ref === undefined ? `TRANSACTION-${id}` : options.ref,
  });
}
function indication(comparables, basis = BASIS_OF_VALUE.MARKET_VALUE, valuationDate = date) {
  return calculateMarketComparableIndication({
    comparables, basis, valuationDate, subjectArea: 100,
    weightingPolicy: WEIGHTING_POLICY.EQUAL,
  });
}
function held(result, blockerPrefix) {
  assert.equal(result.status, INDICATION_STATUS.HOLD_EVIDENCE_CONFLICT);
  assert.equal(result.components.decisionReadiness.status, MARKET_COMPARABLE_DECISION_STATUS.HOLD);
  assert.ok(result.components.decisionReadiness.blockers.some(code => code.startsWith(blockerPrefix)),
    `missing blocker ${blockerPrefix}: ${result.components.decisionReadiness.blockers.join(', ')}`);
  assert.ok(result.warnings.includes('MARKET_COMPARABLE_PRELIMINARY_ONLY_NOT_DECISION_READY'));
}

const valid = indication([comparable('A'), comparable('B')]);
assert.equal(valid.status, INDICATION_STATUS.QUALIFIED);
assert.equal(valid.components.decisionReadiness.status, MARKET_COMPARABLE_DECISION_STATUS.READY);
assert.equal(valid.value, 1000000);

const leases = indication([
  comparable('L1', TRANSACTION_STATUS.EXECUTED_LEASE, { grade: EVIDENCE_GRADE.C_CONTRACTUAL }),
  comparable('L2', TRANSACTION_STATUS.EXECUTED_LEASE, { grade: EVIDENCE_GRADE.C_CONTRACTUAL }),
], BASIS_OF_VALUE.MARKET_RENT);
assert.equal(leases.status, INDICATION_STATUS.QUALIFIED);

held(indication([
  comparable('O1', TRANSACTION_STATUS.ASKING_SALE),
  comparable('O2', TRANSACTION_STATUS.ASKING_SALE),
]), 'MARKET_COMPARABLE_TRANSACTION_BASIS_MISMATCH');
held(indication([comparable('S1'), comparable('R1', TRANSACTION_STATUS.EXECUTED_LEASE)]),
  'MARKET_COMPARABLE_TRANSACTION_BASIS_MISMATCH');
held(indication([comparable('S2'), comparable('S3')], BASIS_OF_VALUE.MARKET_RENT),
  'MARKET_COMPARABLE_TRANSACTION_BASIS_MISMATCH');
held(indication([comparable('X1', undefined, { ref: null }), comparable('X2')]),
  'MARKET_COMPARABLE_SOURCE_REQUIRED');
held(indication([comparable('X3', undefined, { date: null }), comparable('X4')]),
  'MARKET_COMPARABLE_TRANSACTION_DATE_REQUIRED');
held(indication([comparable('F1', undefined, { date: '2026-09-02' }), comparable('F2')]),
  'MARKET_COMPARABLE_DATE_AFTER_VALUATION');
held(indication([comparable('I1', undefined, { date: '2026-02-30' }), comparable('I2')]),
  'MARKET_COMPARABLE_TRANSACTION_DATE_REQUIRED');
held(indication([comparable('G1', undefined, { grade: EVIDENCE_GRADE.E_MARKET_OBSERVATION }), comparable('G2')]),
  'MARKET_COMPARABLE_EXECUTED_EVIDENCE_GRADE_INSUFFICIENT');
held(indication([comparable('D'), comparable('D')]),
  'MARKET_COMPARABLE_DUPLICATE_ID');
held(indication([comparable('N1'), comparable('N2')], BASIS_OF_VALUE.MARKET_VALUE, null),
  'MARKET_COMPARABLE_VALUATION_DATE_REQUIRED');

const preliminary = indication([comparable('P1'), comparable('P2', TRANSACTION_STATUS.ASKING_SALE)]);
assert.equal(preliminary.value, 1000000, 'preliminary arithmetic remains available');
assert.equal(preliminary.components.decisionReadiness.qualifyingExecutedCount, 1);
assert.equal(preliminary.components.decisionReadiness.independentMarketBacktestEstablished, false);

const direct = assessMarketComparableDecisionReadiness({
  comparables: [comparable('Q1'), comparable('Q2')],
  basis: BASIS_OF_VALUE.MARKET_VALUE,
  valuationDate: date,
});
assert.equal(direct.status, MARKET_COMPARABLE_DECISION_STATUS.READY);

const {
  ASSET_CLASS,
  LIFECYCLE_STAGE,
  INVESTMENT_STRATEGY,
  INCOME_MODEL,
  createProjectProfile,
} = require('../../src/project-model/project-profile');
const {
  VALUATION_METHOD,
  createValuationRequest,
  orchestrateValuationStage,
  METHOD_STATE,
} = require('../../src/valuation-intelligence');

const projectProfile = createProjectProfile({
  projectId: 'C54-MARKET-ONLY-TEST',
  projectName: 'C54 evidence gate synthetic office',
  assetClasses: [ASSET_CLASS.OFFICE],
  lifecycleStage: LIFECYCLE_STAGE.STABILIZED,
  investmentStrategy: INVESTMENT_STRATEGY.CORE_INCOME,
  incomeModel: INCOME_MODEL.LEASE_INCOME,
  jurisdiction: { country: 'SA', city: 'Riyadh' },
});
const blockedRequest = createValuationRequest({
  caseId: 'C54-HOLD-CASE',
  projectId: projectProfile.projectId,
  projectProfile,
  methodInputs: {
    [VALUATION_METHOD.MARKET_COMPARABLE]: {
      comparables: [comparable('S-DIAG'), comparable('O-DIAG', TRANSACTION_STATUS.ASKING_SALE)],
      subjectArea: 100,
      basis: BASIS_OF_VALUE.MARKET_VALUE,
      valuationDate: date,
      currency: 'SAR',
      weightingPolicy: WEIGHTING_POLICY.EQUAL,
    },
  },
  evidencePolicy: { minEvidenceCount: 1, maxAssumptionBurdenRatio: 1, maxLowGradeRatio: 1 },
  singleMethodPolicy: {
    allowedMethod: VALUATION_METHOD.MARKET_COMPARABLE,
    justification: 'Synthetic attempted override; invalid comparables still must fail closed.',
  },
});
const blockedStage = orchestrateValuationStage(blockedRequest);
const blockedMarket = blockedStage.methods.find(item => item.method === VALUATION_METHOD.MARKET_COMPARABLE);
assert.equal(blockedMarket.state, METHOD_STATE.HOLD);
assert.equal(blockedMarket.indication.status, INDICATION_STATUS.HOLD_EVIDENCE_CONFLICT);
assert.equal(blockedStage.readyForDecisionControl, false);
assert.equal(blockedStage.finalValue, null);

console.log('C54_MARKET_COMPARABLE_DECISION_GATE=PASS');
