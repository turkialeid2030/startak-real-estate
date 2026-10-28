'use strict';
const assert=require('node:assert/strict');
const {parseListingResearchCsv}=require('../../src/market/saudi-listing-source-research');
const {importEarthResearchCsv}=require('../../src/market/earth-national-research');
const {importNationalSourcesCsv}=require('../../src/market/saudi-national-intelligence-sources');
const {toPublicSample}=require('../../src/market/suhail-national-neighborhood-research');
const {buildUnifiedResearch,researchClaimsGate,researchReportBundle,fromResearchFeeds}=require('../../src/market/research-evidence-fusion');
let count=0;const ok=(label,run)=>{run();count++;console.log('PASS '+label);};
const listings=parseListingResearchCsv([
 'source,city,district,kind,priceSar,areaSqm,listingUrl,listingId,assetType,listingDate',
 'عقار,الرياض,الملقا,SALE_OFFER,1500000,300,https://sa.aqar.fm/p/1,AQ-1,RESIDENTIAL_VILLA,2026-10-25',
 'حراج,الرياض,الملقا,SALE_OFFER,1500000,300,https://haraj.com.sa/p/2,H-2,RESIDENTIAL_VILLA,2026-10-25',
 'عقار,جدة,الصفا,SALE_OFFER,2000000,300,https://sa.aqar.fm/p/3,AQ-3,RESIDENTIAL_VILLA,2026-10-25',
 ].join('\n'),{observedOn:'2026-10-28'}).records;
const earth=importEarthResearchCsv(
 'city,district,recordId,eventDate,amountSar,areaSqm,planNumber,parcelNumber\n' +
 'الرياض,الملقا,TX-1,2026-10-22,2000000,400,P-1,L-3',
 {featureId:'TRANSACTION_TABLE',observedOn:'2026-10-28'}).records;
const national=importNationalSourcesCsv(
 'source,city,district,kind,recordId,eventDate,periodStart,periodEnd,metricName,metricValue,unit,sourceUrl,assetType\n'+
 'MOJ_SREM,الرياض,الملقا,OFFICIAL_REPORTED_SALE,TX-1,2026-10-22,,,sale_price_sar,2000000,SAR,https://srem.moj.gov.sa/,LAND',
 {observedOn:'2026-10-28'}).records;
const feeds={suhail:toPublicSample(),listings,earth,national};
const subject={city:'الرياض',district:'الملقا',assetType:'LAND'};
const snap=buildUnifiedResearch({subject,feeds});
ok('research catalog is unified but still not certified',()=>{
 assert.equal(snap.totalInputRows,feeds.suhail.length+listings.length+earth.length+national.length);
 assert.equal(snap.validResearchRows,snap.totalInputRows);
 assert.equal(snap.verifiedExecutedSales,0);
 assert.equal(snap.certifiedMarketValueSar,null);
 assert.equal(snap.investorMaximumPurchaseSar,null);
 assert.equal(snap.status,'HOLD_UNVERIFIED_PERSONAL_RESEARCH');
});
ok('scope filters multi-city datasets and never adds another city to subject',()=>{
 assert.equal(snap.subjectAreaRows,4);
 assert.ok(snap.context.every(x=>x.city==='الرياض'&&x.district==='الملقا'));
});
ok('a duplicated marketed offer is flagged but not silently collapsed',()=>{
 assert.equal(snap.possibleCrossSourceDuplicates.filter(x=>
  x.reason==='POTENTIAL_CROSS_PORTAL_SAME_OFFER').length,1);
});
ok('Earth and MOJ reported same transaction are marked candidate only',()=>{
 assert.equal(snap.possibleCrossSourceDuplicates.filter(x=>
  x.reason==='POTENTIAL_REPEATED_REPORTED_SALE').length,1);
 assert.equal(snap.verifiedExecutedSales,0);
});
ok('authority of government website does not authenticate a user-imported sale',()=>{
 assert.ok(snap.context.every(x=>x.sourceAuthenticated===false&&
  x.professionalComparableSelected===false&&
  x.eligibleForFinancialCalculation===false));
});
ok('future rows relative to study date do not contaminate earlier studies',()=>{
 const earlier=buildUnifiedResearch({subject,feeds,asOf:'2026-10-20'});
 assert.equal(earlier.subjectAreaRows,0);
 assert.ok(earlier.risks.includes('POST_ASOF_RESEARCH_EXCLUDED'));
});
ok('missing district does not make same city an authenticated property match',()=>{
 const z=buildUnifiedResearch({subject:{city:'الرياض'},feeds});
 assert.equal(z.subjectAreaRows,0);
 assert.ok(z.risks.includes('SUBJECT_CITY_AND_DISTRICT_REQUIRED'));
});
ok('untrusted record that asserts certification is rejected, not promoted',()=>{
 const f={listings:[{...listings[0],marketValuationEligible:true}]};
 const out=buildUnifiedResearch({subject,feeds:f});
 assert.equal(out.validResearchRows,0);
 assert.equal(out.rejectedRows.length,1);
});
ok('source lookalike URLs are rejected after import object mutation',()=>{
 const fake={listings:[{...listings[0],listingUrl:'https://sa.aqar.fm.evil.net/p/1'}]};
 assert.equal(fromResearchFeeds(fake).records.length,0);
});
ok('same source transaction with different amount is marked conflict',()=>{
 const cloned={...earth[0],amountSar:2700000};
 const out=buildUnifiedResearch({subject,feeds:{earth:[...earth,cloned]}});
 assert.equal(out.contradictoryObservations.length,1);
 assert.equal(out.verifiedExecutedSales,0);
});
ok('parcels with only same city/district must not be declared the same property',()=>{
 assert.equal(snap.matchedParcelCandidates,0);
 assert.ok(snap.risks.includes('SUBJECT_PARCEL_IDENTITY_NOT_ESTABLISHED'));
});
ok('source-specific exact parcel is still merely candidate without independent verification',()=>{
 const o=buildUnifiedResearch({subject:{...subject,planNumber:'P-1',parcelNumber:'L-3'},feeds:{earth}});
 assert.equal(o.matchedParcelCandidates,1);
 assert.equal(o.authenticatedPropertyRights,false);
 assert.equal(o.certifiedMarketValueSar,null);
});
ok('unstructured AI claims without supported evidence are rejected',()=>{
 const out=researchClaimsGate({snapshot:snap,claims:[{kind:'OBSERVATION',text:'Average SAR 5000',
  evidenceIds:['FAKE-CITATION']} ]});
 assert.equal(out.status,'REJECTED');
 assert.ok(out.reasons.some(x=>x.startsWith('CLAIM_UNSUPPORTED_CITATION')));
});
ok('AI cannot authorize buy or certified valuation text',()=>{
 const out=researchClaimsGate({snapshot:snap,claims:[
  {kind:'OBSERVATION',text:'BUY property, valuation certified',evidenceIds:[snap.context[0].evidenceId]}]});
 assert.equal(out.status,'REJECTED');
});
ok('evidence-grounded limited research narrative passes with no numeric authority',()=>{
 const out=researchClaimsGate({snapshot:snap,claims:[
  {kind:'OBSERVATION',text:'There is a published locality research signal.',
    evidenceIds:[snap.context[0].evidenceId]},
  {kind:'LIMITATION',text:'Not a certified valuation.',evidenceIds:[]}]});
 assert.equal(out.status,'RESEARCH_TEXT_ONLY');
 assert.equal(out.numericOutputsAllowed,false);
});
ok('export never implies ownership, valuation, or investment approval',()=>{
 const out=researchReportBundle(snap,{marketReadinessStatus:'HOLD'});
 assert.equal(out.investmentDecision,'HOLD_REQUIRES_INDEPENDENT_MARKET_AND_FINANCIAL_EVIDENCE');
 assert.equal(out.valuationSar,null);
 assert.equal(out.publishableProfessionalValuation,false);
 assert.equal(out.evidenceIndex.length,snap.context.length);
 assert.ok(out.riskCodes.length>0);
});
console.log('UNIFIED_RESEARCH_EVIDENCE_FUSION_TESTS='+count+'/'+count);
