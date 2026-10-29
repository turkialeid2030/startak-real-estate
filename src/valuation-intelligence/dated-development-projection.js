'use strict';
const {calculateInvestmentCase}=require('../engines');
const {STUDY_TYPE}=require('../contracts/study-type');
const {simulateConstructionFacility}=require('../engines/financial/construction-debt');
const {buildMonthlyDebtPlan}=require('../engines/financial/monthly-debt');
const {toMoney,fromMoney,allocateMoney}=require('../engines/financial/precision');
const {normalizeCashflows,xnpv,solveDatedXirr}=require('./dated-returns');
const VERSION='DATED_DEVELOPMENT_MONTHLY_ILLUSTRATION_V1';
const validDate=s=>typeof s==='string'&&normalizeCashflows([{date:s,amount:0}])!==null;
function calendarMonthDate(anchor,offset){
 if(!validDate(anchor)||!Number.isInteger(offset)||offset<0||offset>2400)return null;
 const [year,month,day]=anchor.split('-').map(Number);
 const target=new Date(Date.UTC(year,month-1+offset,1));
 if(target.getUTCFullYear()>9999)return null;
 const end=new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate();
 target.setUTCDate(Math.min(day,end));
 return target.toISOString().slice(0,10);
}
const moneyEqual=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&toMoney(a)===toMoney(b);
function aggregateHalalaRows(rows){
 const values=new Map();
 for(const row of rows)values.set(row.date,(values.get(row.date)||0n)+toMoney(row.amount));
 return [...values.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([date,amount])=>({date,amount:fromMoney(amount)}));
}
function metrics(flows,rate){
 const solved=solveDatedXirr({cashflows:flows});
 const npv=xnpv(rate,flows);
 if(!Number.isFinite(npv))throw Error('DATED_NPV_NOT_FINITE');
 return {xnpvSar:npv,xirr:solved.xirr,xirrStatus:solved.status,xirrBlockers:solved.blockers,
  annualDiscountRate:rate,dayCount:'ACT/365.2425'};
}
function projectDatedDevelopment({inputs,startDate='',sourceReference='',incomeTiming='',
 assumptionsConfirmed=false,assumptionModelVersion}={}){
 const fail=blocker=>Object.freeze({version:VERSION,status:'HOLD_DATED_DEVELOPMENT_INPUTS',blockers:[blocker],
  project:null,equity:null,canonicalReturnsChanged:false,independentlyVerified:false,
  transactionAuthorized:false,professionalValuationAuthorized:false});
 if(assumptionsConfirmed!==true)return fail('EXPLICIT_PROJECTION_ASSUMPTIONS_REQUIRED');
 if(!validDate(startDate))return fail('EXPLICIT_PROJECTION_START_DATE_REQUIRED');
 if(typeof sourceReference!=='string'||!sourceReference.trim()||sourceReference.length>240)
  return fail('PROJECTION_TIMELINE_SOURCE_REQUIRED');
 if(!['ANNUAL_END','UNIFORM_MONTHLY'].includes(incomeTiming))return fail('EXPLICIT_INCOME_TIMING_REQUIRED');
 if(!inputs||typeof inputs!=='object'||!Number.isFinite(inputs.constructionPeriod)||
   inputs.constructionPeriod<=0||inputs.constructionPeriod>100||
   !Number.isInteger(inputs.operatingPeriod)||inputs.operatingPeriod<1||inputs.operatingPeriod>100||
   !Number.isFinite(inputs.loanTenor)||inputs.loanTenor<=0||inputs.loanTenor>100)
  return fail('PROJECTION_HORIZON_UNSUPPORTED');
 try{
  // Recompute from current inputs, never accept an unrelated cached result.
  const canonical=calculateInvestmentCase({studyType:STUDY_TYPE.LAND_DEVELOPMENT,inputs,assumptionModelVersion});
  if(canonical.decisionStatus==='INCOMPLETE_INPUTS')return fail('CANONICAL_FINANCIAL_INPUTS_INCOMPLETE');
  const amounts=[canonical.totalLandAcquisitionCost,canonical.totalConstructionCost,canonical.totalProjectCost,
   canonical.terminalNetExitValue,...(canonical.operatingNoiCashflows||[])];
  if(!amounts.every(x=>Number.isFinite(x)&&Math.abs(x)<=1e12)||
   canonical.operatingNoiCashflows?.length!==inputs.operatingPeriod)
   return fail('CANONICAL_PROJECTION_AMOUNTS_UNAVAILABLE');
  const land=toMoney(canonical.totalLandAcquisitionCost),cost=toMoney(canonical.totalConstructionCost);
  if(land<0n||cost<0n||land+cost!==toMoney(canonical.totalProjectCost))
   return fail('COST_ROUNDING_RECONCILIATION_REQUIRED');
  const financed=inputs.leverageEnabled===true&&inputs.ltv>0;
  const fraction=financed?canonical.constructionDebtFraction:0;
  const facility=simulateConstructionFacility({landCost:fromMoney(land),constructionCost:fromMoney(cost),
   debtFraction:fraction,annualRate:inputs.loanRate,constructionYears:inputs.constructionPeriod});
  const months=facility.constructionMonths,operationMonths=inputs.operatingPeriod*12;
  const completionDate=calendarMonthDate(startDate,months),exitDate=calendarMonthDate(startDate,months+operationMonths);
  if(!completionDate||!exitDate)return fail('PROJECTION_CALENDAR_OUT_OF_RANGE');
  if(financed&&(!moneyEqual(facility.completionBalance,canonical.constructionLoanBalance)||
   !moneyEqual(facility.capitalizedInterest,canonical.capitalizedConstructionInterest)||
   !moneyEqual(facility.principalDebtDraws,canonical.loanAmount)||
   !Array.isArray(canonical.constructionDebtSchedule)||canonical.constructionDebtSchedule.length!==months||
   facility.schedule.some((row,i)=>['constructionDebtDraw','capitalizedInterest','balance'].some(k=>
    !moneyEqual(row[k],canonical.constructionDebtSchedule[i]?.[k])))))
   return fail('CANONICAL_MONTHLY_FACILITY_MISMATCH');
  const plan=buildMonthlyDebtPlan(facility.completionBalance,inputs.loanRate,inputs.loanTenor,{
   gracePeriodMonths:inputs.gracePeriodMonths??0,graceType:inputs.graceType||'INTEREST_ONLY',
   balloonPct:inputs.balloonPct??0});
  if(financed&&(!Array.isArray(canonical.annualDebtService)||
   canonical.annualDebtService.length!==plan.annualDebtService.length||
   plan.annualDebtService.some((x,i)=>!moneyEqual(x,canonical.annualDebtService[i]))))
   return fail('CANONICAL_TERM_DEBT_MISMATCH');
  const monthlyCosts=allocateMoney(fromMoney(cost),months);
  const projectRows=[],equityRows=[],constructionRows=[],debtRows=[],incomeRows=[];
  const push=(target,date,amount,kind)=>target.push({date,amount:fromMoney(amount),kind});
  push(projectRows,startDate,-land,'LAND_ACQUISITION');
  push(equityRows,startDate,-land+toMoney(facility.landDebtDraw),'LAND_EQUITY');
  let costTotal=0n,debtPrincipalTotal=toMoney(facility.landDebtDraw),equityConstructionTotal=0n;
  for(let i=0;i<months;i++){
   const paid=toMoney(monthlyCosts[i]),draw=toMoney(facility.schedule[i].constructionDebtDraw);
   if(draw>paid)return fail('MONTHLY_DRAW_ALLOCATION_RECONCILIATION_REQUIRED');
   const date=calendarMonthDate(startDate,i),interestDate=calendarMonthDate(startDate,i+1);
   push(projectRows,date,-paid,'CONSTRUCTION_COST');push(equityRows,date,-paid+draw,'CONSTRUCTION_EQUITY');
   constructionRows.push({month:i+1,drawDate:date,capitalizationDate:interestDate,
    constructionCostSar:fromMoney(paid),debtDrawSar:fromMoney(draw),equityDrawSar:fromMoney(paid-draw),
    capitalizedInterestSar:facility.schedule[i].capitalizedInterest,endingDebtSar:facility.schedule[i].balance});
   costTotal+=paid;debtPrincipalTotal+=draw;equityConstructionTotal+=paid-draw;
  }
  let incomeTotal=0n;
  for(let year=0;year<inputs.operatingPeriod;year++){
   const noi=toMoney(canonical.operatingNoiCashflows[year]);
   const pieces=incomeTiming==='UNIFORM_MONTHLY'?allocateMoney(fromMoney(noi),12):[fromMoney(noi)];
   for(let i=0;i<pieces.length;i++){
    const offset=months+year*12+(incomeTiming==='UNIFORM_MONTHLY'?i+1:12);
    const date=calendarMonthDate(startDate,offset),amount=toMoney(pieces[i]);
    push(projectRows,date,amount,'OPERATING_NOI');push(equityRows,date,amount,'OPERATING_NOI');
    incomeRows.push({operatingYear:year+1,date,amountSar:fromMoney(amount)});incomeTotal+=amount;
   }
  }
  let debtPaid=0n;
  for(const row of plan.schedule.filter(x=>x.month<=operationMonths)){
   const date=calendarMonthDate(startDate,months+row.month),amount=toMoney(row.totalPayment);
   push(equityRows,date,-amount,'TERM_DEBT_SERVICE');debtPaid+=amount;
   debtRows.push({...row,paymentDate:date});
  }
  const remaining=toMoney(plan.schedule[Math.min(operationMonths,plan.schedule.length)-1]?.balance||0);
  const terminal=toMoney(canonical.terminalNetExitValue);
  push(projectRows,exitDate,terminal,'TERMINAL_NET_EXIT');
  push(equityRows,exitDate,terminal-remaining,'TERMINAL_NET_EXIT_AFTER_DEBT');
  const sum=values=>values.reduce((total,value)=>total+toMoney(value),0n);
  const allNoi=sum(canonical.operatingNoiCashflows);
  const p=aggregateHalalaRows(projectRows),e=aggregateHalalaRows(equityRows);
  if(costTotal!==cost||debtPrincipalTotal!==toMoney(facility.principalDebtDraws)||incomeTotal!==allNoi||
   sum(p.map(x=>x.amount))!==-land-cost+allNoi+terminal||
   sum(e.map(x=>x.amount))!==-land+toMoney(facility.landDebtDraw)-equityConstructionTotal+allNoi-debtPaid+terminal-remaining)
   return fail('DATED_PROJECTION_ACCOUNTING_MISMATCH');
  const project=metrics(p,inputs.hurdleRate);
  const equity=metrics(e,financed?canonical.equityDiscountRate:inputs.hurdleRate);
  return {version:VERSION,status:'ILLUSTRATIVE_DATED_DEVELOPMENT_CALCULATED',blockers:[],
   startDate,completionDate,exitDate,sourceReference:sourceReference.trim(),incomeTiming,
   constructionMonths:months,canonicalRoundedConstructionYears:canonical.constructionYears,
   constructionMonthRoundingApplied:Math.abs(inputs.constructionPeriod*12-months)>1e-9,
   monthRule:'ORIGINAL_DAY_CLAMPED_TO_CALENDAR_MONTH_END',
   constructionCashTiming:'MONTHLY_BEGINNING',constructionInterestTiming:'MONTHLY_END_CAPITALIZED',
   incomeTimingIsUserSelectedIllustration:true,project,equity,
   projectCashflows:p,equityCashflows:e,constructionRows,debtRows,incomeRows,
   accounting:{landAcquisitionCostSar:fromMoney(land),constructionCostSar:fromMoney(costTotal),
    annualNoiTotalSar:fromMoney(allNoi),terminalNetExitSar:fromMoney(terminal),principalDebtDrawsSar:fromMoney(debtPrincipalTotal),
    capitalizedInterestSar:facility.capitalizedInterest,completionDebtSar:facility.completionBalance,
    termPaymentsToExitSar:fromMoney(debtPaid),remainingDebtAtExitSar:fromMoney(remaining),
    canonicalMonthlyFinancingAmountsMatched:financed?true:null,projectAndEquityCashflowsReconciled:true},
   canonicalComparison:{projectIrr:canonical.irr,projectNpvSar:canonical.npv,
    equityIrr:financed?canonical.leveredIRR:canonical.irr,
    equityNpvSar:financed?canonical.leveredNPV:canonical.npv},
   canonicalFinancialModelVersion:canonical.financialModelVersion,
   canonicalFinancingEngineVersion:financed?canonical.financingEngineVersion:null,
   canonicalReturnsChanged:false,independentlyVerified:false,sourceDatesIndependentlyVerified:false,canonicalTimingReconciled:false,
   monthlyTimingIsIllustrative:true,exactFinancingContractModel:false,
   transactionAuthorized:false,professionalValuationAuthorized:false};
 }catch(_){return fail('DATED_DEVELOPMENT_CALCULATION_UNAVAILABLE');}
}
module.exports={VERSION,calendarMonthDate,projectDatedDevelopment};
