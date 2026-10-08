'use strict';
const assert = require('node:assert/strict');
const {
  createHistoricalReplayPlan,
  createExternalHistoricalReplayRecord,
  EXTERNAL_STATUS,
} = require('../../src/replay/historical-replay-readiness');
const {
  STATUS,
  evaluateSaudiHistoricalCohort,
} = require('../../src/replay/saudi-historical-cohort');

const SHA = 'c'.repeat(40);
const AS_OF = '2026-10-09T00:00:00.000Z';
const plan = createHistoricalReplayPlan({
  candidateHeadSha: SHA,
  productScopeRef: 'C56-INTERNAL-STRUCTURAL-SIMULATION',
  replayMethodRef: 'C56-MARKET-OUT-OF-SAMPLE-PROTOCOL',
  predeclaredMeasures: [
    {measureId: 'MEDIAN_APE',definitionRef: 'PREDECLARED_MEDIAN_APE'},
    {measureId: 'P90_APE',definitionRef: 'PREDECLARED_P90_APE'},
  ],
  preparedAt: '2026-10-08T00:00:00.000Z',
  validUntil: '2026-10-30T00:00:00.000Z',
});
function row(id, split, date, predicted, truth, opts = {}) {
  return {
    caseId: id, projectId: 'C56-SYNTHETIC-TEST',
    assetType: 'RESIDENTIAL', city: 'Riyadh', country: 'SA',
    synthetic: false, // Tests only: structural flag does not authenticate real-life cases.
    propertyIdentityRef: 'PROPERTY-' + id,
    split,
    startakValue: predicted, comparatorValue: truth,
    currency: 'SAR', basis: 'MARKET_VALUE',
    comparatorType: 'ACTUAL_TRANSACTION',
    comparatorArtifactSha256: 'a'.repeat(64),
    startakAsOf: date, comparatorAsOf: date, modelIssuedAt: '2024-08-01T00:00:00Z',
    comparatorEvidenceRef: 'EVIDENCE-SYNTHETIC-' + id,
    startakEvidenceRef: 'STARTAK-SYNTHETIC-' + id,
    reviewerRef: 'INTERNAL-TEST',
    ...opts,
  };
}
const syntheticRows = [
  row('CAL-1', 'CALIBRATION', '2025-03-01', 1000000, 1000000),
  row('HOLD-1', 'HOLDOUT', '2025-09-01', 1100000, 1000000),
  row('HOLD-2', 'HOLDOUT', '2025-10-01', 900000, 1000000),
];
const replayRecord = createExternalHistoricalReplayRecord({
  evidenceId:'HISTORICAL_REPLAY_EVIDENCE',candidateHeadSha:SHA,
  status: EXTERNAL_STATUS.SUPPLIED_VERIFIED,
  evidenceRef:'INTERNAL-C56-STRUCTURAL-TEST-PACK',evidenceHashSha256:'b'.repeat(64),
  verifiedByRef:'INTERNAL-TEST-ONLY',verifiedAt:'2026-10-08T08:00:00Z',
  replayMethodRef:'C56-MARKET-OUT-OF-SAMPLE-PROTOCOL',
  predeclaredMeasuresRef:'C56-PREDECLARED-MEASURE-REF',
  materialDeviationDispositionRef:'INTERNAL-DEVIATION-TEST',
  cases:syntheticRows.map(r=>({
    caseId:r.caseId,provenanceRef:r.comparatorEvidenceRef,
    historicalObservationDate:r.comparatorAsOf,
    historicalTruthOutcomeRef:'TRUTH-' + r.caseId,
    systemReplayResultRef:'REPLAY-' + r.caseId,
    deviationReviewRef:'DEV-' + r.caseId,
    synthetic:false,
  })),
});
const registration = {
  predeclaredAt:'2024-01-01',
  calibrationEndDate:'2025-06-30',
  protocolRef:'C56-STRUCTURAL-TEST-ONLY',
  protocolHashSha256:'1'.repeat(64),
  registeredByRef:'INTERNAL-TEST',
  minHoldoutObservations:2,
  minSliceObservations:1,
};
const policy = {
  minObservations:2,maxDateGapDays:2,
  maxMedianAbsolutePercentageError:0.2,
  maxAbsoluteMedianSignedPercentageError:0.1,
};
const args={replayPlan:plan,replayRecord,registration,observations:syntheticRows,validationPolicy:policy,asOf:AS_OF};
const result=evaluateSaudiHistoricalCohort(args);
assert.equal(result.status, STATUS.READY_FOR_EXTERNAL_REVIEW);
assert.equal(result.holdoutCount,2);
assert.equal(result.calibrationCount,1);
assert.equal(result.overall.count,2);
assert.equal(result.overall.meanAbsolutePercentageError,0.1);
assert.equal(result.byCityAndAssetType['Riyadh|RESIDENTIAL'].count,2);
assert.equal(result.marketAccuracyEstablished,false);
assert.equal(result.certifiedValuationEstablished,false);
assert.equal(result.productionDecisionAuthorized,false);
assert.equal(result.commercialGoLiveAuthorized,false);
assert.equal(result.independentMarketProofAuthenticityNotEstablishedByStructuralChecks,true);
assert.equal(evaluateSaudiHistoricalCohort({...args, observations:[]}).status,STATUS.HOLD);
assert.equal(evaluateSaudiHistoricalCohort({...args, observations:[...syntheticRows,{...syntheticRows[2],caseId:'HOLD-3',synthetic:true}]}).status,STATUS.HOLD);
assert.equal(evaluateSaudiHistoricalCohort({...args, observations:syntheticRows.map((r,i)=>i===2?{...r,split:'CALIBRATION'}:r)}).status,STATUS.HOLD);
assert.equal(evaluateSaudiHistoricalCohort({...args, observations:syntheticRows.map((r,i)=>i===2?{...r,modelIssuedAt:'2026-01-01'}:r)}).status,STATUS.HOLD);
assert.equal(evaluateSaudiHistoricalCohort({...args, observations:syntheticRows.map((r,i)=>i===2?{...r,propertyIdentityRef:syntheticRows[1].propertyIdentityRef,comparatorAsOf:syntheticRows[1].comparatorAsOf,comparatorEvidenceRef:syntheticRows[1].comparatorEvidenceRef}:r)}).status,STATUS.HOLD);
assert.equal(evaluateSaudiHistoricalCohort({...args, registration:{...registration,predeclaredAt:'2025-10-02'}}).status,STATUS.HOLD);
assert.equal(evaluateSaudiHistoricalCohort({...args, registration:null}).status,STATUS.HOLD);
assert.equal(evaluateSaudiHistoricalCohort({...args, replayRecord:null}).status,STATUS.HOLD);
assert.equal(evaluateSaudiHistoricalCohort({...args, validationPolicy:{}}).status,STATUS.HOLD);
const stress=evaluateSaudiHistoricalCohort({...args,validationPolicy:{...policy,maxMedianAbsolutePercentageError:0.01}});
assert.equal(stress.status,STATUS.HOLD_PERFORMANCE);
assert.equal(stress.marketAccuracyEstablished,false);
console.log('C56_SAUDI_OUT_OF_SAMPLE_STRUCTURAL_VALIDATION=PASS');
console.log('C56_REAL_SAUDI_BACKTEST_PERFORMED=FALSE');
console.log('C56_REAL_SAUDI_ACCURACY_ESTABLISHED=FALSE');
