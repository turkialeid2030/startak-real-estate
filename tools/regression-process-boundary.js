'use strict';
// Bound each trusted regression script without skipping any discovered file.
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const REGRESSION_TIMEOUT_MS=180000;
function runRegressionScript(root,file,timeoutMs=REGRESSION_TIMEOUT_MS){
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>REGRESSION_TIMEOUT_MS)throw TypeError('REGRESSION_TIMEOUT_INVALID');
 return execFileSync(process.execPath,[path.join(root,file)],{cwd:root,stdio:'pipe',timeout:timeoutMs,killSignal:'SIGKILL'});
}
module.exports={REGRESSION_TIMEOUT_MS,runRegressionScript};
