'use strict';
// Independent, unverified Saudi offer-vs-execution cohort and unit-mix rent study.
// No property identity inference, no "listing sold at this price" claims.
const {number,extractCoordinates,distanceKm}=require('./instant-market-study');
const {reviewMarketOffers}=require('./asking-offers');
const UNIT_KINDS=Object.freeze({
 STUDIO:'استوديو',APARTMENT_1BR:'شقة غرفة',APARTMENT_2BR:'شقة غرفتين',
 APARTMENT_3BR:'شقة ثلاث غرف',APARTMENT_4BR:'شقة أربع غرف فأكثر',
 VILLA:'فيلا',RETAIL_SHOP:'معرض أو محل',RETAIL_ANCHOR:'مستأجر تجاري رئيسي',
 OFFICE:'مكتب',WAREHOUSE_BAY:'وحدة مستودع',OTHER:'وحدة أخرى',
});
const HOUSE_TYPES=new Set(['RESIDENTIAL_COMPOUND','RESIDENTIAL_BUILDING','RESIDENTIAL_VILLA']);
const RETAIL_TYPES=new Set(['COMMERCIAL_COMPLEX','COMMERCIAL_MALL','MIXED_USE','OFFICE_TOWER','WAREHOUSE','LOGISTICS_PARK']);
const EXCLUDED_SPECIALISTS=new Set(['HOTEL','HEALTHCARE_PROPERTY','INDUSTRIAL_PROPERTY']);
const norm=s=>String(s??'').trim().replace(/\s+/g,' ').replace(/[أإآٱ]/g,'ا').replace(/ة/g,'ه').toLowerCase();
const val=(x,min=0,max=1e14)=>{const cleaned=typeof x==='string'&&/^\.\d+$/.test(x.trim())?'0'+x.trim():x;const n=number(cleaned);return n!==null&&Number.isFinite(n)&&n>=min&&n<=max?n:null;};
const dateMs=(v,asOf,windowDays)=>{
 if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return null;
 const n=Date.parse(v+'T00:00:00Z'),now=new Date(asOf).getTime();
 return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===v&&
   n<=now&&n>=now-windowDays*86400000?n:null;
};
const sourceOk=v=>{try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password&&u.hostname.includes('.');}catch{return false;}};
const med=a=>{const s=[...a].sort((x,y)=>x-y);return s.length%2?s[(s.length-1)/2]:(s[s.length/2-1]+s[s.length/2])/2;};
const round=v=>Math.round((v+Number.EPSILON)*100)/100;
function proximity(a,b){
 const ap=extractCoordinates(a?.location||''),bp=extractCoordinates(b?.location||'');
 if(ap&&bp)return distanceKm(ap,bp)<=5?'COORDINATES_WITHIN_5_KM':null;
 if(norm(a?.city)&&norm(a?.district)&&norm(a.city)===norm(b?.city)&&norm(a.district)===norm(b?.district))
  return 'DISTRICT_ONLY_APPROXIMATE';
 return null;
}
// Cohort-level gap is not a match of an advertised parcel to a registered deed.
// Protect against type, area basis, size, geography, age and duplicate distortions.
function reviewAskingVsExecuted({subject,askingOffers=[],executedSales=[],asOf=new Date()}={}){
 const errors=[],excluded={};
 const excludedOne=c=>{excluded[c]=(excluded[c]||0)+1;};
 const basis=subject?.assetType==='LAND'?'landArea':'builtArea';
 const targetArea=val(subject?.[basis],.01);
 if(!targetArea)errors.push('SUBJECT_COMPARABLE_AREA_REQUIRED');
 const ask=reviewMarketOffers({subject,offers:askingOffers,asOf});
 const acceptedAsk=[],seenAsk=new Set();
 for(const [i,r] of ask.reviewed.entries()){
  if(!r.accepted||r.offerKind!=='SALE')continue;
  const item=askingOffers[i],area=val(item?.[basis],.01),sizeRatio=area&&targetArea?area/targetArea:null;
  if(!sizeRatio||sizeRatio<.5||sizeRatio>2){excludedOne('ASKING_AREA_RATIO_UNSUITABLE');continue;}
  if(subject.assetType==='LAND'&&(!subject.landSubtype||item.landSubtype!==subject.landSubtype)){
    excludedOne('LAND_SUBTYPE_UNVERIFIED');continue;
  }
  const ref=r.sourceUrl;if(seenAsk.has(ref))continue;seenAsk.add(ref);
  acceptedAsk.push({...r,comparableArea:area});
 }
 const executed=[],seenExec=new Set();
 for(const row of executedSales){
  if(row?.status!=='EXECUTED'){excludedOne('NOT_EXECUTED');continue;}
  if(row.assetType!==subject?.assetType){excludedOne('ASSET_TYPE_MISMATCH');continue;}
  if(subject.assetType==='LAND'&&(!subject.landSubtype||row.landSubtype!==subject.landSubtype)){
    excludedOne('LAND_SUBTYPE_UNVERIFIED');continue;
  }
  if(!dateMs(row.date,asOf,365)){excludedOne('EXECUTED_DATE_INVALID');continue;}
  if(!sourceOk(row.sourceUrl)){excludedOne('EXECUTED_SOURCE_REQUIRED');continue;}
  const spatial=proximity(subject,row);
  if(!spatial){excludedOne('EXECUTED_LOCATION_MISMATCH');continue;}
  const area=val(row[basis],.01),price=val(row.price,.01);
  if(!area||!price||!targetArea||area/targetArea<.5||area/targetArea>2){
    excludedOne('EXECUTED_AREA_PRICE_MISMATCH');continue;
  }
  const unit=price/area;
  if(!(unit>0&&unit<2e7)){excludedOne('EXECUTED_PRICE_IMPLAUSIBLE');continue;}
  const key=(row.sourceRecordId?String(row.sourceRecordId):'')||[row.sourceUrl,row.date,price,area].join('|');
  if(seenExec.has(key)){excludedOne('EXECUTED_DUPLICATE');continue;}
  seenExec.add(key);
  executed.push({sourceUrl:row.sourceUrl,sourceRecordId:row.sourceRecordId||null,date:row.date,
    unitSarPerSqm:unit,spatialMatch:spatial});
 }
 const asks=acceptedAsk.map(x=>x.unitAskingSar),execs=executed.map(x=>x.unitSarPerSqm);
 const ready=asks.length>=3&&execs.length>=3&&!errors.length;
 const askingMedian=asks.length>=3?round(med(asks)):null;
 const executedMedian=execs.length>=3?round(med(execs)):null;
 const gapSar=ready?round(askingMedian-executedMedian):null;
 const gapPct=ready&&executedMedian>0?round(gapSar/executedMedian*100):null;
 const approx=acceptedAsk.filter(x=>x.spatialMatch==='SAME_DISTRICT_APPROXIMATION').length+
  executed.filter(x=>x.spatialMatch==='DISTRICT_ONLY_APPROXIMATE').length;
 return {status:ready?'COHORT_GAP_REVIEW_ONLY':'INSUFFICIENT_COHORT_EVIDENCE',
  askingCount:asks.length,executedCount:execs.length,
  medianAskingSarPerSqm:askingMedian,medianExecutedSarPerSqm:executedMedian,
  askingMinusExecutedSarPerSqm:gapSar,askingMinusExecutedPct:gapPct,
  districtOnlyEvidence:approx,basis,excluded,askingRejected:ask.rejectedReasons,errors,
  notSamePropertyProof:true,certifiedValueSar:null,estimatedNegotiationDiscountPct:null,
  disclaimer:'Independent medians of separate sale-offer and registered-sale cohorts; NOT an observed negotiation concession, not evidence an individual listing sold, not a certified valuation.'};
}
function evaluateUnitMixRents({subject,unitMix=[],leaseComparables=[],expenseRatio=.2,
 stabilizedOccupancy=.9,asOf=new Date()}={}){
 const errors=[],warnings=[],seenUnits=new Set(),seenLeases=new Set();
 const type=subject?.assetType;
 if(!HOUSE_TYPES.has(type)&&!RETAIL_TYPES.has(type))
  errors.push('ASSET_NEEDS_SPECIALIST_RENT_MODEL');
 if(!Array.isArray(unitMix)||unitMix.length===0||unitMix.length>30)errors.push('UNIT_MIX_REQUIRED');
 if(!Array.isArray(leaseComparables)||leaseComparables.length>250)errors.push('LEASE_COMPARABLE_LIMIT');
 const ex=val(expenseRatio,0,.999999),occ=val(stabilizedOccupancy,0,1);
 if(ex===null)errors.push('EXPENSE_RATIO_INVALID');
 if(occ===null)errors.push('OCCUPANCY_INVALID');
 const applicable=new Set(HOUSE_TYPES.has(type)?
  ['STUDIO','APARTMENT_1BR','APARTMENT_2BR','APARTMENT_3BR','APARTMENT_4BR','VILLA','OTHER']:
  ['RETAIL_SHOP','RETAIL_ANCHOR','OFFICE','WAREHOUSE_BAY','OTHER']);
 let totalUnits=0,totalNla=0,totalRent=0;
 const byType=(Array.isArray(unitMix)?unitMix:[]).map((line,index)=>{
  const kind=String(line?.unitType||'');
  const n=val(line.unitCount,1,100000),unitArea=val(line.areaPerUnitSqm,.01,1e7);
  const problems=[];
  if(!UNIT_KINDS[kind]||!applicable.has(kind))problems.push('UNIT_CLASS_INCOMPATIBLE');
  if(seenUnits.has(kind))problems.push('DUPLICATE_UNIT_CLASS');
  seenUnits.add(kind);
  if(n===null||!Number.isInteger(n))problems.push('UNIT_COUNT_INVALID');
  if(unitArea===null)problems.push('UNIT_SIZE_INVALID');
  if(problems.length===0){totalUnits+=n;totalNla+=n*unitArea;}
  const rates=[];
  for(const r of (Array.isArray(leaseComparables)?leaseComparables:[])){
   if(r?.unitType!==kind||r.status!=='EXECUTED')continue;
   if(!sourceOk(r.sourceUrl)||!dateMs(r.date,asOf,365))continue;
   if(!proximity(subject,r))continue;
   const area=val(r.areaSqm,.01),annualRent=val(r.annualRent,.01);
   if(!area||!annualRent||!unitArea||area/unitArea<.5||area/unitArea>2)continue;
   if(annualRent/area>1e6)continue;
   const ref=r.sourceRecordId?String(r.sourceRecordId):r.sourceUrl+'|'+r.date+'|'+annualRent+'|'+area;
   if(seenLeases.has(ref))continue;seenLeases.add(ref);
   rates.push(annualRent/area);
  }
  const medianRate=rates.length>=3?med(rates):null;
  const gross=medianRate!==null&&problems.length===0?medianRate*n*unitArea:null;
  if(gross!==null)totalRent+=gross;
  if(rates.length<3)problems.push('THREE_EXECUTED_LEASES_REQUIRED');
  return {line:index+1,unitType:kind,unitCount:n,areaPerUnitSqm:unitArea,
   comparableLeaseCount:rates.length,marketRateSarPerSqmYear:medianRate===null?null:round(medianRate),
   annualGrossMarketRentSar:gross===null?null:round(gross),problems};
 });
 const declaredCount=val(subject?.unitCount,0),declaredNla=val(subject?.rentableArea,.01);
 if(declaredCount===null)errors.push('DECLARED_UNIT_COUNT_REQUIRED');
 if(declaredNla===null)errors.push('DECLARED_RENTABLE_AREA_REQUIRED');
 if(declaredCount!==null&&totalUnits!==declaredCount)errors.push('UNIT_COUNT_DOES_NOT_RECONCILE');
 if(declaredNla!==null&&totalNla>declaredNla*1.02)errors.push('MIX_AREA_EXCEEDS_DECLARED_RENTABLE');
 if(declaredNla!==null&&totalNla<declaredNla*.98)warnings.push('MIX_AREA_BELOW_DECLARED_RENTABLE');
 if(byType.some(x=>x.problems.length))errors.push('INCOMPLETE_UNIT_CLASS_EVIDENCE');
 const qualified=errors.length===0;
 const scheduledGross=qualified?round(totalRent):null;
 const occupiedGross=qualified?round(totalRent*occ):null;
 const noi=qualified?round(totalRent*occ*(1-ex)):null;
 const previousRent=val(subject?.historicalAnnualRent,0);
 return {status:qualified?'PRELIMINARY_SEGMENTED_RENT_UNVERIFIED':'HOLD_INCOMPLETE_UNIT_EVIDENCE',
  segments:byType,totalDeclaredUnits:declaredCount,totalModelUnits:totalUnits,
  totalModelRentableSqm:round(totalNla),grossPotentialNewAnnualRentSar:scheduledGross,
  stabilizedAnnualRentSar:occupiedGross,stabilizedNoiSar:noi,
  historicAnnualRentSar:previousRent,
  historicAnnualRentUsedForPricing:false,errors:[...new Set(errors)],warnings,
  evidenceLevel:'USER_SUPPLIED_LEASE_RECORDS_UNVERIFIED',
  appraisalCertified:false,legalRentLimitCalculated:false};
}
module.exports={UNIT_KINDS,reviewAskingVsExecuted,evaluateUnitMixRents};
