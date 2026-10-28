'use strict';
const assert=require('node:assert/strict');
const {evaluateAppraisalReportQuality}=require('../../src/market/property-report-quality');
const asOf=new Date('2026-10-28T00:00:00Z');
const subject={assetType:'RESIDENTIAL_COMPOUND',name:'Synthetic residential compound',
 city:'الرياض',district:'الملقا',location:'24.75,46.65',
 valuationPurpose:'ACQUISITION',valuationDate:'2026-10-27',
 propertyRight:'FULL_OWNERSHIP',zoningClassification:'سكني',
 inspectionStatus:'ON_SITE',inspectionDate:'2026-10-26'};
const ready={methodPolicy:{primary:'MARKET_AND_INCOME'},status:'PRELIMINARY_CALCULATION_UNVERIFIED',
 evidenceCounts:{salesQualifiedByExistingCalculator:3}};
const good=evaluateAppraisalReportQuality({subject,marketReport:{materialMethodGap:false},
 readiness:ready,asOf});
assert.equal(good.items.length,11);
assert.equal(good.userDeclaredPresent,9);
assert.equal(good.missingOrUnverified,0);
assert.equal(good.requiresExternalReview,2);
assert.equal(good.approved,false);
assert.equal(good.certifiedReportExportAllowed,false);
assert.equal(good.items.find(x=>x.id==='RENT_LEGAL').status,'REQUIRES_EXTERNAL_REVIEW');
assert.equal(good.items.find(x=>x.id==='INDEPENDENT_REVIEW').status,'REQUIRES_EXTERNAL_REVIEW');
const remote=evaluateAppraisalReportQuality({
 subject:{...subject,inspectionStatus:'REMOTE_ONLY'},
 marketReport:{materialMethodGap:true},
 readiness:{...ready,status:'HOLD_INSUFFICIENT_OR_CONFLICTING_EVIDENCE'},asOf,
});
assert.equal(remote.items.find(x=>x.id==='SITE_INSPECTION').status,'MISSING_OR_UNVERIFIED');
assert.equal(remote.items.find(x=>x.id==='RECONCILIATION').status,'MISSING_OR_UNVERIFIED');
const future=evaluateAppraisalReportQuality({subject:{
 ...subject,valuationDate:'2028-01-01',inspectionDate:'2029-01-01'},
 marketReport:{},readiness:ready,asOf});
assert.equal(future.items.find(x=>x.id==='VALUATION_DATE').status,'MISSING_OR_UNVERIFIED');
assert.equal(future.items.find(x=>x.id==='SITE_INSPECTION').status,'MISSING_OR_UNVERIFIED');
assert.equal(evaluateAppraisalReportQuality({asOf}).items.length,11);
console.log('STARTAK_APPRAISAL_REPORT_QA_FAIL_CLOSED=PASS');
