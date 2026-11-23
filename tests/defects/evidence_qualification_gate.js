'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {
 qualifiedResearchIntake,portableReviewDossier,VERSION,MAX_ROWS,
 MAX_CROSS_PROVIDER_PAIR_SAMPLES,
}=require('../../src/market/evidence-qualification-gate');
const {captureReference}=require('../../src/market/no-api-source-bridge');
const day='2026-11-22';
const sale={
 sourceId:'REGA_REI',evidenceClass:'OFFICIAL_REPORTED_SALE',
 sourceUrl:'https://rei.rega.gov.sa/ar/advanced-search/deals',
 personalResearch:true,city:'الرياض',district:'الملز',assetType:'LAND',
 observedOn:'2026-11-20',eventDate:'2026-11-19',recordId:'T-123',
 metricName:'sale_price_sar',metricValue:2400000,metricUnit:'SAR',
 sourceRecordAuthenticated:false,executedTransactionRecord:false,
 independentMarketPriceVerified:false,marketValuationEligible:false,
 professionalReportAuthorized:false,
};
const moj={...sale,sourceId:'MOJ_SREM',sourceUrl:'https://srem.moj.gov.sa/'};
const index={
 ...sale,recordId:null,eventDate:null,evidenceClass:'OFFICIAL_AGGREGATE',
 metricName:'avg_sqm_sar',metricValue:3500,metricUnit:'SAR_PER_SQM',
 periodStart:'2026-09-01',periodEnd:'2026-10-01',
};
const avm={
 ...sale,sourceId:'GREM_AI',sourceUrl:'https://ai.grem.capital/ar',
 evidenceClass:'EXTERNAL_AVM_ESTIMATE',recordId:'MODEL-21',
 metricName:'estimated_value_sar',metricValue:3900000,
 eventDate:null,
};
const manual=captureReference({
 sourceId:'UMAPS',city:'الرياض',district:'الملز',
 observedOn:'2026-11-20',sourceUrl:'https://umaps.momah.gov.sa/',
},{asOf:new Date('2026-11-22T00:00:00.000Z')});
const evaluate=(records,references=[manual],subject={city:'الرياض',district:'الملز',assetType:'LAND'})=>
 qualifiedResearchIntake({records,references,subject,asOf:day});

const result=evaluate([sale,moj,index,avm]);
assert.equal(result.version,VERSION);
assert.equal(result.decision,'HOLD_EXTERNAL_VERIFICATION_REQUIRED');
assert.equal(result.marketValuationEligible,false);
assert.equal(result.certifiedMarketValueSar,null);
assert.equal(result.certifiedMarketRentSar,null);
assert.equal(result.professionalReportAuthorized,false);
assert.equal(result.productionDataConnectorEnabled,false);
assert.equal(result.totals.importedRows,4);
assert.equal(result.totals.manualReferences,1);
assert.equal(result.totals.reportedSaleCandidates,2);
assert.equal(result.totals.aggregates,1);
assert.equal(result.totals.externalAvms,1);
assert.equal(result.totals.independentlyQualifiedComparables,0);
assert.equal(result.totals.professionalValuations,0);
assert.equal(result.totals.crossProviderReviewPairs,1,
 'same original deal reference displayed by REGA and MOJ must never count twice as proof');
assert.equal(result.totals.crossProviderReviewPairsSampled,1);
assert.equal(result.totals.crossProviderPairsTruncated,false);
assert.equal(result.findings[0].bucket,'REPORTED_SALE_CANDIDATE');
assert.ok(result.findings[0].reasons.includes('TRANSACTION_ORIGIN_NOT_AUTHENTICATED'));
assert.ok(result.findings[0].reasons.includes('DATASET_LICENSE_AND_RIGHTS_NOT_INDEPENDENTLY_VERIFIED'));
assert.ok(result.findings[0].reasons.includes('AREA_BASIS_AND_INTEREST_NOT_VERIFIED'));
assert.equal(result.findings[0].marketValuationEligible,false);
assert.equal(result.findings[2].bucket,'AGGREGATE_CONTEXT');
assert.ok(result.findings[2].warnings.includes('AREA_STATISTIC_NOT_PROPERTY_COMPARABLE'));
assert.equal(result.findings[3].bucket,'EXTERNAL_MODEL_BENCHMARK');
assert.equal(result.findings[3].status,'HOLD_REVIEW',
 'explicit registered ai.grem.capital hostname remains a known research source');
assert.ok(result.findings[3].warnings.includes('AVM_IS_NOT_AN_EXECUTED_TRANSACTION'));
assert.equal(result.referenceFindings[0].status,'HOLD_REVIEW');

const duplicates=evaluate([sale,{...sale}]);
assert.equal(duplicates.totals.duplicatePairs,1);
assert.equal(duplicates.duplicates[0].reason,'DUPLICATE_SOURCE_RECORD_ID');
assert.ok(Object.isFrozen(duplicates.duplicates[0]),'duplicate metadata cannot be modified after qualification');
assert.ok(Object.isFrozen(result.crossProviderCandidates[0]),'cross-provider candidate metadata cannot be modified after qualification');
assert.equal(duplicates.totals.crossProviderReviewPairs,0);

const prefix='T'.repeat(80);
const separate=evaluate([{...sale,recordId:prefix+'A'},{...sale,recordId:prefix+'B'}],[]);
assert.equal(separate.totals.duplicatePairs,0);
assert.equal(separate.findings[0].referenceId,separate.findings[1].referenceId);
const across=evaluate([{...sale,recordId:prefix+'A'},{...moj,recordId:prefix+'B'}],[]);
assert.equal(across.totals.crossProviderReviewPairs,0);
const actual=evaluate([{...sale,recordId:prefix+'A'},{...sale,recordId:prefix+'A'},{...moj,recordId:prefix+'A'}],[]);
assert.equal(actual.totals.duplicatePairs,1);
assert.equal(actual.totals.crossProviderReviewPairs,2);
assert.equal(actual.marketValuationEligible,false);

// Worst-case source repetition previously built a quadratic-size list with
// 562,500 pair objects. Count all pairs but retain bounded review samples.
const repetitive=evaluate([
 ...Array(750).fill(sale),
 ...Array(750).fill(moj),
],[]);
assert.equal(repetitive.totals.importedRows,MAX_ROWS);
assert.equal(repetitive.totals.crossProviderReviewPairs,750*750);
assert.ok(repetitive.totals.crossProviderReviewPairsSampled>0);
assert.ok(repetitive.totals.crossProviderReviewPairsSampled<=MAX_CROSS_PROVIDER_PAIR_SAMPLES);
assert.equal(repetitive.crossProviderCandidates.length,
 repetitive.totals.crossProviderReviewPairsSampled);
assert.equal(repetitive.totals.crossProviderPairsTruncated,true);
assert.equal(repetitive.marketValuationEligible,false);
// The 256 KiB export limit is a separate fail-closed boundary.
assert.throws(()=>portableReviewDossier(repetitive),/QUALIFICATION_DOSSIER_TOO_LARGE/);
// A smaller batch still demonstrates that truncated pair evidence is
// exported together with an accurate, explicit total.
const sampled=evaluate([...Array(40).fill(sale),...Array(40).fill(moj)],[]);
const sampledDossier=JSON.parse(portableReviewDossier(sampled));
assert.equal(sampledDossier.totals.crossProviderReviewPairs,40*40);
assert.ok(sampledDossier.totals.crossProviderReviewPairsSampled>0);
assert.ok(sampledDossier.totals.crossProviderReviewPairsSampled<=MAX_CROSS_PROVIDER_PAIR_SAMPLES);
assert.equal(sampledDossier.totals.crossProviderPairsTruncated,true);
assert.equal(sampledDossier.crossProviderReviewPairs.length,
 sampledDossier.totals.crossProviderReviewPairsSampled);

const rejectedSameSource=evaluate([
 sale,{...sale,sourceUrl:'https://rei.rega.gov.sa.attacker.example/'},
],[]);
assert.equal(rejectedSameSource.findings[1].status,'REJECTED');
assert.equal(rejectedSameSource.totals.rejected,1);
assert.equal(rejectedSameSource.totals.duplicatePairs,0,
 'a rejected source URL must not contaminate same-source transaction matching');
const rejectedCrossSource=evaluate([
 sale,{...moj,professionalReportAuthorized:true},
],[]);
assert.equal(rejectedCrossSource.findings[1].status,'REJECTED');
assert.equal(rejectedCrossSource.totals.crossProviderReviewPairs,0,
 'a forged professional claim must not count as another source corroborating a sale');
const rejectedOnly=evaluate([
 {...sale,marketValuationEligible:true},
 {...sale,sourceRecordAuthenticated:true},
],[]);
assert.equal(rejectedOnly.totals.rejected,2);
assert.equal(rejectedOnly.totals.duplicatePairs,0);
const nonSaleReference=evaluate([
 sale,{...index,recordId:'T-123'},
],[]);
assert.equal(nonSaleReference.findings[1].bucket,'AGGREGATE_CONTEXT');
assert.equal(nonSaleReference.totals.duplicatePairs,0,
 'an aggregate statistics row cannot masquerade as a duplicate executed transaction');
assert.equal(nonSaleReference.totals.independentlyQualifiedComparables,0);
assert.equal(nonSaleReference.marketValuationEligible,false);

const priceConflict=evaluate([sale,{...sale,metricValue:9900000,eventDate:'2026-11-18'}]);
assert.equal(priceConflict.totals.duplicatePairs,1);
assert.equal(priceConflict.duplicates[0].reason,'CONFLICTING_SOURCE_RECORD_ID',
 'changing the event date or price must not bypass source-ID conflict detection');
assert.equal(priceConflict.totals.independentlyQualifiedComparables,0);
const differentCity=evaluate([{
 ...sale,city:'جدة',district:'الصفا',assetType:'APARTMENT',
}]);
assert.ok(differentCity.findings[0].warnings.includes('SUBJECT_CITY_MISMATCH'));
assert.ok(differentCity.findings[0].warnings.includes('SUBJECT_DISTRICT_MISMATCH'));
assert.ok(differentCity.findings[0].warnings.includes('SUBJECT_ASSET_TYPE_MISMATCH'));
assert.equal(differentCity.marketValuationEligible,false);

for(const corrupt of [
 {...sale,sourceUrl:'https://rei.rega.gov.sa.attacker.test/'},
 {...avm,sourceUrl:'https://evil.grem.capital/'},
 {...sale,sourceUrl:'http://rei.rega.gov.sa/'},
 {...sale,sourceUrl:'https://username:secret@rei.rega.gov.sa/'},
 {...sale,sourceUrl:'https://rei.rega.gov.sa:8443/'},
 {...sale,sourceId:'__proto__'},
 {...sale,evidenceClass:'__proto__'},
 {...sale,marketValuationEligible:true},
 {...sale,sourceRecordAuthenticated:true},
 {...sale,professionalReportAuthorized:true},
 {...sale,licenseVerified:true},
]){
 const x=evaluate([corrupt]);
 assert.equal(x.findings[0].status,'REJECTED');
 assert.equal(x.marketValuationEligible,false);
}
const invalidDate=evaluate([{...sale,eventDate:'2026-11-23'}]);
assert.ok(invalidDate.findings[0].reasons.includes('EVENT_DATE_INVALID'));
const oversized=evaluate([{...sale,metricValue:2e15}]);
assert.ok(oversized.findings[0].reasons.includes('METRIC_OUT_OF_RANGE'));
const badRef=evaluate([],[{...manual,decisionReady:true}]);
assert.equal(badRef.referenceFindings[0].status,'REJECTED');
assert.equal(badRef.certifiedMarketValueSar,null);
for(const flag of ['licenseVerified','propertyIdentityVerified','professionalReportAuthorized','contentCopied']){
 const forged=evaluate([],[{...manual,[flag]:true}]);
 assert.equal(forged.referenceFindings[0].status,'REJECTED',
  'manual source cannot assert its own '+flag);
}
// The qualification gate must never accept an arbitrary imported object
// merely because its authority flags look like a captureReference result.
// Validate source URL/host, date, method, type, and extra fields again.
for(const altered of [
 {...manual,sourceUrl:'https://umaps.momah.gov.sa.attacker.example/'},
 {...manual,sourceUrl:'https://umaps.momah.gov.sa/?session=private'},
 {...manual,sourceUrl:'http://umaps.momah.gov.sa/'},
 {...manual,observedOn:'2026-11-23'},
 {...manual,observedOn:'2026-02-30'},
 {...manual,city:'<script>'},
 {...manual,mode:'VERIFIED_TRANSACTION'},
 {...manual,method:'PROVIDER_AUTHENTICATED'},
 {...manual,personalResearch:false},
 {...manual,unsupportedAuthority:'APPROVED'},
]){
 const checked=evaluate([],[altered]);
 assert.equal(checked.referenceFindings[0].status,'REJECTED',
  'tampered no-API manual reference must be rejected at qualification boundary');
 assert.equal(checked.marketValuationEligible,false);
}
assert.equal(evaluate([],[manual]).referenceFindings[0].status,'HOLD_REVIEW');
const protoRef=evaluate([],[{...manual,sourceId:'constructor'}]);
assert.equal(protoRef.referenceFindings[0].status,'REJECTED');
assert.equal(evaluate([]).decision,'HOLD_EXTERNAL_VERIFICATION_REQUIRED');
assert.throws(()=>evaluate('invalid'),/QUALIFICATION_RECORD_LIMIT/);
assert.throws(()=>evaluate(Array(MAX_ROWS+1).fill(sale)),/QUALIFICATION_RECORD_LIMIT/);
assert.throws(()=>qualifiedResearchIntake({subject:[],asOf:day}),/QUALIFICATION_SUBJECT_INVALID/);

const dossier=JSON.parse(portableReviewDossier(result));
assert.equal(dossier.decision,'HOLD_EXTERNAL_VERIFICATION_REQUIRED');
assert.equal(dossier.certifiedMarketValueSar,null);
assert.equal(dossier.certifiedMarketRentSar,null);
assert.equal(dossier.sourceReview.length,4);
assert.equal(dossier.referenceReview.length,1);
assert.equal(dossier.crossProviderReviewPairs.length,1);
assert.ok(!JSON.stringify(dossier).includes('2400000'),
 'review dossier never copies executed deal prices');
assert.ok(!JSON.stringify(dossier).includes('umaps.momah.gov.sa'),
 'review dossier never copies manually viewed URLs or login fragments');
assert.throws(()=>portableReviewDossier({...result,decision:'READY'}),/QUALIFICATION_DOSSIER_INPUT_INVALID/);
// A caller cannot counterfeit a genuine pre-valuation review simply by
// copying the version and HOLD label and inserting sensitive data.
assert.throws(()=>portableReviewDossier({...result,findings:[{
 ...result.findings[0],reasons:['owner: personal@example.invalid', 'price: 2400000']
}]}),/QUALIFICATION_DOSSIER_INPUT_INVALID/);
assert.throws(()=>portableReviewDossier(JSON.parse(JSON.stringify(result))),
 /QUALIFICATION_DOSSIER_INPUT_INVALID/);
assert.equal(JSON.parse(portableReviewDossier(result)).decision,'HOLD_EXTERNAL_VERIFICATION_REQUIRED');
const panel=fs.readFileSync(path.join(__dirname,'../../src/components/EvidenceQualificationReviewPanel.jsx'),'utf8');
const national=fs.readFileSync(path.join(__dirname,'../../src/components/SaudiNationalIntelligenceSourcesPanel.jsx'),'utf8');
const property=fs.readFileSync(path.join(__dirname,'../../src/components/PropertyMarketLocationPanel.jsx'),'utf8');
const manualPanel=fs.readFileSync(path.join(__dirname,'../../src/components/NoApiSourceBridgePanel.jsx'),'utf8');
assert.match(national,/<EvidenceQualificationReviewPanel records=\{records\} references=\{manualReferences\} subject=\{subject\}\/>/);
assert.match(national,/NoApiSourceBridgePanel onReferencesChange=\{setManualReferences\}/);
assert.match(property,/subject=\{subject\} onResearchChange=/);
assert.match(manualPanel,/onReferencesChange\?\.\(merged.references\)/);
assert.match(panel,/data-testid="qualification-decision"/);
assert.match(panel,/data-testid="qualification-download-review"/);
assert.doesNotMatch(panel,/fetch\(|axios|document\.cookie|localStorage|sessionStorage/);
console.log('EVIDENCE_QUALIFICATION_GATE=PASS: synthetic sources, conflicts, rights, identity, no valuation promotion');
