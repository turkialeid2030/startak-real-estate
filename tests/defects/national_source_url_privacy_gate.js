'use strict';
const assert=require('node:assert/strict');
const {importNationalSourcesCsv,mergeNationalResearch}=require('../../src/market/saudi-national-intelligence-sources');
const {qualifiedResearchIntake,portableReviewDossier}=require('../../src/market/evidence-qualification-gate');

const asOf=new Date('2026-11-22T00:00:00.000Z');
const observedOn='2026-11-20';
const header='source,kind,city,district,recordId,eventDate,metricName,metricValue,unit,sourceUrl,assetType';
const row=url=>'REGA_REI,OFFICIAL_REPORTED_SALE,الرياض,الملز,NAT-123,2026-11-19,sale_price_sar,2400000,SAR,'+url+',LAND';
function imported(url){
 return importNationalSourcesCsv([header,row(url)].join('\n'),{asOf,observedOn});
}
const clean=imported('https://rei.rega.gov.sa/ar/advanced-search/deals');
assert.equal(clean.rejected.length,0);
assert.equal(clean.records.length,1);
const dirty='https://rei.rega.gov.sa/ar/advanced-search/deals?session=PRIVATE_TOKEN_987&owner_email=user%40example.invalid#auth=PRIVATE_TOKEN_987';
const scrubbed=imported(dirty);
assert.equal(scrubbed.rejected.length,0);
assert.equal(scrubbed.records.length,1);
assert.equal(scrubbed.records[0].sourceUrl,clean.records[0].sourceUrl);
assert.ok(!JSON.stringify(scrubbed.records).includes('PRIVATE_TOKEN_987'));
assert.ok(!JSON.stringify(scrubbed.records).includes('user%40example.invalid'));
assert.equal(scrubbed.records[0].sourceRecordAuthenticated,false);
assert.equal(scrubbed.records[0].marketValuationEligible,false);
const valid=scrubbed.records[0];

const merged=mergeNationalResearch([],scrubbed.records);
assert.equal(merged.records.length,1);
assert.equal(merged.records[0].sourceUrl,clean.records[0].sourceUrl);
assert.equal(merged.verifiedSales,0);
assert.equal(merged.autoValuationEnabled,false);
const qualified=qualifiedResearchIntake({
 records:merged.records,references:[],subject:{city:'الرياض',district:'الملز',assetType:'LAND'},asOf,
});
assert.equal(qualified.decision,'HOLD_EXTERNAL_VERIFICATION_REQUIRED');
assert.equal(qualified.totals.reportedSaleCandidates,1);
assert.equal(qualified.totals.independentlyQualifiedComparables,0);
assert.equal(qualified.certifiedMarketValueSar,null);
assert.ok(!portableReviewDossier(qualified).includes('PRIVATE_TOKEN_987'));

for(const url of [
 'https://unexpected.rei.rega.gov.sa/ar/advanced-search/deals',
 'https://rei.rega.gov.sa:8443/ar/advanced-search/deals',
 'http://rei.rega.gov.sa/ar/advanced-search/deals',
 'https://rei.rega.gov.sa.attacker.invalid/ar/advanced-search/deals',
 'https://user:secret@rei.rega.gov.sa/ar/advanced-search/deals',
]){
 const result=imported(url);
 assert.equal(result.records.length,0,'invalid source URL must be excluded: '+url);
 assert.ok(result.rejected[0].issues.includes('SOURCE_URL_UNTRUSTED'));
}
for(const override of [
 {sourceUrl:dirty},
 {sourceUrl:'https://rei.rega.gov.sa:8443/ar/advanced-search/deals'},
 {sourceRecordAuthenticated:true},
 {independentMarketPriceVerified:true},
 {professionalReportAuthorized:true},
 {marketValuationEligible:true},
 {executedTransactionRecord:true},
 {origin:'THIRD_PARTY_AVM'},
 {country:'US'},
 {officialSourcePage:false},
 {personalResearch:false},
]){
 assert.throws(()=>mergeNationalResearch([],[{...valid,...override}]),
  /NATIONAL_RESEARCH_UNTRUSTED_RECORD/,
  'restored research cannot bypass source and authority validation');
}
// Prototype-chain property names are not registered providers. A malicious
// source ID must reject only its row, not abort a batch containing good data.
const cleanLink='https://rei.rega.gov.sa/ar/advanced-search/deals';
for(const invalidSourceId of ['__proto__','constructor','toString','valueOf','hasOwnProperty']){
 const mixed=[header,row(cleanLink).replace(/^REGA_REI,/,invalidSourceId+','),row(cleanLink)].join('\n');
 const result=importNationalSourcesCsv(mixed,{asOf,observedOn});
 assert.equal(result.records.length,1,'valid research row must survive bad source ID');
 assert.equal(result.rejected.length,1,'prototype property source must be rejected');
 assert.ok(result.rejected[0].issues.includes('SOURCE_NOT_REGISTERED'));
 assert.throws(()=>mergeNationalResearch([],[{...valid,sourceId:invalidSourceId}]),
  /NATIONAL_RESEARCH_UNTRUSTED_RECORD/,
  'restored rows cannot resolve Object.prototype as an authentic source');
}


// Distinct city/district tuples containing '|' must not be misclassified as
// the same source record or suppress one research row.
const a={...valid,recordId:'PIPE-1',city:'الرياض|شمال',district:'الملز'};
const b={...valid,recordId:'PIPE-1',city:'الرياض',district:'شمال|الملز'};
const separate=mergeNationalResearch([],[a,b]);
assert.equal(separate.records.length,2);
assert.equal(separate.conflicts.length,0);
const duplicated=mergeNationalResearch([],[a,{...a}]);
assert.equal(duplicated.records.length,1);
assert.equal(duplicated.duplicates,1);
for(const override of [
 {metricValue:'2400000'},{metricValue:NaN},{metricValue:Infinity},
 {metricValue:-1},{metricValue:1e17},{metricName:'estimated_value_sar'},
 {metricUnit:'SAR_PER_SQM'},{city:'   '},{district:''},
 {recordId:''},{recordId:100},{recordId:'T'.repeat(131)},
]){
 assert.throws(()=>mergeNationalResearch([],[{...valid,...override}]),
  /NATIONAL_RESEARCH_UNTRUSTED_RECORD/,
  'restored market research metric, city, district and ID are untrusted');
}


// Restored research rows must never gain credibility from fabricated dates.
// Test both aggregate chronology and the monthly-only Kite representation.
for(const tamper of [
 {observedOn:'2099-11-20'},{observedOn:'2026-02-30'},
 {observedOn:'2026-11-21',eventDate:'2026-11-22'},
 {eventDate:'2099-11-22'},{eventDate:'2026-02-30'},
 {periodStart:'2026-11-01'},{periodEnd:'2026-11-30'},
 {modelAsOf:'2026-11-20'},
]){
 assert.throws(()=>mergeNationalResearch([],[{...valid,...tamper}]),
  /NATIONAL_RESEARCH_UNTRUSTED_RECORD/,
  'invalid future, malformed or class-inconsistent dates cannot survive restore');
}
const aggregateSource='PASEETAH,THIRD_PARTY_AGGREGATE,الرياض,الملز,,,'+
 'deal_count,40,COUNT,https://paseetah.com/,LAND';
const aggregateHeaders='source,kind,city,district,recordId,eventDate,metricName,'+
 'metricValue,unit,sourceUrl,assetType,periodStart,periodEnd';
const importedAggregate=importNationalSourcesCsv(
 [aggregateHeaders,aggregateSource+',2026-10-01,2026-10-31'].join('\n'),
 {asOf,observedOn});
assert.equal(importedAggregate.records.length,1);
const agg=importedAggregate.records[0];
assert.equal(mergeNationalResearch([],[agg]).added,1);
for(const tamper of [
 {periodStart:null},{periodEnd:null},
 {periodStart:'2026-11-01'},{periodEnd:'2026-11-22'},
 {eventDate:'2026-10-01'},{modelAsOf:'2026-10-01'},
]){
 assert.throws(()=>mergeNationalResearch([],[{...agg,...tamper}]),
  /NATIONAL_RESEARCH_UNTRUSTED_RECORD/,
  'aggregate periods and observation dates must be consistent');
}
const {normalizeKiteResearch}=require('../../src/market/kite-personal-market-research');
const kite=normalizeKiteResearch({
 ok:true,provider:'KITE',dataset:'MOJ_QUARTERLY_OPEN_NOTARY_SALES',
 retrievedAt:'2026-11-20T12:00:00Z',attribution:{source:'test only'},
 records:[{id:'KITE-Q-1',month:'2026-10',cityNameAr:'الرياض',
 districtNameAr:'الملز',priceSar:2500000,landUse:'residential'}],
}).rows[0];
assert.equal(mergeNationalResearch([],[kite]).added,1,
 'legitimate Kite month-level record must remain accepted without invented sale day');
for(const tamper of [
 {dayKnown:true},{periodStart:'2026-09-01'},
 {periodEnd:'2026-11-30'},{eventDate:'2026-10-02'},
 {observedOn:'2099-10-20'},
]){
 assert.throws(()=>mergeNationalResearch([],[{...kite,...tamper}]),
  /NATIONAL_RESEARCH_UNTRUSTED_RECORD/,
  'forged Kite month or day-specific event date must fail closed');
}


// Restored evidence must preserve AVM value ranges, model claims and the
// registered provider's supported sector list; never turn a changed object
// into a valid price benchmark through merge().
const avmHeaders='source,kind,city,district,recordId,eventDate,metricName,'+
 'metricValue,unit,sourceUrl,assetType,rangeLowSar,rangeHighSar,'+
 'confidenceLabel,modelAsOf';
const avmEntry='GREM_AI,EXTERNAL_AVM_ESTIMATE,الرياض,الملز,AVM-01,,'+
 'estimated_value_sar,3000000,SAR,https://ai.grem.capital/ar,LAND,'+
 '2700000,3300000,HIGH,2026-11-19';
const avmResult=importNationalSourcesCsv(
 [avmHeaders,avmEntry].join('\n'),{observedOn,asOf});
assert.equal(avmResult.records.length,1);
assert.equal(avmResult.rejected.length,0);
const actualAvm=avmResult.records[0];
assert.equal(mergeNationalResearch([],[actualAvm]).added,1);
for(const override of [
 {providerRangeLowSar:undefined},
 {providerRangeLowSar:'2700000'},
 {providerRangeHighSar:NaN},
 {providerRangeHighSar:Infinity},
 {providerRangeLowSar:0},
 {providerRangeHighSar:1e17},
 {providerRangeLowSar:3400000},
 {providerRangeHighSar:2900000},
 {providerStatedConfidence:'CERTIFIED'},
 {providerStatedConfidence:12},
 {recordId:null},
]){
 assert.throws(()=>mergeNationalResearch([],[{...actualAvm,...override}]),
  /NATIONAL_RESEARCH_UNTRUSTED_RECORD/,
  'provider AVM range, confidence and reference must remain validated on restore');
}
const bayutResult=importNationalSourcesCsv([
 avmHeaders,
 'BAYUT_TRUVALUE,EXTERNAL_AVM_ESTIMATE,الرياض,الملز,BAYUT-AVM-01,,'+
 'estimated_value_sar,3500000,SAR,https://www.bayut.sa/property-market-analysis/tru-value/,'+
 'APARTMENT,3400000,3600000,MEDIUM,2026-11-19',
].join('\n'),{observedOn,asOf});
assert.equal(bayutResult.records.length,1);
assert.equal(mergeNationalResearch([],[bayutResult.records[0]]).added,1);
assert.throws(()=>mergeNationalResearch([],[{
 ...bayutResult.records[0],assetType:'HOTEL',
}]),/NATIONAL_RESEARCH_UNTRUSTED_RECORD/,
 'Bayut unsupported property classes cannot pass restored review');
for(const override of [
 {providerRangeLowSar:1},{providerRangeHighSar:2},
 {providerStatedConfidence:'CERTIFIED'},
]){
 assert.throws(()=>mergeNationalResearch([],[{...valid,...override}]),
  /NATIONAL_RESEARCH_UNTRUSTED_RECORD/,
  'reported sale must not inherit AVM metadata');
}
for(const override of [
 {providerRangeLowSar:2},{providerRangeHighSar:2},
 {providerStatedConfidence:'HIGH'},{recordId:'FORGED-TRANSACTION'},
]){
 assert.throws(()=>mergeNationalResearch([],[{...agg,...override}]),
  /NATIONAL_RESEARCH_UNTRUSTED_RECORD/,
  'aggregate research must not acquire a forged AVM/sale identity');
}

console.log('NATIONAL_RESEARCH_URL_PRIVACY_GATE=PASS');
