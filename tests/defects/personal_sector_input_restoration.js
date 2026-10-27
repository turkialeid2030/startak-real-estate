'use strict';
const assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const {sha256Hex}=require('../../src/crypto/sha256');
const {createPersonalSectorCaseArchive,LEGACY_VERSION}=
 require('../../src/valuation-intelligence/personal-sector-case-archive');
const {buildPersonalSectorResearchReport}=
 require('../../src/valuation-intelligence/personal-sector-research-report');
const {restorePersonalSectorInputFile,MAX_IMPORT_BYTES}=
 require('../../src/valuation-intelligence/personal-sector-input-restoration');
let checks=0;
const eq=(got,expected)=>{assert.deepEqual(got,expected);checks++;};
const rejection=async(fn,code)=>{await assert.rejects(fn,e=>e.code===code);checks++;};
const input={
 assetClass:'OFFICE',
 subject:{city:'الرياض',district:'الملقا',subtype:'مكاتب',date:'2026-10-25',area:'١٬٠٠٠',right:'FREEHOLD'},
 methods:{income:false,cost:false,market:true},
 inc:{gross:'',opex:'',cap:'',expenseTreatment:'',realEstateOnly:false,groundLease:false,sharedCosts:false},
 cost:{land:'',replacement:'',depreciation:'',excludesBusiness:false},
 comparables:[1,2,3].map(i=>({id:'SALE'+i,city:'الرياض',district:'الملقا',subtype:'مكاتب',
  right:'FREEHOLD',date:'2026-09-0'+i,unitValue:'١٠٬٠٠٠',source:'UNVERIFIED-'+i,
  unit:'SQM',saleKind:'EXECUTED_SALE'})),
 marketOptions:{unit:'SQM',quantity:'',businessExcluded:false,mixedAllocated:false},
 policy:{maxDispersion:'',incomeWeight:'',costWeight:'',marketWeight:''},
};
(async()=>{
 eq(MAX_IMPORT_BYTES,131072);
 const time='2026-10-26T12:00:00.000Z';
 const report=buildPersonalSectorResearchReport(input,{generatedAt:time});
 eq(report.result.status,'INDIVIDUAL_METHOD_SCENARIOS_ONLY');
 const restoredReport=await restorePersonalSectorInputFile(JSON.parse(JSON.stringify(report)),
   {expectedAssetClass:'OFFICE',subtle:webcrypto.subtle});
 eq(restoredReport.inputs,input);
 eq(restoredReport.sourceKind,'RECALCULATED_PERSONAL_REPORT');
 eq(restoredReport.restoredAuthorization,false);
 eq(restoredReport.resultsRestored,false);
 eq(restoredReport.marketSalesIndependentlyVerified,false);
 eq(Object.hasOwn(restoredReport.inputs,'result'),false);
 // A user can compute SHA-256 too; the independently rebuilt calculator
 // must detect a forged arithmetic result even when a new digest is supplied.
 const forged=structuredClone(report);
 forged.result.methods[0].scenarioAmountSar=9999999;
 const {reportHashSha256:unused,...core}=forged;
 forged.reportHashSha256=sha256Hex(JSON.stringify(core));
 await rejection(()=>restorePersonalSectorInputFile(forged,{expectedAssetClass:'OFFICE'}),'PERSONAL_SECTOR_REPORT_RECOMPUTATION_INVALID');
 const changedInputs=structuredClone(report);
 changedInputs.studyInputs.comparables[0].saleKind='ASKING_SALE';
 await rejection(()=>restorePersonalSectorInputFile(changedInputs,{expectedAssetClass:'OFFICE'}),'PERSONAL_SECTOR_REPORT_RECOMPUTATION_INVALID');
 await rejection(()=>restorePersonalSectorInputFile(report,{expectedAssetClass:'RETAIL'}),'PERSONAL_SECTOR_DIFFERENT_ASSET_CLASS');
 await rejection(()=>restorePersonalSectorInputFile(report,{}),'PERSONAL_SECTOR_EXPECTED_ASSET_CLASS_REQUIRED');
 await rejection(()=>restorePersonalSectorInputFile({version:'CERTIFIED_APPRAISAL_V9'},
  {expectedAssetClass:'OFFICE'}),'PERSONAL_SECTOR_UNSUPPORTED_DOCUMENT');
 const archiveV2=await createPersonalSectorCaseArchive(input,{subtle:webcrypto.subtle,createdAt:time});
 const restoredV2=await restorePersonalSectorInputFile(archiveV2,{subtle:webcrypto.subtle,expectedAssetClass:'OFFICE'});
 eq(restoredV2.sourceKind,'V2_INPUT_CASE');
 eq(restoredV2.inputs,input);
 const old=structuredClone(input);
 for(const row of old.comparables)delete row.saleKind;
 const oldBody={version:LEGACY_VERSION,createdAt:time,state:old};
 const oldHash=await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(oldBody)));
 const v1={...oldBody,sha256:[...new Uint8Array(oldHash)].map(x=>x.toString(16).padStart(2,'0')).join('')};
 const restoredV1=await restorePersonalSectorInputFile(v1,{subtle:webcrypto.subtle,expectedAssetClass:'OFFICE'});
 eq(restoredV1.sourceKind,'LEGACY_V1_INPUT_CASE');
 eq(restoredV1.inputs.comparables.map(x=>x.saleKind),['','','']);
 eq(restoredV1.resultsRestored,false);
 const tamperedV2=structuredClone(archiveV2);
 tamperedV2.state.subject.city='جدة';
 await rejection(()=>restorePersonalSectorInputFile(tamperedV2,
  {expectedAssetClass:'OFFICE',subtle:webcrypto.subtle}),'ARCHIVE_SHA256_MISMATCH');
 console.log('C57_PERSONAL_REPORT_CASE_INPUT_RESTORATION=PASS checks='+checks);
 console.log('RESTORED_RESULTS_OR_PROFESSIONAL_AUTHORITY=FALSE');
})().catch(e=>{console.error(e);process.exitCode=1;});
