'use strict';
const assert=require('node:assert/strict');
const {
  STATUS,JOURNEY_STEPS,REQUIRED_SCENARIOS,assessAssetSectorE2ECoverage,
}=require('../../src/pilot/asset-sector-e2e-evidence-matrix');
const sha='d'.repeat(40),hash='e'.repeat(64),when='2026-10-08T08:00:00Z';
const date='2026-10-08T09:00:00Z';
function record(s){
  return {
    scenarioId:s.id,assetClass:s.assetClass,
    candidateHeadSha:sha,
    caseId:'SYNTHETIC-TEST-'+s.id,
    synthetic:false, // Declared false solely to exercise structural parser, NOT real proof.
    testMode:'LIVE_USER_OPERATED_REAL_BROWSER',
    sourceRightsRef:'SYNTHETIC-TEST-SOURCE-RIGHTS',
    independentReviewerRef:'SYNTHETIC-TEST-REVIEWER',
    humanUatApprovalRef:'SYNTHETIC-TEST-UAT-REF',
    evidencePackSha256:hash,executedAt:when,
    steps:JOURNEY_STEPS.map(step=>({step,status:'PASS',evidenceRef:'TEST-'+step,artifactSha256:hash})),
    negativeScenarios:[
      {caseRef:'TEST-MISSING',expectedGate:'HOLD',actualGate:'HOLD',artifactSha256:hash},
      {caseRef:'TEST-CONFLICT',expectedGate:'HOLD',actualGate:'HOLD',artifactSha256:hash},
    ],
  };
}
const records=REQUIRED_SCENARIOS.map(record);
function evalWith(items, extras={}){return assessAssetSectorE2ECoverage({
  candidateHeadSha:sha,asOf:date,records:items,...extras,
});}
const defaultHold=evalWith([]);
assert.equal(defaultHold.status,STATUS.HOLD);
assert.equal(defaultHold.structurallyReadyCount,0);
assert.equal(defaultHold.byScenario.length,8);
assert.equal(defaultHold.realE2ECoverageEstablished,false);
const structurallyComplete=evalWith(records);
assert.equal(structurallyComplete.status,STATUS.READY_FOR_INDEPENDENT_REVIEW);
assert.equal(structurallyComplete.structurallyReadyCount,8);
assert.equal(structurallyComplete.realE2ECoverageEstablished,false);
assert.equal(structurallyComplete.independentlyValidatedHumanUatApprovalEstablished,false);
assert.equal(structurallyComplete.productionAuthorized,false);
assert.equal(structurallyComplete.commercialGoLiveAuthorized,false);
assert.equal(structurallyComplete.certifiedValuationEstablished,false);
assert.equal(structurallyComplete.transactionAuthorized,false);
assert.equal(evalWith(records.slice(1)).status,STATUS.HOLD);
assert.equal(evalWith([...records,records[0]]).status,STATUS.HOLD);
assert.equal(evalWith(records.map((r,i)=>i===0?{...r,candidateHeadSha:'f'.repeat(40)}:r)).status,STATUS.HOLD);
assert.equal(evalWith(records.map((r,i)=>i===1?{...r,synthetic:true}:r)).status,STATUS.HOLD);
assert.equal(evalWith(records.map((r,i)=>i===1?{...r,steps:r.steps.slice(1)}:r)).status,STATUS.HOLD);
assert.equal(evalWith(records.map((r,i)=>i===2?{...r,humanUatApprovalRef:null}:r)).status,STATUS.HOLD);
assert.equal(evalWith(records.map((r,i)=>i===3?{...r,negativeScenarios:[]}:r)).status,STATUS.HOLD);
assert.equal(evalWith(records.map((r,i)=>i===4?{...r,executedAt:'2026-11-01'}:r)).status,STATUS.HOLD);
assert.equal(evalWith(records,{candidateHeadSha:'bad'}).status,STATUS.HOLD);
assert.equal(evalWith(null).status,STATUS.HOLD);
console.log('C57_STRUCTURAL_SECTOR_E2E_EVIDENCE_MATRIX=PASS');
console.log('C57_REAL_BROWSER_E2E_EXECUTED=FALSE');
console.log('C57_REAL_HUMAN_UAT_VERIFIED=FALSE');
