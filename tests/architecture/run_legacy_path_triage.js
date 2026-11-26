'use strict';
const assert=require('node:assert/strict');
const {readHistoricRegister,triageLegacyPaths,parseLegacyTree,reviewBucket}=require('../../tools/legacy-path-triage');
const a='a'.repeat(40),b='b'.repeat(40),c='c'.repeat(40),d='d'.repeat(40);
const header='id,old,source_blob,versions,domain,modern_anchor,status,inspection,priority,acceptance';
const csv=header+'\n"LEG-001","old/a.js","'+a+'","v1","UI","new/a.js","OPEN","PATH_ONLY","P1","review, test"\n"LEG-002","old/b.js","'+d+'","v2","UI","new/b.js","OPEN","PATH_ONLY","P1","review"';
const register=readHistoricRegister(csv);
const current=new Map([['new/a.js',a],['new/b.js',b]]);
const candidates=[{path:'old/a.js',blobVariations:[a,b]},{path:'old/b.js',blobVariations:[b,c]},{path:'old/c.js',blobVariations:[c,d]}];
const result=triageLegacyPaths(current,candidates,register);
let checks=0;
function check(fn){fn();checks++;}
check(()=>assert.equal(register.size,2));
check(()=>assert.deepEqual(result.summary.classes,{ALL_VARIANTS_PRESENT_ELSEWHERE:1,SOME_VARIANTS_PRESENT_ELSEWHERE:1,NO_VARIANT_PRESENT:1}));
check(()=>assert.equal(result.summary.candidatePaths,3));
check(()=>assert.equal(result.summary.pathVariantPairs,6));
check(()=>assert.equal(result.summary.matchedPathVariantPairs,3));
check(()=>assert.equal(result.summary.unmatchedPathVariantPairs,3));
check(()=>assert.equal(result.summary.uniqueHistoricalBlobs,4));
check(()=>assert.equal(result.summary.registeredPaths,2));
check(()=>assert.equal(result.summary.registeredExactVariants,1));
check(()=>assert.equal(result.summary.unregisteredCandidatePaths,1));
check(()=>assert.equal(result.summary.functionalParity,'NOT_PROVEN'));
check(()=>assert.ok(result.details.every(x=>x.functionalParity==='NOT_PROVEN')));
check(()=>assert.equal(result.details[1].registerBlobPresent,false));
check(()=>assert.ok(!JSON.stringify(result.summary).includes('old/a.js')));
check(()=>assert.ok(!JSON.stringify(result.summary).includes(a)));
check(()=>assert.throws(()=>triageLegacyPaths(current,[...candidates,candidates[0]],register),/LEGACY_CANDIDATE_INVALID/));
check(()=>assert.throws(()=>triageLegacyPaths(current,[{path:'new/a.js',blobVariations:[a]}],register),/LEGACY_CANDIDATE_INVALID/));
check(()=>assert.throws(()=>triageLegacyPaths(current,[{path:'old/x',blobVariations:[a,a]}],register),/LEGACY_CANDIDATE_INVALID/));
check(()=>assert.throws(()=>triageLegacyPaths(current,[{path:'old/x',blobVariations:[]}],register),/LEGACY_CANDIDATE_INVALID/));
check(()=>assert.throws(()=>readHistoricRegister(header),/HISTORIC_REGISTER_EMPTY/));
check(()=>assert.throws(()=>readHistoricRegister(csv+'\n'+csv.split('\n')[1]),/HISTORIC_REGISTER_INVALID/));
check(()=>assert.throws(()=>readHistoricRegister('unexpected'),/HISTORIC_REGISTER_INVALID/));
const raw=Buffer.from('100644 blob '+a+'\tpath\nwith\ttab.js\0'+'120000 blob '+b+'\tsymlink\0');
check(()=>assert.deepEqual([...parseLegacyTree(raw)],[['path\nwith\ttab.js',a],['symlink',b]]));
check(()=>assert.equal(parseLegacyTree(Buffer.alloc(0)).size,0));
for(const value of ['100644 blob '+a+'\tfile','160000 commit '+a+'\tsubmodule\0','invalid\0','100644 blob '+a+'\tfile\0'+'100644 blob '+b+'\tfile\0']){
 check(()=>assert.throws(()=>parseLegacyTree(Buffer.from(value)),/LEGACY_TREE_INVALID/));
}
check(()=>assert.throws(()=>parseLegacyTree(Buffer.from([255,0]))));
check(()=>assert.deepEqual(result.summary.unregisteredReviewBuckets,{P1_UNCLASSIFIED_REVIEW:1}));
for(const [p,k] of [['src/security/session.js','P0_SECURITY_RUNTIME_DATA'],['src/ai/model.js','P1_AI_AGENTS_SIMULATION'],['src/financing/loan.js','P1_REAL_ESTATE_FINANCIAL'],['src/components/A.jsx','P1_OTHER_APPLICATION_SOURCE'],['tests/x.js','P1_TESTS_TOOLS_CI'],['docs/notes.md','P2_DOCUMENTATION_REVIEW'],['public/logo.svg','P2_ASSETS_GENERATED_REVIEW'],['package.json','P1_UNCLASSIFIED_REVIEW']]){
 check(()=>assert.equal(reviewBucket(p),k));
}
const partition=triageLegacyPaths(current,[{path:'src/security/session.js',blobVariations:[c]},{path:'docs/notes.md',blobVariations:[d]}],register);
check(()=>assert.equal(Object.values(partition.summary.unregisteredReviewBuckets).reduce((x,y)=>x+y,0),partition.summary.unregisteredCandidatePaths));
check(()=>assert.ok(!JSON.stringify(partition.summary).includes('session.js')));
console.log('LEGACY_PATH_TRIAGE=PASS checks='+checks+' functionalParity=NOT_PROVEN');
