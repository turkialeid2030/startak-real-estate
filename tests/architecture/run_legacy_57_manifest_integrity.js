'use strict';
// Audits only completeness of the public, source-index manifest.
// Does NOT close any historical feature parity, source authenticity,
// protected fixture/UAT, vendor licensing or production environment gate.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {verifyLegacyManifest,MANIFEST}=require('../../tools/verify-legacy-57-manifest.cjs');
const root=path.resolve(__dirname,'../..');
const source=fs.readFileSync(path.join(root,MANIFEST),'utf8');
const exists=p=>fs.existsSync(path.join(root,p));
const good=verifyLegacyManifest(source,{fileExists:exists});
assert.equal(good.sourcePaths,57);
assert.equal(good.uniqueSourcePaths,57);
assert.equal(good.modernAnchorsPresent,46);
assert.equal(good.restoredSourcePaths,7);
assert.equal(good.oldStagingNotProduction,10);
assert.equal(good.oldCryptoRequiresRetirement,1);
assert.equal(good.equivalentFeaturesVerified,0);
assert.equal(good.legallyAuthorizedDeployment,false);
const rejects=(text,code)=>assert.throws(
 ()=>verifyLegacyManifest(text,{fileExists:exists}),
 new RegExp('LEGACY_57_'+code));
rejects(source.replace('"LEG-001"','"LEG-002"'),'IDENTITY_INVALID');
rejects(source.replace('372ade6483fb93cbb0cced9ad7977ea49ec419ab','bad-sha'),
 'SOURCE_BLOB_INVALID');
const legacyRow=source.split('\n').find(x=>x.startsWith('"LEG-003",'));
assert.ok(legacyRow);
rejects(source.replace(legacyRow,legacyRow.replace('"src/market/valuation-decision-gate.js"','"src/missing-research-anchor.js"')),'MODERN_ANCHOR_MISSING');
rejects(source.replace('MODERN_ANCHOR_EXISTS_PARITY_UNVERIFIED',
 'UNJUSTIFIED_PARITY_CERTIFIED'),'STATUS_UNRECOGNIZED');
rejects(source.replace('src/acquisition/governed-auction-acquisition.js',
 '../outside/source.js'),'OLD_PATH_NOT_ABSENT_OR_INVALID');
rejects(source.trimEnd().split(/\r?\n/).slice(0,-1).join('\n'),'ROW_COUNT_INVALID');
assert.throws(()=>verifyLegacyManifest(source,{fileExists:p=>
 p==='src/app/institutional-valuation-reason-presentation.js'||exists(p)}),
 /LEGACY_57_OLD_PATH_NOT_ABSENT_OR_INVALID/);
assert.throws(()=>verifyLegacyManifest(source,{fileExists:p=>p!=='src/app/institutional-valuation-decision-boundary.js'&&exists(p)}),/LEGACY_57_RESTORED_PATH_MISMATCH/);
rejects(source.replace('"LEG-002","src/app/institutional-valuation-decision-boundary.js"','"LEG-002","src/app/unrelated.js"'),'RESTORED_PATH_MISMATCH');
rejects(source.replace('372ade6483fb93cbb0cced9ad7977ea49ec419ab','f'.repeat(40)),'RESTORED_SOURCE_BLOB_MISMATCH');
const auctionRow=source.split('\n').find(x=>x.startsWith('"LEG-001",'));
const changedAnchor=auctionRow.replace(',"src/acquisition/governed-auction-acquisition.js","RESTORED_SOURCE_PARITY_UNVERIFIED"',',"src/residential-income-acquisition/acquisition-basis.js","RESTORED_SOURCE_PARITY_UNVERIFIED"');
assert.notEqual(auctionRow,changedAnchor);
rejects(source.replace(auctionRow,changedAnchor),'RESTORED_PATH_MISMATCH');
assert.throws(()=>verifyLegacyManifest(source,{fileExists:p=>p!=='src/acquisition/governed-auction-acquisition.js'&&exists(p)}),/LEGACY_57_RESTORED_PATH_MISMATCH/);
console.log('LEGACY_57_MANIFEST_INTEGRITY=PASS rows=57 modern_anchors=46 restored_unqualified=7 old_staging=10 safe_retire=1 parity_unverified=true synthetic_negatives=12');
