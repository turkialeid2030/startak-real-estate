'use strict';
const {calculateCostApproachCore,canonicalCostSerialization}=require('../engines/valuation/cost-approach-core');
const {assessCostDepreciationCore,canonicalAttributionSerialization,STATUS}=require('./component-depreciation-review-core');
const MAX_BYTES=2*1024*1024;
const ready='READY_FOR_CANONICAL_COST_CALCULATION';
const fields=['schemaVersion','packetId','caseId','propertyRef','valuationDate','propertyEvidencePacketHashSha256','costComponents','landValueInput','depreciationRecords','allowedCostSourceClasses','maxCostSourceAgeDays','preparedByRef','preparedAt','packetEvidenceRef'];
const types=['PHYSICAL_CURABLE','PHYSICAL_INCURABLE','FUNCTIONAL_CURABLE','FUNCTIONAL_INCURABLE','EXTERNAL_OBSOLESCENCE'];
const filled=x=>typeof x==='string'&&x.trim().length>0&&x.length<=1024;
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/i.test(x);
const finitePositive=x=>typeof x==='number'&&Number.isFinite(x)&&x>0;
function reject(code){return {status:STATUS.HOLD,blockers:[code],sourceAuthenticityIndependentlyVerified:false,transactionAuthorized:false,certifiedValuationEstablished:false,productionDecisionAuthorized:false};}
async function digest(serialized){
 if(!globalThis.crypto?.subtle)throw Error('NATIVE_WEB_CRYPTO_REQUIRED');
 const bytes=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(serialized));
 return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
}
function parseReviewFile(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_BYTES)throw Error('C59_FILE_SIZE_INVALID');
 return JSON.parse(text,(key,value)=>{
  if(['__proto__','constructor','prototype'].includes(key))throw Error('C59_UNSAFE_KEY');
  return value;
 });
}
function validPacket(p){
 if(!p||p.schemaVersion!==1||p.status!==ready||p.readyForCanonicalCostCalculation!==true||
 ![p.caseId,p.propertyRef,p.packetId,p.valuationDate,p.preparedAt,p.preparedByRef,p.packetEvidenceRef].every(filled)||
 !hash(p.propertyEvidencePacketHashSha256)||!hash(p.costApproachInputPacketHashSha256)||
 !Array.isArray(p.costComponents)||p.costComponents.length<1||p.costComponents.length>500||
 !Array.isArray(p.depreciationRecords)||p.depreciationRecords.length>5||
 !Array.isArray(p.allowedCostSourceClasses)||p.allowedCostSourceClasses.length===0||
 !Number.isInteger(p.maxCostSourceAgeDays)||p.maxCostSourceAgeDays<0||
 !finitePositive(p.landValueInput?.valueSar)||!hash(p.landValueInput?.landValueInputHashSha256))return false;
 const unique=(rows,key)=>new Set(rows.map(x=>x[key])).size===rows.length;
 return p.costComponents.every(c=>c&&filled(c.componentId)&&filled(c.componentClass)&&finitePositive(c.quantity)&&finitePositive(c.unitCostSar)&&hash(c.costComponentHashSha256))&&
 unique(p.costComponents,'componentId')&&p.depreciationRecords.every(d=>d&&filled(d.depreciationId)&&types.includes(d.type)&&
 ['AMOUNT_SAR','PERCENT_OF_IMPROVEMENT_COST_NEW'].includes(d.method)&&typeof d.magnitude==='number'&&Number.isFinite(d.magnitude)&&d.magnitude>=0&&
 (d.method!=='PERCENT_OF_IMPROVEMENT_COST_NEW'||d.magnitude<=1)&&hash(d.depreciationHashSha256))&&unique(p.depreciationRecords,'depreciationId')&&unique(p.depreciationRecords,'type');
}
async function reviewLocalDepreciation({text,expectedCaseId,expectedPropertyRef,asOf=new Date().toISOString()}={}){
 try{
  const input=parseReviewFile(text);
  const p=input?.packet;
  if(!filled(expectedCaseId)||!filled(expectedPropertyRef)||p?.caseId!==expectedCaseId||p?.propertyRef!==expectedPropertyRef)return reject('C59_EXPECTED_SCOPE_MISMATCH');
  if(!validPacket(p))return reject('C59_INVALID_PACKET_SHAPE');
  const core=Object.fromEntries(fields.map(k=>[k,p[k]]));
  if(await digest(canonicalCostSerialization(core))!==p.costApproachInputPacketHashSha256.toLowerCase())return reject('INVALID_CANONICAL_COST_INPUT_PACKET');
  if(!Array.isArray(input.allocations)||input.allocations.length>2500||!Array.isArray(input.omissionReviews)||input.omissionReviews.length>5||
    (input.ageLifeChecks!==undefined&&(!Array.isArray(input.ageLifeChecks)||input.ageLifeChecks.length>500)))return reject('C59_REVIEW_INPUT_LIMIT');
  let old=calculateCostApproachCore(p,true,x=>digest(canonicalCostSerialization(x)));
  if(old.calculationHashSha256)old={...old,calculationHashSha256:await old.calculationHashSha256};
  let result=assessCostDepreciationCore({packet:p,allocations:input.allocations,omissionReviews:input.omissionReviews,ageLifeChecks:input.ageLifeChecks||[],asOf},old,true,x=>digest(canonicalAttributionSerialization(x)));
  if(result.resultHashSha256)result={...result,resultHashSha256:await result.resultHashSha256};
  // Self-consistency is not identity, authenticity or professional review.
  return {...result,localResearchOnly:true,sourceAuthenticityIndependentlyVerified:false,transactionAuthorized:false,certifiedValuationEstablished:false,productionDecisionAuthorized:false};
 }catch{return reject('C59_LOCAL_REVIEW_FAILED');}
}
module.exports={reviewLocalDepreciation,MAX_BYTES,STATUS};
