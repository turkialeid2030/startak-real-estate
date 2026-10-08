'use strict';
// C73.3D: LOCAL TEST/STAGING ONLY. Durable restart-persistent Ed25519 witness.
// This is NOT WORM: filesystem owner, backups or privileged administrator can
// roll back journal+key. No production mTLS/IAM/KMS, region proof or certification.
const fs=require('node:fs/promises');
const path=require('node:path');
const {constants}=require('node:fs');
const {createServer}=require('node:http');
const {generateKeyPairSync,createPrivateKey,createPublicKey,sign,verify,createHash}=require('node:crypto');
const {DOMAIN:RECEIPT_DOMAIN}=require('./c73-external-witness-gate');
const {createWitnessRequestVerifier}=require('./c73-witness-service-auth');
const HASH=/^[a-f0-9]{64}$/;
const SIGNED_FIELDS=['version','tenantId','documentId','revision','headTag','issuedAt'];
function fail(x){const e=new Error(x);e.code=x;return e;}
function id(x){return typeof x==='string'&&x.length>0&&x.length<=180&&
 x.trim()===x&&!/[\u0000-\u001f\u007f]/.test(x);}
function canonical(p){return Object.fromEntries(SIGNED_FIELDS.map(k=>[k,p[k]]));}
function digest(x){return createHash('sha256').update(x).digest('hex');}
function signReceipt(p,privateKey){
 return {payload:p,signature:sign(null,
  Buffer.from(RECEIPT_DOMAIN+JSON.stringify(canonical(p))),privateKey).toString('base64url')};
}
function receiptValid(r,publicKey,t,d,sequence){
 const p=r?.payload;
 if(!r||Object.keys(r).length!==2||!p||Object.keys(p).length!==SIGNED_FIELDS.length||
  SIGNED_FIELDS.some(k=>!Object.hasOwn(p,k))||
  p.version!==1||p.tenantId!==t||p.documentId!==d||p.revision!==sequence||
  !HASH.test(p.headTag||'')||typeof p.issuedAt!=='string'||
  !Number.isFinite(Date.parse(p.issuedAt))||
  new Date(p.issuedAt).toISOString()!==p.issuedAt||
  typeof r.signature!=='string'||!/^[A-Za-z0-9_-]{86}$/.test(r.signature))
  throw fail('C73_D_JOURNAL_RECORD_CORRUPT');
 let ok=false;
 try{ok=verify(null,Buffer.from(RECEIPT_DOMAIN+JSON.stringify(canonical(p))),
  publicKey,Buffer.from(r.signature,'base64url'));}catch{}
 if(!ok)throw fail('C73_D_JOURNAL_SIGNATURE_INVALID');
}
async function privateDir(dir){
 await fs.mkdir(dir,{recursive:true,mode:0o700});
 const st=await fs.lstat(dir);
 if(!st.isDirectory()||st.isSymbolicLink()||(st.mode&0o077)!==0)
  throw fail('C73_D_WITNESS_DIRECTORY_INSECURE');
}
async function persisted(file,value){
 const h=await fs.open(file,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|
   (constants.O_NOFOLLOW||0),0o600);
 try{await h.writeFile(value);await h.sync();}finally{await h.close();}
}
async function readPrivateFile(file,max=4096){
 const h=await fs.open(file,constants.O_RDONLY|(constants.O_NOFOLLOW||0));
 try{
  const st=await h.stat();
  if(!st.isFile()||st.size>max||(st.mode&0o077)!==0)
   throw fail('C73_D_WITNESS_FILE_INSECURE');
  return await h.readFile({encoding:'utf8'});
 }finally{await h.close();}
}
async function createDurableWitnessServer({rootPath,clientPublicKey,clientId,clock=()=>new Date()}={}){
 if(typeof rootPath!=='string'||!path.isAbsolute(rootPath)||
  typeof clock!=='function')throw fail('C73_D_SERVER_CONFIG_REQUIRED');
 const root=path.resolve(rootPath);
 await privateDir(root);
 const journalRoot=path.join(root,'journal'),nonceRoot=path.join(root,'nonces');
 await privateDir(journalRoot);await privateDir(nonceRoot);
 const privateFile=path.join(root,'signing-ed25519.pem');
 let privatePem;
 try{privatePem=await readPrivateFile(privateFile);}catch(e){
  if(e.code!=='ENOENT')throw e;
  const keys=generateKeyPairSync('ed25519');
  const material=keys.privateKey.export({format:'pem',type:'pkcs8'});
  try{await persisted(privateFile,material);}catch(e){if(e.code!=='EEXIST')throw e;}
  privatePem=await readPrivateFile(privateFile);
 }
 const privateKey=createPrivateKey(privatePem);
 if(privateKey.asymmetricKeyType!=='ed25519')throw fail('C73_D_SIGNING_KEY_TYPE_INVALID');
 const witnessPublicKey=createPublicKey(privateKey);
 const verifier=createWitnessRequestVerifier({publicKey:clientPublicKey,clientId,clock});
 function now(){
  const v=clock();
  if(!(v instanceof Date)||!Number.isFinite(v.getTime()))throw fail('C73_D_CLOCK_REQUIRED');
  return v.toISOString();
 }
 function journalDir(t,d){return path.join(journalRoot,digest(JSON.stringify([t,d])));}
 async function history(t,d){
  const dir=journalDir(t,d);
  let files;
  try{files=await fs.readdir(dir);}catch(e){if(e.code==='ENOENT')return [];throw e;}
  if(files.length>1000||files.some(x=>!/^\d{6}\.json$/.test(x)))
   throw fail('C73_D_JOURNAL_FORMAT_INVALID');
  files.sort();
  const records=[];
  for(let i=0;i<files.length;i++){
   const name=String(i+1).padStart(6,'0')+'.json';
   if(files[i]!==name)throw fail('C73_D_JOURNAL_SEQUENCE_GAP');
   let record;
   try{record=JSON.parse(await readPrivateFile(path.join(dir,name),4096));}
   catch(e){if(e.code?.startsWith('C73_D_'))throw e;throw fail('C73_D_JOURNAL_RECORD_CORRUPT');}
   receiptValid(record,witnessPublicKey,t,d,i+1);
   records.push(record);
  }
  return records;
 }
 async function advance(body){
  const b=body;
  if(!b||Object.keys(b).length!==6||!id(b.tenantId)||!id(b.documentId)||
   !Number.isSafeInteger(b.revision)||b.revision<1||b.revision>1000||
   !HASH.test(b.headTag||''))
   throw fail('C73_D_ADVANCE_FIELDS_INVALID');
  const dir=journalDir(b.tenantId,b.documentId);
  await privateDir(dir);
  const records=await history(b.tenantId,b.documentId),prev=records.at(-1);
  if(b.revision!==records.length+1||
   (prev?(prev.payload.revision!==b.expectedRevision||
     prev.payload.headTag!==b.expectedHeadTag):
    (b.expectedRevision!==null||b.expectedHeadTag!==null)))
   throw fail('C73_D_ADVANCE_CAS_DENIED');
  const p={version:1,tenantId:b.tenantId,documentId:b.documentId,
   revision:b.revision,headTag:b.headTag,issuedAt:now()};
  const result=signReceipt(p,privateKey);
  const name=String(b.revision).padStart(6,'0')+'.json';
  try{await persisted(path.join(dir,name),JSON.stringify(result));}
  catch(e){if(e.code==='EEXIST')throw fail('C73_D_ADVANCE_CAS_DENIED');throw e;}
  // fsync parent makes the test closer to durable restart, not WORM/DR.
  const parent=await fs.open(dir,constants.O_RDONLY);
  try{await parent.sync();}finally{await parent.close();}
  return result;
 }
 async function authenticated(req,body){
  const auth=verifier({headers:req.headers,method:req.method,route:req.url,body});
  const nonceFile=path.join(nonceRoot,digest(auth.clientId+'\0'+auth.nonce)+'.nonce');
  try{await persisted(nonceFile,auth.issuedAt);}
  catch(e){if(e.code==='EEXIST')throw fail('C73_D_REPLAY_DENIED');throw e;}
 }
 function send(res,status,obj){
  res.writeHead(status,{'Cache-Control':'no-store, private','Content-Type':'application/json',
   'X-Content-Type-Options':'nosniff'});
  res.end(JSON.stringify(obj));
 }
 const server=createServer(async(req,res)=>{
  try{
   let chunks=[],n=0;
   for await(const part of req){
    n+=part.length;if(n>4096)return send(res,413,{error:'BODY_LIMIT'});
    chunks.push(part);
   }
   const raw=Buffer.concat(chunks);
   await authenticated(req,raw);
   if(req.method==='GET'){
    const url=new URL(req.url,'http://127.0.0.1');
    if(url.pathname!=='/checkpoint'||url.searchParams.size!==2||
     !url.searchParams.has('tenantId')||!url.searchParams.has('documentId')||
     !id(url.searchParams.get('tenantId'))||!id(url.searchParams.get('documentId')))
     return send(res,404,{error:'NOT_FOUND'});
    const list=await history(url.searchParams.get('tenantId'),url.searchParams.get('documentId'));
    return send(res,list.length?200:404,list.at(-1)||{error:'CHECKPOINT_MISSING'});
   }
   if(req.method!=='POST'||req.url!=='/advance')
    return send(res,404,{error:'NOT_FOUND'});
   let data;
   try{data=JSON.parse(raw.toString('utf8'));}
   catch{return send(res,400,{error:'JSON_REJECTED'});}
   try{return send(res,200,await advance(data));}
   catch(e){
    return send(res,e.code==='C73_D_ADVANCE_CAS_DENIED'?409:400,{error:'ADVANCE_HOLD'});
   }
  }catch(e){
   const status=e.code?.includes('REPLAY')?409:
    (e.code?.includes('AUTH')||e.code?.includes('SIGNATURE')||
     e.code?.includes('TIME'))?401:503;
   return send(res,status,{error:'WITNESS_HOLD'});
  }
 });
 return Object.freeze({server,
  publicKey:witnessPublicKey.export({format:'pem',type:'spki'}),
  productionIndependentWorm:false,externalSecurityCertified:false});
}
module.exports={createDurableWitnessServer};
