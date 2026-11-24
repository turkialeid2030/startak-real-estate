'use strict';
const {createUrbanGrowthAccessibilityCore}=require('./urban-growth-accessibility-review-core');
const MAX_BYTES=2*1024*1024;
const hold=code=>({status:'HOLD_LOCAL_URBAN_GROWTH_REVIEW',blockers:[code],riskFlags:[],review:null,researchOnly:true,sourceAuthenticityIndependentlyVerified:false,measurementComparabilityIndependentlyVerified:false,liveGeospatialDataFetched:false,transactionAuthorized:false,approvalAuthorized:false,productionAuthorized:false});
function stable(v){if(Array.isArray(v))return v.map(stable);if(!v||typeof v!=='object')return v;return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));}
function payload(v,k){if(!v||typeof v!=='object'||Array.isArray(v))throw Error('invalid record');const x={...v};delete x[k];return JSON.stringify(stable(x));}
async function reviewLocalUrbanGrowth({text,expectedCaseId,expectedPropertyRef,expectedMarketScopeRef,asOfDate}={}){
 try{
  if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_BYTES)return hold('C20_FILE_LIMIT');
  if(!globalThis.crypto?.subtle)return hold('C20_NATIVE_WEB_CRYPTO_REQUIRED');
  const input=JSON.parse(text,(k,v)=>{if(['__proto__','constructor','prototype'].includes(k))throw Error('unsafe key');return v;});
  const p=input?.reviewPolicy,e=input?.evidence,a=input?.pairs;
  if(![expectedCaseId,expectedPropertyRef,expectedMarketScopeRef,asOfDate].every(v=>typeof v==='string'&&v.trim())||p?.caseId!==expectedCaseId||p?.propertyRef!==expectedPropertyRef||p?.marketScopeRef!==expectedMarketScopeRef||input.asOf!==asOfDate)return hold('C20_EXPECTED_SCOPE_OR_DATE_MISMATCH');
  if(!Array.isArray(e)||e.length<2||e.length>5000||!Array.isArray(a)||a.length<1||a.length>2500)return hold('C20_RECORD_LIMIT');
  const strings=[payload(p,'policyHashSha256'),...e.map(v=>payload(v,'evidenceHashSha256')),...a.map(v=>payload(v,'pairHashSha256'))];
  const cache=new Map(),unique=[...new Set(strings)],enc=new TextEncoder();
  for(let j=0;j<unique.length;j+=64)await Promise.all(unique.slice(j,j+64).map(async value=>{
   const bytes=await globalThis.crypto.subtle.digest('SHA-256',enc.encode(value));
   cache.set(value,Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join(''));
  }));
  const digest=value=>{if(!cache.has(value))throw Error('canonical replay differs');return cache.get(value);};
  const result=createUrbanGrowthAccessibilityCore(digest).evaluateGovernedUrbanGrowthAccessibility({reviewPolicy:p,evidence:e,pairs:a,asOf:input.asOf});
  return {...result,localResearchOnly:true,transactionAuthorized:false,approvalAuthorized:false,productionAuthorized:false,sourceAuthenticityIndependentlyVerified:false,measurementComparabilityIndependentlyVerified:false,liveGeospatialDataFetched:false};
 }catch{return hold('C20_LOCAL_REVIEW_FAILED');}
}
module.exports={reviewLocalUrbanGrowth,MAX_BYTES};
