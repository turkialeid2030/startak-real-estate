'use strict';
// Carefully restore user-authored study INPUTS from local JSON.
// Computed report/valuation/certification fields in the file are intentionally ignored.
const {ASSET_TYPES}=require('./instant-market-study');
const KIND='STARTAK_PERSONAL_MARKET_STUDY',MAX_BYTES=2*1024*1024;
const subjectKeys='name assetType landSubtype city district location landArea builtArea rentableArea buildingCount unitCount floorCount roomCount shopCount parkingCount warehouseCount clearHeight loadingDocks historicalAnnualRent leaseHistory urbanBoundary valuationPurpose valuationDate propertyRight zoningClassification inspectionStatus inspectionDate'.split(' ');
const marketKeys='occupancy expenseRatio capRate'.split(' ');
const rentKeys='expenseRatio stabilizedOccupancy'.split(' ');
const saleKeys='assetType landSubtype status price annualRent builtArea landArea rentableArea date location sourceUrl sourceRecordId city district'.split(' ');
const projectKeys='name status location sourceUrl impactPct'.split(' ');
const offerKeys='offerKind assetType landSubtype evidenceType date sourceUrl price annualRent rentPeriod investmentTerms builtArea landArea rentableArea city district location availability'.split(' ');
const mixKeys='unitType unitCount areaPerUnitSqm'.split(' ');
const leaseKeys='unitType status date annualRent areaSqm sourceUrl sourceRecordId city district location'.split(' ');
const LIMITS={
 sales:500,rentals:500,projects:100,marketOffers:300,unitMix:30,leaseComparables:250,
};
function pickStrings(value,keys){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('STUDY_OBJECT_REQUIRED');
 const out={};
 for(const k of keys)if(Object.prototype.hasOwnProperty.call(value,k)){
  const v=value[k];
  if(v!==null&&typeof v!=='string'&&typeof v!=='number'&&typeof v!=='boolean')
   throw Error('STUDY_FIELD_INVALID_'+k);
  const asText=v===null?'':String(v);
  if(asText.length>4096)throw Error('STUDY_FIELD_TOO_LONG_'+k);
  out[k]=asText;
 }
 return out;
}
function rows(o,key,fields){
 const data=o[key]===undefined?[]:o[key];
 if(!Array.isArray(data)||data.length>LIMITS[key])throw Error('STUDY_ROWS_INVALID_'+key);
 return data.map(r=>pickStrings(r,fields));
}
function parsePersonalMarketStudy(value){
 if(typeof value!=='string'||value.length>MAX_BYTES)throw Error('STUDY_SIZE_LIMIT');
 let data;
 try{data=JSON.parse(value)}catch{throw Error('STUDY_JSON_INVALID');}
 if(!data||typeof data!=='object'||Array.isArray(data)||data.kind!==KIND)
  throw Error('STUDY_FORMAT_UNSUPPORTED');
 // Restore MUST be deterministic. Missing fields become blank and fail closed;
 // never reuse stale fields from an already-open different property.
 const subject=Object.assign(Object.fromEntries(subjectKeys.map(k=>[k,''])),
   pickStrings(data.subject,subjectKeys));
 if(!Object.prototype.hasOwnProperty.call(ASSET_TYPES,subject.assetType))
  throw Error('STUDY_ASSET_TYPE_INVALID');
 const assumptions=Object.assign(Object.fromEntries(marketKeys.map(k=>[k,''])),
   pickStrings(data.assumptions||{},marketKeys));
 const rentAssumptions=Object.assign(Object.fromEntries(rentKeys.map(k=>[k,''])),
   pickStrings(data.rentAssumptions||{},rentKeys));
 const study={
  subject,assumptions,
  sales:rows(data,'sales',saleKeys),
  rentals:rows(data,'rentals',saleKeys),
  projects:rows(data,'projects',projectKeys),
  marketOffers:rows(data,'marketOffers',offerKeys),
  unitMix:rows(data,'unitMix',mixKeys),
  leaseComparables:rows(data,'leaseComparables',leaseKeys),
  rentAssumptions,
 };
 // Never trust report, appraisedAmount, approved, certified, independentlyVerified,
 // or persisted computed results from import; all calculations MUST be recomputed.
 return {study,restoredFrom:'USER_SUPPLIED_JSON',
  verified:false,discardedComputedOutputs:true};
}
module.exports={KIND,MAX_BYTES,parsePersonalMarketStudy};
