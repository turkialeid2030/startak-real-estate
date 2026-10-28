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
const num=v=>{
 if(typeof v==='number')return Number.isFinite(v)?v:null;
 const s=String(v??'').trim().replace(/[٠-٩]/g,x=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(x)))
  .replace(/[۰-۹]/g,x=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(x)))
  .replace(/[,٬\s]/g,'').replace(/٫/g,'.').replace(/%|٪/g,'');
 return /^\d+(?:\.\d+)?$/.test(s)?Number(s):null;
};
const text=v=>String(v??'').trim();
const norm=v=>text(v).replace(/[أإآٱ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/\s+/g,' ').toLowerCase();
const toPublicSample=()=>sample.map(([city,district,growthPct,transferCount,totalValueSar,residentialSarSqm,commercialSarSqm])=>
 Object.freeze({country:'SA',city,district,growthPct,transferCount,totalValueSar,
 residentialSarSqm,commercialSarSqm,sourceUrl:SOURCE_URL,observedOn:PAGE_INDEXED_AT,
 periodStart:null,periodEnd:null,recordClass:'NEIGHBORHOOD_AGGREGATE_INDEXED_UNVERIFIED',
 executedTransactionRecord:false,marketValuationEligible:false}));
function parseResearchCsv(csv,{sourceUrl=SOURCE_URL,observedOn=PAGE_INDEXED_AT}={}){
 if(typeof csv!=='string'||csv.length>MAX_BYTES)throw Error('SUHAIL_RESEARCH_CSV_SIZE_LIMIT');
 if(typeof sourceUrl!=='string'||!/^https:\/\/[^@\s/]+(?:\/.*)?$/i.test(sourceUrl))
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
  const growthPct=num(get('growthPct'));
  if(!city||!district||city.length>120||district.length>120||
    (transferCount!==null&&(!Number.isInteger(transferCount)||transferCount>10000000))||
    (totalValueSar!==null&&totalValueSar>1e15)||
    [residentialSarSqm,commercialSarSqm].some(x=>x!==null&&x>2e7)||
    (growthPct!==null&&growthPct>1e6)){
    rejected.push({row:i+2,reason:'INVALID_LOCATION_OR_AGGREGATE'});continue;
  }
  records.push({country:'SA',city,district,transferCount,totalValueSar,
   residentialSarSqm,commercialSarSqm,growthPct,sourceUrl,observedOn,
   periodStart:null,periodEnd:null,recordClass:'USER_IMPORTED_NEIGHBORHOOD_AGGREGATE_UNVERIFIED',
   executedTransactionRecord:false,marketValuationEligible:false});
 }
 return {records,rejected,recordClass:'NEIGHBORHOOD_RESEARCH_ONLY',autoValuationEnabled:false};
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
 toPublicSample,parseResearchCsv,selectNeighborhoodRows,researchSummary};
