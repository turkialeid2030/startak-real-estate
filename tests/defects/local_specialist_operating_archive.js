'use strict';
const assert=require('node:assert/strict');
const {sha256Hex}=require('../../src/crypto/sha256');
const {CASE_VERSION,REPORT_VERSION,normalizeStudy,calculateStudy,createInputArchive,createOperatingReport,restoreStudyFile}=require('../../src/specialized-assets/local-sector-operating-archive');
const {STATUS}=require('../../src/specialized-assets/local-sector-operating-research');
const date='2026-11-25T00:00:00.000Z';
const hotel={availableRoomNights:'٣٦٬٥٠٠',occupiedRoomNights:'٢٥٥٥٠',roomsRevenueSar:'12775000',foodBeverageRevenueSar:'2000000',otherOperatingRevenueSar:'225000',departmentalExpensesSar:'4000000',undistributedOperatingExpensesSar:'3000000',managementAndFranchiseFeesSar:'500000',ffeReserveSar:'500000'};
const industrial={assetId:'SYNTH-01',subtype:'WAREHOUSE',landAreaSqm:'2000',builtAreaSqm:'1500',netLeasableAreaSqm:'1200',clearHeightMeters:'10',powerCapacityKva:'400',leaseStructure:'GROSS',internalInspectionStatus:'NOT_INSPECTED',buildingPermitStatus:'PROVIDED_UNVERIFIED',annualRentSar:'600000',landlordExpensesSar:'120000'};
const capacity={capacity:'100',usedCapacity:'80',annualOperatingRevenueSar:'1000000',annualOperatingExpensesSar:'700000'};
const special={propertyRightRef:'SYNTH-RIGHT',landValueSar:'2000000',replacementCostSar:'1000000',physicalLossSar:'100000',functionalLossSar:'50000',externalLossSar:'50000',lossCausesDistinct:true,businessAssetsExcluded:true};
const segs=[{id:'office',areaSqm:'1000',annualPropertyRevenueSar:'1000000',annualDirectExpensesSar:'100000',propertyIncomeOnly:true},{id:'retail',areaSqm:'500',annualPropertyRevenueSar:'500000',annualDirectExpensesSar:'50000',propertyIncomeOnly:true}];
const samples=[['HOSPITALITY',hotel,[]],['INDUSTRIAL_LOGISTICS',industrial,[]],...['HEALTHCARE','EDUCATION','PARKING','DATA_CENTER'].map(c=>[c,capacity,[]]),['MIXED_USE',{totalLeasableAreaSqm:'1500',commonExpensesSar:'50000',sharedExpensesAllocatedOnce:true},segs],['SPECIAL_PURPOSE',special,[]]];
let checks=0,cases=0;
function eq(a,b){assert.equal(a,b);checks++;}
function deep(a,b){assert.deepEqual(a,b);checks++;}
function denied(f){assert.throws(f);checks++;cases++;}
const round=x=>JSON.parse(JSON.stringify(x));
function resign(x){const {sha256,...body}=x;return {...body,sha256:sha256Hex(JSON.stringify(body))};}
for(const [assetClass,values,segments] of samples){
 const state={assetClass,values,segments},opts={expectedAssetClass:assetClass};
 const archive=createInputArchive(state,{createdAt:date}),report=createOperatingReport(state,{createdAt:date});
 eq(archive.version,CASE_VERSION);eq(report.version,REPORT_VERSION);
 eq(Object.hasOwn(archive,'result'),false);eq(Object.hasOwn(archive,'transactionAuthorized'),false);
 eq(report.result.status,STATUS.READY);eq(report.result.propertyValueSar,null);eq(report.result.propertyNoiAdopted,false);
 eq(report.professionalValuationCertified,false);eq(report.transactionAuthorized,false);
 for(const file of [archive,report]){
  const restored=restoreStudyFile(round(file),opts);
  deep(restored.studyInputs,normalizeStudy(state));eq(restored.resultsRestored,false);eq(restored.authorityRestored,false);
  deep(calculateStudy(restored.studyInputs),report.result);cases++;
  denied(()=>restoreStudyFile(file,{expectedAssetClass:assetClass==='HOSPITALITY'?'PARKING':'HOSPITALITY'}));
  denied(()=>restoreStudyFile({...file,sha256:'0'.repeat(64)},opts));
  denied(()=>restoreStudyFile(resign({...file,authority:true}),opts));
  denied(()=>restoreStudyFile(resign({...file,createdAt:'2026-02-30T00:00:00.000Z'}),opts));
  denied(()=>restoreStudyFile(resign({...file,studyInputs:{...file.studyInputs,values:{...file.studyInputs.values,unknown:'injected'}}}),opts));
 }
 const fake=round(report);fake.result.propertyValueSar=999999999;fake.result.professionalValuationCertified=true;
 denied(()=>restoreStudyFile(resign(fake),opts));
 denied(()=>restoreStudyFile({...fake,sha256:report.sha256},opts));
 denied(()=>restoreStudyFile(resign({...report,transactionAuthorized:true}),opts));
 const blank={assetClass,values:{},segments:assetClass==='MIXED_USE'?[{},{}]:[]};
 const draft=createInputArchive(blank,{createdAt:date});
 eq(calculateStudy(restoreStudyFile(draft,opts).studyInputs).status,STATUS.HOLD);cases++;
 denied(()=>createOperatingReport(blank,{createdAt:date}));
 denied(()=>createInputArchive({...state,values:{...values,unknown:'x'}},{createdAt:date}));
 denied(()=>createInputArchive({...state,segments:Array.from({length:21},()=>({}))},{createdAt:date}));
}
eq(calculateStudy({assetClass:'HOSPITALITY',values:hotel,segments:[]}).metrics.revParSar,350);
denied(()=>createInputArchive({assetClass:'__proto__',values:{},segments:[]},{createdAt:date}));
denied(()=>restoreStudyFile(JSON.parse('{"__proto__":{"transactionAuthorized":true}}'),{expectedAssetClass:'HOSPITALITY'}));
denied(()=>restoreStudyFile({payload:'x'.repeat(70000)},{expectedAssetClass:'HOSPITALITY'}));
denied(()=>createInputArchive({assetClass:'HOSPITALITY',values:{...hotel,roomsRevenueSar:'x'.repeat(201)},segments:[]},{createdAt:date}));
console.log('LOCAL_SPECIALIST_ARCHIVE=PASS cases='+cases+' checks='+checks+' no_authority=true');
