'use strict';
// Assert retirement boundaries for 10 historical C73 staging contracts and
// the legacy browser-only crypto shim. NOT independent evidence of KMS,
// encrypted production custody, signed release or full feature parity.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {makePrivateAppraisalVault,ENVELOPE_AUTH_VERSION} =
  require('../../src/market/private-appraisal-evidence-vault');
const ROOT=path.resolve(__dirname,'../..');
const manifest=fs.readFileSync(path.join(ROOT,
 'docs/recovery/STARTAK_RE_HISTORIC_SOURCE_CANDIDATES_20261114.csv'),'utf8');
const rows=manifest.trim().split(/\r?\n/).slice(1);
function sourceOf(line){
 const found=/^"(LEG-\d{3})","([^"]+)"/.exec(line);
 if(!found)throw Error('HISTORIC_SOURCE_ROW_INVALID');
 return found[2];
}
const oldCustody=rows.filter(x=>x.includes('"OLD_STAGING_CONTRACT_NOT_PRODUCTION_VAULT"'));
assert.equal(oldCustody.length,10);
for(const line of oldCustody){
 const historical=sourceOf(line);
 assert.match(historical,/^src\/security\/c73-/);
 assert.equal(fs.existsSync(path.join(ROOT,historical)),false,
  'Do not reintroduce unapproved historical staging custody: '+historical);
}
const oldCrypto=rows.filter(x=>x.includes('"SAFE_RETIREMENT_REVIEW"'));
assert.equal(oldCrypto.length,1);
assert.equal(sourceOf(oldCrypto[0]),'src/runtime/browser-crypto-shim.js');
assert.equal(fs.existsSync(path.join(ROOT,sourceOf(oldCrypto[0]))),false);
const vite=fs.readFileSync(path.join(ROOT,'vite.config.js'),'utf8');
assert.doesNotMatch(vite,/browser-crypto-shim/i);
let scanned=0;
function scanProductionSource(dir){
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const full=path.join(dir,entry.name);
  if(entry.isDirectory()){scanProductionSource(full);continue;}
  if(!entry.isFile()||!/\.(js|jsx|ts|tsx|mjs|cjs)$/.test(entry.name))continue;
  scanned++;
  const content=fs.readFileSync(full,'utf8');
  assert.doesNotMatch(content,/browser-crypto-shim/i,
   'Retired legacy browser shim referenced by production source: '+full);
 }
}
scanProductionSource(path.join(ROOT,'src'));
const dummyAdapter={get:async()=>null,putIfAbsent:async()=>false};
assert.throws(()=>makePrivateAppraisalVault({
 adapter:dummyAdapter,keyProvider:()=>Buffer.alloc(32),
}),/SERVER_AUTHORIZER_REQUIRED/);
const vault=makePrivateAppraisalVault({
 adapter:dummyAdapter,keyProvider:()=>Buffer.alloc(32),
 authorizeActor:async()=>null,
});
assert.equal(vault.institutionalDeploymentVerified,false);
assert.equal(ENVELOPE_AUTH_VERSION,2);
assert.ok(scanned>50,'Source scan unexpectedly too small');
console.log('LEGACY_CRYPTO_AND_C73_RETIREMENT_BOUNDARY=PASS '+
 'old_crypto_absent=1 staging_contracts_absent=10 source_files_scanned='+scanned+
 ' production_vault_certified=false production_go=false');
