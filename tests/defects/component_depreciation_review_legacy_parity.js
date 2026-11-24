'use strict';
const assert=require('node:assert/strict');
const {calculateCostApproachIndication}=require('../../src/engines/valuation/cost-approach');
const {assessCostDepreciationAttribution:assess,STATUS}=require('../../src/cost/component-depreciation-review');
const {args,scope,asOf,packet,allocations,omissionReviews,ageLifeChecks}=require('../fixtures/synthetic-component-depreciation');
const result=assess(args),canonical=calculateCostApproachIndication(packet);
assert.equal(result.status,STATUS.READY_FOR_INDEPENDENT_PROFESSIONAL_REVIEW);
assert.equal(result.costApproachValueIndicationSar,1250000);
assert.equal(result.costApproachValueIndicationSar,canonical.costApproachValueIndicationSar);
assert.equal(result.canonicalCostResultHashSha256,canonical.calculationHashSha256);
assert.equal(result.accruedDepreciationSar,250000);
assert.equal(result.componentDepreciationTrace.reduce((s,r)=>s+r.residualImprovementValueSar,0),750000);
assert.equal(result.ageLifeDiagnosticOnly[0].estimatedPhysicalLossForDiagnosisOnlySar,140000);
for(const key of ['transactionAuthorized','certifiedValuationEstablished','productionDecisionAuthorized','sourceAuthenticityIndependentlyVerified'])assert.equal(result[key],false);
assert.equal(assess(args).resultHashSha256,result.resultHashSha256);
const cases=[
 [{packet:{...packet,landValueInput:{...packet.landValueInput,valueSar:1}}},'INVALID_CANONICAL_COST_INPUT_PACKET'],
 [{asOf:'2026-02-30'},'ASOF_NOT_VALID_OR_BEFORE_VALUATION'],
 [{asOf:'2026-10-19'},'ASOF_NOT_VALID_OR_BEFORE_VALUATION'],
 [{allocations:[{...allocations[0],caseId:'OTHER'},...allocations.slice(1)]},'ALLOCATION_CASE_OR_PROPERTY_MISMATCH'],
 [{allocations:[{...allocations[0],amountSar:139999},...allocations.slice(1)]},'ALLOCATION_NOT_RECONCILED_TO_CANONICAL_DEPRECIATION'],
 [{allocations:[...allocations,allocations[0]]},'DUPLICATED_CAUSE_ON_SAME_COMPONENT'],
 [{allocations:[...allocations.slice(0,2),{...allocations[2],causeId:'age'}]},'DOUBLE_COUNT_CAUSE_BETWEEN_DEPRECIATION_TYPES'],
 [{allocations:[...allocations.slice(0,2),{...allocations[2],externalMarketImpactRef:''}]},'EXTERNAL_MARKET_IMPACT_EVIDENCE_REQUIRED'],
 [{allocations:[{...allocations[0],reviewedAt:'2026-02-30'},...allocations.slice(1)]},'MISSING_CAUSAL_PROFESSIONAL_EVIDENCE'],
 [{omissionReviews:omissionReviews.slice(1)},'LOSS_CLASS_UNREVIEWED'],
 [{omissionReviews:[{...omissionReviews[0],propertyRef:'OTHER'},...omissionReviews.slice(1)]},'OMISSION_CASE_OR_PROPERTY_MISMATCH'],
 [{ageLifeChecks:[{...ageLifeChecks[0],effectiveAgeYears:51}]},'AGE_LIFE_EVIDENCE_OR_RANGE_INVALID'],
 [{ageLifeChecks:[{...ageLifeChecks[0],propertyRef:'OTHER'}]},'AGE_LIFE_CASE_OR_PROPERTY_MISMATCH'],
];
for(const [patch,code] of cases){const r=assess({...args,...patch});assert.equal(r.status,STATUS.HOLD,code);assert.ok(r.blockers.some(x=>x.startsWith(code)),code);assert.equal(r.transactionAuthorized,false);}
console.log('C59_COMPONENT_DEPRECIATION_PARITY=PASS synthetic_only=true authority=false negative_cases='+cases.length);

const {reviewLocalDepreciation}=require('../../src/cost/local-depreciation-review');
(async()=>{
 const opts={text:JSON.stringify(args),expectedCaseId:scope.caseId,expectedPropertyRef:scope.propertyRef,asOf};
 const local=await reviewLocalDepreciation(opts);
 assert.equal(local.status,result.status);
 assert.equal(local.canonicalCostResultHashSha256,result.canonicalCostResultHashSha256);
 assert.equal(local.resultHashSha256,result.resultHashSha256);
 assert.deepEqual(local.componentDepreciationTrace,result.componentDepreciationTrace);
 assert.equal(local.localResearchOnly,true);
 assert.equal(local.transactionAuthorized,false);
 for(const [patch,code] of cases){
  const candidate={...args,...patch};
  const x=await reviewLocalDepreciation({...opts,text:JSON.stringify(candidate),asOf:candidate.asOf});
  assert.equal(x.status,STATUS.HOLD,code);
  assert.equal(x.costApproachValueIndicationSar,undefined,code);
  assert.equal(x.transactionAuthorized,false,code);
 }
 const wrong=await reviewLocalDepreciation({...opts,expectedPropertyRef:'OTHER'});
 assert.equal(wrong.blockers[0],'C59_EXPECTED_SCOPE_MISMATCH');
 const forged=await reviewLocalDepreciation({...opts,text:JSON.stringify({...args,result:{costApproachValueIndicationSar:1,transactionAuthorized:true}})});
 assert.equal(forged.costApproachValueIndicationSar,result.costApproachValueIndicationSar);
 assert.equal(forged.transactionAuthorized,false);
 const hostile=await reviewLocalDepreciation({...opts,text:'{"__proto__":{"transactionAuthorized":true}}'});
 assert.equal(hostile.status,STATUS.HOLD);
 console.log('C59_NATIVE_WEBCRYPTO_NODE_PARITY=PASS synthetic_only=true browser_ui_not_tested=true');
})().catch(e=>{console.error(e);process.exitCode=1;});
