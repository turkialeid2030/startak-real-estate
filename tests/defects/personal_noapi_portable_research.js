'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {buildPersonalNoApiResearchEntry}=require('../../src/market/personal-noapi-manual-entry');
const {normalizeKiteResearch}=require('../../src/market/kite-personal-market-research');
const {
 VERSION,MAX_PORTABLE_BYTES,MAX_ROWS,FIELDS,
 exportPersonalResearch,importPersonalResearch,
}=require('../../src/market/personal-noapi-research-register');
const {mergeNationalResearch}=require('../../src/market/saudi-national-intelligence-sources');
const asOf='2026-11-22',observedOn='2026-11-20';
const sale=buildPersonalNoApiResearchEntry({
 sourceId:'REGA_REI',kind:'OFFICIAL_REPORTED_SALE',
 city:'الرياض',district:'الملز',observedOn,eventDate:'2026-11-19',
 recordId:'TEST-PERSONAL-001',assetType:'LAND',metricValue:'2400000',
},{asOf});
const note=buildPersonalNoApiResearchEntry({
 sourceId:'TATHMIN',kind:'RESEARCH_NOTE',city:'الرياض',
 district:'الملز',observedOn,
},{asOf});
const kite=normalizeKiteResearch({
 ok:true,provider:'KITE',dataset:'MOJ_QUARTERLY_OPEN_NOTARY_SALES',
 retrievedAt:'2026-11-20T12:00:00Z',
 attribution:{source:'KITE unit fixture',privateToken:'MUST_NOT_EXPORT'},
 records:[{id:'KITE-UNIT-123',month:'2026-10',cityNameAr:'الرياض',
  districtNameAr:'الملز',priceSar:2500000,landUse:'residential'}],
}).rows[0];
const original=[sale,note,kite];
const json=exportPersonalResearch(original);
const parsed=JSON.parse(json);
assert.equal(parsed.version,VERSION);
assert.equal(parsed.records.length,3);
assert.equal(parsed.records[2].dayKnown,false);
assert.equal(parsed.records[2].sourceId,'KITE_MOJ_QUARTERLY');
assert.equal(Object.keys(parsed.records[0]).length,FIELDS.length);
assert.ok(!json.includes('MUST_NOT_EXPORT'),'provider attribution must not leak');
assert.ok(!json.includes('privateToken'));
const restored=importPersonalResearch(json);
assert.equal(restored.length,3);
const merged=mergeNationalResearch([],restored);
assert.equal(merged.added,3);
assert.equal(merged.verifiedSales,0);
assert.equal(merged.autoValuationEnabled,false);
assert.equal(restored[2].dayKnown,false);
assert.equal(restored[0].marketValuationEligible,false);
assert.equal(restored[1].professionalReportAuthorized,false);
assert.equal(mergeNationalResearch(restored,importPersonalResearch(json)).duplicates,3);

for(const mutation of [
 value=>{value.version='OTHER';},
 value=>{value.records[0].marketValuationEligible=true;},
 value=>{value.records[0].sourceUrl+='?token=secret';},
 value=>{value.records[0].unexpectedApproval='SIGNED';},
 value=>{value.records[0].recordId='constructor';value.records[0].sourceId='constructor';},
 value=>{value.records[2].dayKnown=true;},
 value=>{value.records[2].eventDate='2026-10-16';},
 value=>{value.records[1].metricValue=3000000;},
 value=>{value.records[0].metricValue='2400000';},
 value=>{value.records.push(value.records[0]);},
]){
 const changed=JSON.parse(json);
 mutation(changed);
 assert.throws(()=>importPersonalResearch(JSON.stringify(changed)),
  /PERSONAL_RESEARCH_|NATIONAL_RESEARCH_/,
  'malformed or authority forged portable source data must reject completely');
}
assert.throws(()=>importPersonalResearch('{broken'),/PERSONAL_RESEARCH_JSON_INVALID/);
assert.throws(()=>importPersonalResearch('x'.repeat(MAX_PORTABLE_BYTES+1)),
 /PERSONAL_RESEARCH_IMPORT_SIZE_LIMIT/);
assert.throws(()=>exportPersonalResearch(Array(MAX_ROWS+1).fill(sale)),
 /PERSONAL_RESEARCH_ROWS_INVALID/);
assert.equal(importPersonalResearch(exportPersonalResearch([])).length,0);
const ui=fs.readFileSync(path.join(__dirname,'../../src/components/SaudiNationalIntelligenceSourcesPanel.jsx'),'utf8');
assert.match(ui,/data-testid="personal-noapi-download-research"/);
assert.match(ui,/data-testid="personal-noapi-restore-research"/);
assert.match(ui,/exportPersonalResearch\(records\)/);
assert.match(ui,/importPersonalResearch\(await file\.text\(\)\)/);
assert.match(ui,/mergeNationalResearch\(records,incoming\)/);
assert.doesNotMatch(ui,/localStorage|sessionStorage|document\.cookie/);
console.log('PERSONAL_NOAPI_PORTABLE_RESEARCH=PASS rows=3 kite_month_only=true import=local export=local approvals=0');
