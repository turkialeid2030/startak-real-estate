'use strict';
// Read-only adapter. MOJ monthly transactions as distributed by Kite are NOT
// verified property-specific comparables, nor a public sale day or building value.
const VERSION='STARTAK_KITE_MOJ_PERSONAL_RESEARCH_V1';
const PROVIDER_DOC='https://platform.kite.sa/docs/reference/transactions-search';
const USES=new Set(['residential','commercial','industrial','agricultural','mixed_use','other']);
function dateMonth(month){
 if(typeof month!=='string'||!/^20\d{2}-(?:0[1-9]|1[0-2])$/.test(month))return null;
 const n=Number(month.slice(5)),year=Number(month.slice(0,4));
 return {start:month+'-01',end:month+'-'+String(new Date(Date.UTC(year,n,0)).getUTCDate()).padStart(2,'0')};
}
function clean(value,max=130){return typeof value==='string'&&value.trim().length<=max?value.trim():null;}
function normalizeKiteResearch(payload){
 if(!payload||payload.ok!==true||payload.provider!=='KITE'||
   payload.dataset!=='MOJ_QUARTERLY_OPEN_NOTARY_SALES'||!Array.isArray(payload.records)||
   payload.records.length>25||!payload.attribution||typeof payload.attribution!=='object'||
   typeof payload.retrievedAt!=='string')
  throw Error('KITE_RESEARCH_PAYLOAD_INVALID');
 const observedOn=payload.retrievedAt.slice(0,10);
 if(!/^20\d{2}-\d{2}-\d{2}$/.test(observedOn)||
    Number.isNaN(Date.parse(observedOn+'T00:00:00Z')))throw Error('KITE_OBSERVATION_INVALID');
 const rows=[],skipped=[];
 for(const [index,item] of payload.records.entries()){
  const month=dateMonth(item?.month);
  const id=clean(item?.id,128);
  const city=clean(item?.cityNameAr,100)||clean(item?.city,80);
  const district=clean(item?.districtNameAr,120);
  const price=item?.priceSar;
  if(!month||month.start>observedOn||!id||!city||
     !Number.isFinite(price)||price<=0||price>1e16||
     !USES.has(item?.landUse)){
   skipped.push({index,reason:'MONTH_PRICE_OR_PROVENANCE_REQUIRED'});continue;
  }
  rows.push(Object.freeze({
   sourceId:'KITE_MOJ_QUARTERLY',origin:'GOVERNMENT_OPEN_DATA_VIA_KITE',
   evidenceClass:'THIRD_PARTY_REPORTED_SALE',sourceUrl:PROVIDER_DOC,
   country:'SA',city,district:district||'حي غير محدد',
   districtKnown:!!district,assetType:item.landUse,recordId:id,
   observedOn,periodStart:month.start,periodEnd:month.end,
   eventDate:null,dayKnown:false,sourceQuarter:clean(item.sourceQuarter,18),
   propertyCount:Number.isSafeInteger(item.propertyCount)?item.propertyCount:null,
   areaSqm:Number.isFinite(item.areaSqm)?item.areaSqm:null,
   pricePerSqmSar:Number.isFinite(item.pricePerSqmSar)?item.pricePerSqmSar:null,
   coverageFlag:clean(item.coverageFlag,60),
   metricName:'sale_price_sar',metricValue:price,metricUnit:'SAR',
   providerRangeLowSar:null,providerRangeHighSar:null,
   providerStatedConfidence:null,modelAsOf:null,
   personalResearch:true,officialSourcePage:false,
   sourceRecordAuthenticated:false,executedTransactionRecord:false,
   independentMarketPriceVerified:false,marketValuationEligible:false,
   professionalReportAuthorized:false,
   datasetCoverage:'MOJ_NOTARY_ONLY_QUARTERLY_NOT_ALL_REAL_ESTATE_REGISTRY',
   sourceAttribution:payload.attribution,
  }));
 }
 return Object.freeze({
  version:VERSION,rows:Object.freeze(rows),skipped:Object.freeze(skipped),
  provider:payload.provider,attribution:payload.attribution,
  caveats:Array.isArray(payload.caveats)?payload.caveats.slice(0,12):[],
  independentSaleEvidence:false,automaticAppraisal:false,
 });
}
module.exports={VERSION,PROVIDER_DOC,dateMonth,normalizeKiteResearch};
