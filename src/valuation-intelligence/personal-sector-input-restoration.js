'use strict';
// A portable study/report is owner-supplied input, never a trusted valuation.
// Successful SHA-256 + independent recomputation checks detect alterations,
// not identity, rights to data, certified market accuracy, or approval.
const {VERSION:CASE_VERSION,LEGACY_VERSION,MAX_ARCHIVE_BYTES,
 verifyPersonalSectorCaseArchive}=require('./personal-sector-case-archive');
const {VERSION:REPORT_VERSION,MAX_REPORT_BYTES,
 verifyPersonalSectorResearchReport}=require('./personal-sector-research-report');
const MAX_IMPORT_BYTES=Math.max(MAX_ARCHIVE_BYTES,MAX_REPORT_BYTES);
function fail(code){throw Object.assign(new Error(code),{code});}
async function restorePersonalSectorInputFile(file,{subtle,expectedAssetClass}={}){
 if(!file||typeof file!=='object'||Array.isArray(file))
  fail('PERSONAL_SECTOR_UNSUPPORTED_DOCUMENT');
 if(typeof expectedAssetClass!=='string'||!expectedAssetClass)
  fail('PERSONAL_SECTOR_EXPECTED_ASSET_CLASS_REQUIRED');
 if(file.version===REPORT_VERSION){
  // Recompute the report using the canonical valuation engine; checking a
  // plain digest alone is not enough because clients can compute SHA-256 too.
  if(file.assetClass!==expectedAssetClass)
   fail('PERSONAL_SECTOR_DIFFERENT_ASSET_CLASS');
  if(!verifyPersonalSectorResearchReport(file))
   fail('PERSONAL_SECTOR_REPORT_RECOMPUTATION_INVALID');
  return {
   inputs:file.studyInputs,
   sourceKind:'RECALCULATED_PERSONAL_REPORT',
   restoredAuthorization:false,
   resultsRestored:false,
   marketSalesIndependentlyVerified:false,
  };
 }
 if(file.version===CASE_VERSION||file.version===LEGACY_VERSION){
  const inputs=await verifyPersonalSectorCaseArchive(file,{subtle,expectedAssetClass});
  return {
   inputs,
   sourceKind:file.version===LEGACY_VERSION?'LEGACY_V1_INPUT_CASE':'V2_INPUT_CASE',
   restoredAuthorization:false,
   resultsRestored:false,
   marketSalesIndependentlyVerified:false,
  };
 }
 fail('PERSONAL_SECTOR_UNSUPPORTED_DOCUMENT');
}
module.exports={MAX_IMPORT_BYTES,restorePersonalSectorInputFile};
