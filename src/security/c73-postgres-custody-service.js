'use strict';
// C73.2 Node/server-only custody, not a production vault. Identity must originate
// from a separately verified, trusted server-side callback (not request claims).
const {createCustodyLedger,appendCustodyEvent,verifyCustodyLedger,EVENT,STATE}
 =require('./c73-signed-document-custody');
const ROLE={
 READ:['CUSTODY_READER','CUSTODY_EDITOR'],OBSERVE:['CUSTODY_EDITOR'],
 RECHECK:['CUSTODY_EDITOR'],REVOKE:['CUSTODY_EDITOR'],
};
function nonEmpty(x){return typeof x==='string'&&x.trim()===x&&x.length>0&&x.length<=180;}
function error(code){const e=new Error(code);e.code=code;return e;}
function authorizedIdentity(ctx,action){
 if(!ctx||ctx.status!=='VERIFIED_CONTEXT'||ctx.authorizationReady!==true||
   !ctx.identity||!nonEmpty(ctx.identity.tenantId)||
   !nonEmpty(ctx.identity.actorId)||!nonEmpty(ctx.identity.subject)||
   ctx.identity.actorId!==ctx.identity.subject||
   !Array.isArray(ctx.identity.roles)||
   !ctx.identity.roles.some(r=>ROLE[action].includes(r)))
   throw error('C73_TRUSTED_IDENTITY_OR_ROLE_REQUIRED');
 return ctx.identity;
}
function createPostgresCustodyService({pool,verifyRequest,key,keyRef,clock}={}){
 if(!pool||typeof pool.connect!=='function'||typeof verifyRequest!=='function'||
   typeof clock!=='function'||!(Buffer.isBuffer(key)||key instanceof Uint8Array)||
   key.byteLength<32||!nonEmpty(keyRef))
   throw error('C73_TRUSTED_SERVER_DEPENDENCIES_REQUIRED');
 async function authenticated(request,action){
  // The request and all its tenant/actor claims are UNTRUSTED.
  const ctx=await verifyRequest(request);
  return authorizedIdentity(ctx,action);
 }
 function now(){
  const v=clock();
  if(!(v instanceof Date)||!Number.isFinite(v.getTime()))
    throw error('C73_TRUSTED_SERVER_CLOCK_REQUIRED');
  return v.toISOString();
 }
 async function transaction(tenantId,fn){
  const client=await pool.connect();
  let open=false;
  try{
   await client.query('BEGIN');open=true;
   await client.query("SELECT set_config('app.tenant_id',$1,true)",[tenantId]);
   const result=await fn(client);
   await client.query('COMMIT');open=false;
   return result;
  }catch(e){
   if(open)try{await client.query('ROLLBACK');}catch(_){}
   throw e;
  }finally{client.release();}
 }
 function desiredScope(ledger){
  const s=ledger.scope;
  return Object.fromEntries([
   'tenantId','caseId','projectId','propertyRef','valuationDate','documentId',
   'evidenceType','referenceId','artifactVersion'].map(k=>[k,s[k]]));
 }
 function verified(ledger,head,assessedAt){
  const v=verifyCustodyLedger(ledger,{
   key,keyRef,expectedScope:desiredScope(ledger),
   expectedHeadTag:head.head_tag,expectedRevision:head.revision,
   assessedAt,maxAgeSeconds:315360000,
  });
  if(![STATE.INTEGRITY_MATCHED_UNVERIFIED,STATE.HOLD_REVOKED].includes(v.status))
   throw error('C73_PERSISTED_LEDGER_INTEGRITY_FAILED:'+v.status);
  return v;
 }
 async function observe({request,scope,bytes}={}){
  const actor=await authenticated(request,'OBSERVE');
  if(!scope||typeof scope!=='object'||Array.isArray(scope)||
     scope.tenantId!==actor.tenantId)
   throw error('C73_TENANT_SCOPE_DENIED');
  const ledger=createCustodyLedger({key,keyRef,scope,bytes,actorRef:actor.actorId,observedAt:now()});
  return transaction(actor.tenantId,async(client)=>{
   try{
    const inserted=await client.query(
      'INSERT INTO c73.custody_heads(tenant_id,document_id,revision,head_tag,ledger) VALUES($1,$2,$3,$4,$5::jsonb) RETURNING revision',
      [actor.tenantId,ledger.scope.documentId,1,ledger.headTag,JSON.stringify(ledger)]);
    if(inserted.rowCount!==1)throw error('C73_INSERT_NOT_COMMITTED');
    await client.query(
      'INSERT INTO c73.custody_events(tenant_id,document_id,revision,event_tag,event_json) VALUES($1,$2,$3,$4,$5::jsonb)',
      [actor.tenantId,ledger.scope.documentId,1,ledger.headTag,JSON.stringify(ledger.events[0])]);
   }catch(e){if(e.code==='23505')throw error('C73_DOCUMENT_ALREADY_EXISTS');throw e;}
   return {ledger,verdict:verified(ledger,{head_tag:ledger.headTag,revision:1},now())};
  });
 }
 async function get({request,documentId}={}){
  const actor=await authenticated(request,'READ');
  if(!nonEmpty(documentId))throw error('C73_DOCUMENT_ID_REQUIRED');
  return transaction(actor.tenantId,async(client)=>{
   const rows=await client.query(
    'SELECT revision,head_tag,ledger FROM c73.custody_heads WHERE tenant_id=$1 AND document_id=$2',
    [actor.tenantId,documentId]);
   if(rows.rowCount!==1)throw error('C73_DOCUMENT_NOT_FOUND');
   const h=rows.rows[0],verdict=verified(h.ledger,h,now());
   return {ledger:h.ledger,verdict};
  });
 }
 async function change({request,documentId,kind,bytes,expectedRevision,expectedHeadTag}={}){
  if(![EVENT.RECHECKED,EVENT.REVOKED].includes(kind))
   throw error('C73_UNSUPPORTED_CUSTODY_ACTION');
  const actor=await authenticated(request,kind===EVENT.RECHECKED?'RECHECK':'REVOKE');
  if(!nonEmpty(documentId)||!Number.isSafeInteger(expectedRevision)||
     expectedRevision<1||typeof expectedHeadTag!=='string'||!/^([a-f0-9]{64})$/.test(expectedHeadTag))
   throw error('C73_EXPLICIT_CONCURRENCY_TOKEN_REQUIRED');
  return transaction(actor.tenantId,async(client)=>{
   const r=await client.query(
    'SELECT revision,head_tag,ledger FROM c73.custody_heads WHERE tenant_id=$1 AND document_id=$2 FOR UPDATE',
    [actor.tenantId,documentId]);
   if(r.rowCount!==1)throw error('C73_DOCUMENT_NOT_FOUND');
   const h=r.rows[0];
   if(h.revision!==expectedRevision||h.head_tag!==expectedHeadTag)
    throw error('C73_STALE_CUSTODY_REVISION');
   const result=verified(h.ledger,h,now());
   if(result.status!==STATE.INTEGRITY_MATCHED_UNVERIFIED)
    throw error('C73_CUSTODY_NOT_ACTIVE:'+result.status);
   const ledger=appendCustodyEvent(h.ledger,{
    key,keyRef,expectedScope:desiredScope(h.ledger),
    expectedHeadTag:h.head_tag,expectedRevision:h.revision,bytes,
    actorRef:actor.actorId,observedAt:now(),kind,
   });
   const update=await client.query(
    'UPDATE c73.custody_heads SET revision=$3,head_tag=$4,ledger=$5::jsonb,updated_at=now() WHERE tenant_id=$1 AND document_id=$2 AND revision=$6 AND head_tag=$7',
    [actor.tenantId,documentId,ledger.events.length,ledger.headTag,
     JSON.stringify(ledger),h.revision,h.head_tag]);
   if(update.rowCount!==1)throw error('C73_STALE_CUSTODY_REVISION');
   await client.query(
    'INSERT INTO c73.custody_events(tenant_id,document_id,revision,event_tag,event_json) VALUES($1,$2,$3,$4,$5::jsonb)',
    [actor.tenantId,documentId,ledger.events.length,ledger.headTag,
     JSON.stringify(ledger.events.at(-1))]);
   return {ledger,verdict:verified(ledger,{
    head_tag:ledger.headTag,revision:ledger.events.length},now())};
  });
 }
 return Object.freeze({
  observe,get,recheck:x=>change({...x,kind:EVENT.RECHECKED}),
  revoke:x=>change({...x,kind:EVENT.REVOKED}),
  productionVaultReady:false,sourceRightsAuthenticated:false,
  professionalValuationAuthorized:false,
 });
}
module.exports={createPostgresCustodyService};
