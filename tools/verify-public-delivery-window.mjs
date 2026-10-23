import fs from 'node:fs/promises';
import {dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {verifyDeployedAssets} from './verify-deployed-assets.mjs';

// A sequence of INDEPENDENT observations; unlike retry-until-pass, one FAIL
// permanently fails the overall window even if every subsequent sample passes.
export async function observePublicDeliveryWindow({
  url,expectedSha,samples=3,pauseMs=5000,
  verify=verifyDeployedAssets,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))
}={}){
  if(!/^[a-f0-9]{40}$/.test(expectedSha||''))throw Error('PUBLIC_WINDOW_SOURCE_SHA_REQUIRED');
  if(!Number.isInteger(samples)||samples<2||samples>6)throw Error('PUBLIC_WINDOW_SAMPLE_COUNT_INVALID');
  if(!Number.isInteger(pauseMs)||pauseMs<0||pauseMs>30000)throw Error('PUBLIC_WINDOW_INTERVAL_INVALID');
  const checks=[],startedAt=new Date().toISOString();
  for(let index=0;index<samples;index++){
    if(index)await sleep(pauseMs);
    const sampleStartedAt=new Date().toISOString();
    try{
      const result=await verify({url,expectedSha});
      checks.push({
        sample:index+1,sampleStartedAt,status:result.status==='PASS'?'PASS':'FAIL',
        sourceCommit:result.expectedSourceCommit,
        // Only resource/check metadata and hashes; verifier NEVER records response bodies.
        assetResults:result.assets||[],
        entryResponseMetadata:result.entryResponseMetadata||null,
        entryHtmlSha256:result.entryHtmlSha256||null,
        manifestResponseMetadata:result.manifestResponseMetadata||null,
        missingResponseMetadata:result.missingResponseMetadata||null,
        missingAssetStatus:result.missingAssetStatus||'FAIL',
        missingAssetHttpStatus:result.missingAssetHttpStatus||null,
        automaticRetries:0,
      });
    }catch(error){
      const reasonCode=/^[A-Z][A-Z0-9_]{1,95}$/.test(error?.message||'')?error.message:'PUBLIC_WINDOW_OBSERVATION_ERROR';
      // The subordinate verifier explicitly minimises exception diagnostics.
      const observation=error?.observation||null;
      checks.push({sample:index+1,sampleStartedAt,status:'FAIL',reasonCode,
        observation,automaticRetries:0});
    }
  }
  const failed=checks.filter(x=>x.status!=='PASS');
  return {schemaVersion:1,status:failed.length?'FAIL':'PASS',expectedSourceCommit:expectedSha,
    startedAt,completedAt:new Date().toISOString(),sampleCount:checks.length,
    passedSamples:checks.length-failed.length,failedSamples:failed.length,
    checks,automaticRetries:0,
    evidenceBoundary:'SAMPLED_PUBLIC_OBSERVATIONS_NOT_ROOT_CAUSE_OR_GLOBAL_AVAILABILITY_PROOF'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const arg=name=>{const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:undefined};
  const output=arg('--output');
  try{
    if(!output)throw Error('PUBLIC_WINDOW_OUTPUT_PATH_REQUIRED');
    const result=await observePublicDeliveryWindow({
      url:arg('--url'),expectedSha:arg('--expected-sha'),
      samples:arg('--samples')===undefined?3:Number(arg('--samples')),
      pauseMs:arg('--pause-ms')===undefined?5000:Number(arg('--pause-ms'))});
    await fs.mkdir(dirname(output),{recursive:true});
    await fs.writeFile(output,JSON.stringify(result,null,2));
    console.log('PUBLIC_DELIVERY_WINDOW='+result.status+' passed='+result.passedSamples+' failed='+result.failedSamples);
    if(result.status!=='PASS')process.exitCode=1;
  }catch(error){
    console.error('PUBLIC_DELIVERY_WINDOW=FAIL '+(/^[A-Z][A-Z0-9_]{1,95}$/.test(error?.message||'')?error.message:'PUBLIC_WINDOW_ERROR'));
    process.exitCode=1;
  }
}
