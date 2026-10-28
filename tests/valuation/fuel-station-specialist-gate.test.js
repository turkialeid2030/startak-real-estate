'use strict';
const assert=require('node:assert/strict');
const {ASSET_TYPES,evaluateMarketStudy}=require('../../src/market/instant-market-study');
const {auditValuationReadiness,ASSET_METHODS}=require('../../src/market/valuation-decision-gate');
const asOf=new Date('2026-10-28T00:00:00Z');
const subject={name:'موقع افتراضي للاختبار',assetType:'FUEL_STATION',
 location:'24.72,46.71',landArea:'1500',builtArea:'700',valuationDate:'2026-10-01'};
let n=0;function check(label,fn){fn();n++;console.log('PASS '+label);}
check('fuel station is a real selectable research asset, not a generic warehouse',()=>{
 assert.ok(ASSET_TYPES.FUEL_STATION);assert.ok(ASSET_METHODS.FUEL_STATION);
 assert.equal(ASSET_METHODS.FUEL_STATION.primary,'SPECIALIST_REAL_PROPERTY_AND_OPERATOR_SEPARATION');
});
check('fuel station never reports one provisional market price',()=>{
 const r=evaluateMarketStudy({subject,asOf});
 assert.equal(r.todayValueScenarioSar,null);
 assert.equal(r.incomeIndicationSar,null);
 assert.ok(r.issues.includes('SPECIALIST_ASSET_REQUIRES_SECTOR_UNDERWRITING'));
});
check('readiness gate refuses primary value despite fabricated generic report indication',()=>{
 const r=auditValuationReadiness({subject,report:{
  eligibleSalesCount:3,eligibleRentalsCount:3,todayValueScenarioSar:2000000,
  marketAnnualRentPotentialSar:180000,materialMethodGap:false
 },asOf});
 assert.equal(r.preliminaryValueSar,null);
 assert.equal(r.certifiedValueSar,null);
 assert.equal(r.publishableProfessionalReport,false);
 assert.ok(r.issues.includes('SPECIALIST_METHOD_REQUIRED'));
});
check('fuel operating profit as property rent is explicitly forbidden by method policy',()=>{
 assert.ok(ASSET_METHODS.FUEL_STATION.blocked.includes('FUEL_BUSINESS_PROFIT_AS_REAL_ESTATE_NOI'));
});
console.log('FUEL_SPECIALIST_GATE_TESTS='+n+'/'+n);
