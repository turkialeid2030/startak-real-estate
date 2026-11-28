'use strict';
// Personal operating diagnostics only. No transfer to property NOI, financial
// cashflows, valuation, evidence certification or an external decision.
const {calculateMetrics,sourceReconciliation}=require('./hospitality-metrics-core');
const {createIndustrialLogisticsAssetSpec,profileIndustrialLogisticsAsset,deriveAnnualRentPerSqm,
 INDUSTRIAL_SUBTYPE,LEASE_STRUCTURE,INTERNAL_INSPECTION_STATUS,BUILDING_PERMIT_STATUS}=require('../valuation-intelligence/adapters/industrial-logistics');
const STATUS=Object.freeze({HOLD:'HOLD',READY:'OPERATING_RESEARCH_ONLY'});
const HOTEL_FIELDS=['availableRoomNights','occupiedRoomNights','roomsRevenueSar','foodBeverageRevenueSar','otherOperatingRevenueSar','departmentalExpensesSar','undistributedOperatingExpensesSar','managementAndFranchiseFeesSar','ffeReserveSar'];
const CAPACITY_SECTORS=Object.freeze({HEALTHCARE:'BED',EDUCATION:'SEAT',PARKING:'SPACE',DATA_CENTER:'MW_IT'});
const SUPPORTED_SECTORS=Object.freeze(['HOSPITALITY','INDUSTRIAL_LOGISTICS',...Object.keys(CAPACITY_SECTORS),'MIXED_USE','SPECIAL_PURPOSE','FUEL_STATION']);
const num=(v,max=1e13)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max;
const pos=(v,max)=>num(v,max)&&v>0;
const filled=v=>typeof v==='string'&&v.trim().length>0&&v.length<=200;
const freeze=v=>{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
function result(assetClass,issues,metrics=null){
 return freeze({assetClass,status:issues.length?STATUS.HOLD:STATUS.READY,issues:[...new Set(issues)],metrics:issues.length?null:metrics,
  independentEvidenceVerified:false,propertyNoiAdopted:false,propertyValueSar:null,professionalValuationCertified:false,
  commercialReportAuthorized:false,transactionAuthorized:false});
}
function evaluateLocalSectorOperations({assetClass,inputs}={}){
 if(typeof assetClass!=='string'||!SUPPORTED_SECTORS.includes(assetClass))return result(null,['SPECIALIST_SECTOR_UNSUPPORTED']);
 if(!inputs||typeof inputs!=='object'||Array.isArray(inputs))return result(assetClass,['INPUTS_REQUIRED']);
 const x=inputs;let metrics;
 if(assetClass==='HOSPITALITY'){
  if(!HOTEL_FIELDS.every(k=>num(x[k]))||!pos(x.availableRoomNights)||!Number.isSafeInteger(x.availableRoomNights)||!Number.isSafeInteger(x.occupiedRoomNights)||x.occupiedRoomNights>x.availableRoomNights||(x.occupiedRoomNights===0&&x.roomsRevenueSar!==0))
   return result(assetClass,['HOTEL_OPERATING_INPUTS_INVALID']);
  metrics=calculateMetrics(Object.fromEntries(HOTEL_FIELDS.map(k=>[k,x[k]])));
  if(Object.hasOwn(x,'sourceReported')){
   const reconciliation=sourceReconciliation({...x,sourceReported:x.sourceReported});
   if(reconciliation.status==='HOLD')return result(assetClass,reconciliation.reasons);
   metrics={...metrics,sourceReconciliationStatus:reconciliation.status};
  }
 }else if(assetClass==='INDUSTRIAL_LOGISTICS'){
  if(!filled(x.assetId)||!pos(x.landAreaSqm,1e9)||!pos(x.builtAreaSqm,1e9)||!pos(x.netLeasableAreaSqm,1e9)||x.netLeasableAreaSqm>x.builtAreaSqm||!pos(x.clearHeightMeters,1000)||!pos(x.powerCapacityKva,1e9)||!num(x.annualRentSar)||!num(x.landlordExpensesSar)||x.landlordExpensesSar>x.annualRentSar||
   !Object.values(INDUSTRIAL_SUBTYPE).includes(x.subtype)||!Object.values(LEASE_STRUCTURE).includes(x.leaseStructure)||x.leaseStructure===LEASE_STRUCTURE.UNKNOWN||
   !Object.values(INTERNAL_INSPECTION_STATUS).includes(x.internalInspectionStatus)||!Object.values(BUILDING_PERMIT_STATUS).includes(x.buildingPermitStatus))
   return result(assetClass,['INDUSTRIAL_OPERATING_INPUTS_INVALID']);
  if(x.landlordExpensesSar===0&&x.annualRentSar>0&&(![LEASE_STRUCTURE.TRIPLE_NET,LEASE_STRUCTURE.TENANT_BORNE_OPEX].includes(x.leaseStructure)||x.tenantOpexConfirmed!==true))
   return result(assetClass,['INDUSTRIAL_ZERO_OPEX_REQUIRES_CONFIRMED_LEASE']);
  try{
   const spec=createIndustrialLogisticsAssetSpec({assetId:x.assetId,subtype:x.subtype,customSubtype:x.customSubtype||null,landAreaSqm:x.landAreaSqm,builtAreaSqm:x.builtAreaSqm,netLeasableAreaSqm:x.netLeasableAreaSqm,clearHeightMeters:x.clearHeightMeters,powerCapacityKva:x.powerCapacityKva,leaseStructure:x.leaseStructure,internalInspectionStatus:x.internalInspectionStatus,buildingPermitStatus:x.buildingPermitStatus});
   const profile=profileIndustrialLogisticsAsset(spec);
   metrics={coverageRatio:profile.coverageRatio,leasableEfficiency:profile.leasableEfficiency,annualRentPerLeasableSqm:x.annualRentSar===0?0:deriveAnnualRentPerSqm({annualRent:x.annualRentSar,netLeasableAreaSqm:x.netLeasableAreaSqm}),declaredNetPropertyIncomeSar:x.annualRentSar-x.landlordExpensesSar,operationalSpecCompleteness:profile.operationalSpecCompleteness,missingOperationalSpecs:[...profile.missingOperationalSpecs],warnings:[...profile.warnings]};
  }catch{return result(assetClass,['INDUSTRIAL_SPEC_INVALID']);}
 }else if(assetClass==='FUEL_STATION'){
  if(!num(x.annualLitres,1e10)||!pos(x.sellingPricePerLitre,100)||!num(x.purchaseCostPerLitre,100)||
   !['annualNonFuelRevenueSar','annualNonFuelDirectCostSar','annualOperatingExpensesSar','annualPropertyRentSar','annualEnvironmentalReserveSar'].every(k=>num(x[k]))||
   x.nonFuelSeparated!==true||x.propertyRentSeparated!==true||x.environmentalReviewDeclared!==true)
   return result(assetClass,['FUEL_STATION_OPERATING_INPUTS_INVALID']);
  const fuelRevenue=x.annualLitres*x.sellingPricePerLitre,fuelPurchase=x.annualLitres*x.purchaseCostPerLitre;
  if(!num(fuelRevenue)||!num(fuelPurchase))return result(assetClass,['FUEL_STATION_OPERATING_INPUTS_INVALID']);
  const fuelMarginSar=fuelRevenue-fuelPurchase,nonFuelMarginSar=x.annualNonFuelRevenueSar-x.annualNonFuelDirectCostSar;
  metrics={fuelRevenueSar:fuelRevenue,fuelMarginSar,nonFuelMarginSar,contributionPerLitreSar:x.sellingPricePerLitre-x.purchaseCostPerLitre,
   operatingSurplusSar:fuelMarginSar+nonFuelMarginSar-x.annualOperatingExpensesSar-x.annualPropertyRentSar-x.annualEnvironmentalReserveSar};
 }else if(Object.hasOwn(CAPACITY_SECTORS,assetClass)){
  const integral=assetClass!=='DATA_CENTER';
  if(!pos(x.capacity,1e9)||!num(x.usedCapacity,1e9)||x.usedCapacity>x.capacity||(integral&&(!Number.isSafeInteger(x.capacity)||!Number.isSafeInteger(x.usedCapacity)))||!num(x.annualOperatingRevenueSar)||!num(x.annualOperatingExpensesSar))
    return result(assetClass,['CAPACITY_OPERATING_INPUTS_INVALID']);
  metrics={unit:CAPACITY_SECTORS[assetClass],utilizationRate:x.usedCapacity/x.capacity,operatingRevenuePerCapacitySar:x.annualOperatingRevenueSar/x.capacity,operatingSurplusSar:x.annualOperatingRevenueSar-x.annualOperatingExpensesSar};
 }else if(assetClass==='MIXED_USE'){
  if(!Array.isArray(x.segments)||x.segments.length<2||x.segments.length>20||!num(x.commonExpensesSar)||!pos(x.totalLeasableAreaSqm,1e9)||x.sharedExpensesAllocatedOnce!==true)return result(assetClass,['MIXED_USE_SEGMENT_INPUTS_INVALID']);
  const ids=new Set();let area=0,revenue=0,expenses=0;
  for(const seg of x.segments){if(!seg||!filled(seg.id)||ids.has(seg.id.trim())||!pos(seg.areaSqm,1e9)||!num(seg.annualPropertyRevenueSar)||!num(seg.annualDirectExpensesSar)||seg.propertyIncomeOnly!==true)return result(assetClass,['MIXED_USE_SEGMENT_INPUTS_INVALID']);ids.add(seg.id.trim());area+=seg.areaSqm;revenue+=seg.annualPropertyRevenueSar;expenses+=seg.annualDirectExpensesSar;}
  if(Math.abs(area-x.totalLeasableAreaSqm)>0.01)return result(assetClass,['MIXED_USE_AREA_NOT_RECONCILED']);
  metrics={segmentCount:ids.size,totalLeasableAreaSqm:area,totalPropertyRevenueSar:revenue,totalPropertyExpensesSar:expenses+x.commonExpensesSar,declaredNetPropertyIncomeSar:revenue-expenses-x.commonExpensesSar};
 }else{
  if(!filled(x.propertyRightRef)||!pos(x.replacementCostSar)||!num(x.physicalLossSar)||!num(x.functionalLossSar)||!num(x.externalLossSar)||!num(x.landValueSar)||x.lossCausesDistinct!==true||x.businessAssetsExcluded!==true)return result(assetClass,['SPECIAL_PURPOSE_COST_INPUTS_INVALID']);
  const total=x.physicalLossSar+x.functionalLossSar+x.externalLossSar;if(total>x.replacementCostSar)return result(assetClass,['SPECIAL_PURPOSE_LOSS_EXCEEDS_COST']);
  metrics={totalDeclaredLossSar:total,remainingImprovementCostSar:x.replacementCostSar-total,declaredLandAmountSar:x.landValueSar};
 }
 return result(assetClass,[],metrics);
}
module.exports={STATUS,HOTEL_FIELDS,CAPACITY_SECTORS,SUPPORTED_SECTORS,evaluateLocalSectorOperations};
