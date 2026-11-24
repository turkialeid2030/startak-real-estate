'use strict';
const {createComparableEvidenceCore}=require('./comparable-evidence-core');
const {createPolicyShockScenarioCore}=require('./policy-shock-scenario-review-core');
const MAX_BYTES=2*1024*1024;
const hold=code=>({status:'HOLD_LOCAL_POLICY_SHOCK_REVIEW',blockers:[code],warnings:[],scenarioImpacts:[],researchOnly:true,transactionAuthorized:false,approvalAuthorized:false,productionAuthorized:false,sourceAuthenticityIndependentlyVerified:false,policyApplicabilityIndependentlyVerified:false});
function stable(v){if(Array.isArray(v))return v.map(stable);if(!v||typeof v!=='object')return v;return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));}
function payload(v,k){if(!v||typeof v!=='object'||Array.isArray(v))throw Error('invalid record');const x={...v};delete x[k];return JSON.stringify(stable(x));}
async function reviewLocalPolicyShock({text,expectedCaseId,expectedMarketScopeRef,expectedAssetType,expectedCity,expectedTransactionType,asOfDate}={}){
 try{
  if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_BYTES)return hold('C19_FILE_LIMIT');
  if(!globalThis.crypto?.subtle)return hold('C19_NATIVE_WEB_CRYPTO_REQUIRED');
  const input=JSON.parse(text,(k,v)=>{if(['__proto__','constructor','prototype'].includes(k))throw Error('unsafe key');return v;});
  const p=input?.reviewPolicy,c=input?.comparables,s=input?.shockEvidence,i=input?.impacts;
  if(![expectedCaseId,expectedMarketScopeRef,expectedAssetType,expectedCity,expectedTransactionType,asOfDate].every(v=>typeof v==='string'&&v.trim())||!['SALE','RENT'].includes(expectedTransactionType)||p?.caseId!==expectedCaseId||p?.marketScopeRef!==expectedMarketScopeRef||p?.targetAssetType!==expectedAssetType||p?.targetCity!==expectedCity||p?.targetTransactionType!==expectedTransactionType||input.asOf!==asOfDate)return hold('C19_EXPECTED_SCOPE_OR_DATE_MISMATCH');
  if(![c,s,i].every(v=>Array.isArray(v)&&v.length>0&&v.length<=5000)||c.length*s.length>5000)return hold('C19_RECORD_LIMIT');
  const strings=[payload(p,'policyHashSha256'),...c.map(v=>payload(v,'comparableHashSha256')),...s.map(v=>payload(v,'shockEvidenceHashSha256')),...i.map(v=>payload(v,'impactHashSha256')),...c.map(v=>JSON.stringify(stable({sourcePropertyRef:v.sourcePropertyRef,transactionType:v.transactionType,transactionDate:v.transactionDate,areaSqm:v.areaSqm,amountSar:v.amountSar})))];
  const cache=new Map(),unique=[...new Set(strings)],enc=new TextEncoder();
  for(let j=0;j<unique.length;j+=64)await Promise.all(unique.slice(j,j+64).map(async value=>{
   const bytes=await globalThis.crypto.subtle.digest('SHA-256',enc.encode(value));
   cache.set(value,Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join(''));
  }));
  const digest=value=>{if(!cache.has(value))throw Error('canonical replay differs');return cache.get(value);};
  const core=createPolicyShockScenarioCore(digest,createComparableEvidenceCore(digest));
  const result=core.evaluateGovernedPolicyShockComparableImpact({reviewPolicy:p,comparables:c,shockEvidence:s,impacts:i,asOf:input.asOf});
  return {...result,localResearchOnly:true,transactionAuthorized:false,approvalAuthorized:false,productionAuthorized:false,sourceAuthenticityIndependentlyVerified:false,policyApplicabilityIndependentlyVerified:false};
 }catch{return hold('C19_LOCAL_REVIEW_FAILED');}
}
module.exports={reviewLocalPolicyShock,MAX_BYTES};
