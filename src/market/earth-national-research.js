'use strict';
// Earth Saudi real-estate research catalog and local CSV evidence intake.
// No scraping, hidden APIs, identity access, title certification or executed-deed trust.
const {rowsFromCsv,MAX_CSV_BYTES,MAX_CSV_ROWS}=require('./public-dataset-import');
const FEATURES=Object.freeze([
 {id:'TRANSACTION_TABLE',label:'جدول الصفقات العقارية',url:'https://earthapp.com.sa/transaction',kind:'REPORTED_SALE'},
 {id:'VALUE_ESTIMATE',label:'قيم أرضك',url:'https://map.earthapp.com.sa/value',kind:'VALUE_INDICATION'},
 {id:'DIGITAL_PLANS',label:'المخططات الشاملة',url:'https://map.earthapp.com.sa/digital-plans?view=%D8%A7%D9%84%D9%85%D8%AE%D8%B7%D8%B7%D8%A7%D8%AA%20%D8%A7%D9%84%D8%B4%D8%A7%D9%85%D9%84%D8%A9',kind:'PLANNING_CONTEXT'},
 {id:'MARKET_ANALYSIS',label:'تحليل السوق العقاري',url:'https://map.earthapp.com.sa/charts?view=%D8%AA%D8%AD%D9%84%D9%8A%D9%84+%D8%A7%D9%84%D8%B3%D9%88%D9%82+%D8%A7%D9%84%D8%B9%D9%82%D8%A7%D8%B1%D9%8A',kind:'MARKET_AGGREGATE'},
 {id:'REAL_ESTATE_INDICATORS',label:'المؤشرات العقارية',url:'https://map.earthapp.com.sa/charts?view=%D8%A7%D9%84%D9%85%D8%A4%D8%B4%D8%B1%D8%A7%D8%AA+%D8%A7%D9%84%D8%B9%D9%82%D8%A7%D8%B1%D9%8A%D8%A9',kind:'MARKET_AGGREGATE'},
 {id:'MAP',label:'الخريطة الرقمية',url:'https://map.earthapp.com.sa/',kind:'GEOGRAPHIC_CONTEXT'},
 {id:'SALES_MAP',label:'الصفقات العقارية على الخريطة',url:'https://map.earthapp.com.sa/deals?view=%D8%A7%D9%84%D8%B5%D9%81%D9%82%D8%A7%D8%AA+%D8%A7%D9%84%D8%B9%D9%82%D8%A7%D8%B1%D9%8A%D8%A9',kind:'REPORTED_SALE'},
 {id:'REAL_ESTATE_REGISTER',label:'السجل العقاري (عرض أرض)',url:'https://map.earthapp.com.sa/deals?view=%D8%A7%D9%84%D8%B3%D8%AC%D9%84+%D8%A7%D9%84%D8%B9%D9%82%D8%A7%D8%B1%D9%8A',kind:'REGISTRY_CONTEXT'},
 {id:'RENTAL_DEALS',label:'الصفقات الإيجارية',url:'https://map.earthapp.com.sa/deals?view=%D8%A7%D9%84%D8%B5%D9%81%D9%82%D8%A7%D8%AA+%D8%A7%D9%84%D8%A5%D9%8A%D8%AC%D8%A7%D8%B1%D9%8A%D8%A9',kind:'REPORTED_RENT'},
 {id:'OFFERS',label:'العروض العقارية',url:'https://map.earthapp.com.sa/offers',kind:'ASKING_OFFER'},
].map(x=>Object.freeze(x)));
const BY_FEATURE=Object.freeze(Object.fromEntries(FEATURES.map(x=>[x.id,x])));
const TYPE_BY_KIND=Object.freeze({
 REPORTED_SALE:'THIRD_PARTY_REPORTED_TRANSACTION_UNVERIFIED',
 REPORTED_RENT:'THIRD_PARTY_REPORTED_LEASE_UNVERIFIED',
 ASKING_OFFER:'THIRD_PARTY_ASKING_OFFER_UNVERIFIED',
 VALUE_INDICATION:'THIRD_PARTY_VALUE_INDICATION_UNVERIFIED',
 PLANNING_CONTEXT:'THIRD_PARTY_PLANNING_CONTEXT_UNVERIFIED',
 MARKET_AGGREGATE:'THIRD_PARTY_AGGREGATE_UNVERIFIED',
 GEOGRAPHIC_CONTEXT:'THIRD_PARTY_MAP_CONTEXT_UNVERIFIED',
 REGISTRY_CONTEXT:'THIRD_PARTY_REGISTRY_VIEW_UNVERIFIED',
});
const headerMap=Object.freeze({
 city:['city','المدينة'],district:['district','الحي','اسم الحي'],
 cityDistrict:['city/district','المدينة/الحي','المدينة / الحي','المدينة والحي'],
 region:['region','المنطقة'],featureId:['featureid','نوع المصدر','feature'],
 recordId:['recordid','رقم الصفقة','الرقم المرجعي للصفقة','الرقم المرجعي','رقم العقد','معرف السجل'],
 eventDate:['eventdate','transactiondate','تاريخ الصفقة','تاريخ العقد','تاريخ الإفراغ','التاريخ','التاريخ الميلادي'],
 amountSar:['amountsar','price','سعر الصفقة','قيمة الصفقة','السعر','السعر الإجمالي','سعر المنطقة','الإيجار السنوي'],
 areaSqm:['areasqm','area','المساحة','مساحة العقار'],
 planNumber:['plannumber','رقم المخطط'],
 parcelNumber:['parcelnumber','رقم القطعة'],
 assetType:['assettype','نوع العقار'],
});
const normalize=s=>String(s??'').trim().replace(/[أإآٱ]/g,'ا').replace(/ة/g,'ه')
 .replace(/ى/g,'ي').replace(/[\s_.-]+/g,'').toLowerCase();
const arDigits=s=>String(s??'').trim().replace(/[٠-٩]/g,x=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(x)))
 .replace(/[۰-۹]/g,x=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(x)));
function moneyNumber(value){
 if(value===undefined||value===null||String(value).trim()==='')return null;
 const s=arDigits(value).replace(/\u066B/g,'.').replace(/[\u00a0\u202f]/g,'');
 const plain=/^\d+(?:\.\d+)?$/.test(s),grouped=/^\d{1,3}(?:[,\u066C]\d{3})+(?:\.\d+)?$/.test(s);
 if(!plain&&!grouped)return NaN;
 const n=Number(s.replace(/[,٬]/g,''));return Number.isFinite(n)?n:NaN;
}
function isoDate(value){
 const v=arDigits(value);
 if(!/^\d{4}-\d\d-\d\d$/.test(v))return null;
 const t=Date.parse(v+'T00:00:00Z');
 return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===v?v:null;
}
function importEarthResearchCsv(csv,{featureId,observedOn,asOf=new Date()}={}){
 const feature=BY_FEATURE[featureId];
 if(!feature)throw Error('EARTH_FEATURE_NOT_SUPPORTED');
 if(typeof csv!=='string'||new TextEncoder().encode(csv).length>MAX_CSV_BYTES)
  throw Error('EARTH_CSV_TOO_LARGE');
 const today=asOf instanceof Date?asOf.toISOString().slice(0,10):isoDate(asOf);
 const observed=isoDate(observedOn);
 if(!observed||!today||observed>today)throw Error('EARTH_OBSERVED_DATE_INVALID');
 const parsed=rowsFromCsv(csv);
 if(parsed.records.length>MAX_CSV_ROWS)throw Error('EARTH_TOO_MANY_ROWS');
 const names=parsed.columns.map(normalize);
 if(new Set(names).size!==names.length)throw Error('EARTH_DUPLICATED_HEADERS');
 const idx={};
 for(const [field,aliases] of Object.entries(headerMap))
  idx[field]=names.findIndex(name=>aliases.some(alias=>normalize(alias)===name));
 if((idx.city<0||idx.district<0)&&idx.cityDistrict<0)
  throw Error('EARTH_MISSING_CITY_DISTRICT_COLUMNS');
 const accepted=[],rejected=[];
 for(const r of parsed.records){
  const get=key=>idx[key]>=0?String(r.columns[parsed.columns[idx[key]]]??'').trim():'';
  // Earth export may combine city and neighborhood in one 'المدينة/الحي' field.
  const pair=get('cityDistrict');
  const slash=pair.indexOf('/');
  const pairCity=slash>0?pair.slice(0,slash).trim():'';
  const pairDistrict=slash>0?pair.slice(slash+1).trim():'';
  const city=get('city')||pairCity,district=get('district')||pairDistrict,region=get('region');
  const contradictoryPair=Boolean(pairCity&&get('city')&&normalize(pairCity)!==normalize(get('city'))||
    pairDistrict&&get('district')&&normalize(pairDistrict)!==normalize(get('district')));
  const recordId=get('recordId'),eventDate=get('eventDate'),amount=moneyNumber(get('amountSar')),
   area=moneyNumber(get('areaSqm')),planNumber=get('planNumber'),
   parcelNumber=get('parcelNumber'),assetType=get('assetType');
  const issues=[];
  if(!city||!district||city.length>130||district.length>130)issues.push('LOCATION_REQUIRED');
  if(contradictoryPair)issues.push('COMBINED_CITY_DISTRICT_CONFLICT');
  if([recordId,planNumber,parcelNumber,assetType,region].some(x=>x.length>130))
   issues.push('TEXT_FIELD_TOO_LONG');
  if(Number.isNaN(amount)||(amount!==null&&(amount<=0||amount>1e15)))issues.push('AMOUNT_INVALID');
  if(Number.isNaN(area)||(area!==null&&(area<=0||area>1e9)))issues.push('AREA_INVALID');
  const date=get('eventDate')?isoDate(get('eventDate')):null;
  if(get('eventDate')&&(!date||date>observed))issues.push('EVENT_DATE_INVALID');
  if(idx.featureId>=0&&get('featureId')&&get('featureId')!==featureId)
   issues.push('CROSS_FEATURE_ROW_MISMATCH');
  // A third-party displayed sale/lease may be transcribed as research context,
  // but missing ID/date cannot be silently treated as a verified transaction.
  if(issues.length){rejected.push({row:r.line,issues});continue;}
  accepted.push(Object.freeze({
   country:'SA',source:'EARTH_APP',sourceFeatureId:featureId,
   evidenceKind:feature.kind,evidenceClass:TYPE_BY_KIND[feature.kind],
   sourceUrl:feature.url,observedOn:observed,region:region||null,city,district,
   recordId:recordId||null,eventDate:date,amountSar:amount,areaSqm:area,
   planNumber:planNumber||null,parcelNumber:parcelNumber||null,assetType:assetType||null,
   transactionIndependentlyVerified:false,officialRegistryVerified:false,
   executedTransactionRecord:false,askingPriceVerified:false,
   marketValuationEligible:false,professionalReportAuthorized:false,
  }));
 }
 return {records:accepted,rejected,sourceFeatureId:featureId,accepted:accepted.length,
  independentExecutedSales:0,independentExecutedLeases:0,autoValuationEnabled:false};
}
function researchId(r){
 const locator=r.recordId?'ID:'+normalize(r.recordId):
  'LOC:'+normalize(r.city)+':'+normalize(r.district)+':'+normalize(r.planNumber)+
   ':'+normalize(r.parcelNumber)+':'+normalize(r.eventDate)+':'+String(r.amountSar);
 return [r.sourceFeatureId,locator,r.observedOn].join('|');
}
function researchEqual(a,b){
 return ['sourceFeatureId','city','district','recordId','eventDate','amountSar','areaSqm',
  'planNumber','parcelNumber','assetType','region'].every(k=>a[k]===b[k]);
}
function mergeEarthResearch(previous,incoming,{limit=2500}={}){
 if(!Array.isArray(previous)||!Array.isArray(incoming)||!Number.isInteger(limit)||limit<1||limit>2500)
  throw Error('EARTH_RESEARCH_MERGE_INVALID');
 const records=[],seen=new Map(),conflicts=[];let duplicates=0,added=0;
 for(const [side,source] of [['previous',previous],['incoming',incoming]]){
  for(const row of source){
   if(!BY_FEATURE[row?.sourceFeatureId]||row.source!=='EARTH_APP'||
      row.executedTransactionRecord!==false||row.marketValuationEligible!==false||
      row.sourceUrl!==BY_FEATURE[row.sourceFeatureId].url)
    throw Error('EARTH_RESEARCH_RECORD_UNTRUSTED');
   const id=researchId(row),old=seen.get(id);
   if(old){
    if(researchEqual(old,row)){duplicates++;continue;}
    conflicts.push({sourceFeatureId:row.sourceFeatureId,city:row.city,
      district:row.district,recordId:row.recordId,code:'EARTH_RESEARCH_RECORD_CONFLICT'});
    continue;
   }
   if(records.length>=limit)throw Error('EARTH_RESEARCH_MERGE_LIMIT');
   seen.set(id,row);records.push(row);if(side==='incoming')added++;
  }
 }
 return {records,duplicates,added,conflicts,
  verifiedTransactions:0,autoValuationEnabled:false};
}
function filterEarthResearch(records,{city='',featureId=''}={}){
 if(!Array.isArray(records))throw Error('EARTH_RECORDS_INVALID');
 return records.filter(r=>(!city||normalize(r.city)===normalize(city))&&
  (!featureId||r.sourceFeatureId===featureId));
}
function earthResearchSummary(records){
 return {features:FEATURES.length,rows:records.length,
  cities:[...new Set(records.map(r=>r.city))].sort((a,b)=>a.localeCompare(b,'ar')),
  independentlyVerifiedTransactions:0,independentlyVerifiedTitles:0,
  autoValuationEnabled:false};
}
module.exports={FEATURES,BY_FEATURE,TYPE_BY_KIND,importEarthResearchCsv,
 mergeEarthResearch,filterEarthResearch,earthResearchSummary};
