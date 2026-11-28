'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
(async()=>{
 const {command}=await import('../../tools/verify-all-stages.mjs');
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'startak-batch-timeout-'));
 let checks=0;
 const run=(id,script,ms=5000)=>command(id,process.execPath,['-e',script],dir,ms);
 try{
  const ok=await run('ok',"console.log('OK')");
  assert.equal(ok.status,'PASS');checks++;
  assert.equal(ok.timedOut,false);checks++;
  assert.equal((await fs.readFile(path.join(dir,ok.logFile),'utf8')).trim(),'OK');checks++;
  const fail=await run('fail','process.exit(7)');
  assert.equal(fail.status,'FAIL');checks++;
  assert.equal(fail.exitCode,7);checks++;
  const started=Date.now();
  const timeout=await run('hang',"process.on('SIGTERM',()=>{});setInterval(()=>{},1000)",500);
  assert.equal(timeout.status,'FAIL');checks++;
  assert.equal(timeout.timedOut,true);checks++;
  assert.ok(Date.now()-started<10000);checks++;
  const overflow=await run('overflow',"process.stdout.write(Buffer.alloc(5*1024*1024,120))");
  assert.equal(overflow.status,'FAIL');checks++;
  assert.equal(overflow.outputLimitExceeded,true);checks++;
  assert.ok((await fs.stat(path.join(dir,overflow.logFile))).size<=4*1024*1024);checks++;
  const missing=await command('missing',path.join(dir,'nonexistent-command'),[],dir,5000);
  assert.equal(missing.status,'FAIL');checks++;
  for(const ms of [0,-1,NaN,Infinity,1.5,'500',1200001]){await assert.rejects(()=>run('invalid','',ms),/BATCH_STAGE_TIMEOUT_INVALID/);checks++;}
  assert.equal((await run('after','process.exit(0)')).status,'PASS');checks++;
  console.log('V7_BATCH_STAGE_TIMEOUT=PASS checks='+checks+' native_child_process=true');
 }finally{await fs.rm(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
