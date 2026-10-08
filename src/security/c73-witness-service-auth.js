'use strict';
// C73.3D: server-to-server Ed25519 request authentication over a transport.
// Caller must independently provide secure HTTPS/mTLS, IAM and trust anchoring.
// This module is a protocol contract; test fixtures use synthetic loopback HTTP.
const {createPrivateKey,createPublicKey,sign,verify,createHash,randomBytes}=require('node:crypto');
const DOMAIN='STARTAK:C73.3D:WITNESS-REQUEST:V1\n';
const ID=/^[A-Za-z0-9_-]{16,80}$/;
const SIGNATURE=/^[A-Za-z0-9_-]{86}$/;
function fail(code){const e=new Error(code);e.code=code;return e;}
function digest(b){return createHash('sha256').update(b).digest('hex');}
function timestampValue(x){
 if(typeof x!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(x))return NaN;
 const d=Date.parse(x);return Number.isFinite(d)&&new Date(d).toISOString()===x?d:NaN;
}
function message(method,route,issuedAt,nonce,body){
 return Buffer.from(DOMAIN+JSON.stringify({method,route,issuedAt,nonce,sha256Body:digest(body)}),'utf8');
}
function createWitnessRequestSigner({privateKey,clientId,clock}={}){
 let key;
 try{key=createPrivateKey(privateKey);}catch{throw fail('C73_D_WITNESS_CLIENT_KEY_REQUIRED');}
 if(key.asymmetricKeyType!=='ed25519'||typeof clock!=='function'||
  typeof clientId!=='string'||!ID.test(clientId))
  throw fail('C73_D_WITNESS_SIGNER_INVALID');
 return function makeHeaders({method,route,body=Buffer.alloc(0)}){
  if(typeof method!=='string'||!['GET','POST'].includes(method)||
   typeof route!=='string'||!route.startsWith('/')||
   !(Buffer.isBuffer(body)||body instanceof Uint8Array))
   throw fail('C73_D_WITNESS_REQUEST_INVALID');
  const now=clock(),issuedAt=now instanceof Date?now.toISOString():null;
  if(!Number.isFinite(timestampValue(issuedAt)))throw fail('C73_D_WITNESS_CLOCK_INVALID');
  const nonce=randomBytes(24).toString('base64url');
  return Object.freeze({
   'x-c73-client-id':clientId,
   'x-c73-issued-at':issuedAt,
   'x-c73-nonce':nonce,
   'x-c73-request-signature':sign(null,message(method,route,issuedAt,nonce,body),key).toString('base64url'),
  });
 };
}
function createWitnessRequestVerifier({publicKey,clientId,clock,maxClockSkewMs=30000}={}){
 let key;
 try{key=createPublicKey(publicKey);}catch{throw fail('C73_D_WITNESS_CLIENT_PUBKEY_REQUIRED');}
 if(key.asymmetricKeyType!=='ed25519'||typeof clock!=='function'||
  typeof clientId!=='string'||!ID.test(clientId)||
  !Number.isSafeInteger(maxClockSkewMs)||maxClockSkewMs<1000||maxClockSkewMs>120000)
  throw fail('C73_D_WITNESS_VERIFIER_INVALID');
 return function verifyOne({headers,method,route,body}){
  const h=headers||{},id=h['x-c73-client-id'],ts=h['x-c73-issued-at'],
   nonce=h['x-c73-nonce'],signature=h['x-c73-request-signature'];
  if(id!==clientId||typeof nonce!=='string'||!ID.test(nonce)||
   typeof signature!=='string'||!SIGNATURE.test(signature)||
   !(Buffer.isBuffer(body)||body instanceof Uint8Array)||
   !['GET','POST'].includes(method)||typeof route!=='string')
   throw fail('C73_D_WITNESS_AUTH_DENIED');
  const observed=timestampValue(ts),time=clock();
  if(!(time instanceof Date)||!Number.isFinite(time.getTime())||
   !Number.isFinite(observed)||Math.abs(time.getTime()-observed)>maxClockSkewMs)
   throw fail('C73_D_WITNESS_TIME_DENIED');
  try{
   if(!verify(null,message(method,route,ts,nonce,body),key,Buffer.from(signature,'base64url')))
    throw fail('C73_D_WITNESS_SIGNATURE_DENIED');
  }catch{throw fail('C73_D_WITNESS_SIGNATURE_DENIED');}
  return Object.freeze({clientId,nonce,issuedAt:ts});
 };
}
function createWitnessHttpTransport({baseUrl,signRequest,timeoutMs=3000}={}){
 let url;
 try{url=new URL(baseUrl);}catch{throw fail('C73_D_WITNESS_BASE_INVALID');}
 if(!['https:','http:'].includes(url.protocol)||url.username||url.password||
  (url.protocol==='http:'&&!['127.0.0.1','localhost','[::1]'].includes(url.hostname))||
  typeof signRequest!=='function'||!Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>30000)
  throw fail('C73_D_WITNESS_TRANSPORT_INVALID');
 async function call(method,route,obj){
  const raw=obj===undefined?Buffer.alloc(0):Buffer.from(JSON.stringify(obj));
  const head=signRequest({method,route,body:raw});
  let res;
  try{
   res=await fetch(new URL(route,url),{method,headers:{
    ...head,'Accept':'application/json',...(method==='POST'?{'Content-Type':'application/json'}:{})},
    ...(method==='POST'?{body:raw}:{}),signal:AbortSignal.timeout(timeoutMs)});
  }catch{throw fail('C73_D_WITNESS_SERVICE_UNAVAILABLE');}
  if(res.status===404&&method==='GET')return null;
  if(!res.ok)throw fail('C73_D_WITNESS_REMOTE_REJECTED_'+res.status);
  let text;
  try{text=await res.text();if(text.length>4096)throw Error();return JSON.parse(text);}
  catch{throw fail('C73_D_WITNESS_BAD_RECEIPT');}
 }
 return Object.freeze({
  readCheckpoint:({tenantId,documentId})=>{
   const qs=new URLSearchParams({tenantId,documentId});
   return call('GET','/checkpoint?'+qs.toString());
  },
  advanceCheckpoint:data=>call('POST','/advance',data),
 });
}
module.exports={DOMAIN,createWitnessRequestSigner,createWitnessRequestVerifier,
 createWitnessHttpTransport};
