'use strict';

const {ASSET_CLASS}=require('../project-model/project-profile');
const VERSION='PERSONAL_SECTOR_CASE_ARCHIVE_V1';
const MAX_ARCHIVE_BYTES=64*1024;
const fields=Object.freeze({
 subject:Object.freeze({city:'string',district:'string',subtype:'string',date:'string',area:'string',right:'string'}),
 methods:Object.freeze({income:'boolean',cost:'boolean',market:'boolean'}),
 inc:Object.freeze({gross:'string',opex:'string',cap:'string',expenseTreatment:'string',realEstateOnly:'boolean',groundLease:'boolean',sharedCosts:'boolean'}),
 cost:Object.freeze({land:'string',replacement:'string',depreciation:'string',excludesBusiness:'boolean'}),
 marketOptions:Object.freeze({unit:'string',quantity:'string',businessExcluded:'boolean',mixedAllocated:'boolean'}),
 policy:Object.freeze({maxDispersion:'string',incomeWeight:'string',costWeight:'string',marketWeight:'string'}),
 comparable:Object.freeze({id:'string',city:'string',district:'string',subtype:'string',right:'string',date:'string',unitValue:'string',source:'string',unit:'string'}),
});
function isPlain(x){return x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;}
function fail(code){throw Object.assign(new Error(code),{code});}
function canonicalObject(value,schema,label,maxLength=200){
 if(!isPlain(value))fail('INVALID_'+label);
 if(Object.keys(value).length!==Object.keys(schema).length)fail('WRONG_'+label+'_FIELDS');
 const result={};
 for(const [key,type] of Object.entries(schema)){
  if(!Object.prototype.hasOwnProperty.call(value,key)||typeof value[key]!==type)
   fail('WRONG_'+label+'_FIELD_TYPE');
  if(type==='string'&&(value[key].length>maxLength||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value[key])))
   fail('UNSAFE_'+label+'_FIELD');
  result[key]=value[key];
 }
 return result;
}
function canonicalState(state){
 if(!isPlain(state))fail('INVALID_STATE');
 const keys=['assetClass','subject','methods','inc','cost','comparables','marketOptions','policy'];
 if(Object.keys(state).length!==keys.length||keys.some(k=>!Object.prototype.hasOwnProperty.call(state,k)))
  fail('UNKNOWN_STATE_FIELDS');
 if(typeof state.assetClass!=='string'||!Object.values(ASSET_CLASS).includes(state.assetClass))
  fail('UNKNOWN_ASSET_CLASS');
 if(!Array.isArray(state.comparables)||state.comparables.length!==3)fail('INVALID_COMPARABLE_COUNT');
 const result={assetClass:state.assetClass};
 for(const name of ['subject','methods','inc','cost'])result[name]=canonicalObject(state[name],fields[name],name.toUpperCase());
 result.comparables=state.comparables.map(x=>canonicalObject(x,fields.comparable,'COMPARABLE'));
 for(const name of ['marketOptions','policy'])result[name]=canonicalObject(state[name],fields[name],name.toUpperCase());
 return result;
}
function hex(buffer){return [...new Uint8Array(buffer)].map(n=>n.toString(16).padStart(2,'0')).join('');}
async function digest(value,subtle){
 if(!subtle||typeof subtle.digest!=='function')fail('WEBCRYPTO_SHA256_REQUIRED');
 const bytes=new TextEncoder().encode(JSON.stringify(value));
 return hex(await subtle.digest('SHA-256',bytes));
}
function strictIso(x){
 return typeof x==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(x)
   &&Number.isFinite(Date.parse(x))&&new Date(x).toISOString()===x;
}
async function createPersonalSectorCaseArchive(state,{subtle,createdAt}={}){
 const normalized=canonicalState(state);
 const date=createdAt||new Date().toISOString();
 if(!strictIso(date))fail('INVALID_ARCHIVE_DATE');
 const body={version:VERSION,createdAt:date,state:normalized};
 const sha256=await digest(body,subtle);
 const archive={...body,sha256};
 if(new TextEncoder().encode(JSON.stringify(archive)).length>MAX_ARCHIVE_BYTES)fail('ARCHIVE_TOO_LARGE');
 return archive;
}
async function verifyPersonalSectorCaseArchive(archive,{subtle,expectedAssetClass}={}){
 if(!isPlain(archive)||Object.keys(archive).length!==4)fail('INVALID_ARCHIVE_STRUCTURE');
 if(archive.version!==VERSION||!strictIso(archive.createdAt)||typeof archive.sha256!=='string'
    ||! /^[a-f0-9]{64}$/.test(archive.sha256))fail('ARCHIVE_VERSION_DATE_OR_HASH_INVALID');
 const state=canonicalState(archive.state);
 if(expectedAssetClass&&state.assetClass!==expectedAssetClass)fail('ASSET_CLASS_MISMATCH');
 const body={version:VERSION,createdAt:archive.createdAt,state};
 const actual=await digest(body,subtle);
 if(actual!==archive.sha256)fail('ARCHIVE_SHA256_MISMATCH');
 // Never restore calculated results or permissions. Recompute them from
 // the restored inputs so no stale or injected appraisal can be displayed.
 return state;
}
module.exports={VERSION,MAX_ARCHIVE_BYTES,canonicalState,createPersonalSectorCaseArchive,verifyPersonalSectorCaseArchive};
