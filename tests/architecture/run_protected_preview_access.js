'use strict';
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {spawnSync}=require('node:child_process');
const path=require('node:path');
(async()=>{
  const {validatedProtectedPreviewUrl,scopedCloudflareAccessFetch,verifyProtectedPreview}=
    await import('../../tools/verify-protected-preview.mjs');
  const url='https://1647dc09.startak-real-estate.pages.dev/';
  const sha='a'.repeat(40);
  let checks=0;const pass=()=>checks++;
  assert.equal(validatedProtectedPreviewUrl(url),url);pass();
  for(const invalid of [
    'http://1647dc09.startak-real-estate.pages.dev/',
    'https://1647dc09.startak-real-estate.pages.dev/?utm_source=chatgpt.com',
    'https://1647dc09.startak-real-estate.pages.dev/../../',
    'https://startak-real-estate.pages.dev/',
    'https://malicious.pages.dev/',
    'https://1647dc09.startak-real-estate.pages.dev.evil.test/',
    'https://x:y@1647dc09.startak-real-estate.pages.dev/'
  ]) {
    assert.throws(()=>validatedProtectedPreviewUrl(invalid),/PROTECTED_PREVIEW_/);pass();
  }
  const id='test-client-id-only',secret='test-secret-only';
  assert.throws(()=>scopedCloudflareAccessFetch({previewUrl:url,clientId:'',clientSecret:secret}),
    /SERVICE_IDENTITY_NOT_CONFIGURED/);pass();
  const hash=x=>createHash('sha256').update(x).digest('hex');
  const asset=Buffer.from('some synthetic JS content');
  const manifest={schemaVersion:1,sourceCommit:sha,assets:[
    {path:'assets/index.js',sizeBytes:asset.length,sha256:hash(asset)}
  ]};
  const html='<html><head><meta name="startak-source-commit" content="'+sha+
    '"></head><body><script src="/assets/index.js"></script></body></html>';
  const observed=[];
  const fetchImpl=async (input,opts)=>{
    assert.equal(new URL(input).origin,new URL(url).origin);pass();
    assert.equal(opts.redirect,'error');pass();
    assert.equal(opts.headers.get('CF-Access-Client-Id'),id);pass();
    assert.equal(opts.headers.get('CF-Access-Client-Secret'),secret);pass();
    const resource=new URL(input).pathname;observed.push(resource);
    if(resource==='/asset-manifest.json')
      return new Response(JSON.stringify(manifest),{status:200,headers:{'content-type':'application/json'}});
    if(resource==='/')
      return new Response(html,{status:200,headers:{'content-type':'text/html'}});
    if(resource==='/assets/index.js')
      return new Response(asset,{status:200,headers:{'content-type':'application/javascript'}});
    return new Response('not found',{status:404,headers:{'content-type':'text/plain'}});
  };
  const result=await verifyProtectedPreview({url,expectedSha:sha,clientId:id,clientSecret:secret,fetchImpl});
  assert.equal(result.status,'PASS');pass();
  assert.equal(result.assets.length,1);pass();
  assert.equal(result.missingAssetStatus,'PASS');pass();
  assert.equal(observed.length,4);pass();
  const scoped=scopedCloudflareAccessFetch({previewUrl:url,clientId:id,clientSecret:secret,fetchImpl});
  await assert.rejects(scoped('https://example.test/private',{}),/CROSS_ORIGIN_BLOCKED/);pass();
  await assert.rejects(scoped(url,{redirect:'follow'}),/REDIRECT_NOT_ALLOWED/);pass();
  await assert.rejects(scoped(url,{headers:{'CF-Access-Client-Id':'bad'}}),/HEADERS_CONFLICT/);pass();
  // Login 302 is never accepted as a release manifest (not even if the body is JSON).
  await assert.rejects(verifyProtectedPreview({url,expectedSha:sha,clientId:id,clientSecret:secret,
    fetchImpl:async()=>new Response('',{status:302,headers:{
      location:'https://login.cloudflareaccess.com/', 'content-type':'application/json'
    }})}));pass();
  const proc=spawnSync(process.execPath,[path.resolve(__dirname,'../../tools/verify-protected-preview.mjs'),
    '--url',url,'--expected-sha',sha],{encoding:'utf8',
      env:{...process.env,STARTAK_CF_ACCESS_CLIENT_ID:'',STARTAK_CF_ACCESS_CLIENT_SECRET:''}});
  assert.equal(proc.status,2);pass();
  assert.match(proc.stderr,/PROTECTED_PREVIEW_SERVICE_IDENTITY_NOT_CONFIGURED/);pass();
  assert.ok(!proc.stderr.includes(secret));pass();
  console.log('STARTAK_SCOPED_PROTECTED_PREVIEW=PASS checks='+checks+
    ' syntheticAccessOnly=true realCredentialsUsed=false loginBypass=false');
})().catch(err=>{console.error(err);process.exitCode=1});