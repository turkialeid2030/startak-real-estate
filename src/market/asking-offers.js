'use strict';
// Source-aware asking-offer analysis. Never promotes listings to executed sales or leases.
// No automated crawling of sites, credentials, hidden endpoints or personal contact collection.
const {number,extractCoordinates,distanceKm,ASSET_TYPES}=require('./instant-market-study');
const {rowsFromCsv}=require('./public-dataset-import');
const TIME_LIMIT_DAYS=120,MAX_OFFERS=300;
function normalized(s) {
 return String(s||'').trim().replace(/\s+/g,' ').replace(/[أإآٱ]/g,'ا').replace(/ة/g,'ه').toLowerCase();
}
function sourceUrlInfo(value) {
 if(typeof value!=='string'||value.length>2000)return null;
 try{
   const u=new URL(value.trim());
   if(u.protocol!=='https:'||u.username||u.password||!u.hostname.includes('.'))return null;
   if(u.hostname==='localhost'||u.hostname.endsWith('.local'))return null;
   return {link:u.href,host:u.hostname.replace(/^www\./,'')};
 }catch{return null;}
}
function isoDate(value){
 if(typeof value!=='string'||!(/^\d{4}-\d{2}-\d{2}$/).test(value))return null;
 const t=Date.parse(value+'T00:00:00Z');
 return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===value?value:null;
}
function asOffer(row,{kind,subject,asOf,maxAgeDays=TIME_LIMIT_DAYS}){
 const rejection=[];
 if(kind==='INVESTMENT')return {accepted:false,
   issues:['INVESTMENT_STRUCTURE_REQUIRES_SEPARATE_UNDERWRITING'],
   sourceUrl:sourceUrlInfo(row.sourceUrl)?.link||null,contextOnly:true,
   offerKind:kind,date:isoDate(row.date),unitAskingSar:null,
   evidenceKind:'INVESTMENT_OPPORTUNITY_NOT_PRICE_COMPARABLE'};
 if(kind!=='SALE'&&kind!=='RENT')return {accepted:false,issues:['KIND_INVALID']};
 if(!ASSET_TYPES[subject?.assetType]||row.assetType!==subject.assetType)
   rejection.push('ASSET_TYPE_MISMATCH');
 if(row.evidenceType!=='ASKING')rejection.push('NOT_ASKING_OFFER');
 if(row.offerKind!==kind)rejection.push('WRONG_OFFER_PURPOSE');
 const src=sourceUrlInfo(row.sourceUrl);
 if(!src)rejection.push('SOURCE_LINK_REQUIRED');
 const date=isoDate(row.date);
 const now=asOf instanceof Date?asOf:new Date(asOf);
 if(!date||!Number.isFinite(now.getTime())||Date.parse(date+'T00:00:00Z')>now.getTime()||
      now.getTime()-Date.parse(date+'T00:00:00Z')>maxAgeDays*86400000)
   rejection.push('STALE_OR_INVALID_DATE');
 const point=extractCoordinates(row.location||'');
 const subjectPoint=extractCoordinates(subject?.location||'');
 let spatialMatch=null;
 if(point&&subjectPoint){
   const km=distanceKm(point,subjectPoint);
   if(km!==null&&km<=5)spatialMatch='WITHIN_5_KM';
   else rejection.push('OUTSIDE_5_KM');
 }else{
   if(normalized(row.city)===normalized(subject?.city)&&
      normalized(row.district)===normalized(subject?.district)&&
      normalized(row.city)&&normalized(row.district))
     spatialMatch='SAME_DISTRICT_APPROXIMATION';
   else rejection.push('NO_VERIFIABLE_LOCATION_MATCH');
 }
 const isLand=subject?.assetType==='LAND';
 if(isLand && (!row.landSubtype||!subject.landSubtype||
   String(row.landSubtype)!==String(subject.landSubtype)))rejection.push('LAND_SUBTYPE_UNVERIFIED');
 // Offers compare like with like: sale = land area for land only, built area otherwise.
 // Rent = rentable area, or land area for land leases.
 const areaBasis=kind==='SALE'?(isLand?'landArea':'builtArea'):(isLand?'landArea':'rentableArea');
 const area=number(row[areaBasis]);
 const amount=number(kind==='SALE'?row.price:row.annualRent);
 if(!(area>0))rejection.push('COMPARABLE_AREA_REQUIRED');
 if(!(amount>0))rejection.push('ASKING_PRICE_REQUIRED');
 // Annualize monthly asking rent; reject seasonal, daily and ambiguous tenancy terms.
 const period=kind==='RENT'?String(row.rentPeriod||'YEAR').toUpperCase():'N/A';
 if(kind==='RENT'&&!['YEAR','MONTH'].includes(period))rejection.push('RENT_PERIOD_UNSUPPORTED');
 const annual=kind==='RENT'&&period==='MONTH'?amount*12:amount;
 // A building offered as a whole must not be assumed comparable to one apartment in the same
 // "RESIDENTIAL_COMPOUND" category; the user must verify transaction/area basis separately.
 if(row.availability==='SOLD'||row.availability==='LEASED')rejection.push('NO_LONGER_ACTIVE');
 const unitRate=area>0&&annual>0?annual/area:null;
 if(unitRate===null||!Number.isFinite(unitRate)||unitRate>20_000_000)
   rejection.push('UNIT_PRICE_IMPLAUSIBLE');
 return {accepted:rejection.length===0,issues:rejection,
   source:src?.host||null,sourceUrl:src?.link||null,areaBasis,
   annualizedAskingSar:kind==='RENT'?annual:null,unitAskingSar:unitRate,
   spatialMatch,date,propertyType:subject?.assetType,
   privacy:'NO_CONTACT_FIELDS_NEEDED'};
}
function median(arr){const a=[...arr].sort((x,y)=>x-y);const n=a.length;return n%2?a[(n-1)/2]:(a[n/2-1]+a[n/2])/2;}
function reviewMarketOffers({subject,offers=[],asOf=new Date()}={}){
 if(!Array.isArray(offers)||offers.length>MAX_OFFERS)throw Error('OFFERS_LIMIT');
 const analyzed=[],seen=new Set(); const rejected={};
 for(const row of offers){
   const kind=String(row?.offerKind||'').toUpperCase();
   const reviewed=asOffer(row||{},{kind,subject,asOf});
   const source=sourceUrlInfo(row?.sourceUrl);
   // Exact source link / listing identifier prevents inflating median by copying advertisements.
   const dedupeKey=source?.link||'no-source';
   if(seen.has(dedupeKey)){reviewed.accepted=false;reviewed.issues.push('DUPLICATE_SOURCE');}
   else seen.add(dedupeKey);
   analyzed.push({...reviewed,offerKind:kind});
   for(const issue of reviewed.issues)rejected[issue]=(rejected[issue]||0)+1;
 }
 const group=(kind)=>{
   const vals=analyzed.filter(x=>x.accepted&&x.offerKind===kind).map(x=>x.unitAskingSar);
   const districtOnly=analyzed.filter(x=>x.accepted&&x.offerKind===kind&&x.spatialMatch==='SAME_DISTRICT_APPROXIMATION').length;
   return {
     acceptedOffers:vals.length,districtOnlyOffers:districtOnly,
     medianAskingSarPerSqm:vals.length>=3?median(vals):null,
     minAskingSarPerSqm:vals.length>=3?Math.min(...vals):null,
     maxAskingSarPerSqm:vals.length>=3?Math.max(...vals):null,
     evidenceKind:'ACTIVE_ASKING_ONLY_UNVERIFIED',
   };
 };
 return {asOf:new Date(asOf).toISOString(),askingSales:group('SALE'),askingRentalsAnnual:group('RENT'),
  reviewed:analyzed,rejectedReasons:rejected,totalOffers:offers.length,
  canEstimateExecutedSalePrice:false,canEstimateContractedMarketRent:false,
  safeToUseAsPrimaryValue:false,
  marketClaim:'No claim of achieved transaction prices, offers are not completed deals; no assumed percentage negotiation discount, no professional valuation.'};
}
const HEADER={
 offerKind:['نوع العرض','نوع العملية','offerKind'],
 assetType:['نوع العقار','assetType'],
 evidenceType:['حالة السعر','evidenceType'],
 price:['السعر المطلوب','سعر البيع المطلوب','price'],
 annualRent:['الإيجار المطلوب','الايجار المطلوب','annualRent'],
 rentPeriod:['دورية الإيجار','rentPeriod'],
 landSubtype:['نوع الأرض','تصنيف الأرض','landSubtype'],
 landArea:['مساحة الأرض','landArea'],
 builtArea:['المساحة المبنية','builtArea'],
 rentableArea:['المساحة التأجيرية','rentableArea'],
 city:['المدينة','city'],district:['الحي','district'],
 location:['الإحداثيات','الموقع','location'],
 date:['تاريخ الإعلان','date'],sourceUrl:['رابط الإعلان','sourceUrl'],
};
function importOfferRowsCsv(csv) {
 const {records}=rowsFromCsv(csv);
 if(records.length>MAX_OFFERS)throw Error('OFFERS_LIMIT');
 function field(row,key){
  const names=HEADER[key].map(normalized);
  const k=Object.keys(row).find(x=>names.includes(normalized(x)));
  return k?row[k]:'';
 }
 const result=records.map(r=>{
  const cols=r.columns;
  const offerKind=normalized(field(cols,'offerKind'));
  const assetInput=field(cols,'assetType');
  const arLabel=Object.entries(ASSET_TYPES).find(([,v])=>normalized(v)===normalized(assetInput));
  const purpose=['INVESTMENT','استثمار','فرصه استثماريه','فرصة استثمارية'].some(x=>normalized(x)===offerKind)?'INVESTMENT':
    ['SALE','بيع','للبيع'].includes(offerKind)?'SALE':
       ['RENT','إيجار','ايجار','للإيجار','للايجار'].includes(offerKind)?'RENT':'';
  const status=normalized(field(cols,'evidenceType'));
  const rawPeriod=normalized(field(cols,'rentPeriod'));
  return {
   offerKind:purpose,assetType:ASSET_TYPES[assetInput]?assetInput:(arLabel?.[0]||''),
   evidenceType:['ASKING','عرض','اعلان','إعلان','مطلوب'].some(x=>normalized(x)===status)?'ASKING':'UNVERIFIED',
   price:field(cols,'price'),annualRent:field(cols,'annualRent'),
   investmentTerms:field(cols,'investmentTerms'),
   rentPeriod:['MONTH','شهري','شهر'].some(x=>normalized(x)===rawPeriod)?'MONTH':
       ['YEAR','سنوي','سنة'].some(x=>normalized(x)===rawPeriod)?'YEAR':'UNKNOWN',
   landArea:field(cols,'landArea'),builtArea:field(cols,'builtArea'),rentableArea:field(cols,'rentableArea'),
   landSubtype:field(cols,'landSubtype'),
   city:field(cols,'city'),district:field(cols,'district'),location:field(cols,'location'),
   date:field(cols,'date'),sourceUrl:field(cols,'sourceUrl'),
  };
 });
 return {offers:result,mode:'USER_SUPPLIED_CSV',verified:false};
}
module.exports={TIME_LIMIT_DAYS,MAX_OFFERS,reviewMarketOffers,importOfferRowsCsv,asOffer};
