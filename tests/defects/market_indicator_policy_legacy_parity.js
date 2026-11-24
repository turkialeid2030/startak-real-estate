'use strict';
const assert=require('node:assert/strict');
const {args,scope,records,bands,rules,evaluate,S}=require('../fixtures/synthetic-market-indicators');
const result=evaluate(args());
assert.equal(result.status,S.READY_FOR_PROFESSIONAL_MARKET_REVIEW,JSON.stringify(result.blockers));
assert.deepEqual(result.interpretations.map(x=>[x.evidenceId,x.value,x.bandId]),[['liq',45,'HIGH'],['sale',0.04,'NONNEG'],['rent',-0.02,'NEG']]);
assert.equal(result.interpretations[0].lineage.sourceId,'REGA_REAL_ESTATE_INDICATORS');
for(const k of ['sourceAuthenticityIndependentlyVerified','policyThresholdsIndependentlyValidated','liveMarketDataFetched','askingEvidenceCreatesAuthority','compositeScoreCreated','forecastCreated','transactionAuthorized','approvalAuthorized'])assert.equal(result[k],false);
const failures=[
 args({evidenceRecords:[...records,records[0]]}),
 args({asOf:'2026-02-30'}),
 args({evidenceRecords:[{...records[0],observedAt:'2026-02-30'},...records.slice(1)]}),
 args({evidenceRecords:[{...records[0],validUntil:'2026-10-06'},...records.slice(1)]}),
 args({evidenceRecords:[{...records[0],geographyKey:'OTHER'},...records.slice(1)]}),
 args({evidenceRecords:[{...records[0],sourceUrl:'https://example.com/'},...records.slice(1)]}),
 args({}, {reviewedAt:'2026-11-01'}),
 args({}, {marketEvidenceHash:'a'.repeat(64)}),
 args({}, {rules:[{...rules[0],expectedUnit:'RATIO'}]}),
 args({}, {rules:[{...rules[1],evidenceId:'ask'}]}),
 args({}, {rules:[{...rules[0],bands:[{...bands[0],maxExclusive:46},bands[1]]}]}),
 args({}, {rules:[{...rules[0],bands:[{...bands[0],maxExclusive:44},{...bands[1],minInclusive:46}]}]}),
 args({}, {rules:[{...rules[0],dimension:'constructor'}]}),
];
for(const bad of failures){const x=evaluate(bad);assert.notEqual(x.status,S.READY_FOR_PROFESSIONAL_MARKET_REVIEW);assert.deepEqual(x.interpretations,[]);assert.equal(x.transactionAuthorized,false);}
const tampered=args();tampered.governedInterpretationPolicies.POLICY.rules=[{...rules[0],expectedUnit:'RATIO'}];assert.equal(evaluate(tampered).status,S.HOLD_INTEGRITY);
console.log('C10_MARKET_INDICATOR_POLICY_REVIEW=PASS synthetic_only=true negative_cases='+ (failures.length+1));

const {reviewLocalMarketIndicators}=require('../../src/market/local-market-indicator-review');
(async()=>{
 const opts={expectedMarketContextId:scope.marketContextId,expectedGeographyKey:scope.geographyKey,expectedAssetType:scope.assetType,asOfDate:'2026-10-31'};
 const local=await reviewLocalMarketIndicators({...opts,text:JSON.stringify({...args(),report:{transactionAuthorized:true}})});
 assert.equal(local.status,result.status,JSON.stringify(local.blockers));
 assert.deepEqual(local.interpretations,result.interpretations);
 assert.equal(local.marketEvidenceHash,result.marketEvidenceHash);
 assert.equal(local.transactionAuthorized,false);
 for(const bad of [...failures,tampered]){
  const h=await reviewLocalMarketIndicators({...opts,text:JSON.stringify(bad)});
  assert.notEqual(h.status,S.READY_FOR_PROFESSIONAL_MARKET_REVIEW);
  assert.deepEqual(h.interpretations,[]);
  assert.equal(h.transactionAuthorized,false);
 }
 const wrong=await reviewLocalMarketIndicators({...opts,expectedGeographyKey:'OTHER',text:JSON.stringify(args())});
 assert.equal(wrong.blockers[0],'C10_EXPECTED_SCOPE_OR_DATE_MISMATCH');
 console.log('C10_NATIVE_WEBCRYPTO_PARITY=PASS synthetic_only=true');
})().catch(e=>{console.error(e);process.exitCode=1;});
