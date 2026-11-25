'use strict';
// Offline normalized CSV ingestion: no network calls, credentials or silent data inference.
const {appendIndicator,importHistory,MAX_BYTES,MAX_RECORDS}=require('./saudi-rent-indicator-history');
const {VERSION}=require('./saudi-rent-indicator-snapshot');
const COLUMNS=Object.freeze(['sourceId','sourceUrl','sourceRef','attribution','city','district','kind','subtype','areaBasis','periodStart','periodEnd','publishedDate','observedDate','priceSource','metric','valueSar','sampleCount','vatBasis','declaredVatRate','vatRef']);
function parseRows(raw,delimiter=','){
 if(typeof raw!=='string'||new TextEncoder().encode(raw).length>MAX_BYTES)throw Error('IMPORT_SIZE');
 if(![',','\t',';'].includes(delimiter))throw Error('IMPORT_DELIMITER');
 raw=raw.replace(/^\uFEFF/,'');
 let rows=[],row=[],value='',quoted=false,closed=false,started=false;
 function cell(){row.push(value);if(row.length>COLUMNS.length)throw Error('IMPORT_COLUMNS');value='';closed=false;started=false;}
 function line(){cell();if(row.some(v=>v!=='')){rows.push(row);if(rows.length>MAX_RECORDS+1)throw Error('IMPORT_LIMIT');}row=[];}
 for(let i=0;i<raw.length;i++){
  const c=raw[i];
  if(quoted){if(c==='"'){if(raw[i+1]==='"'){value+='"';i++;}else{quoted=false;closed=true;}}else value+=c;continue;}
  if(c===delimiter){cell();continue;}
  if(c==='\r'||c==='\n'){if(c==='\r'&&raw[i+1]==='\n')i++;line();continue;}
  if(closed)throw Error('IMPORT_QUOTE');
  if(c==='"'){if(started)throw Error('IMPORT_QUOTE');quoted=true;started=true;continue;}
  value+=c;started=true;
 }
 if(quoted)throw Error('IMPORT_QUOTE');
 if(started||closed||row.length||value)line();
 return rows;
}
function number(v){
 if(!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(v))throw Error('IMPORT_NUMBER');
 const n=Number(v);if(!Number.isFinite(n))throw Error('IMPORT_NUMBER');return n;
}
function prepareIndicatorImport(raw,delimiter,archive,authorized){
 if(authorized!==true)throw Error('IMPORT_PERMISSION_REQUIRED');
 let next=importHistory(JSON.stringify(archive));
 const before=next.records.length,rows=parseRows(raw,delimiter),header=rows.shift();
 if(!header||header.length!==COLUMNS.length||new Set(header).size!==COLUMNS.length||!COLUMNS.every(k=>header.includes(k)))throw Error('IMPORT_HEADER');
 if(!rows.length)throw Error('IMPORT_EMPTY');
 for(let i=0;i<rows.length;i++){
  try{
   const cells=rows[i];if(cells.length!==header.length)throw Error('IMPORT_COLUMNS');
   const x=Object.fromEntries(header.map((k,j)=>[k,cells[j].trim()]));
   if(!x.district||['all','citywide','city-wide','city','*','كل الأحياء','جميع الأحياء','على مستوى المدينة','المدينة','كافة الأحياء'].includes(x.district.toLowerCase()))throw Error('IMPORT_DISTRICT_REQUIRED');
   x.valueSar=number(x.valueSar);x.sampleCount=number(x.sampleCount);
   x.declaredVatRate=x.declaredVatRate===''?null:number(x.declaredVatRate);
   x.vatRef=x.vatRef===''?null:x.vatRef;
   next=appendIndicator(next,{version:VERSION,...x});
  }catch(e){throw Error('IMPORT_RECORD_'+(i+1)+': '+e.message);}
 }
 return {archive:next,inputRows:rows.length,addedRows:next.records.length-before,duplicateRows:rows.length-(next.records.length-before),sourceAuthenticated:false,sourceLicenseVerified:false,liveSourceConnected:false,propertyRentEstimateSar:null};
}
module.exports={COLUMNS,prepareIndicatorImport};
