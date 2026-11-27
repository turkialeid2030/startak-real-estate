'use strict';
const assert=require('node:assert/strict');
const a=require('../../src/market/governed-market-interpretation'),b=require('../../src/market/governed-policy-shock-comparable-impact'),m=require('../../src/market/market-evidence-governance'),c=require('../../src/market/comparable-evidence');
const asOf='2026-09-29T18:00:00Z',before='2026-09-29T12:00:00Z',later='2026-09-29T14:00:00Z',future='2026-10-29T00:00:00Z',scope={marketContextId:'M',geographyKey:'G',assetType:'OFFICE'},type='SALE_PRICE_INDEX';
const rec={...scope,id:'I',evidenceType:type,evidenceClass:'AUTHORITATIVE_AGGREGATE',normalizedValue:{indexValue:110,unit:'index'},sourceId:'GASTAT_REAL_ESTATE_INDICES',sourceReference:'SYNTH',sourceUrl:'https://www.stats.gov.sa/',seriesKey:'SERIES',periodKey:'2026Q2',resolutionMethod:'OFFICIAL_PUBLISHED_INDICATOR',verificationStatus:'VERIFIED',verifiedBy:'R',verificationReference:'V',freshnessPolicyId:'F',effectiveAt:'2026-06-30',observedAt:before,validUntil:future};
function af(rulePatch={},policyPatch={},inputPatch={}){
 const marketEvidenceInput={...scope,asOf,evidenceRecords:[rec],requiredEvidenceTypes:[type],trustedVerifierIds:['R'],governedFreshnessPolicyIds:['F'],minimumCountPolicyId:'MP',governedMinimumCountPolicies:{MP:{[type]:1}},...inputPatch};
 const p={version:a.POLICY_VERSION,policyId:'P',...scope,marketEvidenceHash:a.computeMarketEvidenceHash(m.evaluateMarketEvidenceBundle(marketEvidenceInput)),reviewedBy:'R',reviewReference:'REF',reviewedAt:later,rules:[{ruleId:'RULE',dimension:'SALE_MARKET_MOVEMENT',evidenceId:'I',evidenceType:type,metricField:'indexValue',unitField:'unit',expectedUnit:'index',bands:[{bandId:'L',label:'BELOW',minInclusive:null,maxExclusive:110},{bandId:'H',label:'AT_OR_ABOVE',minInclusive:110,maxExclusive:null}],...rulePatch}],...policyPatch};p.policyHash=a.computeMarketInterpretationPolicyHash(p);
 return {...scope,marketEvidenceInput,interpretationPolicyId:'P',governedInterpretationPolicies:{P:p}};
}
let checks=0;function run(fn,x,status){const o=fn(x);assert.equal(o.status,status,JSON.stringify(o.blockers));for(const k of ['sourceAuthenticityIndependentlyVerified','transactionAuthorized','approvalAuthorized','certifiedValuationEstablished'])assert.equal(o[k],false);checks++;return o;}
const A=a.MARKET_INTERPRETATION_STATUS,fa=a.evaluateGovernedMarketInterpretation,av=af();
assert.equal(run(fa,av,A.READY_FOR_PROFESSIONAL_MARKET_REVIEW).interpretations[0].bandId,'H');
run(fa,af({expectedUnit:'SAR'}),A.HOLD_UNIT_COMPATIBILITY);
run(fa,af({evidenceId:'OTHER'}),A.HOLD_EVIDENCE_BINDING);
run(fa,af({metricField:'missing'}),A.HOLD_METRIC);
run(fa,af({dimension:'UNKNOWN'}),A.HOLD_POLICY);
run(fa,af({bands:[{bandId:'A',label:'A',minInclusive:null,maxExclusive:120},{bandId:'B',label:'B',minInclusive:100,maxExclusive:null}]}),A.HOLD_POLICY);
run(fa,af({}, {reviewedAt:'2026-09-28'}),A.HOLD_EVIDENCE_BINDING);
run(fa,{...av,geographyKey:'OTHER'},A.HOLD_EVIDENCE_BINDING);
run(fa,af({}, {},{evidenceRecords:[]}),A.HOLD_UPSTREAM_EVIDENCE);
run(fa,null,A.HOLD_INTEGRITY);
const ctx={caseId:'SYNTH-C',marketScopeRef:'SYNTH-M'},H='a'.repeat(64),meta={...ctx,reviewedByRef:'R',reviewEvidenceRef:'RE',reviewedAt:before,validUntil:future};
function comp(id='C',patch={}){return c.createComparableEvidenceRecord({caseId:ctx.caseId,comparableId:id,sourcePropertyRef:'PROP-'+id,assetType:'OFFICE',transactionType:'SALE',evidenceLevel:'VERIFIED_TRANSACTION',sourceName:'SYNTH',sourceRef:'S-'+id,sourceDate:'2026-09-20',transactionDate:'2026-09-19',capturedAt:before,location:{city:'SYNTH-CITY',district:'D'},areaSqm:100,amountSar:100000,verification:{status:'VERIFIED',verifiedByRef:'R',verifiedAt:'2026-09-21',evidenceRef:'V'},...patch});}
function shock(patch={}){return b.createPolicyShockEvidence({...meta,shockEvidenceId:'SH',shockClass:'TRANSFER_COST_TAX_OR_FEE',evidenceState:'SATISFIED',sourceCapability:'SYNTH',sourceRecordId:'S',sourceRecordHashSha256:H,sourceStatus:'EXTERNAL_LABEL',sourceReference:'DOC',knownAt:'2026-09-20',effectiveAt:'2026-10-01',...patch});}
function bf(comparables=[comp()],shockEvidence=[shock()],impactPatch={},policyPatch={}){
 const i=b.createProfessionalComparableImpact({...meta,reviewedAt:later,impactId:'I',comparableId:comparables[0].comparableId,comparableHashSha256:comparables[0].comparableHashSha256,shockEvidenceHashSha256:shockEvidence[0].shockEvidenceHashSha256,action:'APPLY_SCENARIO_ADJUSTMENT',adjustmentDirection:'DECREASE',adjustmentMethod:'PERCENT_OF_BASE',adjustmentMagnitude:0.1,preparedByRef:'R',preparedAt:later,rationaleRef:'RATIONALE',...impactPatch});
 const p=b.createPolicyShockReviewPolicy({...meta,reviewedAt:later,policyId:'P',allowedShockClasses:['TRANSFER_COST_TAX_OR_FEE'],allowedImpactActions:Object.values(b.IMPACT_ACTION),shockEvidenceHashesSha256:shockEvidence.map(s=>s.shockEvidenceHashSha256),comparableHashesSha256:comparables.map(c=>c.comparableHashSha256),impactHashesSha256:[i.impactHashSha256],requireFullComparableShockMatrix:true,...policyPatch});
 return {...ctx,asOf,comparables,shockEvidence,impacts:[i],reviewPolicy:p};
}
const B=b.REVIEW_STATUS,fb=b.evaluateGovernedPolicyShockComparableImpact,bv=bf(),ready=B.READY_FOR_PROFESSIONAL_POLICY_SHOCK_REVIEW;
const ok=run(fb,bv,ready);assert.equal(ok.scenarioImpacts[0].scenarioUnitValueSarPerSqm,900);
assert.equal(run(fb,bf(undefined,undefined,{action:'REVIEW_ONLY',adjustmentDirection:null,adjustmentMethod:null,adjustmentMagnitude:null}),ready).scenarioImpacts[0].scenarioUnitValueSarPerSqm,null);
run(fb,bf(undefined,undefined,{adjustmentMagnitude:2}),B.HOLD_CALCULATION);
run(fb,bf([comp(),comp('C2')]),B.HOLD_COVERAGE);
run(fb,bf([comp(),comp('C2',{assetType:'LAND'})]),B.HOLD_CONTEXT);
run(fb,bf(undefined,[shock({evidenceState:'UNRESOLVED',unresolvedReasonRef:'U'})]),B.HOLD_EVIDENCE);
run(fb,bf(undefined,undefined,{preparedAt:'2026-09-28'}),B.HOLD_WINDOW);
run(fb,{...bv,caseId:'OTHER'},B.HOLD_CONTEXT);
run(fb,{...bv,comparables:[]},B.HOLD_EVIDENCE);
run(fb,bf([comp('C',{evidenceLevel:'VERIFIED_OFFER'})]),B.HOLD_INTEGRITY);
run(fb,null,B.HOLD_INTEGRITY);
assert.throws(()=>bf(undefined,undefined,{}, {requireFullComparableShockMatrix:false}),/C19_POLICY_FULL_MATRIX_BOOLEAN_REQUIRED/);
let reads=0;const bad=Object.defineProperty({},'reviewPolicy',{enumerable:true,get(){reads++;return bv.reviewPolicy;}});run(fb,bad,B.HOLD_INTEGRITY);assert.equal(reads,0);
console.log('C10_C19_MARKET_SCENARIO_RECOVERY=PASS cases='+checks+' synthetic=true sourceAuthority=false');
