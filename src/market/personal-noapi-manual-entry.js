'use strict';
// Personal, user-operated intake. No provider API, page fetch, browser account
// automation or credential access. Research observations are never promoted to
// authenticated sales, independently priced rent or certified appraisals.
const {SOURCES,importNationalSourcesCsv}=require('./saudi-national-intelligence-sources');
// Kite has month-only source observations and a separate optional connector;
 // it cannot be entered through the day-specific no-API reported-sale form.
const PERSONAL_SOURCES=Object.freeze(SOURCES.filter(x=>x.id!=='KITE_MOJ_QUARTERLY'));
const BY_SOURCE=Object.freeze(Object.fromEntries(PERSONAL_SOURCES.map(x=>[x.id,x])));
const METRIC_UNITS=Object.freeze({
 sale_price_sar:'SAR',estimated_value_sar:'SAR',
 deal_count:'COUNT',deal_value_sar:'SAR',avg_sale_sar:'SAR',
 avg_rent_sar:'SAR',avg_sqm_sar:'SAR_PER_SQM',
 area_sqm:'SQM',rent_contract_count:'COUNT',
});
const AGGREGATE_METRICS=Object.freeze([
 'avg_sale_sar','avg_rent_sar','avg_sqm_sar','deal_count',
 'rent_contract_count','deal_value_sar','area_sqm',
]);
const COLUMNS=Object.freeze([
 'source','kind','city','district','recordId','eventDate',
 'periodStart','periodEnd','metricName','metricValue','unit',
 'sourceUrl','assetType','rangeLowSar','rangeHighSar',
 'confidenceLabel','modelAsOf',
]);
function csvCell(v){
 const s=v===null||v===undefined?'':String(v);
 return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;
}
function buildPersonalNoApiResearchEntry(data,{asOf=new Date()}={}){
 if(!data||typeof data!=='object'||Array.isArray(data))
  throw Error('PERSONAL_NOAPI_INPUT_INVALID');
 const source=Object.prototype.hasOwnProperty.call(BY_SOURCE,data.sourceId)?
  BY_SOURCE[data.sourceId]:null;
 if(!source)throw Error('PERSONAL_NOAPI_SOURCE_UNAVAILABLE');
 const kind=data.kind;
 if(typeof kind!=='string'||!source.allowed.includes(kind))
  throw Error('PERSONAL_NOAPI_CLASS_OUT_OF_SCOPE');
 let metricName='',metricUnit='',metricValue='';
 if(kind==='OFFICIAL_REPORTED_SALE'||kind==='THIRD_PARTY_REPORTED_SALE'){
  metricName='sale_price_sar';metricUnit='SAR';metricValue=data.metricValue;
 }else if(kind==='EXTERNAL_AVM_ESTIMATE'){
  metricName='estimated_value_sar';metricUnit='SAR';metricValue=data.metricValue;
 }else if(kind==='OFFICIAL_AGGREGATE'||kind==='THIRD_PARTY_AGGREGATE'){
  if(!AGGREGATE_METRICS.includes(data.metricName))
   throw Error('PERSONAL_NOAPI_METRIC_OUT_OF_SCOPE');
  metricName=data.metricName;metricUnit=METRIC_UNITS[metricName];
  metricValue=data.metricValue;
 }else if(kind!=='RESEARCH_NOTE'){
  throw Error('PERSONAL_NOAPI_CLASS_OUT_OF_SCOPE');
 }
 // Canonical import validates actual date, type, asset, numeric range and
 // registered HTTPS host. The user supplies the observation; we invent none.
 const fields={
  source:data.sourceId,kind,city:data.city,district:data.district,
  recordId:kind==='RESEARCH_NOTE'?'':data.recordId,
  eventDate:data.eventDate,periodStart:data.periodStart,periodEnd:data.periodEnd,
  metricName,metricValue,unit:metricUnit,
  sourceUrl:data.sourceUrl||source.url,assetType:data.assetType,
  rangeLowSar:data.rangeLowSar,rangeHighSar:data.rangeHighSar,
  confidenceLabel:data.confidenceLabel,modelAsOf:data.modelAsOf,
 };
 const csv=[COLUMNS.join(','),COLUMNS.map(key=>csvCell(fields[key])).join(',')].join('\n');
 const result=importNationalSourcesCsv(csv,{observedOn:data.observedOn,asOf});
 if(result.records.length!==1||result.rejected.length){
  const reasons=result.rejected[0]?.issues||['RECORD_REJECTED'];
  throw Error('PERSONAL_NOAPI_CAPTURE_REJECTED:'+reasons.join(','));
 }
 const row=result.records[0];
 if(row.sourceRecordAuthenticated!==false||row.marketValuationEligible!==false||
    row.independentMarketPriceVerified!==false||row.professionalReportAuthorized!==false)
  throw Error('PERSONAL_NOAPI_UNEXPECTED_AUTHORITY');
 return row;
}
module.exports={PERSONAL_SOURCES,BY_SOURCE,METRIC_UNITS,AGGREGATE_METRICS,COLUMNS,
 buildPersonalNoApiResearchEntry};
