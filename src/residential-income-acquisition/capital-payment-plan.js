'use strict';
const {parseLedgerAmount}=require('./receivables-ledger');
const fail=code=>{throw new TypeError(code);};
function validateCapitalPaymentPlan(plan,operatingCase) {
  if(!plan||plan.schemaVersion!==1||plan.caseId!==operatingCase.caseId||!Array.isArray(plan.entries))fail('CAPITAL_PLAN_INVALID');
  for(const key of ['sourceRef','reviewRef'])if(typeof plan[key]!=='string'||!plan[key].trim()||plan[key].length>500)fail('CAPITAL_PLAN_REFERENCE_REQUIRED');
  if(plan.sourceRef.trim()===plan.reviewRef.trim())fail('CAPITAL_PLAN_REFERENCE_REQUIRED');
  if(plan.entries.length>2000)fail('CAPITAL_PLAN_LIMIT_EXCEEDED');
  const ids=new Set(operatingCase.capexItems.map(x=>x.capexItemId)),seen=new Set();
  const entries=plan.entries.map(entry=>{
    if(!ids.has(entry.capexItemId))fail('CAPITAL_PLAN_ITEM_MISSING');
    if(typeof entry.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)||!Number.isFinite(Date.parse(entry.date))||new Date(entry.date).toISOString().slice(0,10)!==entry.date)fail('CAPITAL_PLAN_DATE_INVALID');
    if(!Number.isSafeInteger(entry.amountMinor)||entry.amountMinor<=0)fail('CAPITAL_PLAN_AMOUNT_INVALID');
    const key=JSON.stringify([entry.capexItemId,entry.date]);
    if(seen.has(key))fail('CAPITAL_PLAN_DUPLICATE_DATE');seen.add(key);
    return {capexItemId:entry.capexItemId,date:entry.date,amountMinor:entry.amountMinor};
  });
  return {schemaVersion:1,caseId:plan.caseId,sourceRef:plan.sourceRef.trim(),reviewRef:plan.reviewRef.trim(),entries};
}
function calculateCapitalPaymentPlan(operatingCase,periods) {
  const empty={status:'NOT_AVAILABLE',issues:[],rows:[],total:null,outsideHorizon:null,sourceRef:null,reviewRef:null};
  if(!operatingCase.capitalPaymentPlan)return empty;
  const plan=validateCapitalPaymentPlan(operatingCase.capitalPaymentPlan,operatingCase),issues=[];
  const refs=new Map(operatingCase.evidenceLineage.map(x=>[x.refId,x.kind]));
  const asOf=operatingCase.asOfDate.slice(0,10),sums=new Map();let totalMinor=0;
  for(const entry of plan.entries){
    sums.set(entry.capexItemId,(sums.get(entry.capexItemId)||0)+entry.amountMinor);totalMinor+=entry.amountMinor;
    if(entry.date<asOf)issues.push({code:'CAPITAL_PLAN_PAST_DATE',refId:entry.capexItemId});
  }
  if(!Number.isSafeInteger(totalMinor))issues.push({code:'CAPITAL_PLAN_AMOUNT_OUT_OF_RANGE'});
  for(const item of operatingCase.capexItems){
    const value=item.estimatedCost;
    if(!value||value.unit!=='SAR'||!['VERIFIED_FACT','ASSUMED'].includes(value.verificationStatus)||value.adoptedForUnderwriting!==true||typeof value.value!=='number'||!Number.isFinite(value.value)||value.value<0||!Number.isSafeInteger(Math.round(value.value*100))||Math.abs(value.value*100-Math.round(value.value*100))>1e-6||refs.get(value.adoptionDecisionRef)!=='UNDERWRITING_ADOPTION'||(value.verificationStatus==='VERIFIED_FACT'&&!['EVIDENCE_FACT','SOURCE_DOCUMENT'].includes(refs.get(value.sourceRef)))||!Number.isFinite(Date.parse(value.effectiveDate))||Date.parse(value.effectiveDate)>Date.parse(operatingCase.asOfDate))issues.push({code:'CAPITAL_PLAN_COST_UNQUALIFIED',refId:item.capexItemId});
    else if((sums.get(item.capexItemId)||0)!==Math.round(value.value*100))issues.push({code:'CAPITAL_PLAN_COST_MISMATCH',refId:item.capexItemId});
  }
  if(issues.length)return {...empty,status:'NOT_CALCULABLE',issues,sourceRef:plan.sourceRef,reviewRef:plan.reviewRef};
  let coveredMinor=0;
  const rows=periods.map(period=>{
    const entries=plan.entries.filter(e=>e.date>=period.periodStart&&e.date<period.periodEndExclusive);
    const amountMinor=entries.reduce((s,e)=>s+e.amountMinor,0);coveredMinor+=amountMinor;
    return {periodStart:period.periodStart,amount:amountMinor/100,entries};
  });
  return {status:'SCHEDULED',issues:[],rows,total:coveredMinor/100,outsideHorizon:(totalMinor-coveredMinor)/100,sourceRef:plan.sourceRef,reviewRef:plan.reviewRef,semantics:'Explicit planned CAPEX dates, not actual payments or required-by dates. Complete only for the supplied item inventory; an empty reviewed plan declares zero for that inventory. Cost assumptions remain assumptions.'};
}
function replaceCapitalPaymentPlan(operatingCase,draft) {
  if(draft?.confirmed!==true)fail('EXPLICIT_VERIFICATION_CONFIRMATION_REQUIRED');
  if(!Array.isArray(draft.entries))fail('CAPITAL_PLAN_INVALID');
  const plan={schemaVersion:1,caseId:operatingCase.caseId,sourceRef:draft.sourceRef,reviewRef:draft.reviewRef,entries:draft.entries.map(e=>({capexItemId:e.capexItemId,date:e.date,amountMinor:parseLedgerAmount(e.amount)}))};
  const {createResidentialIncomeOperatingCase}=require('./contracts');
  const candidate=createResidentialIncomeOperatingCase({...operatingCase,capitalPaymentPlan:plan});
  const result=calculateCapitalPaymentPlan(candidate,[]);
  if(result.status!=='SCHEDULED')fail(result.issues[0]?.code||'CAPITAL_PLAN_INVALID');
  return candidate;
}
module.exports={validateCapitalPaymentPlan,calculateCapitalPaymentPlan,replaceCapitalPaymentPlan};
