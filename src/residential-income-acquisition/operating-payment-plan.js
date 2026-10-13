'use strict';
const {parseLedgerAmount}=require('./receivables-ledger');
const fail=code=>{throw new TypeError(code);};
function validateOperatingPaymentPlan(plan,operatingCase){
  if(!plan||plan.schemaVersion!==1||plan.caseId!==operatingCase.caseId||!Array.isArray(plan.entries))fail('OPERATING_PLAN_INVALID');
  for(const key of ['sourceRef','reviewRef'])if(typeof plan[key]!=='string'||!plan[key].trim()||plan[key].length>500)fail('OPERATING_PLAN_REFERENCE_REQUIRED');
  if(plan.sourceRef.trim()===plan.reviewRef.trim())fail('OPERATING_PLAN_REFERENCE_REQUIRED');
  if(plan.entries.length>2000)fail('OPERATING_PLAN_LIMIT_EXCEEDED');
  const ids=new Set(operatingCase.operatingExpenses.filter(x=>x.basis==='BUDGET'&&x.annualAmount.unit==='SAR/year').map(x=>x.expenseId)),seen=new Set();
  let total=0;
  const entries=plan.entries.map(entry=>{
    if(!ids.has(entry.expenseId))fail('OPERATING_PLAN_BUDGET_ITEM_REQUIRED');
    if(typeof entry.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)||!Number.isFinite(Date.parse(entry.date))||new Date(entry.date).toISOString().slice(0,10)!==entry.date)fail('OPERATING_PLAN_DATE_INVALID');
    if(!Number.isSafeInteger(entry.amountMinor)||entry.amountMinor<=0)fail('OPERATING_PLAN_AMOUNT_INVALID');
    total+=entry.amountMinor;if(!Number.isSafeInteger(total))fail('OPERATING_PLAN_AMOUNT_OUT_OF_RANGE');
    const key=JSON.stringify([entry.expenseId,entry.date]);if(seen.has(key))fail('OPERATING_PLAN_DUPLICATE_DATE');seen.add(key);
    return {expenseId:entry.expenseId,date:entry.date,amountMinor:entry.amountMinor};
  });
  return {schemaVersion:1,caseId:plan.caseId,sourceRef:plan.sourceRef.trim(),reviewRef:plan.reviewRef.trim(),entries};
}
function calculateOperatingPaymentPlan(operatingCase,periods){
  const empty={status:'NOT_AVAILABLE',issues:[],rows:[],total:null,outsideHorizon:null,sourceRef:null,reviewRef:null,coverageComplete:false,cashBalanceCalculated:false};
  if(!operatingCase.operatingPaymentPlan)return empty;
  const plan=validateOperatingPaymentPlan(operatingCase.operatingPaymentPlan,operatingCase);
  const issues=plan.entries.filter(e=>e.date<operatingCase.asOfDate.slice(0,10)).map(e=>({code:'OPERATING_PLAN_PAST_DATE',refId:e.expenseId}));
  if(issues.length)return {...empty,status:'NEEDS_REVIEW',issues,sourceRef:plan.sourceRef,reviewRef:plan.reviewRef};
  if(!plan.entries.length)return {...empty,sourceRef:plan.sourceRef,reviewRef:plan.reviewRef};
  let covered=0;const total=plan.entries.reduce((s,e)=>s+e.amountMinor,0);
  const rows=periods.map(p=>{
    const entries=plan.entries.filter(e=>e.date>=p.periodStart&&e.date<p.periodEndExclusive);
    const amountMinor=entries.reduce((s,e)=>s+e.amountMinor,0);covered+=amountMinor;
    return {periodStart:p.periodStart,amount:amountMinor/100,entries};
  });
  return {...empty,status:'RECORDED_PLAN',rows,total:covered/100,outsideHorizon:(total-covered)/100,sourceRef:plan.sourceRef,reviewRef:plan.reviewRef,
    unscheduledExpenseIds:operatingCase.operatingExpenses.filter(x=>x.basis==='BUDGET'&&x.annualAmount.unit==='SAR/year'&&!plan.entries.some(e=>e.expenseId===x.expenseId)).map(x=>x.expenseId),
    semantics:'Explicit, locally reviewed future payments for selected budget items only. Annual budget amounts are not payment schedules and are not prorated, reconciled or substituted. Coverage is not certified complete; no net cash forecast, bank balance, actual payment or spending authority is inferred. Normalized OPEX and historical payments are separate.'};
}
function replaceOperatingPaymentPlan(operatingCase,draft){
  if(draft?.confirmed!==true)fail('EXPLICIT_VERIFICATION_CONFIRMATION_REQUIRED');
  if(!Array.isArray(draft.entries))fail('OPERATING_PLAN_INVALID');
  const plan={schemaVersion:1,caseId:operatingCase.caseId,sourceRef:draft.sourceRef,reviewRef:draft.reviewRef,entries:draft.entries.map(e=>({expenseId:e.expenseId,date:e.date,amountMinor:parseLedgerAmount(e.amount)}))};
  const {createResidentialIncomeOperatingCase}=require('./contracts');
  const candidate=createResidentialIncomeOperatingCase({...operatingCase,operatingPaymentPlan:plan});
  const result=calculateOperatingPaymentPlan(candidate,[]);
  if(result.issues.length)fail(result.issues[0].code);
  return candidate;
}
module.exports={validateOperatingPaymentPlan,calculateOperatingPaymentPlan,replaceOperatingPaymentPlan};
