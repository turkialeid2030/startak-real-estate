'use strict';
const assert=require('node:assert/strict');
const {MARKET_EVIDENCE_TYPE:T,expectedEvidenceClassForType}=require('../../src/contracts/market-evidence');
const {evaluateMarketEvidenceBundle}=require('../../src/market/market-evidence-governance');
const {MARKET_INTERPRETATION_STATUS:S,MARKET_INTERPRETATION_DIMENSION:D,POLICY_VERSION,computeMarketEvidenceHash,computeMarketInterpretationPolicyHash,evaluateGovernedMarketInterpretation:evaluate}=require('../../src/market/market-indicator-policy-review');
const scope={marketContextId:'SYNTH-C10',geographyKey:'SYNTH-GEO',assetType:'OFFICE'};
const make=(id,evidenceType,normalizedValue,patch={})=>({...scope,id,evidenceType,evidenceClass:expectedEvidenceClassForType(evidenceType),normalizedValue,sourceId:'REGA_REAL_ESTATE_INDICATORS',sourceReference:'SYNTHETIC-NOT-PUBLISHED-DATA',sourceUrl:'https://rei.rega.gov.sa/ar',seriesKey:id,periodKey:'SYNTH-2026',resolutionMethod:'OFFICIAL_PUBLISHED_INDICATOR',verificationStatus:'VERIFIED',verifiedBy:'SYNTH-REVIEWER',verificationReference:'SYNTH-VERIFICATION',freshnessPolicyId:'SYNTH-FRESHNESS',effectiveAt:'2026-09-30',observedAt:'2026-10-05',validUntil:'2026-12-31',...patch});
const records=[make('liq',T.MARKET_LIQUIDITY_INDICATOR,{days:45,unit:'DAYS'}),make('sale',T.SALE_PRICE_INDEX,{change:0.04,unit:'RATIO'}),make('rent',T.RENT_INDEX,{change:-0.02,unit:'RATIO'}),make('ask',T.ASKING_SALE_LISTING,{change:0.99,unit:'RATIO'},{resolutionMethod:'COMMERCIAL_LISTING',verificationStatus:'UNVERIFIED'})];
const bands=[{bandId:'LOW',label:'Synthetic lower band',minInclusive:null,maxExclusive:45},{bandId:'HIGH',label:'Synthetic upper band',minInclusive:45,maxExclusive:null}];
const movement=[{bandId:'NEG',label:'Synthetic negative change',minInclusive:null,maxExclusive:0},{bandId:'NONNEG',label:'Synthetic nonnegative change',minInclusive:0,maxExclusive:null}];
const rules=[{ruleId:'L',dimension:D.LIQUIDITY,evidenceId:'liq',evidenceType:T.MARKET_LIQUIDITY_INDICATOR,metricField:'days',unitField:'unit',expectedUnit:'DAYS',bands},{ruleId:'S',dimension:D.SALE_MARKET_MOVEMENT,evidenceId:'sale',evidenceType:T.SALE_PRICE_INDEX,metricField:'change',unitField:'unit',expectedUnit:'RATIO',bands:movement},{ruleId:'R',dimension:D.RENT_MARKET_MOVEMENT,evidenceId:'rent',evidenceType:T.RENT_INDEX,metricField:'change',unitField:'unit',expectedUnit:'RATIO',bands:movement}];
function args(patch={},policyPatch={}){
 const input={...scope,asOf:'2026-10-31',evidenceRecords:records,requiredEvidenceTypes:[T.MARKET_LIQUIDITY_INDICATOR,T.SALE_PRICE_INDEX,T.RENT_INDEX],trustedVerifierIds:['SYNTH-REVIEWER'],governedFreshnessPolicyIds:['SYNTH-FRESHNESS'],minimumCountPolicyId:'MIN',governedMinimumCountPolicies:{MIN:{[T.MARKET_LIQUIDITY_INDICATOR]:1,[T.SALE_PRICE_INDEX]:1,[T.RENT_INDEX]:1}},...patch};
 let marketEvidenceHash;
 try{marketEvidenceHash=computeMarketEvidenceHash(evaluateMarketEvidenceBundle(input));}catch{marketEvidenceHash=null;}
 const policy={version:POLICY_VERSION,policyId:'POLICY',...scope,marketEvidenceHash,reviewedBy:'SYNTH-REVIEWER',reviewReference:'SYNTH-POLICY',reviewedAt:'2026-10-20',rules,...policyPatch};
 policy.policyHash=computeMarketInterpretationPolicyHash(policy);
 return {marketEvidenceInput:input,interpretationPolicyId:'POLICY',governedInterpretationPolicies:{POLICY:policy}};
}
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
