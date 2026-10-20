const failure=code=>Object.assign(new Error(code),{code});
const MAX_PIXELS=6000000;
function imageDimensions(bytes) {
  if(bytes.length>=24&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)) {
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    return {width:view.getUint32(16),height:view.getUint32(20)};
  }
  if(bytes[0]===255&&bytes[1]===216){
    let i=2;
    while(i+9<bytes.length&&i<1024*1024){
      if(bytes[i++]!==255)throw failure('OCR_IMAGE_INVALID');
      while(bytes[i]===255)i++;
      const marker=bytes[i++];if(marker===217||marker===218)break;
      if(marker===1||(marker>=208&&marker<=215))continue;
      const size=bytes[i]*256+bytes[i+1];
      if(size<2||i+size>bytes.length)throw failure('OCR_IMAGE_INVALID');
      if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker))return {height:bytes[i+3]*256+bytes[i+4],width:bytes[i+5]*256+bytes[i+6]};
      i+=size;
    }
  }
  throw failure('OCR_IMAGE_INVALID');
}
function boundedDimensions({width,height}) {
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>MAX_PIXELS)throw failure('OCR_LIMIT_EXCEEDED');
}
export async function renderOcrPage(bytes,{format,page,signal,loadPdfLibrary}={}) {
  let task,renderTask,bitmap;
  const canvas=document.createElement('canvas');
  const abort=()=>{renderTask?.cancel();void task?.destroy()?.catch(()=>{});};
  signal?.addEventListener('abort',abort,{once:true});
  try{
    if(signal?.aborted)throw failure('OCR_ABORTED');
    if(format==='PDF'){
      if(![37,80,68,70,45].every((v,i)=>bytes[i]===v))throw failure('OCR_IMAGE_INVALID');
      const pdfjs=await loadPdfLibrary();
      if(signal?.aborted)throw failure('OCR_ABORTED');
      task=pdfjs.getDocument({data:bytes.slice(),isEvalSupported:false,useWorkerFetch:false,useWasm:false,
        disableFontFace:true,useSystemFonts:false,stopAtErrors:true,enableXfa:false,disableRange:true,
        disableStream:true,disableAutoFetch:true,maxImageSize:20000000,verbosity:0});
      const pdf=await task.promise;
      if(pdf.numPages>200)throw failure('OCR_LIMIT_EXCEEDED');
      if(page>pdf.numPages)throw failure('OCR_PAGE_INVALID');
      const selected=await pdf.getPage(page),natural=selected.getViewport({scale:1});
      const scale=Math.min(2.25,Math.sqrt(MAX_PIXELS/(natural.width*natural.height)),3600/Math.max(natural.width,natural.height));
      const viewport=selected.getViewport({scale});
      canvas.width=Math.floor(viewport.width);canvas.height=Math.floor(viewport.height);boundedDimensions(canvas);
      renderTask=selected.render({canvasContext:canvas.getContext('2d'),viewport,background:'rgb(255,255,255)'});
      await renderTask.promise;selected.cleanup();
    }else{
      boundedDimensions(imageDimensions(bytes));
      bitmap=await createImageBitmap(new Blob([bytes]));boundedDimensions(bitmap);
      canvas.width=bitmap.width;canvas.height=bitmap.height;
      const context=canvas.getContext('2d');context.fillStyle='white';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0);
    }
    if(signal?.aborted)throw failure('OCR_ABORTED');
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(failure('OCR_IMAGE_INVALID')),'image/png'));
    const image=new Uint8Array(await blob.arrayBuffer());
    if(signal?.aborted)throw failure('OCR_ABORTED');
    return {width:canvas.width,height:canvas.height,image,previewUrl:canvas.toDataURL('image/png')};
  }catch(error){
    if(signal?.aborted)throw failure('OCR_ABORTED');
    if(error.code?.startsWith('OCR_'))throw error;
    if(error.name==='PasswordException')throw failure('PDF_PASSWORD_REQUIRED');
    throw failure('OCR_IMAGE_INVALID');
  }finally{
    signal?.removeEventListener('abort',abort);bitmap?.close();
    void task?.destroy()?.catch(()=>{});canvas.width=canvas.height=0;
  }
}
export {imageDimensions};
