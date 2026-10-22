'use strict';
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

(async()=>{
  const {verifyDeployedAssets}=await import(pathToFileURL(path.resolve(__dirname,'../../tools/verify-deployed-assets.mjs')).href);
  const expected='a'.repeat(40),old='b'.repeat(40),asset=Buffer.from('console.log("synthetic-only");');
  const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
  const makeFetch=({entrySource=expected,manifestSource=expected,missingMeta=false,brokenAsset=false}={})=>{
    const html='<!doctype html><meta name="startak-source-commit" content="'+entrySource+'"><script src="/assets/main.js"></script>';
    const manifest=JSON.stringify({schemaVersion:1,sourceCommit:manifestSource,assets:[{path:'assets/main.js',sizeBytes:asset.length,sha256:hash(asset)}]});
    const seen=[];
    const fetchImpl=async input=>{
      const pathname=new URL(input).pathname;seen.push(pathname);
      if(pathname==='/asset-manifest.json')return new Response(manifest,{status:200,headers:{'content-type':'application/json','cf-ray':'manifest-ray','cache-control':'no-store'}});
      if(pathname==='/')return new Response(missingMeta?html.replace(/<meta[^>]+>/,''):html,{status:200,headers:{'content-type':'text/html','cf-ray':'entry-ray','cache-control':'no-store','cf-cache-status':'DYNAMIC'}});
      if(pathname==='/assets/main.js')return new Response(brokenAsset?'wrong-asset':asset,{status:200,headers:{'content-type':'application/javascript'}});
      if(pathname.startsWith('/assets/__startak_missing_'))return new Response('Not found',{status:404,headers:{'content-type':'text/plain'}});
      throw new Error('UNEXPECTED_REQUEST '+pathname);
    };
    return {fetchImpl,seen,html};
  };
  let count=0;
  const success=makeFetch();
  const result=await verifyDeployedAssets({url:'https://example.test/',expectedSha:expected,fetchImpl:success.fetchImpl});
  assert.equal(result.status,'PASS');count++;
  assert.equal(result.assets.length,1);count++;
  assert.equal(result.missingAssetStatus,'PASS');count++;
  assert.equal(result.automaticRetries,0);count++;
  assert.deepEqual(success.seen,['/asset-manifest.json','/','/assets/main.js','/assets/__startak_missing_'+expected+'.js']);count++;
  const stale=makeFetch({entrySource:old});
  await assert.rejects(
    verifyDeployedAssets({url:'https://example.test/',expectedSha:expected,fetchImpl:stale.fetchImpl}),
    err=>{
      assert.equal(err.message,'ASSET_ENTRY_SOURCE_MISMATCH');count++;
      assert.equal(err.observation.status,'FAIL');count++;
      assert.equal(err.observation.expectedSourceCommit,expected);count++;
      assert.equal(err.observation.observedEntrySourceCommit,old);count++;
      assert.equal(err.observation.observedAssetManifestSourceCommit,expected);count++;
      assert.equal(err.observation.entryHtmlSha256,hash(stale.html));count++;
      assert.equal(err.observation.entryCfRay,'entry-ray');count++;
      assert.equal(err.observation.manifestCfRay,'manifest-ray');count++;
      assert.equal(err.observation.entryCacheControl,'no-store');count++;
      assert.equal(err.observation.automaticRetries,0);count++;
      assert.equal(JSON.stringify(err.observation).includes(stale.html),false);count++;
      return true;
    });
  assert.deepEqual(stale.seen,['/asset-manifest.json','/']);count++;
  const missing=makeFetch({missingMeta:true});
  await assert.rejects(verifyDeployedAssets({url:'https://example.test/',expectedSha:expected,fetchImpl:missing.fetchImpl}),
    err=>{assert.equal(err.message,'ASSET_ENTRY_SOURCE_MISMATCH');count++;
      assert.equal(err.observation.observedEntrySourceCommit,null);count++;return true});
  const badManifest=makeFetch({manifestSource:old});
  await assert.rejects(verifyDeployedAssets({url:'https://example.test/',expectedSha:expected,fetchImpl:badManifest.fetchImpl}),/ASSET_MANIFEST_SOURCE_INVALID/);count++;
  const badAsset=makeFetch({brokenAsset:true});
  const failed=await verifyDeployedAssets({url:'https://example.test/',expectedSha:expected,fetchImpl:badAsset.fetchImpl});
  assert.equal(failed.status,'FAIL');count++;
  assert.equal(failed.assets[0].status,'FAIL');count++;
  console.log('ASSET_DELIVERY_DIAGNOSTICS_CHECKS='+count+' PASS; NO_RETRY=true; NO_BODY_EXFILTRATION=true');
})().catch(error=>{console.error(error);process.exitCode=1});
