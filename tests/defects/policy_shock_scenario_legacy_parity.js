'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {createComparableEvidenceRecord}=require('../../src/market/comparable-evidence');
const {REVIEW_STATUS:S,SHOCK_CLASS:C,EVIDENCE_STATE:E,IMPACT_ACTION:A,ADJUSTMENT_DIRECTION:D,ADJUSTMENT_METHOD:M,createPolicyShockEvidence,createProfessionalComparableImpact,createPolicyShockReviewPolicy,evaluateGovernedPolicyShockComparableImpact:evaluate}=require('../../src/market/policy-shock-scenario-review');
const caseId='SYNTH-C19',marketScopeRef='SYNTH-MARKET',asOf='2026-10-31';
const makeComparable=(id,patch={})=>createComparableEvidenceRecord({comparableId:id,caseId,sourcePropertyRef:'PROP-'+id,assetType:'OFFICE',transactionType:'SALE',evidenceLevel:'VERIFIED_TRANSACTION',sourceName:'Synthetic source',sourceRef:'SYNTH-SOURCE-'+id,sourceDate:'2026-10-04',transactionDate:'2026-10-01',location:{city:'SYNTH-CITY',district:'SYNTH-DISTRICT'},areaSqm:100,amountSar:100000,verification:{status:'VERIFIED',verifiedByRef:'SYNTH-VERIFIER',verifiedAt:'2026-10-05',evidenceRef:'SYNTH-REVIEW'},capturedAt:'2026-10-06',...patch});
const makeShock=(id,patch={})=>createPolicyShockEvidence({shockEvidenceId:id,caseId,marketScopeRef,shockClass:C.TRANSFER_COST_TAX_OR_FEE,evidenceState:E.SATISFIED,sourceCapability:'SYNTH-CAPABILITY',sourceRecordId:'SYNTH-SOURCE-'+id,sourceRecordHashSha256:'a'.repeat(64),sourceStatus:'SYNTH-REVIEWED',sourceReference:'SYNTH-REF',knownAt:'2026-10-07',effectiveAt:'2027-01-01',reviewedByRef:'SYNTH-REVIEWER',reviewEvidenceRef:'SYNTH-REVIEW',reviewedAt:'2026-10-08',validUntil:'2026-12-31',...patch});
const c1=makeComparable('C1'),c2=makeComparable('C2',{amountSar:200000});
const s1=makeShock('S1'),s2=makeShock('S2',{shockClass:C.FINANCING_OR_RATE_ENVIRONMENT});
const makeImpact=(c,s,action,patch={})=>createProfessionalComparableImpact({impactId:c.comparableId+'-'+s.shockEvidenceId,caseId,comparableId:c.comparableId,comparableHashSha256:c.comparableHashSha256,shockEvidenceHashSha256:s.shockEvidenceHashSha256,action,rationaleRef:'SYNTH-RATIONALE',preparedByRef:'SYNTH-PREPARER',preparedAt:'2026-10-09',reviewedByRef:'SYNTH-REVIEWER',reviewedAt:'2026-10-10',reviewEvidenceRef:'SYNTH-REVIEW',validUntil:'2026-12-31',...patch});
const impacts=[makeImpact(c1,s1,A.APPLY_SCENARIO_ADJUSTMENT,{adjustmentDirection:D.INCREASE,adjustmentMethod:M.PERCENT_OF_BASE,adjustmentMagnitude:.1}),makeImpact(c1,s2,A.REVIEW_ONLY),makeImpact(c2,s1,A.APPLY_SCENARIO_ADJUSTMENT,{adjustmentDirection:D.DECREASE,adjustmentMethod:M.AMOUNT_SAR_PER_SQM,adjustmentMagnitude:200}),makeImpact(c2,s2,A.PROFESSIONAL_SCENARIO_EXCLUSION)];
function args(patch={},policyPatch={}){
 const input={asOf,comparables:[c1,c2],shockEvidence:[s1,s2],impacts,...patch};
 return {...input,reviewPolicy:createPolicyShockReviewPolicy({policyId:'SYNTH-POLICY',caseId,marketScopeRef,allowedShockClasses:Object.values(C),allowedImpactActions:Object.values(A),comparableHashesSha256:[...new Set(input.comparables.map(x=>x.comparableHashSha256))],shockEvidenceHashesSha256:[...new Set(input.shockEvidence.map(x=>x.shockEvidenceHashSha256))],impactHashesSha256:[...new Set(input.impacts.map(x=>x.impactHashSha256))],requireFullComparableShockMatrix:true,targetAssetType:'OFFICE',targetCity:'SYNTH-CITY',targetTransactionType:'SALE',maxAgeDays:90,reviewedByRef:'SYNTH-REVIEWER',reviewEvidenceRef:'SYNTH-POLICY-REVIEW',reviewedAt:'2026-10-11',validUntil:'2026-12-31',...policyPatch})};
}
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
