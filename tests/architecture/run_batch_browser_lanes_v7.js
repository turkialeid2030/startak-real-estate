'use strict';
const assert=require('node:assert/strict');
const {parseConcurrency,runPreviewBrowserLanes}=require('../../tools/batch-browser-lanes');
const IDS=['cross-browser','ocr-browser','document-tables-browser'];
(async()=>{
 let checks=0;
 function eq(a,b){assert.deepEqual(a,b);checks++;}
 eq(parseConcurrency(),2);eq(parseConcurrency('1'),1);eq(parseConcurrency('2'),2);
 for(const v of ['0','3','02','',2,null]){assert.throws(()=>parseConcurrency(v),/CONCURRENCY_INVALID/);checks++;}
 for(const concurrency of [1,2]){
  let active=0,peak=0,seen=[],ends=[];
  let releaseCross;
  const barrier=new Promise(r=>{releaseCross=r;});
  const rows=await runPreviewBrowserLanes(async(id,file)=>{
   active++;peak=Math.max(peak,active);seen.push(id);
   assert.ok(file.endsWith('.js'));checks++;
   if(concurrency===2&&id==='cross-browser')await barrier;
   if(id==='ocr-browser')releaseCross();
   await Promise.resolve();
   ends.push(id);active--;
   if(id==='ocr-browser')throw Error('synthetic failure');
   return {id,status:'PASS'};
  },concurrency);
  eq(rows.map(r=>r.id),IDS);eq(rows.map(r=>r.status),['PASS','FAIL','PASS']);
  eq(seen.length,3);eq(new Set(seen).size,3);eq(peak,concurrency);
  eq(active,0);eq(ends.indexOf('ocr-browser')<ends.indexOf('document-tables-browser'),true);
 }
 const invalid=await runPreviewBrowserLanes(async id=>({id:'wrong-'+id,status:'PASS'}),2);
 eq(invalid.map(r=>r.status),['FAIL','FAIL','FAIL']);
 await assert.rejects(()=>runPreviewBrowserLanes(()=>{},3),/LANES_INVALID/);checks++;
 console.log('V7_BATCH_BROWSER_LANES=PASS checks='+checks);
})().catch(e=>{console.error(e);process.exitCode=1;});
