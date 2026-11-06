'use strict';
const assert=require('node:assert/strict');
const {auditValuationReadiness,ASSET_METHODS,evidenceRow,percentGap}=
 require('../../src/market/valuation-decision-gate');
const date=new Date('2026-10-28T00:00:00Z');
const subject={
 assetType:'RESIDENTIAL_COMPOUND',city:'الرياض',district:'الملقا',
 location:'24.75,46.65',landArea:'2000',builtArea:'5000',
 rentableArea:'4000',unitCount:'40',buildingCount:'3',
 historicalAnnualRent:'999999999',
};
const report={
 eligibleSalesCount:3,eligibleRentalsCount:3,districtOnlySalesCount:1,districtOnlyRentalsCount:0,
 saleIndicationSar:20e6,incomeIndicationSar:18e6,methodGapPct:10,materialMethodGap:false,
 todayValueScenarioSar:19e6,marketAnnualRentPotentialSar:2e6,
 rentRegulation:'EXISTING_RENT_FREEZE_REQUIRES_EJAR_REVIEW',
};
const sale={status:'EXECUTED',date:'2026-10-01',sourceUrl:'https://data.gov.sa/deal/1',
 location:'24.76,46.67'};
const rent={...sale,sourceUrl:'https://data.gov.sa/lease/1'};
const segmentation={status:'PRELIMINARY_SEGMENTED_RENT_UNVERIFIED',grossPotentialNewAnnualRentSar:1.9e6};
const r=auditValuationReadiness({subject,report,segmentedRent:segmentation,sales:[sale],rentals:[rent],asOf:date});
assert.equal(r.status,'PRELIMINARY_CALCULATION_UNVERIFIED');
assert.equal(r.preliminaryValueSar,19e6);
assert.equal(r.newAnnualMarketRentSar,1.9e6);
assert.equal(r.rentSource,'SEGMENTED_EXECUTED_LEASE_COMPARABLES');
assert.equal(r.legalAnnualRentSar,null);
assert.equal(r.certifiedValueSar,null);
assert.equal(r.publishableProfessionalReport,false);
assert.equal(r.metadataSummary.userAssertedExecutedSales,1);
assert.equal(r.metadataSummary.userAssertedSignedLeases,1);
assert.equal(r.notices.includes('SOURCE_INDEPENDENCE_NOT_VERIFIED'),true);
assert.equal(r.notices.includes('DISTRICT_APPROXIMATION_USED'),true);
assert.equal(r.historicAnnualRentUsed,false);
const changed=auditValuationReadiness({subject:{...subject,historicalAnnualRent:'0'},report,segmentedRent:segmentation,asOf:date});
assert.equal(changed.preliminaryValueSar,r.preliminaryValueSar);
assert.equal(changed.newAnnualMarketRentSar,r.newAnnualMarketRentSar);
const disputed=auditValuationReadiness({subject,report:{...report,materialMethodGap:true,methodGapPct:25,todayValueScenarioSar:null},asOf:date});
assert.equal(disputed.preliminaryValueSar,null);
assert.equal(disputed.issues.includes('METHODS_UNRECONCILED'),true);
const hugeRent=auditValuationReadiness({subject,report,
 segmentedRent:{...segmentation,grossPotentialNewAnnualRentSar:3e6},asOf:date});
assert.equal(hugeRent.preliminaryValueSar,null);
assert.equal(hugeRent.newAnnualMarketRentSar,null);
assert.equal(hugeRent.issues.includes('RENT_ESTIMATES_UNRECONCILED'),true);
const land=auditValuationReadiness({subject:{
 assetType:'LAND',location:'24.76,46.67',landArea:'20000',landSubtype:'RAW'
 },report:{eligibleSalesCount:3,todayValueScenarioSar:35e6,
 saleIndicationSar:35e6,marketAnnualRentPotentialSar:null},asOf:date});
assert.equal(land.preliminaryValueSar,35e6);
assert.equal(land.issues.includes('RENTABLE_AREA_MISSING'),false);
assert.equal(land.methodPolicy.primary,'MARKET_COMPARABLES');
const hotel=auditValuationReadiness({subject:{...subject,assetType:'HOTEL',roomCount:'100'},
 report:{...report,todayValueScenarioSar:150e6},asOf:date});
assert.equal(hotel.preliminaryValueSar,null);
assert.equal(hotel.issues.includes('SPECIALIST_METHOD_REQUIRED'),true);
const mixed=auditValuationReadiness({subject:{...subject,assetType:'MIXED_USE'},report,asOf:date});
assert.equal(mixed.preliminaryValueSar,null);
assert.equal(mixed.issues.includes('MIXED_USE_SEGMENT_VALUATION_REQUIRED'),true);
const blanks=auditValuationReadiness({subject:{assetType:'RESIDENTIAL_COMPOUND'},report,asOf:date});
assert.equal(blanks.preliminaryValueSar,null);
assert.equal(blanks.issues.includes('LOCATION_EVIDENCE_MISSING'),true);
assert.equal(blanks.issues.includes('LAND_AREA_MISSING'),true);
assert.equal(blanks.issues.includes('UNIT_COUNT_MISSING'),true);
assert.equal(Object.keys(ASSET_METHODS).length>=13,true);
assert.equal(percentGap(200,150),25);
assert.equal(evidenceRow(sale,'SALE',date).sourceVerifiedIndependently,false);
assert.equal(evidenceRow({...sale,status:'ASKING'},'SALE',date).tier,'EXCLUDED_UNVERIFIED_OR_ASKING');
console.log('STARTAK_PROPERTY_READINESS_AND_SOURCE_PROVENANCE=PASS');
