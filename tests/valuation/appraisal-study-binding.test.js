'use strict';
const assert=require('node:assert/strict');
const {validateIdentity,bindReview,evaluateBoundReview}=require('../../src/market/appraisal-study-binding');
const sha='a'.repeat(64);
const subject={name:'مبنى تجريبي',assetType:'COMMERCIAL_COMPLEX',landArea:1123.5,valuationDate:'2026-05-20'};
const appraisal={reportId:'DEMO-R-1',valuationDate:'2026-05-20',property:{name:'مبنى تجريبي',assetType:'COMMERCIAL_COMPLEX',areaSqm:'١٬١٢٣٫٥'}};
let count=0;
function check(name,fn){fn();console.log('PASS '+name);count++;}
const attach=(subject1=subject,extra={})=>bindReview({subject:subject1,appraisal,documentDigest:sha,review:{status:'HOLD',issues:[{code:'CIRCULAR_VALUATION'}]},confirmed:true,...extra});
check('explicit attest and source hash required',()=>{
 assert.equal(validateIdentity({subject,appraisal,documentDigest:sha}).status,'HOLD');
 assert.ok(validateIdentity({subject,appraisal,documentDigest:'faked',confirmed:true}).reasons.includes('SOURCE_PDF_SHA256_REQUIRED'));
});
check('Arabic decimal identity match only with exact area, asset type, value date',()=>{
 assert.equal(validateIdentity({subject,appraisal,documentDigest:sha,confirmed:true}).status,'MATCHED_USER_ATTESTED_NOT_INDEPENDENTLY_VERIFIED');
 assert.equal(validateIdentity({subject:{...subject,landArea:1124},appraisal,documentDigest:sha,confirmed:true}).status,'HOLD');
 assert.equal(validateIdentity({subject:{...subject,assetType:'HOTEL'},appraisal,documentDigest:sha,confirmed:true}).status,'HOLD');
 assert.equal(validateIdentity({subject:{...subject,valuationDate:'2026-05-21'},appraisal,documentDigest:sha,confirmed:true}).status,'HOLD');
});
check('review HOLD blocks preliminary export on matched subject',()=>{
 const r=attach();assert.equal(r.status,'LINKED_AUDIT_HOLD');
 const v=evaluateBoundReview({subject,link:r.link});
 assert.equal(v.appraisalReview.status,'HOLD');assert.equal(v.blockExport,true);
});
check('linked report cannot be silently reused for another property',()=>{
 const link=attach().link;
 const bad=evaluateBoundReview({subject:{...subject,name:'غير مطابق'},link});
 assert.equal(bad.status,'STALE_OR_UNMATCHED_LINK');assert.equal(bad.blockExport,true);
});
check('stale area or report source hash malformation blocks',()=>{
 const link=attach().link;
 assert.equal(evaluateBoundReview({subject:{...subject,landArea:1240},link}).blockExport,true);
 assert.equal(evaluateBoundReview({subject,link:{...link,documentDigest:'bad'}}).blockExport,true);
});
check('no link preserves legacy research and cannot certify report',()=>{
 const v=evaluateBoundReview({subject});
 assert.equal(v.status,'NOT_LINKED');assert.equal(v.appraisalReview,null);
 const l=bindReview({subject,appraisal,documentDigest:sha,review:{status:'REVIEW_REQUIRED'},confirmed:true});
 assert.equal(l.link.professionalUseAuthorized,false);
 assert.equal(evaluateBoundReview({subject,link:l.link}).blockExport,false);
});
check('once session is invalidated, reverting subject cannot restore authority',()=>{
 const link=attach().link;
 const invalidated={...link,invalidated:true};
 assert.equal(evaluateBoundReview({subject,link:invalidated}).status,'STALE_OR_UNMATCHED_LINK');
 assert.equal(evaluateBoundReview({subject,link:invalidated}).blockExport,true);
});
check('unknown report review status must be held, not silently downgraded',()=>{
 const tampered={...attach().link,reviewStatus:'UNKNOWN'};
 assert.equal(evaluateBoundReview({subject,link:tampered}).blockExport,true);
 assert.equal(evaluateBoundReview({subject,link:tampered}).status,'STALE_OR_UNMATCHED_LINK');
});
check('inconsistent reviewed issue cannot be linked as safe review',()=>{
 const r=bindReview({subject,appraisal,documentDigest:sha,confirmed:true,
  review:{status:'REVIEW_REQUIRED',issues:[{code:'CIRCULAR_VALUATION',severity:'BLOCK'}]}});
 assert.equal(r.link,null);assert.equal(r.status,'HOLD');
});
check('injected blocking issue in review-only link still blocks',()=>{
 const review=bindReview({subject,appraisal,documentDigest:sha,confirmed:true,
  review:{status:'REVIEW_REQUIRED',issues:[]}});
 const tampered={...review.link,issues:['CIRCULAR_VALUATION']};
 assert.equal(evaluateBoundReview({subject,link:tampered}).blockExport,true);
});
console.log('SUCCESS '+count+'/'+count+' independent binding tests');
