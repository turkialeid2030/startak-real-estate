'use strict';
const assert=require('node:assert/strict');
const {buildC6SavedDeal}=require('../fixtures/c6-governed-saved-deal');
const {C6_REVIEW_RECOMMENDATION}=require('../../src/contracts/governed-human-review');
const {
 buildGovernedHumanReview,validateGovernedHumanReview,
 withGovernedHumanReview,evaluateControlledHumanReviewState,
 buildGovernedReviewedDecisionExport,verifyGovernedReviewedDecisionExport
}=require('../../src/decision-intelligence/governed-human-review');
const {computeSavedDealStateHash}=require('../../src/app/governed-decision-operational');
const {validateGovernedDealDecisionSnapshot}=require('../../src/decision-intelligence/governed-deal-decision');
const now=new Date('2026-09-30T10:00:00.000Z');
const saved=buildC6SavedDeal({now});
const original=JSON.parse(JSON.stringify(saved));
assert.equal(validateGovernedDealDecisionSnapshot(saved.governedDealDecision),true);
const ready=evaluateControlledHumanReviewState({savedDealRecord:saved,asOf:now});
assert.equal(ready.status,'READY_FOR_HUMAN_REVIEW');
assert.equal(ready.canRecordReview,true);
assert.equal(ready.canExportReviewedOutput,false);
assert.equal(ready.transactionAuthorized,false);
const review=buildGovernedHumanReview({
 savedDealRecord:saved,reviewerId:'SYNTHETIC-REVIEWER',
 recommendation:C6_REVIEW_RECOMMENDATION.REQUEST_MODIFICATION,
 rationale:'Request documented remediation, not approval or property valuation certification.',
 reviewedAt:now
});
assert.equal(validateGovernedHumanReview(review,{savedDealRecord:saved}),true);
assert.equal(review.approvalAuthorized,false);
assert.equal(review.transactionAuthorized,false);
assert.equal(review.certifiedValuationEstablished,false);
const recorded=withGovernedHumanReview(saved,review);
assert.equal(computeSavedDealStateHash(recorded),computeSavedDealStateHash(saved));
assert.deepEqual(saved,original); // source data not mutated by review
const state=evaluateControlledHumanReviewState({savedDealRecord:recorded,asOf:new Date('2026-09-30T10:05:00Z')});
assert.equal(state.status,'REVIEW_RECORDED');
assert.equal(state.canRecordReview,false);
assert.equal(state.canExportReviewedOutput,true);
const envelope=buildGovernedReviewedDecisionExport({
 savedDealRecord:recorded,reportId:'REPORT-RE-STANDALONE-C6',
 generatedAt:'2026-09-30T10:05:00.000Z'
});
assert.equal(envelope.approvalAuthorized,false);
assert.equal(envelope.transactionAuthorized,false);
assert.equal(envelope.publicAiAuthorized,false);
assert.equal(envelope.commercialGoLive,'HOLD');
assert.equal(verifyGovernedReviewedDecisionExport(envelope),true);
const clone=JSON.parse(JSON.stringify(envelope));
clone.review.recommendation='APPROVE_TRANSACTION';
assert.equal(verifyGovernedReviewedDecisionExport(clone),false);
assert.throws(()=>buildGovernedHumanReview({
 savedDealRecord:recorded,reviewerId:'ANOTHER-REVIEWER',
 recommendation:C6_REVIEW_RECOMMENDATION.CONTINUE_DUE_DILIGENCE,
 rationale:'Second review should fail closed',
 reviewedAt:new Date('2026-09-30T10:06:00Z')
}),e=>e&&e.code==='C6_REVIEW_ALREADY_RECORDED');
assert.throws(()=>buildGovernedHumanReview({
 savedDealRecord:saved,reviewerId:'SYNTHETIC-REVIEWER',
 recommendation:'APPROVE_TRANSACTION',
 rationale:'Never grant purchase or certified market valuation authority.',
 reviewedAt:now
}),e=>e&&e.code==='C6_RECOMMENDATION_INVALID');
const tampered=JSON.parse(JSON.stringify(recorded));
tampered.inputs.buildingPrice=15000000;
assert.equal(evaluateControlledHumanReviewState({
 savedDealRecord:tampered,asOf:new Date('2026-09-30T10:05:00Z')
}).canExportReviewedOutput,false);
console.log('STARTAK_RE_C4_C5_C6_STANDALONE_REVIEW=PASS');
