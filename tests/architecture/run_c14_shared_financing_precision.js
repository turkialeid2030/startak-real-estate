'use strict';
const assert=require('node:assert/strict');
const c=require('../../src/financing/quoted-financing-comparison');
const S=c.FINANCING_STATUS,M=c.COMPARISON_METRIC;
const H='a'.repeat(64),scope={caseId:'SYNTH-CASE',propertyRef:'SYNTH-PROPERTY'},asOfDate='2026-09-10T12:00:00Z',targetFundingDate='2026-09-15T00:00:00Z',past='2026-09-09T09:00:00Z',future='2026-09-20T00:00:00Z',maturityDate='2027-09-15T00:00:00Z';
function offer(id='A',patch={}){return c.createGovernedFinancingOffer({...scope,offerId:id,providerRef:'SYNTH-'+id,structureLabel:'QUOTED',sourceAuthority:'SYNTH',sourceRef:'S',sourceEvidenceRef:'D-'+id,professionalReviewerRef:'R',reviewEvidenceRef:'RE',sourceVersionHashSha256:H,reviewEvidenceHashSha256:H,sourceVerifiedAt:past,sourceReviewAfter:future,reviewedAt:'2026-09-10T09:00:00Z',validUntil:future,quotedFundingDate:targetFundingDate,quoteValidUntil:future,maturityDate,comparisonPrincipalSar:0.2,upfrontFeesSar:0.1,upfrontFeesOutsideRepaymentSchedule:true,repaymentScheduleComplete:true,repaymentSchedule:[{paymentId:'P1',paymentDate:'2026-12-01T00:00:00Z',paymentKind:c.PAYMENT_KIND.DEBT_SERVICE,amountSar:0.1},{paymentId:'P2',paymentDate:'2026-12-02T00:00:00Z',paymentKind:c.PAYMENT_KIND.BALLOON,amountSar:0.2}],...patch});}
function fixture(offers=[offer(),offer('B')],patch={}){const p={version:c.POLICY_VERSION,policyId:'POL',...scope,asOfDate,targetFundingDate,offerBindings:c.financingOfferBindings(offers),allowedStructureLabels:['QUOTED'],requireEqualComparisonPrincipal:true,rankingCriteria:[{metric:M.NOMINAL_FINANCING_COST_SAR,direction:'MIN'}],reviewThresholds:[{metric:M.NOMINAL_FINANCING_COST_SAR,operator:'MAX',value:0.2}],reviewedByRef:'R',reviewEvidenceRef:'PE',reviewedAt:'2026-09-10T11:00:00Z',...patch};p.policyHashSha256=c.computeFinancingComparisonPolicyHash(p);return {...scope,asOfDate,targetFundingDate,comparisonPolicyId:'POL',financingOffers:offers,governedComparisonPolicies:{POL:p}};}
let checks=0;function run(input,status){const o=c.evaluateGovernedFinancingOptions(input);assert.equal(o.status,status,JSON.stringify(o.blockers));for(const k of ['creditApproved','financingCommitted','lenderSelected','transactionAuthorized','productionAuthorityGranted','automaticUnderwritingAdoption','nominalCostIsAnnualPercentageRate'])assert.equal(o[k],false);checks++;return o;}
const valid=fixture(),ready=S.READY_FOR_PROFESSIONAL_FINANCING_REVIEW,ok=run(valid,ready);
assert.equal(ok.offers[0].metrics.totalScheduledPaymentsSar,0.3);assert.equal(ok.offers[0].metrics.nominalFinancingCostSar,0.2);assert.equal(ok.offers[0].metrics.maxCalendarYearDebtServiceSar,0.3);assert.equal(ok.offers[0].metrics.balloonTotalSar,0.2);assert.equal(ok.riskFlags.length,0);assert.deepEqual(ok.analyticalOrdering.map(x=>x.rank),[1,1]);
assert.deepEqual(run(JSON.parse(JSON.stringify(valid)),ready),ok);
run(fixture([offer(),offer('B',{propertyRef:'OTHER'})]),S.HOLD_INTEGRITY);
run(fixture([offer(),offer('B',{comparisonPrincipalSar:0.3})]),S.HOLD_COMPARABILITY);
run(fixture([offer(),offer('B',{sourceReviewAfter:'2026-09-12T00:00:00Z'})]),S.HOLD_INTEGRITY);
const high={comparisonPrincipalSar:50000000000000,upfrontFeesSar:0,repaymentSchedule:[{paymentId:'P1',paymentDate:maturityDate,paymentKind:c.PAYMENT_KIND.DEBT_SERVICE,amountSar:50000000000000},{paymentId:'P2',paymentDate:maturityDate,paymentKind:c.PAYMENT_KIND.BALLOON,amountSar:50000000000000}]};
run(fixture([offer('A',high),offer('B',high)]),S.HOLD_INTEGRITY);
const changed={...offer(),silentExtraField:true};changed.financingOfferHashSha256=c.computeFinancingOfferHash(changed);run(fixture([changed,offer('B')]),S.HOLD_INTEGRITY);
let reads=0;run(Object.defineProperty({...valid},'financingOffers',{enumerable:true,get(){reads++;return valid.financingOffers;}}),S.HOLD_INTEGRITY);assert.equal(reads,0);
run(null,S.HOLD_INTEGRITY);
assert.throws(()=>offer('A',{upfrontFeesSar:0.001}),/C14_UPFRONT_FEES_INVALID/);
assert.throws(()=>offer('A',{comparisonPrincipalSar:0.001}),/C14_COMPARISON_PRINCIPAL_INVALID/);
assert.throws(()=>offer('A',{repaymentSchedule:[{paymentId:'P',paymentDate:maturityDate,paymentKind:c.PAYMENT_KIND.BALLOON,amountSar:0.001}]}),/C14_PAYMENT_AMOUNT_INVALID/);
assert.throws(()=>c.createGovernedFinancingOffer(Object.defineProperty({},'offerId',{enumerable:true,get(){reads++;return 'A';}})),/C14_INPUT_JSON_INVALID/);assert.equal(reads,0);
console.log('C14_SHARED_FINANCING_PRECISION=PASS cases='+checks+' synthetic=true lenderAuthority=false');
