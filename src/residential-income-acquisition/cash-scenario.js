'use strict';
const {parseLedgerAmount}=require('./receivables-ledger');
const {normalizeNumericText}=require('../validation/numeric-text');
const {calculateOperatingPaymentPlan}=require('./operating-payment-plan');
const {calculateCapitalPaymentPlan}=require('./capital-payment-plan');
const {validateCashOtherFlows,cashOtherFlowCoverage}=require('./cash-other-flows');
const {defaultCashHorizonEnd,cashHorizonPeriods}=require('./cash-horizon');
const {validateInvestmentReturnContext,calculateEnteredInvestmentReturns}=require('./entered-investment-returns');
const fail=code=>{throw new TypeError(code);};
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
function formatCashMinor(value){
  if(!Number.isSafeInteger(value))fail('CASH_AMOUNT_INVALID');
  const n=BigInt(value),a=n<0n?-n:n;
  return `${n<0n?'-':''}${a/100n}.${String(a%100n).padStart(2,'0')}`;
}
function openingAmount(value){
  if(typeof value!=='string'&&typeof value!=='number')fail('CASH_OPENING_INVALID');
  const normalized=normalizeNumericText(value);if(!normalized.ok)fail('CASH_OPENING_INVALID');const s=normalized.normalized;
  if(/^-?0+(?:\.0{1,2})?$/.test(s))return 0;
  return s.startsWith('-')?-parseLedgerAmount(s.slice(1)):parseLedgerAmount(s);
}
function validateCashScenario(plan,c){
  if(!plan||plan.schemaVersion!==1||plan.caseId!==c.caseId||!Array.isArray(plan.entries)||plan.entries.length>2000)fail('CASH_SCENARIO_INVALID');
  for(const key of ['sourceRef','reviewRef'])if(typeof plan[key]!=='string'||!plan[key].trim()||plan[key].length>500)fail('CASH_REFERENCE_REQUIRED');
  if(plan.sourceRef.trim()===plan.reviewRef.trim())fail('CASH_REFERENCE_REQUIRED');
  if(!date(plan.openingDate)||!Number.isSafeInteger(plan.openingMinor))fail('CASH_OPENING_INVALID');
  const horizonEnd=plan.horizonEndExclusive ?? defaultCashHorizonEnd(plan.openingDate);
  if(plan.horizonEndExclusive!==undefined)cashHorizonPeriods(plan.openingDate,horizonEnd);
  const ids=new Set(c.leases.map(x=>x.leaseId)),seen=new Set();let total=0n;
  const entries=plan.entries.map(e=>{
    if(!ids.has(e.leaseId))fail('CASH_LEASE_REQUIRED');
    if(!date(e.date))fail('CASH_DATE_INVALID');
    if(!Number.isSafeInteger(e.amountMinor)||e.amountMinor<=0)fail('CASH_AMOUNT_INVALID');
    if(typeof e.reference!=='string'||!e.reference.trim()||e.reference.length>500||seen.has(e.reference.trim()))fail('CASH_UNIQUE_REFERENCE_REQUIRED');
    seen.add(e.reference.trim());total+=BigInt(e.amountMinor);if(total>BigInt(Number.MAX_SAFE_INTEGER))fail('CASH_AMOUNT_OUT_OF_RANGE');
    return {leaseId:e.leaseId,date:e.date,amountMinor:e.amountMinor,reference:e.reference.trim()};
  });
  return {schemaVersion:1,caseId:plan.caseId,openingDate:plan.openingDate,openingMinor:plan.openingMinor,sourceRef:plan.sourceRef.trim(),reviewRef:plan.reviewRef.trim(),entries,
    ...(plan.horizonEndExclusive===undefined?{}:{horizonEndExclusive:horizonEnd}),
    ...(plan.investmentReturnContext===undefined?{}:{investmentReturnContext:validateInvestmentReturnContext(plan.investmentReturnContext,plan.openingDate,horizonEnd)}),
    ...(plan.otherFlows===undefined?{}:{otherFlows:validateCashOtherFlows(plan.otherFlows,[...seen])})};
}
function calculateCashScenario(c,periods){
  const empty={status:'NOT_AVAILABLE',rows:[],closingMinor:null,issues:[],coverageComplete:false,actualBankBalance:false,liquidity:null};
  if(!c.cashScenario)return empty;
  const p=validateCashScenario(c.cashScenario,c),issues=[],otherEntries=p.otherFlows?.entries||[];
  empty.otherFlowCoverage=cashOtherFlowCoverage(p.otherFlows);
  if(p.horizonEndExclusive&&periods[0]?.periodStart===c.asOfDate.slice(0,10))periods=cashHorizonPeriods(p.openingDate,p.horizonEndExclusive);
  if(!periods.length)return {...empty,status:'NEEDS_REVIEW',issues:[{code:'CASH_HORIZON_REQUIRED'}]};
  const start=periods[0].periodStart,end=periods[periods.length-1].periodEndExclusive;
  if(start!==c.asOfDate.slice(0,10)||p.openingDate!==start)issues.push({code:'CASH_OPENING_DATE_MISMATCH'});
  for(let i=0;i<periods.length;i++)if(!date(periods[i].periodStart)||!date(periods[i].periodEndExclusive)||periods[i].periodStart>=periods[i].periodEndExclusive||(i&&periods[i-1].periodEndExclusive!==periods[i].periodStart))issues.push({code:'CASH_HORIZON_REQUIRED'});
  if(p.entries.some(e=>e.date<start||e.date>=end))issues.push({code:'CASH_RECEIPT_OUTSIDE_HORIZON'});
  if(otherEntries.some(e=>e.date<start||e.date>=end))issues.push({code:'CASH_OTHER_FLOW_OUTSIDE_HORIZON'});
  const operating=calculateOperatingPaymentPlan(c,periods),capital=calculateCapitalPaymentPlan(c,periods),b=c.operatingPaymentPlan?.budgetControl;
  if(operating.status!=='RECORDED_PLAN'||operating.budgetReconciliation?.status!=='MATCHED_ENTERED_BUDGET'||b?.periodStart!==start||b?.periodEndExclusive!==end)issues.push({code:'CASH_MATCHED_HORIZON_BUDGET_REQUIRED'});
  if(capital.status!=='SCHEDULED')issues.push({code:'CASH_CAPITAL_PLAN_REQUIRED'});
  if(issues.length)return {...empty,status:'NEEDS_REVIEW',issues,
    investmentReturns:calculateEnteredInvestmentReturns(c,p,p.openingDate,p.horizonEndExclusive??defaultCashHorizonEnd(p.openingDate),false,empty.otherFlowCoverage)};
  const safe=n=>{if(n>BigInt(Number.MAX_SAFE_INTEGER)||n< -BigInt(Number.MAX_SAFE_INTEGER))fail('CASH_AMOUNT_OUT_OF_RANGE');return Number(n);};
  try{
    let balance=BigInt(p.openingMinor);
    const rows=periods.map((period,i)=>{
      const receipts=p.entries.filter(e=>e.date>=period.periodStart&&e.date<period.periodEndExclusive).reduce((s,e)=>s+BigInt(e.amountMinor),0n);
      const operatingPaid=operating.rows[i].entries.reduce((s,e)=>s+BigInt(e.amountMinor),0n),capex=capital.rows[i].entries.reduce((s,e)=>s+BigInt(e.amountMinor),0n);
      const other=otherEntries.filter(e=>e.date>=period.periodStart&&e.date<period.periodEndExclusive);
      const sum=direction=>other.filter(e=>e.direction===direction).reduce((s,e)=>s+BigInt(e.amountMinor),0n);
      const otherInflows=sum('INFLOW'),otherOutflows=sum('OUTFLOW');
      const context=p.investmentReturnContext;
      const acquisition=context&&i===0?BigInt(context.acquisitionMinor):0n;
      const sale=context?.exitTreatment==='EXPLICIT_SALE'&&context.saleDate>=period.periodStart&&context.saleDate<period.periodEndExclusive?BigInt(context.netSaleMinor):0n;
      const net=receipts+otherInflows+sale-operatingPaid-capex-otherOutflows-acquisition,opening=balance;balance+=net;
      return {periodStart:period.periodStart,periodEndExclusive:period.periodEndExclusive,openingMinor:safe(opening),receiptsMinor:safe(receipts),operatingMinor:safe(operatingPaid),capexMinor:safe(capex),otherInflowsMinor:safe(otherInflows),otherOutflowsMinor:safe(otherOutflows),...(context?{acquisitionMinor:safe(acquisition),assetSaleMinor:safe(sale)}:{}),netMinor:safe(net),closingMinor:safe(balance)};
    });
    // Dates do not establish intraday settlement order. Debit-first is a
    // conservative bound for the supplied flows, not observed bank liquidity.
    const daily=new Map();
    const add=(entry,key)=>{
      const day=daily.get(entry.date)||{date:entry.date,receipts:0n,payments:0n};
      day[key]+=BigInt(entry.amountMinor);daily.set(entry.date,day);
    };
    p.entries.forEach(e=>add(e,'receipts'));
    otherEntries.forEach(e=>add(e,e.direction==='INFLOW'?'receipts':'payments'));
    [...operating.rows,...capital.rows].forEach(row=>row.entries.forEach(e=>add(e,'payments')));
    if(p.investmentReturnContext){
      add({date:start,amountMinor:p.investmentReturnContext.acquisitionMinor},'payments');
      if(p.investmentReturnContext.exitTreatment==='EXPLICIT_SALE')add({date:p.investmentReturnContext.saleDate,amountMinor:p.investmentReturnContext.netSaleMinor},'receipts');
    }
    let current=BigInt(p.openingMinor),minimum=current,minimumDate=start;
    let firstShortfallDate=current<0n?start:null;
    const dailyRows=[...daily.values()].sort((a,b)=>a.date.localeCompare(b.date)).map(day=>{
      const opening=current,afterPayments=current-day.payments;
      if(afterPayments<minimum){minimum=afterPayments;minimumDate=day.date;}
      if(firstShortfallDate===null&&afterPayments<0n)firstShortfallDate=day.date;
      current=afterPayments+day.receipts;
      return {date:day.date,openingMinor:safe(opening),paymentsMinor:safe(day.payments),
        receiptsMinor:safe(day.receipts),beforeReceiptsMinor:safe(afterPayments),closingMinor:safe(current)};
    });
    const liquidity={status:'CONSERVATIVE_ENTERED_FLOWS',sameDayOrder:'PAYMENTS_BEFORE_RECEIPTS',
      rows:dailyRows,minimumMinor:safe(minimum),minimumDate,firstShortfallDate,
      additionalOpeningRequiredMinor:safe(minimum<0n?-minimum:0n),coverageComplete:false,actualBankBalance:false};
    return {...empty,status:'PARTIAL_SCENARIO',rows,liquidity,closingMinor:safe(balance),sourceRef:p.sourceRef,reviewRef:p.reviewRef,capitalOutsideHorizon:capital.outsideHorizon,
      periodStart:start,periodEndExclusive:end,
      investmentReturns:calculateEnteredInvestmentReturns(c,p,start,end,true,empty.otherFlowCoverage),
      semantics:'Entered opening balance, rent receipts, additional flows and explicit asset acquisition/net sale if supplied, less operating/capital plans. No accrual conversion, automatic tax calculation or ledger carry-forward. Unentered flows are excluded. Category review does not independently verify completeness. Scenario and conservative dated check, not executed payments, available funding or verified bank balance.'};
  }catch(error){if(error.message!=='CASH_AMOUNT_OUT_OF_RANGE')throw error;return {...empty,status:'NEEDS_REVIEW',issues:[{code:error.message}]};}
}
function replaceCashScenario(c,draft){
  if(draft?.confirmed!==true)fail('EXPLICIT_VERIFICATION_CONFIRMATION_REQUIRED');
  if(!Array.isArray(draft.entries))fail('CASH_SCENARIO_INVALID');
  const cashScenario={schemaVersion:1,caseId:c.caseId,openingDate:draft.openingDate,openingMinor:openingAmount(draft.openingAmount),sourceRef:draft.sourceRef,reviewRef:draft.reviewRef,entries:draft.entries.map(e=>({...e,amountMinor:parseLedgerAmount(e.amount)}))};
  if(draft.horizonEndExclusive!==undefined)cashScenario.horizonEndExclusive=draft.horizonEndExclusive;
  if(draft.investmentReturnContext!==undefined)cashScenario.investmentReturnContext=draft.investmentReturnContext;
  if(draft.otherFlows!==undefined){
    if(!draft.otherFlows||!Array.isArray(draft.otherFlows.entries))fail('CASH_OTHER_FLOWS_INVALID');
    cashScenario.otherFlows={...draft.otherFlows,entries:draft.otherFlows.entries.map(e=>({...e,amountMinor:parseLedgerAmount(e.amount)}))};
  }
  const {createResidentialIncomeOperatingCase}=require('./contracts');
  const candidate=createResidentialIncomeOperatingCase({...c,cashScenario});
  // Receipts can be saved before payment plans; blocked calculations remain visible.
  if(cashScenario.openingDate!==c.asOfDate.slice(0,10))fail('CASH_OPENING_DATE_MISMATCH');
  const end=cashScenario.horizonEndExclusive ?? defaultCashHorizonEnd(cashScenario.openingDate);
  if(cashScenario.entries.some(e=>e.date<cashScenario.openingDate||e.date>=end))fail('CASH_RECEIPT_OUTSIDE_HORIZON');
  if(cashScenario.otherFlows?.entries.some(e=>e.date<cashScenario.openingDate||e.date>=end))fail('CASH_OTHER_FLOW_OUTSIDE_HORIZON');
  return candidate;
}
module.exports={validateCashScenario,calculateCashScenario,replaceCashScenario,formatCashMinor};
