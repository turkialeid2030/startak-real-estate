'use strict';
const assert=require('node:assert/strict');
const {UNITS,STATUS,evaluateSectorPropertyDcf}=require('../../src/specialized-assets/sector-property-dcf');
const {evaluateLocalSectorOperations}=require('../../src/specialized-assets/local-sector-operating-research');
const {createInputArchive,createOperatingReport,restoreStudyFile,calculateStudy}=require('../../src/specialized-assets/local-sector-operating-archive');
let checks=0,cases=0;
function eq(a,b){assert.equal(a,b);checks++;}
function ok(v){assert.ok(v);checks++;}
function near(a,b,tolerance=.02){ok(Math.abs(a-b)<=tolerance);}
const base={propertyRight:'FREEHOLD',propertyRef:'SYNTH-PROPERTY',leaseAssumptionRef:'SYNTH-LEASE',valuationDate:'2026-11-25',years:5,annualRentPerUnitSar:100000,leasedFraction:.9,collectionFraction:.95,annualOwnerExpensesSar:100000,annualSustainingCapexSar:20000,rentGrowth:0,expenseGrowth:0,purchasePriceSar:3000000,acquisitionCostsSar:100000,discountRate:.1,terminalMode:'EXPLICIT_NET_SALE',terminalNetSaleSar:3000000,terminalEvidenceRef:'SYNTH-NET-SALE',stressRevenueReduction:.2,stressExpenseIncrease:.1,stressDiscountIncrease:.02,propertyIncomeOnly:true,businessAssetsExcluded:true,mixedAllocationConfirmed:true,environmentalObligationsReviewed:true};
function run(x,status=STATUS.READY){cases++;const v=evaluateSectorPropertyDcf(x);eq(v.status,status);eq(v.transactionAuthorized,false);eq(v.professionalValuationCertified,false);eq(v.propertyMarketValueEstablished,false);eq(v.financialModelUpdated,false);ok(Object.isFrozen(v));if(status===STATUS.HOLD){eq(v.investmentNpvSar,null);eq(v.irr,null);eq(v.periods.length,0);ok(v.issues.length>0);}return v;}
for(const [assetClass,unit] of Object.entries(UNITS)){
 const quantity=unit==='WHOLE_PROPERTY'?1:10,annualRentPerUnitSar=1000000/quantity;
 const input={...base,assetClass,quantity,annualRentPerUnitSar};
 const o=run(input);
 eq(o.unit,unit);eq(o.initialInvestmentSar,3100000);eq(o.periods.length,5);eq(o.periods[0].collectedPropertyRentSar,855000);eq(o.periods[0].propertyNoiSar,755000);eq(o.periods[0].cashflowSar,735000);eq(o.periods[4].cashflowSar,3735000);
 const npv=-3100000+Array.from({length:5},(_,i)=>(735000+(i===4?3000000:0))/1.1**(i+1)).reduce((a,b)=>a+b,0);
 const stress=-3100000+Array.from({length:5},(_,i)=>(554000+(i===4?2400000:0))/1.12**(i+1)).reduce((a,b)=>a+b,0);
 near(o.investmentNpvSar,npv,.05);near(o.scenarios.downside.npvSar,stress,.05);
 ok(o.scenarios.downside.npvSar<o.investmentNpvSar);ok(o.irr>0);
 near(-3100000+o.periods.reduce((a,p)=>a+p.cashflowSar/(1+o.irr)**p.year,0),0,.05);
 const noSale=run({...input,terminalMode:'NONE',terminalNetSaleSar:0,terminalEvidenceRef:''});
 eq(noSale.periods[4].terminalNetSaleSar,0);ok(noSale.investmentNpvSar<o.investmentNpvSar);
 const zero=run({...input,leasedFraction:0,terminalMode:'NONE',terminalNetSaleSar:0});
 eq(zero.periods[0].propertyNoiSar,-100000);eq(zero.irr,null);eq(zero.irrReliability,'NOT_COMPUTABLE');
 const growth=run({...input,rentGrowth:.03,expenseGrowth:.04});
 eq(growth.periods[1].potentialRentSar,1030000);eq(growth.periods[1].ownerExpensesSar,104000);
 for(const patch of [{propertyIncomeOnly:false},{businessAssetsExcluded:false},{leaseAssumptionRef:''},{propertyRight:'LEASEHOLD'},{years:31},{quantity:0},{purchasePriceSar:0},{acquisitionCostsSar:.001},{annualOwnerExpensesSar:null},{leasedFraction:1.01},{discountRate:NaN},{collectionFraction:-1},{terminalMode:'NONE'},{terminalEvidenceRef:''},{stressRevenueReduction:1.1},{valuationDate:'2026-02-30'},{annualRentPerUnitSar:1e12,quantity:1e9}])run({...input,...patch},STATUS.HOLD);
 if(assetClass==='MIXED_USE')run({...input,mixedAllocationConfirmed:false},STATUS.HOLD);
 if(assetClass==='FUEL_STATION')run({...input,environmentalObligationsReviewed:false},STATUS.HOLD);
}
for(const assetClass of ['LAND','OTHER','constructor','__proto__',null])run({...base,assetClass,quantity:1},STATUS.HOLD);
const fuel={annualLitres:1000000,sellingPricePerLitre:2,purchaseCostPerLitre:1.8,annualNonFuelRevenueSar:500000,annualNonFuelDirectCostSar:300000,annualOperatingExpensesSar:100000,annualPropertyRentSar:120000,annualEnvironmentalReserveSar:20000,nonFuelSeparated:true,propertyRentSeparated:true,environmentalReviewDeclared:true};
function fuelRun(inputs,status){cases++;const v=evaluateLocalSectorOperations({assetClass:'FUEL_STATION',inputs});eq(v.status,status);eq(v.propertyNoiAdopted,false);eq(v.propertyValueSar,null);eq(v.transactionAuthorized,false);return v;}
const f=fuelRun(fuel,'OPERATING_RESEARCH_ONLY');near(f.metrics.fuelMarginSar,200000);near(f.metrics.nonFuelMarginSar,200000);near(f.metrics.operatingSurplusSar,160000);
near(fuelRun({...fuel,purchaseCostPerLitre:2.2},'OPERATING_RESEARCH_ONLY').metrics.fuelMarginSar,-200000);
for(const patch of [{annualLitres:-1},{sellingPricePerLitre:0},{purchaseCostPerLitre:null},{annualPropertyRentSar:undefined},{annualEnvironmentalReserveSar:-1},{nonFuelSeparated:false},{propertyRentSeparated:false},{environmentalReviewDeclared:false}])fuelRun({...fuel,...patch},'HOLD');
const state={assetClass:'FUEL_STATION',values:Object.fromEntries(Object.entries(fuel).map(([k,v])=>[k,typeof v==='boolean'?v:String(v)])),segments:[]};
const date='2026-11-25T00:00:00.000Z';
for(const file of [createInputArchive(state,{createdAt:date}),createOperatingReport(state,{createdAt:date})]){
 cases++;const restored=restoreStudyFile(file,{expectedAssetClass:'FUEL_STATION'});eq(restored.resultsRestored,false);eq(restored.authorityRestored,false);near(calculateStudy(restored.studyInputs).metrics.operatingSurplusSar,160000);
 assert.throws(()=>restoreStudyFile(file,{expectedAssetClass:'SPECIAL_PURPOSE'}));checks++;
}
console.log('SECTOR_DCF_FUEL=PASS cases='+cases+' checks='+checks+' scope=PERSONAL_ONLY');
