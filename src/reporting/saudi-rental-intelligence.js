'use strict';
// Local market-rent research. No live source connection, legal rent determination or appraisal.
const P=require('../engines/financial/precision');
const {distanceKm}=require('../market/instant-market-study');
const {sha256Hex}=require('../crypto/sha256');
const VERSION='SAUDI_RENTAL_INTELLIGENCE_V1';
const KINDS=Object.freeze(['APARTMENT','VILLA','RESIDENTIAL_BUILDING','RESIDENTIAL_COMPOUND','OFFICE','RETAIL_SHOP','SHOWROOM','MALL_UNIT','MALL_WHOLE','WAREHOUSE','LOGISTICS','FACTORY','LAND','HOTEL_PROPERTY','FUEL_STATION_PROPERTY','SCHOOL_PROPERTY','HEALTHCARE_PROPERTY','DATA_CENTER_PROPERTY','PARKING_PROPERTY','OTHER_PROPERTY']);
const ADJUSTMENTS=Object.freeze(['TIME','LOCATION','SIZE','CONDITION','QUALITY','FRONTAGE','ACCESS','PARKING','LEASE_TERMS','SERVICES','TECHNICAL_SPECIFICATION','USE_RIGHTS']);
const exact=(v,ks)=>v!==null&&typeof v==='object'&&Object.getPrototypeOf(v)===Object.prototype&&Object.keys(v).length===ks.length&&ks.every(k=>Object.hasOwn(v,k));
const text=v=>typeof v==='string'&&v.trim().length>0&&v.length<=200&&!/[\u0000-\u001f\u007f]/.test(v);
const norm=v=>v.trim().replace(/\s+/g,' ').replace(/[أإآٱ]/g,'ا').toLowerCase();
const day=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const money=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1e12&&P.money(v)===v;
const rate=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max&&P.fromRate(P.toRate(v))===v;
const point=v=>v===null||(exact(v,['lat','lng'])&&rate(v.lat,-90,90)&&rate(v.lng,-180,180));
const source=v=>{try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password&&u.hostname.includes('.')&&!u.search&&!u.hash;}catch{return false;}};
const fail=c=>{throw Error(c);};
const med=a=>{const s=[...a].sort((x,y)=>x<y?-1:x>y?1:0),i=Math.floor(s.length/2);return s.length%2?s[i]:P.roundDiv(s[i-1]+s[i],2n);};
const unitRate=(annual,area)=>P.roundDiv(P.toMoney(annual)*P.RATE_SCALE*P.RATE_SCALE,100n*P.toRate(area));
const toAnnual=(r,area)=>P.fromMoney(P.roundDiv(r*P.toRate(area)*100n,P.RATE_SCALE*P.RATE_SCALE));
const fmtRate=r=>P.fromMoney(P.roundDiv(r*100n,P.RATE_SCALE));
function evaluateRentalIntelligence(x){
 if(!exact(x,['version','propertyRef','valuationDate','city','district','location','segmentsNonOverlapping','comparables','segments'])||x.version!==VERSION||!['propertyRef','city','district'].every(k=>text(x[k]))||!day(x.valuationDate)||x.segmentsNonOverlapping!==true||!point(x.location)||!Array.isArray(x.segments)||x.segments.length<1||x.segments.length>50||!Array.isArray(x.comparables)||x.comparables.length>500)fail('RENT_SCOPE_INVALID');
 const issues=[],add=(code,severity,ref)=>issues.push({code,severity,ref});
 const ids=new Set(),currentContractRefs=new Set();
 for(const s of x.segments){
  if(!exact(s,['id','kind','subtype','areaBasis','areaPerUnitSqm','unitCount','propertyRight','occupancy','collection','contractAnnualExVatSar','contractRef'])||!text(s.id)||ids.has(s.id)||!KINDS.includes(s.kind)||!text(s.subtype)||!['NLA','LAND_AREA','WHOLE_LEASE_AREA'].includes(s.areaBasis)||(s.kind==='LAND')!==(s.areaBasis==='LAND_AREA')||!rate(s.areaPerUnitSqm,.01,1e8)||!Number.isInteger(s.unitCount)||s.unitCount<1||s.unitCount>100000||s.propertyRight!=='FREEHOLD_PROPERTY_LEASE'||!rate(s.occupancy,0,1)||!rate(s.collection,0,1)||!(s.contractAnnualExVatSar===null||money(s.contractAnnualExVatSar))||!(s.contractAnnualExVatSar===null?s.contractRef===null:text(s.contractRef)))fail('RENT_SEGMENT_INVALID');
  if(s.areaPerUnitSqm*s.unitCount>1e9)fail('RENT_AREA_RANGE');
  if(s.contractRef!==null){if(currentContractRefs.has(s.contractRef))fail('RENT_CURRENT_CONTRACT_DUPLICATE');currentContractRefs.add(s.contractRef);}
  ids.add(s.id);
 }
 const byRecord=new Map(),byContract=new Map(),conflicts=new Set(),unique=[];
 for(const c of x.comparables){
  if(!exact(c,['sourceUrl','sourceRecordId','contractRef','status','kind','subtype','city','district','location','areaBasis','areaSqm','propertyRight','date','observedDate','rentAmountSar','periodMonths','vatBasis','declaredVatRate','vatRef','rentOnly','usageRightsDeclared','adjustments'])||!source(c.sourceUrl)||!text(c.sourceRecordId)||!text(c.contractRef)||!['EXECUTED','ASKING','UNKNOWN'].includes(c.status)||!KINDS.includes(c.kind)||!['subtype','city','district'].every(k=>text(c[k]))||!point(c.location)||!['NLA','LAND_AREA','WHOLE_LEASE_AREA'].includes(c.areaBasis)||(c.kind==='LAND')!==(c.areaBasis==='LAND_AREA')||!rate(c.areaSqm,.01,1e8)||c.propertyRight!=='FREEHOLD_PROPERTY_LEASE'||!day(c.date)||!day(c.observedDate)||!money(c.rentAmountSar)||c.rentAmountSar===0||![1,3,6,12].includes(c.periodMonths)||!['EXCLUDED','INCLUDED','UNKNOWN'].includes(c.vatBasis)||typeof c.rentOnly!=='boolean'||typeof c.usageRightsDeclared!=='boolean'||!Array.isArray(c.adjustments)||c.adjustments.length>12)fail('RENT_COMPARABLE_INVALID');
  if(c.vatBasis==='INCLUDED'?(!rate(c.declaredVatRate,0,.5)||!text(c.vatRef)):(c.declaredVatRate!==null||c.vatRef!==null))fail('RENT_VAT_DECLARATION_INVALID');
  const seen=new Set();let total=0n;
  for(const a of c.adjustments){if(!exact(a,['category','fraction','evidenceRef'])||!ADJUSTMENTS.includes(a.category)||seen.has(a.category)||!rate(a.fraction,-.5,.5)||!text(a.evidenceRef))fail('RENT_ADJUSTMENT_INVALID');seen.add(a.category);total+=P.toRate(a.fraction);}
  if(total< -P.RATE_SCALE/2n||total>P.RATE_SCALE/2n)fail('RENT_ADJUSTMENT_TOTAL_RANGE');
  const signature=JSON.stringify([c.status,c.kind,norm(c.subtype),norm(c.city),norm(c.district),c.location,c.areaBasis,c.areaSqm,c.propertyRight,c.date,c.observedDate,c.rentAmountSar,c.periodMonths,c.vatBasis,c.declaredVatRate,c.rentOnly,c.usageRightsDeclared,[...c.adjustments].sort((a,b)=>a.category.localeCompare(b.category))]);
  const key=new URL(c.sourceUrl).hostname.toLowerCase()+'|'+c.sourceRecordId;
  const oldRecord=byRecord.get(key),oldContract=byContract.get(c.contractRef);
  if(oldRecord&&(oldRecord.signature!==signature||oldRecord.contractRef!==c.contractRef)){conflicts.add(c.contractRef);conflicts.add(oldRecord.contractRef);}
  if(oldContract&&oldContract.signature!==signature)conflicts.add(c.contractRef);
  if(!oldRecord)byRecord.set(key,{signature,contractRef:c.contractRef});
  if(!oldContract){byContract.set(c.contractRef,{signature});unique.push({...c,adjustments:c.adjustments.map(a=>({...a})),total});}
 }
 if(conflicts.size)add('RENT_SOURCE_CONFLICT','CRITICAL','cohort');
 const segments=x.segments.map(s=>{
  const accepted=[],offers=[],excluded={};const reject=k=>{excluded[k]=(excluded[k]||0)+1;};
  for(const c of unique){
   if(c.kind!==s.kind||norm(c.subtype)!==norm(s.subtype)||c.areaBasis!==s.areaBasis){reject('TYPE_OR_AREA_BASIS');continue;}
   if(conflicts.has(c.contractRef)){reject('CONFLICT');continue;}
   if(norm(c.city)!==norm(x.city)||norm(c.district)!==norm(x.district)){reject('LOCATION');continue;}
   if(x.location&&c.location&&distanceKm(x.location,c.location)>5){reject('DISTANCE');continue;}
   const age=(Date.parse(x.valuationDate)-Date.parse(c.date))/86400000;
   if(age<0||age>365||c.observedDate<c.date||c.observedDate>x.valuationDate){reject('DATE');continue;}
   if(c.areaSqm/s.areaPerUnitSqm<.5||c.areaSqm/s.areaPerUnitSqm>2){reject('SIZE');continue;}
   if(!c.rentOnly||!c.usageRightsDeclared){reject('RENT_OR_USAGE_SCOPE');continue;}
   if(c.vatBasis==='UNKNOWN'){reject('VAT_UNKNOWN');continue;}
   if(c.status==='UNKNOWN'){reject('STATUS_UNKNOWN');continue;}
   const vat=c.vatBasis==='INCLUDED'?P.RATE_SCALE+P.toRate(c.declaredVatRate):P.RATE_SCALE;
   const annual=P.fromMoney(P.roundDiv(P.toMoney(c.rentAmountSar)*12n*P.RATE_SCALE,BigInt(c.periodMonths)*vat));
   if(!money(annual)||annual===0){reject('AMOUNT_RANGE');continue;}
   const raw=unitRate(annual,c.areaSqm),adjusted=P.roundDiv(raw*(P.RATE_SCALE+c.total),P.RATE_SCALE);
   if(adjusted<=0n||fmtRate(adjusted)<=0||adjusted>1000000n*P.RATE_SCALE){reject('RATE_RANGE');continue;}
   const detail={contractRef:c.contractRef,sourceUrl:c.sourceUrl,sourceRecordId:c.sourceRecordId,status:c.status,date:c.date,observedDate:c.observedDate,annualRentExVatSar:annual,areaSqm:c.areaSqm,rawRateSar:fmtRate(raw),adjustedRateSar:fmtRate(adjusted),adjustments:c.adjustments,locationMatch:x.location&&c.location?'DISTRICT_AND_DISTANCE':'DISTRICT_DECLARED_ONLY',vatBasis:c.vatBasis,declaredVatRate:c.declaredVatRate,vatRef:c.vatRef};
   (c.status==='EXECUTED'?accepted:offers).push({detail,adjusted,raw});
  }
  const totalArea=P.fromRate(P.toRate(s.areaPerUnitSqm)*BigInt(s.unitCount));
  const offerMedianRateSar=offers.length?fmtRate(med(offers.map(c=>c.raw))):null;
  let result=null;
  if(accepted.length<3||conflicts.size)add('RENT_INSUFFICIENT_EXECUTED_EVIDENCE','CRITICAL',s.id);
  else{
   const values=accepted.map(c=>c.adjusted).sort((a,b)=>a<b?-1:a>b?1:0),middle=med(values),low=values[0],high=values.at(-1);
   const annual=toAnnual(middle,totalArea),lowAnnual=toAnnual(low,totalArea),highAnnual=toAnnual(high,totalArea);
   if(![annual,lowAnnual,highAnnual].every(money)||annual===0)fail('RENT_RESULT_RANGE');
   const occupied=P.moneyMulRate(annual,s.occupancy),collected=P.moneyMulRate(occupied,s.collection);
   result={annualRentExVatSar:annual,monthlyRentExVatSar:P.moneyDivInt(annual,12),rateSarPerSqmYear:fmtRate(middle),rateSarPerSqmMonth:fmtRate(P.roundDiv(middle,12n)),annualRentPerUnitSar:toAnnual(middle,s.areaPerUnitSqm),observedAdjustedMinAnnualSar:lowAnnual,observedAdjustedMaxAnnualSar:highAnnual,occupiedRentSar:occupied,expectedCollectionsSar:collected,contractGapSar:s.contractAnnualExVatSar===null?null:P.moneySub(annual,s.contractAnnualExVatSar)};
  }
  return {id:s.id,kind:s.kind,subtype:s.subtype,areaBasis:s.areaBasis,totalAreaSqm:totalArea,unitCount:s.unitCount,occupancy:s.occupancy,collection:s.collection,contractAnnualExVatSar:s.contractAnnualExVatSar,contractRef:s.contractRef,executedCount:accepted.length,askingCount:offers.length,offerMedianRateSar,executed:accepted.map(c=>c.detail),offers:offers.map(c=>c.detail),excluded,result};
 });
 let total=null;
 if(segments.every(s=>s.result!==null)){
  const sum=k=>P.moneyAdd(...segments.map(s=>s.result[k]));
  const annual=sum('annualRentExVatSar'),area=segments.reduce((a,s)=>a+P.toRate(s.totalAreaSqm),0n);
  if(!money(annual)||!money(sum('observedAdjustedMaxAnnualSar'))||area>1000000000n*P.RATE_SCALE)fail('RENT_RESULT_RANGE');
  const comparableAreaBasis=segments.every(s=>s.areaBasis===segments[0].areaBasis);
  total={annualRentExVatSar:annual,monthlyRentExVatSar:P.moneyDivInt(annual,12),totalAreaSqm:comparableAreaBasis?P.fromRate(area):null,areaBasis:comparableAreaBasis?segments[0].areaBasis:null,rateSarPerSqmYear:comparableAreaBasis?fmtRate(unitRate(annual,P.fromRate(area))):null,expectedCollectionsSar:sum('expectedCollectionsSar'),occupiedRentSar:sum('occupiedRentSar'),observedAdjustedMinAnnualSar:sum('observedAdjustedMinAnnualSar'),observedAdjustedMaxAnnualSar:sum('observedAdjustedMaxAnnualSar'),contractGapSar:segments.every(s=>s.result.contractGapSar!==null)?sum('contractGapSar'):null};
 }
 add('RENT_LOCAL_DECLARED_EVIDENCE_ONLY','WARNING','scope');
 add('RENT_LEGAL_LIMIT_NOT_DETERMINED','WARNING','legal');
 const out={version:VERSION,scope:'LOCAL_DECLARED_PROPERTY_RENT_RESEARCH_ONLY',propertyRef:x.propertyRef,valuationDate:x.valuationDate,city:x.city,district:x.district,segments,total,status:total?'RESEARCH_INDICATION':'HOLD_INSUFFICIENT_OR_CONFLICTING_DATA',rentConvention:'DECLARED_NOMINAL_RENT_ONLY_ANNUALIZED_NOT_EFFECTIVE_LEASE_RENT',rangeKind:'OBSERVED_ADJUSTED_MIN_MAX_NOT_CONFIDENCE_INTERVAL',legalRentExVatSar:null,applicableVatRate:null,liveSourceConnected:false,sourceAuthenticated:false,professionalValuationCertified:false,transactionAuthorized:false,canonicalModelUpdated:false,issues};
 return {...out,reviewHashSha256:sha256Hex(JSON.stringify(out))};
}
module.exports={VERSION,KINDS,ADJUSTMENTS,evaluateRentalIntelligence};
