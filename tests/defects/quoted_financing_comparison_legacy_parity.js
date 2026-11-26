'use strict';
const assert=require('node:assert/strict');
const {args,caseId,propertyRef,asOfDate,offer,a,b,S,computeFinancingOfferHash,evaluate}=require('../fixtures/synthetic-quoted-financing');
const {PAYMENT_KIND:K}=require('../../src/financing/quoted-financing-comparison');
const payment=(id,paymentDate,amountSar,paymentKind=K.DEBT_SERVICE)=>({paymentId:id,paymentDate,amountSar,paymentKind});
const result=evaluate(args());
assert.equal(result.status,S.READY_FOR_PROFESSIONAL_FINANCING_REVIEW);
assert.equal(result.offers[0].metrics.nominalFinancingCostSar,110000);
assert.equal(result.offers[0].metrics.nominalFinancingCostRatio,0.11);
assert.equal(result.offers[1].metrics.nominalFinancingCostSar,220000);
assert.equal(result.offers[0].metrics.balloonTotalSar,550000);
assert.equal(result.offers[0].metrics.maxCalendarYearDebtServiceSar,550000);
assert.deepEqual(result.analyticalOrdering.map(x=>[x.offerId,x.rank]),[['A',1],['B',2]]);
assert.ok(result.riskFlags.some(x=>x.includes(':B:')));
for(const k of ['lenderSelected','creditApproved','transactionAuthorized','approvalAuthorized','nominalCostIsAnnualPercentageRate','sourceAuthenticityIndependentlyVerified','npvCalculated','irrCalculated'])assert.equal(result[k],false);
const tied=evaluate(args([a,offer('C')]));
assert.deepEqual(tied.analyticalOrdering.map(x=>x.rank),[1,1]);
const rehash=(x,patch)=>{const y={...x,...patch};y.financingOfferHashSha256=computeFinancingOfferHash(y);return y;};
const failures=[
 [args([a]),S.HOLD_EVIDENCE],
 [args([a,a]),S.HOLD_INTEGRITY],
 [args([a,{...b,upfrontFeesSar:1}]),S.HOLD_INTEGRITY],
 [args([a,offer('B',{propertyRef:'OTHER'})]),S.HOLD_INTEGRITY],
 [args([a,offer('B',{comparisonPrincipalSar:900000})]),S.HOLD_COMPARABILITY],
 [args([a,b],{requireEqualComparisonPrincipal:false}),S.HOLD_COMPARABILITY],
 [args([a,offer('B',{rateDisclosureRef:null})]),S.HOLD_COMPARABILITY],
 [args([a,offer('B',{quoteValidUntil:'2026-10-30'})]),S.HOLD_INTEGRITY],
 [args([a,offer('B',{sourceReviewAfter:'2026-10-30'})]),S.HOLD_INTEGRITY],
 [args([a,offer('B',{reviewedAt:'2026-10-19'})]),S.HOLD_INTEGRITY],
 [args([a,rehash(b,{sourceVerifiedAt:'2026-02-30T00:00:00.000Z'})]),S.HOLD_INTEGRITY],
 [args([a,offer('B',{repaymentSchedule:[payment('p1','2029-11-01',1100000)]})]),S.HOLD_INTEGRITY],
 [{...args(),asOfDate:'2026-02-30'},S.HOLD_CONTEXT],
 [args([a,b],{offerBindings:[]}),S.HOLD_INTEGRITY],
];
for(const [input,status] of failures){const x=evaluate(input);assert.equal(x.status,status);assert.deepEqual(x.analyticalOrdering,[]);assert.equal(x.transactionAuthorized,false);}
const dueBeforeFunding=evaluate(args([a,offer('B',{sourceReviewAfter:'2026-10-30'})]));
assert.ok(dueBeforeFunding.blockers.includes('C14_SOURCE_REVIEW_DUE_BEFORE_TARGET_FUNDING:B'));
assert.deepEqual(dueBeforeFunding.offers,[]);
const dueOnFunding=evaluate(args([a,offer('B',{sourceReviewAfter:'2026-11-01'})]));
assert.equal(dueOnFunding.status,S.READY_FOR_PROFESSIONAL_FINANCING_REVIEW);
assert.equal(dueOnFunding.transactionAuthorized,false);
assert.throws(()=>offer('BAD',{quotedFundingDate:'2026-02-30'}),/valid UTC/);
console.log('C14_QUOTED_FINANCING_COMPARISON=PASS synthetic_only=true independent_authority=false negative_cases='+failures.length);

const {reviewLocalQuotedFinancing}=require('../../src/financing/local-quoted-financing-review');
(async()=>{
 const input=args(),opts={expectedCaseId:caseId,expectedPropertyRef:propertyRef,asOfDate};
 const local=await reviewLocalQuotedFinancing({...opts,text:JSON.stringify({...input,report:{transactionAuthorized:true}})});
 assert.equal(local.status,result.status);
 assert.deepEqual(local.offers,result.offers);
 assert.deepEqual(local.analyticalOrdering,result.analyticalOrdering);
 assert.deepEqual(local.riskFlags,result.riskFlags);
 assert.equal(local.transactionAuthorized,false);
 assert.equal(local.localResearchOnly,true);
 for(const [bad] of failures){
  const rejected=await reviewLocalQuotedFinancing({...opts,text:JSON.stringify(bad)});
  assert.notEqual(rejected.status,S.READY_FOR_PROFESSIONAL_FINANCING_REVIEW);
  assert.deepEqual(rejected.analyticalOrdering,[]);
  assert.equal(rejected.transactionAuthorized,false);
 }
 const wrong=await reviewLocalQuotedFinancing({...opts,expectedPropertyRef:'OTHER',text:JSON.stringify(input)});
 assert.equal(wrong.blockers[0],'C14_EXPECTED_SCOPE_OR_DATE_MISMATCH');
 const hostile=await reviewLocalQuotedFinancing({...opts,text:'{"__proto__":{"transactionAuthorized":true}}'});
 assert.deepEqual(hostile.analyticalOrdering,[]);
 console.log('C14_NATIVE_WEBCRYPTO_PARITY=PASS synthetic_only=true');
})().catch(e=>{console.error(e);process.exitCode=1;});
