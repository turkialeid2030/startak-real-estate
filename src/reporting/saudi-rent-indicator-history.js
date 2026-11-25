'use strict';
// Portable, local aggregate indicator archive. No credentials, tenant data,
// source authentication, property estimates or cross-session server persistence.
const {reviewRentIndicator}=require('./saudi-rent-indicator-snapshot');
const {sha256Hex}=require('../crypto/sha256');
const VERSION='SAUDI_RENT_INDICATOR_HISTORY_V1';
const MAX_RECORDS=250, MAX_BYTES=1048576;
const fields=['version','sourceId','sourceUrl','sourceRef','attribution','city','district','kind','subtype','areaBasis','periodStart','periodEnd','publishedDate','observedDate','priceSource','metric','valueSar','sampleCount','vatBasis','declaredVatRate','vatRef'];
const exact=(x,keys)=>x!==null&&typeof x==='object'&&Object.getPrototypeOf(x)===Object.prototype&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const norm=x=>x.trim().replace(/\s+/g,' ').replace(/[أإآٱ]/g,'ا').toLowerCase();
function contextOf(x){return {city:x.city,district:x.district,kind:x.kind,subtype:x.subtype,areaBasis:x.areaBasis,asOf:x.observedDate};}
function canonical(x){
 if(!exact(x,fields))throw Error('HISTORY_RECORD_INVALID');
 const row=Object.fromEntries(fields.map(k=>[k,x[k]]));
 reviewRentIndicator(row,contextOf(row));
 return row;
}
function identity(x){
 return JSON.stringify([x.sourceId,x.sourceRef,norm(x.city),norm(x.district),x.kind,norm(x.subtype),x.areaBasis,x.periodStart,x.periodEnd,x.priceSource,x.metric,x.observedDate]);
}
function envelope(records){
 const payload={version:VERSION,scope:'DECLARED_AGGREGATE_ONLY',records};
 return {...payload,archiveHashSha256:sha256Hex(JSON.stringify(payload))};
}
function validateArchive(a){
 if(!exact(a,['version','scope','records','archiveHashSha256'])||a.version!==VERSION||a.scope!=='DECLARED_AGGREGATE_ONLY'||!Array.isArray(a.records)||a.records.length>MAX_RECORDS)throw Error('HISTORY_ARCHIVE_INVALID');
 const records=a.records.map(canonical), seen=new Set();
 for(const row of records){const key=identity(row);if(seen.has(key))throw Error('HISTORY_DUPLICATE');seen.add(key);}
 const clean=envelope(records);
 if(clean.archiveHashSha256!==a.archiveHashSha256)throw Error('HISTORY_HASH_MISMATCH');
 return clean;
}
function emptyHistory(){return envelope([]);}
function appendIndicator(a,input){
 const clean=validateArchive(a),row=canonical(input),key=identity(row);
 const prior=clean.records.find(r=>identity(r)===key);
 if(prior){if(JSON.stringify(prior)!==JSON.stringify(row))throw Error('HISTORY_OBSERVATION_CONFLICT');return clean;}
 if(clean.records.length>=MAX_RECORDS)throw Error('HISTORY_LIMIT');
 const next=envelope([...clean.records,row]);
 if(new TextEncoder().encode(JSON.stringify(next)).length>MAX_BYTES)throw Error('HISTORY_SIZE');
 return next;
}
function importHistory(raw){
 if(typeof raw!=='string'||new TextEncoder().encode(raw).length>MAX_BYTES)throw Error('HISTORY_SIZE');
 return validateArchive(JSON.parse(raw));
}
function reviewHistory(a,ctx){
 const clean=validateArchive(a);
 // Validate context even for an empty archive: reuse the existing review
 // for non-empty, otherwise check the date and fields explicitly.
 if(!exact(ctx,['city','district','kind','subtype','areaBasis','asOf'])||!['city','district','kind','subtype','areaBasis'].every(k=>typeof ctx[k]==='string'&&ctx[k].trim()&&ctx[k].length<=500&&!/[\u0000-\u001f\u007f]/.test(ctx[k]))||typeof ctx.asOf!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(ctx.asOf)||!Number.isFinite(Date.parse(ctx.asOf))||new Date(ctx.asOf).toISOString().slice(0,10)!==ctx.asOf)throw Error('HISTORY_CONTEXT_INVALID');
 const {KINDS}=require('./saudi-rental-intelligence');
 if(!KINDS.includes(ctx.kind)||!['NLA','LAND_AREA','WHOLE_LEASE_AREA'].includes(ctx.areaBasis)||(ctx.kind==='LAND')!==(ctx.areaBasis==='LAND_AREA'))throw Error('HISTORY_CONTEXT_INVALID');
 const observations=clean.records.map(x=>reviewRentIndicator(x,ctx)).filter(x=>!x.flags.includes('SCOPE_MISMATCH')&&!x.flags.includes('FUTURE_EVIDENCE')).sort((a,b)=>a.input.periodEnd.localeCompare(b.input.periodEnd)||a.input.observedDate.localeCompare(b.input.observedDate));
 return {scope:'DECLARED_AGGREGATE_ONLY',observations,sourceAuthenticated:false,sourceLicenseVerified:false,liveSourceConnected:false,propertyRentEstimateSar:null,individualLeaseComparables:[],canonicalModelUpdated:false};
}
module.exports={VERSION,MAX_RECORDS,MAX_BYTES,emptyHistory,appendIndicator,importHistory,reviewHistory};
