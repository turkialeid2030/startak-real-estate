'use strict';
const assert=require('node:assert/strict');
const {proposeFinancialToMarketIdentity,applyFinancialToMarketIdentity}=
 require('../../src/market/financial-to-market-identity');
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
const building=proposeFinancialToMarketIdentity({mode:'building',
 inputs:{projectTitle:'مبنى تجريبي',landLength:100,landWidth:50},
 results:{financialModelStatus:'VALID',landArea:5000,totalFloorArea:9000,netLeasableArea:7800}});
eq(building.status,'USER_CONFIRMATION_REQUIRED');
eq(building.subjectPatch.assetType,undefined);
eq(building.subjectPatch.landArea,'5000');
eq(building.subjectPatch.rentableArea,'7800');
eq(building.independentTitleVerified,false);
const original={assetType:'RESIDENTIAL_COMPOUND',name:'بحث سابق',city:'جدة',
 district:'السلامة',location:'21.5,39.1',propertyRight:'UNKNOWN',landArea:'900'};
eq(applyFinancialToMarketIdentity({proposal:building,subject:original,confirmed:false}).status,
 'HOLD_NO_EXPLICIT_CONFIRMATION');
eq(applyFinancialToMarketIdentity({proposal:building,subject:original,confirmed:true}).status,
 'HOLD_ASSET_TYPE_MUST_BE_EXPLICITLY_SELECTED');
const approved=applyFinancialToMarketIdentity({
 proposal:building,subject:original,confirmed:true,selectedAssetType:'OFFICE_TOWER'});
eq(approved.status,'COPIED_USER_CONFIRMED_NOT_VERIFIED');
eq(approved.subject.assetType,'OFFICE_TOWER');
eq(approved.subject.city,'جدة');
eq(approved.subject.location,'21.5,39.1');
eq(approved.subject.propertyRight,'UNKNOWN');
eq(approved.subject.landArea,'5000');
eq(approved.subject.name,'مبنى تجريبي');
eq(approved.independentlyVerified,false);
eq(original.name,'بحث سابق');
const blocked=proposeFinancialToMarketIdentity({mode:'building',
 inputs:{projectTitle:'X'},results:{financialModelStatus:'VALID',landArea:5000},
 validationError:{field:'buildingPrice'}});
eq(blocked.status,'HOLD_FINANCIAL_IDENTITY_UNAVAILABLE');
const land=proposeFinancialToMarketIdentity({mode:'land',inputs:{projectTitle:'أرض اختبار'},
 results:{financialModelStatus:'VALID',landArea:1800}});
eq(land.subjectPatch.assetType,'LAND');
const landApplied=applyFinancialToMarketIdentity({proposal:land,subject:original,confirmed:true});
eq(landApplied.subject.assetType,'LAND');
eq(landApplied.subject.city,'جدة');
console.log('D06_FINANCIAL_MARKET_IDENTITY_BRIDGE=PASS checks='+checks);
