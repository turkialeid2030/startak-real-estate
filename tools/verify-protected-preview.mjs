import {pathToFileURL} from 'node:url';
import {verifyDeployedAssets} from './verify-deployed-assets.mjs';

// Cloudflare Access client credentials are supplied only by a separately
// approved, manually dispatched trusted-main workflow. Never expose to PR CI.
export function validatedProtectedPreviewUrl(value) {
  let url;
  try { url=new URL(value); } catch { throw Error('PROTECTED_PREVIEW_URL_INVALID'); }
  if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||
     url.search||url.hash||
     !/^(?:[a-z0-9-]{1,63})\.startak-real-estate\.pages\.dev$/.test(url.hostname)||
     url.hostname.startsWith('-')||url.hostname.includes('..')){
    throw Error('PROTECTED_PREVIEW_ORIGIN_NOT_ALLOWED');
  }
  return url.origin+'/';
}
export function scopedCloudflareAccessFetch({previewUrl,clientId,clientSecret,fetchImpl=fetch}) {
  const root=new URL(validatedProtectedPreviewUrl(previewUrl));
  if(typeof clientId!=='string'||clientId.length<10||clientId.length>512||
     typeof clientSecret!=='string'||clientSecret.length<10||clientSecret.length>512)
    throw Error('PROTECTED_PREVIEW_SERVICE_IDENTITY_NOT_CONFIGURED');
  if(typeof fetchImpl!=='function')throw Error('PROTECTED_PREVIEW_FETCH_INVALID');
  return async (input,options={})=>{
    const request=new URL(input);
    if(request.origin!==root.origin||request.protocol!=='https:'||
       request.username||request.password)
      throw Error('PROTECTED_PREVIEW_CROSS_ORIGIN_BLOCKED');
    // No redirects: a challenge login or Access redirect is a blocked test,
    // never a success. Never persist/print the credentials.
    if(options?.redirect&&options.redirect!=='error')
      throw Error('PROTECTED_PREVIEW_REDIRECT_NOT_ALLOWED');
    const headers=new Headers(options.headers||{});
    if(headers.has('CF-Access-Client-Id')||headers.has('CF-Access-Client-Secret'))
      throw Error('PROTECTED_PREVIEW_HEADERS_CONFLICT');
    headers.set('CF-Access-Client-Id',clientId);
    headers.set('CF-Access-Client-Secret',clientSecret);
    const response=await fetchImpl(request,{...options,redirect:'error',headers});
    return response;
  };
}
export async function verifyProtectedPreview({
 url,expectedSha,clientId,clientSecret,fetchImpl=fetch
}) {
  const canonicalUrl=validatedProtectedPreviewUrl(url);
  if(typeof expectedSha!=='string'||!/^[a-f0-9]{40}$/.test(expectedSha))
    throw Error('PROTECTED_PREVIEW_SHA_REQUIRED');
  const scoped=scopedCloudflareAccessFetch({
    previewUrl:canonicalUrl,clientId,clientSecret,fetchImpl
  });
  // Verify the independently generated release manifest before asset checks.
  // Only a protected, same-origin fetch is permitted; credentials are never logged.
  const releaseResponse=await scoped(new URL('/release-manifest.json',canonicalUrl),{
    redirect:'error',signal:AbortSignal.timeout(15000)
  });
  if(releaseResponse.status!==200||
     !/application\\/json/i.test(releaseResponse.headers.get('content-type')||''))
    throw Error('PROTECTED_PREVIEW_RELEASE_MANIFEST_RESPONSE_INVALID');
  const maxBytes=64*1024;
  const declared=releaseResponse.headers.get('content-length');
  if(declared!==null&&/^\\d+$/.test(declared)&&Number(declared)>maxBytes)
    throw Error('PROTECTED_PREVIEW_RELEASE_MANIFEST_TOO_LARGE');
  if(!releaseResponse.body||typeof releaseResponse.body.getReader!=='function')
    throw Error('PROTECTED_PREVIEW_RELEASE_MANIFEST_BODY_INVALID');
  const chunks=[];let size=0;const reader=releaseResponse.body.getReader();
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      if(!(value instanceof Uint8Array))
        throw Error('PROTECTED_PREVIEW_RELEASE_MANIFEST_BODY_INVALID');
      size+=value.byteLength;
      if(size>maxBytes)throw Error('PROTECTED_PREVIEW_RELEASE_MANIFEST_TOO_LARGE');
      chunks.push(Buffer.from(value));
    }
  }finally{
    try{await reader.cancel();}catch{}
    reader.releaseLock();
  }
  let releaseManifest;
  try{releaseManifest=JSON.parse(Buffer.concat(chunks,size).toString('utf8'));}
  catch{throw Error('PROTECTED_PREVIEW_RELEASE_MANIFEST_JSON_INVALID');}
  if(!releaseManifest||typeof releaseManifest!=='object'||Array.isArray(releaseManifest)||
     releaseManifest.schemaVersion!==1||releaseManifest.sourceCommit!==expectedSha||
     releaseManifest.sourceCommitBound!==true)
    throw Error('PROTECTED_PREVIEW_RELEASE_MANIFEST_SOURCE_MISMATCH');
  // Full asset hash and missing-resource checks are delegated to one canonical
  // verifier, not a weaker independent implementation.
  const result=await verifyDeployedAssets({url:canonicalUrl,expectedSha,fetchImpl:scoped});
  return {...result,releaseManifestStatus:'PASS',
    releaseManifestSourceCommit:releaseManifest.sourceCommit};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  // Mandatory explicit parameters; never infer production authorization.
  const args=process.argv.slice(2);
  const arg=(name)=>args[args.indexOf(name)+1];
  let errorCode='';
  try{
    const url=arg('--url'),expectedSha=arg('--expected-sha');
    const result=await verifyProtectedPreview({
      url,expectedSha,
      clientId:process.env.STARTAK_CF_ACCESS_CLIENT_ID,
      clientSecret:process.env.STARTAK_CF_ACCESS_CLIENT_SECRET
    });
    console.log('STARTAK_AUTHENTICATED_PREVIEW_ASSETS='+result.status+
      ' assets='+result.assets.length+
      ' source='+expectedSha);
    if(result.status!=='PASS')process.exitCode=1;
  }catch(e){
    // Generic whitelist prevents signed URL, credential, and response-body
    // leakage in all error paths.
    const safe=[
      'PROTECTED_PREVIEW_URL_INVALID','PROTECTED_PREVIEW_ORIGIN_NOT_ALLOWED',
      'PROTECTED_PREVIEW_SERVICE_IDENTITY_NOT_CONFIGURED',
      'PROTECTED_PREVIEW_SHA_REQUIRED','PROTECTED_PREVIEW_FETCH_INVALID',
      'PROTECTED_PREVIEW_RELEASE_MANIFEST_RESPONSE_INVALID',
      'PROTECTED_PREVIEW_RELEASE_MANIFEST_TOO_LARGE',
      'PROTECTED_PREVIEW_RELEASE_MANIFEST_BODY_INVALID',
      'PROTECTED_PREVIEW_RELEASE_MANIFEST_JSON_INVALID',
      'PROTECTED_PREVIEW_RELEASE_MANIFEST_SOURCE_MISMATCH',
      'PROTECTED_PREVIEW_CROSS_ORIGIN_BLOCKED',
      'PROTECTED_PREVIEW_REDIRECT_NOT_ALLOWED','PROTECTED_PREVIEW_HEADERS_CONFLICT',
      'ASSET_MANIFEST_RESPONSE_INVALID','ASSET_MANIFEST_SOURCE_INVALID',
      'ASSET_ENTRY_SOURCE_MISMATCH','ASSET_EXPECTED_SOURCE_REQUIRED',
      'ASSET_RESPONSE_SIZE_LIMIT_EXCEEDED'
    ];
    errorCode=safe.includes(e?.message)?e.message:'PROTECTED_PREVIEW_ACCESS_OR_DELIVERY_NOT_VERIFIED';
    console.error('STARTAK_AUTHENTICATED_PREVIEW_ASSETS=FAIL '+errorCode);
    process.exitCode=2;
  }
}
