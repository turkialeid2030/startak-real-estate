'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {execFileSync}=require('node:child_process'),{pathToFileURL}=require('node:url');
let checks=0;const ok=v=>{assert.ok(v);checks++;};
(async()=>{
 const {verifyProductionTarget}=await import(pathToFileURL(path.resolve(__dirname,'../../tools/verify-production-target.mjs')).href);
 const sha='a'.repeat(40),repo='synthetic-owner/synthetic-repository';
 assert.equal(verifyProductionTarget({repository:repo,expectedSha:sha,readRemote:()=>sha+'\trefs/heads/main\n'}).observedSha,sha);checks++;
 for(const [output,code]of [['b'.repeat(40)+'\trefs/heads/main','PRODUCTION_MAIN_MOVED'],[sha+'\trefs/heads/other','PRODUCTION_MAIN_RESPONSE_INVALID'],['','PRODUCTION_MAIN_RESPONSE_INVALID'],[sha+'\trefs/heads/main\n'+sha+'\trefs/heads/main','PRODUCTION_MAIN_RESPONSE_INVALID']]){assert.throws(()=>verifyProductionTarget({repository:repo,expectedSha:sha,readRemote:()=>output}),e=>e.message===code);checks++;}
 for(const repository of ['https://github.com/owner/repo','owner/repo/extra','owner/..','owner/repo;echo unsafe']){assert.throws(()=>verifyProductionTarget({repository,expectedSha:sha,readRemote:()=>{throw Error('must not reach git');}}),/PRODUCTION_REPOSITORY_REQUIRED/);checks++;}
 assert.throws(()=>verifyProductionTarget({repository:repo,expectedSha:'short',readRemote:()=>''}),/PRODUCTION_EXACT_SHA_REQUIRED/);checks++;
 assert.throws(()=>verifyProductionTarget({repository:repo,expectedSha:sha,readRemote:()=>{throw Error('network');}}),/PRODUCTION_MAIN_UNAVAILABLE/);checks++;
 const workflow=fs.readFileSync(path.resolve(__dirname,'../../.github/workflows/production-deployment-current-release.yml'),'utf8');
 ok(/    concurrency:\n      group: startak-real-estate-production-deployment\n      cancel-in-progress: false/.test(workflow));
 ok(workflow.includes(".result.source.config.production_deployments_enabled == false"));
 const block=workflow.match(/      - name: Deploy verified dist to Cloudflare Pages production[\s\S]*?        run: \|\n([\s\S]*?)(?=\n      - name:)/)?.[1];assert.ok(block);checks++;
 const script=block.split('\n').map(line=>line.startsWith('          ')?line.slice(10):line).join('\n');
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'startak-production-target-'));
 try{
  fs.writeFileSync(path.join(directory,'git'),'#!'+process.execPath+'\nconsole.log(process.env.STARTAK_SYNTHETIC_MAIN+"\\trefs/heads/main");\n',{mode:0o755});
  fs.writeFileSync(path.join(directory,'npx'),'#!'+process.execPath+'\nrequire("node:fs").writeFileSync(process.env.STARTAK_SYNTHETIC_LOG,JSON.stringify(process.argv.slice(2)));\n',{mode:0o755});
  for(const moved of [false,true]){
   const log=path.join(directory,moved?'moved.json':'matching.json');
   const env={...process.env,PATH:directory+path.delimiter+process.env.PATH,GITHUB_REPOSITORY:repo,EXPECTED_MAIN_SHA:sha,CF_PROJECT_NAME:'synthetic-project',STARTAK_SYNTHETIC_MAIN:moved?'b'.repeat(40):sha,STARTAK_SYNTHETIC_LOG:log};
   let error;try{execFileSync('bash',['-c',script],{cwd:path.resolve(__dirname,'../..'),env,stdio:'pipe'});}catch(e){error=e;}
   if(moved){ok(error&&error.status!==0);ok(!fs.existsSync(log));ok(error.stderr.toString().includes('PRODUCTION_MAIN_MOVED'));}
   else{assert.equal(error,undefined);checks++;assert.deepEqual(JSON.parse(fs.readFileSync(log)),['wrangler','pages','deploy','dist','--project-name','synthetic-project','--branch','main','--commit-hash',sha]);checks++;}
  }
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
 console.log('PRODUCTION_TARGET_SERIALIZATION=PASS checks='+checks);
})().catch(e=>{console.error(e);process.exitCode=1;});
