'use strict';
const assert = require('node:assert/strict');
const { number, extractCoordinates, distanceKm, evaluateMarketStudy } = require('../../src/market/instant-market-study');
const date = '2026-10-01';
const location = '24.700000,46.700000';
const asOf = new Date('2026-10-27T12:00:00Z');
const subject = {
  assetType: 'RESIDENTIAL_COMPOUND', name: 'مجمع سكني للاختبار', city: 'الرياض',
  location, landArea:'10000', builtArea:'30000', rentableArea:'25000', buildingCount:'5',
  unitCount:'200', historicalAnnualRent:'1000000', leaseHistory:'PREVIOUSLY_LEASED',
  urbanBoundary:'YES',
};
const assumptions = { occupancy:'0.9', expenseRatio:'0.20', capRate:'0.075' };
const comp = (value, area, kind, offset=0) => ({
  assetType:subject.assetType, status:'EXECUTED',
  date, sourceUrl:'https://rei.rega.gov.sa/',location:`24.70${offset},46.70${offset}`,
  ...(kind==='sale'?{price:String(value),builtArea:String(area)}:{annualRent:String(value),rentableArea:String(area)}),
});
const sales=[comp(120e6,20000,'sale',0),comp(126e6,20000,'sale',1),comp(114e6,20000,'sale',2)];
const rentals=[comp(20e6,20000,'rent',0),comp(22e6,20000,'rent',1),comp(18e6,20000,'rent',2)];
function study(overrides={}) {
  return evaluateMarketStudy({subject,sales,rentals,assumptions,asOf,...overrides});
}
assert.equal(number('١٬٨٠٠٫٥'),1800.5,'Arabic decimal must retain fractional part');
assert.equal(number(''),null);
assert.equal(number('1.2.3'),null);
assert.deepEqual(extractCoordinates('https://www.google.com/maps/@24.7,46.7,17z'),{lat:24.7,lng:46.7});
assert.deepEqual(extractCoordinates('https://maps.google.com/?q=24.7,46.7'),{lat:24.7,lng:46.7});
assert.equal(extractCoordinates('https://maps.app.goo.gl/short-link'),null,'unresolved shortened URL must not be guessed');
assert.equal(extractCoordinates('https://attacker.com/?q=24.7,46.7'),null,'untrusted map host');
assert.equal(extractCoordinates('100,200'),null,'invalid lat/lon');
assert.equal(distanceKm({lat:24.7,lng:46.7},{lat:24.7,lng:46.7}),0);
const good=study();
assert.equal(good.eligibleSalesCount,3);
assert.equal(good.eligibleRentalsCount,3);
assert.equal(good.medianExecutedSaleSarPerSqm,6000);
assert.equal(good.medianExecutedRentSarPerSqmYear,1000);
assert.equal(good.saleIndicationSar,180e6);
assert.equal(good.marketAnnualRentPotentialSar,25e6);
assert.equal(good.expectedCollectedAnnualRentSar,22.5e6);
assert.equal(good.estimatedAnnualNoiSar,18e6);
assert.equal(good.incomeIndicationSar,240e6);
assert.equal(good.todayValueScenarioSar,null,'a 25% gap requires reconciliation, not a 210m automatic average');
assert.equal(good.materialMethodGap,true);
assert.equal(good.methodGapPct,25);
assert.equal(good.issues.includes('MATERIAL_MARKET_INCOME_GAP_REQUIRES_RECONCILIATION'),true);
assert.equal(good.confidence,'UNRECONCILED_METHODS_NO_PRIMARY_VALUE');
const balancedRentals=[comp(15e6,20000,'rent',0),comp(16e6,20000,'rent',1),comp(14e6,20000,'rent',2)];
const balanced=study({rentals:balancedRentals});
assert.equal(balanced.incomeIndicationSar,180e6);
assert.equal(balanced.saleIndicationSar,180e6);
assert.equal(balanced.todayValueScenarioSar,180e6);
assert.equal(balanced.methodGapPct,0);
assert.equal(balanced.materialMethodGap,false);
assert.equal(good.averageMarketAnnualRentPerUnitSar,125000);
assert.equal(good.rentRegulation,'EXISTING_RENT_FREEZE_REQUIRES_EJAR_REVIEW');
assert.equal(good.independentlyVerified,false);
assert.equal(good.hasLiveLicensedFeed,false);
const historicalChange=study({subject:{...subject,historicalAnnualRent:'900000000'}});
assert.equal(historicalChange.todayValueScenarioSar,good.todayValueScenarioSar,'old lease must not change the hold');
const balancedHistorical=study({rentals:balancedRentals,subject:{...subject,historicalAnnualRent:'900000000'}});
assert.equal(balancedHistorical.todayValueScenarioSar,balanced.todayValueScenarioSar,'old rent cannot change a supported study');
const tooFew=study({sales:sales.slice(0,2),rentals:rentals.slice(0,2)});
assert.equal(tooFew.todayValueScenarioSar,null,'two comps cannot create a market value');
assert.equal(tooFew.marketAnnualRentPotentialSar,null,'two leases cannot create rental value');
const distant=study({sales:[...sales.slice(0,2),{...sales[2],location:'25.700000,46.700000'}]});
assert.equal(distant.eligibleSalesCount,2);
assert.equal(distant.saleIndicationSar,null);
const wrongType=study({sales:[...sales.slice(0,2),{...sales[2],assetType:'OFFICE_TOWER'}]});
assert.equal(wrongType.saleIndicationSar,null);
const asking=study({sales:[...sales.slice(0,2),{...sales[2],status:'ASKING'}]});
assert.equal(asking.saleIndicationSar,null);
const stale=study({rentals:[...rentals.slice(0,2),{...rentals[2],date:'2024-01-01'}]});
assert.equal(stale.marketAnnualRentPotentialSar,null);
const future=study({sales:[...sales.slice(0,2),{...sales[2],date:'2027-01-01'}]});
assert.equal(future.saleIndicationSar,null);
const outside=study({subject:{...subject,location:'invalid'}});
assert.equal(outside.todayValueScenarioSar,null);
assert.equal(outside.issues.includes('COORDINATES_REQUIRED'),true);
const projects=[{name:'محطة نقل قريبة',status:'UNDER_CONSTRUCTION',location,sourceUrl:'https://www.rcrc.gov.sa/',impactPct:'0.03'}];
const catalyst=study({projects});
assert.equal(catalyst.todayValueScenarioSar,null);
assert.equal(catalyst.projectScenarioSar,null,'unsupported base value also blocks a project-uplift scenario');
const balancedCatalyst=study({projects,rentals:balancedRentals});
assert.equal(balancedCatalyst.todayValueScenarioSar,180e6);
assert.equal(balancedCatalyst.projectScenarioSar,185.4e6);
assert.equal(catalyst.claimedProjectScenarioImpactPct,0.03);
const noProjectProof=study({projects:[{...projects[0],sourceUrl:''}]});
assert.equal(noProjectProof.projectScenarioSar,null);
const invalidRates=study({assumptions:{occupancy:'0.9',expenseRatio:'0.2',capRate:'0'}});
assert.equal(invalidRates.incomeIndicationSar,null);
assert.equal(invalidRates.saleIndicationSar,180e6);
const firstLease=study({subject:{...subject,leaseHistory:'FIRST_LEASE'}});
assert.equal(firstLease.rentRegulation,'FIRST_LEASE_TERMS_REQUIRE_REVIEW');
const hotel=study({
  subject:{...subject,assetType:'HOTEL',roomCount:'150'},
  sales:sales.map(x=>({...x,assetType:'HOTEL'})),
  rentals:rentals.map(x=>({...x,assetType:'HOTEL'})),
});
assert.equal(hotel.todayValueScenarioSar,null,'hotel business cannot be valued using generic NLA rent');
assert.equal(hotel.marketAnnualRentPotentialSar,null,'hotel rooms require ADR/RevPAR not simple residential rent');
assert.equal(hotel.confidence,'NO_SUPPORTED_PRIMARY_VALUE');
assert.equal(hotel.issues.includes('SPECIALIST_ASSET_REQUIRES_SECTOR_UNDERWRITING'),true);
console.log('STARTAK location market scenario tests: PASS (all assertions)');
