'use strict';
// C73.3A: REAL Node HTTP boundary for *synthetic/staging* custody only.
// No file vault, no commercial upload authorization and no production IdP.
const {STATUS_CODES}=require('node:http');
const MAX_BODY=7*1024*1024;
const MAX_BYTES=5*1024*1024;
const API_PREFIX='/v1/custody';
function err(code,status=400){
 const x=new Error(code);x.code=code;x.httpStatus=status;return x;
}
function own(obj,key){return Object.prototype.hasOwnProperty.call(obj,key);}
function exact(obj,keys){
 return obj&&typeof obj==='object'&&!Array.isArray(obj)&&
 Object.keys(obj).length===keys.length&&keys.every(k=>own(obj,k));
}
function decodeBytes(value){
 if(typeof value!=='string'||!value||value.length>Math.ceil(MAX_BYTES*4/3)+4||
  !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))
  throw err('C73_HTTP_BYTES_BASE64_INVALID');
 const bytes=Buffer.from(value,'base64');
 if(bytes.length<8||bytes.length>MAX_BYTES||bytes.toString('base64')!==value)
  throw err('C73_HTTP_BYTES_INVALID');
 return bytes;
}
async function readJson(req){
 if(req.headers['content-type']!=='application/json')
  throw err('C73_HTTP_JSON_ONLY',415);
 const declared=req.headers['content-length'];
 if(declared!==undefined&&(!/^[0-9]+$/.test(declared)||Number(declared)>MAX_BODY))
  throw err('C73_HTTP_BODY_TOO_LARGE',413);
 let n=0;const parts=[];
 for await(const chunk of req){
  n+=chunk.length;
  if(n>MAX_BODY)throw err('C73_HTTP_BODY_TOO_LARGE',413);
  parts.push(chunk);
 }
 if(!n)throw err('C73_HTTP_BODY_REQUIRED');
 try{
  const value=JSON.parse(Buffer.concat(parts).toString('utf8'));
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('not an object');
  return value;
 }catch{throw err('C73_HTTP_JSON_INVALID');}
}
function safeId(x){
 if(typeof x!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(x))
  throw err('C73_HTTP_DOCUMENT_ID_INVALID');
 return x;
}
function send(res,status,payload){
 res.statusCode=status;
 res.setHeader('Cache-Control','no-store, private');
 res.setHeader('Pragma','no-cache');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Content-Security-Policy',"default-src 'none'");
 res.setHeader('Content-Type','application/json; charset=utf-8');
 res.end(JSON.stringify(payload));
}
function createCustodyHttpHandler({custodyService,authenticator,clock}={}){
 if(!custodyService||typeof custodyService.observe!=='function'||
  typeof custodyService.recheck!=='function'||typeof custodyService.revoke!=='function'||
  typeof custodyService.get!=='function'||
  !authenticator||typeof authenticator.authenticate!=='function'||
  typeof clock!=='function')
  throw err('C73_HTTP_TRUSTED_DEPENDENCIES_REQUIRED');
 // This boundary accepts exactly one verified identity per request; it forwards
 // an INTERNAL envelope produced after cryptographic JWT verification, never
 // JSON-supplied actor IDs, roles or tenants. No CORS and no cookie auth.
 return async function handle(req,res){
  try{
   const url=new URL(req.url,'http://127.0.0.1');
   if(url.search||url.hash)throw err('C73_HTTP_QUERY_NOT_ALLOWED');
   const segments=url.pathname.split('/').filter(Boolean);
   if(segments[0]!=='v1'||segments[1]!=='custody')throw err('C73_HTTP_NOT_FOUND',404);
   if(segments.length>4)throw err('C73_HTTP_NOT_FOUND',404);
   const action=segments.length===2&&req.method==='POST'?'observe':
    segments.length===3&&req.method==='GET'?'get':
    segments.length===4&&req.method==='POST'&&['recheck','revoke'].includes(segments[3])?
      segments[3]:null;
   if(!action)throw err('C73_HTTP_METHOD_OR_ROUTE_DENIED',405);
   if(req.headers.cookie)throw err('C73_HTTP_COOKIE_AUTH_FORBIDDEN',403);
   const auth=await authenticator.authenticate({
    authorizationHeader:req.headers.authorization,
    nowEpochSeconds:Math.floor(clock().getTime()/1000),
   });
   if(auth?.authorizationReady!==true||!auth.identityContext?.identity)
    throw err('C73_HTTP_BEARER_VERIFICATION_REQUIRED',401);
   // This field is created server-side after the pinned issuer/audience/JWKS
   // verifier; it is NEVER read from a request body or caller-supplied header.
   const request=Object.freeze({__verifiedIdentity:auth.identityContext});
   if(action==='get'){
    const documentId=safeId(segments[2]);
    const outcome=await custodyService.get({request,documentId});
    return send(res,200,outcome);
   }
   const body=await readJson(req);
   if(action==='observe'){
    if(!exact(body,['scope','bytesBase64'])||!body.scope||typeof body.scope!=='object')
     throw err('C73_HTTP_OBSERVATION_FIELDS_INVALID');
    const bytes=decodeBytes(body.bytesBase64);
    const result=await custodyService.observe({request,scope:body.scope,bytes});
    return send(res,201,result);
   }
   const documentId=safeId(segments[2]);
   if(action==='recheck'){
    if(!exact(body,['bytesBase64','expectedRevision','expectedHeadTag']))
     throw err('C73_HTTP_RECHECK_FIELDS_INVALID');
    const bytes=decodeBytes(body.bytesBase64);
    return send(res,200,await custodyService.recheck({request,documentId,
      bytes,expectedRevision:body.expectedRevision,expectedHeadTag:body.expectedHeadTag}));
   }
   if(!exact(body,['expectedRevision','expectedHeadTag']))
    throw err('C73_HTTP_REVOKE_FIELDS_INVALID');
   return send(res,200,await custodyService.revoke({request,documentId,
    expectedRevision:body.expectedRevision,expectedHeadTag:body.expectedHeadTag}));
  }catch(e){
   // Node TypeError validators carry an error message, not necessarily a code.
   // Promote only a strict list of known public validation errors. Never emit
   // arbitrary database/stack/crypto messages in the HTTP response.
   const publicValidation=/^C73_(INPUT_SCOPE_UNEXPECTED_OR_MISSING_FIELD|FILE_HEADER_OR_MIME_REJECTED|SCOPE_(?:FIELDS_INVALID|NUMBER_INVALID|SHA_INVALID|NONCE_INVALID|STRING_INVALID|FILE_INVALID)|BYTES_SIZE_INVALID|VALUATION_DATE_INVALID)$/;
   const code=typeof e.code==='string'&&e.code.startsWith('C73_')?
    e.code:typeof e.message==='string'&&publicValidation.test(e.message)?e.message:'';
   const allowed=/^C73_(HTTP_|TENANT_|TRUSTED_IDENTITY|DOCUMENT_|STALE_|CUSTODY_NOT_ACTIVE|BYTE_RECHECK|EXPLICIT_CONCURRENCY|AUDIT_|DB_ROW_|INPUT_SCOPE_|FILE_HEADER_|FILE_MEDIA_|SCOPE_|BYTES_|VALUATION_DATE_)/.test(code);
   const status=Number.isInteger(e.httpStatus)?e.httpStatus:
    code==='C73_DOCUMENT_NOT_FOUND'?404:
    code.includes('STALE')||code.includes('ALREADY_EXISTS')?409:
    code.includes('TRUSTED_IDENTITY')||code.includes('TENANT_SCOPE')?403:
    allowed?400:500;
   return send(res,status,{error:allowed?code:'C73_HTTP_INTERNAL_HOLD',
    status:'HOLD',officialReportAuthorized:false,transactionAuthorized:false});
  }
 };
}
module.exports={createCustodyHttpHandler};
