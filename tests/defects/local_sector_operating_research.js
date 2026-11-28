'use strict';
const assert=require('node:assert/strict');
const {STATUS,SUPPORTED_SECTORS,evaluateLocalSectorOperations}=require('../../src/specialized-assets/local-sector-operating-research');
let checks=0,cases=0;
function eq(a,b){assert.equal(a,b);checks++;}
function ok(a){assert.ok(a);checks++;}
function run(assetClass,inputs,status=STATUS.READY){
 cases++;const out=evaluateLocalSectorOperations({assetClass,inputs});
 eq(out.status,status);eq(out.independentEvidenceVerified,false);eq(out.propertyNoiAdopted,false);
 eq(out.propertyValueSar,null);eq(out.professionalValuationCertified,false);eq(out.commercialReportAuthorized,false);eq(out.transactionAuthorized,false);
 ok(Object.isFrozen(out));if(status===STATUS.HOLD){eq(out.metrics,null);ok(out.issues.length>0);}else ok(Object.isFrozen(out.metrics));
 return out;
}
const hotel={availableRoomNights:36500,occupiedRoomNights:25550,roomsRevenueSar:12775000,foodBeverageRevenueSar:2000000,otherOperatingRevenueSar:225000,departmentalExpensesSar:4000000,undistributedOperatingExpensesSar:3000000,managementAndFranchiseFeesSar:500000,ffeReserveSar:500000};
const h=run('HOSPITALITY',hotel).metrics;eq(h.occupancyRate,.7);eq(h.averageDailyRateSar,500);eq(h.revParSar,350);eq(h.totalOperatingRevenueSar,15000000);eq(h.operatingSurplusAfterFfeReserveSar,7000000);
for(const patch of [{availableRoomNights:0},{occupiedRoomNights:36501},{occupiedRoomNights:1.5},{occupiedRoomNights:0},{roomsRevenueSar:null},{ffeReserveSar:undefined},{departmentalExpensesSar:-1},{roomsRevenueSar:Infinity},{roomsRevenueSar:'500'}])run('HOSPITALITY',{...hotel,...patch},STATUS.HOLD);
const closed=run('HOSPITALITY',{...hotel,occupiedRoomNights:0,roomsRevenueSar:0}).metrics;eq(closed.averageDailyRateSar,null);eq(closed.revParSar,0);
const industrial={assetId:'SYNTH-01',subtype:'WAREHOUSE',landAreaSqm:2000,builtAreaSqm:1500,netLeasableAreaSqm:1200,clearHeightMeters:10,powerCapacityKva:400,leaseStructure:'GROSS',internalInspectionStatus:'NOT_INSPECTED',buildingPermitStatus:'PROVIDED_UNVERIFIED',annualRentSar:600000,landlordExpensesSar:120000};
for(const subtype of ['WAREHOUSE','DISTRIBUTION_CENTER','COLD_STORAGE','LIGHT_INDUSTRIAL','FACTORY','WORKSHOP','YARD','OTHER']){
 const m=run('INDUSTRIAL_LOGISTICS',{...industrial,subtype,customSubtype:'Synthetic'}).metrics;eq(m.coverageRatio,.75);eq(m.leasableEfficiency,.8);eq(m.annualRentPerLeasableSqm,500);eq(m.declaredNetPropertyIncomeSar,480000);ok(m.warnings.includes('INTERNAL_CONDITION_NOT_FULLY_INSPECTED'));ok(m.warnings.includes('BUILDING_PERMIT_UNVERIFIED'));
}
for(const patch of [{netLeasableAreaSqm:1501},{landAreaSqm:0},{powerCapacityKva:null},{clearHeightMeters:-1},{landlordExpensesSar:600001},{leaseStructure:'UNKNOWN'},{landlordExpensesSar:0},{landlordExpensesSar:0,leaseStructure:'TRIPLE_NET'},{subtype:'OTHER',customSubtype:''},{subtype:'constructor'}])run('INDUSTRIAL_LOGISTICS',{...industrial,...patch},STATUS.HOLD);
eq(run('INDUSTRIAL_LOGISTICS',{...industrial,landlordExpensesSar:0,leaseStructure:'TRIPLE_NET',tenantOpexConfirmed:true}).metrics.declaredNetPropertyIncomeSar,600000);
for(const [assetClass,unit] of [['HEALTHCARE','BED'],['EDUCATION','SEAT'],['PARKING','SPACE'],['DATA_CENTER','MW_IT']]){
 const x={capacity:100,usedCapacity:80,annualOperatingRevenueSar:1000000,annualOperatingExpensesSar:700000};
 const m=run(assetClass,x).metrics;eq(m.unit,unit);eq(m.utilizationRate,.8);eq(m.operatingRevenuePerCapacitySar,10000);eq(m.operatingSurplusSar,300000);
 for(const patch of [{capacity:0},{usedCapacity:101},{usedCapacity:-1},{annualOperatingExpensesSar:NaN},{annualOperatingRevenueSar:null}])run(assetClass,{...x,...patch},STATUS.HOLD);
 if(assetClass!=='DATA_CENTER')run(assetClass,{...x,capacity:100.5},STATUS.HOLD);
 else eq(run(assetClass,{...x,capacity:12.5,usedCapacity:10}).metrics.utilizationRate,.8);
 eq(run(assetClass,{...x,annualOperatingExpensesSar:1200000}).metrics.operatingSurplusSar,-200000);
}
const segs=[{id:'office',areaSqm:1000,annualPropertyRevenueSar:1000000,annualDirectExpensesSar:100000,propertyIncomeOnly:true},{id:'retail',areaSqm:500,annualPropertyRevenueSar:500000,annualDirectExpensesSar:50000,propertyIncomeOnly:true}];
const mixed={segments:segs,totalLeasableAreaSqm:1500,commonExpensesSar:50000,sharedExpensesAllocatedOnce:true};
eq(run('MIXED_USE',mixed).metrics.declaredNetPropertyIncomeSar,1300000);
for(const patch of [{totalLeasableAreaSqm:1499},{sharedExpensesAllocatedOnce:false},{commonExpensesSar:null},{segments:segs.slice(0,1)},{segments:[segs[0],{...segs[1],id:' office '}]},{segments:[segs[0],{...segs[1],propertyIncomeOnly:false}]}])run('MIXED_USE',{...mixed,...patch},STATUS.HOLD);
const cost={propertyRightRef:'SYNTH-RIGHT',landValueSar:2000000,replacementCostSar:1000000,physicalLossSar:100000,functionalLossSar:50000,externalLossSar:50000,lossCausesDistinct:true,businessAssetsExcluded:true};
eq(run('SPECIAL_PURPOSE',cost).metrics.remainingImprovementCostSar,800000);
for(const patch of [{physicalLossSar:1100000},{propertyRightRef:''},{functionalLossSar:-1},{lossCausesDistinct:false},{businessAssetsExcluded:false},{landValueSar:undefined}])run('SPECIAL_PURPOSE',{...cost,...patch},STATUS.HOLD);
for(const c of SUPPORTED_SECTORS){run(c,{},STATUS.HOLD);run(c,null,STATUS.HOLD);}
for(const c of ['OTHER','constructor','__proto__','OFFICE',null])run(c,{},STATUS.HOLD);
const {calculateStudy,createInputArchive,createOperatingReport,restoreStudyFile}=require('../../src/specialized-assets/local-sector-operating-archive');
const state={assetClass:'HOSPITALITY',segments:[],values:Object.fromEntries(Object.entries(hotel).map(([k,v])=>[k,String(v)]))};
const extended={...state,values:{...state.values,sourceCurrency:'SAR',sourceSurplusBasis:'AFTER_FFE_BEFORE_FIXED_CHARGES',sourceAdrDecimals:'2',sourceAverageDailyRateSar:'500',sourceRoomsRevenueSar:'12775000',sourceTotalOperatingRevenueSar:'15000000',sourceOperatingSurplusAfterFfeReserveSar:'7000000'}};
eq(createOperatingReport(state).version,'LOCAL_SECTOR_OPERATING_REPORT_V1');
const report=createOperatingReport(extended);
eq(report.version,'LOCAL_SECTOR_OPERATING_REPORT_V2');
eq(report.result.metrics.sourceReconciliationStatus,'ARITHMETICALLY_CONSISTENT');
eq(report.result.independentEvidenceVerified,false);
eq(restoreStudyFile(report,{expectedAssetClass:'HOSPITALITY'}).resultsRestored,false);
eq(restoreStudyFile(createInputArchive(extended),{expectedAssetClass:'HOSPITALITY'}).studyInputs.values.sourceAverageDailyRateSar,'500');
for(const patch of [{sourceCurrency:'OTHER'},{sourceAverageDailyRateSar:'499'},{sourceOperatingSurplusAfterFfeReserveSar:'6999999'},{sourceTotalOperatingRevenueSar:''},{sourceAdrDecimals:'3'}]){
 const conflict={...extended,values:{...extended.values,...patch}};
 eq(calculateStudy(conflict).status,STATUS.HOLD);
 eq(calculateStudy(conflict).metrics,null);
 assert.throws(()=>createOperatingReport(conflict),/SPECIALIST_REPORT_NOT_READY/);checks++;
}
const zero={...extended,values:{...extended.values,occupiedRoomNights:'0',roomsRevenueSar:'0',sourceAverageDailyRateSar:'',sourceRoomsRevenueSar:'0',sourceTotalOperatingRevenueSar:'2225000',sourceOperatingSurplusAfterFfeReserveSar:'-5775000'}};
eq(calculateStudy(zero).status,STATUS.READY);
eq(calculateStudy({...zero,values:{...zero.values,sourceAverageDailyRateSar:'invalid'}}).status,STATUS.HOLD);
const forged=structuredClone(report);forged.version='LOCAL_SECTOR_OPERATING_REPORT_V1';
assert.throws(()=>restoreStudyFile(forged,{expectedAssetClass:'HOSPITALITY'}));checks++;
console.log('LOCAL_SECTOR_OPERATING_RESEARCH=PASS scenarios='+cases+' checks='+checks+' personal_only=true');
