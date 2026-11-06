'use strict';
const assert=require('node:assert/strict');
const {bindReview}=require('../../src/market/appraisal-study-binding');
const {evaluatePersonalReportExport,assertPersonalReportExportAllowed}=require('../../src/market/appraisal-report-export-gate');
const subject={name:'مبنى تجريبي',assetType:'RESIDENTIAL_COMPOUND',landArea:1333,valuationDate:'2026-04-15'};
const appraisal={reportId:'SYN-777',valuationDate:'2026-04-15',property:{
 name:'مبنى تجريبي',assetType:'RESIDENTIAL_COMPOUND',areaSqm:'١٣٣٣'}};
const link=status=>bindReview({subject,appraisal,documentDigest:'c'.repeat(64),
 confirmed:true,review:{status,issues:status==='HOLD'?[{code:'INCOME_CAPITALIZATION_MISMATCH'}]:[]}}).link;
let count=0;function check(name,fn){fn();console.log('PASS '+name);count++;}
check('unlinked personal draft remains exportable without professional certification',()=>{
 const g=evaluatePersonalReportExport({subject,link:null});
 assert.equal(g.blocked,false);assert.equal(g.professionalValuationAuthorized,false);
});
check('linked arithmetic HOLD quarantines both personal report exports',()=>{
 const g=evaluatePersonalReportExport({subject,link:link('HOLD')});
 assert.equal(g.blocked,true);assert.equal(g.status,'BLOCKED_LINKED_APPRAISAL');
 assert.throws(()=>assertPersonalReportExportAllowed({subject,link:link('HOLD')}),/APPRAISAL_AUDIT_HOLD/);
});
check('stale link never authorizes report export',()=>{
 const g=evaluatePersonalReportExport({subject:{...subject,valuationDate:'2026-04-16'},link:link('REVIEW_REQUIRED')});
 assert.equal(g.blocked,true);
});
check('invalidated link remains quarantined after values revert',()=>{
 const g=evaluatePersonalReportExport({subject,link:{...link('REVIEW_REQUIRED'),invalidated:true}});
 assert.equal(g.blocked,true);
});
check('malformed links fail closed',()=>{
 assert.equal(evaluatePersonalReportExport({subject,link:{kind:'SPOOFED'}}).blocked,true);
 assert.equal(evaluatePersonalReportExport({subject,link:[]}).blocked,true);
});
check('linked review-only draft remains personal, never professionally authorized',()=>{
 const g=evaluatePersonalReportExport({subject,link:link('REVIEW_REQUIRED')});
 assert.equal(g.blocked,false);assert.equal(g.professionalValuationAuthorized,false);
 assert.equal(g.status,'UNVERIFIED_PERSONAL_DRAFT_ONLY');
});
console.log('PERSONAL_REPORT_EXPORT_GATE='+count+'/'+count);
