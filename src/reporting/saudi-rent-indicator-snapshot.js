'use strict';
// Separate declared aggregate indicator from individual lease comparables.
const {getCanonicalSourceProvider,sourceUrlMatchesProvider}=require('../source-intelligence/source-provider-registry');
const {sha256Hex}=require('../crypto/sha256');
const {KINDS}=require('./saudi-rental-intelligence');
const P=require('../engines/financial/precision');
const VERSION='SAUDI_RENT_INDICATOR_SNAPSHOT_V1';
const SOURCES=Object.freeze({
 REGA:{url:'https://rei.rega.gov.sa/en/advanced-search/rental-market',kind:'OFFICIAL_AGGREGATE_REFERENCE'},
 KITE_REGISTERED:{url:'https://platform.kite.sa/docs/reference/official-registered-rents',kind:'DOCUMENTED_REGISTERED_AGGREGATE_ENDPOINT'},
 KITE_COMMERCIAL:{url:'https://platform.kite.sa/docs/reference/market-commercial-rents',kind:'DOCUMENTED_COMMERCIAL_AGGREGATE_ENDPOINT'}
});
const exact=(v,k)=>v!==null&&typeof v==='object'&&Object.getPrototypeOf(v)===Object.prototype&&Object.keys(v).length===k.length&&k.every(x=>Object.hasOwn(v,x));
const txt=v=>typeof v==='string'&&v.trim().length>0&&v.length<=500&&!/[\u0000-\u001f\u007f]/.test(v);
const day=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const norm=v=>v.trim().replace(/\s+/g,' ').replace(/[أإآٱ]/g,'ا').toLowerCase();
const amount=v=>typeof v==='number'&&Number.isFinite(v)&&v>0&&v<=1e12&&P.money(v)===v;
function permittedSource(id,url){
 if(!Object.hasOwn(SOURCES,id)||!txt(url))return false;
 try{
  const u=new URL(url);
  if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||(u.port&&u.port!=='443'))return false;
  if(id==='REGA')return sourceUrlMatchesProvider(getCanonicalSourceProvider('REGA_REAL_ESTATE_INDICATORS'),url);
  return url===SOURCES[id].url;
 }catch{return false;}
}
function reviewRentIndicator(x,context){
 if(!exact(x,['version','sourceId','sourceUrl','sourceRef','attribution','city','district','kind','subtype','areaBasis','periodStart','periodEnd','publishedDate','observedDate','priceSource','metric','valueSar','sampleCount','vatBasis','declaredVatRate','vatRef'])||x.version!==VERSION||!permittedSource(x.sourceId,x.sourceUrl)||!['sourceRef','attribution','city','district','subtype'].every(k=>txt(x[k]))||!KINDS.includes(x.kind)||!['NLA','LAND_AREA','WHOLE_LEASE_AREA'].includes(x.areaBasis)||(x.kind==='LAND')!==(x.areaBasis==='LAND_AREA')||!['periodStart','periodEnd','publishedDate','observedDate'].every(k=>day(x[k]))||x.periodStart>x.periodEnd||x.periodEnd>x.publishedDate||x.publishedDate>x.observedDate||!['REGISTERED','ASKING','UNKNOWN'].includes(x.priceSource)||!['MEAN_ANNUAL_SAR_PER_UNIT','MEAN_ANNUAL_SAR_PER_SQM','MEDIAN_ANNUAL_SAR_PER_SQM'].includes(x.metric)||!amount(x.valueSar)||!Number.isSafeInteger(x.sampleCount)||x.sampleCount<1||!['EXCLUDED','INCLUDED','UNKNOWN'].includes(x.vatBasis))throw Error('INDICATOR_INVALID');
 if(x.sourceId==='KITE_REGISTERED'&&(x.priceSource!=='REGISTERED'||!['APARTMENT','VILLA','RESIDENTIAL_BUILDING','RESIDENTIAL_COMPOUND'].includes(x.kind)||x.metric==='MEDIAN_ANNUAL_SAR_PER_SQM'))throw Error('INDICATOR_SOURCE_SCOPE_INVALID');
 if(x.sourceId==='KITE_COMMERCIAL'&&(!['OFFICE','RETAIL_SHOP','SHOWROOM','MALL_UNIT','MALL_WHOLE','WAREHOUSE','LOGISTICS','FACTORY','OTHER_PROPERTY'].includes(x.kind)||x.metric==='MEAN_ANNUAL_SAR_PER_UNIT'))throw Error('INDICATOR_SOURCE_SCOPE_INVALID');
 if(x.vatBasis==='INCLUDED'?(typeof x.declaredVatRate!=='number'||!Number.isFinite(x.declaredVatRate)||x.declaredVatRate<0||x.declaredVatRate>.5||P.fromRate(P.toRate(x.declaredVatRate))!==x.declaredVatRate||!txt(x.vatRef)):(x.declaredVatRate!==null||x.vatRef!==null))throw Error('INDICATOR_VAT_INVALID');
 if(!exact(context,['city','district','kind','subtype','areaBasis','asOf'])||!['city','district','subtype'].every(k=>txt(context[k]))||!day(context.asOf)||!KINDS.includes(context.kind)||!['NLA','LAND_AREA','WHOLE_LEASE_AREA'].includes(context.areaBasis))throw Error('INDICATOR_CONTEXT_INVALID');
 const flags=[];
 if(['city','district','subtype'].some(k=>norm(x[k])!==norm(context[k]))||x.kind!==context.kind||x.areaBasis!==context.areaBasis)flags.push('SCOPE_MISMATCH');
 if(x.observedDate>context.asOf||x.publishedDate>context.asOf||x.periodEnd>context.asOf)flags.push('FUTURE_EVIDENCE');
 if((Date.parse(context.asOf)-Date.parse(x.periodEnd))/86400000>365)flags.push('STALE_PERIOD_REVIEW');
 if(x.priceSource!=='REGISTERED')flags.push('NOT_REGISTERED_AGGREGATE');
 if(x.sampleCount<3)flags.push('SMALL_SAMPLE_REVIEW');
 if(x.vatBasis==='UNKNOWN')flags.push('VAT_UNKNOWN');
 const normalized=flags.length?null:x.vatBasis==='INCLUDED'?P.fromMoney(P.roundDiv(P.toMoney(x.valueSar)*P.RATE_SCALE,P.RATE_SCALE+P.toRate(x.declaredVatRate))):x.valueSar;
 const out={version:VERSION,scope:'AGGREGATE_REFERENCE_ONLY',input:{...x},context:{...context},flags,referenceMetricExVatSar:normalized,sourceAuthenticated:false,sourceLicenseVerified:false,liveSourceConnected:false,individualLeaseComparables:[],propertyRentEstimateSar:null,legalRentExVatSar:null,professionalValuationCertified:false,transactionAuthorized:false,canonicalModelUpdated:false};
 return {...out,snapshotHashSha256:sha256Hex(JSON.stringify(out))};
}
module.exports={VERSION,SOURCES,reviewRentIndicator};
