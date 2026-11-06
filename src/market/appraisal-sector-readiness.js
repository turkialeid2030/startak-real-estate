'use strict';
// Strict evidence preflight for specialist appraisal reports; NOT a parallel valuation model.
// Existing hospitality, retail and industrial engines remain authoritative for their respective arithmetic.
const VERSION='APPRAISAL_SECTOR_EVIDENCE_PREFLIGHT_V1';
const TYPES=Object.freeze({HOTEL:'HOTEL',WAREHOUSE:'WAREHOUSE',LOGISTICS_PARK:'WAREHOUSE',
 COMMERCIAL_MALL:'COMMERCIAL_MALL',FUEL_STATION:'FUEL_STATION'});
const positive=x=>typeof x==='number'&&Number.isFinite(x)&&x>0;
const nonnegative=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
const ref=x=>typeof x==='string'&&x.trim().length>4&&x.trim().length<=256;
function evaluateSectorAppraisalEvidence({assetType,evidence=null}={}){
 const sector=TYPES[assetType]||null;
 if(!sector)return {version:VERSION,applicable:false,status:'NOT_APPLICABLE',blockers:[],
  specialistValuationAuthorized:false,certification:'NOT_AUTHORIZED'};
 const missing=[],metrics={},e=evidence&&typeof evidence==='object'&&!Array.isArray(evidence)?evidence:{};
 const requirePositive=(k)=>{if(!positive(e[k]))missing.push('INVALID_OR_MISSING_'+k);};
 const requireNonnegative=(k)=>{if(!nonnegative(e[k]))missing.push('INVALID_OR_MISSING_'+k);};
 const requiredRef=(k)=>{if(!ref(e[k]))missing.push('MISSING_EVIDENCE_'+k);};
 if(sector==='HOTEL'){
  ['availableRoomNights','occupiedRoomNights','roomRevenueSar','otherOperatingRevenueSar'].forEach(requireNonnegative);
  ['hotelOperatingExpensesSar','ffAndEReserveSar','operatingBusinessExclusionSar','realPropertyNoiSar'].forEach(requireNonnegative);
  requirePositive('availableRoomNights');
  if(nonnegative(e.occupiedRoomNights)&&nonnegative(e.availableRoomNights)&&
     e.occupiedRoomNights>e.availableRoomNights)missing.push('ROOM_OCCUPANCY_EXCEEDS_CAPACITY');
  if(nonnegative(e.roomRevenueSar)&&e.occupiedRoomNights===0&&e.roomRevenueSar>0)
   missing.push('ROOM_REVENUE_WITHOUT_OCCUPANCY');
  if(positive(e.occupiedRoomNights)&&nonnegative(e.roomRevenueSar))
   metrics.adrSar=e.roomRevenueSar/e.occupiedRoomNights;
  if(positive(e.availableRoomNights)&&nonnegative(e.roomRevenueSar)){
   metrics.revParSar=e.roomRevenueSar/e.availableRoomNights;
   if(nonnegative(e.occupiedRoomNights))metrics.occupancyRate=e.occupiedRoomNights/e.availableRoomNights;
  }
  const keys=['roomRevenueSar','otherOperatingRevenueSar','hotelOperatingExpensesSar','ffAndEReserveSar','operatingBusinessExclusionSar','realPropertyNoiSar'];
  if(keys.every(k=>nonnegative(e[k]))){
   metrics.calculatedRealPropertyNoiSar=e.roomRevenueSar+e.otherOperatingRevenueSar-e.hotelOperatingExpensesSar-e.ffAndEReserveSar-e.operatingBusinessExclusionSar;
   if(metrics.calculatedRealPropertyNoiSar<0||
      Math.abs(metrics.calculatedRealPropertyNoiSar-e.realPropertyNoiSar)>1)
    missing.push('HOTEL_PROPERTY_NOI_BRIDGE_MISMATCH');
  }
  if(e.realEstateAndOperatingBusinessSeparated!==true)
   missing.push('HOTEL_REAL_ESTATE_OPERATING_BUSINESS_NOT_SEPARATED');
  ['operatingStatementRef','managementAgreementRef','specialistReviewRef'].forEach(requiredRef);
 }else if(sector==='COMMERCIAL_MALL'){
  ['grossLeasableAreaSqm','leasedAreaSqm','annualBaseRentSar','annualTurnoverRentSar',
   'annualOtherPropertyRevenueSar','vacancyLossSar','landlordOperatingExpensesSar','realPropertyNoiSar'].forEach(requireNonnegative);
  requirePositive('grossLeasableAreaSqm');
  if(nonnegative(e.leasedAreaSqm)&&nonnegative(e.grossLeasableAreaSqm)&&
     e.leasedAreaSqm>e.grossLeasableAreaSqm)missing.push('MALL_LEASED_AREA_EXCEEDS_GLA');
  if(positive(e.grossLeasableAreaSqm)&&nonnegative(e.leasedAreaSqm))
    metrics.areaOccupancyRate=e.leasedAreaSqm/e.grossLeasableAreaSqm;
  const keys=['annualBaseRentSar','annualTurnoverRentSar','annualOtherPropertyRevenueSar','vacancyLossSar','landlordOperatingExpensesSar','realPropertyNoiSar'];
  if(keys.every(k=>nonnegative(e[k]))){
   metrics.calculatedRealPropertyNoiSar=e.annualBaseRentSar+e.annualTurnoverRentSar+
     e.annualOtherPropertyRevenueSar-e.vacancyLossSar-e.landlordOperatingExpensesSar;
   if(metrics.calculatedRealPropertyNoiSar<0||Math.abs(metrics.calculatedRealPropertyNoiSar-e.realPropertyNoiSar)>1)
    missing.push('MALL_NOI_BRIDGE_MISMATCH');
  }
  if(e.tenantMixAndConcentrationReviewed!==true)missing.push('MALL_TENANT_MIX_NOT_REVIEWED');
  ['rentRollRef','serviceChargeAllocationRef','specialistReviewRef'].forEach(requiredRef);
 }else if(sector==='WAREHOUSE'){
  ['builtAreaSqm','netLeasableAreaSqm','clearHeightMeters','annualPropertyRentSar',
   'landlordOperatingExpensesSar','realPropertyNoiSar'].forEach(requireNonnegative);
  ['builtAreaSqm','netLeasableAreaSqm','clearHeightMeters'].forEach(requirePositive);
  if(positive(e.builtAreaSqm)&&positive(e.netLeasableAreaSqm)&&e.netLeasableAreaSqm>e.builtAreaSqm)
   missing.push('WAREHOUSE_NLA_EXCEEDS_BUILT_AREA');
  if(nonnegative(e.annualPropertyRentSar)&&nonnegative(e.landlordOperatingExpensesSar)&&nonnegative(e.realPropertyNoiSar)){
    metrics.calculatedRealPropertyNoiSar=e.annualPropertyRentSar-e.landlordOperatingExpensesSar;
    if(metrics.calculatedRealPropertyNoiSar<0||Math.abs(metrics.calculatedRealPropertyNoiSar-e.realPropertyNoiSar)>1)
      missing.push('WAREHOUSE_NOI_BRIDGE_MISMATCH');
  }
  if(e.permittedUseAndFireSafetyVerified!==true)missing.push('WAREHOUSE_USE_AND_FIRE_EVIDENCE_REQUIRED');
  if(e.loadingAndUtilitiesReviewed!==true)missing.push('WAREHOUSE_LOADING_AND_UTILITIES_REQUIRED');
  ['buildingPermitRef','fireSafetyRef','leaseEvidenceRef','specialistReviewRef'].forEach(requiredRef);
 }else if(sector==='FUEL_STATION'){
  ['annualPropertyRentSar','landlordOperatingExpensesSar','realPropertyNoiSar','operatingBusinessIncomeSar'].forEach(requireNonnegative);
  requirePositive('annualPropertyRentSar');
  if(nonnegative(e.annualPropertyRentSar)&&nonnegative(e.landlordOperatingExpensesSar)&&nonnegative(e.realPropertyNoiSar)){
   metrics.calculatedRealPropertyNoiSar=e.annualPropertyRentSar-e.landlordOperatingExpensesSar;
   if(metrics.calculatedRealPropertyNoiSar<0||Math.abs(metrics.calculatedRealPropertyNoiSar-e.realPropertyNoiSar)>1)
     missing.push('FUEL_PROPERTY_NOI_BRIDGE_MISMATCH');
  }
  if(e.fuelBusinessExcludedFromRealPropertyNoi!==true)missing.push('FUEL_OPERATING_BUSINESS_NOT_EXCLUDED');
  if(e.environmentalAndTankLiabilityReviewed!==true)missing.push('FUEL_ENVIRONMENTAL_LIABILITY_UNREVIEWED');
  ['operatorLeaseRef','environmentalAssessmentRef','titleAndUseRef','specialistReviewRef'].forEach(requiredRef);
 }
 return {version:VERSION,applicable:true,sector,status:missing.length?'HOLD_SPECIALIST_EVIDENCE':'REVIEW_REQUIRED',
  blockers:[...new Set(missing)],metrics,independentlyVerified:false,
  specialistValuationAuthorized:false,certification:'NOT_AUTHORIZED',
  legacyGeneralRentMethodAuthorized:false};
}
module.exports={VERSION,TYPES,evaluateSectorAppraisalEvidence};
