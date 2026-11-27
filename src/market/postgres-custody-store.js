'use strict';
// PostgreSQL adapter for trusted backend only; never expose query or pool to clients.
// Requires separately applied migration and non-owner, non-bypass RLS role.
const {isPlainJson}=require('../validation/plain-json-boundary');
const {VERSION,custodyEventHash}=require('./signed-evidence-custody');
const REF=/^[A-Za-z0-9_.:-]{2,128}$/,SHA=/^[a-f0-9]{64}$/;
function scoped(s){if(!isPlainJson(s)||!s||Object.keys(s).length!==4||!['tenantId','caseRef','evidenceRef'].every(k=>typeof s[k]==='string'&&REF.test(s[k]))||typeof s.sha256!=='string'||!SHA.test(s.sha256))throw Error('CUSTODY_DB_SCOPE_INVALID');return Object.freeze({tenantId:s.tenantId,caseRef:s.caseRef,evidenceRef:s.evidenceRef,sha256:s.sha256});}
function sameScope(s,x){return isPlainJson(x)&&x&&Object.keys(x).length===4&&Object.keys(s).every(k=>x[k]===s[k]);}
function makePostgresCustodyStore({pool,expectedRole,expectedDatabase}={}){
 if(!pool||typeof pool.connect!=='function'||typeof expectedRole!=='string'||!expectedRole||typeof expectedDatabase!=='string'||!expectedDatabase)throw Error('CUSTODY_DB_CONFIG_REQUIRED');
 async function transaction(s,fn){
  const client=await pool.connect();let discard=false;
  try{
   if((await client.query('BEGIN')).command!=='BEGIN')throw Error();
   await client.query('LOCK TABLE public.startak_evidence_custody IN ACCESS SHARE MODE');
   const identity=await client.query("SELECT current_user AS role_name, current_database() AS database_name, r.rolsuper, r.rolbypassrls, c.relrowsecurity, c.relforcerowsecurity, pg_has_role(current_user,c.relowner,'MEMBER') AS owner_member FROM pg_roles r CROSS JOIN pg_class c WHERE r.rolname=current_user AND c.oid='public.startak_evidence_custody'::regclass");
   const i=identity.rows?.[0];
   if(identity.rowCount!==1||!i||i.role_name!==expectedRole||i.database_name!==expectedDatabase||i.rolsuper!==false||i.rolbypassrls!==false||i.relrowsecurity!==true||i.relforcerowsecurity!==true||i.owner_member!==false)throw Error();
   // Reject unexpected permissive policies and destructive privileges; the trusted backend alone may set session scope.
   const guard=await client.query("SELECT (SELECT count(*)::int FROM pg_policy WHERE polrelid='public.startak_evidence_custody'::regclass) AS policy_count, EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.startak_evidence_custody'::regclass AND polname='startak_custody_scope' AND polcmd='*' AND polpermissive AND polroles=ARRAY[0::oid] AND polqual IS NOT NULL AND polwithcheck IS NOT NULL) AS expected_policy, (SELECT pg_get_expr(polqual,polrelid) FROM pg_policy WHERE polrelid='public.startak_evidence_custody'::regclass AND polname='startak_custody_scope') AS using_expression, (SELECT pg_get_expr(polwithcheck,polrelid) FROM pg_policy WHERE polrelid='public.startak_evidence_custody'::regclass AND polname='startak_custody_scope') AS check_expression, has_table_privilege(current_user,'public.startak_evidence_custody','DELETE') AS can_delete, has_table_privilege(current_user,'public.startak_evidence_custody','TRUNCATE') AS can_truncate");
   const g=guard.rows?.[0];
   // Compare the exact canonical policy expression, not just its name.
   // pg_get_expr adds parentheses and explicit text casts.
   // Keep all parentheses: removing them could make an unsafe expression equivalent.
   const expected="((tenant_id = NULLIF(current_setting('startak.tenant_id'::text, true), ''::text)) AND (case_ref = NULLIF(current_setting('startak.case_ref'::text, true), ''::text)))";
   if(guard.rowCount!==1||!g||g.policy_count!==1||g.expected_policy!==true||g.using_expression!==expected||g.check_expression!==expected||g.can_delete!==false||g.can_truncate!==false)throw Error();
   const context=await client.query("SELECT set_config('startak.tenant_id',$1,true) AS tenant_id, set_config('startak.case_ref',$2,true) AS case_ref",[s.tenantId,s.caseRef]);
   if(context.rowCount!==1||context.rows[0].tenant_id!==s.tenantId||context.rows[0].case_ref!==s.caseRef)throw Error();
   const result=await fn(client);
   if((await client.query('COMMIT')).command!=='COMMIT')throw Error();
   return result;
  }catch{discard=true;try{await client.query('ROLLBACK');}catch{}throw Error('CUSTODY_DB_TRANSACTION_FAILED');}
  finally{client.release(discard);}
 }
 async function loadLedger(input){
  const s=scoped(input);
  return transaction(s,async c=>{
   const result=await c.query('SELECT content_sha256, revision, head_sha256, ledger FROM public.startak_evidence_custody WHERE tenant_id=$1 AND case_ref=$2 AND evidence_ref=$3',[s.tenantId,s.caseRef,s.evidenceRef]);
   if(result.rowCount===0)return null;
   const row=result.rows?.[0],l=row?.ledger,last=l?.events?.at(-1);
   if(result.rowCount!==1||row.content_sha256!==s.sha256||!isPlainJson(l)||l.version!==VERSION||!sameScope(s,l.scope)||!Array.isArray(l.events)||l.events.length!==row.revision||!last||custodyEventHash(s,last.event,last.signature)!==row.head_sha256)throw Error();
   return l;
  });
 }
 async function compareAndAppend({scope,expectedRevision,expectedHeadHashSha256,candidate}={}){
  const s=scoped(scope);
  if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0||expectedRevision>=1000||(expectedRevision===0?expectedHeadHashSha256!==null:typeof expectedHeadHashSha256!=='string'||!SHA.test(expectedHeadHashSha256))||!isPlainJson(candidate)||candidate.version!==VERSION||!sameScope(s,candidate.scope)||!Array.isArray(candidate.events)||candidate.events.length!==expectedRevision+1)throw Error('CUSTODY_DB_APPEND_INVALID');
  const copy=JSON.parse(JSON.stringify(candidate)),last=copy.events.at(-1),head=custodyEventHash(s,last.event,last.signature);
  if(last.event.sequence!==expectedRevision+1||last.event.previousHashSha256!==expectedHeadHashSha256||(expectedRevision?custodyEventHash(s,copy.events[expectedRevision-1].event,copy.events[expectedRevision-1].signature)!==expectedHeadHashSha256:last.event.kind!=='SEALED'))throw Error('CUSTODY_DB_APPEND_PREFIX_INVALID');
  return transaction(s,async c=>{
   const params=[s.tenantId,s.caseRef,s.evidenceRef,s.sha256,expectedRevision+1,head,JSON.stringify(copy)];
   const result=expectedRevision===0?await c.query('INSERT INTO public.startak_evidence_custody (tenant_id,case_ref,evidence_ref,content_sha256,revision,head_sha256,ledger) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb) ON CONFLICT (tenant_id,case_ref,evidence_ref) DO NOTHING RETURNING revision',params):await c.query('UPDATE public.startak_evidence_custody SET revision=$5,head_sha256=$6,ledger=$7::jsonb WHERE tenant_id=$1 AND case_ref=$2 AND evidence_ref=$3 AND content_sha256=$4 AND revision=$8 AND head_sha256=$9 AND ledger->\'events\'=($7::jsonb->\'events\') - $10::integer RETURNING revision',[...params,expectedRevision,expectedHeadHashSha256,expectedRevision]);
   if(result.rowCount===0)return false;
   if(result.rowCount!==1||result.rows[0].revision!==expectedRevision+1)throw Error();
   return true;
  });
 }
 return Object.freeze({loadLedger,compareAndAppend,productionPersistenceVerified:false});
}
module.exports={makePostgresCustodyStore};
