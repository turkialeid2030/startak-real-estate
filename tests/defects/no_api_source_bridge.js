'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {
 VERSION,SOURCES,BY_ID,SOURCE_ENTRYPOINTS,BY_ENTRYPOINT_ID,MAX_REFERENCES,MAX_PORTABLE_BYTES,
 captureReference,mergeReferences,exportReferences,importReferences,
}=require('../../src/market/no-api-source-bridge');
const AS_OF_FOR_ENDPOINTS=new Date('2026-11-22T12:00:00Z');

assert.equal(SOURCES.length,53,'35 historic + 6 listing + 12 ancillary references');
assert.equal(SOURCE_ENTRYPOINTS.length,19);
assert.equal(new Set(SOURCE_ENTRYPOINTS.map(ep=>ep.id)).size,19);
for(const ep of SOURCE_ENTRYPOINTS){
 const source=BY_ID[ep.sourceId],url=new URL(ep.url);
 assert.ok(source,'UNREGISTERED_ENDPOINT_PROVIDER');
 assert.equal(url.protocol,'https:');
 assert.ok(source.hosts.includes(url.hostname.toLowerCase()),'CROSS_PROVIDER_ENTRYPOINT');
 assert.equal(ep.automaticDataExtraction,false);
 assert.equal(ep.valuationAuthorized,false);
 const manual=captureReference({sourceId:ep.sourceId,sourceUrl:ep.url,
   observedOn:'2026-11-21'},{asOf:AS_OF_FOR_ENDPOINTS});
 assert.equal(manual.evidenceClass,'RESEARCH_REFERENCE_ONLY');
 assert.equal(manual.sourceAuthenticated,false);
 assert.equal(manual.valuationSar,null);
}
assert.equal(BY_ENTRYPOINT_ID.SUHAIL_TRANSACTIONS.url,'https://www.suhail.ai/Riyadh/transactions');
assert.equal(BY_ENTRYPOINT_ID.SUHAIL_METRICS.url,'https://www.suhail.ai/Riyadh/metrics');
assert.equal(BY_ENTRYPOINT_ID.EARTH_VALUE.url,'https://map.earthapp.com.sa/value');
assert.equal(BY_ENTRYPOINT_ID.EARTH_OFFERS.url,'https://map.earthapp.com.sa/offers');
assert.equal(BY_ENTRYPOINT_ID.EARTH_TRANSACTIONS.url,'https://earthapp.com.sa/transaction');
assert.equal(BY_ENTRYPOINT_ID.AQAR_OFFERS.url,'https://sa.aqar.fm/');
assert.equal(BY_ENTRYPOINT_ID.INFATH_AUCTIONS.url,'https://infath.gov.sa/auctions');
assert.equal(BY_ENTRYPOINT_ID.SBC_CODE.url,'https://www.sbc.gov.sa/ar/Pages/default.aspx');
for(const id of ['SBC','SGS','INFATH','ZATCA','SAMA','CMA','SAUDI_EXCHANGE',
 'VISION2030','GOOGLE_MAPS','OSM','MAPBOX','GOOGLE_EARTH_ENGINE']){
 assert.ok(BY_ID[id]&&BY_ID[id].productionAdapterEnabled===false);
 assert.equal(BY_ID[id].dataLicenseVerified,false);
}
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
assert.throws(()=>captureReference({...valid,sourceId:'constructor'},{asOf:AS_OF}),
 /NOAPI_SOURCE_UNKNOWN/,'prototype-chain identifiers are not providers');
assert.throws(()=>captureReference(valid,{asOf:new Date(NaN)}),/NOAPI_DATE_INVALID/,
 'invalid Date must have a controlled validation error');
const pipeDistinct=mergeReferences([],[
 {...valid,city:'A|B',district:'C',sourceUrl:'https://umaps.momah.gov.sa/one'},
 {...valid,city:'A',district:'B|C',sourceUrl:'https://umaps.momah.gov.sa/one'},
]);
assert.equal(pipeDistinct.references.length,2,
 'manual city/district values cannot collide through delimiter concatenation');
assert.equal(pipeDistinct.duplicates,0);
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
// Require the mounted bridge to pass its local source-register state back
// to the review host; props added by the evidence qualification gate are valid.
assert.match(host,/<NoApiSourceBridgePanel\b[^>]*\bonReferencesChange=\{setManualReferences\}[^>]*\/>/);
assert.match(jsx,/data-testid="noapi-source-select"/);
assert.match(jsx,/data-testid="noapi-entrypoint-select"/);
assert.match(jsx,/data-testid="noapi-navigation-only"/);
assert.match(jsx,/href=\{originalPage\}/);
assert.match(jsx,/setSourceUrl\(ep\?\.url\|\|src\.url\)/);
assert.match(jsx,/data-testid="noapi-add-link"/);
assert.match(jsx,/data-testid="noapi-use-property-location"/);
assert.match(host,/subject=\{subject\}/);
assert.match(jsx,/data-testid="noapi-export"/);
assert.match(jsx,/data-testid="noapi-import"/);
assert.match(jsx,/target="_blank" rel="noopener noreferrer"/);
assert.doesNotMatch(jsx,/fetch\(|axios|document\.cookie|localStorage|sessionStorage/i);
console.log('STARTAK_NOAPI_SOURCE_BRIDGE=PASS manual_links='+SOURCES.length+' detailed_pages='+SOURCE_ENTRYPOINTS.length+' source_copy=false verified=0');
