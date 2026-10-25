'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {ASSET_CLASS}=require('../../src/project-model/project-profile');
const {REQUIRED_SCENARIOS,STATUS,assessAssetSectorE2ECoverage}=
 require('../../src/pilot/asset-sector-e2e-evidence-matrix');
const {ALL_SECTORS,SOURCE_CHANNELS,researchSectorRoute}=
 require('../../src/governance/personal-asset-universe');
let checks=0;
const keys=Object.values(ASSET_CLASS);
assert.equal(keys.length,13);checks++;
assert.equal(Object.keys(ALL_SECTORS).length,keys.length);checks++;
assert.deepEqual(new Set(Object.keys(ALL_SECTORS)),new Set(Object.keys(ASSET_CLASS)));checks++;
assert.equal(REQUIRED_SCENARIOS.length,14);checks++;
assert.deepEqual(new Set(REQUIRED_SCENARIOS.map(x=>x.assetClass)),new Set(keys));checks++;
for(const type of keys){
 const route=researchSectorRoute(type);
 assert.equal(route.assetClass,type);
 assert.equal(route.marketSourceIndependentlyVerified,false);
 assert.equal(route.methodEngineCertified,false);
 assert.equal(route.realExecutedTransactionImported,false);
 assert.equal(route.transactionAuthorized,false);
 assert.ok(route.sector.evidenceAr.length>=22);
 assert.ok(route.declaredSectorJourneyIds.length>=1);
 checks+=7;
 if(!['LAND','RESIDENTIAL','OFFICE','RETAIL'].includes(type)){
   assert.equal(route.status,'SPECIALIST_METHOD_NOT_END_TO_END_QUALIFIED');checks++;
 }
}
const bad=researchSectorRoute('INVENTED_CONVERSION');
assert.equal(bad.status,'HOLD_UNKNOWN_ASSET_CLASS');
assert.equal(bad.methodEngineCertified,false);checks+=2;
const need=assessAssetSectorE2ECoverage({candidateHeadSha:'f'.repeat(40),
  asOf:'2026-10-25T00:00:00Z',records:[]});
assert.equal(need.status,STATUS.HOLD);
assert.equal(need.byScenario.length,14);
assert.equal(need.structurallyReadyCount,0);
assert.equal(need.realE2ECoverageEstablished,false);checks+=4;
for(const src of SOURCE_CHANNELS){
 assert.equal(new URL(src.url).protocol,'https:');
 assert.ok(['rei.rega.gov.sa','www.moj.gov.sa'].includes(new URL(src.url).hostname));
 assert.notEqual(src.recordKind,'AUTO_VERIFIED_TRANSACTION');checks+=3;
}
const ui=fs.readFileSync(path.join(__dirname,'../../src/components/PersonalAssetUniversePanel.jsx'),'utf8');
const parent=fs.readFileSync(path.join(__dirname,'../../src/components/ValuationIntelligencePanel.jsx'),'utf8');
assert.match(ui,/data-testid="personal-asset-universe-select"/);
assert.match(ui,/Object.values\(ALL_SECTORS\)\.map/);
assert.match(ui,/SPECIALIST_METHOD_NOT_END_TO_END_QUALIFIED|Specialist valuation not qualified end-to-end/);
assert.match(ui,/target="_blank" rel="noopener noreferrer"/);
assert.match(parent,/<PersonalAssetUniversePanel locale=\{locale\}/);
checks+=5;
console.log('PERSONAL_ASSET_UNIVERSE_ALL_13_CLASSES=PASS checks='+checks);
console.log('OFFICIAL_SALE_DATA_RIGHTS_OR_ACCURACY_CERTIFIED=FALSE');
