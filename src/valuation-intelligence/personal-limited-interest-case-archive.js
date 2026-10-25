'use strict';

// Private input-only archive: not a signed record, source certificate,
// professional appraisal, or transfer authorization.
const {ASSET_CLASS}=require('../project-model/project-profile');
const {RIGHTS}=require('./personal-limited-interest-dcf');
const VERSION='PERSONAL_LIMITED_INTEREST_CASE_V1';
const MAX_ARCHIVE_BYTES=16*1024;
const AMOUNT_FIELDS=Object.freeze([
 'annualPropertyIncomeSar','annualPropertyOperatingExpenseSar',
 'annualGroundRentSar','annualSustainingCapexSar','incomeEscalationRate',
 'operatingExpenseEscalationRate','groundRentEscalationRate',
 'nominalDiscountRate','upfrontRightConsiderationSar',
]);
const CONFIRMATION_FIELDS=Object.freeze([
 'terms','realty','improvements','consentRequired','consentVerified',
]);
function fail(code){throw Object.assign(new Error(code),{code});}
function plain(x){return x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;}
function exactKeys(x,keys,code){
 if(!plain(x)||Object.keys(x).length!==keys.length||
    keys.some(k=>!Object.prototype.hasOwnProperty.call(x,k)))fail(code);
}
function boundedString(x,max=200){
 if(typeof x!=='string'||x.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(x))
  fail('INVALID_ARCHIVE_INPUT');
 return x;
}
function canonicalState(input){
 const keys=['assetClass','right','term','valuationDate','inputs','confirmed'];
 exactKeys(input,keys,'INVALID_STATE_FIELDS');
 if(!Object.values(ASSET_CLASS).includes(input.assetClass))fail('INVALID_ASSET_CLASS');
 if(input.right!==''&&!Object.values(RIGHTS).includes(input.right))fail('INVALID_RIGHT');
 const result={assetClass:input.assetClass,right:input.right,
  term:boundedString(input.term,20),valuationDate:boundedString(input.valuationDate,20)};
 exactKeys(input.inputs,AMOUNT_FIELDS,'INVALID_AMOUNT_FIELDS');
 result.inputs={};
 for(const key of AMOUNT_FIELDS)result.inputs[key]=boundedString(input.inputs[key]);
 exactKeys(input.confirmed,CONFIRMATION_FIELDS,'INVALID_CONFIRMATION_FIELDS');
 result.confirmed={};
 for(const key of CONFIRMATION_FIELDS){
  if(typeof input.confirmed[key]!=='boolean')fail('INVALID_CONFIRMATION');
  result.confirmed[key]=input.confirmed[key];
 }
 return result;
}
function strictIso(x){
 return typeof x==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(x)
  &&Number.isFinite(Date.parse(x))&&new Date(x).toISOString()===x;
}
function toHex(buffer){return Array.from(new Uint8Array(buffer),n=>n.toString(16).padStart(2,'0')).join('');}
async function digest(body,subtle){
 if(!subtle||typeof subtle.digest!=='function')fail('WEBCRYPTO_REQUIRED');
 return toHex(await subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(body))));
}
async function createLimitedInterestArchive(state,{subtle,createdAt}={}){
 const body={version:VERSION,createdAt:createdAt||new Date().toISOString(),state:canonicalState(state)};
 if(!strictIso(body.createdAt))fail('INVALID_DATE');
 const archive={...body,sha256:await digest(body,subtle)};
 if(new TextEncoder().encode(JSON.stringify(archive)).length>MAX_ARCHIVE_BYTES)fail('ARCHIVE_TOO_LARGE');
 return archive;
}
async function verifyLimitedInterestArchive(archive,{subtle,expectedAssetClass}={}){
 exactKeys(archive,['version','createdAt','state','sha256'],'INVALID_ARCHIVE_STRUCTURE');
 if(archive.version!==VERSION||!strictIso(archive.createdAt)||
    typeof archive.sha256!=='string'||!/^[a-f0-9]{64}$/.test(archive.sha256))
  fail('INVALID_ARCHIVE_VERSION_OR_HASH');
 const state=canonicalState(archive.state);
 if(expectedAssetClass&&state.assetClass!==expectedAssetClass)fail('ASSET_CLASS_MISMATCH');
 const calculated=await digest({version:VERSION,createdAt:archive.createdAt,state},subtle);
 if(calculated!==archive.sha256)fail('ARCHIVE_HASH_MISMATCH');
 // Deliberately never return calculated DCF output, validation approvals or authority.
 return state;
}
module.exports={VERSION,MAX_ARCHIVE_BYTES,AMOUNT_FIELDS,CONFIRMATION_FIELDS,
 canonicalState,createLimitedInterestArchive,verifyLimitedInterestArchive};
