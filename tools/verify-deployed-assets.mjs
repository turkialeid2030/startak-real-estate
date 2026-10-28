import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

// One bounded observation, without automatic retries or browser-cache bypass.
export async function verifyDeployedAssets({url,expectedSha,fetchImpl=fetch}){
  if(!/^[a-f0-9]{40}$/.test(expectedSha))throw Error('ASSET_EXPECTED_SOURCE_REQUIRED');
  const base=new URL(url);
  if(!['http:','https:'].includes(base.protocol)||base.username||base.password||base.pathname!=='/'||base.search||base.hash)throw Error('ASSET_ORIGIN_REQUIRED');
  // Response metadata is bounded, public CDN diagnostics; never capture response bodies or cookies.
  const responseMeta=response=>{
    const header=name=>String(response.headers.get(name)||'').slice(0,160);
    return {httpStatus:response.status,cfRay:header('cf-ray'),cfCacheStatus:header('cf-cache-status'),cacheControl:header('cache-control'),age:header('age'),server:header('server')};
  };
  // Limit response bytes *while reading*, not after an unbounded arrayBuffer.
  // A malicious/stale CDN response must not exhaust runner memory.
  const read=async (resourcePath,maxBytes)=>{
    const response=await fetchImpl(new URL(resourcePath,base),{
      redirect:'error',signal:AbortSignal.timeout(15000)
    });
    const oversize=()=>{
      const err=new Error('ASSET_RESPONSE_SIZE_LIMIT_EXCEEDED');
      err.observation={schemaVersion:1,status:'FAIL',reasonCode:err.message,
        expectedSourceCommit:expectedSha,resourcePath,limitBytes:maxBytes,
        responseMetadata:responseMeta(response),checkedAt:new Date().toISOString(),
        automaticRetries:0,
        evidenceBoundary:'BOUNDED_FIRST_RESPONSE_NO_BODY_OR_GLOBAL_AVAILABILITY_CLAIM'};
      return err;
    };
    const declaredLength=response.headers.get('content-length');
    if(declaredLength!==null&&/^\d+$/.test(declaredLength)&&
      Number(declaredLength)>maxBytes)throw oversize();
    let bytes;
    if(response.body&&typeof response.body.getReader==='function'){
      const reader=response.body.getReader(),chunks=[];
      let n=0;
      try{
        while(true){
          const {done,value}=await reader.read();
          if(done)break;
          if(!(value instanceof Uint8Array))throw Error('ASSET_RESPONSE_STREAM_INVALID');
          n+=value.byteLength;
          if(n>maxBytes)throw oversize();
          chunks.push(Buffer.from(value));
        }
      }finally{
        try{await reader.cancel();}catch{}
        reader.releaseLock();
      }
      bytes=Buffer.concat(chunks,n);
    }else if(response.body===null){
      // Empty-body responses are safe; opaque non-streaming bodies are not.
      bytes=Buffer.alloc(0);
    }else{
      throw Error('ASSET_RESPONSE_STREAM_INVALID');
    }
    return {response,bytes,observedAt:new Date().toISOString()};
  };
  // Manifest sentinel preserves the existing exact size-limit diagnostic at 1 MiB + 1.
  const manifestResponse=await read('/asset-manifest.json',1024*1024+1);
  // Record bounded FIRST-failure edge evidence for all response, JSON,
  // source and entry errors. Never retry and never persist response bodies.
  const failManifest=(reasonCode,manifest=null,entryIndex=null)=>{
    const error=new Error(reasonCode);
    const candidate=manifest&&typeof manifest==='object'&&!Array.isArray(manifest)?manifest:{};
    error.observation={
      schemaVersion:1,status:'FAIL',reasonCode,
      expectedSourceCommit:expectedSha,
      observedAssetManifestSourceCommit:typeof candidate.sourceCommit==='string'
        && /^[a-f0-9]{40}$/.test(candidate.sourceCommit)?candidate.sourceCommit:null,
      manifestSha256:createHash('sha256').update(manifestResponse.bytes).digest('hex'),
      manifestSizeBytes:manifestResponse.bytes.length,
      manifestSchemaVersion:Number.isSafeInteger(candidate.schemaVersion)?candidate.schemaVersion:null,
      manifestAssetCount:Array.isArray(candidate.assets)?candidate.assets.length:null,
      manifestEntryIndex:Number.isInteger(entryIndex)?entryIndex:null,
      manifestContentType:String(manifestResponse.response.headers.get('content-type')||'').slice(0,120),
      manifestResponseMetadata:responseMeta(manifestResponse.response),
      manifestObservedAt:manifestResponse.observedAt,
      checkedAt:new Date().toISOString(),automaticRetries:0,
      evidenceBoundary:'FIRST_MANIFEST_FAILURE_NOT_CDN_ROOT_CAUSE_OR_GLOBAL_AVAILABILITY_PROOF'
    };
    throw error;
  };
  if(!manifestResponse.response.ok
    || !/application\/json/i.test(manifestResponse.response.headers.get('content-type')||'')){
    failManifest('ASSET_MANIFEST_RESPONSE_INVALID');
  }
  if(manifestResponse.bytes.length>1024*1024){
    failManifest('ASSET_MANIFEST_SIZE_LIMIT_EXCEEDED');
  }
  let manifest;
  try { manifest=JSON.parse(manifestResponse.bytes.toString('utf8')); }
  catch { failManifest('ASSET_MANIFEST_JSON_INVALID'); }
  if(!manifest||typeof manifest!=='object'||Array.isArray(manifest)
    ||manifest.schemaVersion!==1||manifest.sourceCommit!==expectedSha
    ||!Array.isArray(manifest.assets)||!manifest.assets.length||manifest.assets.length>2000){
    failManifest('ASSET_MANIFEST_SOURCE_INVALID',manifest);
  }
  const paths=new Set();let total=0;
  for(const [entryIndex,item] of manifest.assets.entries()){
    if(!item||typeof item!=='object'||Array.isArray(item)
      ||typeof item.path!=='string'||!/^assets\/[A-Za-z0-9._/-]+$/.test(item.path)
      ||item.path.split('/').some(x=>x==='.'||x==='..'||!x)
      ||paths.has(item.path)||!Number.isSafeInteger(item.sizeBytes)||item.sizeBytes<0
      ||typeof item.sha256!=='string'||!/^[a-f0-9]{64}$/.test(item.sha256)){
      failManifest('ASSET_MANIFEST_ENTRY_INVALID',manifest,entryIndex);
    }
    paths.add(item.path);total+=item.sizeBytes;
    if(total>64*1024*1024)failManifest('ASSET_MANIFEST_LIMIT_EXCEEDED',manifest,entryIndex);
  }
  const entry=await read('/',2*1024*1024);
  if(!entry.response.ok)throw Error('ASSET_ENTRY_RESPONSE_INVALID');
  const html=entry.bytes.toString('utf8');
  if(!html.includes(`name="startak-source-commit" content="${expectedSha}"`)){
    // Evidence from one failed observation. Never retry, embed response bodies, or accept mixed deployments.
    const observed=html.match(/<meta\s+name="startak-source-commit"\s+content="([a-f0-9]{40})"/);
    const header=(response,name)=>String(response.headers.get(name)||'').slice(0,160);
    const failure=new Error('ASSET_ENTRY_SOURCE_MISMATCH');
    failure.observation={
      schemaVersion:1,status:'FAIL',reasonCode:failure.message,expectedSourceCommit:expectedSha,
      observedEntrySourceCommit:observed?.[1]||null,observedAssetManifestSourceCommit:manifest.sourceCommit,
      entryHtmlSha256:createHash('sha256').update(entry.bytes).digest('hex'),
      entryHttpStatus:entry.response.status,manifestHttpStatus:manifestResponse.response.status,
      entryCacheControl:header(entry.response,'cache-control'),
      manifestCacheControl:header(manifestResponse.response,'cache-control'),
      entryCfRay:header(entry.response,'cf-ray'),manifestCfRay:header(manifestResponse.response,'cf-ray'),
      entryCfCacheStatus:header(entry.response,'cf-cache-status'),
      manifestCfCacheStatus:header(manifestResponse.response,'cf-cache-status'),
      checkedAt:new Date().toISOString(),automaticRetries:0,
      evidenceBoundary:'SINGLE_DELIVERY_OBSERVATION_NOT_ROOT_CAUSE_OR_PERMANENT_AVAILABILITY_PROOF'
    };
    throw failure;
  }
  const entryScripts=[...html.matchAll(/<script\b[^>]*\bsrc="\/([^"?]+\.js)"/g)].map(x=>x[1]);
  if(!entryScripts.length||entryScripts.some(path=>!paths.has(path)))throw Error('ASSET_ENTRY_SCRIPT_NOT_IN_MANIFEST');
  const rows=[];let next=0;
  const worker=async()=>{
    while(next<manifest.assets.length){
      const item=manifest.assets[next++],{response,bytes,observedAt}=await read('/'+item.path,Math.min(64*1024*1024,Math.max(64*1024,item.sizeBytes+1))),type=response.headers.get('content-type')||'';
      const expectedType=/\.(?:m?js|cjs)$/.test(item.path)?/(?:application|text)\/(?:java|ecma)script/i:item.path.endsWith('.css')?/text\/css/i:item.path.endsWith('.wasm')?/application\/wasm/i:null;
      const sha256=createHash('sha256').update(bytes).digest('hex');
      const status=response.status===200&&(!expectedType||expectedType.test(type))&&bytes.length===item.sizeBytes&&sha256===item.sha256?'PASS':'FAIL';
      rows.push({path:item.path,status,httpStatus:response.status,contentType:type,sizeBytes:bytes.length,expectedSizeBytes:item.sizeBytes,sha256,expectedSha256:item.sha256,observedAt,responseMetadata:responseMeta(response)});
    }
  };
  await Promise.all(Array.from({length:4},worker));
  const missing=await read('/assets/__startak_missing_'+expectedSha+'.js',256*1024);
  const missingAssetStatus=missing.response.status===404?'PASS':'FAIL';
  return {schemaVersion:1,expectedSourceCommit:expectedSha,checkedAt:new Date().toISOString(),status:rows.every(r=>r.status==='PASS')&&missingAssetStatus==='PASS'?'PASS':'FAIL',assets:rows.sort((a,b)=>a.path.localeCompare(b.path)),manifestResponseMetadata:responseMeta(manifestResponse.response),manifestObservedAt:manifestResponse.observedAt,entryResponseMetadata:responseMeta(entry.response),entryObservedAt:entry.observedAt,entryHtmlSha256:createHash('sha256').update(entry.bytes).digest('hex'),missingAssetStatus,missingAssetHttpStatus:missing.response.status,missingResponseMetadata:responseMeta(missing.response),missingObservedAt:missing.observedAt,automaticRetries:0,evidenceBoundary:'SINGLE_DELIVERY_OBSERVATION_NOT_ROOT_CAUSE_OR_PERMANENT_AVAILABILITY_PROOF'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const arg=name=>process.argv[process.argv.indexOf(name)+1];
  try{
    const result=await verifyDeployedAssets({url:arg('--url'),expectedSha:arg('--expected-sha')});
    if(process.argv.includes('--output'))await fs.writeFile(arg('--output'),JSON.stringify(result,null,2));
    console.log(`DEPLOYED_ASSET_BYTES=${result.status} assets=${result.assets.length} missing=${result.missingAssetHttpStatus}`);
    if(result.status!=='PASS'){console.error(JSON.stringify(result.assets.filter(x=>x.status==='FAIL')));process.exitCode=1;}
  }catch(error){
    const reasonCode=/^[A-Z][A-Z0-9_]{1,95}$/.test(error.message)?error.message:'ASSET_OBSERVATION_FAILED';
    // The diagnostic artifact contains only bounded response metadata and hashes, never HTML or asset bytes.
    if(process.argv.includes('--output')){
      const out=arg('--output');
      try{
        const {dirname}=await import('node:path');
        await fs.mkdir(dirname(out),{recursive:true});
        await fs.writeFile(out,JSON.stringify(error.observation||{
          schemaVersion:1,status:'FAIL',reasonCode,expectedSourceCommit:arg('--expected-sha'),
          checkedAt:new Date().toISOString(),automaticRetries:0,
          evidenceBoundary:'SINGLE_DELIVERY_OBSERVATION_NOT_ROOT_CAUSE_OR_PERMANENT_AVAILABILITY_PROOF'
        },null,2));
        console.error('DEPLOYED_ASSET_FAILURE_EVIDENCE=RECORDED');
      }catch(writeError){console.error('DEPLOYED_ASSET_FAILURE_EVIDENCE=WRITE_FAILED');}
    }
    console.error('DEPLOYED_ASSET_BYTES=FAIL '+reasonCode);process.exitCode=1;
  }
}
