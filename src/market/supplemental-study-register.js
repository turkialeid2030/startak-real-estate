'use strict';
// Personal research only. Restore canonical provider rows, never authority or
// calculated output. The embedded public Suhail sample is recreated, not saved.
const {marketEvidenceSubjectKey}=require('./owner-market-evidence-scope');
const {toPublicSample,mergeNeighborhoodResearch}=require('./suhail-national-neighborhood-research');
const {BY_FEATURE,TYPE_BY_KIND,mergeEarthResearch}=require('./earth-national-research');
const {SOURCE_MAP,mergeListingResearch}=require('./saudi-listing-source-research');
const SCHEMA=1;
const invalid=()=>{throw Error('STUDY_SUPPLEMENTAL_RECORD_INVALID');};
const keys=(row,fields)=>{
 if(!row||typeof row!=='object'||Array.isArray(row)||
  Object.keys(row).sort().join(',')!==fields.split(' ').sort().join(','))invalid();
};
const text=(v,n,optional=false)=>v===null&&optional||typeof v==='string'&&v.trim()===v&&v.length>0&&v.length<=n;
const numeric=(v,min,max,integer=false)=>v===null||typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max&&(!integer||Number.isInteger(v));
const positive=(v,max)=>v===null||numeric(v,Number.MIN_VALUE,max);
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
const observed=v=>date(v)&&v<=new Date().toISOString().slice(0,10);
const event=(v,o)=>v===null||date(v)&&v<=o;
function safeUrl(v,domains){
 if(!text(v,2000))return false;
 try{
  const u=new URL(v);
  return u.protocol==='https:'&&!u.username&&!u.password&&!u.hash&&
   domains.some(d=>u.hostname===d||u.hostname.endsWith('.'+d))&&
   ![...u.searchParams.keys()].some(k=>/token|secret|password|session|credential|api.?key|auth|signature/i.test(k));
 }catch{return false;}
}
const base=(r,n)=>r.country==='SA'&&text(r.city,n)&&text(r.district,n)&&observed(r.observedOn)&&r.executedTransactionRecord===false&&r.marketValuationEligible===false;
function suhail(r){
 keys(r,'country city district transferCount totalValueSar residentialSarSqm commercialSarSqm growthPct sourceUrl observedOn periodStart periodEnd recordClass executedTransactionRecord marketValuationEligible');
 if(!base(r,120)||r.recordClass!=='USER_IMPORTED_NEIGHBORHOOD_AGGREGATE_UNVERIFIED'||
  r.periodStart!==null||r.periodEnd!==null||!safeUrl(r.sourceUrl,['suhail.ai'])||
  !numeric(r.transferCount,0,1e7,true)||!numeric(r.totalValueSar,0,1e15)||
  !numeric(r.residentialSarSqm,0,2e7)||!numeric(r.commercialSarSqm,0,2e7)||!numeric(r.growthPct,-100,1e6))invalid();
 return {...r};
}
function earth(r){
 keys(r,'country source sourceFeatureId evidenceKind evidenceClass sourceUrl observedOn region city district recordId eventDate amountSar areaSqm planNumber parcelNumber assetType transactionIndependentlyVerified officialRegistryVerified executedTransactionRecord askingPriceVerified marketValuationEligible professionalReportAuthorized');
 const f=Object.hasOwn(BY_FEATURE,r.sourceFeatureId)&&BY_FEATURE[r.sourceFeatureId];
 if(!base(r,130)||!f||r.source!=='EARTH_APP'||r.evidenceKind!==f.kind||r.evidenceClass!==TYPE_BY_KIND[f.kind]||r.sourceUrl!==f.url||
  !['region','recordId','planNumber','parcelNumber','assetType'].every(k=>text(r[k],130,true))||
  !event(r.eventDate,r.observedOn)||!positive(r.amountSar,1e15)||!positive(r.areaSqm,1e9)||
  !['transactionIndependentlyVerified','officialRegistryVerified','askingPriceVerified','professionalReportAuthorized'].every(k=>r[k]===false))invalid();
 return {...r};
}
function listing(r){
 keys(r,'country sourceId sourceNameAr city district kind assetType askingPriceOrBudgetSar areaSqm listingUrl listingId listingDate observedOn recordClass independentlyVerified executedTransactionRecord marketValuationEligible professionalReportAuthorized');
 const f=Object.hasOwn(SOURCE_MAP,r.sourceId)&&SOURCE_MAP[r.sourceId];
 if(!base(r,120)||!f||r.sourceNameAr!==f.nameAr||!f.capabilities.includes(r.kind)||
  r.recordClass!=='USER_IMPORTED_MARKET_SIGNAL_UNVERIFIED'||r.independentlyVerified!==false||r.professionalReportAuthorized!==false||
  !text(r.assetType,90,true)||!text(r.listingId,120,true)||!safeUrl(r.listingUrl,f.domains)||
  !event(r.listingDate,r.observedOn)||!positive(r.askingPriceOrBudgetSar,1e14)||!positive(r.areaSqm,1e7)||
  (['SALE_OFFER','RENT_OFFER'].includes(r.kind)&&r.askingPriceOrBudgetSar===null))invalid();
 const u=new URL(r.listingUrl);
 if(!r.listingId&&['/','/ar/','/ar/tabs/home'].includes(u.pathname))invalid();
 return {...r};
}
function validatedRows(rows,limit,validate,merge,initial=[]){
 if(!Array.isArray(rows)||rows.length>limit)invalid();
 const canonical=rows.map(validate);
 const combined=merge(initial,canonical);
 if(combined.conflicts.length||combined.duplicates||combined.records.length!==initial.length+canonical.length)invalid();
 return canonical;
}
function decodeSupplementalStudyRegister(subject,envelope){
 if(envelope===undefined)return {suhail:toPublicSample(),earth:[],listings:[]};
 keys(envelope,'schemaVersion subjectKey suhail earth listings');
 if(envelope.schemaVersion!==SCHEMA)throw Error('STUDY_SUPPLEMENTAL_SCHEMA_INVALID');
 if(envelope.subjectKey!==marketEvidenceSubjectKey(subject))throw Error('STUDY_SUPPLEMENTAL_SUBJECT_MISMATCH');
 const sample=toPublicSample();
 const s=validatedRows(envelope.suhail,3000-sample.length,suhail,mergeNeighborhoodResearch,sample);
 return {suhail:[...sample,...s],earth:validatedRows(envelope.earth,2500,earth,mergeEarthResearch),
  listings:validatedRows(envelope.listings,3000,listing,mergeListingResearch)};
}
function encodeSupplementalStudyRegister(subject,feeds,boundSubjectKey){
 const s=(feeds?.suhail||[]).filter(r=>r?.recordClass!=='NEIGHBORHOOD_AGGREGATE_INDEXED_UNVERIFIED');
 const earth=feeds?.earth||[],listings=feeds?.listings||[];
 if(!s.length&&!earth.length&&!listings.length)return undefined;
 if(boundSubjectKey!==marketEvidenceSubjectKey(subject))throw Error('STUDY_SUPPLEMENTAL_SUBJECT_MISMATCH');
 const envelope={schemaVersion:SCHEMA,subjectKey:boundSubjectKey,suhail:s,earth,listings};
 const checked=decodeSupplementalStudyRegister(subject,envelope);
 return {...envelope,suhail:checked.suhail.slice(toPublicSample().length),earth:checked.earth,listings:checked.listings};
}
module.exports={encodeSupplementalStudyRegister,decodeSupplementalStudyRegister};
