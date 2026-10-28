'use strict';
const assert=require('node:assert/strict');
const {evaluateSectorAppraisalEvidence:e}=require('../../src/market/appraisal-sector-readiness');
let n=0;function t(x,f){f();n++;console.log('PASS '+x);}
t('hotel absent audited operating data fails closed',()=>{
 const r=e({assetType:'HOTEL'});assert.equal(r.status,'HOLD_SPECIALIST_EVIDENCE');
 assert.equal(r.specialistValuationAuthorized,false);
});
t('hotel occupancy cannot exceed available room nights',()=>{
 const r=e({assetType:'HOTEL',evidence:{availableRoomNights:100,occupiedRoomNights:101}});
 assert.ok(r.blockers.includes('ROOM_OCCUPANCY_EXCEEDS_CAPACITY'));
});
t('hotel real-property NOI is isolated from operating business',()=>{
 const r=e({assetType:'HOTEL',evidence:{
 availableRoomNights:1000,occupiedRoomNights:600,roomRevenueSar:900000,
 otherOperatingRevenueSar:100000,hotelOperatingExpensesSar:300000,
 ffAndEReserveSar:40000,operatingBusinessExclusionSar:60000,realPropertyNoiSar:600000,
 realEstateAndOperatingBusinessSeparated:true,operatingStatementRef:'synthetic1',
 managementAgreementRef:'synthetic2',specialistReviewRef:'synthetic3'}});
 assert.equal(r.status,'REVIEW_REQUIRED');assert.equal(r.metrics.adrSar,1500);
 assert.equal(r.metrics.calculatedRealPropertyNoiSar,600000);
 assert.equal(r.certification,'NOT_AUTHORIZED');
});
t('mall leased area above GLA cannot qualify',()=>{
 assert.ok(e({assetType:'COMMERCIAL_MALL',evidence:{grossLeasableAreaSqm:1000,leasedAreaSqm:1300}})
 .blockers.includes('MALL_LEASED_AREA_EXCEEDS_GLA'));
});
t('warehouse GLA and fire safety are independently required',()=>{
 const x=e({assetType:'WAREHOUSE',evidence:{builtAreaSqm:1000,netLeasableAreaSqm:1200}});
 assert.ok(x.blockers.includes('WAREHOUSE_NLA_EXCEEDS_BUILT_AREA'));
 assert.ok(x.blockers.includes('WAREHOUSE_USE_AND_FIRE_EVIDENCE_REQUIRED'));
});
t('logistics park alias uses warehouse specialist gate',()=>{
 assert.equal(e({assetType:'LOGISTICS_PARK'}).sector,'WAREHOUSE');
});
t('fuel operation profit cannot substitute for property NOI',()=>{
 const x=e({assetType:'FUEL_STATION',evidence:{annualPropertyRentSar:500000,
 landlordOperatingExpensesSar:100000,realPropertyNoiSar:650000,operatingBusinessIncomeSar:300000}});
 assert.ok(x.blockers.includes('FUEL_PROPERTY_NOI_BRIDGE_MISMATCH'));
 assert.ok(x.blockers.includes('FUEL_OPERATING_BUSINESS_NOT_EXCLUDED'));
});
t('ordinary property is not categorized as sector-authorized',()=>{
 const x=e({assetType:'LAND'});assert.equal(x.applicable,false);
 assert.equal(x.specialistValuationAuthorized,false);
});
console.log('SECTOR_EVIDENCE_TESTS='+n+'/'+n);
