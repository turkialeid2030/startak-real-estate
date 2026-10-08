'use strict';
// Synthetic test fixture: isolated loopback witness PROCESS with own Ed25519 key.
// In-memory state is NOT WORM, durable, audited or independently authorized.
const {createServer}=require('node:http');
const {generateKeyPairSync,sign}=require('node:crypto');
const {DOMAIN}=require('../../src/security/c73-external-witness-gate');
const {privateKey,publicKey}=generateKeyPairSync('ed25519');
const heads=new Map();
function json(res,status,data){
 res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});
 res.end(JSON.stringify(data));
}
const re=/^[a-f0-9]{64}$/;
const id=x=>typeof x==='string'&&x.length>0&&x.length<=180&&
 !/[\u0000-\u001f\u007f]/.test(x);
function signed(p){
 const body=Buffer.from(DOMAIN+JSON.stringify({
  version:p.version,tenantId:p.tenantId,documentId:p.documentId,
  revision:p.revision,headTag:p.headTag,issuedAt:p.issuedAt,
 }));
 return {payload:p,signature:sign(null,body,privateKey).toString('base64url')};
}
function key(t,d){return JSON.stringify([t,d]);}
const server=createServer(async(req,res)=>{
 try{
  if(req.method==='GET'){
   const url=new URL(req.url,'http://127.0.0.1');
   if(url.pathname!=='/checkpoint')return json(res,404,{error:'UNKNOWN'});
   const t=url.searchParams.get('tenantId'),d=url.searchParams.get('documentId');
   if(!id(t)||!id(d))return json(res,400,{error:'IDENTIFIER'});
   const current=heads.get(key(t,d));
   return json(res,current?200:404,current||{error:'MISSING'});
  }
  if(req.method!=='POST'||req.url!=='/advance')
   return json(res,404,{error:'UNKNOWN'});
  let size=0;const chunks=[];
  for await(const c of req){size+=c.length;if(size>4096)return json(res,413,{error:'TOO_LARGE'});chunks.push(c);}
  let b;try{b=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return json(res,400,{error:'BAD_JSON'});}
  if(!b||!id(b.tenantId)||!id(b.documentId)||!Number.isInteger(b.revision)||
   b.revision<1||b.revision>1000||typeof b.headTag!=='string'||!re.test(b.headTag))
   return json(res,400,{error:'BAD_FIELDS'});
  const name=key(b.tenantId,b.documentId),before=heads.get(name);
  if(!before){
   if(b.revision!==1||b.expectedRevision!==null||b.expectedHeadTag!==null)
    return json(res,409,{error:'CAS_MISMATCH'});
  }else if(b.expectedRevision!==before.payload.revision||
   b.expectedHeadTag!==before.payload.headTag||
   b.revision!==before.payload.revision+1)
   return json(res,409,{error:'CAS_MISMATCH'});
  const p={version:1,tenantId:b.tenantId,documentId:b.documentId,
   revision:b.revision,headTag:b.headTag,issuedAt:new Date().toISOString()};
  const receipt=signed(p);
  heads.set(name,receipt);
  return json(res,200,receipt);
 }catch{return json(res,500,{error:'SERVER_HOLD'});}
});
server.listen(0,'127.0.0.1',()=>{
 if(process.send)process.send({type:'ready',port:server.address().port,
  publicKey:publicKey.export({format:'pem',type:'spki'})});
});
process.on('message',msg=>{if(msg?.type==='stop')server.close(()=>process.exit(0));});
