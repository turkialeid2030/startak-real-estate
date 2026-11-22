'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {
 VERSION,SOURCES,BY_ID,MAX_REFERENCES,MAX_PORTABLE_BYTES,
 captureReference,mergeReferences,exportReferences,importReferences,
}=require('../../src/market/no-api-source-bridge');

assert.equal(SOURCES.length,35,'historical source inventory must cover all thirty-five reviewed destinations');
assert.equal(BY_ID.UMAPS.url,'https://umaps.momah.gov.sa/');
assert.equal(BY_ID.REGA.mode,'REFERENCE_ONLY');
assert.equal(BY_ID.MOJ_OPEN.mode,'LICENSE_REVIEW_FOR_FILE');
assert.equal(BY_ID.SUHAIL.productionAdapterEnabled,false);
for(const s of SOURCES){
 assert.equal(s.productionAdapterEnabled,false);
 assert.equal(s.dataLicenseVerified,false);
 assert.ok(s.url.startsWith('https://'));
}

const AS_OF=new Date('2026-11-22T12:00:00Z');
const valid={
 sourceId:'UMAPS',sourceUrl:'https://umaps.momah.gov.sa/some/public/page?token=secret#hidden',
 city:'الرياض',district:'الملز',observedOn:'2026-11-21',
};
const ref=captureReference(valid,{asOf:AS_OF});
assert.equal(ref.sourceUrl,'https://umaps.momah.gov.sa/some/public/page');
assert.equal(ref.evidenceClass,'RESEARCH_REFERENCE_ONLY');
assert.equal(ref.sourceAuthenticated,false);
assert.equal(ref.licenseVerified,false);
assert.equal(ref.propertyIdentityVerified,false);
assert.equal(ref.valuationSar,null);
assert.equal(ref.annualRentSar,null);
assert.equal(ref.productionConnectorUsed,false);
assert.equal(ref.decisionReady,false);
assert.equal(ref.contentCopied,false);
assert.equal(ref.professionalReportAuthorized,false);
assert.equal(ref.mode,'AUTHENTICATED_REFERENCE');
const twice=mergeReferences([ref],[ref]);
assert.equal(twice.references.length,1);
assert.equal(twice.duplicates,1);
const text=exportReferences([ref]);
assert.ok(!text.includes('secret'));
assert.ok(!text.includes('valuationSar'));
assert.ok(!text.includes('sourceAuthenticated'));
assert.equal(importReferences(text).references[0].sourceUrl,ref.sourceUrl);
assert.equal(importReferences(text).certifiedValues,0);
assert.equal(importReferences(text).authenticatedSales,0);
assert.equal(importReferences(text).productionIntegration,false);

for(const url of [
 'http://umaps.momah.gov.sa/','https://umaps.momah.gov.sa.attacker.com/',
 'https://attacker.com/?url=umaps.momah.gov.sa',
 'https://user:pass@umaps.momah.gov.sa/',
 'https://umaps.momah.gov.sa:8443/',
 'javascript:alert(1)','https://suhail.ai/',
]){
 assert.throws(()=>captureReference({...valid,sourceUrl:url},{asOf:AS_OF}),/NOAPI_URL_NOT_ALLOWED|NOAPI_URL_INVALID/);
}
for(const date of ['2027-11-22','2026-02-30','not-date','2026-11-23']){
 assert.throws(()=>captureReference({...valid,observedOn:date},{asOf:AS_OF}),/NOAPI_DATE_INVALID/);
}
for(const field of [{city:'<script>'},{district:'a'.repeat(101)}]){
 assert.throws(()=>captureReference({...valid,...field},{asOf:AS_OF}),/NOAPI_TEXT_INVALID/);
}
assert.throws(()=>captureReference({...valid,sourceId:'UNKNOWN'},{asOf:AS_OF}),/NOAPI_SOURCE_UNKNOWN/);

const json=JSON.parse(text);
json.references[0].decisionReady=true;
assert.throws(()=>importReferences(JSON.stringify(json)),/NOAPI_IMPORT_AUTHORITY_FIELD_FORBIDDEN/);
delete json.references[0].decisionReady;
json.references[0].valuationSar=12500000;
assert.throws(()=>importReferences(JSON.stringify(json)),/NOAPI_IMPORT_AUTHORITY_FIELD_FORBIDDEN/);
delete json.references[0].valuationSar;
json.version='OTHER_VERSION';
assert.throws(()=>importReferences(JSON.stringify(json)),/NOAPI_IMPORT_SCHEMA_INVALID/);
assert.throws(()=>importReferences('{invalid'),/NOAPI_IMPORT_JSON_INVALID/);
assert.throws(()=>importReferences('x'.repeat(MAX_PORTABLE_BYTES+1)),/NOAPI_IMPORT_TOO_LARGE/);
assert.throws(()=>mergeReferences([],Array(MAX_REFERENCES+1).fill(ref).map((r,i)=>({
 ...r,city:'City'+i,
}))),/NOAPI_MAX_REFERENCES/);
const jsx=fs.readFileSync(path.join(__dirname,'../../src/components/NoApiSourceBridgePanel.jsx'),'utf8');
const host=fs.readFileSync(path.join(__dirname,'../../src/components/SaudiNationalIntelligenceSourcesPanel.jsx'),'utf8');
assert.match(host,/<NoApiSourceBridgePanel\/>/);
assert.match(jsx,/data-testid="noapi-source-select"/);
assert.match(jsx,/data-testid="noapi-add-link"/);
assert.match(jsx,/data-testid="noapi-export"/);
assert.match(jsx,/data-testid="noapi-import"/);
assert.match(jsx,/target="_blank" rel="noopener noreferrer"/);
assert.doesNotMatch(jsx,/fetch\(|axios|document\.cookie|localStorage|sessionStorage/i);
console.log('STARTAK_NOAPI_SOURCE_BRIDGE=PASS manual_links='+SOURCES.length+' source_copy=false verified=0');
