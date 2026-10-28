'use strict';
const assert=require('node:assert/strict');
const {auditValuationReadiness}=require('../../src/market/valuation-decision-gate');
let count=0;
function test(label,fn){fn();count++;console.log('PASS '+label);}
const subject={assetType:'LAND',landArea:1000,valuationDate:'2026-01-01',location:'24.7136, 46.6753'};
const report={todayValueScenarioSar:1200000,eligibleSalesCount:3};
test('appraisal HOLD is carried into user-facing valuation readiness',()=>{
 const r=auditValuationReadiness({subject,report,appraisalReview:{status:'HOLD',issues:[{code:'INCOME_CAPITALIZATION_MISMATCH'}]},asOf:new Date('2026-10-28T00:00:00Z')});
 assert.ok(r.issues.includes('APPRAISAL_AUDIT_HOLD'));
 assert.equal(r.status,'HOLD_INSUFFICIENT_OR_CONFLICTING_EVIDENCE');
 assert.equal(r.preliminaryValueSar,null);
 assert.equal(r.publishableProfessionalReport,false);
});
test('appraisal REVIEW_REQUIRED cannot authorize a value or professional report',()=>{
 const r=auditValuationReadiness({subject,report,appraisalReview:{status:'REVIEW_REQUIRED'},asOf:new Date('2026-10-28T00:00:00Z')});
 assert.equal(r.appraisalReviewStatus,'REVIEW_REQUIRED');
 assert.ok(r.notices.includes('APPRAISAL_REVIEW_PENDING'));
 assert.equal(r.certifiedValueSar,null);
});
test('legacy callers do not require appraisal evidence argument',()=>{
 const r=auditValuationReadiness({subject,report,asOf:new Date('2026-10-28T00:00:00Z')});
 assert.equal(r.appraisalReviewStatus,'NOT_PROVIDED');
 assert.ok(!r.issues.includes('APPRAISAL_AUDIT_HOLD'));
});
console.log('SUCCESS '+count+'/'+count+' decision gate regression cases');
