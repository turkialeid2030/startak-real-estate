'use strict';
// Trusted server adapter only. The authenticated vault, not the requester,
// supplies scope. RLS guards query scope, not arbitrary SQL-capable clients.
const {isPlainJson}=require('../validation/plain-json-boundary');
const {VERSION,ENVELOPE_AUTH_VERSION,VERSIONED_KEY_ENVELOPE_AUTH_VERSION}=require('./private-appraisal-evidence-vault');
const REF=/^[A-Za-z0-9_.:-]{2,128}$/,SHA=/^[a-f0-9]{64}$/;
const LIMIT=35*1024*1024;
const expression="((tenant_id = NULLIF(current_setting('startak.tenant_id'::text, true), ''::text)) AND (case_ref = NULLIF(current_setting('startak.case_ref'::text, true), ''::text)))";
function scopeOf(key,x){
 if(!isPlainJson(x)||!x||Object.keys(x).length!==3||!['tenantId','caseRef','evidenceRef'].every(k=>Object.hasOwn(x,k)&&typeof x[k]==='string'&&REF.test(x[k])))throw Error('ENVELOPE_DB_SCOPE_REQUIRED');
 if(key!=='appraisal-evidence:v1:'+encodeURIComponent(x.tenantId)+':'+encodeURIComponent(x.evidenceRef))throw Error('ENVELOPE_DB_KEY_SCOPE_MISMATCH');
 return Object.freeze({tenantId:x.tenantId,caseRef:x.caseRef,evidenceRef:x.evidenceRef});
}
function envelopeOf(raw,s){
 if(typeof raw!=='string'||!raw.length||Buffer.byteLength(raw)>LIMIT)throw Error('ENVELOPE_DB_PAYLOAD_INVALID');
 let v;try{v=JSON.parse(raw);}catch{throw Error('ENVELOPE_DB_PAYLOAD_INVALID');}
 if(!isPlainJson(v)||!v||v.version!==VERSION||![ENVELOPE_AUTH_VERSION,VERSIONED_KEY_ENVELOPE_AUTH_VERSION].includes(v.envelopeAuthVersion)||!Object.keys(s).every(k=>v[k]===s[k])||typeof v.sha256!=='string'||!SHA.test(v.sha256))throw Error('ENVELOPE_DB_PAYLOAD_INVALID');
 const fields=['version','envelopeAuthVersion','tenantId','caseRef','evidenceRef','sha256','uploadedByActorRef','uploadedAt','legalReuseRightsVerified','independentlyProfessionallyReviewed','releaseAuthorized','storageAdapterSecurityVerified','iv','tag','ciphertext'];
 if(v.envelopeAuthVersion===VERSIONED_KEY_ENVELOPE_AUTH_VERSION){fields.push('keyRef');if(typeof v.keyRef!=='string'||!REF.test(v.keyRef))throw Error('ENVELOPE_DB_PAYLOAD_INVALID');}
 if(Object.keys(v).length!==fields.length||!fields.every(k=>Object.hasOwn(v,k))||!['legalReuseRightsVerified','independentlyProfessionallyReviewed','releaseAuthorized','storageAdapterSecurityVerified'].every(k=>v[k]===false))throw Error('ENVELOPE_DB_PAYLOAD_INVALID');
 for(const [k,n] of [['iv',12],['tag',16],['ciphertext',null]]){
  if(typeof v[k]!=='string'||!v[k].length||v[k].length%4!==0)throw Error('ENVELOPE_DB_PAYLOAD_INVALID');
  const b=Buffer.from(v[k],'base64');if(b.toString('base64')!==v[k]||(n!==null?b.length!==n:!b.length||b.length>20*1024*1024))throw Error('ENVELOPE_DB_PAYLOAD_INVALID');
 }
 return raw;
}
function makePostgresPrivateEnvelopeStore({pool,expectedRole,expectedDatabase}={}){
 if(!pool||typeof pool.connect!=='function'||typeof expectedRole!=='string'||!expectedRole||typeof expectedDatabase!=='string'||!expectedDatabase)throw Error('ENVELOPE_DB_CONFIG_REQUIRED');
 async function tx(s,fn){
  const client=await pool.connect();let discard=false;
  try{
   if((await client.query('BEGIN')).command!=='BEGIN')throw Error();
   await client.query('LOCK TABLE public.startak_private_evidence_envelopes IN ACCESS SHARE MODE');
   const identity=await client.query("SELECT current_user AS role_name, current_database() AS database_name,r.rolsuper,r.rolbypassrls,c.relrowsecurity,c.relforcerowsecurity,pg_has_role(current_user,c.relowner,'MEMBER') AS owner_member FROM pg_roles r CROSS JOIN pg_class c WHERE r.rolname=current_user AND c.oid='public.startak_private_evidence_envelopes'::regclass");
   const i=identity.rows?.[0];
   if(identity.rowCount!==1||!i||i.role_name!==expectedRole||i.database_name!==expectedDatabase||i.rolsuper!==false||i.rolbypassrls!==false||i.relrowsecurity!==true||i.relforcerowsecurity!==true||i.owner_member!==false)throw Error();
   const guard=await client.query("SELECT (SELECT count(*)::int FROM pg_policy WHERE polrelid='public.startak_private_evidence_envelopes'::regclass) AS policy_count, EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.startak_private_evidence_envelopes'::regclass AND polname='startak_envelope_scope' AND polcmd='*' AND polpermissive AND polroles=ARRAY[0::oid]) AS expected_policy, (SELECT pg_get_expr(polqual,polrelid) FROM pg_policy WHERE polrelid='public.startak_private_evidence_envelopes'::regclass AND polname='startak_envelope_scope') AS using_expression, (SELECT pg_get_expr(polwithcheck,polrelid) FROM pg_policy WHERE polrelid='public.startak_private_evidence_envelopes'::regclass AND polname='startak_envelope_scope') AS check_expression, has_any_column_privilege(current_user,'public.startak_private_evidence_envelopes','UPDATE') AS can_update, has_table_privilege(current_user,'public.startak_private_evidence_envelopes','DELETE') AS can_delete, has_table_privilege(current_user,'public.startak_private_evidence_envelopes','TRUNCATE') AS can_truncate");
   const g=guard.rows?.[0];
   if(guard.rowCount!==1||!g||g.policy_count!==1||g.expected_policy!==true||g.using_expression!==expression||g.check_expression!==expression||g.can_update!==false||g.can_delete!==false||g.can_truncate!==false)throw Error();
   const context=await client.query("SELECT set_config('startak.tenant_id',$1,true) AS tenant_id,set_config('startak.case_ref',$2,true) AS case_ref",[s.tenantId,s.caseRef]);
   if(context.rowCount!==1||context.rows[0].tenant_id!==s.tenantId||context.rows[0].case_ref!==s.caseRef)throw Error();
   const result=await fn(client);
   if((await client.query('COMMIT')).command!=='COMMIT')throw Error();
   return result;
  }catch{discard=true;try{await client.query('ROLLBACK');}catch{}throw Error('ENVELOPE_DB_TRANSACTION_FAILED');}finally{client.release(discard);}
 }
 async function get(key,scope){const s=scopeOf(key,scope);return tx(s,async c=>{
  const result=await c.query('SELECT envelope FROM public.startak_private_evidence_envelopes WHERE tenant_id=$1 AND case_ref=$2 AND evidence_ref=$3',[s.tenantId,s.caseRef,s.evidenceRef]);
  if(result.rowCount===0)return null;
  if(result.rowCount!==1)throw Error();
  return envelopeOf(result.rows[0].envelope,s);
 });}
 async function putIfAbsent(key,raw,scope){const s=scopeOf(key,scope);envelopeOf(raw,s);return tx(s,async c=>{
  const result=await c.query('INSERT INTO public.startak_private_evidence_envelopes (tenant_id,case_ref,evidence_ref,envelope) VALUES ($1,$2,$3,$4) ON CONFLICT (tenant_id,evidence_ref) DO NOTHING RETURNING evidence_ref',[s.tenantId,s.caseRef,s.evidenceRef,raw]);
  if(result.rowCount===0)return false;
  if(result.rowCount!==1||result.rows[0].evidence_ref!==s.evidenceRef)throw Error();
  return true;
 });}
 return Object.freeze({get,putIfAbsent,productionPersistenceVerified:false});
}
module.exports={makePostgresPrivateEnvelopeStore};
