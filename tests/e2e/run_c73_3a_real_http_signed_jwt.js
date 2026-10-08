'use strict';
// C73.3A: real loopback HTTP + RSA-signed OIDC JWT + PostgreSQL 16 e2e.
// Keys, identity, documents and database are completely synthetic.
const assert=require('node:assert/strict');
const {createServer}=require('node:http');
const {generateKeyPairSync,createSign}=require('node:crypto');
const fs=require('node:fs'),path=require('node:path');
const {Pool}=require('pg');
const {createOidcBearerAuthenticator}=require('../../src/security/oidc-bearer-authenticator');
const {createPostgresCustodyService}=require('../../src/security/c73-postgres-custody-service');
const {createCustodyHttpHandler}=require('../../src/security/c73-http-custody-gateway');
const {STATE}=require('../../src/security/c73-signed-document-custody');
const PDF=Buffer.from('%PDF-1.4\nC73_3A_SYNTHETIC_SENSITIVE_BYTES\n');
const key=require('node:crypto').randomBytes(32);
const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...publicKey.export({format:'jwk'}),kid:'key-1',use:'sig',alg:'RS256'};
const ISS='https://synthetic-idp.example.invalid/',AUD='startak-staging-custody';
const baseEpoch=Math.floor(Date.parse('2026-10-08T15:00:00Z')/1000);
const admin=new Pool({host:'127.0.0.1',port:5432,user:'postgres',
 password:process.env.C73_TEST_POSTGRES_PASSWORD||'local-ci-only',database:'postgres'});
let app,server,checks=0;
function check(ok,msg){assert.ok(ok,msg);checks++;}
function jwt(payload,header={}){
 const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 const data=enc({alg:'RS256',typ:'JWT',kid:'key-1',...header})+'.'+enc(payload);
 const signature=createSign('RSA-SHA256').update(data).end().sign(privateKey).toString('base64url');
 return data+'.'+signature;
}
function token(tenant='tenant-a',roles=['CUSTODY_EDITOR'],sub='editor-a',extra={}){
 return jwt({iss:ISS,aud:AUD,sub,tenant_id:tenant,roles,
  exp:baseEpoch+3600,iat:baseEpoch-30,nbf:baseEpoch-60,...extra});
}
function scope(tenant,doc='DOC-HTTP'){
 return {tenantId:tenant,caseId:'CASE-'+tenant,projectId:'PROJECT-'+tenant,
  propertyRef:'PROPERTY-'+tenant,valuationDate:'2026-10-08',
  documentId:doc,evidenceType:'inspection',referenceId:'INSPECT-'+tenant,
  artifactVersion:1,mediaType:'application/pdf'};
}
let base;
async function call(method,url,t,body,headers={}){
 const res=await fetch(base+url,{method,headers:{
  ...(t?{Authorization:'Bearer '+t}:{}),
  ...(body!==undefined?{'Content-Type':'application/json'}:{}),...headers,
 },...(body!==undefined?{body:JSON.stringify(body)}:{})});
 const text=await res.text();
 let content;try{content=JSON.parse(text)}catch{throw Error('INVALID_API_RESPONSE '+text.slice(0,120))}
 return {status:res.status,data:content,headers:res.headers,raw:text};
}
const enc=buf=>buf.toString('base64');
async function run(){
 await admin.query("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='c73_app') THEN CREATE ROLE c73_app LOGIN PASSWORD 'ci-test-only' NOSUPERUSER NOBYPASSRLS; END IF; END $$");
 await admin.query(fs.readFileSync(path.join(__dirname,'../../sql/c73_transactional_custody.sql'),'utf8'));
 app=new Pool({host:'127.0.0.1',port:5432,user:'c73_app',password:'ci-test-only',database:'postgres',max:8});
 const authenticator=createOidcBearerAuthenticator({
  issuer:ISS,audience:AUD,jwksProvider:{getJwks:async()=>({keys:[jwk]})},
  clockToleranceSeconds:0,maxTokenAgeSeconds:7200,
 });
 let clockTick=baseEpoch*1000;
 const now=()=>new Date(clockTick+=1000);
 const service=createPostgresCustodyService({pool:app,key,keyRef:'synthetic-http-hmac',clock:now,
  // Only internal server envelope post-authentication; JSON fields are not read.
  verifyRequest:async r=>r?.__verifiedIdentity||null,
 });
 server=createServer(createCustodyHttpHandler({authenticator,custodyService:service,clock:now}));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 base='http://127.0.0.1:'+server.address().port;
 const a=token(),b=token('tenant-b',['CUSTODY_EDITOR'],'editor-b');
 const viewer=token('tenant-a',['CUSTODY_READER'],'viewer-a');
 const observed={scope:scope('tenant-a'),bytesBase64:enc(PDF)};
 const first=await call('POST','/v1/custody',a,observed);
 check(first.status===201,'synthetic authorized observation accepted');
 check(first.data.ledger.events.length===1,'one signed event');
 check(first.data.verdict.status===STATE.INTEGRITY_MATCHED_UNVERIFIED,'not official source verification');
 check(first.data.verdict.professionalReportAuthorized===false &&
  first.data.verdict.sourceRightsVerified===false,'official authority blocked');
 check(!first.raw.includes('C73_3A_SYNTHETIC_SENSITIVE_BYTES')&&
  !first.raw.includes(enc(PDF)),'no file payload in returned metadata');
 check(first.headers.get('cache-control').includes('no-store'),'HTTP no store');
 check(first.headers.get('x-content-type-options')==='nosniff','JSON security header');
 const firstB=await call('POST','/v1/custody',b,{scope:scope('tenant-b'),bytesBase64:enc(PDF)});
 check(firstB.status===201&&firstB.data.ledger.scope.tenantId==='tenant-b',
  'same document ID in distinct tenant succeeds');
 const getA=await call('GET','/v1/custody/DOC-HTTP',a);
 check(getA.status===200&&getA.data.ledger.scope.tenantId==='tenant-a','A read isolated');
 const getB=await call('GET','/v1/custody/DOC-HTTP',b);
 check(getB.status===200&&getB.data.ledger.scope.tenantId==='tenant-b','B read isolated');
 const viewerGet=await call('GET','/v1/custody/DOC-HTTP',viewer);
 check(viewerGet.status===200,'read-only role can read tenant record');
 const actorSpoof=await call('POST','/v1/custody',a,{
  scope:scope('tenant-b','ATTACK'),bytesBase64:enc(PDF)});
 check(actorSpoof.status===403,'JSON tenant spoof cannot become tenant B');
 const viewWrite=await call('POST','/v1/custody',viewer,observed);
 check(viewWrite.status===403,'reader cannot upload');
 const noToken=await call('GET','/v1/custody/DOC-HTTP',null);
 check(noToken.status===401,'missing bearer rejected');
 const badToken=await call('GET','/v1/custody/DOC-HTTP',a.slice(0,-2)+'zz');
 check(badToken.status===401,'bad JWT signature refused');
 const exp=await call('GET','/v1/custody/DOC-HTTP',token('tenant-a',['CUSTODY_EDITOR'],'editor-a',{exp:baseEpoch-1}));
 check(exp.status===401,'expired JWT refused');
 const aud=await call('GET','/v1/custody/DOC-HTTP',token('tenant-a',['CUSTODY_EDITOR'],'editor-a',{aud:'wrong-audience'}));
 check(aud.status===401,'wrong audience refused');
 const iss=await call('GET','/v1/custody/DOC-HTTP',token('tenant-a',['CUSTODY_EDITOR'],'editor-a',{iss:'https://evil.invalid'}));
 check(iss.status===401,'wrong issuer refused');
 const unsigned=await call('GET','/v1/custody/DOC-HTTP','not.a.jwt');
 check(unsigned.status===401,'malformed JWT refused');
 const cookie=await call('GET','/v1/custody/DOC-HTTP',a,undefined,{Cookie:'session=spoofed'});
 check(cookie.status===403,'cookie session forbidden');
 const query=await call('GET','/v1/custody/DOC-HTTP?token=secret',a);
 check(query.status===400,'URL query data forbidden');
 const typo=await call('POST','/v1/custody',a,{...observed,sourceRightsVerified:true});
 check(typo.status===400,'extra user authority field refused');
 const forged=await call('POST','/v1/custody',a,{scope:{...scope('tenant-a','FRAUD'),
  sourceIndependentlyVerified:true},bytesBase64:enc(PDF)});
 check(forged.status===400,'forged independent proof refused');
 const wrongType=await call('POST','/v1/custody',a,{scope:{...scope('tenant-a','BAD-MIME'),mediaType:'image/png'},bytesBase64:enc(PDF)});
 check(wrongType.status===400||wrongType.status===500,'spoofed MIME cannot ingest');
 const wrongBase64=await call('POST','/v1/custody',a,{scope:scope('tenant-a','BAD-B64'),bytesBase64:'!!!!'});
 check(wrongBase64.status===400,'bad base64 refused');
 const wrongHeader=await call('POST','/v1/custody',a,observed,{'Content-Type':'text/plain'});
 check(wrongHeader.status===415,'unexpected media rejected');
 const noServiceRoute=await call('GET','/v1/status',a);
 check(noServiceRoute.status===404,'unknown route rejected');
 const miss=await call('GET','/v1/custody/NEVER-EXISTS',a);
 check(miss.status===404,'unknown document does not leak');
 const duplicate=await call('POST','/v1/custody',a,observed);
 check(duplicate.status===409,'duplicate name rejected');
 const badChange=await call('POST','/v1/custody/DOC-HTTP/recheck',a,{
  bytesBase64:enc(PDF),expectedRevision:999,expectedHeadTag:first.data.ledger.headTag});
 check(badChange.status===409,'stale CAS HTTP rejected');
 const changed=Buffer.from(PDF);changed[13]^=1;
 const tamper=await call('POST','/v1/custody/DOC-HTTP/recheck',a,{
  bytesBase64:enc(changed),expectedRevision:1,expectedHeadTag:first.data.ledger.headTag});
 check(tamper.status!==200,'changed bytes refused');
 const update=await call('POST','/v1/custody/DOC-HTTP/recheck',a,{
  bytesBase64:enc(PDF),expectedRevision:1,expectedHeadTag:first.data.ledger.headTag});
 check(update.status===200&&update.data.ledger.events.length===2,'signed HTTP recheck');
 const rev=await call('POST','/v1/custody/DOC-HTTP/revoke',a,{
  expectedRevision:2,expectedHeadTag:update.data.ledger.headTag});
 check(rev.status===200&&rev.data.verdict.status===STATE.HOLD_REVOKED,'HTTP revoked');
 const again=await call('POST','/v1/custody/DOC-HTTP/recheck',a,{
  bytesBase64:enc(PDF),expectedRevision:3,expectedHeadTag:rev.data.ledger.headTag});
 check(again.status!==200,'recheck revoked denied');
 const end=await call('GET','/v1/custody/DOC-HTTP',a);
 check(end.status===200&&end.data.verdict.status===STATE.HOLD_REVOKED,'revoked persisted');
 check(!end.raw.includes(enc(PDF)),'retrieved manifest contains no bytes');
 const ambient=await app.query('SELECT * FROM c73.custody_heads');
 check(ambient.rowCount===0,'no leaked ambient tenant on pooled DB');
 console.log('C73_3A_REAL_HTTP_RSA_JWT_POSTGRES_CUSTODY=PASS checks='+checks);
 console.log('C73_3A_PRODUCTION_JWKS_IDP_VAULT_RIGHTS=HOLD');
}
run().catch(e=>{console.error('C73_3A_REAL_HTTP_RSA_JWT_POSTGRES_CUSTODY=FAIL',e);process.exitCode=1;})
 .finally(async()=>{if(server)await new Promise(r=>server.close(r));if(app)await app.end();await admin.end();});
