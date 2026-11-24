'use strict';
const {createMarketEvidenceGovernance}=require('./market-evidence-governance-core');
const {createMarketIndicatorPolicyReview}=require('./market-indicator-policy-review-core');
const MAX_BYTES=2*1024*1024;
const hold=code=>({status:'HOLD_LOCAL_MARKET_REVIEW',blockers:[code],interpretations:[],transactionAuthorized:false,approvalAuthorized:false,sourceAuthenticityIndependentlyVerified:false,liveMarketDataFetched:false});
function stable(v){if(Array.isArray(v))return v.map(stable);if(!v||typeof v!=='object')return v;return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));}
async function reviewLocalMarketIndicators({text,expectedMarketContextId,expectedGeographyKey,expectedAssetType,asOfDate}={}){
 try{
  if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_BYTES)return hold('C10_FILE_LIMIT');
  if(!globalThis.crypto?.subtle)return hold('C10_NATIVE_WEB_CRYPTO_REQUIRED');
  const input=JSON.parse(text,(k,v)=>{if(['__proto__','constructor','prototype'].includes(k))throw Error('unsafe key');return v;});
  const x=input?.marketEvidenceInput;
  if(![expectedMarketContextId,expectedGeographyKey,expectedAssetType,asOfDate].every(v=>typeof v==='string'&&v.trim())||x?.marketContextId!==expectedMarketContextId||x?.geographyKey!==expectedGeographyKey||x?.assetType!==expectedAssetType||x?.asOf!==asOfDate)return hold('C10_EXPECTED_SCOPE_OR_DATE_MISMATCH');
  if(!Array.isArray(x.evidenceRecords)||x.evidenceRecords.length<1||x.evidenceRecords.length>5000)return hold('C10_RECORD_LIMIT');
  const id=input.interpretationPolicyId;
  if(typeof id!=='string'||!input.governedInterpretationPolicies||!Object.hasOwn(input.governedInterpretationPolicies,id))return hold('C10_POLICY_REQUIRED');
  const policy=input.governedInterpretationPolicies[id],policyPayload={...policy};delete policyPayload.policyHash;
  const cache=new Map(),enc=new TextEncoder(),serialize=v=>JSON.stringify(stable(v));
  async function precompute(strings){const unique=[...new Set(strings.filter(s=>typeof s==='string'&&!cache.has(s)))];for(let i=0;i<unique.length;i+=64)await Promise.all(unique.slice(i,i+64).map(async value=>{
    const digest=await globalThis.crypto.subtle.digest('SHA-256',enc.encode(value));
    cache.set(value,Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join(''));
  }));}
  const digest=value=>{if(!cache.has(value))throw Error('unverified digest');return cache.get(value);};
  const strings=[serialize(policyPayload)];
  for(const r of x.evidenceRecords){
   if(!r||typeof r!=='object'||r.normalizedValue==null)continue;
   strings.push(serialize(r.normalizedValue));
   const ms=Date.parse(r.effectiveAt);
   if(Number.isFinite(ms))strings.push(serialize({normalizedValue:r.normalizedValue,effectiveAt:new Date(ms).toISOString()}));
  }
  await precompute(strings);
  const governance=createMarketEvidenceGovernance(digest);
  const upstream=governance.evaluateMarketEvidenceBundle(x);
  await precompute([serialize(upstream)]);
  const core=createMarketIndicatorPolicyReview(digest,governance);
  const result=core.evaluateGovernedMarketInterpretation({marketEvidenceInput:x,interpretationPolicyId:id,governedInterpretationPolicies:{[id]:policy}});
  return {...result,localResearchOnly:true,transactionAuthorized:false,approvalAuthorized:false,sourceAuthenticityIndependentlyVerified:false,liveMarketDataFetched:false};
 }catch{return hold('C10_LOCAL_REVIEW_FAILED');}
}
module.exports={reviewLocalMarketIndicators,MAX_BYTES};
