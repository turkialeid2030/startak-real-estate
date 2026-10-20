'use strict';
const assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const {runLocalOcr,makeOcrResult}=require('../../src/document-intelligence/parsers/local-ocr');
const {recognizeWithOwnedWorker,recognizeBrowserRaster}=require('../../src/document-intelligence/parsers/ocr-worker-client');
const {parseDocument,mapParsedAtomToEvidenceFact}=require('../../src/document-intelligence/parsers');
const {ingestDocument}=require('../../src/document-intelligence');
const {pngTextFixture}=require('../fixtures/local-ocr-page');
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
const bytes=pngTextFixture(),digest=createHash('sha256').update(bytes).digest('hex');
const record={fileName:'synthetic.png',documentId:'local-sha256:'+digest,caseId:'CASE-SYNTHETIC-OCR',digest,result:{format:'IMAGE'}};
const data={text:'RENT 1234.50 SAR\n',blocks:[{paragraphs:[{lines:[{text:'RENT 1234.50 SAR\n',confidence:87,bbox:{x0:1,y0:2,x1:400,y1:60}}]}]}]};
const raster={width:1000,height:250,image:bytes,previewUrl:'data:image/png;base64,'+bytes.toString('base64')};
const bad=async(fn,code)=>{await assert.rejects(fn,error=>error.code===code);checks++;};
class FakeWorker{
 constructor(mode='resolve'){this.listeners={};this.terminated=0;this.packets=[];this.mode=mode;}
 addEventListener(type,fn){this.listeners[type]=fn;}
 postMessage(p){this.packets.push(p);if(this.mode==='hang')return;
  queueMicrotask(()=>this.listeners.message({data:{...p,status:this.mode==='reject'?'reject':'resolve',data:p.action==='recognize'?data:{}}}));}
 terminate(){this.terminated++;}
}
(async()=>{
 for(const fileName of ['synthetic.png','synthetic.JPG','synthetic.jpeg']){
  const result=await parseDocument({document:{...record,fileName},content:bytes});eq(result.format,'IMAGE');eq(result.status,'UNSUPPORTED');eq(result.reason,'IMAGE_OCR_NOT_RUN');
 }
 const result=await runLocalOcr({record,content:bytes,render:async()=>raster,recognize:async()=>data});
 eq(result.record.result.status,'PARSED');eq(result.record.result.atoms[0].rawValue,'RENT 1234.50 SAR');
 const atom=result.record.result.atoms[0];eq(atom.location,{kind:'PAGE',page:1,line:1,pixelBounds:{x0:1,y0:2,x1:400,y1:60},rasterWidth:1000,rasterHeight:250});eq(atom.metadata.sourceDigestSha256,digest);
 eq(atom.metadata.engineConfidence,87);eq(atom.metadata.financialInputEligible,false);eq(atom.metadata.confidenceIsAccuracy,false);eq(atom.metadata.fullDocumentCovered,false);
 eq(atom.metadata.layout,'AUTO');
 let selectedLayout;const blockResult=await runLocalOcr({record,content:bytes,layout:'SINGLE_BLOCK',render:async()=>raster,recognize:async(_,{layout})=>{selectedLayout=layout;return data;}});
 eq(selectedLayout,'SINGLE_BLOCK');eq(blockResult.record.result.atoms[0].metadata.layout,'SINGLE_BLOCK');
 await bad(()=>runLocalOcr({record,content:bytes,layout:'INVALID'}),'OCR_LAYOUT_INVALID');
 await bad(()=>recognizeWithOwnedWorker({layout:'INVALID'}),'OCR_LAYOUT_INVALID');
 const document=await ingestDocument({documentId:record.documentId,caseId:record.caseId,fileName:'synthetic.png',mimeType:'image/png',content:bytes,receivedAt:'2026-10-20T00:00:00Z'});
 const fact=mapParsedAtomToEvidenceFact({atom,document,factId:'FACT-OCR',semanticKey:'text',capturedAt:'2026-10-20T00:00:00Z'});
 eq(fact.truthStatus,'EXTRACTED_EVIDENCE');eq(fact.sourceLocator.page,1);eq(fact.extraction.confidence,.87);eq(fact.sourceLocator.pixelBounds,atom.metadata.pixelBounds);
 assert.throws(()=>mapParsedAtomToEvidenceFact({atom:{...atom,metadata:{...atom.metadata,sourceDigestSha256:'b'.repeat(64)}},document,factId:'BAD-OCR',semanticKey:'text',capturedAt:'2026-10-20T00:00:00Z'}),/OCR_SOURCE_OR_CONFIDENCE_INVALID/);checks++;
 eq(makeOcrResult(record,raster,{text:'',blocks:[]},1).reason,'OCR_NO_TEXT');
 assert.throws(()=>makeOcrResult(record,raster,{...data,text:'x'.repeat(32001)},1),/OCR_LIMIT_EXCEEDED/);checks++;
 assert.throws(()=>makeOcrResult(record,raster,{...data,blocks:Array(501).fill({})},1),/OCR_RESULT_INVALID/);checks++;
 for(const patch of [{confidence:NaN},{confidence:-1},{confidence:101},{bbox:{x0:-1,y0:2,x1:3,y1:4}},{bbox:{x0:1,y0:2,x1:1001,y1:4}},{bbox:{x0:1,y0:2,x1:3,y1:251}},{bbox:{x0:2,y0:2,x1:2,y1:4}}]){
  assert.throws(()=>makeOcrResult(record,raster,{...data,blocks:[{paragraphs:[{lines:[{...data.blocks[0].paragraphs[0].lines[0],...patch}]}]}]},1),/OCR_RESULT_INVALID/);checks++;
 }
 for(const page of [0,1.5,201,'1',2])await bad(()=>runLocalOcr({record,content:bytes,page}),'OCR_PAGE_INVALID');
 await bad(()=>runLocalOcr({record:{...record,digest:'a'.repeat(64)},content:bytes}),'OCR_SOURCE_INVALID');
 await bad(()=>runLocalOcr({record,content:Uint8Array.of(1,2,3),render:async()=>raster,recognize:async()=>data}),'OCR_SOURCE_INVALID');
 await bad(()=>runLocalOcr({record,content:new Uint8Array(40*1024*1024+1)}),'OCR_LIMIT_EXCEEDED');
 for(const patch of [{width:6000001,height:1},{height:0},{image:'https://external.invalid/image'},{previewUrl:'https://external.invalid/preview'}])
  await bad(()=>runLocalOcr({record,content:bytes,render:async()=>({...raster,...patch}),recognize:async()=>data}),patch.previewUrl?'OCR_RESULT_INVALID':'OCR_LIMIT_EXCEEDED');
 const aborted=new AbortController();aborted.abort();await bad(()=>runLocalOcr({record,content:bytes,signal:aborted.signal}),'OCR_ABORTED');
 let renderSignal;
 await bad(()=>runLocalOcr({record,content:bytes,timeoutMs:100,render:(_,{signal})=>{renderSignal=signal;return new Promise(()=>{});}}),'OCR_TIMEOUT');eq(renderSignal.aborted,true);
 let cancelledSignal;const cancel=new AbortController();const pending=runLocalOcr({record,content:bytes,signal:cancel.signal,render:(_,{signal})=>{cancelledSignal=signal;cancel.abort();return new Promise(()=>{});}});
 await bad(()=>pending,'OCR_ABORTED');eq(cancelledSignal.aborted,true);
 for(const mode of ['resolve','reject','hang']){
  const worker=new FakeWorker(mode),args={spawn:()=>worker,paths:{corePath:'/local',langPath:'/local'},image:bytes,timeoutMs:10};
  if(mode==='resolve'){eq(await recognizeWithOwnedWorker(args),data);eq(worker.packets.map(p=>p.action),['load','loadLanguage','initialize','setParameters','recognize']);eq(worker.packets[1].payload.options.cacheMethod,'none');eq(worker.packets[3].payload.params.tessedit_pageseg_mode,'3');}
  else await bad(()=>recognizeWithOwnedWorker(args),mode==='hang'?'OCR_TIMEOUT':'OCR_ENGINE_FAILED');
  eq(worker.terminated,1);
 }
 const blockWorker=new FakeWorker();await recognizeWithOwnedWorker({spawn:()=>blockWorker,paths:{},image:bytes,layout:'SINGLE_BLOCK'});eq(blockWorker.packets[3].payload.params.tessedit_pageseg_mode,'6');eq(blockWorker.terminated,1);
 const worker=new FakeWorker('hang'),controller=new AbortController();
 const work=recognizeWithOwnedWorker({spawn:()=>worker,paths:{},image:bytes,signal:controller.signal});controller.abort();await bad(()=>work,'OCR_ABORTED');eq(worker.terminated,1);
 assert.throws(()=>recognizeBrowserRaster(bytes,{assetBase:'https://external.invalid'}),/OCR_ASSETS_UNAVAILABLE/);checks++;
 const {imageDimensions}=await import('../../src/document-intelligence/parsers/ocr-page-renderer.mjs');eq(imageDimensions(bytes),{width:1000,height:250});
 for(const content of [Uint8Array.of(1,2,3),Uint8Array.of(255,216,0,0)]){assert.throws(()=>imageDimensions(content),/OCR_IMAGE_INVALID/);checks++;}
 const {localOcrAssets}=await import('../../tools/local-ocr-assets.mjs');const assets=localOcrAssets();
 eq(assets.files.some(f=>f.name==='tesseract-core-lstm.wasm.js'),true);eq(assets.files.some(f=>f.name==='tesseract-core-simd-lstm.wasm.js'),true);eq(assets.files.some(f=>f.name==='tesseract-core-relaxedsimd-lstm.wasm.js'),true);
 eq(assets.files.some(f=>f.name==='ara.traineddata.gz'),true);eq(assets.files.some(f=>f.name==='eng.traineddata.gz'),true);
 console.log(`LOCAL_OCR_CONTRACT=PASS checks=${checks}`);
})().catch(error=>{console.error(error);process.exitCode=1;});
