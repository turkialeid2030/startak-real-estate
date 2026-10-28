'use strict';
// Saudi national listing-source catalog. Personal manual research intake, not a crawler/API.
// Asking prices, projects and buyer requests are NEVER executed sale records.
const {rowsFromCsv,MAX_CSV_ROWS,MAX_CSV_BYTES}=require('./public-dataset-import');
const SOURCES=Object.freeze([
 Object.freeze({id:'AQAR',nameAr:'عقار',baseUrl:'https://sa.aqar.fm/',domains:['aqar.fm'],
  capabilities:['SALE_OFFER','RENT_OFFER','PROJECT_INDICATIVE']}),
 Object.freeze({id:'HARAJ',nameAr:'حراج',baseUrl:'https://haraj.com.sa/',domains:['haraj.com.sa'],
  capabilities:['SALE_OFFER','RENT_OFFER']}),
 Object.freeze({id:'BAYUT',nameAr:'بيوت السعودية',baseUrl:'https://www.bayut.sa/',domains:['bayut.sa'],
  capabilities:['SALE_OFFER','RENT_OFFER','PROJECT_INDICATIVE']}),
 Object.freeze({id:'PROPERTY_FINDER',nameAr:'بروبرتي فايندر',baseUrl:'https://www.propertyfinder.sa/',domains:['propertyfinder.sa'],
  capabilities:['SALE_OFFER','RENT_OFFER','PROJECT_INDICATIVE']}),
 Object.freeze({id:'WASALT',nameAr:'وصلت',baseUrl:'https://wasalt.sa/AR',domains:['wasalt.sa'],
  capabilities:['SALE_OFFER','RENT_OFFER','PROJECT_INDICATIVE','AUCTION_ASK']}),
 Object.freeze({id:'SAKANI',nameAr:'سكني',baseUrl:'https://sakani.sa/',domains:['sakani.sa'],
  capabilities:['SALE_OFFER','PROJECT_INDICATIVE']}),
 Object.freeze({id:'DEAL',nameAr:'ديل',baseUrl:'https://dealapp.sa/',domains:['dealapp.sa'],
  capabilities:['SALE_OFFER','RENT_OFFER','BUYER_REQUEST']}),
]);
const SOURCE_MAP=Object.freeze(Object.fromEntries(SOURCES.map(s=>[s.id,s])));
const MAX_RESEARCH_ROWS=3000;
const normalize=v=>String(v??'').trim().replace(/[أإآٱ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي')
 .replace(/[\s_-]+/g,'').toLowerCase();
const digits=v=>String(v??'').trim().replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
 .replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
function numeric(v) {
 if(v===null||v===undefined||String(v).trim()==='')return null;
 const s=digits(v).replace(/\u066B/g,'.').replace(/[\u00a0\u202f]/g,'');
 if(!/^-?\d+(?:\.\d+)?$/.test(s)&&
    !/^-?\d{1,3}(?:[,\u066C]\d{3})+(?:\.\d+)?$/.test(s))return NaN;
 const n=Number(s.replace(/[,٬]/g,''));
 return Number.isFinite(n)?n:NaN;
}
function isoDate(value){
 const s=digits(value);
 if(!/^\d{4}-\d\d-\d\d$/.test(s))return null;
 const t=Date.parse(s+'T00:00:00Z');
 return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===s?s:null;
}
function canonicalUrl(value,domains){
 if(typeof value!=='string'||value.length>2000)return null;
 let u;try{u=new URL(value);}catch{return null;}
 if(u.protocol!=='https:'||u.username||u.password||!domains.some(d=>u.hostname===d||u.hostname.endsWith('.'+d)))
  return null;
 u.hash='';
 for(const k of [...u.searchParams.keys()])if(/^utm_|^(?:fbclid|gclid)$/i.test(k))u.searchParams.delete(k);
 return u.toString();
}
const HEADER=Object.freeze({
 source:['source','sourceid','المصدر','المنصة'],
 city:['city','المدينة'],district:['district','الحي','اسم الحي'],
 kind:['kind','type','recordkind','نوع السجل','نوع العرض'],
 assetType:['assettype','نوع العقار'],
 priceSar:['pricesar','price','السعر المطلوب','السعر','الميزانية'],
 areaSqm:['areasqm','area','المساحة','مساحة العقار'],
 listingUrl:['listingurl','url','sourceurl','رابط الإعلان','رابط العرض','رابط المصدر'],
 listingId:['listingid','sourceidexternal','رقم الإعلان','معرف الإعلان','رقم الطلب'],
 listingDate:['listingdate','تاريخ الإعلان','تاريخ العرض'],
});
const kinds=Object.freeze({
 saleoffer:'SALE_OFFER',بيع:'SALE_OFFER',للبيع:'SALE_OFFER',
 rentoffer:'RENT_OFFER',ايجار:'RENT_OFFER',للايجار:'RENT_OFFER',
 projectindicative:'PROJECT_INDICATIVE',مشروع:'PROJECT_INDICATIVE',مشروععقاري:'PROJECT_INDICATIVE',
 auctionask:'AUCTION_ASK',مزاد:'AUCTION_ASK',مزايدة:'AUCTION_ASK',
 buyerrequest:'BUYER_REQUEST',طلب:'BUYER_REQUEST',طلبشراء:'BUYER_REQUEST',
});
function sourceId(value){
 const n=normalize(value);
 const s=SOURCES.find(x=>normalize(x.id)===n||normalize(x.nameAr)===n);
 return s?.id||'';
}
function parseListingResearchCsv(csv,{observedOn,asOf=new Date()}={}){
 if(typeof csv!=='string'||new TextEncoder().encode(csv).length>MAX_CSV_BYTES)
  throw Error('SOURCE_RESEARCH_CSV_SIZE_LIMIT');
 const asOfIso=asOf instanceof Date?asOf.toISOString().slice(0,10):isoDate(asOf);
 const observation=isoDate(observedOn);
 if(!observation||!asOfIso||observation>asOfIso)throw Error('SOURCE_RESEARCH_OBSERVATION_INVALID');
 const {columns,records}=rowsFromCsv(csv);
 if(records.length>MAX_CSV_ROWS)throw Error('SOURCE_RESEARCH_ROW_LIMIT');
 const names=columns.map(normalize);
 if(new Set(names).size!==names.length)throw Error('SOURCE_RESEARCH_DUPLICATE_HEADERS');
 const col={};
 for(const [key,aliases] of Object.entries(HEADER))
  col[key]=names.findIndex(x=>aliases.some(a=>normalize(a)===x));
 for(const key of ['source','city','district','kind'])if(col[key]<0)
  throw Error('SOURCE_RESEARCH_COLUMN_REQUIRED_'+key);
 const accepted=[],rejected=[];
 const get=(row,key)=>col[key]>=0?String(row.columns[columns[col[key]]]??'').trim():'';
 for(const r of records){
  const source=sourceId(get(r,'source')),spec=SOURCE_MAP[source];
  const kind=kinds[normalize(get(r,'kind'))];
  const city=get(r,'city'),district=get(r,'district'),assetType=get(r,'assetType');
  const listingId=get(r,'listingId'),rawUrl=get(r,'listingUrl');
  const listingUrl=spec?canonicalUrl(rawUrl,spec.domains):null;
  const price=numeric(get(r,'priceSar')),area=numeric(get(r,'areaSqm'));
  const listingDate=get(r,'listingDate')?isoDate(get(r,'listingDate')):null;
  const issues=[];
  if(!spec)issues.push('SOURCE_UNSUPPORTED');
  if(!kind||!spec?.capabilities.includes(kind))issues.push('SOURCE_KIND_UNSUPPORTED');
  if(!city||!district||city.length>120||district.length>120)issues.push('CITY_DISTRICT_REQUIRED');
  if(!listingUrl)issues.push('OFFICIAL_LISTING_URL_REQUIRED');
  // Homepage/category routes cannot identify distinct requests or listings;
  // a provider-side reference is required when a unique listing route is unavailable.
  if(listingUrl&&!listingId){
   const u=new URL(listingUrl);
   if(u.pathname==='/'||u.pathname==='/ar/'||u.pathname==='/ar/tabs/home')
    issues.push('SPECIFIC_LISTING_REFERENCE_REQUIRED');
  }
  if(listingId.length>120||assetType.length>90)issues.push('FIELD_LENGTH_INVALID');
  if(Number.isNaN(price)||price!==null&&(price<=0||price>1e14))issues.push('ASKING_PRICE_INVALID');
  if(Number.isNaN(area)||area!==null&&(area<=0||area>1e7))issues.push('AREA_INVALID');
  if(kind==='SALE_OFFER'||kind==='RENT_OFFER')
   if(price===null)issues.push('ASKING_PRICE_REQUIRED');
  if(get(r,'listingDate')&&(!listingDate||listingDate>observation))
   issues.push('AD_DATE_INVALID');
  if(issues.length){rejected.push({line:r.line,issues});continue;}
  accepted.push(Object.freeze({
   country:'SA',sourceId:source,sourceNameAr:spec.nameAr,
   city,district,kind,assetType:assetType||null,askingPriceOrBudgetSar:price,
   areaSqm:area,listingUrl,listingId:listingId||null,listingDate,
   observedOn:observation,recordClass:'USER_IMPORTED_MARKET_SIGNAL_UNVERIFIED',
   independentlyVerified:false,executedTransactionRecord:false,
   marketValuationEligible:false,professionalReportAuthorized:false,
  }));
 }
 return {records:accepted,rejected,sourceCount:new Set(accepted.map(r=>r.sourceId)).size,
  importedIndividualExecutedTransactions:0,autoValuationEnabled:false};
}
function identity(r){return [r.sourceId,r.listingId?'ID:'+r.listingId:'URL:'+r.listingUrl,
 r.observedOn].join('|');}
function metricsEqual(a,b){return ['city','district','kind','assetType',
 'askingPriceOrBudgetSar','areaSqm','listingId','listingDate'].every(k=>a[k]===b[k]);}
function mergeListingResearch(previous,incoming){
 if(!Array.isArray(previous)||!Array.isArray(incoming))throw Error('SOURCE_RESEARCH_ARRAY_REQUIRED');
 const merged=[],map=new Map(),conflicts=[];let added=0,duplicates=0;
 const accept=(r,origin)=>{
  if(!SOURCE_MAP[r?.sourceId]||!SOURCE_MAP[r.sourceId].capabilities.includes(r.kind)||
     r?.recordClass!=='USER_IMPORTED_MARKET_SIGNAL_UNVERIFIED'||
     r.executedTransactionRecord!==false||r.marketValuationEligible!==false||
     !canonicalUrl(r.listingUrl,SOURCE_MAP[r.sourceId].domains))
   throw Error('SOURCE_RESEARCH_INVALID_RECORD');
  const k=identity(r),old=map.get(k);
  if(old){
   if(metricsEqual(old,r)){duplicates++;return;}
   conflicts.push({sourceId:r.sourceId,city:r.city,district:r.district,
    listingUrl:r.listingUrl,observedOn:r.observedOn,code:'CONFLICTING_SAME_DAY_LISTING'});
   return;
  }
  if(merged.length>=MAX_RESEARCH_ROWS)throw Error('SOURCE_RESEARCH_TOTAL_LIMIT');
  map.set(k,r);merged.push(r);if(origin==='new')added++;
 };
 previous.forEach(r=>accept(r,'previous'));
 incoming.forEach(r=>accept(r,'new'));
 const bySignature=new Map(),potentialCrossSourceDuplicates=[];
 for(const r of merged){
  if(!r.assetType||r.askingPriceOrBudgetSar===null||r.areaSqm===null)continue;
  const k=[normalize(r.city),normalize(r.district),r.kind,normalize(r.assetType),
   r.askingPriceOrBudgetSar,r.areaSqm,r.observedOn].join('|');
  const earlier=bySignature.get(k)||[];
  for(const x of earlier)if(x.sourceId!==r.sourceId)
   potentialCrossSourceDuplicates.push({sourceA:x.sourceId,sourceB:r.sourceId,
    city:r.city,district:r.district,code:'POSSIBLE_CROSS_PLATFORM_REPEAT_NOT_PROVEN'});
  earlier.push(r);bySignature.set(k,earlier);
 }
 return {records:merged,added,duplicates,conflicts,potentialCrossSourceDuplicates,
  autoValuationEnabled:false,executedTransactions:0};
}
function filterListingResearch(records,{city='',sourceId='',kind=''}={}){
 if(!Array.isArray(records))throw Error('SOURCE_RESEARCH_ARRAY_REQUIRED');
 return records.filter(r=>(!city||normalize(r.city)===normalize(city))&&
  (!sourceId||r.sourceId===sourceId)&&(!kind||r.kind===kind));
}
function listingResearchSummary(records){
 return {sourceIds:[...new Set(records.map(r=>r.sourceId))].sort(),sourcesConfigured:SOURCES.length,
  imported:records.length,cities:[...new Set(records.map(r=>r.city))].sort((a,b)=>a.localeCompare(b,'ar')),
  executedTransactions:0,independentlyVerifiedListings:0,autoValuationEnabled:false};
}
module.exports={SOURCES,SOURCE_MAP,MAX_RESEARCH_ROWS,parseListingResearchCsv,
 mergeListingResearch,filterListingResearch,listingResearchSummary};
