'use strict';
// Versioned, explicitly linked research sidecar for a validated Saved Deal.
// Keeps canonical economic Saved Deals records/indices completely unchanged.
const {validateSavedDealRecord}=require('../validation/saved-deal-schema');
const {parsePersonalMarketStudy}=require('./market-study-state');
const SIDECAR_KIND='STARTAK_PERSONAL_MARKET_STUDY_SAVED_DEAL_LINK_V1';
const PREFIX='market-study-sidecar:v1:';
const MAX_SIDECAR_CHARS=2_100_000;
function validId(id){
 if(typeof id!=='string'||id.length<1||id.length>128||
   !/^[a-zA-Z0-9_\-.:]+$/.test(id))throw Error('SAVED_DEAL_ID_INVALID');
 return id;
}
function sidecarKey(id){return PREFIX+validId(id);}
async function readCanonicalDeal(storage,dealId){
 if(!storage||typeof storage.get!=='function')throw Error('STORAGE_PROVIDER_REQUIRED');
 const id=validId(dealId);
 const indexRaw=await storage.get('deals-index');
 if(typeof indexRaw!=='string'||indexRaw.length>1_000_000)throw Error('SAVED_DEAL_INDEX_UNAVAILABLE');
 let index;
 try{index=JSON.parse(indexRaw)}catch{throw Error('SAVED_DEAL_INDEX_INVALID');}
 if(!Array.isArray(index)||!index.some(x=>x&&x.id===id))throw Error('SAVED_DEAL_NOT_IN_INDEX');
 const original=await storage.get('deal:'+id);
 if(typeof original!=='string')throw Error('SAVED_DEAL_NOT_FOUND');
 let deal;
 try{deal=JSON.parse(original)}catch{throw Error('SAVED_DEAL_JSON_INVALID');}
 validateSavedDealRecord(deal);
 if(deal.id!==undefined&&deal.id!==id)throw Error('SAVED_DEAL_ID_MISMATCH');
 return {deal,id};
}
function subjectCompatible(studySubject,mode){
 if(mode==='land'&&studySubject.assetType!=='LAND')throw Error('SAVED_DEAL_SUBJECT_TYPE_MISMATCH');
 if(mode==='building'&&studySubject.assetType==='LAND')throw Error('SAVED_DEAL_SUBJECT_TYPE_MISMATCH');
}
async function saveResearchSidecar({storage,dealId,studyJson,clock=()=>new Date()}){
 if(!storage||typeof storage.set!=='function')throw Error('STORAGE_PROVIDER_NOT_WRITABLE');
 const {deal,id}=await readCanonicalDeal(storage,dealId);
 const restored=parsePersonalMarketStudy(studyJson).study;
 subjectCompatible(restored.subject,deal.mode);
 const timestamp=clock().toISOString();
 const envelope={
  schemaVersion:1,kind:SIDECAR_KIND,
  dealId:id,dealMode:deal.mode,
  savedAt:timestamp,
  researchScope:'PERSONAL_UNVERIFIED_INPUTS_ONLY',
  certification:'NOT_AUTHORIZED',
  studyInputs:restored,
 };
 const encoded=JSON.stringify(envelope);
 if(encoded.length>MAX_SIDECAR_CHARS)throw Error('SIDECAR_LIMIT');
 // Explicit, noncanonical storage. No writes to deal:<id> or deals-index.
 await storage.set(sidecarKey(id),encoded);
 const reread=await storage.get(sidecarKey(id));
 if(reread!==encoded)throw Error('SIDECAR_PERSISTENCE_NOT_VERIFIED');
 return {linked:true,dealId:id,dealMode:deal.mode,savedAt:timestamp,
   researchScope:envelope.researchScope,canonicalDealUntouched:true};
}
async function loadResearchSidecar({storage,dealId}){
 const {deal,id}=await readCanonicalDeal(storage,dealId);
 const raw=await storage.get(sidecarKey(id));
 if(raw===null||raw===undefined)return {found:false,dealId:id};
 if(typeof raw!=='string'||raw.length>MAX_SIDECAR_CHARS)throw Error('SIDECAR_INVALID');
 let envelope;
 try{envelope=JSON.parse(raw)}catch{throw Error('SIDECAR_INVALID');}
 if(envelope?.kind!==SIDECAR_KIND||envelope.schemaVersion!==1||
 envelope.dealId!==id||envelope.dealMode!==deal.mode)throw Error('SIDECAR_ID_OR_MODE_MISMATCH');
 const input=JSON.stringify({kind:'STARTAK_PERSONAL_MARKET_STUDY',...envelope.studyInputs});
 const study=parsePersonalMarketStudy(input).study;
 subjectCompatible(study.subject,deal.mode);
 return {found:true,dealId:id,savedAt:envelope.savedAt,
  study,recalculateRequired:true,certification:'NOT_AUTHORIZED'};
}
async function listCanonicalDeals(storage){
 if(!storage||typeof storage.get!=='function')throw Error('STORAGE_PROVIDER_REQUIRED');
 const index=await storage.get('deals-index');
 if(index===null)return [];
 if(typeof index!=='string'||index.length>1_000_000)throw Error('SAVED_DEAL_INDEX_INVALID');
 let parsed;try{parsed=JSON.parse(index)}catch{throw Error('SAVED_DEAL_INDEX_INVALID');}
 if(!Array.isArray(parsed)||parsed.length>5000)throw Error('SAVED_DEAL_INDEX_INVALID');
 return parsed.filter(x=>x&&typeof x.id==='string'&&typeof x.name==='string')
  .map(x=>({id:x.id,name:x.name})).filter(x=>{try{validId(x.id);return true;}catch{return false;}});
}
module.exports={SIDECAR_KIND,sidecarKey,listCanonicalDeals,saveResearchSidecar,loadResearchSidecar};
