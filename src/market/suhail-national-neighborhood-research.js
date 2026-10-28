'use strict';
// Research-only extracts from the publicly indexed Suhail neighborhood summary.
// A /Riyadh/ URL is a landing route, NOT a city filter; each row has its own city.
// There is no per-transaction price, property ID, sale date, or licensed API in these rows.
const SOURCE_URL='https://www.suhail.ai/Riyadh/transactions';
const PAGE_INDEXED_AT='2026-10-28'; // date observed by STARTAK research, NOT transaction update time
const MAX_ROWS=3000, MAX_BYTES=2*1024*1024;
const sample=Object.freeze([
 ['الرياض','غرناطة',12.5,7,15520000,4000,3187],
 ['شقراء','الصفراء',100,0,0,305,1311],
 ['الرياض','التعاون',76.92,3,9800000,4328,6857],
 ['الخرج','البدع',0,0,0,211,null],
 ['وادي الدواسر','العقيق',0,0,0,120,null],
 ['وادي الدواسر','أم سمرة',1,1,111600,129,null],
 ['الرين','الصفاء',0,0,0,92,null],
 ['الرياض','المروج',16.12,36,10811451,8000,14286],
 ['الرياض','الملك سلمان',33.33,4,10040000,2655,5324],
 ['ضرما','روافة',0,0,0,null,null],
]);
// All numeric fields are deterministic. Reject malformed/ambiguous grouping:
// "1,2" MUST NOT become 12, and percent signs are legal for growth only.
const num=(value,{percent=false}={})=>{
 if(typeof value==='number')return Number.isFinite(value)?value:null;
 let s=String(value??'').trim().replace(/[٠-٩]/g,x=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(x)))
  .replace(/[۰-۹]/g,x=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(x)))
  .replace(/[\u00A0\u202F]/g,'').replace(/\u066B/g,'.');
 const hasPct=/%|٪/.test(s);
 if(hasPct&&!percent)return null;
 if(hasPct){if(!/[%٪]$/.test(s))return null;s=s.slice(0,-1).trim();}
 const isPlain=/^-?\d+(?:\.\d+)?$/.test(s);
 const grouped=/^-?\d{1,3}(?:[,\u066C]\d{3})+(?:\.\d+)?$/.test(s);
 if(!isPlain&&!grouped)return null;
 const n=Number(s.replace(/[,\u066C]/g,''));
 return Number.isFinite(n)?n:null;
};
const text=v=>String(v??'').trim();
const norm=v=>text(v).replace(/[أإآٱ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/\s+/g,' ').toLowerCase();
const toPublicSample=()=>sample.map(([city,district,growthPct,transferCount,totalValueSar,residentialSarSqm,commercialSarSqm])=>
 Object.freeze({country:'SA',city,district,growthPct,transferCount,totalValueSar,
 residentialSarSqm,commercialSarSqm,sourceUrl:SOURCE_URL,observedOn:PAGE_INDEXED_AT,
 periodStart:null,periodEnd:null,recordClass:'NEIGHBORHOOD_AGGREGATE_INDEXED_UNVERIFIED',
 executedTransactionRecord:false,marketValuationEligible:false}));
function parseResearchCsv(csv,{sourceUrl=SOURCE_URL,observedOn=PAGE_INDEXED_AT}={}){
 if(typeof csv!=='string'||new TextEncoder().encode(csv).length>MAX_BYTES)throw Error('SUHAIL_RESEARCH_CSV_SIZE_LIMIT');
 let parsedSource;try{parsedSource=new URL(sourceUrl);}catch(_){}
 if(!parsedSource||parsedSource.protocol!=='https:'||!parsedSource.hostname.includes('.')||
    parsedSource.username||parsedSource.password)
  throw Error('SUHAIL_RESEARCH_SOURCE_REQUIRED');
 if(typeof observedOn!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(observedOn)||
  !Number.isFinite(Date.parse(observedOn+'T00:00:00Z'))||
  new Date(observedOn+'T00:00:00Z').toISOString().slice(0,10)!==observedOn)
  throw Error('SUHAIL_RESEARCH_OBSERVATION_DATE_INVALID');
 // Bounded RFC4180-compatible parser, including quoted delimiters and newlines.
 let cell='',row=[],rows=[],quoted=false;
 const push=()=>{row.push(cell.trim());cell='';if(row.some(x=>x!==''))rows.push(row);row=[];
  if(rows.length>MAX_ROWS+1)throw Error('SUHAIL_RESEARCH_ROW_LIMIT');};
 for(let i=0;i<csv.length;i++){
  const ch=csv[i];
  if(ch==='"'){
   if(quoted&&csv[i+1]==='"'){cell+='"';i++;}
   else if(!quoted&&cell.trim()==='')quoted=true;
   else if(quoted)quoted=false;
   else throw Error('SUHAIL_RESEARCH_CSV_QUOTE_INVALID');
  }else if(!quoted&&(ch===','||ch==='\n'||ch==='\r')){
   if(ch===','){row.push(cell.trim());cell='';}
   else{push();if(ch==='\r'&&csv[i+1]==='\n')i++;}
  }else cell+=ch;
 }
 if(quoted)throw Error('SUHAIL_RESEARCH_CSV_UNCLOSED_QUOTE');
 push();
 if(rows.length<2)throw Error('SUHAIL_RESEARCH_CSV_EMPTY');
 const headers=rows.shift().map(x=>norm(x.replace(/^\uFEFF/,'')));
 if(headers.length>30||new Set(headers).size!==headers.length)throw Error('SUHAIL_RESEARCH_COLUMNS_INVALID');
 const fields={
  city:['city','المدينة'],district:['district','الحي','اسم الحي'],
  transferCount:['transfercount','عدد الإفراغات','عدد الافراغات'],
  totalValueSar:['totalvaluesar','إجمالي القيمة','اجمالي القيمة'],
  residentialSarSqm:['residentialsarsqm','متوسط سعر المتر سكني','متوسط المتر السكني'],
  commercialSarSqm:['commercialsarsqm','متوسط سعر المتر تجاري','متوسط المتر التجاري'],
  growthPct:['growthpct','النمو','نسبة النمو'],
 };
 const col={};for(let [k,v] of Object.entries(fields)){
  col[k]=headers.findIndex(h=>v.some(alias=>norm(alias)===h));
 }
 if(col.city<0||col.district<0)throw Error('SUHAIL_RESEARCH_CITY_DISTRICT_REQUIRED');
 const rejected=[];const records=[];
 for(let i=0;i<rows.length;i++){
  const row=rows[i],get=k=>col[k]>=0?(row[col[k]]??''):'';
  const city=text(get('city')),district=text(get('district'));
  const transferCount=num(get('transferCount')),totalValueSar=num(get('totalValueSar'));
  const residentialSarSqm=num(get('residentialSarSqm')),commercialSarSqm=num(get('commercialSarSqm'));
  const growthPct=num(get('growthPct'),{percent:true});
  const isMissing=v=>!text(v)||/^(?:—|–|-|لا يوجد بيانات|غير متاح|n\/a)$/i.test(text(v));
  const malformed=Object.keys(fields).filter(k=>k!=='city'&&k!=='district').some(k=>
   !isMissing(get(k))&&num(get(k),{percent:k==='growthPct'})===null);
  if(!city||!district||city.length>120||district.length>120||malformed||
    (transferCount!==null&&(!Number.isInteger(transferCount)||transferCount<0||transferCount>10000000))||
    (totalValueSar!==null&&(totalValueSar<0||totalValueSar>1e15))||
    [residentialSarSqm,commercialSarSqm].some(x=>x!==null&&(x<0||x>2e7))||
    (growthPct!==null&&(growthPct< -100||growthPct>1e6))){
    rejected.push({row:i+2,reason:'INVALID_LOCATION_OR_AGGREGATE'});continue;
  }
  records.push({country:'SA',city,district,transferCount,totalValueSar,
   residentialSarSqm,commercialSarSqm,growthPct,sourceUrl,observedOn,
   periodStart:null,periodEnd:null,recordClass:'USER_IMPORTED_NEIGHBORHOOD_AGGREGATE_UNVERIFIED',
   executedTransactionRecord:false,marketValuationEligible:false});
 }
 return {records,rejected,recordClass:'NEIGHBORHOOD_RESEARCH_ONLY',autoValuationEnabled:false};
}

const sameMeasure=(a,b)=>['transferCount','totalValueSar','residentialSarSqm',
 'commercialSarSqm','growthPct'].every(k=>a[k]===b[k]);
const keyOf=r=>[norm(r.sourceUrl),norm(r.city),norm(r.district),r.observedOn].join('|');
// Add nonconflicting research snapshots only. Never lose the original public sample
// or silently overwrite divergent values for the same city/area/source/date.
function mergeNeighborhoodResearch(existing,incoming,{maxRows=MAX_ROWS}={}){
 if(!Array.isArray(existing)||!Array.isArray(incoming))throw Error('SUHAIL_RESEARCH_MERGE_INPUT_INVALID');
 if(!Number.isInteger(maxRows)||maxRows<1||maxRows>MAX_ROWS)throw Error('SUHAIL_RESEARCH_MAX_ROWS_INVALID');
 const rows=[],seen=new Map(),conflicts=[];
 let duplicates=0,added=0;
 function accept(record,index,side){
  if(!record||record.country!=='SA'||typeof record.sourceUrl!=='string'||
     typeof record.city!=='string'||!record.city.trim()||
     typeof record.district!=='string'||!record.district.trim()||
     !/^\d{4}-\d{2}-\d{2}$/.test(record.observedOn||'')||
     record.executedTransactionRecord!==false||record.marketValuationEligible!==false)
   throw Error('SUHAIL_RESEARCH_RECORD_INVALID');
  const key=keyOf(record),old=seen.get(key);
  if(old){
   if(sameMeasure(old,record)){duplicates++;return;}
   conflicts.push({source:side,row:index+1,city:record.city,district:record.district,
    sourceUrl:record.sourceUrl,observedOn:record.observedOn,reason:'CONFLICTING_NEIGHBORHOOD_SNAPSHOT'});
   return;
  }
  if(rows.length>=maxRows)throw Error('SUHAIL_RESEARCH_ROW_LIMIT');
  rows.push(record);seen.set(key,record);
  if(side==='incoming')added++;
 }
 existing.forEach((r,i)=>accept(r,i,'existing'));
 incoming.forEach((r,i)=>accept(r,i,'incoming'));
 return {records:rows,added,duplicates,conflicts,
  autoValuationEnabled:false,actualIndividualTransactionsImported:0};
}

function selectNeighborhoodRows(records,{city='',district=''}={}){
 if(!Array.isArray(records))throw Error('SUHAIL_RESEARCH_RECORDS_REQUIRED');
 const c=norm(city),d=norm(district);
 return records.filter(x=>(!c||norm(x.city)===c)&&(!d||norm(x.district).includes(d)));
}
function researchSummary(records){
 const cities=[...new Set(records.map(x=>x.city).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
 return {cities,cityCount:cities.length,neighborhoodRows:records.length,
  individualExecutedSales:0,verifiedMarketComparables:0,
  cannotDerivePropertyValuation:true,noPeriodVerified:true};
}
module.exports={SOURCE_URL,PAGE_INDEXED_AT,MAX_ROWS,MAX_BYTES,
 toPublicSample,parseResearchCsv,mergeNeighborhoodResearch,selectNeighborhoodRows,researchSummary};
