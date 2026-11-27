'use strict';
const assert=require('node:assert/strict'),c=require('../../src/strategy/governed-listing-transparency-amenity-utility');
const scope={caseId:'SYNTH-C',propertyRef:'SYNTH-P',marketScopeRef:'SYNTH-M'},asOf='2026-09-10',validUntil='2026-10-01';
const common={...scope,sourceProviderId:'SYNTH-PROVIDER',sourceTier:'REVIEWED_SYNTHETIC',sourceRecordHashSha256:'a'.repeat(64),sourceReference:'SYNTHETIC',provenanceVerified:true,observedAt:'2026-09-02',reviewedAt:'2026-09-03',validUntil,reviewedByRef:'R',reviewEvidenceRef:'REV'};
function listing(id,patch={}){return c.createGovernedListingEvidence({...common,listingEvidenceId:id,listingRef:'REF-'+id,deduplicationKey:'D-'+id,sourceRecordId:'SRC-'+id,listingStatus:'ACTIVE',askingPriceSar:1000000,areaSqm:1000,publishedAt:'2026-09-01',...patch});}
function amenity(id,patch={}){return c.createGovernedAmenityEvidence({...common,amenityEvidenceId:id,amenityRef:'AM-'+id,sourceRecordId:'SRC-'+id,amenityClass:'EDUCATION',amenityState:'EXISTING_VERIFIED',metricType:'DISTANCE_METERS_EXTERNAL',metricValue:500,knownAt:'2026-09-02',...patch});}
function utility(id,a,patch={}){return c.createProfessionalAmenityUtilityAssessment({...scope,assessmentId:id,amenityEvidenceHashSha256:a.amenityEvidenceHashSha256,utilityScore:80,importanceWeight:1,rationaleRef:'R',preparedByRef:'V',preparedAt:'2026-09-04',reviewedByRef:'R',reviewedAt:'2026-09-05',reviewEvidenceRef:'REV',validUntil,...patch});}
const l=listing('L'),a=amenity('A'),u=utility('U',a);
function fixture(listings=[l],amenities=[a],utilityAssessments=[u],policyPatch={}){const reviewPolicy=c.createGovernedListingAmenityReviewPolicy({...scope,policyId:'P',allowedListingSourceTiers:['REVIEWED_SYNTHETIC'],allowedAmenitySourceTiers:['REVIEWED_SYNTHETIC'],allowedListingStatuses:['ACTIVE','CLOSED'],allowedAmenityClasses:['EDUCATION'],requiredAmenityClasses:['EDUCATION'],listingHashesSha256:listings.map(x=>x.listingEvidenceHashSha256),amenityHashesSha256:amenities.map(x=>x.amenityEvidenceHashSha256),utilityAssessmentHashesSha256:utilityAssessments.map(x=>x.utilityAssessmentHashSha256),allowPlannedProposedReviewContext:true,reviewedByRef:'R',reviewEvidenceRef:'REV',reviewedAt:'2026-09-06',validUntil,...policyPatch});return {...scope,asOf,listings,amenities,utilityAssessments,reviewPolicy};}
const ready='READY_FOR_PROFESSIONAL_LISTING_AMENITY_REVIEW';
let checks=0;function run(input,status=ready){const o=c.evaluateGovernedListingAmenityReview(input);assert.equal(o.status,status,JSON.stringify(o.blockers));for(const k of ['sourceAuthenticityIndependentlyVerified','sourceRightsIndependentlyAuthenticated','transactionAuthorized','approvalAuthorized','automaticValuationUse','askingToClosedTransactionPromotionAllowed','geospatialInferenceAllowed','automaticInvestmentRanking'])assert.equal(o[k],false);if(status!==ready)assert.equal(o.review,null);checks++;return o;}
const ok=run(fixture());assert.equal(ok.review.listingTransparency.meanAskingPricePerSqmSar,1000);assert.equal(ok.review.listingTransparency.closedTransactionEvidenceCount,0);assert.equal(ok.review.amenityUtility.weightedProfessionalUtilityScore,80);
run(JSON.parse(JSON.stringify(fixture())));
const closed=run(fixture([listing('L',{listingStatus:'CLOSED'})]));assert.equal(closed.review.listingTransparency.meanAskingPricePerSqmSar,null);assert.equal(closed.review.listingTransparency.closedTransactionEvidenceCount,0);
run({...fixture(),caseId:'OTHER'},'HOLD_CONTEXT');run({...fixture(),asOf:'2099-01-01'},'HOLD_WINDOW');run({...fixture(),asOf:'2026-02-30'},'HOLD_WINDOW');
run(fixture([l,listing('L2',{sourceRecordId:l.sourceRecordId})]),'HOLD_INTEGRITY');
run(fixture([l],[a,amenity('A2',{amenityRef:a.amenityRef})]),'HOLD_INTEGRITY');
run(fixture([l],[a],[utility('U',a,{importanceWeight:0.5})]),'HOLD_CALCULATION');
run(fixture([l],[a],[utility('U',a,{preparedAt:'2026-09-02'})]),'HOLD_WINDOW');
run(fixture([l],[a],[u],{reviewedAt:'2026-09-04'}),'HOLD_WINDOW');
const proposed=amenity('P',{amenityState:'PLANNED_NOT_DELIVERED'});
run(fixture([l],[proposed],[]),'HOLD_COVERAGE');
run(fixture([l],[a,proposed],[u,utility('P',proposed,{importanceWeight:0.5})]),'HOLD_CALCULATION');
const forged={...l,askingPriceSar:-100};forged.listingEvidenceHashSha256=c.computeListingHash(forged);
run(fixture([forged]),'HOLD_INTEGRITY');
run({...fixture(),listings:[]},'HOLD_EVIDENCE');
run({...fixture(),reviewPolicy:{...fixture().reviewPolicy,transactionAuthorized:true}},'HOLD_INTEGRITY');
let reads=0;const getter=Object.defineProperty({...fixture()},'listings',{enumerable:true,get(){reads++;return [l];}});run(getter,'HOLD_INTEGRITY');assert.equal(reads,0);
assert.throws(()=>amenity('X',{metricType:'COUNT_WITHIN_EXTERNAL_BOUNDARY',metricValue:1.5}),/METRIC_VALUE_INVALID/);
assert.throws(()=>listing('X',{publishedAt:'2026-02-30'}),/valid date/);
assert.throws(()=>listing('X',{transactionAuthorized:true}),/CONSTRUCTOR_INPUT/);
console.log('C21_LISTING_AMENITY_RECOVERY=PASS cases='+checks+' synthetic=true sourceAuthority=false');
