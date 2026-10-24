'use strict';
const assert = require('node:assert/strict');
const {STATUS, evaluateTimeForwardHoldout} =
  require('../../src/validation/time-forward-valuation-holdout');

const policy = () => ({
  protocolId:'PREREG-TEST-001',
  registeredAt:'2025-12-01',
  trainingCutoffDate:'2025-11-01',
  holdoutStartDate:'2026-01-01',
  holdoutEndDate:'2026-12-31',
  modelVersion:'synthetic-v1',
  currency:'SAR',
  basis:'MARKET_VALUE',
  calibrationAssetIds:['CALIBRATION-001'],
  maxP90AbsolutePercentageError:0.25,
  numericPolicy:{
    minObservations:2,
    maxDateGapDays:120,
    maxMedianAbsolutePercentageError:0.25,
    maxAbsoluteMedianSignedPercentageError:0.25,
  },
  slices:[
    {field:'region',value:'Riyadh',minObservations:1,
      maxMedianAbsolutePercentageError:0.15, maxP90AbsolutePercentageError:0.25,
      maxAbsoluteMedianSignedPercentageError:0.15},
    {field:'region',value:'Jeddah',minObservations:1,
      maxMedianAbsolutePercentageError:0.2, maxP90AbsolutePercentageError:0.25,
      maxAbsoluteMedianSignedPercentageError:0.2},
    {field:'assetType',value:'OFFICE',minObservations:1,
      maxMedianAbsolutePercentageError:0.25, maxP90AbsolutePercentageError:0.25,
      maxAbsoluteMedianSignedPercentageError:0.25},
  ],
});
function obs(i,patch={}) {
  return {
    caseId:'CASE-'+i,projectId:'PROPERTY-'+i,
    region:i===1?'Riyadh':'Jeddah',
    assetType:'OFFICE',modelVersion:'synthetic-v1',
    startakValue:i===1?1100000:900000,
    comparatorValue:1000000,
    comparatorType:'ACTUAL_TRANSACTION',
    currency:'SAR',basis:'MARKET_VALUE',
    startakAsOf:'2026-01-02',
    predictionRecordedAt:'2026-01-03',
    comparatorAsOf:'2026-02-01',
    startakEvidenceRef:'PREDICTION-'+i,
    comparatorEvidenceRef:'SOURCE-'+i,
    reviewerRef:'UNVERIFIED-REVIEWER-'+i,
    ...patch,
  };
}
const original=[obs(1),obs(2)];
const go=(patch={},rows=original)=>evaluateTimeForwardHoldout({
  protocol:{...policy(),...patch}, observations:rows,
});
let checks=0;
function isHold(out,status,code) {
  assert.equal(out.status,status);
  assert.equal(out.productionDecisionAuthorized,false);
  assert.equal(out.independentMarketEvidenceVerified,false);
  assert.equal(out.sourceRightsVerified,false);
  assert.equal(out.certifiedValuationEstablished,false);
  assert.ok(out.reasons.includes(code),JSON.stringify(out.reasons));
  checks+=6;
}
const ok=go();
assert.equal(ok.status,STATUS.CALCULATED_WITHIN_REGISTERED_THRESHOLDS);
assert.equal(ok.sampleMetricsWithinProtocol,true);
assert.equal(ok.metrics.observationCount,2);
assert.ok(Math.abs(ok.metrics.p90AbsolutePercentageError-0.1)<1e-12);
assert.equal(ok.sliceMetrics.length,3);
assert.ok(Math.abs(ok.sliceMetrics[0].medianAbsolutePercentageError-0.1)<1e-12);
assert.ok(Math.abs(ok.sliceMetrics[1].p90AbsolutePercentageError-0.1)<1e-12);
assert.match(ok.protocolDigestSha256,/^[0-9a-f]{64}$/);
assert.equal(ok.productionDecisionAuthorized,false);
assert.equal(ok.statisticalConfidenceEstablished,false);
assert.equal(ok.licensedValuerApproved,false);
assert.equal(ok.independentMarketEvidenceVerified,false);
checks+=10;

isHold(go({registeredAt:'2026-01-02'}),STATUS.HOLD_PROTOCOL,
  'TIME_FORWARD_PROTOCOL_ORDER_INVALID');
isHold(go({registeredAt:'2026-02-31'}),STATUS.HOLD_PROTOCOL,
  'INVALID_registeredAt');
isHold(go({maxP90AbsolutePercentageError:undefined}),STATUS.HOLD_PROTOCOL,
  'MAX_P90_THRESHOLD_REQUIRED');
isHold(go({calibrationAssetIds:['PROPERTY-1']}),STATUS.HOLD_COHORT,
  'COHORT_INTEGRITY_FAILED');
isHold(go({},[obs(1),obs(2,{projectId:'PROPERTY-1'})]),STATUS.HOLD_COHORT,
  'COHORT_INTEGRITY_FAILED');
isHold(go({},[obs(1),obs(2,{comparatorEvidenceRef:'SOURCE-1'})]),STATUS.HOLD_COHORT,
  'COHORT_INTEGRITY_FAILED');
isHold(go({},[obs(1),obs(2,{predictionRecordedAt:'2026-02-01'})]),
  STATUS.HOLD_COHORT,'COHORT_INTEGRITY_FAILED');
isHold(go({},[obs(1),obs(2,{comparatorAsOf:'2026-01-01'})]),
  STATUS.HOLD_COHORT,'COHORT_INTEGRITY_FAILED');
isHold(go({},[obs(1),obs(2,{modelVersion:'synthetic-v2'})]),
  STATUS.HOLD_COHORT,'COHORT_INTEGRITY_FAILED');
isHold(go({},[obs(1),obs(2,{currency:'USD'})]),
  STATUS.HOLD_COHORT,'COHORT_INTEGRITY_FAILED');
isHold(go({slices:[...policy().slices,
  {...policy().slices[0],value:'Dammam'}]}),
  STATUS.HOLD_COHORT,'REGISTERED_SLICE_UNDERPOWERED');
isHold(go({slices:[{...policy().slices[0],value:'Dammam'},...policy().slices.slice(1)]}),
  STATUS.HOLD_COHORT,'UNREGISTERED_COHORT_SLICE');
isHold(go({},[obs(1),obs(2,{assetType:'WAREHOUSE'})]),
  STATUS.HOLD_COHORT,'UNREGISTERED_COHORT_SLICE');
isHold(go({slices:[{...policy().slices[0],maxP90AbsolutePercentageError:undefined},
  ...policy().slices.slice(1)]}),
  STATUS.HOLD_PROTOCOL,'INVALID_OR_DUPLICATE_SLICE_0');
isHold(go({slices:policy().slices.slice(0,2)}),
  STATUS.HOLD_PROTOCOL,'REGION_AND_ASSET_TYPE_SLICE_REGISTRATION_REQUIRED');
const asymmetric = go({
  maxP90AbsolutePercentageError:0.6,
  numericPolicy:{...policy().numericPolicy,
    maxMedianAbsolutePercentageError:0.6,
    maxAbsoluteMedianSignedPercentageError:0.6},
  slices:policy().slices.map(s => s.field==='assetType'
    ? {...s,maxMedianAbsolutePercentageError:0.6,maxP90AbsolutePercentageError:0.6,
        maxAbsoluteMedianSignedPercentageError:0.6}
    : s),
},[obs(1,{startakValue:1500000}),obs(2,{startakValue:1000000})]);
isHold(asymmetric,STATUS.HOLD_NUMERIC,'REGISTERED_SLICE_NUMERIC_THRESHOLD_EXCEEDED');
assert.equal(asymmetric.sliceMetrics[0].medianAbsolutePercentageError,0.5);
assert.equal(asymmetric.sliceMetrics[1].medianAbsolutePercentageError,0);
checks+=2;
const evenMedian = go({},[
  obs(1,{startakValue:1000000}),
  obs(2),
  obs(3,{region:'Riyadh',startakValue:1200000})
]);
assert.equal(evenMedian.status,STATUS.CALCULATED_WITHIN_REGISTERED_THRESHOLDS);
assert.ok(Math.abs(evenMedian.sliceMetrics[0].medianAbsolutePercentageError-0.1)<1e-12);
assert.ok(Math.abs(evenMedian.sliceMetrics[0].p90AbsolutePercentageError-0.2)<1e-12);
checks+=3;
isHold(go({maxP90AbsolutePercentageError:0.05}),
  STATUS.HOLD_NUMERIC,'P90_OUTSIDE_REGISTERED_THRESHOLD');
isHold(go({},[obs(1),obs(2,{startakValue:-100})]),
  STATUS.HOLD_NUMERIC,'BASE_EXTERNAL_VALIDATION_HOLD_EVIDENCE');
isHold(evaluateTimeForwardHoldout(),STATUS.HOLD_PROTOCOL,'PROTOCOL_REQUIRED');
isHold(go({},[]),STATUS.HOLD_COHORT,'SAMPLE_SIZE_MISSING_OR_EXCEEDS_BOUND');
isHold(go({slices:[policy().slices[0],policy().slices[0],
  ...policy().slices.slice(1)]}),STATUS.HOLD_PROTOCOL,
  'INVALID_OR_DUPLICATE_SLICE_1');
console.log('N06_TIME_FORWARD_HOLDOUT=PASS checks='+checks+
  ' UNVERIFIED_EXTERNAL_AUTHORITIES_REMAIN_FALSE=PASS');
