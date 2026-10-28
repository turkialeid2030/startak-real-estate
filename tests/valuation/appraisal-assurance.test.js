'use strict';
const assert = require('node:assert/strict');
const {number,auditAppraisal,compareVersions,classifyReportIds} = require('../../src/market/appraisal-assurance');
let total = 0;
const check = (name, f) => {f(); total++; process.stdout.write('PASS '+name+'\n');};
const base = {reportId:'SYN-001',valuationDate:'2026-01-01',property:{deedNumber:'FAKE-001',owner:'Example'},
  provenance:{reportFileHash:'sha256:synthetic',comparableEvidenceIndependentlyVerified:true}};
check('Arabic decimal and thousands separators',()=>assert.equal(number('١٬٨٠٠٫٥'),1800.5));
check('invalid ambiguous numeric input rejected',()=>assert.equal(number('١٨٠٠٫٥٫١'),null));
check('no false capitalization error',()=>{
 const r=auditAppraisal({...base,income:{annualNoiSar:4200000,capitalizationRatePct:7,indicatedValueSar:60000000}});
 assert.ok(!r.issues.some(x=>x.code==='INCOME_CAPITALIZATION_MISMATCH'));
});
check('material capitalization inconsistency blocks',()=>{
 const r=auditAppraisal({...base,income:{annualNoiSar:2100000,capitalizationRatePct:7,indicatedValueSar:55000000}});
 assert.equal(r.status,'HOLD');assert.ok(r.issues.some(x=>x.code==='INCOME_CAPITALIZATION_MISMATCH'));
 assert.equal(r.metrics.capitalizedIncomeValueSar,30000000);
});
check('independent rent evidence required',()=>{
 const r=auditAppraisal({...base,marketRent:{annualRentSar:355000,capitalValueBasisSar:7100000,percentOfCapitalValue:5}});
 assert.ok(r.issues.some(x=>x.code==='RENT_DERIVED_FROM_CAPITAL_NOT_MARKET_EVIDENCE'));
});
check('circular rent-to-income method blocks',()=>{
 const r=auditAppraisal({...base,marketRent:{derivation:'CAPITAL_VALUE_PERCENTAGE',usedAsIncomeApproachEvidence:true}});
 assert.ok(r.issues.some(x=>x.code==='CIRCULAR_VALUATION'));assert.equal(r.status,'HOLD');
});
check('NOI bridge checks revenues vacancy and expenses',()=>{
 const r=auditAppraisal({...base,income:{annualGrossRevenueSar:1000000,vacancyLossSar:100000,operatingExpensesSar:200000,annualNoiSar:950000}});
 assert.ok(r.issues.some(x=>x.code==='NOI_RECONCILIATION_MISMATCH'));
});
check('zero opex needs triple-net evidence',()=>{
 const r=auditAppraisal({...base,income:{operatingExpensesSar:0}});
 assert.ok(r.issues.some(x=>x.code==='ZERO_OPERATING_COST_UNSUPPORTED'));
});
check('report versions detect changed rent without value change',()=>{
 const older={...base,reported:{capitalValueSar:7100000,marketRentSar:213000}};
 const newer={...base,reported:{capitalValueSar:7100000,marketRentSar:284000}};
 const r=compareVersions(older,newer);assert.ok(r.flags.some(x=>x.code==='DEPENDENT_VALUE_UNCHANGED'));
});
check('same report number with different deed cannot collapse',()=>{
 const r=compareVersions(base,{...base,property:{...base.property,deedNumber:'FAKE-002'}});
 assert.equal(r.status,'HOLD');assert.ok(r.flags.some(x=>x.code==='REPORT_IDENTITY_COLLISION'));
});
check('same report number versions not counted twice',()=>{
 const x=classifyReportIds([base,{...base,valuationDate:'2026-01-02'}]);
 assert.equal(x.length,1);assert.equal(x[0].count,2);assert.equal(x[0].additivePortfolioValueSar,null);
});
check('output never claims certification',()=>{
 const r=auditAppraisal(base);assert.equal(r.certification,'NOT_AUTHORIZED');assert.equal(r.approvedForPublication,false);
});
process.stdout.write('SUCCESS '+total+'/'+total+' local unit checks\n');
