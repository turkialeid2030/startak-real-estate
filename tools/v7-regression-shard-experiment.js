'use strict';
// Diagnostic candidate only. Never substitute for release:verify or authorize deployment.
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {performance}=require('node:perf_hooks');
const {discoverRegressionTests}=require('./regression-test-discovery');
const {runRegressionScript}=require('./regression-process-boundary');
const ROOT=path.resolve(__dirname,'..');
const SHARDS=4;
const normalize=file=>file.split(path.sep).join('/');
function manifest(root=ROOT){return discoverRegressionTests(root).map(normalize);}
function partition(files,index){
 if(!Number.isInteger(index)||index<0||index>=SHARDS)throw Error('INVALID_SHARD');
 return files.filter((_,i)=>i%SHARDS===index);
}
function context(){
 const source=String(process.env.STARTAK_SOURCE_COMMIT||'');
 const run=String(process.env.GITHUB_RUN_ID||'');
 const attempt=String(process.env.GITHUB_RUN_ATTEMPT||'');
 if(!/^[a-f0-9]{40}$/.test(source)||!/^\d+$/.test(run)||!/^\d+$/.test(attempt))throw Error('MISSING_EXACT_RUN_CONTEXT');
 if(execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim()!==source)throw Error('SOURCE_MISMATCH');
 return {source,run,attempt};
}
function phase(files){
 const started=performance.now();
 const records=files.map(file=>{
   const t=performance.now();let status='PASS';
   try{runRegressionScript(ROOT,file);}catch(e){status=e?.code==='ETIMEDOUT'?'TIMEOUT':'FAIL';}
   return {file,status,elapsedMs:Math.round(performance.now()-t)};
 });
 return {records,elapsedMs:Math.round(performance.now()-started)};
}
function validate(records,files,ctx){
 if(!Array.isArray(records)||records.length!==SHARDS)throw Error('SHARD_COUNT_MISMATCH');
 const indices=new Set();
 for(const r of records){
   if(!r||r.schemaVersion!==1||r.source!==ctx.source||r.run!==ctx.run||r.attempt!==ctx.attempt)throw Error('SHARD_CONTEXT_MISMATCH');
   const expected=partition(files,r.index);
   if(indices.has(r.index))throw Error('DUPLICATE_SHARD');indices.add(r.index);
   if(r.build!=='PASS')throw Error('SHARD_BUILD_FAILED');
   for(const stage of ['pre','post']){
     const p=r[stage];
     if(!p||!Number.isSafeInteger(p.elapsedMs)||p.elapsedMs<0||!Array.isArray(p.records)||p.records.length!==expected.length)throw Error('SHARD_PHASE_INCOMPLETE');
     p.records.forEach((entry,i)=>{
       if(!entry||entry.file!==expected[i]||entry.status!=='PASS'||!Number.isSafeInteger(entry.elapsedMs)||entry.elapsedMs<0)throw Error('SHARD_TEST_EVIDENCE_INVALID');
     });
   }
 }
 return {schemaVersion:1,...ctx,shards:SHARDS,tests:files.length,executions:files.length*2,diagnosticOnly:true,productionAuthorized:false,serialGateStillRequired:true};
}
function run(index,out){
 const ctx=context(),files=partition(manifest(),index);
 const pre=phase(files);
 let build='PASS';
 try{fs.rmSync(path.join(ROOT,'dist'),{recursive:true,force:true});execFileSync('npm',['run','build'],{cwd:ROOT,stdio:'pipe',timeout:180000});if(!fs.existsSync(path.join(ROOT,'dist','assets')))throw Error('BUILD_OUTPUT_MISSING');}catch{build='FAIL';}
 const post=build==='PASS'?phase(files):null;
 const record={schemaVersion:1,...ctx,index,build,pre,post};
 fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(record));
 const failures=[...pre.records,...(post?.records||[])].filter(x=>x.status!=='PASS');
 console.log('REGRESSION_SHARD_RESULT '+JSON.stringify({index,tests:files.length,preMs:pre.elapsedMs,postMs:post?.elapsedMs??null,build,failures}));
 if(build!=='PASS'||failures.length)process.exitCode=1;
}
function join(dir,out){
 const ctx=context();
 const records=Array.from({length:SHARDS},(_,i)=>JSON.parse(fs.readFileSync(path.join(dir,'regression-shard-'+ctx.run+'-'+ctx.attempt+'-'+i,'evidence.json'),'utf8')));
 const result=validate(records,manifest(),ctx);
 fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result));
 console.log('REGRESSION_SHARD_DIAGNOSTIC=PASS '+JSON.stringify(result));
}
if(require.main===module){
 const [mode,a,b]=process.argv.slice(2);
 if(mode==='run')run(Number(a),b);
 else if(mode==='join')join(a,b);
 else throw Error('INVALID_MODE');
}
module.exports={partition,validate,SHARDS};
