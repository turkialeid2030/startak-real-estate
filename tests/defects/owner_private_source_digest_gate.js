'use strict';
// Synthetic-only characterization of the owner IRR-source integrity boundary.
// These 17 fake records are NOT private property valuations or STARTAK engine
// execution proof. The real release verdict must remain HOLD.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..');
const gate=path.join(root,'tools/verify-owner-external-golden-17.mjs');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'startak-golden-integrity-'));
let checks=0;
const check=(truth,explanation)=>{assert.ok(truth,explanation);checks++;};
try{
 const cases=Array.from({length:17},(_,i)=>({
  id:'SYNTHETIC-CASE-'+String(i+1).padStart(2,'0'),
  landArea:100,
  adoptedLandRate:1000,
  roundStep:10,
  landComparables:[],
  components:[],
  softCostsPct:{professional:0,utilities:0,management:0,finance:0,contractorProfit:0},
  usefulLife:50,effectiveAge:0,rentalYieldPct:5,
  expected:{marketValue:100000,marketRent:5000}
 }));
 const fixture=path.join(dir,'private-source-synthetic.json');
 const results=path.join(dir,'engine-output-synthetic.json');
 const cashflowSource=path.join(dir,'reference-cashflows-synthetic.txt');
 const provenance=path.join(dir,'irr-source-synthetic.json');
 fs.writeFileSync(fixture,JSON.stringify({cases}));
 fs.writeFileSync(results,JSON.stringify({cases:cases.map(x=>({id:x.id,...x.expected}))}));
 fs.writeFileSync(cashflowSource,'SYNTHETIC PRIVATE SOURCE PLACEHOLDER, NOT AN IRR CASHFLOW RECONCILIATION\n');
 const sha=crypto.createHash('sha256').update(fs.readFileSync(cashflowSource)).digest('hex');
 const meta={sourceArtifact:cashflowSource,sourceSha256:sha,
   cashflowMapping:'SYNTHETIC PROOF OF HASH ONLY — NOT AN ENGINE MAPPING',
   periodBasis:'SYNTHETIC ANNUAL',unitBasis:'SYNTHETIC SAR',
   engineOutput:'0.1444715207802304'};
 const run=()=>spawnSync(process.execPath,[gate,
   '--fixture='+fixture,'--engine-results='+results,'--irr-provenance='+provenance],
   {cwd:root,encoding:'utf8',timeout:30000});
 fs.writeFileSync(provenance,JSON.stringify(meta));
 const valid=run();
 check(valid.status===2,'even a matching synthetic artifact never authorizes release: '+valid.stderr);
 check(valid.stdout.includes('IRR_SOURCE_BYTES=PASS'),'actual source bytes are hashed');
 check(valid.stdout.includes('ENGINE_PARITY=BLOCKED_TRUSTED_EXECUTION_PROOF_REQUIRED'),'untrusted result JSON does not prove actual engine execution');
 check(valid.stdout.includes('OVERALL=HOLD'),'release remains HOLD despite synthetic match');
 fs.writeFileSync(provenance,JSON.stringify({...meta,sourceSha256:'0'.repeat(64)}));
 const mismatch=run();
 check(mismatch.status===1,'wrong source hash fails instead of becoming provisional');
 check(mismatch.stdout.includes('IRR_SOURCE_DIGEST_MISMATCH'),'detects byte-for-byte tampering');
 fs.writeFileSync(provenance,JSON.stringify({...meta,sourceArtifact:path.join(dir,'missing-private-source.txt')}));
 const missing=run();
 check(missing.status===2,'missing source is BLOCKED, not verified');
 check(missing.stdout.includes('IRR_BASELINE=BLOCKED_SOURCE_ARTIFACT_UNAVAILABLE'),'clearly marks absent private bytes');
 console.log('OWNER_PRIVATE_SOURCE_DIGEST_GATE=PASS assertions='+checks+' synthetic_only=true real_engine_parity=false release_authorized=false');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
