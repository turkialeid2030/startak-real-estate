'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {validate,plan}=require('../../tools/build-public-rental-candidate');
const dir='public/market-data',m=JSON.parse(fs.readFileSync(path.join(dir,'rental-manifest.json'),'utf8'));
let n=0;function test(name,fn){fn();n++;console.log('PASS '+name);}
test('actual national and historic data validation',()=>assert.equal(validate(dir,m,true).files.length,m.files.length));
test('same period and exact source bytes are idempotent',()=>assert.equal(plan(m,m).added,0));
test('same period with different source bytes held',()=>assert.throws(()=>plan(m,{files:[{...m.files[0],gitBlobSha:'0'.repeat(40)}]}),/REVISED_PERIOD_REVIEW/));
test('historical gaps remain visible',()=>assert.ok(m.files.some(f=>f.year===2025&&f.region==='Riyadh')));
test('new period added without deletion',()=>{const r=plan(m,{files:[{...m.files[0],year:2027,filename:'new-period.csv'}]});assert.equal(r.added,1);assert.equal(r.result.length,m.files.length+1);});
test('filename collision denied',()=>assert.throws(()=>plan(m,{files:[{...m.files[0],year:2027}]}),/FILENAME_COLLISION/));
test('partial retrieval with errors denied',()=>assert.throws(()=>validate(dir,{...m,errors:[{}]}),/MANIFEST_INVALID/));
test('duplicate period denied',()=>assert.throws(()=>validate(dir,{...m,files:[m.files[0],m.files[0]]}),/ENTRY_INVALID/));
test('directory traversal denied',()=>assert.throws(()=>validate(dir,{...m,files:[{...m.files[0],filename:'../evil.csv'}]}),/ENTRY_INVALID/));
test('tampered digest denied',()=>assert.throws(()=>validate(dir,{...m,files:[{...m.files[0],gitBlobSha:'0'.repeat(40)}]}),/DIGEST_MISMATCH/));
test('wrong period denied',()=>assert.throws(()=>validate(dir,{...m,files:[{...m.files[0],year:2027}]}),/SCOPE_MISMATCH/));
test('incomplete national coverage denied',()=>assert.throws(()=>validate(dir,{...m,files:[m.files[0]]},true),/COVERAGE_INCOMPLETE/));
console.log('PUBLIC_RENT_CANDIDATE_RULES=PASS cases='+n);

const {splitKnownMixed}=require('../../tools/split-public-rental-period');
const {HEADER}=require('../../src/reporting/public-rent-reference');
const old='2025,1,عسير,أبها,حي تجريبي,شقة,سكني,3,20000,150',current='2026,1,عسير,أبها,حي تجريبي,شقة,سكني,5,22000,160';
const make=rows=>Buffer.from('\uFEFF'+HEADER.join(',')+'\r\n'+rows.join('\r\n')+'\r\n');
test('known mixed period exact overlap reconciled',()=>{const r=splitKnownMixed(make([old,current]),make([current]),'aseer',2025,1);assert.equal(r.provenance.retainedRows,1);assert.equal(r.provenance.excludedDuplicateRows,1);assert.ok(r.derived.equals(make([old])));});
test('unknown mixed period denied',()=>assert.throws(()=>splitKnownMixed(make([old,current]),make([current]),'riyadh',2025,1),/PERIOD_MISMATCH/));
test('conflicting overlap denied',()=>assert.throws(()=>splitKnownMixed(make([old,current]),make([current.replace('22000','23000')]),'aseer',2025,1),/MIXED_OVERLAP_CONFLICT/));
test('duplicate multiplicity must match',()=>assert.throws(()=>splitKnownMixed(make([old,current,current]),make([current]),'aseer',2025,1),/MIXED_OVERLAP_CONFLICT/));
test('unexpected period denied',()=>assert.throws(()=>splitKnownMixed(make([old,current,current.replace('2026,1','2026,2')]),make([current]),'aseer',2025,1),/MIXED_UNEXPECTED_PERIOD/));
console.log('PUBLIC_RENT_MIXED_RULES=PASS totalCandidateCases='+n);
