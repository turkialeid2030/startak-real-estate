'use strict';
// Fixed independent lanes: shared preview is read-only, browser contexts and
// evidence filenames are distinct. OCR and document tables stay serial.
const TASKS=Object.freeze([
 Object.freeze(['cross-browser','run_audit_20261010_remaining_browser.js']),
 Object.freeze(['ocr-browser','run_audit_20261020_local_ocr_browser.js']),
 Object.freeze(['document-tables-browser','run_audit_20261021_document_tables_browser.js'])
]);
function parseConcurrency(value='2'){
 if(value!=='1'&&value!=='2')throw TypeError('BATCH_BROWSER_CONCURRENCY_INVALID');
 return Number(value);
}
async function runPreviewBrowserLanes(run,concurrency=2){
 if(typeof run!=='function'||![1,2].includes(concurrency))throw TypeError('BATCH_BROWSER_LANES_INVALID');
 const results=new Map();
 async function stage([id,file]){
  try{
   const r=await run(id,file);
   if(!r||r.id!==id||!['PASS','FAIL'].includes(r.status))throw Error('INVALID_STAGE_RESULT');
   results.set(id,r);
  }catch{results.set(id,{id,status:'FAIL',reason:'BROWSER_STAGE_EXECUTION_FAILED'});}
 }
 if(concurrency===1){for(const task of TASKS)await stage(task);}
 else await Promise.all([stage(TASKS[0]),(async()=>{for(const task of TASKS.slice(1))await stage(task);})()]);
 return TASKS.map(([id])=>results.get(id));
}
module.exports={parseConcurrency,runPreviewBrowserLanes};
