'use strict';
// Local-only HTML download. Callers must enforce their export governance first.
// Keep the anchor and object URL alive through asynchronous browser resolution.
const DOWNLOAD_GRACE_MS=60000;
function dispatchLocalHtmlDownload(html,filename,env=globalThis){
 if(typeof html!=='string'||!html||typeof filename!=='string'||!/^[a-zA-Z0-9_-]+\.html$/.test(filename))throw new TypeError('LOCAL_HTML_DOWNLOAD_INVALID');
 const {document,URL,Blob}=env;
 const url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));
 let anchor;
 let released=false;
 function release(){
  if(released)return;
  released=true;
  try{anchor?.remove();}finally{URL.revokeObjectURL(url);}
 }
 try{
  anchor=document.createElement('a');
  anchor.href=url;anchor.download=filename;anchor.hidden=true;
  document.body.appendChild(anchor);
  anchor.click();
  env.setTimeout(release,DOWNLOAD_GRACE_MS);
 }catch(error){release();throw error;}
 // Dispatch is not evidence that a browser completed or saved a download.
 return Object.freeze({dispatched:true,downloadConfirmed:false});
}
module.exports={dispatchLocalHtmlDownload,DOWNLOAD_GRACE_MS};
