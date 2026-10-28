'use strict';
// Public research registry. Source type and imported record type must not be conflated.
// The only supported data ingest is explicit local user CSV; NO automatic scraping,
// API scraping, account bypass, valuation authorization or private identity collection.
const {rowsFromCsv,MAX_CSV_BYTES,MAX_CSV_ROWS}=require('./public-dataset-import');
const SOURCES=Object.freeze([
 {id:'REGA_REI',label:'مؤشرات الهيئة العامة للعقار',url:'https://rei.rega.gov.sa/ar',
  domain:'rei.rega.gov.sa',origin:'SA_GOV_OFFICIAL',allowed:['OFFICIAL_AGGREGATE']},
 {id:'MOJ_SREM',label:'البورصة العقارية — وزارة العدل',url:'https://srem.moj.gov.sa/',
  domain:'srem.moj.gov.sa',origin:'SA_GOV_OFFICIAL',allowed:['OFFICIAL_REPORTED_SALE']},
 {id:'MOJ_REPORTS',label:'التقارير التفاعلية — وزارة العدل',url:'https://www.moj.gov.sa/ar/OpenData/PowerBIReport/Pages/default.aspx',
  domain:'moj.gov.sa',origin:'SA_GOV_OFFICIAL',allowed:['OFFICIAL_AGGREGATE']},
 {id:'EHSIBHA',label:'احسبها — صفحة IVE',url:'https://ehsibha.sa/ive',
  domain:'ehsibha.sa',origin:'THIRD_PARTY_UNCONFIRMED',allowed:['RESEARCH_NOTE']},
 {id:'PASEETAH',label:'بسيطة — البيانات العقارية',url:'https://paseetah.com/',
  domain:'paseetah.com',origin:'THIRD_PARTY_ANALYTICS',
  allowed:['THIRD_PARTY_AGGREGATE','THIRD_PARTY_REPORTED_SALE','EXTERNAL_AVM_ESTIMATE','RESEARCH_NOTE']},
 {id:'GREM_AI',label:'GREM AI — تقييم آلي',url:'https://ai.grem.capital/ar',
  domain:'grem.capital',origin:'THIRD_PARTY_AVM',allowed:['EXTERNAL_AVM_ESTIMATE','RESEARCH_NOTE']},
 {id:'TATHMIN',label:'تثمين — صفحة التقييم',url:'https://tathmin.online/valuation',
  domain:'tathmin.online',origin:'THIRD_PARTY_UNCONFIRMED',allowed:['RESEARCH_NOTE']},
 {id:'ART_OF_VALUE',label:'فن القيمة — تقييم مهني',url:'https://artofvalue.sa/',
  domain:'artofvalue.sa',origin:'INDEPENDENT_PROFESSIONAL_REFERENCE',allowed:['RESEARCH_NOTE']},
 {id:'THREE_QAR_AI',label:'3qar AI — مستشار عقاري',url:'https://3qar.ai/',
  domain:'3qar.ai',origin:'THIRD_PARTY_AI_ADVISOR',allowed:['RESEARCH_NOTE']},
].map(x=>Object.freeze({...x,allowed:Object.freeze(x.allowed)})));
const BY_ID=Object.freeze(Object.fromEntries(SOURCES.map(x=>[x.id,x])));
const norm=s=>String(s??'').trim().replace(/[أإآٱ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي')
 .replace(/[\s_.-]+/g,'').toLowerCase();
function date(v){const x=String(v??'').trim().replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)))
 .replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c)));
 if(!/^\d{4}-\d\d-\d\d$/.test(x))return null;
 const t=Date.parse(x+'T00:00:00Z');return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===x?x:null;}
function metric(v){
 if(v===undefined||v===null||!String(v).trim())return null;
 let s=String(v).trim().replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)))
  .replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c)))
  .replace(/٫/g,'.').replace(/[\u00a0\u202f]/g,'');
 if(!/^\d+(?:\.\d+)?$/.test(s)&&!/^\d{1,3}(?:[,٬]\d{3})+(?:\.\d+)?$/.test(s))
  return NaN;
 const n=Number(s.replace(/[,٬]/g,''));
 return Number.isFinite(n)?n:NaN;
}
function officialUrl(value,src){
 if(typeof value!=='string'||value.length>2000)return null;
 try{
  const u=new URL(value);
  if(u.protocol!=='https:'||u.username||u.password||
   !(u.hostname===src.domain||u.hostname.endsWith('.'+src.domain)))return null;
  u.hash='';
  for(const k of [...u.searchParams.keys()])
   if(k.toLowerCase().startsWith('utm_')||['gclid','fbclid'].includes(k.toLowerCase()))
    u.searchParams.delete(k);
  return u.toString();
 }catch{return null;}
}
const headers=Object.freeze({
 source:['source','sourceid','المصدر','المنصة'],
 city:['city','المدينة'],district:['district','الحي'],
 kind:['kind','recordclass','نوع السجل','تصنيف البيانات'],
 recordId:['recordid','رقم الصفقة','رقم المرجع','معرف السجل'],
 periodStart:['periodstart','بداية الفترة'],periodEnd:['periodend','نهاية الفترة'],
 eventDate:['eventdate','تاريخ الصفقة','تاريخ الإفراغ'],
 metricName:['metricname','اسم المؤشر','المؤشر'],
 metricValue:['metricvalue','قيمة المؤشر','القيمة'],
 unit:['unit','وحدة القياس'],sourceUrl:['sourceurl','رابط المصدر'],
 assetType:['assettype','نوع العقار'],
});
const allowedMetrics=Object.freeze({
 OFFICIAL_AGGREGATE:['deal_count','deal_value_sar','avg_sale_sar','avg_rent_sar','avg_sqm_sar','area_sqm','rent_contract_count'],
 THIRD_PARTY_AGGREGATE:['deal_count','deal_value_sar','avg_sale_sar','avg_rent_sar','avg_sqm_sar','area_sqm','rent_contract_count'],
 OFFICIAL_REPORTED_SALE:['sale_price_sar'],
 THIRD_PARTY_REPORTED_SALE:['sale_price_sar'],
 EXTERNAL_AVM_ESTIMATE:['estimated_value_sar'],
 RESEARCH_NOTE:[],
});
const unitByMetric=Object.freeze({deal_count:'COUNT',rent_contract_count:'COUNT',
 deal_value_sar:'SAR',avg_sale_sar:'SAR',avg_rent_sar:'SAR',avg_sqm_sar:'SAR_PER_SQM',
 area_sqm:'SQM',sale_price_sar:'SAR',estimated_value_sar:'SAR'});
function importNationalSourcesCsv(csv,{observedOn,asOf=new Date()}={}){
 if(typeof csv!=='string'||new TextEncoder().encode(csv).length>MAX_CSV_BYTES)
  throw Error('NATIONAL_RESEARCH_CSV_SIZE');
 const observation=date(observedOn);
 const today=asOf instanceof Date?asOf.toISOString().slice(0,10):date(asOf);
 if(!observation||!today||observation>today)throw Error('NATIONAL_RESEARCH_OBSERVATION_INVALID');
 const {columns,records}=rowsFromCsv(csv);
 if(records.length>MAX_CSV_ROWS)throw Error('NATIONAL_RESEARCH_ROWS_LIMIT');
 const columnsNorm=columns.map(norm);
 if(new Set(columnsNorm).size!==columnsNorm.length)throw Error('NATIONAL_RESEARCH_DUPLICATE_COLUMNS');
 const index={};
 for(const [name,aliases] of Object.entries(headers))
  index[name]=columnsNorm.findIndex(col=>aliases.some(a=>norm(a)===col));
 for(const name of ['source','kind','city','district'])if(index[name]<0)
  throw Error('NATIONAL_RESEARCH_REQUIRED_COLUMN_'+name);
 const accepted=[],rejected=[];
 for(const row of records){
  const cell=name=>index[name]>=0?String(row.columns[columns[index[name]]]??'').trim():'';
  const source=BY_ID[cell('source')],kind=cell('kind');
  const city=cell('city'),district=cell('district'),recordId=cell('recordId');
  const metricName=cell('metricName'),unit=cell('unit'),assetType=cell('assetType');
  const val=metric(cell('metricValue'));
  const periodStart=cell('periodStart')?date(cell('periodStart')):null;
  const periodEnd=cell('periodEnd')?date(cell('periodEnd')):null;
  const eventDate=cell('eventDate')?date(cell('eventDate')):null;
  const url=source?officialUrl(cell('sourceUrl')||source.url,source):null;
  const aggregate=['OFFICIAL_AGGREGATE','THIRD_PARTY_AGGREGATE'].includes(kind);
  const transaction=['OFFICIAL_REPORTED_SALE','THIRD_PARTY_REPORTED_SALE'].includes(kind);
  const issues=[];
  if(!source)issues.push('SOURCE_NOT_REGISTERED');
  if(!source?.allowed.includes(kind))issues.push('KIND_NOT_ALLOWED_FOR_SOURCE');
  if(!url)issues.push('SOURCE_URL_UNTRUSTED');
  if(!city||!district||city.length>120||district.length>120)issues.push('LOCATION_INVALID');
  if(recordId.length>130||assetType.length>130)issues.push('REFERENCE_TOO_LONG');
  if(Number.isNaN(val)||val!==null&&(val<0||val>1e16))issues.push('METRIC_VALUE_INVALID');
  if(kind==='RESEARCH_NOTE'){
   if(val!==null||metricName||unit||recordId||eventDate||periodStart||periodEnd)
    issues.push('NOTE_CANNOT_ASSERT_MEASUREMENT');
  }else{
   if(!allowedMetrics[kind]?.includes(metricName)||unitByMetric[metricName]!==unit||val===null)
    issues.push('METRIC_AND_UNIT_MISMATCH');
   if(val!==null&&!(val>0)&&!aggregate)issues.push('NONPOSITIVE_PRICE');
   if(aggregate&&(!periodStart||!periodEnd||periodStart>periodEnd||
     periodEnd>observation))issues.push('AGGREGATE_PERIOD_REQUIRED');
   if(!aggregate&&(periodStart||periodEnd))issues.push('NON_AGGREGATE_PERIOD_INVALID');
   if(transaction&&(!recordId||!eventDate||eventDate>observation))
    issues.push('TRANSACTION_REPORTED_REFERENCE_DATE_REQUIRED');
   if(kind==='EXTERNAL_AVM_ESTIMATE'&&(eventDate||!recordId))
    issues.push('AVM_REFERENCE_REQUIRED');
  }
  if(cell('eventDate')&&!eventDate||cell('periodStart')&&!periodStart||
    cell('periodEnd')&&!periodEnd)issues.push('DATE_INVALID');
  if(issues.length){rejected.push({line:row.line,issues});continue;}
  accepted.push(Object.freeze({sourceId:source.id,origin:source.origin,
   evidenceClass:kind,sourceUrl:url,country:'SA',city,district,
   assetType:assetType||null,recordId:recordId||null,observedOn:observation,
   periodStart,periodEnd,eventDate,metricName:metricName||null,metricValue:val,
   metricUnit:unit||null,personalResearch:true,
   officialSourcePage:source.origin==='SA_GOV_OFFICIAL',
   sourceRecordAuthenticated:false,executedTransactionRecord:false,
   independentMarketPriceVerified:false,marketValuationEligible:false,
   professionalReportAuthorized:false}));
 }
 return {records:accepted,rejected,aggregateCount:accepted.filter(x=>x.evidenceClass.includes('AGGREGATE')).length,
  independentVerifiedExecutedSales:0,marketValuationEligible:false};
}
function identity(row){
 return [row.sourceId,row.evidenceClass,row.recordId||'',norm(row.city),norm(row.district),
  row.periodStart||'',row.periodEnd||'',row.metricName||'',row.observedOn].join('|');
}
function equivalent(a,b){
 return ['sourceId','evidenceClass','sourceUrl','city','district','assetType',
 'recordId','periodStart','periodEnd','eventDate','metricName','metricValue','metricUnit']
  .every(key=>a[key]===b[key]);
}
function mergeNationalResearch(existing,incoming,{limit=1500}={}){
 if(!Array.isArray(existing)||!Array.isArray(incoming)||!Number.isInteger(limit)||
  limit<1||limit>1500)throw Error('NATIONAL_RESEARCH_MERGE_INPUT_INVALID');
 const records=[],seen=new Map(),conflicts=[];let duplicates=0,added=0;
 for(const [source,values] of [['existing',existing],['incoming',incoming]]){
  for(const x of values){
   if(!BY_ID[x?.sourceId]?.allowed.includes(x.evidenceClass)||x.personalResearch!==true||
    x.marketValuationEligible!==false||x.executedTransactionRecord!==false||
    !officialUrl(x.sourceUrl,BY_ID[x.sourceId]))
    throw Error('NATIONAL_RESEARCH_UNTRUSTED_RECORD');
   const key=identity(x),last=seen.get(key);
   if(last){
    if(equivalent(last,x)){duplicates++;continue;}
    conflicts.push({sourceId:x.sourceId,recordId:x.recordId,city:x.city,
     district:x.district,reason:'DUPLICATE_REFERENCE_CONFLICT'});continue;
   }
   if(records.length>=limit)throw Error('NATIONAL_RESEARCH_LIMIT');
   seen.set(key,x);records.push(x);if(source==='incoming')added++;
  }
 }
 return {records,added,duplicates,conflicts,autoValuationEnabled:false,verifiedSales:0};
}
function filterNationalResearch(records,{sourceId='',city='',evidenceClass=''}={}){
 if(!Array.isArray(records))throw Error('NATIONAL_RESEARCH_INPUT_INVALID');
 return records.filter(x=>(!sourceId||x.sourceId===sourceId)&&
  (!city||norm(x.city)===norm(city))&&(!evidenceClass||x.evidenceClass===evidenceClass));
}
function summarizeNationalResearch(records){
 return {sources:SOURCES.length,imported:records.length,
 cities:[...new Set(records.map(x=>x.city))].sort((a,b)=>a.localeCompare(b,'ar')),
 verifiedExecutedSales:0,certifiedValues:0};
}
module.exports={SOURCES,BY_ID,importNationalSourcesCsv,mergeNationalResearch,
 filterNationalResearch,summarizeNationalResearch};
