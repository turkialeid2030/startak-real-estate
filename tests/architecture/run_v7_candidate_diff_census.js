'use strict';
const assert=require('node:assert/strict');
const {parseNameStatus,summarize,census}=require('../../tools/v7-candidate-diff-census');
const {mkdtempSync,writeFileSync,rmSync}=require('node:fs'),{tmpdir}=require('node:os'),{join}=require('node:path'),{execFileSync}=require('node:child_process');
const a='a'.repeat(40),b='b'.repeat(40);
const raw=Buffer.from('A\0src/اختبار.js\0D\0tests/old.js\0M\0docs/new\nline.md\0T\0.github/workflows/x.yml\0');
const summary=summarize(raw,a,b);
assert.equal(summary.changedPaths,4);assert.deepEqual(summary.byStatus,{A:1,D:1,M:1,T:1});assert.equal(summary.byCategory.source,1);assert.equal(summary.releaseAuthorized,false);
assert.equal(summarize(Buffer.alloc(0),a,a).changedPaths,0);
assert.equal(summarize(Buffer.from(Array.from({length:501},(_,i)=>'A\0src/file-'+i+'\0').join('')),a,b).changedPaths,501);
for(const bad of ['A\0file','A\0','R100\0old\0new\0','A\0../x\0','A\0same\0M\0same\0'])assert.throws(()=>parseNameStatus(Buffer.from(bad)));
assert.throws(()=>summarize(raw,'main',b));
const dir=mkdtempSync(join(tmpdir(),'startak-diff-test-'));
try{
 const git=(...args)=>execFileSync('git',args,{cwd:dir,stdio:['ignore','pipe','pipe']}).toString().trim();
 git('init','-q');git('config','user.name','Synthetic Test');git('config','user.email','synthetic@example.invalid');git('config','commit.gpgsign','false');git('config','core.autocrlf','false');
 writeFileSync(join(dir,'a.txt'),'one\n');git('add','a.txt');git('commit','-qm','baseline');const base=git('rev-parse','HEAD');
 writeFileSync(join(dir,'a.txt'),'two\n');writeFileSync(join(dir,'b.txt'),'new\n');git('add','.');git('commit','-qm','candidate');const head=git('rev-parse','HEAD');
 const result=census(base,head,dir);assert.equal(result.changedPaths,2);assert.equal(result.byStatus.A,1);assert.equal(result.byStatus.M,1);assert.equal(result.ancestryVerified,false);
}finally{rmSync(dir,{recursive:true,force:true});}
console.log('V7_CANDIDATE_DIFF_CENSUS_CONTRACT=PASS synthetic_git=true release_authorized=false');
