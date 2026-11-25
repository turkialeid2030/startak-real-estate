'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {parsePublicRentCsv,selectPublicRents}=require('../../src/reporting/public-rent-reference');
const raw=fs.readFileSync('public/market-data/rega-riyadh-q1-2026.csv');
assert.equal(crypto.createHash('sha1').update('blob '+raw.length+'\0').update(raw).digest('hex'),'be8c22ec87c7688cdaefeec86538fb1bab8bc254');
const rows=parsePublicRentCsv(raw.toString('utf8'));
assert.equal(rows.length,3534);
assert.ok(rows.every(r=>r.year===2026&&r.quarter===1&&r.vatBasis==='UNKNOWN'));
const malqa=selectPublicRents(rows,'الرياض','الملقا');
assert.ok(malqa.length>=3);
assert.equal(malqa.find(r=>r.kind==='شقة').count,3330);
assert.equal(malqa.find(r=>r.kind==='شقة').reportedRentSar,53921.96);
assert.equal(malqa.find(r=>r.kind==='مكتب').reportedRentSar,null);
assert.equal(selectPublicRents(rows,'الرياض','').length,0);
assert.equal(selectPublicRents(rows,'جدة','الملقا').length,0);
assert.throws(()=>parsePublicRentCsv('bad'));
console.log('PUBLIC_RENT_REAL_DATA=PASS rows='+rows.length+' districtRows='+malqa.length);

const manifest=JSON.parse(fs.readFileSync('public/market-data/rental-manifest.json','utf8'));
assert.equal(manifest.files.length,13);
assert.equal(new Set(manifest.files.map(f=>f.region)).size,13);
let total=0;
for(const f of manifest.files){
 const raw=fs.readFileSync('public/market-data/'+f.filename);
 assert.equal(crypto.createHash('sha1').update('blob '+raw.length+'\0').update(raw).digest('hex'),f.gitBlobSha);
 const records=parsePublicRentCsv(raw.toString('utf8'));
 assert.equal(records.length,f.rows);
 assert.ok(records.every(r=>r.year===f.year&&r.quarter===f.quarter&&r.vatBasis==='UNKNOWN'));
 total+=records.length;
}
assert.equal(total,20146);
console.log('PUBLIC_RENT_NATIONAL=PASS regions=13 rows='+total);
