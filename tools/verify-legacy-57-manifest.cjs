'use strict';
// STARTAK historical source MANIFEST integrity, not functional equivalence.
// Inspecting a modern anchor path is not proof that legacy valuation, title,
// planning, storage or finance behavior has been transplanted or accredited.
const fs=require('node:fs');
const path=require('node:path');
const EXPECTED_HEADER='id,old,source_blob,versions,domain,modern_anchor,status,inspection,priority,acceptance';
const STATUS={
 MODERN_ANCHOR_EXISTS_PARITY_UNVERIFIED:41,
 RESTORED_SOURCE_PARITY_UNVERIFIED:5,
 OLD_STAGING_CONTRACT_NOT_PRODUCTION_VAULT:10,
 SAFE_RETIREMENT_REVIEW:1,
};
// Explicit reviewed restoration allowlist. Historic blob IDs identify
// source origins, not byte identity or functional parity of modern code.
const RESTORED=Object.freeze(Object.fromEntries(Object.entries({"LEG-008":{"path":"src/closing/governed-encumbrance-mortgage-closing.js","sourceBlob":"a032ce47f78eb77e788fec3bd74c1e73736768d8","modernAnchor":"src/closing/governed-encumbrance-mortgage-closing.js"},"LEG-001":{"path":"src/acquisition/governed-auction-acquisition.js","sourceBlob":"372ade6483fb93cbb0cced9ad7977ea49ec419ab","modernAnchor":"src/acquisition/governed-auction-acquisition.js"},"LEG-002":{"path":"src/app/institutional-valuation-decision-boundary.js","sourceBlob":"0476e599eecfeb760c739bad374bea90b3c4a873","modernAnchor":"src/market/valuation-decision-gate.js"},"LEG-014":{"path":"src/cost/depreciation-attribution-gate.js","sourceBlob":"7f5f4ec8709ae9e0a5a73760f701e84e7ee12a83","modernAnchor":"src/valuation-intelligence/cost-approach.js"},"LEG-054":{"path":"src/valuation-intelligence/market-rate-provenance.js","sourceBlob":"b1bcee33c3bb1d0ae59ed8a21b2eb244c2ba9e8b","modernAnchor":"src/market/comparable-provenance-chain.js"}}).map(([id,record])=>[id,Object.freeze(record)])));
const MANIFEST='docs/recovery/STARTAK_RE_HISTORIC_SOURCE_CANDIDATES_20261114.csv';
function fail(reason){throw Error('LEGACY_57_'+reason);}
function csvFields(line){
 const fields=[];let i=0;
 while(i<line.length){
  if(line[i]!=='"')fail('CSV_QUOTING_INVALID');
  i++;let current='',closed=false;
  while(i<line.length){
   if(line[i]!=='"'){current+=line[i++];continue;}
   if(line[i+1]==='"'){current+='"';i+=2;continue;}
   i++;closed=true;break;
  }
  if(!closed)fail('CSV_UNCLOSED_QUOTE');
  fields.push(current);
  if(i===line.length)break;
  if(line[i]!==',')fail('CSV_DELIMITER_INVALID');
  i++;
 }
 return fields;
}
function verifyLegacyManifest(csv,{fileExists}){
 if(typeof csv!=='string'||typeof fileExists!=='function')fail('INPUT_INVALID');
 const lines=csv.replace(/^\uFEFF/,'').trimEnd().split(/\r?\n/);
 if(lines[0]!==EXPECTED_HEADER)fail('HEADER_INVALID');
 if(lines.length!==58)fail('ROW_COUNT_INVALID');
 const seenIds=new Set(),seenOld=new Set(),counts={};
 for(const [index,line] of lines.slice(1).entries()){
  const [id,old,sourceBlob,versions,domain,modernAnchor,status,inspection,priority,acceptance,...extras]=csvFields(line);
  if(extras.length||!id||!old||!sourceBlob||!versions||!domain||
     !status||!inspection||!priority||!acceptance)fail('ROW_INVALID');
  if(id!=='LEG-'+String(index+1).padStart(3,'0')||
     seenIds.has(id)||seenOld.has(old))fail('IDENTITY_INVALID');
  seenIds.add(id);seenOld.add(old);
  if(!/^[a-f0-9]{40}$/i.test(sourceBlob))fail('SOURCE_BLOB_INVALID');
  // Never accept traversal, absolute paths or root dot segments from a
  // purported source manifest, even if the caller uses a real fs.existsSync.
  if(!/^src\/[A-Za-z0-9_./-]+\.(?:js|jsx)$/.test(old)||old.includes('..'))fail('OLD_PATH_NOT_ABSENT_OR_INVALID');
  if(status==='RESTORED_SOURCE_PARITY_UNVERIFIED'){
   if(RESTORED[id]?.path!==old||RESTORED[id]?.modernAnchor!==modernAnchor||!fileExists(old))fail('RESTORED_PATH_MISMATCH');
   if(RESTORED[id].sourceBlob!==sourceBlob)fail('RESTORED_SOURCE_BLOB_MISMATCH');
  }else if(Object.hasOwn(RESTORED,id)||fileExists(old))fail('OLD_PATH_NOT_ABSENT_OR_INVALID');
  if(!Object.hasOwn(STATUS,status))fail('STATUS_UNRECOGNIZED');
  counts[status]=(counts[status]||0)+1;
  if(inspection!=='LEGACY_API_INSPECTED')fail('INSPECTION_INVALID');
  if(!['P0','P1','P2'].includes(priority))fail('PRIORITY_INVALID');
  if(['MODERN_ANCHOR_EXISTS_PARITY_UNVERIFIED','RESTORED_SOURCE_PARITY_UNVERIFIED'].includes(status)){
    if(!/^src\/[A-Za-z0-9_./-]+\.(?:js|jsx)$/.test(modernAnchor)||
       modernAnchor.includes('..')||!fileExists(modernAnchor))
      fail('MODERN_ANCHOR_MISSING');
  }
 }
 for(const [k,count] of Object.entries(STATUS)){
  if(counts[k]!==count)fail('DISPOSITION_COUNT_CHANGED');
 }
 return Object.freeze({
  sourcePaths:57,uniqueSourcePaths:seenOld.size,
  modernAnchorsPresent:counts.MODERN_ANCHOR_EXISTS_PARITY_UNVERIFIED+counts.RESTORED_SOURCE_PARITY_UNVERIFIED,
  restoredSourcePaths:counts.RESTORED_SOURCE_PARITY_UNVERIFIED,
  oldStagingNotProduction:counts.OLD_STAGING_CONTRACT_NOT_PRODUCTION_VAULT,
  oldCryptoRequiresRetirement:counts.SAFE_RETIREMENT_REVIEW,
  equivalentFeaturesVerified:0, // This check has NO capability/functional authority.
  legallyAuthorizedDeployment:false,
 });
}
if(require.main===module){
 const root=path.resolve(__dirname,'..'),file=path.join(root,MANIFEST);
 const text=fs.readFileSync(file,'utf8');
 const result=verifyLegacyManifest(text,{fileExists:p=>fs.existsSync(path.join(root,p))});
 console.log('LEGACY_57_MANIFEST_INTEGRITY=PASS '+JSON.stringify(result));
}
module.exports={verifyLegacyManifest,MANIFEST,RESTORED};
