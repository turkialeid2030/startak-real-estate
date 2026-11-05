'use strict';
const assert=require('node:assert/strict');
const {reviewAskingVsExecuted,evaluateUnitMixRents}=require('../../src/market/transaction-cohort-unit-mix');
const asOf=new Date('2026-10-27T12:00:00Z');
const subject={assetType:'RESIDENTIAL_COMPOUND',city:'الرياض',district:'الملقا',
 location:'24.76,46.67',builtArea:'3500',landArea:'1800',
 rentableArea:'580',unitCount:'5',historicalAnnualRent:'9999999'};
const asking=[1,2,3].map((i)=>({
 assetType:subject.assetType,offerKind:'SALE',evidenceType:'ASKING',
 date:'2026-10-01',sourceUrl:'https://sa.aqar.fm/asking/'+i,
 price:String([12000000,15000000,18000000][i-1]),builtArea:3000,
 city:'الرياض',district:'الملقا',location:'',availability:'ACTIVE',
}));
const sale=[1,2,3].map(i=>({
 assetType:subject.assetType,status:'EXECUTED',
 date:'2026-10-02',sourceUrl:'https://data.gov.sa/test/sales-'+i,
 sourceRecordId:'TX'+i,price:String([9000000,12000000,15000000][i-1]),builtArea:3000,
 city:'الرياض',district:'الملقا',location:'',
}));
const cohort=reviewAskingVsExecuted({subject,askingOffers:asking,executedSales:sale,asOf});
assert.equal(cohort.status,'COHORT_GAP_REVIEW_ONLY');
assert.equal(cohort.askingCount,3);
assert.equal(cohort.executedCount,3);
assert.equal(cohort.medianAskingSarPerSqm,5000);
assert.equal(cohort.medianExecutedSarPerSqm,4000);
assert.equal(cohort.askingMinusExecutedSarPerSqm,1000);
assert.equal(cohort.askingMinusExecutedPct,25);
assert.equal(cohort.notSamePropertyProof,true);
assert.equal(cohort.estimatedNegotiationDiscountPct,null);
assert.equal(cohort.certifiedValueSar,null);
const differentType=reviewAskingVsExecuted({subject,askingOffers:asking,
 executedSales:sale.map((x,i)=>i===2?{...x,assetType:'LAND'}:x),asOf});
assert.equal(differentType.executedCount,2);
assert.equal(differentType.askingMinusExecutedPct,null);
const spatial=reviewAskingVsExecuted({subject,askingOffers:asking,
 executedSales:sale.map((x,i)=>i===2?{...x,location:'21.5,39.3'}:x),asOf});
assert.equal(spatial.executedCount,2);
const duplicate=reviewAskingVsExecuted({subject,askingOffers:asking,
 executedSales:[sale[0],sale[1],{...sale[1]},sale[2]],asOf});
assert.equal(duplicate.executedCount,3);
assert.equal(duplicate.excluded.EXECUTED_DUPLICATE,1);
const poorArea=reviewAskingVsExecuted({subject,askingOffers:asking.map((x,i)=>i===0?{...x,builtArea:100}:x),
 executedSales:sale,asOf});
assert.equal(poorArea.askingCount,2);
const unitMix=[
 {unitType:'APARTMENT_1BR',unitCount:'3',areaPerUnitSqm:'100'},
 {unitType:'APARTMENT_2BR',unitCount:'2',areaPerUnitSqm:'140'},
];
const leases=[
 ...[100000,110000,120000].map((rent,i)=>({
  unitType:'APARTMENT_1BR',status:'EXECUTED',areaSqm:'100',
  date:'2026-09-20',annualRent:String(rent),
  sourceUrl:'https://data.gov.sa/lease/A'+i,sourceRecordId:'A'+i,
  city:'الرياض',district:'الملقا',location:'',
 })),
 ...[196000,210000,224000].map((rent,i)=>({
  unitType:'APARTMENT_2BR',status:'EXECUTED',areaSqm:'140',
  date:'2026-09-20',annualRent:String(rent),
  sourceUrl:'https://data.gov.sa/lease/B'+i,sourceRecordId:'B'+i,
  city:'الرياض',district:'الملقا',location:'',
 })),
];
const unit=evaluateUnitMixRents({subject,unitMix,leaseComparables:leases,asOf,
 stabilizedOccupancy:'.90',expenseRatio:'.20'});
assert.equal(unit.status,'PRELIMINARY_SEGMENTED_RENT_UNVERIFIED');
assert.equal(unit.totalModelUnits,5);
assert.equal(unit.totalModelRentableSqm,580);
assert.equal(unit.segments[0].marketRateSarPerSqmYear,1100);
assert.equal(unit.segments[1].marketRateSarPerSqmYear,1500);
assert.equal(unit.grossPotentialNewAnnualRentSar,750000);
assert.equal(unit.stabilizedAnnualRentSar,675000);
assert.equal(unit.stabilizedNoiSar,540000);
assert.equal(unit.historicAnnualRentUsedForPricing,false);
const alternateHistory=evaluateUnitMixRents({subject:{...subject,historicalAnnualRent:'0'},unitMix,
 leaseComparables:leases,asOf,stabilizedOccupancy:'.90',expenseRatio:'.20'});
assert.equal(alternateHistory.grossPotentialNewAnnualRentSar,unit.grossPotentialNewAnnualRentSar);
assert.equal(alternateHistory.stabilizedNoiSar,unit.stabilizedNoiSar);
const oneUnverified=evaluateUnitMixRents({subject,unitMix,leaseComparables:leases.map((l,i)=>
 i===0?{...l,status:'ASKING'}:l),asOf,stabilizedOccupancy:'.90',expenseRatio:'.20'});
assert.equal(oneUnverified.status,'HOLD_INCOMPLETE_UNIT_EVIDENCE');
assert.equal(oneUnverified.grossPotentialNewAnnualRentSar,null);
const shortMix=evaluateUnitMixRents({subject,unitMix:[unitMix[0]],leaseComparables:leases,asOf});
assert.equal(shortMix.errors.includes('UNIT_COUNT_DOES_NOT_RECONCILE'),true);
const wrongSize=evaluateUnitMixRents({subject,unitMix,leaseComparables:leases.map((l,i)=>
 i===0?{...l,areaSqm:'10'}:l),asOf});
assert.equal(wrongSize.status,'HOLD_INCOMPLETE_UNIT_EVIDENCE');
const hotel=evaluateUnitMixRents({subject:{...subject,assetType:'HOTEL'},unitMix,leaseComparables:leases,asOf});
assert.equal(hotel.status,'HOLD_INCOMPLETE_UNIT_EVIDENCE');
assert.equal(hotel.errors.includes('ASSET_NEEDS_SPECIALIST_RENT_MODEL'),true);
console.log('STARTAK_COHORT_AND_UNIT_MIX_RENT=PASS');
