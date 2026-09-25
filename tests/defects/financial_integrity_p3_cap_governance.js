'use strict';

const {
  BASIS_OF_VALUE,
  EVIDENCE_GRADE,
  INPUT_STATUS,
} = require('../../src/valuation-intelligence/contracts');
const {
  CAP_RATE_GOVERNANCE_STATUS,
  evaluateEntryExitCapRateGovernance,
} = require('../../src/valuation-intelligence/cap-rate-governance');
const {
  RECONCILED_DIRECT_CAP_STATUS,
  calculateReconciledEvidenceBackedDirectCapitalization,
} = require('../../src/valuation-intelligence/reconciled-direct-capitalization');

const results = [];
function check(id, condition, detail) {
  console.log(`${id} ${condition ? 'PASS' : 'FAIL'} -- ${detail}`);
  results.push(Boolean(condition));
}

function operatingCase() {
  return {
    stabilizedIncome: {
      potentialGrossIncomeSar: 1200000,
      vacancyLossSar: 60000,
      creditLossSar: 22800,
      annualConcessionsSar: 12000,
      annualOtherOperatingIncomeSar: 24000,
      effectiveGrossIncomeSar: 1129200,
      normalizedAnnualOpexSar: 329200,
      stabilizedNoiSar: 800000,
    },
  };
}

function marketEvidence(sourceRef, status = INPUT_STATUS.OBSERVED) {
  return {
    grade: EVIDENCE_GRADE.E_MARKET_OBSERVATION,
    status,
    sourceType: 'MARKET_COMPARABLES',
    sourceRef,
    observedAt: '2026-09-25T00:00:00.000Z',
  };
}

const entryExit = evaluateEntryExitCapRateGovernance({
  entryCapRate: 0.08,
  entryEvidence: marketEvidence('entry-cap-set-001'),
  exitCapRate: 0.085,
  exitEvidence: marketEvidence('exit-cap-set-001'),
  requireExit: true,
});
check('P3-SEPARATE-ENTRY-EXIT-EVIDENCE-PASS',
  entryExit.status === CAP_RATE_GOVERNANCE_STATUS.PASS
    && Math.abs(entryExit.spreadBps - 50) < 1e-9
    && entryExit.evidence.length === 2,
  `status=${entryExit.status}, spreadBps=${entryExit.spreadBps}`);

const missingExit = evaluateEntryExitCapRateGovernance({
  entryCapRate: 0.08,
  entryEvidence: marketEvidence('entry-cap-set-001'),
  requireExit: true,
});
check('P3-REQUIRED-EXIT-MISSING-HOLDS',
  missingExit.status === CAP_RATE_GOVERNANCE_STATUS.HOLD
    && missingExit.blockers.includes('EXIT_CAP_RATE_REQUIRED'),
  `status=${missingExit.status}`);

const sameRateImplicitCopy = evaluateEntryExitCapRateGovernance({
  entryCapRate: 0.08,
  entryEvidence: marketEvidence('same-cap-source'),
  exitCapRate: 0.08,
  exitEvidence: marketEvidence('same-cap-source'),
  requireExit: true,
});
check('P3-SAME-RATE-SAME-SOURCE-REVIEW',
  sameRateImplicitCopy.status === CAP_RATE_GOVERNANCE_STATUS.REVIEW_REQUIRED
    && sameRateImplicitCopy.warnings.includes('EXIT_CAP_EQUALS_ENTRY_CAP_SAME_SOURCE_WITHOUT_RATIONALE'),
  `status=${sameRateImplicitCopy.status}`);

const sameRateRationaled = evaluateEntryExitCapRateGovernance({
  entryCapRate: 0.08,
  entryEvidence: marketEvidence('same-cap-source'),
  exitCapRate: 0.08,
  exitEvidence: marketEvidence('same-cap-source'),
  requireExit: true,
  sameRateRationale: 'Independent review concluded no material yield movement over the modeled hold period.',
});
check('P3-SAME-RATE-RATIONALE-PASS',
  sameRateRationaled.status === CAP_RATE_GOVERNANCE_STATUS.PASS
    && sameRateRationaled.assumptions.includes('SAME_ENTRY_EXIT_CAP_RATE_EXPLICITLY_RATIONALED'),
  `status=${sameRateRationaled.status}`);

const compressionNoRationale = evaluateEntryExitCapRateGovernance({
  entryCapRate: 0.08,
  entryEvidence: marketEvidence('entry-cap-set-001'),
  exitCapRate: 0.075,
  exitEvidence: marketEvidence('exit-cap-set-002'),
  requireExit: true,
});
check('P3-CAP-COMPRESSION-REVIEW',
  compressionNoRationale.status === CAP_RATE_GOVERNANCE_STATUS.REVIEW_REQUIRED
    && compressionNoRationale.warnings.includes('EXIT_CAP_COMPRESSION_WITHOUT_RATIONALE'),
  `status=${compressionNoRationale.status}`);

const compressionRationaled = evaluateEntryExitCapRateGovernance({
  entryCapRate: 0.08,
  entryEvidence: marketEvidence('entry-cap-set-001'),
  exitCapRate: 0.075,
  exitEvidence: marketEvidence('exit-cap-set-002'),
  requireExit: true,
  capCompressionRationale: 'Separate forward-market evidence supports the lower exit yield assumption.',
});
check('P3-CAP-COMPRESSION-RATIONALE-PASS',
  compressionRationaled.status === CAP_RATE_GOVERNANCE_STATUS.PASS
    && compressionRationaled.assumptions.includes('EXIT_CAP_COMPRESSION_EXPLICITLY_RATIONALED'),
  `status=${compressionRationaled.status}`);

const missingProvenance = evaluateEntryExitCapRateGovernance({
  entryCapRate: 0.08,
  entryEvidence: {
    grade: EVIDENCE_GRADE.E_MARKET_OBSERVATION,
    status: INPUT_STATUS.OBSERVED,
    sourceType: 'MARKET_COMPARABLES',
  },
});
check('P3-CAP-PROVENANCE-REQUIRED',
  missingProvenance.status === CAP_RATE_GOVERNANCE_STATUS.HOLD
    && missingProvenance.blockers.includes('ENTRYCAPRATE_PROVENANCE_REQUIRED'),
  `status=${missingProvenance.status}`);

const assumedEvidence = evaluateEntryExitCapRateGovernance({
  entryCapRate: 0.08,
  entryEvidence: marketEvidence('entry-cap-assumption', INPUT_STATUS.ASSUMED),
});
check('P3-ASSUMED-CAP-EVIDENCE-REVIEW',
  assumedEvidence.status === CAP_RATE_GOVERNANCE_STATUS.REVIEW_REQUIRED
    && assumedEvidence.warnings.includes('CAP_RATE_EVIDENCE_REQUIRES_REVIEW'),
  `status=${assumedEvidence.status}`);

const spreadPolicy = evaluateEntryExitCapRateGovernance({
  entryCapRate: 0.08,
  entryEvidence: marketEvidence('entry-cap-set-001'),
  exitCapRate: 0.095,
  exitEvidence: marketEvidence('exit-cap-set-003'),
  requireExit: true,
  maxAbsoluteSpreadBps: 100,
});
check('P3-CAP-SPREAD-POLICY-REVIEW',
  spreadPolicy.status === CAP_RATE_GOVERNANCE_STATUS.REVIEW_REQUIRED
    && spreadPolicy.warnings.includes('ENTRY_EXIT_CAP_SPREAD_EXCEEDS_POLICY_THRESHOLD'),
  `status=${spreadPolicy.status}, spreadBps=${spreadPolicy.spreadBps}`);

const incomeEvidence = {
  grade: EVIDENCE_GRADE.D_OPERATING_ACTUAL,
  status: INPUT_STATUS.VERIFIED,
  sourceType: 'OPERATING_LEDGER',
  sourceRef: 'rent-roll-ledger-001',
  observedAt: '2026-09-25T00:00:00.000Z',
};
const expenseEvidence = {
  grade: EVIDENCE_GRADE.D_OPERATING_ACTUAL,
  status: INPUT_STATUS.VERIFIED,
  sourceType: 'OPERATING_LEDGER',
  sourceRef: 'opex-ledger-001',
  observedAt: '2026-09-25T00:00:00.000Z',
};
const capRateEvidence = marketEvidence('entry-cap-set-001');

const reconciledDirectCap = calculateReconciledEvidenceBackedDirectCapitalization({
  incomeAnalysis: operatingCase(),
  marketCapRate: 0.08,
  incomeEvidence,
  expenseEvidence,
  capRateEvidence,
  basis: BASIS_OF_VALUE.MARKET_VALUE,
  valuationDate: '2026-09-25',
  opexAllocation: {
    recoverableOperatingExpensesSar: 0,
    nonRecoverableOperatingExpensesSar: 300000,
    otherOperatingExpensesSar: 29200,
  },
});
check('P3-EVIDENCE-BACKED-DIRECT-CAP-QUALIFIED',
  reconciledDirectCap.status === RECONCILED_DIRECT_CAP_STATUS.QUALIFIED
    && reconciledDirectCap.valuationIndication.value === 10000000
    && reconciledDirectCap.valuationIndication.components.netOperatingIncome === 800000
    && reconciledDirectCap.crossCheck.passed === true
    && Math.abs(reconciledDirectCap.crossCheck.varianceSar) <= 0.01,
  `status=${reconciledDirectCap.status}, value=${reconciledDirectCap.valuationIndication && reconciledDirectCap.valuationIndication.value}`);

const brokenOperatingCase = operatingCase();
brokenOperatingCase.stabilizedIncome.stabilizedNoiSar = 790000;
const blockedByNoi = calculateReconciledEvidenceBackedDirectCapitalization({
  incomeAnalysis: brokenOperatingCase,
  marketCapRate: 0.08,
  incomeEvidence,
  expenseEvidence,
  capRateEvidence,
  basis: BASIS_OF_VALUE.MARKET_VALUE,
});
check('P3-DIRECT-CAP-BLOCKED-BY-NOI-RECONCILIATION',
  blockedByNoi.status === RECONCILED_DIRECT_CAP_STATUS.HOLD_INPUTS
    && blockedByNoi.valuationIndication === null
    && blockedByNoi.blockers.includes('NOI_RECONCILIATION_REQUIRED'),
  `status=${blockedByNoi.status}`);

const blockedByCapProvenance = calculateReconciledEvidenceBackedDirectCapitalization({
  incomeAnalysis: operatingCase(),
  marketCapRate: 0.08,
  incomeEvidence,
  expenseEvidence,
  capRateEvidence: {
    grade: EVIDENCE_GRADE.E_MARKET_OBSERVATION,
    status: INPUT_STATUS.OBSERVED,
    sourceType: 'MARKET_COMPARABLES',
  },
  basis: BASIS_OF_VALUE.MARKET_VALUE,
  opexAllocation: {
    recoverableOperatingExpensesSar: 0,
    nonRecoverableOperatingExpensesSar: 300000,
    otherOperatingExpensesSar: 29200,
  },
});
check('P3-DIRECT-CAP-BLOCKED-BY-CAP-PROVENANCE',
  blockedByCapProvenance.status === RECONCILED_DIRECT_CAP_STATUS.HOLD_INPUTS
    && blockedByCapProvenance.valuationIndication === null
    && blockedByCapProvenance.blockers.includes('CAP_RATE_GOVERNANCE_REQUIRED'),
  `status=${blockedByCapProvenance.status}`);

const incomeConflict = calculateReconciledEvidenceBackedDirectCapitalization({
  incomeAnalysis: operatingCase(),
  marketCapRate: 0.08,
  incomeEvidence: { ...incomeEvidence, status: INPUT_STATUS.CONFLICT },
  expenseEvidence,
  capRateEvidence,
  basis: BASIS_OF_VALUE.MARKET_VALUE,
  opexAllocation: {
    recoverableOperatingExpensesSar: 0,
    nonRecoverableOperatingExpensesSar: 300000,
    otherOperatingExpensesSar: 29200,
  },
});
check('P3-DIRECT-CAP-EVIDENCE-CONFLICT-HOLDS',
  incomeConflict.status === RECONCILED_DIRECT_CAP_STATUS.HOLD_EVIDENCE_CONFLICT
    && incomeConflict.blockers.includes('VALUATION_EVIDENCE_CONFLICT'),
  `status=${incomeConflict.status}`);

const allPass = results.every(Boolean);
console.log(`\nFINANCIAL_INTEGRITY_P3_CAP_GOVERNANCE=${allPass ? 'PASS' : 'FAIL'}`);
process.exit(allPass ? 0 : 1);
