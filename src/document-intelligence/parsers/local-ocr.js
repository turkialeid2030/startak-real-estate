'use strict';
const {createParserResult,createParsedAtom,PARSER_STATUS,PARSED_ATOM_KIND}=require('./contracts');
const failure=code=>Object.assign(new Error(code),{code});
const MAX_PIXELS=6000000,MAX_CHARACTERS=32000,MAX_LINES=500;
function makeOcrResult(record,raster,data,page,layout='AUTO') {
  if(!['AUTO','SINGLE_BLOCK'].includes(layout))throw failure('OCR_LAYOUT_INVALID');
  if(!data||typeof data.text!=='string'||data.text.length>MAX_CHARACTERS
    ||JSON.stringify(data).length>4000000)throw failure('OCR_LIMIT_EXCEEDED');
  const document={documentId:record.documentId,caseId:record.caseId};
  const adapterId='LOCAL_OCR_PAGE_V1';
  const common={document,adapterId,format:record.result.format,
    warnings:['OCR_UNVERIFIED_REVIEW_REQUIRED','OCR_SELECTED_PAGE_ONLY','OCR_NUMBERS_AND_LAYOUT_REVIEW_REQUIRED']};
  if(!data.text.trim())return createParserResult({...common,status:PARSER_STATUS.UNSUPPORTED,reason:'OCR_NO_TEXT'});
  if(!Array.isArray(data.blocks)||data.blocks.length>MAX_LINES)throw failure('OCR_RESULT_INVALID');
  const lines=[];let characters=0;
  for(const block of data.blocks) {
    if(!Array.isArray(block.paragraphs)||block.paragraphs.length>MAX_LINES)throw failure('OCR_RESULT_INVALID');
    for(const paragraph of block.paragraphs){
      if(!Array.isArray(paragraph.lines)||paragraph.lines.length>MAX_LINES)throw failure('OCR_RESULT_INVALID');
      for(const line of paragraph.lines){
        if(typeof line.text!=='string')throw failure('OCR_RESULT_INVALID');
        const text=line.text.trim();if(!text)continue;
        characters+=text.length;
        if(characters>MAX_CHARACTERS||lines.length>=MAX_LINES)throw failure('OCR_LIMIT_EXCEEDED');
        const box=line.bbox;
        if(!box||!['x0','y0','x1','y1'].every(k=>Number.isInteger(box[k]))
          ||box.x0<0||box.y0<0||box.x1<=box.x0||box.y1<=box.y0||box.x1>raster.width||box.y1>raster.height
          ||!Number.isFinite(line.confidence)||line.confidence<0||line.confidence>100)throw failure('OCR_RESULT_INVALID');
        lines.push({text,box,confidence:line.confidence});
      }
    }
  }
  if(!lines.length)throw failure('OCR_RESULT_INVALID');
  return createParserResult({...common,status:PARSER_STATUS.PARSED,atoms:lines.map((line,index)=>createParsedAtom({
    atomId:`${record.documentId}:ocr:page:${page}:line:${index+1}`,document,adapterId,kind:PARSED_ATOM_KIND.TEXT,
    rawValue:line.text,valueType:'STRING',location:{kind:'PAGE',page,line:index+1,pixelBounds:line.box,rasterWidth:raster.width,rasterHeight:raster.height},
    metadata:{extraction:'LOCAL_OCR_UNVERIFIED',engineVersion:'TESSERACT_JS_7.0.0',languages:['ara','eng'],layout,
      sourceDigestSha256:record.digest,pixelBounds:line.box,rasterWidth:raster.width,rasterHeight:raster.height,
      engineConfidence:line.confidence,confidenceIsAccuracy:false,fullDocumentCovered:false,financialInputEligible:false},
  }))});
}
async function runLocalOcr({record,content,page=1,render,recognize,signal,onProgress,timeoutMs=60000,layout='AUTO'}) {
  if(!['AUTO','SINGLE_BLOCK'].includes(layout))throw failure('OCR_LAYOUT_INVALID');
  if(!record||!/^[a-f0-9]{64}$/.test(record.digest)||record.documentId!==`local-sha256:${record.digest}`
    ||!record.caseId||!['PDF','IMAGE'].includes(record.result?.format))throw failure('OCR_SOURCE_INVALID');
  if(!Number.isInteger(page)||page<1||page>200||(record.result.format==='IMAGE'&&page!==1))throw failure('OCR_PAGE_INVALID');
  const bytes=content instanceof ArrayBuffer?new Uint8Array(content):ArrayBuffer.isView(content)?new Uint8Array(content.buffer,content.byteOffset,content.byteLength):null;
  if(!bytes||bytes.byteLength>40*1024*1024)throw failure('OCR_LIMIT_EXCEEDED');
  if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000)throw failure('OCR_LIMIT_EXCEEDED');
  if(signal?.aborted)throw failure('OCR_ABORTED');
  const controller=new AbortController();let timer,abort;
  const stopped=new Promise((_,reject)=>{
    abort=()=>{reject(failure('OCR_ABORTED'));controller.abort();};
    signal?.addEventListener('abort',abort,{once:true});
    timer=setTimeout(()=>{reject(failure('OCR_TIMEOUT'));controller.abort();},timeoutMs);
  });
  try {
    return await Promise.race([(async()=>{
      if(!globalThis.crypto?.subtle)throw failure('OCR_SOURCE_INVALID');
      const digest=[...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
      if(controller.signal.aborted)throw failure('OCR_ABORTED');
      if(digest!==record.digest)throw failure('OCR_SOURCE_INVALID');
      const raster=await render(bytes,{format:record.result.format,page,signal:controller.signal});
      if(controller.signal.aborted)throw failure('OCR_ABORTED');
      if(!Number.isInteger(raster.width)||!Number.isInteger(raster.height)||raster.width<1||raster.height<1
        ||raster.width*raster.height>MAX_PIXELS||!(raster.image instanceof Uint8Array)||raster.image.byteLength>24*1024*1024)throw failure('OCR_LIMIT_EXCEEDED');
      if(typeof raster.previewUrl!=='string'||!raster.previewUrl.startsWith('data:image/png;base64,')||raster.previewUrl.length>32*1024*1024)throw failure('OCR_RESULT_INVALID');
      const data=await recognize(raster.image,{signal:controller.signal,onProgress,timeoutMs,layout});
      if(controller.signal.aborted)throw failure('OCR_ABORTED');
      return {record:Object.freeze({...record,result:makeOcrResult(record,raster,data,page,layout)}),previewUrl:raster.previewUrl};
    })(),stopped]);
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);controller.abort();}
}
module.exports={MAX_PIXELS,MAX_CHARACTERS,MAX_LINES,makeOcrResult,runLocalOcr};
