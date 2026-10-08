'use strict';
// C73.5 - Verify a two-of-three independently pinned OFFLINE Ed25519 root
// signatures over the exact issuer registry. NEVER claims that the configured
// root keys are legitimate, that the issuers hold their alleged authority, or
// that verified documents constitute production GO authorization.
const {createPublicKey,createHash,verify}=require('node:crypto');
const {GATES,verifyExternalReadinessEvidence}=require('./c73-external-readiness-approval-gate');
const DOMAIN='STARTAK:C73.5:ROOT-TRUST-REGISTRY:V1\n';
const ROOTS=3,QUORUM=2;
const SHAS=/^[a-f0-9]{40}$/;
const ID=/^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/;
const SIGNATURE=/^[A-Za-z0-9_-]{86}$/;
const TIME=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;
const PEM_FIELD=['issuerId','gateId','role','publicKey'];
const POLICY_FIELDS=['version','epoch','environment','targetSha','issuedAt','expiresAt','issuers','revokedIssuerIds'];
function bad(code){const e=new Error(code);e.code=code;return e;}
function exact(x,fields){return x&&typeof x==='object'&&!Array.isArray(x)&&
 Object.keys(x).length===fields.length&&fields.every(k=>Object.hasOwn(x,k));}
function date(x){
 if(typeof x!=='string'||!TIME.test(x))return NaN;
 const n=Date.parse(x);return Number.isFinite(n)&&new Date(n).toISOString()===x?n:NaN;
}
function loadEdPub(x){
 try{
  const key=x?.type==='public'?x:createPublicKey(x);
  if(key.asymmetricKeyType!=='ed25519')return null;
  return key;
 }catch{return null;}
}
function fingerprint(key){return createHash('sha256').update(key.export({format:'der',type:'spki'})).digest('hex');}
function statusHold(reasons,info={}){
 return Object.freeze({status:'HOLD_UNTRUSTED_P0_ROOT_REGISTRY',
  reasonCodes:Object.freeze([...new Set(reasons)]),
  quorumVerified:false,approvalForProduction:false,professionalValuationAuthorized:false,
  transactionAuthorized:false,independentExternalAuthorityVerified:false,
  rootKeyLifecycleExternallyQualified:false,
  ...info});
}
function verifyRootQuorumRegistry({
 manifest,signatures,pinnedRootKeys,minimumEpoch,environment,targetSha,
 now=()=>new Date()
}={}){
 const errors=[];
 if(!manifest||!exact(manifest,POLICY_FIELDS)||!Array.isArray(signatures)||
   !pinnedRootKeys||typeof pinnedRootKeys!=='object'||Array.isArray(pinnedRootKeys)||
   !Number.isSafeInteger(minimumEpoch)||minimumEpoch<1||
   typeof environment!=='string'||!ID.test(environment)||!SHAS.test(targetSha||'')){
  return statusHold(['REGISTRY_INPUT_MISSING_OR_INVALID']);
 }
 const right=now();
 if(!(right instanceof Date)||!Number.isFinite(right.getTime()))
  return statusHold(['TRUSTED_CLOCK_INVALID']);
 if(manifest.version!==1||!Number.isSafeInteger(manifest.epoch)||manifest.epoch<minimumEpoch||
  manifest.environment!==environment||manifest.targetSha!==targetSha||
  !Array.isArray(manifest.issuers)||manifest.issuers.length!==8||
  !Array.isArray(manifest.revokedIssuerIds)||
  manifest.revokedIssuerIds.some(id=>typeof id!=='string'||!ID.test(id))||
  new Set(manifest.revokedIssuerIds).size!==manifest.revokedIssuerIds.length){
  errors.push('REGISTRY_SHAPE_SCOPE_EPOCH_INVALID');
 }
 const issued=date(manifest.issuedAt),expiry=date(manifest.expiresAt);
 if(!Number.isFinite(issued)||!Number.isFinite(expiry)||
  issued>right.getTime()+5000||expiry<=right.getTime()||
  expiry<=issued||expiry-issued>30*24*3600*1000)
  errors.push('REGISTRY_TIME_EXPIRED_OR_FUTURE');
 const configuredRoots=Object.entries(pinnedRootKeys);
 if(configuredRoots.length!==ROOTS||configuredRoots.some(([id])=>!ID.test(id)))
  errors.push('PINNED_ROOT_SET_INCOMPLETE');
 const rootById=new Map(),fingerprints=new Set();
 for(const [id,raw] of configuredRoots){
  const key=loadEdPub(raw);
  if(!key){errors.push('INVALID_PINNED_ROOT');continue;}
  const fp=fingerprint(key);
  if(fingerprints.has(fp)){errors.push('DUPLICATED_ROOT_KEY');continue;}
  fingerprints.add(fp);rootById.set(id,key);
 }
 const body=Buffer.from(DOMAIN+JSON.stringify(manifest),'utf8');
 const validatedRoots=new Set();
 if(signatures.length!==QUORUM||signatures.some(s=>!exact(s,['rootId','signature'])))
  errors.push('INVALID_ROOT_SIGNER_QUORUM_SET');
 for(const signed of signatures){
  if(!signed||typeof signed!=='object')continue;
  if(typeof signed.rootId!=='string'||!ID.test(signed.rootId)||
    typeof signed.signature!=='string'||!SIGNATURE.test(signed.signature)||
    validatedRoots.has(signed.rootId)){errors.push('ROOT_SIGNATURE_INVALID_OR_DUPLICATED');continue;}
  const key=rootById.get(signed.rootId);
  if(!key){errors.push('UNPINNED_ROOT_SIGNER');continue;}
  let ok=false;
  try{ok=verify(null,body,key,Buffer.from(signed.signature,'base64url'));}
  catch{}
  if(!ok){errors.push('INVALID_ROOT_SIGNATURE');continue;}
  validatedRoots.add(signed.rootId);
 }
 if(validatedRoots.size!==QUORUM)errors.push('INSUFFICIENT_ROOT_QUORUM');
 const seenGates=new Set(),seenIssuer=new Set(),seenKey=new Set();
 const policy=Object.create(null);
 for(const entry of manifest.issuers){
  if(!exact(entry,PEM_FIELD)||!Object.hasOwn(GATES,entry.gateId)||
    !ID.test(entry.issuerId||'')||entry.role!==GATES[entry.gateId]){
   errors.push('INVALID_REGISTRY_ISSUER');continue;
  }
  if(seenGates.has(entry.gateId)||seenIssuer.has(entry.issuerId)){
   errors.push('DUPLICATE_GATE_OR_ISSUER');continue;
  }
  seenGates.add(entry.gateId);seenIssuer.add(entry.issuerId);
  if(manifest.revokedIssuerIds.includes(entry.issuerId)){
   errors.push('REVOKED_ISSUER_PRESENT:'+entry.gateId);continue;
  }
  const key=loadEdPub(entry.publicKey);
  if(!key){errors.push('INVALID_ISSUER_KEY:'+entry.gateId);continue;}
  const fp=fingerprint(key);
  if(seenKey.has(fp)||fingerprints.has(fp)){
   errors.push('NONINDEPENDENT_ISSUER_KEY:'+entry.gateId);continue;
  }
  seenKey.add(fp);
  policy[entry.issuerId]={gateId:entry.gateId,role:entry.role,publicKey:key};
 }
 for(const gateId of Object.keys(GATES))if(!seenGates.has(gateId))
  errors.push('MISSING_REGISTRY_GATE:'+gateId);
 if(errors.length)return statusHold(errors,{
  rootQuorumSignatureCount:validatedRoots.size,
  epoch:Number.isSafeInteger(manifest.epoch)?manifest.epoch:null,
 });
 return Object.freeze({status:'QUORUM_ROOT_POLICY_CRYPTO_VERIFIED_MANUAL_REVIEW_ONLY',
  reasonCodes:Object.freeze([]),policy:Object.freeze(policy),
  rootQuorumSignatureCount:validatedRoots.size,epoch:manifest.epoch,
  manifestSha256:createHash('sha256').update(body).digest('hex'),
  environment,targetSha,quorumVerified:true,
  approvalForProduction:false,professionalValuationAuthorized:false,
  transactionAuthorized:false,independentExternalAuthorityVerified:false,
  rootKeyLifecycleExternallyQualified:false,
  semantics:'Pinned roots supplied by a separately trusted config verified this manifest. Neither actual root-custodian authority nor whether the evidence contents are true is attested by this module.',
 });
}
function verifyGovernedP0Packet(opts={}){
 const roots=verifyRootQuorumRegistry(opts);
 if(!roots.quorumVerified)return roots;
 const ev=verifyExternalReadinessEvidence({
  evidence:opts.evidence,trustPolicy:roots.policy,
  targetSha:opts.targetSha,environment:opts.environment,now:opts.now,
 });
 return Object.freeze({status:ev.status==='CRYPTOGRAPHIC_P0_EVIDENCE_VERIFIED_MANUAL_GO_NO_GO_REQUIRED'?
  'GOVERNED_P0_PACKET_CRYPTO_VERIFIED_HUMAN_GO_NO_GO_REQUIRED':
  'HOLD_GOVERNED_P0_EVIDENCE',
  reasonCodes:ev.reasonCodes,verifiedEvidence:ev.verifiedEvidence,
  rootManifestSha256:roots.manifestSha256,rootEpoch:roots.epoch,
  rootQuorumSignatureCount:roots.rootQuorumSignatureCount,
  approvalForProduction:false,professionalValuationAuthorized:false,
  transactionAuthorized:false,independentExternalAuthorityVerified:false,
  independentHumanGoNoGoRequired:true});
}
module.exports={DOMAIN,POLICY_FIELDS,verifyRootQuorumRegistry,verifyGovernedP0Packet};
