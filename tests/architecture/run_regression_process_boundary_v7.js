'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {REGRESSION_TIMEOUT_MS,runRegressionScript}=require('../../tools/regression-process-boundary');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'startak-regression-boundary-'));
let checks=0;
try{
 fs.writeFileSync(path.join(root,'ok.js'),"console.log('PASS_FIXTURE');");
 fs.writeFileSync(path.join(root,'fail.js'),"process.exit(7);");
 fs.writeFileSync(path.join(root,'hang.js'),"process.on('SIGTERM',()=>{});setInterval(()=>{},1000);");
 assert.equal(REGRESSION_TIMEOUT_MS,180000);checks++;
 assert.equal(String(runRegressionScript(root,'ok.js',5000)).trim(),'PASS_FIXTURE');checks++;
 assert.throws(()=>runRegressionScript(root,'fail.js',5000),error=>error.status===7);checks++;
 const started=Date.now();
 assert.throws(()=>runRegressionScript(root,'hang.js',500),error=>error.code==='ETIMEDOUT');checks++;
 assert.ok(Date.now()-started<10000);checks++;
 for(const invalid of [0,-1,NaN,Infinity,1.5,'500',180001]){assert.throws(()=>runRegressionScript(root,'ok.js',invalid),/REGRESSION_TIMEOUT_INVALID/);checks++;}
 assert.equal(String(runRegressionScript(root,'ok.js',5000)).trim(),'PASS_FIXTURE');checks++;
 console.log('V7_REGRESSION_PROCESS_BOUNDARY=PASS checks='+checks+' native_child_process=true');
}finally{fs.rmSync(root,{recursive:true,force:true});}
