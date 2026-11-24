'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {args,caseId,marketScopeRef,asOf,c1,c2,s1,s2,impacts,makeImpact,makeShock,makeComparable,evaluate,S,A,C,D,M,E}=require('../fixtures/synthetic-policy-shock');
const result=evaluate(args());
assert.equal(result.status,S.READY_FOR_PROFESSIONAL_POLICY_SHOCK_REVIEW,JSON.stringify(result.blockers));
assert.deepEqual(result.scenarioImpacts.map(x=>[x.impactId,x.baseUnitValueSarPerSqm,x.scenarioDeltaSarPerSqm,x.scenarioUnitValueSarPerSqm]),[['C1-S1',1000,100,1100],['C1-S2',1000,null,null],['C2-S1',2000,-200,1800],['C2-S2',2000,null,null]]);
assert.equal(result.scenarioImpacts[3].excludedFromScenarioByProfessional,true);
for(const k of ['sourceAuthenticityIndependentlyVerified','policyApplicabilityIndependentlyVerified','transactionAuthorized','approvalAuthorized','automaticValuationAdjustment','valuationConclusionProduced','productionAuthorized'])assert.equal(result[k],false);
function stable(v){if(Array.isArray(v))return v.map(stable);if(!v||typeof v!=='object')return v;return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));}
function rehash(v,k){const x={...v};delete x[k];x[k]=crypto.createHash('sha256').update(JSON.stringify(stable(x))).digest('hex');return x;}
const forged=rehash({...c1,unitValueSarPerSqm:123456},'comparableHashSha256');
const asking=makeComparable('C1',{evidenceLevel:'VERIFIED_OFFER'});
const wrongScope=makeComparable('C1',{location:{city:'OTHER',district:'SYNTH-DISTRICT'}});
const future=makeComparable('C1',{capturedAt:'2026-11-01'});
const malformed=rehash({...impacts[0],action:'UNSUPPORTED'},'impactHashSha256');
const beforeShock=makeImpact(c1,s1,A.REVIEW_ONLY,{preparedAt:'2026-10-06'});
const beforeCapture=makeImpact(c1,s1,A.REVIEW_ONLY,{preparedAt:'2026-10-01'});
const negativeValue=makeImpact(c1,s1,A.APPLY_SCENARIO_ADJUSTMENT,{adjustmentDirection:D.DECREASE,adjustmentMethod:M.PERCENT_OF_BASE,adjustmentMagnitude:1});
const cases=[
 args({comparables:[forged,c2]}),args({comparables:[asking,c2]}),args({comparables:[wrongScope,c2]}),args({comparables:[future,c2]}),
 args({comparables:[c1,c1,c2]}),args({impacts:impacts.slice(1)}),args({impacts:[...impacts,impacts[0]]}),
 args({impacts:[malformed,...impacts.slice(1)]}),args({impacts:[beforeShock,...impacts.slice(1)]}),args({impacts:[beforeCapture,...impacts.slice(1)]}),
 args({impacts:[negativeValue,...impacts.slice(1)]}),args({asOf:'2026-02-30'}),args({asOf:'2027-01-01'}),
 args({}, {maxAgeDays:1}),args({}, {reviewedAt:'2026-10-09'}),args({}, {targetTransactionType:'RENT'}),
 {...args(),reviewPolicy:{...args().reviewPolicy,transactionAuthorized:true}},
];
for(const input of cases){const r=evaluate(input);assert.notEqual(r.status,S.READY_FOR_PROFESSIONAL_POLICY_SHOCK_REVIEW,JSON.stringify(input));assert.deepEqual(r.scenarioImpacts,[]);assert.equal(r.transactionAuthorized,false);}
assert.throws(()=>args({}, {requireFullComparableShockMatrix:false}),/FULL_MATRIX_REQUIRED/);
assert.throws(()=>makeShock('BAD',{knownAt:'2026-02-30'}),/valid UTC/);
console.log('C19_POLICY_SHOCK_SCENARIO_REVIEW=PASS synthetic_only=true negative_cases='+(cases.length+2));

const {reviewLocalPolicyShock}=require('../../src/market/local-policy-shock-review');
(async()=>{
 const opts={expectedCaseId:caseId,expectedMarketScopeRef:marketScopeRef,expectedAssetType:'OFFICE',expectedCity:'SYNTH-CITY',expectedTransactionType:'SALE',asOfDate:asOf};
 const local=await reviewLocalPolicyShock({...opts,text:JSON.stringify({...args(),report:{transactionAuthorized:true}})});
 assert.equal(local.status,result.status,JSON.stringify(local.blockers));
 assert.deepEqual(local.scenarioImpacts,result.scenarioImpacts);
 assert.equal(local.transactionAuthorized,false);
 for(const bad of cases){
  const h=await reviewLocalPolicyShock({...opts,text:JSON.stringify(bad)});
  assert.notEqual(h.status,S.READY_FOR_PROFESSIONAL_POLICY_SHOCK_REVIEW);
  assert.deepEqual(h.scenarioImpacts,[]);
  assert.equal(h.transactionAuthorized,false);
 }
 const wrong=await reviewLocalPolicyShock({...opts,expectedCity:'OTHER',text:JSON.stringify(args())});
 assert.equal(wrong.blockers[0],'C19_EXPECTED_SCOPE_OR_DATE_MISMATCH');
 console.log('C19_NATIVE_WEBCRYPTO_PARITY=PASS synthetic_only=true');
})().catch(e=>{console.error(e);process.exitCode=1;});
