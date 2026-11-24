'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {args,scope,asOf,evidence,pair,allEvidence,allPairs,b1,c1,b2,c2,b3,c3,planned,p1,p2,p3,makeEvidence,makePair,makePolicy,evaluate,S,C,O,M,A,T}=require('../fixtures/synthetic-urban-growth');
const result=evaluate(args());
assert.equal(result.status,S.READY_FOR_PROFESSIONAL_URBAN_GROWTH_ACCESSIBILITY_REVIEW,JSON.stringify(result.blockers));
assert.deepEqual(result.review.comparisons.map(x=>[x.pairId,x.absoluteDelta,x.percentageDelta]),[['PAIR-1',2000,20],['PAIR-2',-10,-25],['PAIR-3',25,null]]);
assert.equal(result.review.reviewOnlyNonExistingContext[0].treatedAsExisting,false);
assert.ok(result.riskFlags.some(x=>x.includes('BASELINE_ZERO')));
assert.equal(result.review.comparisons[0].baselineSourceReference,b1.sourceReference);
for(const k of ['sourceAuthenticityIndependentlyVerified','measurementComparabilityIndependentlyVerified','liveGeospatialDataFetched','transactionAuthorized','approvalAuthorized','productionAuthorized','automaticGrowthScore','automaticAccessibilityScore','valuationCalculated'])assert.equal(result[k],false);
function stable(v){if(Array.isArray(v))return v.map(stable);if(!v||typeof v!=='object')return v;return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));}
function rehash(v,k){const x={...v};delete x[k];x[k]=crypto.createHash('sha256').update(JSON.stringify(stable(x))).digest('hex');return x;}
function replaceCurrent(patch){const next=makeEvidence({...c1,...patch});return args({evidence:[b1,next,b2,c2,b3,c3,planned],pairs:[pair('PAIR-1',b1,next,A.GROWTH_DELTA),p2,p3]});}
const forged=rehash({...c1,metricValue:-1},'evidenceHashSha256');
const duplicate=makeEvidence({...c1,evidenceId:'DUPLICATE'});
const negatives=[
 replaceCurrent({seriesRef:'OTHER-SERIES'}),replaceCurrent({measurementMethodRef:'OTHER-METHOD'}),replaceCurrent({geographyDefinitionRef:'OTHER-BOUNDARY'}),replaceCurrent({sourceProvider:'OTHER-PROVIDER'}),replaceCurrent({metricUnit:'HOUSEHOLDS'}),replaceCurrent({propertyRef:'OTHER-PROPERTY'}),
 replaceCurrent({observationState:O.PROPOSED_UNCERTAIN,nonExistingStateRationaleRef:'SYNTH-PLAN'}),
 replaceCurrent({validUntil:'2026-10-06'}),replaceCurrent({referenceAt:'2025-09-30'}),
 args({evidence:[b1,forged,b2,c2,b3,c3,planned]}),
 args({evidence:[...allEvidence,duplicate]}),
 args({pairs:[p1,p2]}),
 args({pairs:[p1,p1,p2,p3]}),
 args({pairs:[pair('PAIR-1',b1,c1,A.ACCESSIBILITY_DELTA),p2,p3]}),
 args({pairs:[pair('PAIR-1',b1,c1,A.GROWTH_DELTA,{preparedAt:'2026-10-03'}),p2,p3]}),
 args({}, {reviewedAt:'2026-10-06'}),
 args({}, {allowNonObservedContextEvidence:false}),
 args({asOf:'2026-02-30'}),args({asOf:'2027-01-01'}),
 {...args(),reviewPolicy:rehash({...args().reviewPolicy,valuationAuthority:true},'policyHashSha256')},
];
for(const x of negatives){const r=evaluate(x);assert.notEqual(r.status,S.READY_FOR_PROFESSIONAL_URBAN_GROWTH_ACCESSIBILITY_REVIEW);assert.equal(r.review,null);assert.equal(r.transactionAuthorized,false);}
assert.throws(()=>makeEvidence({...c1,metricValue:1.5}),/METRIC_VALUE_INVALID/);
assert.throws(()=>makeEvidence({...c1,knownAt:'2026-02-30'}),/valid UTC/);
assert.throws(()=>makeEvidence({...c1,sourceTier:T.C_INDICATIVE_AVM}),/AVM_NOT/);
console.log('C20_URBAN_GROWTH_ACCESSIBILITY_REVIEW=PASS synthetic_only=true negative_cases='+(negatives.length+3));

const {reviewLocalUrbanGrowth}=require('../../src/geospatial/local-urban-growth-review');
(async()=>{
 const opts={expectedCaseId:scope.caseId,expectedPropertyRef:scope.propertyRef,expectedMarketScopeRef:scope.marketScopeRef,asOfDate:asOf};
 const local=await reviewLocalUrbanGrowth({...opts,text:JSON.stringify({...args(),report:{transactionAuthorized:true}})});
 assert.equal(local.status,result.status,JSON.stringify(local.blockers));
 assert.deepEqual(local.review,result.review);
 assert.equal(local.transactionAuthorized,false);
 for(const bad of negatives){
  const h=await reviewLocalUrbanGrowth({...opts,text:JSON.stringify(bad)});
  assert.notEqual(h.status,S.READY_FOR_PROFESSIONAL_URBAN_GROWTH_ACCESSIBILITY_REVIEW);
  assert.equal(h.review,null);assert.equal(h.transactionAuthorized,false);
 }
 const wrong=await reviewLocalUrbanGrowth({...opts,expectedPropertyRef:'OTHER',text:JSON.stringify(args())});
 assert.equal(wrong.blockers[0],'C20_EXPECTED_SCOPE_OR_DATE_MISMATCH');
 console.log('C20_NATIVE_WEBCRYPTO_PARITY=PASS synthetic_only=true');
})().catch(e=>{console.error(e);process.exitCode=1;});
