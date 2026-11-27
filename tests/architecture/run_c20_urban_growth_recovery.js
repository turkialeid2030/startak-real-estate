'use strict';
const assert=require('node:assert/strict'),c=require('../../src/market/governed-urban-growth-accessibility');
const S=c.REVIEW_STATUS,READY=S.READY_FOR_PROFESSIONAL_URBAN_GROWTH_ACCESSIBILITY_REVIEW;
const scope={caseId:'SYNTH-C',propertyRef:'SYNTH-P',marketScopeRef:'SYNTH-M'},asOf='2026-09-10T12:00:00Z',early='2026-09-08T00:00:00Z',late='2026-09-09T00:00:00Z',future='2027-01-01T00:00:00Z',H='a'.repeat(64);
const signalClass=c.SIGNAL_CLASS.POPULATION_OR_HOUSEHOLD_GROWTH,tier=c.SOURCE_TIER.A_OFFICIAL_AUTHORITATIVE;
function e(id='B',patch={}){return c.createUrbanGrowthAccessibilityEvidence({...scope,evidenceId:id,signalKey:'POP',signalClass,observationState:'OBSERVED_EXISTING',metricType:'COUNT',metricUnit:'persons',metricValue:id==='B'?100:125,sourceCapability:'SYNTH',sourceProvider:'PROVIDER',sourceTier:tier,sourceRecordId:id,sourceRecordHashSha256:H,sourceStatus:'VERIFIED_LABEL',sourceReference:'DOC-'+id,provenanceVerified:true,knownAt:early,referenceAt:id==='B'?'2025-09-01':'2026-09-01',reviewedByRef:'R',reviewEvidenceRef:'RE',reviewedAt:early,validUntil:future,...patch});}
function fixture(evidence=[e(),e('C')],pairPatch={},policyPatch={}){
 const p=c.createProfessionalUrbanGrowthAccessibilityPair({...scope,pairId:'PAIR',signalKey:'POP',analysisType:'GROWTH_DELTA',baselineEvidenceHashSha256:evidence[0].evidenceHashSha256,currentEvidenceHashSha256:evidence[1].evidenceHashSha256,rationaleRef:'RATIONALE',preparedByRef:'R',preparedAt:late,reviewedByRef:'R',reviewEvidenceRef:'RE',reviewedAt:late,validUntil:future,...pairPatch});
 const policy=c.createUrbanGrowthAccessibilityReviewPolicy({...scope,policyId:'POL',allowedSignalClasses:[signalClass],requiredSignalClasses:[signalClass],allowedAnalysisTypes:['GROWTH_DELTA'],allowedMetricTypes:['COUNT'],allowedSourceTiers:[tier],allowNonObservedContextEvidence:false,evidenceHashesSha256:evidence.map(x=>x.evidenceHashSha256),pairHashesSha256:[p.pairHashSha256],reviewedByRef:'R',reviewEvidenceRef:'RE',reviewedAt:late,validUntil:future,...policyPatch});
 return {...scope,asOf,evidence,pairs:[p],reviewPolicy:policy};
}
let checks=0;function run(x,status){const o=c.evaluateGovernedUrbanGrowthAccessibility(x);assert.equal(o.status,status,JSON.stringify(o.blockers));for(const k of ['sourceAuthenticityIndependentlyVerified','transactionAuthorized','approvalAuthorized','productionAuthorized','causalUpliftEstimatedBySoftware','valuationCalculated','automaticInvestmentRanking'])assert.equal(o[k],false);if(status!==READY)assert.equal(o.review,null);checks++;return o;}
const v=fixture(),ok=run(v,READY);assert.equal(ok.review.comparisons[0].absoluteDelta,25);assert.equal(ok.review.comparisons[0].percentageDelta,25);
const zero=run(fixture([e('B',{metricValue:0}),e('C')]),READY);assert.equal(zero.review.comparisons[0].percentageDelta,null);
assert.deepEqual(run(JSON.parse(JSON.stringify(v)),READY),ok);
run(fixture([e(),e('C',{sourceProvider:'OTHER'})]),S.HOLD_CONTEXT);
run(fixture([e(),e('C',{metricUnit:'households'})]),S.HOLD_CONTEXT);
run(fixture([e(),e('C',{referenceAt:'2025-08-01'})]),S.HOLD_WINDOW);
run(fixture([e(),e('C',{reviewedAt:late})],{preparedAt:early}),S.HOLD_WINDOW);
run(fixture(undefined,{}, {reviewedAt:early}),S.HOLD_POLICY);
const planned=e('P',{observationState:'PLANNED_COMMITTED_NOT_DELIVERED',nonExistingStateRationaleRef:'PLAN',referenceAt:future});
run(fixture([e(),planned],{}, {allowNonObservedContextEvidence:true}),S.HOLD_EVIDENCE);
assert.equal(run(fixture([e(),e('C'),planned],{}, {allowNonObservedContextEvidence:true}),READY).review.reviewOnlyNonExistingContext[0].treatedAsExisting,false);
run(fixture([e(),e('C'),planned]),S.HOLD_POLICY);
run({...v,propertyRef:'OTHER'},S.HOLD_CONTEXT);run({...v,asOf:'2099-01-01'},S.HOLD_CONTEXT);run({...v,asOf:'2026-02-30'},S.HOLD_CONTEXT);run({...v,evidence:[]},S.HOLD_EVIDENCE);
const changed={...v.evidence[0],valuationImpactEstimatedBySoftware:true};changed.evidenceHashSha256=c.computeEvidenceHash(changed);run({...v,evidence:[changed,v.evidence[1]]},S.HOLD_INTEGRITY);
let reads=0;run(Object.defineProperty({},'evidence',{enumerable:true,get(){reads++;return v.evidence;}}),S.HOLD_INTEGRITY);assert.equal(reads,0);
run(null,S.HOLD_INTEGRITY);
assert.throws(()=>e('B',{metricValue:0.5}),/C20_METRIC_VALUE_INVALID/);
assert.throws(()=>e('B',{referenceAt:future}),/C20_OBSERVATION_AFTER_KNOWN_AT/);
assert.throws(()=>e('B',{sourceTier:'C_INDICATIVE_AVM'}),/C20_AVM_NOT_URBAN_GROWTH_ACCESSIBILITY_EVIDENCE/);
assert.throws(()=>e('B',{knownAt:'2026-02-30'}),/valid date/);
console.log('C20_URBAN_GROWTH_RECOVERY=PASS cases='+checks+' synthetic=true legalAuthority=false');
