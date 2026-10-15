'use strict';
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const fs=require('node:fs');
(async()=>{
  const {verifyDeployedAssets}=await import('../../tools/verify-deployed-assets.mjs');
  let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;},reject=async(fn,code)=>{await assert.rejects(fn,new RegExp(code));checks++;};
  const sha='a'.repeat(40),script='export const x=1;',css='body{color:red}',hash=s=>createHash('sha256').update(s).digest('hex');
  const manifest={schemaVersion:1,sourceCommit:sha,assets:[{path:'assets/index-test.js',sizeBytes:Buffer.byteLength(script),sha256:hash(script)},{path:'assets/index-test.css',sizeBytes:Buffer.byteLength(css),sha256:hash(css)}]};
  const html=`<meta name="startak-source-commit" content="${sha}"><script type="module" src="/assets/index-test.js"></script>`;
  const setup=(overrides={})=>{
    const calls=[];
    const map={'/asset-manifest.json':{body:JSON.stringify(manifest),type:'application/json'},'/':{body:html,type:'text/html'},'/assets/index-test.js':{body:script,type:'application/javascript'},'/assets/index-test.css':{body:css,type:'text/css'},...overrides};
    return {calls,fetchImpl:async(url,init)=>{eq(init.redirect,'error');calls.push(url.pathname);const x=map[url.pathname]||{body:'Not found',status:404,type:'text/plain'};return new Response(x.body,{status:x.status||200,headers:{'content-type':x.type}});}};
  };
  const run=async(overrides)=>{const x=setup(overrides),r=await verifyDeployedAssets({url:'https://example.test/',expectedSha:sha,fetchImpl:x.fetchImpl});return {r,calls:x.calls};};
  const good=await run();eq(good.r.status,'PASS');eq(good.r.assets.length,2);eq(good.r.missingAssetHttpStatus,404);eq(good.r.automaticRetries,0);eq(good.calls.length,5);
  for(const value of [{body:html,type:'text/html'},{body:'export const x=2;',type:'application/javascript'},{body:script,status:404,type:'application/javascript'}]){const {r}=await run({'/assets/index-test.js':value});eq(r.status,'FAIL');eq(r.assets.find(x=>x.path.endsWith('.js')).status,'FAIL');}
  const absentPath='/assets/__startak_missing_'+sha+'.js';const fallback=await run({[absentPath]:{body:html,type:'text/html'}});eq(fallback.r.status,'FAIL');eq(fallback.r.missingAssetStatus,'FAIL');
  const wrongSource=setup({'/asset-manifest.json':{body:JSON.stringify({...manifest,sourceCommit:'b'.repeat(40)}),type:'application/json'}});await reject(()=>verifyDeployedAssets({url:'https://example.test/',expectedSha:sha,fetchImpl:wrongSource.fetchImpl}),'ASSET_MANIFEST_SOURCE_INVALID');
  for(const path of ['../secrets','assets/../api/riai/ai-assist','https://evil.test/assets/x.js','assets//x.js']){const x=setup({'/asset-manifest.json':{body:JSON.stringify({...manifest,assets:[{...manifest.assets[0],path}]}),type:'application/json'}});await reject(()=>verifyDeployedAssets({url:'https://example.test/',expectedSha:sha,fetchImpl:x.fetchImpl}),'ASSET_MANIFEST_ENTRY_INVALID');eq(x.calls.length,1);}
  const duplicate=setup({'/asset-manifest.json':{body:JSON.stringify({...manifest,assets:[manifest.assets[0],manifest.assets[0]]}),type:'application/json'}});await reject(()=>verifyDeployedAssets({url:'https://example.test/',expectedSha:sha,fetchImpl:duplicate.fetchImpl}),'ASSET_MANIFEST_ENTRY_INVALID');
  const changedEntry=setup({'/':{body:html.replace(sha,'b'.repeat(40)),type:'text/html'}});await reject(()=>verifyDeployedAssets({url:'https://example.test/',expectedSha:sha,fetchImpl:changedEntry.fetchImpl}),'ASSET_ENTRY_SOURCE_MISMATCH');
  const missingScript=setup({'/':{body:html.replace('index-test.js','index-other.js'),type:'text/html'}});await reject(()=>verifyDeployedAssets({url:'https://example.test/',expectedSha:sha,fetchImpl:missingScript.fetchImpl}),'ASSET_ENTRY_SCRIPT_NOT_IN_MANIFEST');
  for(const url of ['https://user:pass@example.test/','https://example.test/path','https://example.test/?bypass=1','file:///tmp/'])await reject(()=>verifyDeployedAssets({url,expectedSha:sha,fetchImpl:setup().fetchImpl}),'ASSET_ORIGIN_REQUIRED');
  await reject(()=>verifyDeployedAssets({url:'https://example.test/',expectedSha:'main',fetchImpl:setup().fetchImpl}),'ASSET_EXPECTED_SOURCE_REQUIRED');
  const notJson=setup({'/asset-manifest.json':{body:html,type:'text/html'}});await reject(()=>verifyDeployedAssets({url:'https://example.test/',expectedSha:sha,fetchImpl:notJson.fetchImpl}),'ASSET_MANIFEST_RESPONSE_INVALID');
  eq(fs.existsSync('public/404.html'),true);
  console.log(`AUDIT_ASSET_DELIVERY=PASS checks=${checks}`);
})().catch(error=>{console.error(error);process.exitCode=1;});
