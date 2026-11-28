'use strict';
const assert=require('node:assert/strict');
const {validateHistoricalEvidence:validate}=require('../../tools/historical-diagnostic-evidence');
const sha='a'.repeat(40);
const rows=['chromium','firefox','webkit'].flatMap(engine=>[1366,390].map(width=>({engine,width,checks:7,physicalDevice:false})));
const base={sourceCommit:sha,checks:42,browsers:rows.map((row,i)=>({...row,checksCompleted:7*(i+1)})),physicalDevicesTested:false,screenReaderTested:false,marketDataVerified:false};
const ocr={...base,independentAccuracyQualified:false,sourceAuthenticationQualified:false};
const table={sourceCommit:sha,checks:42,contexts:rows,independentExtractionAccuracyQualified:false,sourceAuthenticationQualified:false,financialAdoptionAuthorized:false};
for(const [e,kind] of [[base,'acceptance.json'],[ocr,'local-ocr-acceptance.json'],[table,'document-tables-acceptance.json']])assert.deepEqual(validate(e,kind,sha),{contexts:6,checks:42});
const mutations=[
 e=>{e.sourceCommit='b'.repeat(40);},
 e=>{e.checks=43;},
 e=>{e.browsers.pop();},
 e=>{e.browsers[0].width=390;},
 e=>{e.browsers[0].checks=0;},
 e=>{e.browsers[1].checksCompleted=7;},
 e=>{e.browsers[0].physicalDevice=true;},
 e=>{e.browsers[0].checks=1.5;},
 e=>{delete e.browsers[0].checks;},
 e=>{e.screenReaderTested=true;}
];
for(const mutate of mutations){const e=JSON.parse(JSON.stringify(base));mutate(e);assert.throws(()=>validate(e,'acceptance.json',sha));}
assert.throws(()=>validate({...ocr,independentAccuracyQualified:true},'local-ocr-acceptance.json',sha));
assert.throws(()=>validate({...table,financialAdoptionAuthorized:true},'document-tables-acceptance.json',sha));
assert.throws(()=>validate(base,'unknown.json',sha));
console.log('HISTORICAL_EVIDENCE_ACCOUNTING_CONTRACT=PASS positive=3 negative=13');
