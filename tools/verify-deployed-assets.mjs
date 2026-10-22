import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

// One bounded observation, without automatic retries or browser-cache bypass.
export async function verifyDeployedAssets({url,expectedSha,fetchImpl=fetch}){
  if(!/^[a-f0-9]{40}$/.test(expectedSha))throw Error('ASSET_EXPECTED_SOURCE_REQUIRED');
  const base=new URL(url);
  if(!['http:','https:'].includes(base.protocol)||base.username||base.password||base.pathname!=='/'||base.search||base.hash)throw Error('ASSET_ORIGIN_REQUIRED');
  const read=async path=>{
    const response=await fetchImpl(new URL(path,base),{redirect:'error',signal:AbortSignal.timeout(15000)});
    return {response,bytes:Buffer.from(await response.arrayBuffer())};
  };
  const manifestResponse=await read('/asset-manifest.json');
  if(!manifestResponse.response.ok||!/application\/json/i.test(manifestResponse.response.headers.get('content-type')||''))throw Error('ASSET_MANIFEST_RESPONSE_INVALID');
  const manifest=JSON.parse(manifestResponse.bytes.toString('utf8'));
  if(manifest.schemaVersion!==1||manifest.sourceCommit!==expectedSha||!Array.isArray(manifest.assets)||!manifest.assets.length||manifest.assets.length>2000)throw Error('ASSET_MANIFEST_SOURCE_INVALID');
  const paths=new Set();let total=0;
  for(const item of manifest.assets){
    if(!/^assets\/[A-Za-z0-9._/-]+$/.test(item.path)||item.path.split('/').some(x=>x==='.'||x==='..'||!x)||paths.has(item.path)||!Number.isSafeInteger(item.sizeBytes)||item.sizeBytes<0||!/^[a-f0-9]{64}$/.test(item.sha256))throw Error('ASSET_MANIFEST_ENTRY_INVALID');
    paths.add(item.path);total+=item.sizeBytes;
    if(total>64*1024*1024)throw Error('ASSET_MANIFEST_LIMIT_EXCEEDED');
  }
  const entry=await read('/');
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
      const item=manifest.assets[next++],{response,bytes}=await read('/'+item.path),type=response.headers.get('content-type')||'';
      const expectedType=/\.(?:m?js|cjs)$/.test(item.path)?/(?:application|text)\/(?:java|ecma)script/i:item.path.endsWith('.css')?/text\/css/i:item.path.endsWith('.wasm')?/application\/wasm/i:null;
      const sha256=createHash('sha256').update(bytes).digest('hex');
      const status=response.status===200&&(!expectedType||expectedType.test(type))&&bytes.length===item.sizeBytes&&sha256===item.sha256?'PASS':'FAIL';
      rows.push({path:item.path,status,httpStatus:response.status,contentType:type,sizeBytes:bytes.length,expectedSizeBytes:item.sizeBytes,sha256,expectedSha256:item.sha256});
    }
  };
  await Promise.all(Array.from({length:4},worker));
  const missing=await read('/assets/__startak_missing_'+expectedSha+'.js');
  const missingAssetStatus=missing.response.status===404?'PASS':'FAIL';
  return {schemaVersion:1,expectedSourceCommit:expectedSha,checkedAt:new Date().toISOString(),status:rows.every(r=>r.status==='PASS')&&missingAssetStatus==='PASS'?'PASS':'FAIL',assets:rows.sort((a,b)=>a.path.localeCompare(b.path)),missingAssetStatus,missingAssetHttpStatus:missing.response.status,automaticRetries:0,evidenceBoundary:'SINGLE_DELIVERY_OBSERVATION_NOT_ROOT_CAUSE_OR_PERMANENT_AVAILABILITY_PROOF'};
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
