'use strict';
const {createQuotedFinancingComparison}=require('./quoted-financing-comparison-core');
const MAX_BYTES=2*1024*1024;
const STATUS='HOLD_LOCAL_FINANCING_REVIEW';
function hold(code){return {status:STATUS,blockers:[code],offers:[],analyticalOrdering:[],riskFlags:[],transactionAuthorized:false,approvalAuthorized:false,sourceAuthenticityIndependentlyVerified:false};}
function stable(value){
 if(Array.isArray(value))return value.map(stable);
 if(!value||typeof value!=='object')return value;
 return Object.keys(value).sort().reduce((out,k)=>{out[k]=stable(value[k]);return out;},{});
}
function payload(value,hashField){
 const copy={...value};delete copy[hashField];return JSON.stringify(stable(copy));
}
async function reviewLocalQuotedFinancing({text,expectedCaseId,expectedPropertyRef,asOfDate}={}){
 try{
  if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_BYTES)return hold('C14_FILE_LIMIT');
  if(!globalThis.crypto?.subtle)return hold('C14_NATIVE_WEB_CRYPTO_REQUIRED');
  const input=JSON.parse(text,(k,v)=>{if(['__proto__','constructor','prototype'].includes(k))throw Error('unsafe key');return v;});
  if(typeof expectedCaseId!=='string'||!expectedCaseId.trim()||typeof expectedPropertyRef!=='string'||!expectedPropertyRef.trim()||
    input?.caseId!==expectedCaseId||input?.propertyRef!==expectedPropertyRef||input?.asOfDate!==asOfDate)return hold('C14_EXPECTED_SCOPE_OR_DATE_MISMATCH');
  if(!Array.isArray(input.financingOffers)||input.financingOffers.length<2||input.financingOffers.length>50||
   input.financingOffers.some(o=>!o||!Array.isArray(o.repaymentSchedule)||o.repaymentSchedule.length>1200))return hold('C14_OFFER_LIMIT');
  const registry=input.governedComparisonPolicies;
  if(typeof input.comparisonPolicyId!=='string'||!registry||!Object.hasOwn(registry,input.comparisonPolicyId))return hold('C14_POLICY_REQUIRED');
  const policy=registry[input.comparisonPolicyId];
  const strings=[...input.financingOffers.map(o=>payload(o,'financingOfferHashSha256')),payload(policy,'policyHashSha256')];
  const cache=new Map();
  await Promise.all(strings.map(async s=>{
   const digest=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));
   cache.set(s,Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join(''));
  }));
  const core=createQuotedFinancingComparison(s=>{if(!cache.has(s))throw Error('unverified digest');return cache.get(s);});
  const result=core.evaluateGovernedFinancingOptions({
   caseId:input.caseId,propertyRef:input.propertyRef,asOfDate:input.asOfDate,targetFundingDate:input.targetFundingDate,
   financingOffers:input.financingOffers,comparisonPolicyId:input.comparisonPolicyId,governedComparisonPolicies:{[input.comparisonPolicyId]:policy}
  });
  return {...result,localResearchOnly:true,sourceAuthenticityIndependentlyVerified:false,transactionAuthorized:false,approvalAuthorized:false};
 }catch{return hold('C14_LOCAL_REVIEW_FAILED');}
}
module.exports={reviewLocalQuotedFinancing,MAX_BYTES};
