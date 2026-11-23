'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {
 BY_SOURCE,METRIC_UNITS,AGGREGATE_METRICS,buildPersonalNoApiResearchEntry,
}=require('../../src/market/personal-noapi-manual-entry');
const {mergeNationalResearch}=require('../../src/market/saudi-national-intelligence-sources');
const asOf='2026-11-22',observedOn='2026-11-20';
const location={city:'الرياض',district:'الملز',observedOn};
const pick=(data)=>buildPersonalNoApiResearchEntry({...location,...data},{asOf});

const sale=pick({
 sourceId:'REGA_REI',kind:'OFFICIAL_REPORTED_SALE',
 recordId:'TEST-SALE-001',eventDate:'2026-11-19',
 metricValue:'٢٬٤٠٠٬٠٠٠',assetType:'LAND',
 sourceUrl:'https://rei.rega.gov.sa/ar/advanced-search/deals?session=private-token#secret',
});
assert.equal(sale.evidenceClass,'OFFICIAL_REPORTED_SALE');
assert.equal(sale.metricValue,2400000);
assert.equal(sale.sourceUrl,'https://rei.rega.gov.sa/ar/advanced-search/deals');
assert.equal(sale.sourceRecordAuthenticated,false);
assert.equal(sale.executedTransactionRecord,false);
assert.equal(sale.marketValuationEligible,false);
assert.equal(sale.professionalReportAuthorized,false);
assert.equal(sale.personalResearch,true);
assert.ok(!JSON.stringify(sale).includes('private-token'));

const aggregate=pick({
 sourceId:'PASEETAH',kind:'THIRD_PARTY_AGGREGATE',
 periodStart:'2026-10-01',periodEnd:'2026-10-31',metricName:'avg_rent_sar',
 metricValue:'70,000',assetType:'APARTMENT',
});
assert.equal(aggregate.metricName,'avg_rent_sar');
assert.equal(aggregate.metricUnit,'SAR');
assert.equal(aggregate.metricValue,70000);
assert.equal(aggregate.marketValuationEligible,false);

const note=pick({sourceId:'TATHMIN',kind:'RESEARCH_NOTE',assetType:'LAND'});
assert.equal(note.metricValue,null);
assert.equal(note.metricName,null);
assert.equal(note.recordId,null);
assert.equal(note.professionalReportAuthorized,false);

const avm=pick({
 sourceId:'BAYUT_TRUVALUE',kind:'EXTERNAL_AVM_ESTIMATE',
 recordId:'BAYUT-EXAMPLE-123',assetType:'APARTMENT',
 metricValue:'3,500,000',rangeLowSar:'3,400,000',rangeHighSar:'3,600,000',
 confidenceLabel:'MEDIUM',modelAsOf:'2026-11-19',
});
assert.equal(avm.metricValue,3500000);
assert.equal(avm.providerRangeLowSar,3400000);
assert.equal(avm.providerRangeHighSar,3600000);
assert.equal(avm.providerStatedConfidence,'MEDIUM');
assert.equal(avm.sourceRecordAuthenticated,false);
assert.equal(avm.marketValuationEligible,false);
assert.equal(avm.independentMarketPriceVerified,false);

const merged=mergeNationalResearch([],[sale,aggregate,note,avm]);
assert.equal(merged.added,4);
assert.equal(merged.records.length,4);
assert.equal(merged.verifiedSales,0);
assert.equal(merged.autoValuationEnabled,false);
const duplicate=mergeNationalResearch(merged.records,[sale]);
assert.equal(duplicate.added,0);
assert.equal(duplicate.duplicates,1);

for(const input of [
 {sourceId:'constructor',kind:'RESEARCH_NOTE'},
 {sourceId:'__proto__',kind:'RESEARCH_NOTE'},
 {sourceId:'MOJ_SREM',kind:'EXTERNAL_AVM_ESTIMATE',recordId:'X',metricValue:'12'},
]){
 assert.throws(()=>pick(input),/PERSONAL_NOAPI_SOURCE_UNAVAILABLE|PERSONAL_NOAPI_CLASS_OUT_OF_SCOPE/);
}
for(const change of [
 {city:''},{district:' '},{eventDate:'2026-11-22'},
 {recordId:''},{metricValue:'NaN'},{metricValue:'-500'},
 {sourceUrl:'https://rei.rega.gov.sa.evil.invalid/deals'},
 {sourceUrl:'https://evil.invalid/redirect?url=rei.rega.gov.sa'},
]){
 assert.throws(()=>pick({
  sourceId:'REGA_REI',kind:'OFFICIAL_REPORTED_SALE',
  recordId:'T123',eventDate:'2026-11-19',metricValue:'2400000',
  sourceUrl:'https://rei.rega.gov.sa/ar/advanced-search/deals',...change,
 }),/PERSONAL_NOAPI_CAPTURE_REJECTED/);
}
for(const change of [
 {periodStart:'2026-11-01',periodEnd:'2026-11-30'},
 {metricName:'rent_contract_fake'},
 {metricValue:'not a price'},
]){
 assert.throws(()=>pick({
  sourceId:'PASEETAH',kind:'THIRD_PARTY_AGGREGATE',
  periodStart:'2026-10-01',periodEnd:'2026-10-31',
  metricName:'avg_rent_sar',metricValue:'70000',...change,
 }),/PERSONAL_NOAPI_CAPTURE_REJECTED|PERSONAL_NOAPI_METRIC_OUT_OF_SCOPE/);
}
for(const change of [
 {assetType:'HOTEL'},
 {rangeLowSar:'4500000'},
 {rangeHighSar:'2500000'},
 {confidenceLabel:'CERTIFIED'},
 {recordId:''},
]){
 assert.throws(()=>pick({
  sourceId:'BAYUT_TRUVALUE',kind:'EXTERNAL_AVM_ESTIMATE',
  recordId:'AVM-1',assetType:'APARTMENT',metricValue:'3500000',
  rangeLowSar:'3000000',rangeHighSar:'3900000',
  confidenceLabel:'MEDIUM',modelAsOf:'2026-11-19',...change,
 }),/PERSONAL_NOAPI_CAPTURE_REJECTED/);
}
assert.equal(METRIC_UNITS.avg_rent_sar,'SAR');
assert.ok(AGGREGATE_METRICS.includes('avg_rent_sar'));
assert.ok(BY_SOURCE.REGA_REI.allowed.includes('OFFICIAL_REPORTED_SALE'));

const component=fs.readFileSync(path.join(__dirname,'../../src/components/PersonalNoApiManualEntryPanel.jsx'),'utf8');
const host=fs.readFileSync(path.join(__dirname,'../../src/components/SaudiNationalIntelligenceSourcesPanel.jsx'),'utf8');
assert.match(component,/data-testid="personal-noapi-market-entry"/);
assert.match(component,/data-user-content translate="no"/);
assert.match(component,/ASSET_LABELS\[type\]\[en\?1:0\]/);
assert.match(component,/RESIDENTIAL_LAND:\['أرض سكنية','Residential land'\]/);
assert.match(component,/data-testid="personal-noapi-use-property"/);
assert.match(component,/data-testid="personal-noapi-open-source"/);
assert.match(component,/data-testid="personal-noapi-add"/);
assert.match(component,/buildPersonalNoApiResearchEntry/);
assert.match(component,/onResearchRows\(\[row\]\)/);
assert.match(host,/onResearchRows=\{ingestPersonal\}/);
assert.match(host,/function ingestPersonal\(rows\)/);
assert.match(host,/mergeNationalResearch\(records,rows\)/);
assert.doesNotMatch(component,/fetch\(|axios|document\.cookie|localStorage|sessionStorage|navigator\.credentials/i);
console.log('PERSONAL_NOAPI_MANUAL_CAPTURE=PASS source_notes=true sale=true rental_aggregate=true avm=true api_calls=0 certified_values=0');
