'use strict';
// Evidence checklist and explicit what-if scenarios; no inferred market adjustments.
const P=require('../engines/financial/precision');
const {KINDS}=require('./saudi-rental-intelligence');
const EVIDENCE=Object.freeze({
 APARTMENT:['FLOOR','UNIT_CONDITION','PARKING'],VILLA:['LAND_AND_BUILT_AREA','PRIVATE_AMENITIES','CONDITION'],
 RESIDENTIAL_BUILDING:['UNIT_MIX','COMMON_AREAS','OCCUPANCY_ROLL'],RESIDENTIAL_COMPOUND:['UNIT_MIX','SHARED_SERVICES','AMENITIES'],
 OFFICE:['FIT_OUT','PARKING_RATIO','SERVICE_CHARGES'],RETAIL_SHOP:['FRONTAGE','FOOTFALL','LEASE_TERMS'],
 SHOWROOM:['FRONTAGE','ACCESS','CLEAR_HEIGHT'],MALL_UNIT:['TRADE_AREA','FOOTFALL','TURNOVER_RENT'],MALL_WHOLE:['TENANT_MIX','ANCHOR_LEASES','SERVICE_CHARGES'],
 WAREHOUSE:['CLEAR_HEIGHT','LOADING_DOCKS','FIRE_SAFETY'],LOGISTICS:['TRUCK_ACCESS','LOADING_DOCKS','POWER'],
 FACTORY:['PERMITTED_USE','POWER','ENVIRONMENTAL_COMPLIANCE'],LAND:['PERMITTED_USE','INFRASTRUCTURE','TENURE'],
 HOTEL_PROPERTY:['PROPERTY_ONLY_RENT','OPERATOR_AGREEMENT','FF_E_EXCLUSION'],FUEL_STATION_PROPERTY:['PROPERTY_ONLY_RENT','LICENSES','ENVIRONMENTAL_LIABILITY'],
 SCHOOL_PROPERTY:['PERMITTED_USE','CAPACITY','PROPERTY_ONLY_RENT'],HEALTHCARE_PROPERTY:['PERMITTED_USE','TECHNICAL_SPECIFICATION','PROPERTY_ONLY_RENT'],
 DATA_CENTER_PROPERTY:['POWER_CAPACITY','COOLING','PROPERTY_ONLY_RENT'],PARKING_PROPERTY:['SPACE_COUNT','ACCESS','OPERATING_RIGHTS'],OTHER_PROPERTY:['PERMITTED_USE','LEASE_SCOPE','COMPARABILITY']
});
const SCENARIOS=Object.freeze([{id:'BASE',rentDelta:0,occupancyDelta:0,collectionDelta:0},{id:'DOWNSIDE',rentDelta:-.05,occupancyDelta:-.10,collectionDelta:-.05},{id:'SEVERE',rentDelta:-.15,occupancyDelta:-.20,collectionDelta:-.10},{id:'UPSIDE',rentDelta:.05,occupancyDelta:.05,collectionDelta:.02}].map(Object.freeze));
const rate=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=1;
const money=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=1e12;
const clamp=x=>Math.max(0,Math.min(1,x));
function specialistReview(report){
 if(!report||!Array.isArray(report.segments)||!report.segments.length||report.segments.length>50||report.segments.some(s=>!KINDS.includes(s.kind)||typeof s.id!=='string'))throw Error('SPECIALIST_SCOPE');
 const evidence=report.segments.map(s=>({id:s.id,kind:s.kind,requiredEvidence:[...EVIDENCE[s.kind]],status:'CHECKLIST_ONLY_NOT_VERIFIED'}));
 if(!report.total||report.segments.some(s=>!s.result))return {evidence,scenarios:[],status:'HOLD_INSUFFICIENT_EVIDENCE',financialInputEligible:false};
 if(report.segments.some(s=>!money(s.result.annualRentExVatSar)||!rate(s.occupancy)||!rate(s.collection)))throw Error('SPECIALIST_AMOUNT');
 const scenarios=SCENARIOS.map(a=>{
  const segments=report.segments.map(s=>{const annual=P.moneyMulRate(s.result.annualRentExVatSar,1+a.rentDelta),occupancy=clamp(s.occupancy+a.occupancyDelta),collection=clamp(s.collection+a.collectionDelta);
   return {id:s.id,annual,occupancy,collection,collected:P.moneyMulRate(P.moneyMulRate(annual,occupancy),collection)};});
  return {...a,segments,annual:P.moneyAdd(...segments.map(s=>s.annual)),collected:P.moneyAdd(...segments.map(s=>s.collected))};
 });
 return {evidence,scenarios,status:'DECLARED_WHAT_IF_NOT_MARKET_FORECAST',financialInputEligible:false};
}
module.exports={EVIDENCE,SCENARIOS,specialistReview};
