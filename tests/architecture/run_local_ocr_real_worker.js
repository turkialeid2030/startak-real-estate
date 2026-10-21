'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Worker}=require('node:worker_threads');
const {recognizeWithOwnedWorker}=require('../../src/document-intelligence/parsers/ocr-worker-client');
const {makeOcrResult}=require('../../src/document-intelligence/parsers/local-ocr');
const {pngTextFixture}=require('../fixtures/local-ocr-page');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'startak-ocr-test-'));let terminations=0;
 try{
  for(const lang of ['ara','eng'])fs.copyFileSync(path.join(path.dirname(require.resolve('@tesseract.js-data/'+lang+'/package.json')),'4.0.0_best_int',lang+'.traineddata.gz'),path.join(dir,lang+'.traineddata.gz'));
  const spawn=()=>{const worker=new Worker(require.resolve('tesseract.js/src/worker-script/node/index.js'));return {addEventListener:(type,fn)=>worker.on(type,type==='message'?data=>fn({data}):fn),postMessage:p=>worker.postMessage(p),terminate:()=>{terminations++;return worker.terminate();}};};
  const data=await recognizeWithOwnedWorker({spawn,paths:{corePath:'',langPath:dir},image:pngTextFixture()});
  assert(data.text.includes('1234.50'));assert(data.text.includes('SAR'));assert.equal(terminations,1);
  const result=makeOcrResult({digest:'a'.repeat(64),documentId:'local-sha256:'+'a'.repeat(64),caseId:'SYNTHETIC',result:{format:'IMAGE'}},{width:1000,height:250},data,1);
  assert.equal(result.status,'PARSED');assert(result.atoms.every(a=>a.metadata.financialInputEligible===false));
  assert(result.atoms.flatMap(a=>a.metadata.layoutFragments.fragments).some(f=>f.granularity==='WORD'&&f.text.includes('1234.50')));
  assert(result.atoms.every(a=>a.metadata.layoutFragments.width===1000&&a.metadata.layoutFragments.height===250));
  console.log('LOCAL_OCR_REAL_WORKER=PASS (pinned actual WASM/protocol, local Arabic+English models, exact synthetic decimal, geometry, terminated worker)');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
