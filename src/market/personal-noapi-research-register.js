'use strict';
// Portable personal research register: local JSON download and explicit
// user-selected restore. Never reads credentials, contacts a provider, or
// upgrades unverified source-reported figures to professional valuations.
const {mergeNationalResearch}=require('./saudi-national-intelligence-sources');
const VERSION='STARTAK_PERSONAL_NOAPI_RESEARCH_REGISTER_V1';
const MAX_PORTABLE_BYTES=2*1024*1024;
const MAX_ROWS=1500;
const FIELDS=Object.freeze([
 'sourceId','origin','evidenceClass','sourceUrl','country',
 'city','district','assetType','recordId','observedOn',
 'periodStart','periodEnd','eventDate','metricName','metricValue','metricUnit',
 'providerRangeLowSar','providerRangeHighSar','providerStatedConfidence','modelAsOf',
 'personalResearch','officialSourcePage','sourceRecordAuthenticated',
 'executedTransactionRecord','independentMarketPriceVerified','marketValuationEligible',
 'professionalReportAuthorized',
]);
const DAY_KNOWN='dayKnown';
function own(x,k){return Object.prototype.hasOwnProperty.call(x,k);}
function portableRow(source){
 if(!source||typeof source!=='object'||Array.isArray(source))
  throw Error('PERSONAL_RESEARCH_RECORD_INVALID');
 const row={};
 for(const key of FIELDS){
  if(!own(source,key))throw Error('PERSONAL_RESEARCH_RECORD_INCOMPLETE');
  row[key]=source[key];
 }
 if(source.sourceId==='KITE_MOJ_QUARTERLY'){
  // Kite month-level reports cannot be silently rewritten as exact-day sales.
  if(source.dayKnown!==false)throw Error('PERSONAL_RESEARCH_KITE_MONTH_REQUIRED');
  row[DAY_KNOWN]=false;
 }
 return row;
}
function safeRows(rows){
 if(!Array.isArray(rows)||rows.length>MAX_ROWS)
  throw Error('PERSONAL_RESEARCH_ROWS_INVALID');
 const data=rows.map(portableRow);
 const rechecked=mergeNationalResearch([],data,{limit:MAX_ROWS});
 if(rechecked.conflicts.length||rechecked.records.length!==data.length||
    rechecked.duplicates)throw Error('PERSONAL_RESEARCH_DUPLICATES_OR_CONFLICTS');
 return rechecked.records.map(portableRow);
}
function exportPersonalResearch(rows){
 const safe=safeRows(rows);
 const value=JSON.stringify({version:VERSION,records:safe},null,2);
 if(new TextEncoder().encode(value).length>MAX_PORTABLE_BYTES)
  throw Error('PERSONAL_RESEARCH_EXPORT_SIZE_LIMIT');
 return value;
}
function importPersonalResearch(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_PORTABLE_BYTES)
  throw Error('PERSONAL_RESEARCH_IMPORT_SIZE_LIMIT');
 let data;
 try{data=JSON.parse(text);}catch{throw Error('PERSONAL_RESEARCH_JSON_INVALID');}
 if(!data||typeof data!=='object'||Array.isArray(data)||
    Object.keys(data).sort().join(',')!=='records,version'||
    data.version!==VERSION||!Array.isArray(data.records))
  throw Error('PERSONAL_RESEARCH_SCHEMA_INVALID');
 const allowed=new Set([...FIELDS,DAY_KNOWN]);
 for(const row of data.records){
  if(!row||typeof row!=='object'||Array.isArray(row)||
   Object.keys(row).some(k=>!allowed.has(k))||
   FIELDS.some(k=>!own(row,k))||
   (row.sourceId==='KITE_MOJ_QUARTERLY')!==own(row,DAY_KNOWN))
   throw Error('PERSONAL_RESEARCH_RECORD_SCHEMA_INVALID');
 }
 return safeRows(data.records);
}
module.exports={VERSION,MAX_PORTABLE_BYTES,MAX_ROWS,FIELDS,
 exportPersonalResearch,importPersonalResearch};
