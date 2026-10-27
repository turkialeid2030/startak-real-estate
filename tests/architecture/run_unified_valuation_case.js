'use strict';
const assert=require('node:assert/strict');
const {evaluateMarketStudy}=require('../../src/market/instant-market-study');
const {auditValuationReadiness}=require('../../src/market/valuation-decision-gate');
const {evaluateAppraisalReportQuality}=require('../../src/market/property-report-quality');
const asOf=new Date('2026-10-28T00:00:00Z');
const subject={assetType:'RESIDENTIAL_COMPOUND',name:'Synthetic residential compound',
 city:'الرياض',district:'الملقا',location:'24.75,46.65',
 landArea:'10000',builtArea:'30000',rentableArea:'25000',
 buildingCount:'5',unitCount:'200',historicalAnnualRent:'900000',
 valuationPurpose:'ACQUISITION',valuationDate:'2026-10-27',
 propertyRight:'FULL_OWNERSHIP',zoningClassification:'سكني',
 inspectionStatus:'ON_SITE',inspectionDate:'2026-10-26',
 urbanBoundary:'YES',leaseHistory:'PREVIOUSLY_LEASED'};
const assumptions={occupancy:'0.9',expenseRatio:'0.2',capRate:'0.075'};
const sales=[120e6,126e6,114e6].map((price,i)=>({
 assetType:subject.assetType,status:'EXECUTED',date:'2026-10-01',
 price:String(price),builtArea:'20000',location:'24.751,46.651',
 sourceUrl:'https://example.org/registered/sale-'+i,sourceRecordId:'S'+i,
}));
const rents=[15e6,16e6,14e6].map((rent,i)=>({
 assetType:subject.assetType,status:'EXECUTED',date:'2026-10-01',
 annualRent:String(rent),rentableArea:'20000',
 location:'24.751,46.651',sourceUrl:'https://example.org/registered/lease-'+i,
 sourceRecordId:'L'+i,
}));
function pipeline(sub=subject,rs=rents,segmentedRent=null){
 const report=evaluateMarketStudy({subject:sub,sales,rentals:rs,
  assumptions,asOf});
 const readiness=auditValuationReadiness({subject:sub,report,segmentedRent,
  sales,rentals:rs,asOf});
 const quality=evaluateAppraisalReportQuality({subject:sub,marketReport:report,
  readiness,asOf});
 return {report,readiness,quality};
}
const coherent=pipeline();
assert.equal(coherent.report.saleIndicationSar,180e6);
assert.equal(coherent.report.incomeIndicationSar,180e6);
assert.equal(coherent.report.todayValueScenarioSar,180e6);
assert.equal(coherent.readiness.preliminaryValueSar,180e6);
assert.equal(coherent.readiness.newAnnualMarketRentSar,18.75e6);
assert.equal(coherent.quality.certifiedReportExportAllowed,false);
assert.equal(coherent.quality.userDeclaredPresent,9);
const historical=pipeline({...subject,historicalAnnualRent:'100000000'});
assert.equal(historical.readiness.preliminaryValueSar,coherent.readiness.preliminaryValueSar);
assert.equal(historical.readiness.newAnnualMarketRentSar,coherent.readiness.newAnnualMarketRentSar);
const buildingCountMissing=pipeline({...subject,buildingCount:''});
assert.equal(buildingCountMissing.report.todayValueScenarioSar,180e6);
assert.equal(buildingCountMissing.readiness.preliminaryValueSar,null,
 'single readiness gate must suppress financially valid result with missing building metadata');
const badRent=pipeline(subject,[20e6,22e6,18e6].map((amount,i)=>({...rents[i],annualRent:String(amount)})));
assert.equal(badRent.report.incomeIndicationSar,240e6);
assert.equal(badRent.report.todayValueScenarioSar,null);
assert.equal(badRent.readiness.preliminaryValueSar,null);
const segmentedConflict=pipeline(subject,rents,{
 status:'PRELIMINARY_SEGMENTED_RENT_UNVERIFIED',grossPotentialNewAnnualRentSar:25e6});
assert.equal(segmentedConflict.readiness.preliminaryValueSar,null);
assert.equal(segmentedConflict.readiness.newAnnualMarketRentSar,null);
const landSubject={assetType:'LAND',location:'24.75,46.65',
 landArea:'10000',city:'الرياض',district:'الملقا',
 valuationPurpose:'ACQUISITION',valuationDate:'2026-10-27'};
const landSales=sales.map((x,i)=>({...x,assetType:'LAND',landArea:'8000',
 price:String(8e6+i*1e6)}));
const landReport=evaluateMarketStudy({subject:landSubject,sales:landSales,
 rentals:[],assumptions:{},asOf});
assert.equal(landReport.eligibleSalesCount,3);
assert.equal(landReport.issues.includes('RENTABLE_AREA_REQUIRED'),false);
assert.equal(landReport.issues.includes('OCCUPANCY_INVALID'),false);
assert.equal(landReport.issues.includes('CAP_RATE_INVALID'),false);
assert.equal(landReport.incomeIndicationSar,null);
assert.equal(landReport.todayValueScenarioSar,11.25e6);
const landReady=auditValuationReadiness({subject:landSubject,report:landReport,
 sales:landSales,rentals:[],asOf});
assert.equal(landReady.status,'PRELIMINARY_CALCULATION_UNVERIFIED');
assert.equal(landReady.newAnnualMarketRentSar,null);
assert.equal(landReady.methodPolicy.primary,'MARKET_COMPARABLES');
console.log('STARTAK_UNIFIED_VALUATION_CASE_INTEGRATION=PASS');
