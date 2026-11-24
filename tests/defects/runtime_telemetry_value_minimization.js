'use strict';
const assert=require('node:assert/strict');
const {sanitizeEnvelope,ALLOWED_ENVELOPE_FIELDS}=require('../../src/observability/report-runtime-error');
const privateText='SYNTHETIC_PRIVATE_DOCUMENT_AND_FINANCIAL_DATA';
const data={category:privateText,message:privateText,surface:privateText,locale:privateText,appVersion:privateText,buildHash:privateText,timestamp:privateText,userAgent:privateText,extra:{raw:privateText}};
const safe=sanitizeEnvelope(data);
assert.deepEqual(Object.keys(safe).sort(),[...ALLOWED_ENVELOPE_FIELDS].sort());
assert.equal(safe.category,'unknown');assert.equal(safe.surface,'unknown');assert.equal(safe.locale,'unknown');
assert.equal(safe.message,'STARTAK runtime error');assert.ok(!JSON.stringify(safe).includes(privateText));
assert.ok(!Object.hasOwn(safe,'userAgent'));
for(const [category,message] of [['window_error','Runtime error'],['unhandled_rejection','Unhandled rejection'],['workspace-unavailable','Supplementary workspace unavailable']]){
 const e=sanitizeEnvelope({...data,category,surface:'global',locale:'ar-SA'});
 assert.equal(e.category,category);assert.equal(e.message,message);assert.equal(e.surface,'global');assert.equal(e.locale,'ar-SA');assert.ok(!JSON.stringify(e).includes(privateText));
}
for(const input of [null,undefined,{}, {category:'__proto__',surface:{value:privateText},locale:[privateText]}, {category:'constructor'}]){
 const e=sanitizeEnvelope(input);assert.equal(e.category,'unknown');assert.ok(!JSON.stringify(e).includes(privateText));
}
console.log('RUNTIME_TELEMETRY_VALUE_MINIMIZATION=PASS synthetic_only=true');
