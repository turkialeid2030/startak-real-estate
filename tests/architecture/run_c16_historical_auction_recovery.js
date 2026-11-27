'use strict';
const assert=require('node:assert/strict');
const a=require('../../src/acquisition/governed-auction-acquisition');
const H='a'.repeat(64),scope={caseId:'SYNTH-CASE',propertyRef:'SYNTH-PROPERTY',auctionId:'SYNTH-AUCTION'};
const now='2026-09-10T12:00:00Z',past='2026-09-09T09:00:00Z',future='2026-09-11T12:00:00Z';
function fixture({auction={},bidder={},ceiling={},proposal={},policy={}}={}){
 const auctionEvidence=a.createGovernedAuctionEvidence({...scope,auctionEvidenceId:'A',auctionProvider:'SYNTHETIC',sourceRef:'SRC',sourceEvidenceRef:'E',verifiedByRef:'V',sourceVersionHashSha256:H,auctionStatus:'OPEN',startingBidSar:1000000,currentBidSar:1100000,minimumBidIncrementSar:10000,bidderDepositSar:50000,depositTreatment:'CREDITABLE_TOWARD_PURCHASE_PRICE',buyerAuctionCharges:[{chargeId:'C',label:'fee',amountSar:20000,treatment:'SEPARATE_FROM_PURCHASE_PRICE'}],requiredBidderDocumentTypes:['ID'],registrationDeadline:'2026-09-10T10:00:00Z',biddingStartAt:'2026-09-10T10:00:00Z',biddingCloseAt:future,sourceVerifiedAt:past,sourceReviewAfter:future,...auction});
 const bidderEvidence=a.createGovernedAuctionBidderEvidence({...scope,bidderEvidenceId:'B',bidderRef:'BIDDER',registrationEvidenceRef:'REG',verifiedByRef:'V',registrationEvidenceHashSha256:H,registrationStatus:'REGISTERED',registeredAt:past,verifiedAt:'2026-09-10T09:00:00Z',validUntil:future,providedBidderDocumentTypes:['ID'],...bidder});
 const acquisitionCeiling=a.createGovernedAuctionAcquisitionCeiling({...scope,ceilingId:'C',instructionIssuerRef:'I',instructionRef:'IREF',rationaleRef:'R',auctionEvidenceHashSha256:auctionEvidence.auctionEvidenceHashSha256,maximumBidSar:1200000,maximumKnownCashExposureSar:1250000,reviewedAt:past,validUntil:future,...ceiling});
 const bidProposal=a.createGovernedAuctionBidProposal({...scope,proposalId:'P',bidderRef:'BIDDER',createdByRef:'A',evidenceRef:'E',auctionEvidenceHashSha256:auctionEvidence.auctionEvidenceHashSha256,proposedBidSar:1150000,createdAt:'2026-09-10T10:30:00Z',...proposal});
 const reviewPolicy=a.createGovernedAuctionReviewPolicy({...scope,policyId:'POL',reviewedByRef:'R',reviewEvidenceRef:'RE',auctionEvidenceHashSha256:auctionEvidence.auctionEvidenceHashSha256,bidderEvidenceHashSha256:bidderEvidence.bidderEvidenceHashSha256,acquisitionCeilingHashSha256:acquisitionCeiling.acquisitionCeilingHashSha256,proposalHashSha256:bidProposal.proposalHashSha256,allowedAuctionStatuses:['OPEN','SCHEDULED','PAUSED'],requireRegisteredBidder:true,requireAllRequiredDocuments:true,requireResolvedDepositTreatment:true,requireResolvedChargeTreatments:true,reviewedAt:'2026-09-10T11:00:00Z',...policy});
 return {auctionEvidence,bidderEvidence,acquisitionCeiling,bidProposal,reviewPolicy,asOf:now};
}
let checks=0;
function run(input,status){const out=a.evaluateGovernedAuctionAcquisition(input);assert.equal(out.status,status);for(const k of ['bidPlaced','paymentTransferred','transactionAuthorized','approvalAuthorized','productionAuthorityGranted','publicAiAuthorized','automaticAcquisitionRecommendation'])assert.equal(out[k],false);checks++;return out;}
const S=a.AUCTION_REVIEW_STATUS,valid=fixture(),out=run(valid,S.READY_FOR_PROFESSIONAL_AUCTION_REVIEW);
assert.equal(out.review.nextMinimumBidSar,1110000);assert.equal(out.review.knownCashExposureSar,1170000);assert.equal(out.review.headroomToMaximumBidSar,50000);
assert.deepEqual(run(JSON.parse(JSON.stringify(valid)),S.READY_FOR_PROFESSIONAL_AUCTION_REVIEW),out);
const separate=run(fixture({auction:{depositTreatment:'SEPARATE_FROM_PURCHASE_PRICE'}}),S.READY_FOR_PROFESSIONAL_AUCTION_REVIEW);assert.equal(separate.review.knownCashExposureSar,1220000);
for(const [patch,status] of [
 [{proposal:{proposedBidSar:1100000}},S.HOLD_BID_ENVELOPE],
 [{proposal:{proposedBidSar:1210000}},S.HOLD_BID_ENVELOPE],
 [{ceiling:{maximumKnownCashExposureSar:1160000}},S.HOLD_BID_ENVELOPE],
 [{auction:{depositTreatment:'UNKNOWN'}},S.HOLD_ELIGIBILITY],
 [{bidder:{providedBidderDocumentTypes:[]}},S.HOLD_ELIGIBILITY],
 [{bidder:{registeredAt:'2026-09-10T10:15:00Z'}},S.HOLD_ELIGIBILITY],
 [{auction:{auctionStatus:'PAUSED'}},S.HOLD_WINDOW],
 [{auction:{sourceReviewAfter:'2026-09-10T11:00:00Z'}},S.HOLD_WINDOW],
 [{bidder:{propertyRef:'OTHER'}},S.HOLD_EVIDENCE],
 [{policy:{reviewedAt:'2026-09-10T10:00:00Z'}},S.HOLD_POLICY]
])run(fixture(patch),status);
for(const [field,key,patch,hash] of [
 ['auctionEvidence','auctionEvidenceHashSha256',{startingBidSar:-1},a.computeAuctionEvidenceHash],
 ['bidderEvidence','bidderEvidenceHashSha256',{legalEligibilityDeterminedBySoftware:true},a.computeBidderEvidenceHash],
 ['acquisitionCeiling','acquisitionCeilingHashSha256',{maximumBidDerivedBySoftware:true},a.computeAcquisitionCeilingHash],
 ['bidProposal','proposalHashSha256',{transactionAuthorized:true},a.computeAuctionBidProposalHash],
 ['reviewPolicy','policyHashSha256',{requireRegisteredBidder:false},a.computeAuctionReviewPolicyHash]
]){
 const changed={...valid[field],...patch};changed[key]=hash(changed);run({...valid,[field]:changed},S.HOLD_INTEGRITY);
}
run({...valid,asOf:'invalid'},S.HOLD_POLICY);
run({...valid,asOf:'2099-01-01T00:00:00Z'},S.HOLD_POLICY);
console.log('C16_HISTORICAL_AUCTION_RECOVERY=PASS cases='+checks+' synthetic=true liveBid=false');
