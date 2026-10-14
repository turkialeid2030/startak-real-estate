'use strict';
const {parseLedgerAmount}=require('./receivables-ledger');
const {calculateOperatingPaymentPlan}=require('./operating-payment-plan');
const {calculateCapitalPaymentPlan}=require('./capital-payment-plan');
const fail=code=>{throw new TypeError(code);};
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
function openingAmount(value){
  if(typeof value!=='string'&&typeof value!=='number')fail('CASH_OPENING_INVALID');
  const s=String(value).trim().replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/٫/g,'.');
  if(/^-?0+(?:\.0{1,2})?$/.test(s))return 0;
  return s.startsWith('-')?-parseLedgerAmount(s.slice(1)):parseLedgerAmount(s);
}
function validateCashScenario(plan,c){
  if(!plan||plan.schemaVersion!==1||plan.caseId!==c.caseId||!Array.isArray(plan.entries)||plan.entries.length>2000)fail('CASH_SCENARIO_INVALID');
  for(const key of ['sourceRef','reviewRef'])if(typeof plan[key]!=='string'||!plan[key].trim()||plan[key].length>500)fail('CASH_REFERENCE_REQUIRED');
  if(plan.sourceRef.trim()===plan.reviewRef.trim())fail('CASH_REFERENCE_REQUIRED');
  if(!date(plan.openingDate)||!Number.isSafeInteger(plan.openingMinor))fail('CASH_OPENING_INVALID');
  const ids=new Set(c.leases.map(x=>x.leaseId)),seen=new Set();let total=0n;
  const entries=plan.entries.map(e=>{
    if(!ids.has(e.leaseId))fail('CASH_LEASE_REQUIRED');
    if(!date(e.date))fail('CASH_DATE_INVALID');
    if(!Number.isSafeInteger(e.amountMinor)||e.amountMinor<=0)fail('CASH_AMOUNT_INVALID');
    if(typeof e.reference!=='string'||!e.reference.trim()||e.reference.length>500||seen.has(e.reference.trim()))fail('CASH_UNIQUE_REFERENCE_REQUIRED');
    seen.add(e.reference.trim());total+=BigInt(e.amountMinor);if(total>BigInt(Number.MAX_SAFE_INTEGER))fail('CASH_AMOUNT_OUT_OF_RANGE');
    return {leaseId:e.leaseId,date:e.date,amountMinor:e.amountMinor,reference:e.reference.trim()};
  });
  return {schemaVersion:1,caseId:plan.caseId,openingDate:plan.openingDate,openingMinor:plan.openingMinor,sourceRef:plan.sourceRef.trim(),reviewRef:plan.reviewRef.trim(),entries};
}
function calculateCashScenario(c,periods){
  const empty={status:'NOT_AVAILABLE',rows:[],closingMinor:null,issues:[],coverageComplete:false,actualBankBalance:false};
  if(!c.cashScenario)return empty;
  const p=validateCashScenario(c.cashScenario,c),issues=[];
  if(!periods.length)return {...empty,status:'NEEDS_REVIEW',issues:[{code:'CASH_HORIZON_REQUIRED'}]};
  const start=periods[0].periodStart,end=periods[periods.length-1].periodEndExclusive;
  if(start!==c.asOfDate.slice(0,10)||p.openingDate!==start)issues.push({code:'CASH_OPENING_DATE_MISMATCH'});
  for(let i=0;i<periods.length;i++)if(!date(periods[i].periodStart)||!date(periods[i].periodEndExclusive)||periods[i].periodStart>=periods[i].periodEndExclusive||(i&&periods[i-1].periodEndExclusive!==periods[i].periodStart))issues.push({code:'CASH_HORIZON_REQUIRED'});
  if(p.entries.some(e=>e.date<start||e.date>=end))issues.push({code:'CASH_RECEIPT_OUTSIDE_HORIZON'});
  const operating=calculateOperatingPaymentPlan(c,periods),capital=calculateCapitalPaymentPlan(c,periods),b=c.operatingPaymentPlan?.budgetControl;
  if(operating.status!=='RECORDED_PLAN'||operating.budgetReconciliation?.status!=='MATCHED_ENTERED_BUDGET'||b?.periodStart!==start||b?.periodEndExclusive!==end)issues.push({code:'CASH_MATCHED_HORIZON_BUDGET_REQUIRED'});
  if(capital.status!=='SCHEDULED')issues.push({code:'CASH_CAPITAL_PLAN_REQUIRED'});
  if(issues.length)return {...empty,status:'NEEDS_REVIEW',issues};
  const safe=n=>{if(n>BigInt(Number.MAX_SAFE_INTEGER)||n< -BigInt(Number.MAX_SAFE_INTEGER))fail('CASH_AMOUNT_OUT_OF_RANGE');return Number(n);};
  try{
    let balance=BigInt(p.openingMinor);
    const rows=periods.map((period,i)=>{
      const receipts=p.entries.filter(e=>e.date>=period.periodStart&&e.date<period.periodEndExclusive).reduce((s,e)=>s+BigInt(e.amountMinor),0n);
      const operatingPaid=operating.rows[i].entries.reduce((s,e)=>s+BigInt(e.amountMinor),0n),capex=capital.rows[i].entries.reduce((s,e)=>s+BigInt(e.amountMinor),0n);
      const net=receipts-operatingPaid-capex,opening=balance;balance+=net;
      return {periodStart:period.periodStart,periodEndExclusive:period.periodEndExclusive,openingMinor:safe(opening),receiptsMinor:safe(receipts),operatingMinor:safe(operatingPaid),capexMinor:safe(capex),netMinor:safe(net),closingMinor:safe(balance)};
    });
    return {...empty,status:'PARTIAL_SCENARIO',rows,closingMinor:safe(balance),sourceRef:p.sourceRef,reviewRef:p.reviewRef,capitalOutsideHorizon:capital.outsideHorizon,
      semantics:'Entered receipt assumptions and documented opening balance less supplied operating and capital plans only. No accrual conversion or ledger carry-forward. Excludes unentered taxes, financing, deposits, fees and other flows. Month-end scenario, not intramonth liquidity, complete forecast, executed payments or verified bank balance.'};
  }catch(error){if(error.message!=='CASH_AMOUNT_OUT_OF_RANGE')throw error;return {...empty,status:'NEEDS_REVIEW',issues:[{code:error.message}]};}
}
function replaceCashScenario(c,draft){
  if(draft?.confirmed!==true)fail('EXPLICIT_VERIFICATION_CONFIRMATION_REQUIRED');
  if(!Array.isArray(draft.entries))fail('CASH_SCENARIO_INVALID');
  const cashScenario={schemaVersion:1,caseId:c.caseId,openingDate:draft.openingDate,openingMinor:openingAmount(draft.openingAmount),sourceRef:draft.sourceRef,reviewRef:draft.reviewRef,entries:draft.entries.map(e=>({...e,amountMinor:parseLedgerAmount(e.amount)}))};
  const {createResidentialIncomeOperatingCase}=require('./contracts');
  const candidate=createResidentialIncomeOperatingCase({...c,cashScenario});
  // Receipts can be saved before payment plans; blocked calculations remain visible.
  if(cashScenario.openingDate!==c.asOfDate.slice(0,10))fail('CASH_OPENING_DATE_MISMATCH');
  const d=new Date(c.asOfDate),end=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+12,1)).toISOString().slice(0,10);
  if(cashScenario.entries.some(e=>e.date<cashScenario.openingDate||e.date>=end))fail('CASH_RECEIPT_OUTSIDE_HORIZON');
  return candidate;
}
module.exports={validateCashScenario,calculateCashScenario,replaceCashScenario};
