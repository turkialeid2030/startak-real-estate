'use strict';
// Server-side append coordinator. Storage CAS and independently durable witness
// are injected trust boundaries. A failed witness leaves HOLD, never a success.
const {VERSION,custodyEventBytes,custodyEventHash,verifyCustodyChain}=require('./signed-evidence-custody');
const {isPlainJson}=require('../validation/plain-json-boundary');
const {strictCalendarDateMs}=require('../validation/strict-calendar-instant');
const crypto=require('node:crypto');
const REF=/^[A-Za-z0-9_.:-]{2,128}$/,SHA=/^[a-f0-9]{64}$/;
const exact=(x,k)=>isPlainJson(x)&&!!x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===k.length&&k.every(a=>Object.hasOwn(x,a));
const validRef=x=>typeof x==='string'&&REF.test(x);
const validHash=x=>typeof x==='string'&&SHA.test(x);
const held=reason=>Object.freeze({status:'HOLD_CUSTODY_APPEND',reason,revision:null,headHashSha256:null,productionVaultReady:false,releaseAuthorized:false});
const scopeEqual=(a,b)=>exact(a,['tenantId','caseRef','evidenceRef','sha256'])&&['tenantId','caseRef','evidenceRef','sha256'].every(k=>a[k]===b[k]);
function makeCustodyAppendCoordinator({authorizeActor,loadLedger,loadCheckpoint,resolveSigner,signEvent,compareAndAppend,advanceWitness,authorizeReconciliation,clock=()=>new Date()}={}){
 if(![authorizeActor,loadLedger,loadCheckpoint,resolveSigner,signEvent,compareAndAppend,advanceWitness,clock].every(x=>typeof x==='function'))throw Error('CUSTODY_APPEND_TRUST_DEPENDENCIES_REQUIRED');
 async function append({actor,scope,kind,signerKeyRef,sourceBytes}={}){
  try{
   if(!exact(scope,['tenantId','caseRef','evidenceRef','sha256'])||![scope.tenantId,scope.caseRef,scope.evidenceRef,signerKeyRef].every(validRef)||!validHash(scope.sha256)||!['SEALED','RECHECKED','REVOKED'].includes(kind))return held('CUSTODY_APPEND_SCOPE_INVALID');
   const s=Object.freeze({...scope});
   if(kind!=='REVOKED'&&(!Buffer.isBuffer(sourceBytes)||!sourceBytes.length||sourceBytes.length>20*1024*1024||crypto.createHash('sha256').update(sourceBytes).digest('hex')!==s.sha256))return held('CUSTODY_APPEND_BYTES_MISMATCH');
   const identity=await authorizeActor({requestActor:actor,tenantId:s.tenantId,caseRef:s.caseRef,action:'CUSTODY_'+kind});
   if(!isPlainJson(identity)||!identity||identity===actor||identity.verifiedByServer!==true||identity.tenantId!==s.tenantId||!Array.isArray(identity.caseRefs)||!identity.caseRefs.includes(s.caseRef)||!validRef(identity.actorId)||!(kind==='REVOKED'?['DATA_ADMIN']:['DATA_ADMIN','REVIEWER']).includes(identity.role))return held('CUSTODY_APPEND_ACCESS_DENIED');
   const actorRef=identity.actorId;
   const ledger=await loadLedger(s),checkpoint=await loadCheckpoint(s);
   const now=clock().toISOString(),ms=strictCalendarDateMs(now);
   if(!Number.isFinite(ms)||ms>Date.now())return held('CUSTODY_APPEND_CLOCK_INVALID');
   let events=[],previous=null,revision=0;
   if(kind==='SEALED'){
    if(ledger!==null||checkpoint!==null)return held('CUSTODY_APPEND_ALREADY_EXISTS_OR_UNRECONCILED');
   }else{
    const verdict=await verifyCustodyChain(ledger,{expectedScope:s,checkpoint,resolveSigner,now,maxAgeSeconds:31536000});
    if(!verdict.integrityVerified)return held('CUSTODY_APPEND_CURRENT_HEAD_NOT_QUALIFIED');
    revision=verdict.revision;previous=verdict.headHashSha256;
    if(revision>=1000)return held('CUSTODY_APPEND_LIMIT');
    // Copy and reverify before use to prevent mutation across awaits.
    events=JSON.parse(JSON.stringify(ledger.events));
    const copied=await verifyCustodyChain({version:VERSION,scope:s,events},{expectedScope:s,checkpoint:{version:VERSION,scope:s,revision,headHashSha256:previous},resolveSigner,now,maxAgeSeconds:31536000});
    if(!copied.integrityVerified||strictCalendarDateMs(events.at(-1).event.observedAt)>=ms)return held('CUSTODY_APPEND_PRIOR_STATE_CHANGED');
   }
   const event=Object.freeze({sequence:revision+1,kind,actorRef,observedAt:now,signerKeyRef,previousHashSha256:previous});
   const signed=await signEvent({tenantId:s.tenantId,signerKeyRef,bytes:custodyEventBytes(s,event)});
   if(typeof signed!=='string')return held('CUSTODY_APPEND_SIGNATURE_REQUIRED');
   const newHead=custodyEventHash(s,event,signed);
   const candidate={version:VERSION,scope:s,events:[...events,{event,signature:signed}]};
   const next={version:VERSION,scope:s,revision:revision+1,headHashSha256:newHead};
   const verdict=await verifyCustodyChain(candidate,{expectedScope:s,checkpoint:next,resolveSigner,now,maxAgeSeconds:31536000});
   if(kind==='REVOKED'?verdict.reason!=='CUSTODY_REVOKED':!verdict.integrityVerified)return held('CUSTODY_APPEND_SIGNATURE_OR_CHAIN_INVALID');
   // CAS is atomic in the backing adapter. The witness is a separate service;
   // if witness fails, do not undo or retry the committed append automatically.
   if(await compareAndAppend({scope:s,expectedRevision:revision,expectedHeadHashSha256:previous,candidate:JSON.parse(JSON.stringify(candidate))})!==true)return held('CUSTODY_APPEND_CONFLICT');
   if(await advanceWitness({scope:s,expectedRevision:revision,expectedHeadHashSha256:previous,nextCheckpoint:JSON.parse(JSON.stringify(next))})!==true)return held('CUSTODY_APPEND_WITNESS_PENDING');
   const reread=await loadCheckpoint(s);
   if(!exact(reread,['version','scope','revision','headHashSha256'])||reread.version!==VERSION||!scopeEqual(reread.scope,s)||reread.revision!==next.revision||reread.headHashSha256!==newHead)return held('CUSTODY_APPEND_WITNESS_NOT_CONFIRMED');
   const persisted=await loadLedger(s);
   const confirmed=await verifyCustodyChain(persisted,{expectedScope:s,checkpoint:reread,resolveSigner,now,maxAgeSeconds:31536000});
   if(kind==='REVOKED'?confirmed.reason!=='CUSTODY_REVOKED':!confirmed.integrityVerified)return held('CUSTODY_APPEND_PERSISTED_CHAIN_NOT_CONFIRMED');
   return Object.freeze({status:'CUSTODY_APPEND_CONFIRMED_BY_PROVIDERS',reason:null,revision:next.revision,headHashSha256:newHead,revoked:kind==='REVOKED',productionVaultReady:false,releaseAuthorized:false});
  }catch{return held('CUSTODY_APPEND_FAILED_RECONCILIATION_REQUIRED');}
 }
 // Recover only a single persisted, signed event beyond an independently
 // trusted head. No signing, rollback, chain replacement or blind fast-forward.
 async function reconcile({actor,scope,changeControlRef}={}){
  try{
   if(!exact(scope,['tenantId','caseRef','evidenceRef','sha256'])||![scope.tenantId,scope.caseRef,scope.evidenceRef,changeControlRef].every(validRef)||!validHash(scope.sha256)||typeof authorizeReconciliation!=='function')return held('CUSTODY_RECONCILIATION_APPROVAL_REQUIRED');
   const s=Object.freeze({...scope});
   const identity=await authorizeActor({requestActor:actor,tenantId:s.tenantId,caseRef:s.caseRef,action:'CUSTODY_RECONCILE'});
   if(!isPlainJson(identity)||!identity||identity===actor||identity.verifiedByServer!==true||identity.tenantId!==s.tenantId||identity.role!=='DATA_ADMIN'||!validRef(identity.actorId)||!Array.isArray(identity.caseRefs)||!identity.caseRefs.includes(s.caseRef))return held('CUSTODY_APPEND_ACCESS_DENIED');
   const actorId=identity.actorId;
   const raw=await loadLedger(s),head=await loadCheckpoint(s);
   if(!exact(raw,['version','scope','events'])||raw.version!==VERSION||!scopeEqual(raw.scope,s)||!Array.isArray(raw.events)||!raw.events.length||raw.events.length>1000)return held('CUSTODY_RECONCILIATION_LEDGER_INVALID');
   const ledger=JSON.parse(JSON.stringify(raw));
   if(head!==null&&(!exact(head,['version','scope','revision','headHashSha256'])||head.version!==VERSION||!scopeEqual(head.scope,s)||!Number.isSafeInteger(head.revision)||head.revision<1||!validHash(head.headHashSha256)))return held('CUSTODY_RECONCILIATION_HEAD_INVALID');
   const revision=head?.revision??0,previous=head?.headHashSha256??null,now=clock().toISOString();
   if(ledger.events.length!==revision+1)return held('CUSTODY_RECONCILIATION_EXACTLY_ONE_PENDING_REQUIRED');
   if(revision){
    const prefix=await verifyCustodyChain({...ledger,events:ledger.events.slice(0,revision)},{expectedScope:s,checkpoint:{version:VERSION,scope:s,revision,headHashSha256:previous},resolveSigner,now,maxAgeSeconds:31536000});
    if(!prefix.integrityVerified)return held('CUSTODY_RECONCILIATION_PREFIX_INVALID');
   }
   const last=ledger.events.at(-1),newHead=custodyEventHash(s,last.event,last.signature);
   const next={version:VERSION,scope:s,revision:revision+1,headHashSha256:newHead};
   const verdict=await verifyCustodyChain(ledger,{expectedScope:s,checkpoint:next,resolveSigner,now,maxAgeSeconds:31536000});
   if(!verdict.integrityVerified&&verdict.reason!=='CUSTODY_REVOKED')return held('CUSTODY_RECONCILIATION_PENDING_SIGNATURE_INVALID');
   const approval=await authorizeReconciliation({scope:s,changeControlRef,actorId,expectedRevision:revision,expectedHeadHashSha256:previous,nextRevision:next.revision,nextHeadHashSha256:newHead});
   if(!isPlainJson(approval)||!approval||approval.approved!==true||approval.changeControlRef!==changeControlRef||approval.actorId!==actorId||!validRef(approval.reviewerId)||approval.reviewerId===actorId||!scopeEqual(approval.scope,s)||approval.expectedRevision!==revision||approval.expectedHeadHashSha256!==previous||approval.nextRevision!==next.revision||approval.nextHeadHashSha256!==newHead||!Number.isFinite(strictCalendarDateMs(approval.approvedAt))||strictCalendarDateMs(approval.approvedAt)<strictCalendarDateMs(last.event.observedAt)||strictCalendarDateMs(approval.approvedAt)>strictCalendarDateMs(now))return held('CUSTODY_RECONCILIATION_APPROVAL_INVALID');
   // Re-read the pending chain before advancing; append remains blocked while
   // the old checkpoint is behind. A competing recovery loses witness CAS.
   const check=await verifyCustodyChain(await loadLedger(s),{expectedScope:s,checkpoint:next,resolveSigner,now,maxAgeSeconds:31536000});
   if(!check.integrityVerified&&check.reason!=='CUSTODY_REVOKED')return held('CUSTODY_RECONCILIATION_LEDGER_CHANGED');
   if(await advanceWitness({scope:s,expectedRevision:revision,expectedHeadHashSha256:previous,nextCheckpoint:JSON.parse(JSON.stringify(next))})!==true)return held('CUSTODY_RECONCILIATION_WITNESS_PENDING');
   const confirmed=await loadCheckpoint(s);
   if(!exact(confirmed,['version','scope','revision','headHashSha256'])||confirmed.version!==VERSION||!scopeEqual(confirmed.scope,s)||confirmed.revision!==next.revision||confirmed.headHashSha256!==newHead)return held('CUSTODY_RECONCILIATION_WITNESS_NOT_CONFIRMED');
   const verified=await verifyCustodyChain(await loadLedger(s),{expectedScope:s,checkpoint:confirmed,resolveSigner,now,maxAgeSeconds:31536000});
   if(!verified.integrityVerified&&verified.reason!=='CUSTODY_REVOKED')return held('CUSTODY_RECONCILIATION_FINAL_CHAIN_INVALID');
   return Object.freeze({status:'CUSTODY_RECONCILIATION_CONFIRMED_BY_PROVIDERS',reason:null,revision:next.revision,headHashSha256:newHead,revoked:verified.reason==='CUSTODY_REVOKED',productionVaultReady:false,releaseAuthorized:false});
  }catch{return held('CUSTODY_RECONCILIATION_FAILED');}
 }
 return Object.freeze({append,reconcile});
}
module.exports={makeCustodyAppendCoordinator};
