'use strict';
// Narrow, deterministic replay contract for explicitly supported structured
// artifacts. No PDF/HTML/OCR parsing, inference, or external rights authority.
const crypto=require('node:crypto');
const {TextDecoder}=require('node:util');
const {isPlainJson}=require('../validation/plain-json-boundary');
const {strictCalendarDateMs}=require('../validation/strict-calendar-instant');
const {hashValue}=require('./source-provenance-governance');
const VERSION='STARTAK_STRUCTURED_SOURCE_REPLAY_V1';
const TYPES=Object.freeze(['TEXT','INTEGER','DECIMAL_STRING','BOOLEAN','DATE']);
const LIMIT=2*1024*1024,MAX_ROWS=5000,MAX_COLUMNS=32;
function contractOf(contract){
 if(!isPlainJson(contract)||!contract||Object.keys(contract).length!==3||contract.version!==VERSION||typeof contract.dataContractVersion!=='string'||! /^[A-Za-z0-9_.:-]{2,128}$/.test(contract.dataContractVersion)||!Array.isArray(contract.columns)||!contract.columns.length||contract.columns.length>MAX_COLUMNS)throw Error('REPLAY_CONTRACT_INVALID');
 const names=new Set(),columns=contract.columns.map(c=>{
  if(!c||Object.keys(c).length!==2||typeof c.name!=='string'||! /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(c.name)||['constructor','prototype','toJSON','__proto__'].includes(c.name)||names.has(c.name)||!TYPES.includes(c.type))throw Error('REPLAY_COLUMN_INVALID');
  names.add(c.name);return {name:c.name,type:c.type};
 });
 return {version:VERSION,dataContractVersion:contract.dataContractVersion,columns};
}
function structuredSourceSchemaHash(contract){return hashValue(contractOf(contract));}
function typed(v,type,csv){
 if(type==='TEXT'){if(typeof v!=='string'||!v.length||v.length>4096||/[\x00-\x1f\x7f]/.test(v))throw Error('REPLAY_TEXT_INVALID');return v;}
 if(type==='INTEGER'){
  if(csv){if(typeof v!=='string'||! /^(0|-?[1-9][0-9]{0,15})$/.test(v))throw Error('REPLAY_INTEGER_INVALID');v=Number(v);}
  if(!Number.isSafeInteger(v)||Object.is(v,-0))throw Error('REPLAY_INTEGER_INVALID');return v;
 }
 if(type==='DECIMAL_STRING'){if(typeof v!=='string'||! /^-?(0|[1-9][0-9]{0,15})(\.[0-9]{1,6})?$/.test(v)||/^-0(?:\.0+)?$/.test(v))throw Error('REPLAY_DECIMAL_INVALID');return v;}
 if(type==='BOOLEAN'){if(csv){if(v==='true')return true;if(v==='false')return false;}else if(typeof v==='boolean')return v;throw Error('REPLAY_BOOLEAN_INVALID');}
 if(type==='DATE'){if(typeof v!=='string'||! /^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(strictCalendarDateMs(v)))throw Error('REPLAY_DATE_INVALID');return v;}
 throw Error('REPLAY_TYPE_INVALID');
}
// RFC-style quoting for single-line cells only. Embedded line breaks,
// inconsistent widths, empty lines and ambiguous quoting are rejected.
function csvRow(line){
 const cells=[];let i=0;
 for(;;){
  let v='';
  if(line[i]==='"'){
   i++;let closed=false;
   while(i<line.length){const ch=line[i++];if(ch!=='"'){v+=ch;continue;}if(line[i]==='"'){v+='"';i++;continue;}closed=true;break;}
   if(!closed||(i<line.length&&line[i]!==','))throw Error('REPLAY_CSV_QUOTING_INVALID');
  }else{
   while(i<line.length&&line[i]!==','){if(line[i]==='"')throw Error('REPLAY_CSV_QUOTING_INVALID');v+=line[i++];}
  }
  cells.push(v);if(cells.length>MAX_COLUMNS||v.length>4096)throw Error('REPLAY_CSV_LIMIT');
  if(i===line.length)break;
  i++;if(i===line.length){cells.push('');break;}
 }
 return cells;
}
function replayStructuredSourceArtifact({artifactBytes,artifactMimeType,artifactFormat,contract}={}){
 const hold=reason=>Object.freeze({status:'HOLD_STRUCTURED_REPLAY',reason,parserReplayVerified:false,payload:null,artifactHashSha256:null,schemaFingerprintSha256:null,extractedPayloadHashSha256:null,productionUseAuthorized:false});
 try{
  if(!Buffer.isBuffer(artifactBytes)||!artifactBytes.length||artifactBytes.length>LIMIT)return hold('REPLAY_ARTIFACT_SIZE_INVALID');
  const c=contractOf(contract),snapshot=Buffer.from(artifactBytes);
  const artifactHashSha256=crypto.createHash('sha256').update(snapshot).digest('hex');
  const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(snapshot);
  if(text.charCodeAt(0)===0xfeff||text.includes('\0'))return hold('REPLAY_ENCODING_INVALID');
  let rows,csv=false;
  if(artifactFormat==='CSV'&&artifactMimeType==='text/csv'){
   csv=true;const lines=text.replace(/\r\n/g,'\n').split('\n');
   if(lines.at(-1)==='')lines.pop();
   if(lines.length<2||lines.length>MAX_ROWS+1||lines.some(x=>!x.length||x.includes('\r')))return hold('REPLAY_CSV_ROWS_INVALID');
   const header=csvRow(lines.shift());if(JSON.stringify(header)!==JSON.stringify(c.columns.map(x=>x.name)))return hold('REPLAY_CSV_HEADER_MISMATCH');
   rows=lines.map(line=>{const cells=csvRow(line);if(cells.length!==header.length)throw Error('REPLAY_CSV_WIDTH_INVALID');return Object.fromEntries(header.map((name,i)=>[name,cells[i]]));});
  }else if(artifactFormat==='JSON'&&artifactMimeType==='application/json'){
   // Canonical compact JSON only; byte equality after parsing rejects
   // duplicate object keys, lossy numeric lexemes and alternate encodings.
   rows=JSON.parse(text);
   if(!isPlainJson(rows)||JSON.stringify(rows)!==text)return hold('REPLAY_JSON_NONCANONICAL');
  }else return hold('REPLAY_FORMAT_UNSUPPORTED');
  if(!Array.isArray(rows)||!rows.length||rows.length>MAX_ROWS)return hold('REPLAY_ROWS_INVALID');
  const payload=rows.map(row=>{
   if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).length!==c.columns.length||!c.columns.every(x=>Object.hasOwn(row,x.name)))throw Error('REPLAY_ROW_SCHEMA_MISMATCH');
   return Object.freeze(Object.fromEntries(c.columns.map(x=>[x.name,typed(row[x.name],x.type,csv)])));
  });
  const extractedPayloadHashSha256=hashValue(payload),schemaFingerprintSha256=structuredSourceSchemaHash(c);
  if(!extractedPayloadHashSha256||!schemaFingerprintSha256)return hold('REPLAY_HASH_INVALID');
  return Object.freeze({status:'STRUCTURED_REPLAY_MATCHED_CONTRACT',reason:null,parserReplayVerified:true,parserVersion:VERSION,dataContractVersion:c.dataContractVersion,payload:Object.freeze(payload),artifactHashSha256,schemaFingerprintSha256,extractedPayloadHashSha256,productionUseAuthorized:false});
 }catch{return hold('REPLAY_PARSE_OR_SCHEMA_INVALID');}
}
module.exports={VERSION,structuredSourceSchemaHash,replayStructuredSourceArtifact};
