'use strict';
// STARTAK historical source MANIFEST integrity, not functional equivalence.
// Inspecting a modern anchor path is not proof that legacy valuation, title,
// planning, storage or finance behavior has been transplanted or accredited.
const fs=require('node:fs');
const path=require('node:path');
const EXPECTED_HEADER='id,old,source_blob,versions,domain,modern_anchor,status,inspection,priority,acceptance';
const STATUS={
 MODERN_ANCHOR_EXISTS_PARITY_UNVERIFIED:46,
 OLD_STAGING_CONTRACT_NOT_PRODUCTION_VAULT:10,
 SAFE_RETIREMENT_REVIEW:1,
};
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
  if(!/^src\/[A-Za-z0-9_./-]+\.js$/.test(old)||old.includes('..')||
     fileExists(old))fail('OLD_PATH_NOT_ABSENT_OR_INVALID');
  if(!Object.hasOwn(STATUS,status))fail('STATUS_UNRECOGNIZED');
  counts[status]=(counts[status]||0)+1;
  if(inspection!=='LEGACY_API_INSPECTED')fail('INSPECTION_INVALID');
  if(!['P0','P1','P2'].includes(priority))fail('PRIORITY_INVALID');
  if(status==='MODERN_ANCHOR_EXISTS_PARITY_UNVERIFIED'){
    if(!/^src\/[A-Za-z0-9_./-]+\.js$/.test(modernAnchor)||
       modernAnchor.includes('..')||!fileExists(modernAnchor))
      fail('MODERN_ANCHOR_MISSING');
  }
 }
 for(const [k,count] of Object.entries(STATUS)){
  if(counts[k]!==count)fail('DISPOSITION_COUNT_CHANGED');
 }
 return Object.freeze({
  sourcePaths:57,uniqueSourcePaths:seenOld.size,
  modernAnchorsPresent:counts.MODERN_ANCHOR_EXISTS_PARITY_UNVERIFIED,
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
module.exports={verifyLegacyManifest,MANIFEST};
