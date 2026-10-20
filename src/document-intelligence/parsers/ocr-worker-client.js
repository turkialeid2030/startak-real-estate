'use strict';
const failure=code=>Object.assign(new Error(code),{code});
// Own the pinned v7 worker from its creation, including model initialization.
// This avoids leaving an initializing worker alive after cancellation/deadline.
async function recognizeWithOwnedWorker({spawn,paths,image,signal,onProgress,timeoutMs=60000}) {
  if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000)throw failure('OCR_LIMIT_EXCEEDED');
  if(signal?.aborted)throw failure('OCR_ABORTED');
  let worker,timer,pending,sequence=0,closed=false;
  const stop=error=>{if(closed)return;closed=true;pending?.reject(error);pending=null;try{const end=worker?.terminate();end?.catch?.(()=>{});}catch(_){};};
  const abort=()=>stop(failure('OCR_ABORTED'));
  try {
    worker=spawn();
    const message=event=>{
      const data=event.data;
      if(closed||!pending||data?.workerId!=='STARTAK_LOCAL_OCR_V7'||data.jobId!==pending.id||data.action!==pending.action)return;
      if(data.status==='progress'){try{if(typeof onProgress==='function')onProgress(data.action);}catch(_){}return;}
      const current=pending;pending=null;
      if(data.status==='resolve')current.resolve(data.data);
      else {current.reject(failure('OCR_ENGINE_FAILED'));stop(failure('OCR_ENGINE_FAILED'));}
    };
    worker.addEventListener('message',message);
    worker.addEventListener('error',()=>stop(failure('OCR_ENGINE_FAILED')));
    signal?.addEventListener('abort',abort,{once:true});
    if(signal?.aborted)abort();
    timer=setTimeout(()=>stop(failure('OCR_TIMEOUT')),timeoutMs);
    const job=(action,payload)=>new Promise((resolve,reject)=>{
      if(closed)return reject(failure(signal?.aborted?'OCR_ABORTED':'OCR_ENGINE_FAILED'));
      const id=String(++sequence);pending={id,action,resolve,reject};
      try{worker.postMessage({workerId:'STARTAK_LOCAL_OCR_V7',jobId:id,action,payload});}
      catch(_){stop(failure('OCR_ENGINE_FAILED'));}
    });
    await job('load',{options:{lstmOnly:true,corePath:paths.corePath,logging:false}});
    await job('loadLanguage',{langs:['ara','eng'],options:{langPath:paths.langPath,gzip:true,lstmOnly:true,cacheMethod:'none'}});
    await job('initialize',{langs:['ara','eng'],oem:1,config:{}});
    await job('setParameters',{params:{tessedit_pageseg_mode:'3',user_defined_dpi:'162'}});
    return await job('recognize',{image,options:{},output:{text:true,blocks:true}});
  }finally{
    clearTimeout(timer);signal?.removeEventListener('abort',abort);stop(failure('OCR_CLOSED'));
  }
}
function recognizeBrowserRaster(image,{assetBase,signal,onProgress,timeoutMs}={}) {
  const origin=globalThis.location?.origin;
  if(typeof origin!=='string'||!/^\/assets\/ocr\/[a-f0-9]{20}$/.test(assetBase||''))throw failure('OCR_ASSETS_UNAVAILABLE');
  const base=new URL(assetBase+'/',origin).href;
  return recognizeWithOwnedWorker({image,signal,onProgress,timeoutMs,
    paths:{corePath:base,langPath:base},spawn:()=>new Worker(base+'worker.min.js')});
}
module.exports={recognizeWithOwnedWorker,recognizeBrowserRaster};
