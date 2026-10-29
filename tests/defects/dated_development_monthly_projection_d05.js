'use strict';
const assert=require('node:assert/strict');
const {projectDatedDevelopment,calendarMonthDate}=require('../../src/valuation-intelligence/dated-development-projection');
const {calculateInvestmentCase}=require('../../src/engines');
const {STUDY_TYPE}=require('../../src/contracts/study-type');
const gold=require('../reference/RE-GOLD-baseline.json')['RE-GOLD-001_land_development'].inputs;
const reference=require('../reference/D05-monthly-reference.json');
const base={...gold,landLength:10,landWidth:10,landPricePerSqm:1000,buildableRatio:1,officeFloorCount:1,
 servicesRatioPerFloor:0,basementFloorCount:0,constructionCostPerSqm:1000,landCommissionRate:0,
 landTransferFeeRate:0,engineeringCost:0,landValuationCost:0,marketRentPerSqm:3600,occupancyRate:1,
 serviceIncomeRate:0,opexRate:0,marketCapRate:0.1,constructionPeriod:2.5,rentGrowthRate:0,
 operatingPeriod:1,exitCapRate:0.1,hurdleRate:0.1,exitTransferFeeRate:0,ltv:0.5,
 minDscrThreshold:1,equityRiskSpread:0};
let checks=0;const ok=(v,message)=>{assert.ok(v,message);checks++};
const near=(a,b,tolerance,message)=>ok(Number.isFinite(a)&&Math.abs(a-b)<=tolerance,message+' '+a+' vs '+b);
for(const c of reference.cases){
 const inputs={...base,leverageEnabled:c.financed,loanRate:c.rate,loanTenor:c.tenorYears,
  operatingPeriod:c.operatingYears,gracePeriodMonths:c.grace,graceType:'CAPITALIZED',balloonPct:c.balloon};
 const before=JSON.stringify(inputs),canonical=calculateInvestmentCase({studyType:STUDY_TYPE.LAND_DEVELOPMENT,inputs});
 const args={inputs,startDate:'2026-01-31',sourceReference:'SYNTH/Independent Decimal reference',
  incomeTiming:c.timing,assumptionsConfirmed:true};
 const r=projectDatedDevelopment(args);
 ok(r.status==='ILLUSTRATIVE_DATED_DEVELOPMENT_CALCULATED',c.name+' calculated '+r.blockers);
 ok(r.constructionMonths===30&&r.canonicalRoundedConstructionYears===3,'2.5 years stays 30 months in illustration');
 ok(r.completionDate==='2028-07-31','completion at month 30, not month 36');
 near(r.accounting.completionDebtSar,c.completionDebt,0.001,'independent completion balance');
 near(r.accounting.capitalizedInterestSar,c.capitalizedInterest,0.001,'independent monthly capitalized interest');
 near(r.accounting.remainingDebtAtExitSar,c.remainingDebt,0.001,'independent residual principal');
 for(const basis of ['project','equity']){
  near(r[basis].xnpvSar,c[basis].npv,0.01,'independent actual-day '+basis+' NPV');
  if(c[basis].irr===null)ok(r[basis].xirr===null&&r[basis].xirrStatus==='HOLD','multiple-sign IRR is withheld');
  else near(r[basis].xirr,c[basis].irr,1e-8,'independent '+basis+' XIRR');
  assert.deepEqual(r[basis+'Cashflows'],c[basis].cashflows);checks++;
 }
 for(let i=0;i<30;i++){
  const row=r.constructionRows[i],expected=c.construction[i];
  ok(row.drawDate===expected.drawDate&&row.capitalizationDate===expected.capitalizationDate,'independent month boundaries');
  ok(row.constructionCostSar===expected.cost&&row.debtDrawSar===expected.draw&&
   row.capitalizedInterestSar===expected.interest&&row.endingDebtSar===expected.balance,'independent monthly halala accounting');
 }
 for(let i=0;i<c.debt.length;i++){
  ok(r.debtRows[i].totalPayment===c.debt[i].payment&&r.debtRows[i].balance===c.debt[i].balance,'independent term/grace/balloon payments');
 }
 ok(r.accounting.projectAndEquityCashflowsReconciled===true,'project and equity totals reconciled');
 ok(r.accounting.landAcquisitionCostSar===100000&&r.accounting.annualNoiTotalSar===360000*c.operatingYears&&
  r.accounting.terminalNetExitSar===3600000,'export exposes acquisition, operating and terminal accounting totals');
 ok(r.accounting.canonicalMonthlyFinancingAmountsMatched===(c.financed?true:null),'canonical facility matched only when financed');
 ok(!r.independentlyVerified&&!r.canonicalTimingReconciled&&!r.canonicalReturnsChanged&&
  !r.transactionAuthorized&&!r.professionalValuationAuthorized&&!r.exactFinancingContractModel,'illustration cannot create external authority');
 ok(JSON.stringify(inputs)===before,'inputs not mutated');
 assert.deepEqual(calculateInvestmentCase({studyType:STUDY_TYPE.LAND_DEVELOPMENT,inputs}),canonical);checks++;
}
const valid={inputs:{...base,leverageEnabled:true,loanRate:0.06,loanTenor:1},startDate:'2026-01-31',
 sourceReference:'SYNTH/plan',incomeTiming:'UNIFORM_MONTHLY',assumptionsConfirmed:true};
for(const patch of [{assumptionsConfirmed:false},{startDate:''},{startDate:'2026-02-30'},
 {sourceReference:''},{incomeTiming:''},{incomeTiming:'UNKNOWN'},
 {inputs:{...valid.inputs,constructionPeriod:0}},{inputs:{...valid.inputs,operatingPeriod:1.5}},
 {inputs:{...valid.inputs,loanRate:'1e3'}},{inputs:{...valid.inputs,loanTenor:101}},
 {startDate:'9999-12-31'}]){
 const r=projectDatedDevelopment({...valid,...patch});
 ok(r.status==='HOLD_DATED_DEVELOPMENT_INPUTS'&&r.project===null&&r.equity===null,'invalid or unconfirmed projection held');
}
ok(calendarMonthDate('2026-01-31',1)==='2026-02-28'&&calendarMonthDate('2026-01-31',2)==='2026-03-31','original day restored after short month');
ok(calendarMonthDate('2028-01-31',1)==='2028-02-29','leap year month boundary');
ok(calendarMonthDate('2026-02-30',1)===null,'impossible anchor rejected');
const rounded=projectDatedDevelopment({...valid,inputs:{...valid.inputs,constructionPeriod:2.51}});
ok(rounded.status==='ILLUSTRATIVE_DATED_DEVELOPMENT_CALCULATED'&&rounded.constructionMonths===30&&
 rounded.constructionMonthRoundingApplied===true,'sub-month rounding disclosed rather than presented as exact daily duration');
const zeroDebt=projectDatedDevelopment({...valid,inputs:{...valid.inputs,ltv:0,equityRiskSpread:0.15}});
ok(zeroDebt.status==='ILLUSTRATIVE_DATED_DEVELOPMENT_CALCULATED'&&zeroDebt.equity.annualDiscountRate===0.1&&
 zeroDebt.accounting.canonicalMonthlyFinancingAmountsMatched===null,'zero requested debt does not create a leverage risk premium');
near(zeroDebt.project.xnpvSar,zeroDebt.equity.xnpvSar,0.000001,'zero-debt project and equity dated returns agree');
console.log('D05_DATED_DEVELOPMENT_MONTHLY_PROJECTION=PASS references='+reference.cases.length+' checks='+checks);
