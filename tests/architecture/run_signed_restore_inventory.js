'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {VERSION,signedInventoryBytes,verifySignedRestoreInventory}=require('../../src/market/signed-restore-inventory');
const {makePrivateAppraisalVault}=require('../../src/market/private-appraisal-evidence-vault');
const {privateKey,publicKey}=crypto.generateKeyPairSync('ed25519'),wrongKey=crypto.generateKeyPairSync('ed25519').publicKey;
const scope={tenantId:'SYNTH-TENANT',caseRef:'SYNTH-CASE',inventoryRef:'SYNTH-INVENTORY'},now=new Date('2026-09-03T00:00:00Z'),bytes=Buffer.from('synthetic backup evidence'),sha=crypto.createHash('sha256').update(bytes).digest('hex');
const inventory={version:VERSION,...scope,backupRef:'SYNTH-BACKUP',snapshotAt:'2026-09-01T00:00:00Z',signedAt:'2026-09-02T00:00:00Z',signerKeyRef:'SYNTH-SIGNER',entries:[{evidenceRef:'EVID-1',sha256:sha}]};
function sign(x){return {inventory:x,signature:crypto.sign(null,signedInventoryBytes(x),privateKey).toString('base64')};}
let signer={tenantId:scope.tenantId,signerKeyRef:inventory.signerKeyRef,purpose:'BACKUP_INVENTORY_SIGNING',revoked:false,validFrom:'2026-01-01',validUntil:'2026-12-31',publicKey},envelope=sign(inventory);
const resolveSigner=async()=>signer,opts={...scope,now,maxAgeSeconds:259200,resolveSigner};
const map=new Map(),adapter={get:async k=>map.get(k)??null,putIfAbsent:async(k,v)=>{if(map.has(k))return false;map.set(k,v);return true;}};
const key=crypto.randomBytes(32),actor={id:'AUDITOR'},writer={id:'WRITER'};
const authorizeActor=async({requestActor,tenantId,caseRef})=>tenantId===scope.tenantId&&caseRef===scope.caseRef&&(requestActor===actor||requestActor===writer)?{verifiedByServer:true,tenantId,caseRefs:[caseRef],actorId:requestActor.id,role:requestActor===actor?'AUDITOR':'REVIEWER'}:null;
const vault=makePrivateAppraisalVault({adapter,keyProvider:()=>key,authorizeActor,restoreInventoryProvider:async()=>envelope,restoreInventoryTrust:{resolveSigner,maxAgeSeconds:259200},clock:()=>now});
const verify=(x=envelope,o=opts)=>verifySignedRestoreInventory(x,o);
async function main(){
 assert.equal((await verify()).signatureVerified,true);
 for(const e of [{...envelope,signature:'AAAA'},{...envelope,inventory:{...inventory,backupRef:'OTHER'}},{...envelope,inventory:{...inventory,entries:[{evidenceRef:'EVID-1',sha256:'0'.repeat(64)}]}},sign({...inventory,tenantId:'OTHER'}),sign({...inventory,snapshotAt:'2026-08-01'}),sign({...inventory,signedAt:'2026-09-04'})])assert.equal((await verify(e)).signatureVerified,false);
 assert.equal((await verify(envelope,{...opts,maxAgeSeconds:1})).signatureVerified,false);
 const original=signer;
 for(const patch of [{revoked:true},{tenantId:'OTHER'},{signerKeyRef:'OTHER'},{purpose:'OTHER'},{publicKey:wrongKey},{validUntil:'2026-09-02'}]){signer={...original,...patch};assert.equal((await verify()).signatureVerified,false);}
 signer=original;
 assert.throws(()=>sign({...inventory,entries:[...inventory.entries,...inventory.entries]}),/ENTRY_INVALID/);
 assert.throws(()=>sign({...inventory,snapshotAt:'2026-02-30'}),/CHRONOLOGY/);
 let reads=0;const getter=Object.defineProperty({...envelope},'signature',{enumerable:true,get(){reads++;return envelope.signature;}});assert.equal((await verify(getter)).signatureVerified,false);assert.equal(reads,0);
 await vault.put({...scope,actor:writer,evidenceRef:'EVID-1',sourceBytes:bytes,expectedSha256:sha});
 const result=await vault.verifyRestoredInventory({...scope,actor});
 assert.equal(result.status,'RESTORED_SIGNED_EXPECTED_INVENTORY_MATCHED');assert.equal(result.inventorySignatureVerified,true);assert.equal(result.verifiedCount,1);assert.equal(result.productionRecoveryVerified,false);assert.equal(result.independentBackupAuthenticityEstablished,false);
 envelope={...envelope,signature:'AAAA'};assert.equal((await vault.verifyRestoredInventory({...scope,actor})).status,'HOLD_RESTORE_VERIFICATION');
 envelope=sign(inventory);map.clear();const missing=await vault.verifyRestoredInventory({...scope,actor});assert.equal(missing.status,'HOLD_RESTORE_VERIFICATION');assert.equal(missing.verifiedCount,0);
 console.log('SIGNED_RESTORE_INVENTORY_AND_VAULT=PASS synthetic=true production=false');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
