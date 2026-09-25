'use strict';

const {
  reconcileIncomeAnalysisToCanonicalNoi,
  directCapFromReconciledNoi,
} = require('../../src/residential-income-acquisition/financial-integrity-reconciliation');

const results = [];
function check(id, condition, detail) {
  console.log(`${id} ${condition ? 'PASS' : 'FAIL'} -- ${detail}`);
  results.push(Boolean(condition));
}

function baseIncomeAnalysis() {
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

const source = baseIncomeAnalysis();
const sourceJson = JSON.stringify(source);
const reconciled = reconcileIncomeAnalysisToCanonicalNoi(source);
check('P2-NOI-RECONCILIATION-PASSES',
  reconciled.status === 'PASS_WITH_WARNINGS'
    && Math.abs(reconciled.reconciliation.egiVarianceSar) <= 0.01
    && Math.abs(reconciled.reconciliation.noiVarianceSar) <= 0.01,
  `status=${reconciled.status}`);
check('P2-NOI-VALUES-EXACT',
  reconciled.canonicalNoi.gpiSar === 1200000
    && reconciled.canonicalNoi.egiSar === 1129200
    && reconciled.canonicalNoi.operatingExpensesSar === 329200
    && reconciled.canonicalNoi.noiSar === 800000,
  `NOI=${reconciled.canonicalNoi.noiSar}`);
check('P2-NO-SOURCE-MUTATION', JSON.stringify(source) === sourceJson, 'source income analysis unchanged');
check('P2-UNALLOCATED-OPEX-WARNING',
  reconciled.warnings.includes('OPEX_CLASSIFICATION_UNALLOCATED'),
  'aggregate OPEX is not silently misclassified');

const classified = reconcileIncomeAnalysisToCanonicalNoi(source, {
  opexAllocation: {
    recoverableOperatingExpensesSar: 100000,
    nonRecoverableOperatingExpensesSar: 200000,
    otherOperatingExpensesSar: 29200,
  },
});
check('P2-CLASSIFIED-OPEX-RECONCILES',
  classified.status === 'PASS'
    && classified.canonicalNoi.recoverableOperatingExpensesSar === 100000
    && classified.canonicalNoi.nonRecoverableOperatingExpensesSar === 200000
    && classified.canonicalNoi.otherOperatingExpensesSar === 29200,
  `status=${classified.status}`);

const badAllocation = reconcileIncomeAnalysisToCanonicalNoi(source, {
  opexAllocation: {
    recoverableOperatingExpensesSar: 100000,
    nonRecoverableOperatingExpensesSar: 100000,
    otherOperatingExpensesSar: 100000,
  },
});
check('P2-OPEX-ALLOCATION-MISMATCH-HOLDS',
  badAllocation.status === 'HOLD'
    && badAllocation.blockers.some((code) => code.startsWith('OPEX_ALLOCATION_DOES_NOT_RECONCILE:')),
  `status=${badAllocation.status}`);

const badNoi = baseIncomeAnalysis();
badNoi.stabilizedIncome.stabilizedNoiSar = 799000;
const badNoiResult = reconcileIncomeAnalysisToCanonicalNoi(badNoi);
check('P2-SOURCE-NOI-MISMATCH-HOLDS',
  badNoiResult.status === 'HOLD'
    && badNoiResult.blockers.some((code) => code.startsWith('NOI_RECONCILIATION_FAILED:')),
  `status=${badNoiResult.status}`);

const badEgi = baseIncomeAnalysis();
badEgi.stabilizedIncome.effectiveGrossIncomeSar = 1120000;
const badEgiResult = reconcileIncomeAnalysisToCanonicalNoi(badEgi);
check('P2-SOURCE-EGI-MISMATCH-HOLDS',
  badEgiResult.status === 'HOLD'
    && badEgiResult.blockers.some((code) => code.startsWith('EGI_RECONCILIATION_FAILED:')),
  `status=${badEgiResult.status}`);

const directCap = directCapFromReconciledNoi(source, 0.08);
check('P2-DIRECT-CAP-FROM-RECONCILED-NOI',
  directCap.status === 'QUALIFIED_CALCULATION'
    && directCap.stabilizedNoiSar === 800000
    && Math.abs(directCap.valueSar - 10000000) <= 0.01,
  `value=${directCap.valueSar}`);

const invalidCap = directCapFromReconciledNoi(source, 0);
check('P2-INVALID-CAP-FAILS-CLOSED',
  invalidCap.status === 'NOT_EVALUATED'
    && invalidCap.valueSar === null
    && invalidCap.blockers.some((code) => code.startsWith('DIRECT_CAP_INPUT_INVALID:')),
  `status=${invalidCap.status}`);

const unreconciledCap = directCapFromReconciledNoi(badNoi, 0.08);
check('P2-DIRECT-CAP-REQUIRES-NOI-RECONCILIATION',
  unreconciledCap.status === 'NOT_EVALUATED'
    && unreconciledCap.blockers.includes('NOI_RECONCILIATION_REQUIRED'),
  `status=${unreconciledCap.status}`);

const serviceChargeSource = baseIncomeAnalysis();
serviceChargeSource.stabilizedIncome.effectiveGrossIncomeSar += 50000;
serviceChargeSource.stabilizedIncome.stabilizedNoiSar += 50000;
const serviceChargeReconciled = reconcileIncomeAnalysisToCanonicalNoi(serviceChargeSource, {
  serviceChargeRecoveriesSar: 50000,
  opexAllocation: {
    recoverableOperatingExpensesSar: 50000,
    nonRecoverableOperatingExpensesSar: 250000,
    otherOperatingExpensesSar: 29200,
  },
});
check('P2-SERVICE-CHARGE-NET-ZERO-ECONOMICS',
  serviceChargeReconciled.status === 'HOLD',
  'source economics that add recovery without matched source OPEX fail reconciliation rather than inflate NOI');

const allPass = results.every(Boolean);
console.log(`\nFINANCIAL_INTEGRITY_P2_NOI_RECONCILIATION=${allPass ? 'PASS' : 'FAIL'}`);
process.exit(allPass ? 0 : 1);
