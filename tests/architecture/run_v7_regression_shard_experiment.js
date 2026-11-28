'use strict';
const assert=require('node:assert/strict');
const {partition,validate,SHARDS}=require('../../tools/v7-regression-shard-experiment');
const files=Array.from({length:17},(_,i)=>'tests/architecture/run_fixture_'+i+'.js');
const ctx={source:'a'.repeat(40),run:'123',attempt:'1'};
const make=()=>Array.from({length:SHARDS},(_,index)=>{
 const stage=()=>({elapsedMs:1,records:partition(files,index).map(file=>({file,status:'PASS',elapsedMs:1}))});
 return {schemaVersion:1,...ctx,index,build:'PASS',pre:stage(),post:stage()};
});
assert.deepEqual(make().flatMap(x=>x.pre.records.map(y=>y.file)).sort(),[...files].sort());
assert.equal(validate(make(),files,ctx).executions,34);
assert.equal(validate(make(),files,ctx).productionAuthorized,false);
assert.equal(validate(make(),files,ctx).serialGateStillRequired,true);
const mutations=[
 r=>r.pop(),r=>r[1].index=0,r=>r[0].source='b'.repeat(40),r=>r[0].run='124',r=>r[0].attempt='2',
 r=>r[0].build='FAIL',r=>r[0].pre.records.pop(),r=>r[0].post.records[0].file='unexpected.js',
 r=>r[0].post.records[0].status='TIMEOUT',r=>r[0].pre.records[0].status='FAIL',
 r=>r[0].post.records[0].elapsedMs=-1,r=>r[0].pre.elapsedMs=NaN,r=>r[0].post=null,
 r=>r[0].index=4,r=>r[0].pre.records.reverse(),r=>r[0].schemaVersion=2
];
for(const mutate of mutations){const r=make();mutate(r);assert.throws(()=>validate(r,files,ctx));}
console.log('REGRESSION_SHARD_EVIDENCE_CONTRACT=PASS negative_cases='+mutations.length);
