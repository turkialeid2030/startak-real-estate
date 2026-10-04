'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  STATUS,
  EXTERNAL_STATUS,
  createHistoricalReplayPlan,
  verifyHistoricalReplayPlan,
  createExternalHistoricalReplayRecord,
  verifyExternalHistoricalReplayRecord,
  evaluateInternalHistoricalReplayReadiness,
  evaluateExternalHistoricalReplayForGateIngestion,
} = require('../../src/replay/historical-replay-readiness');

const ROOT = path.join(__dirname, '..', '..');
const SHA = '1234567890abcdef1234567890abcdef12345678';
const AS_OF = '2026-10-04T12:00:00Z';
let checks = 0;

function check(fn) {
  fn();
  checks += 1;
}

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

const measures = [
  {
    measureId: 'DECISION_OUTCOME_COMPARISON',
    definitionRef: 'PREDECLARED-MEASURE-DECISION-OUTCOME',
  },
  {
    measureId: 'VALUE_DEVIATION_OBSERVATION',
    definitionRef: 'PREDECLARED-MEASURE-VALUE-DEVIATION',
  },
];

function plan(overrides = {}) {
  return createHistoricalReplayPlan({
    candidateHeadSha: SHA,
    productScopeRef: 'STARTAK-REAL-ESTATE-C51-SCOPE',
    replayMethodRef: 'HISTORICAL-REPLAY-METHOD-V1',
    predeclaredMeasures: measures,
    preparedAt: '2026-10-04T08:00:00Z',
    validUntil: '2026-10-11T08:00:00Z',
    ...overrides,
  });
}

function record(status, overrides = {}) {
  const input = {
    evidenceId: 'HISTORICAL_REPLAY_EVIDENCE',
    candidateHeadSha: SHA,
    status,
  };

  if (status === EXTERNAL_STATUS.NOT_SUPPLIED) {
    input.reasonCode = 'REAL_HISTORICAL_CASES_NOT_SUPPLIED';
  } else {
    Object.assign(input, {
      evidenceRef: 'STRUCTURAL-TEST-HISTORICAL-PACK',
      evidenceHashSha256: 'b'.repeat(64),
      verifiedByRef: 'STRUCTURAL-TEST-INDEPENDENT-PROFESSIONAL',
      verifiedAt: '2026-10-04T10:00:00Z',
      validUntil: '2026-10-10T10:00:00Z',
      replayMethodRef: 'HISTORICAL-REPLAY-METHOD-V1',
      predeclaredMeasuresRef: 'PREDECLARED-MEASURES-REGISTER-V1',
      cases: [
        {
          caseId: 'REAL-CASE-STRUCTURAL-1',
          provenanceRef: 'REAL-CASE-PROVENANCE-REF',
          historicalObservationDate: '2025-01-10T00:00:00Z',
          historicalTruthOutcomeRef: 'HISTORICAL-TRUTH-REF',
          systemReplayResultRef: 'SYSTEM-REPLAY-RESULT-REF',
          deviationReviewRef: 'INDEPENDENT-DEVIATION-REVIEW-REF',
          synthetic: false,
        },
      ],
      materialDeviationDispositionRef: 'MATERIAL-DEVIATION-DISPOSITION-REF',
    });
  }

  if (status === EXTERNAL_STATUS.REJECTED) {
    input.reasonCode = 'MATERIAL_REPLAY_PERFORMANCE_REJECTED';
  }

  return createExternalHistoricalReplayRecord({ ...input, ...overrides });
}

const replayPlan = plan();
check(() => assert.strictEqual(verifyHistoricalReplayPlan(replayPlan), true));
check(() => assert.strictEqual(replayPlan.syntheticCasesAcceptedAsHistoricalEvidence, false));
check(() => assert.strictEqual(replayPlan.historicalReplayApproved, false));

const internal = evaluateInternalHistoricalReplayReadiness({ replayPlan, asOf: AS_OF });
check(() => assert.strictEqual(internal.status, STATUS.READY_FOR_INDEPENDENT_HISTORICAL_REPLAY));
check(() => assert.strictEqual(internal.internalEngineeringReady, true));
check(() => assert.strictEqual(internal.historicalReplayApproved, false));

check(() => assert.throws(() => plan({ candidateHeadSha: 'bad' }), /40-character/));
check(() => assert.throws(() => plan({ predeclaredMeasures: [] }), /PREDECLARED_MEASURES/));
check(() => assert.throws(
  () => plan({ predeclaredMeasures: [measures[0], measures[0]] }),
  /DUPLICATE/,
));

const stalePlan = plan({ validUntil: '2026-10-04T09:00:00Z' });
const staleResult = evaluateInternalHistoricalReplayReadiness({ replayPlan: stalePlan, asOf: AS_OF });
check(() => assert.strictEqual(staleResult.status, STATUS.HOLD_WINDOW));

const tamperedPlan = { ...replayPlan, replayMethodRef: 'TAMPERED' };
const tamperedResult = evaluateInternalHistoricalReplayReadiness({ replayPlan: tamperedPlan, asOf: AS_OF });
check(() => assert.strictEqual(tamperedResult.status, STATUS.HOLD_INTEGRITY));

const notSupplied = record(EXTERNAL_STATUS.NOT_SUPPLIED);
check(() => assert.strictEqual(verifyExternalHistoricalReplayRecord(notSupplied), true));
const notSuppliedResult = evaluateExternalHistoricalReplayForGateIngestion({
  replayPlan,
  replayRecord: notSupplied,
  asOf: AS_OF,
});
check(() => assert.strictEqual(notSuppliedResult.status, STATUS.HOLD_EXTERNAL_HISTORICAL_REPLAY));
check(() => assert.strictEqual(notSuppliedResult.readyForC30GateIngestion, false));
check(() => assert.strictEqual(notSuppliedResult.historicalReplayApproved, false));
check(() => assert.throws(
  () => record(EXTERNAL_STATUS.NOT_SUPPLIED, { evidenceRef: 'FAKE' }),
  /MUST_NOT_CARRY/,
));

check(() => assert.throws(
  () => record(EXTERNAL_STATUS.SUPPLIED_VERIFIED, {
    cases: [
      {
        caseId: 'SYN',
        provenanceRef: 'P',
        historicalObservationDate: '2025-01-01',
        historicalTruthOutcomeRef: 'T',
        systemReplayResultRef: 'R',
        deviationReviewRef: 'D',
        synthetic: true,
      },
    ],
  }),
  /REAL_CASE_FIELDS_REQUIRED/,
));

const supplied = record(EXTERNAL_STATUS.SUPPLIED_VERIFIED);
check(() => assert.strictEqual(verifyExternalHistoricalReplayRecord(supplied), true));
const suppliedResult = evaluateExternalHistoricalReplayForGateIngestion({
  replayPlan,
  replayRecord: supplied,
  asOf: AS_OF,
});
check(() => assert.strictEqual(suppliedResult.status, STATUS.READY_FOR_C30_GATE_INGESTION));
check(() => assert.strictEqual(suppliedResult.readyForC30GateIngestion, true));
check(() => assert.strictEqual(suppliedResult.independentAuthorityStillMustBeValidatedByC30, true));
check(() => assert.strictEqual(suppliedResult.historicalReplayApproved, false));
check(() => assert.strictEqual(suppliedResult.deploymentAuthorized, false));
check(() => assert.strictEqual(suppliedResult.commercialGoLiveAuthorized, false));

const mismatchRecord = record(EXTERNAL_STATUS.SUPPLIED_VERIFIED, {
  candidateHeadSha: 'abcdefabcdefabcdefabcdefabcdefabcdefabcd',
});
const mismatchResult = evaluateExternalHistoricalReplayForGateIngestion({
  replayPlan,
  replayRecord: mismatchRecord,
  asOf: AS_OF,
});
check(() => assert(mismatchResult.blockers.includes('C51_EXTERNAL_BINDING_MISMATCH:candidateHeadSha')));

const methodMismatchRecord = record(EXTERNAL_STATUS.SUPPLIED_VERIFIED, {
  replayMethodRef: 'OTHER-METHOD',
});
const methodMismatchResult = evaluateExternalHistoricalReplayForGateIngestion({
  replayPlan,
  replayRecord: methodMismatchRecord,
  asOf: AS_OF,
});
check(() => assert(methodMismatchResult.blockers.includes('C51_EXTERNAL_METHOD_MISMATCH')));

const rejected = record(EXTERNAL_STATUS.REJECTED);
const rejectedResult = evaluateExternalHistoricalReplayForGateIngestion({
  replayPlan,
  replayRecord: rejected,
  asOf: AS_OF,
});
check(() => assert.strictEqual(rejectedResult.status, STATUS.REJECTED));
check(() => assert.strictEqual(rejectedResult.historicalReplayApproved, false));

const evidence = JSON.parse(read('release/evidence/c51-internal-historical-replay-readiness.json'));
for (const field of [
  'historicalReplayEvidenceSupplied',
  'gate550Satisfied',
  'historicalReplayApproved',
  'deploymentAuthorized',
  'commercialGoLiveAuthorized',
]) {
  check(() => assert.strictEqual(evidence[field], false));
}

const docs = read('docs/C51_INTERNAL_HISTORICAL_REPLAY_READINESS.md');
check(() => assert(docs.includes('synthetic cases are not historical evidence')));
check(() => assert(docs.includes('does not satisfy external gate #550')));
check(() => assert(docs.includes('no invented accuracy')));

const workflow = read('.github/workflows/c51-internal-historical-replay-readiness.yml');
const immutableUse = /^\s*-?\s*uses:\s*[^\s@]+@[a-f0-9]{40}\s*$/i;
const useLines = workflow.split(/\r?\n/).filter((line) => /^\s*-?\s*uses:/.test(line));
check(() => assert(useLines.length > 0));
useLines.forEach((line) => check(() => assert(immutableUse.test(line), `mutable action reference: ${line}`)));
check(() => assert(workflow.includes('C51_GATE_550_SATISFIED=FALSE')));
check(() => assert(workflow.includes('C51_HISTORICAL_REPLAY_APPROVED=FALSE')));

console.log(`C51_INTERNAL_HISTORICAL_REPLAY_READINESS=PASS checks=${checks}`);
console.log('C51_READY_FOR_INDEPENDENT_HISTORICAL_REPLAY=PASS');
console.log('C51_GATE_550_SATISFIED=FALSE');
console.log('C51_HISTORICAL_REPLAY_APPROVED=FALSE');
console.log('C51_DEPLOYMENT_AUTHORIZED=FALSE');
console.log('C51_COMMERCIAL_GO_LIVE_AUTHORIZED=FALSE');
