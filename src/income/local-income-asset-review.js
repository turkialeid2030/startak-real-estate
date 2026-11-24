'use strict';
const {createLeaseEvidenceCore}=require('../market/lease-income-evidence-core');
const {createContractualIncomeReviewCore}=require('./contractual-income-asset-review-core');
const MAX_BYTES=2*1024*1024;
const hold=code=>({status:'HOLD_LOCAL_INCOME_REVIEW',blockers:[code],metrics:null,tenants:[],expiryConcentration:[],riskFlags:[],transactionAuthorized:false,approvalAuthorized:false,sourceAuthenticityIndependentlyVerified:false});
function stable(v){if(Array.isArray(v))return v.map(stable);if(!v||typeof v!=='object')return v;return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));}
function payload(v,k){if(!v||typeof v!=='object'||Array.isArray(v))throw Error('invalid record');const x={...v};delete x[k];return JSON.stringify(stable(x));}
async function reviewLocalIncomeAsset({text,expectedCaseId,expectedPropertyRef,asOfDate}={}){
 try{
  if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_BYTES)return hold('C11_FILE_LIMIT');
  if(!globalThis.crypto?.subtle)return hold('C11_NATIVE_WEB_CRYPTO_REQUIRED');
  const input=JSON.parse(text,(k,v)=>{if(['__proto__','constructor','prototype'].includes(k))throw Error('unsafe key');return v;});
  const p=input?.incomeEvidencePacket,s=input?.rentRollSnapshot,l=input?.leaseRecords,a=input?.tenantStrengthAssessments;
  if(typeof expectedCaseId!=='string'||!expectedCaseId.trim()||typeof expectedPropertyRef!=='string'||!expectedPropertyRef.trim()||typeof asOfDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)||!Number.isFinite(Date.parse(asOfDate))||new Date(asOfDate).toISOString().slice(0,10)!==asOfDate||p?.caseId!==expectedCaseId||p?.propertyRef!==expectedPropertyRef||p?.asOfDate!==asOfDate+'T00:00:00.000Z')return hold('C11_EXPECTED_SCOPE_OR_DATE_MISMATCH');
  if(!Array.isArray(l)||l.length<1||l.length>5000||!Array.isArray(a)||a.length>5000)return hold('C11_RECORD_LIMIT');
  if(typeof input.reviewPolicyId!=='string'||!input.governedReviewPolicies||!Object.hasOwn(input.governedReviewPolicies,input.reviewPolicyId))return hold('C11_POLICY_REQUIRED');
  const policy=input.governedReviewPolicies[input.reviewPolicyId];
  const strings=[payload(p,'incomeEvidencePacketHashSha256'),payload(s,'rentRollHashSha256'),...l.map(x=>payload(x,'leaseEvidenceHashSha256')),...a.map(x=>payload(x,'assessmentHashSha256')),payload(policy,'policyHashSha256')];
  const cache=new Map(),unique=[...new Set(strings)],enc=new TextEncoder();
  for(let i=0;i<unique.length;i+=64)await Promise.all(unique.slice(i,i+64).map(async value=>{
    const digest=await globalThis.crypto.subtle.digest('SHA-256',enc.encode(value));
    cache.set(value,Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join(''));
  }));
  const digest=value=>{if(!cache.has(value))throw Error('canonical replay differs from original evidence');return cache.get(value);};
  const core=createContractualIncomeReviewCore(digest,createLeaseEvidenceCore(digest));
  const result=core.evaluateGovernedIncomeAssetIntelligence({incomeEvidencePacket:p,rentRollSnapshot:s,leaseRecords:l,tenantStrengthAssessments:a,reviewPolicyId:input.reviewPolicyId,governedReviewPolicies:{[input.reviewPolicyId]:policy}});
  return {...result,localResearchOnly:true,sourceAuthenticityIndependentlyVerified:false,transactionAuthorized:false,approvalAuthorized:false};
 }catch{return hold('C11_LOCAL_REVIEW_FAILED');}
}
module.exports={reviewLocalIncomeAsset,MAX_BYTES};
