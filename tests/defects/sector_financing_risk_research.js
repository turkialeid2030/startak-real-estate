'use strict';
const assert=require('node:assert/strict');
const {UNITS}=require('../../src/specialized-assets/sector-property-dcf');
const {calculateDcfStudy}=require('../../src/specialized-assets/sector-property-dcf-archive');
const {STATUS,evaluateSectorFinancingRisk}=require('../../src/specialized-assets/sector-financing-risk-research');
let checks=0,cases=0;
function eq(a,b){assert.equal(a,b);checks++;}
function ok(v){assert.ok(v);checks++;}
function near(a,b,t=.05){ok(Math.abs(a-b)<=t);}
const raw={propertyRight:'FREEHOLD',propertyRef:'SYNTH-PROPERTY',leaseAssumptionRef:'SYNTH-LEASE',valuationDate:'2026-11-25',years:'5',annualRentPerUnitSar:'100000',leasedFraction:'.9',collectionFraction:'.95',annualOwnerExpensesSar:'100000',annualSustainingCapexSar:'20000',rentGrowth:'0',expenseGrowth:'0',purchasePriceSar:'3000000',acquisitionCostsSar:'100000',discountRate:'.1',terminalMode:'EXPLICIT_NET_SALE',terminalNetSaleSar:'3000000',terminalEvidenceRef:'SYNTH-NET-SALE',stressRevenueReduction:'.2',stressExpenseIncrease:'.1',stressDiscountIncrease:'.02',propertyIncomeOnly:true,businessAssetsExcluded:true};
const f={mode:'UNFINANCED',financingAssumptionRef:'SYNTH-FINANCE',taxCashflowAssumptionRef:'SYNTH-TAX',principalSar:0,upfrontFinanceFeeSar:0,annualRate:0,tenorYears:0,equityDiscountRate:.1,annualAdditionalTaxSar:0,exitAdditionalTaxSar:0,additionalTaxCashflowsConfirmed:true,noDuplicateCostsConfirmed:true};
const m={assumptionRef:'SYNTH-RISK',seed:123456,samples:64,rentVariation:0,expenseVariation:0,saleVariation:0};
function run(study,financing=f,risk=m,status=STATUS.READY){
 cases++;const v=evaluateSectorFinancingRisk({study,financing,risk});
 eq(v.status,status);eq(v.transactionAuthorized,false);eq(v.professionalValuationCertified,false);eq(v.financeApproved,false);eq(v.taxOpinionEstablished,false);eq(v.financialModelUpdated,false);
 if(status===STATUS.HOLD){eq(v.equityNpvSar,null);eq(v.simulation,null);eq(v.periods.length,0);}
 return v;
}
for(const [assetClass,unit] of Object.entries(UNITS)){
 const quantity=unit==='WHOLE_PROPERTY'?1:10;
 const study={assetClass,raw:{...raw,quantity:String(quantity),annualRentPerUnitSar:String(1000000/quantity),...(assetClass==='MIXED_USE'?{mixedAllocationConfirmed:true}:{}),...(assetClass==='FUEL_STATION'?{environmentalObligationsReviewed:true}:{})}};
 const base=calculateDcfStudy(study);
 const unfinanced=run(study);
 eq(unfinanced.equityNpvSar,base.investmentNpvSar);eq(unfinanced.equityIrr,base.irr);eq(unfinanced.minAnnualNoiDscr,null);
 eq(unfinanced.simulation.p10NpvSar,base.investmentNpvSar);eq(unfinanced.simulation.p50NpvSar,base.investmentNpvSar);eq(unfinanced.simulation.p90NpvSar,base.investmentNpvSar);
 const terms={...f,mode:'FIXED_RATE_AMORTIZING_PROXY',principalSar:1200000,tenorYears:10,annualRate:0,upfrontFinanceFeeSar:10000,annualAdditionalTaxSar:5000,exitAdditionalTaxSar:25000};
 const financed=run(study,terms);
 eq(financed.initialEquitySar,1910000);eq(financed.periods[0].debtServiceSar,120000);eq(financed.periods[4].exitDebtPayoffSar,600000);eq(financed.periods[4].endingDebtSar,0);near(financed.minAnnualNoiDscr,755000/120000,1e-10);
 eq(financed.periods[0].equityCashflowSar,610000);eq(financed.periods[4].equityCashflowSar,2985000);
 const npv=-1910000+610000/1.1+610000/1.1**2+610000/1.1**3+610000/1.1**4+2985000/1.1**5;
 near(financed.equityNpvSar,npv);near(-1910000+financed.periods.reduce((a,p)=>a+p.equityCashflowSar/(1+financed.equityIrr)**p.year,0),0);
 const interest=run(study,{...terms,annualRate:.06,tenorYears:5});
 eq(interest.periods[4].exitDebtPayoffSar,0);eq(interest.periods[4].endingDebtSar,0);
 ok(interest.periods.reduce((a,p)=>a+p.debtServiceSar,0)>1200000);
 const random={...m,rentVariation:.2,expenseVariation:.1,saleVariation:.2};
 const sim=run(study,terms,random).simulation;
 eq(JSON.stringify(sim),JSON.stringify(run(study,terms,random).simulation));
 ok(sim.p10NpvSar<=sim.p50NpvSar&&sim.p50NpvSar<=sim.p90NpvSar);ok(sim.p10NpvSar<sim.p90NpvSar);ok(sim.negativeNpvShare>=0&&sim.negativeNpvShare<=1);
 for(const patch of [{principalSar:3100000},{principalSar:0},{tenorYears:0},{annualRate:-.01},{annualAdditionalTaxSar:.001},{noDuplicateCostsConfirmed:false},{taxCashflowAssumptionRef:''},{additionalTaxCashflowsConfirmed:false}])run(study,{...terms,...patch},m,STATUS.HOLD);
 for(const patch of [{seed:0},{samples:513},{rentVariation:1.01},{assumptionRef:''}])run(study,terms,{...m,...patch},STATUS.HOLD);
 const noSale={...study,raw:{...study.raw,terminalMode:'NONE',terminalNetSaleSar:'0'}};
 run(noSale,terms,m,STATUS.HOLD);run(noSale,{...f,exitAdditionalTaxSar:1},m,STATUS.HOLD);
 run({...study,raw:{...study.raw,propertyIncomeOnly:false}},f,m,STATUS.HOLD);
 run(study,{...f,principalSar:1},m,STATUS.HOLD);
}
console.log('SECTOR_FINANCING_RISK=PASS cases='+cases+' checks='+checks+' scope=PERSONAL_ONLY');
