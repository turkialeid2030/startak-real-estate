'use strict';
const assert=require('node:assert/strict');
const {operatingCase,verified}=require('../fixtures/synthetic-collections-case');
const {createResidentialIncomeOperatingCase,createOperatingExpense}=require('../../src/residential-income-acquisition/contracts');
const {replaceOperatingPaymentPlan}=require('../../src/residential-income-acquisition/operating-payment-plan');
const {replaceCapitalPaymentPlan}=require('../../src/residential-income-acquisition/capital-payment-plan');
const {replaceCashScenario,calculateCashScenario,formatCashMinor}=require('../../src/residential-income-acquisition/cash-scenario');
const {CASH_OTHER_FLOW_CATEGORIES:CATEGORIES}=require('../../src/residential-income-acquisition/cash-other-flows');
const {calculateContractRunoff}=require('../../src/residential-income-acquisition/contract-runoff');
const {updateVerifiedLeaseTerms}=require('../../src/residential-income-acquisition/operating-case-editor');
const {buildResidentialIncomeOperatingCaseEnvelope,parseResidentialIncomeOperatingCaseEnvelope}=require('../../src/residential-income-acquisition/operating-case-snapshot');
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;},reject=(fn,code)=>{assert.throws(fn,new RegExp(code));checks++;};
const base=operatingCase({collections:[]});
let c=createResidentialIncomeOperatingCase({...base,capexItems:[],operatingExpenses:[createOperatingExpense({caseId:base.caseId,expenseId:'B',propertyId:'PROPERTY-1',category:'MAINTENANCE',basis:'BUDGET',annualAmount:verified('b',12000,'SAR/year','evidence://lease/rent')})]});
c=replaceCapitalPaymentPlan(c,{sourceRef:'capital',reviewRef:'capital-review',confirmed:true,entries:[]});
c=replaceOperatingPaymentPlan(c,{sourceRef:'budget',reviewRef:'budget-review',confirmed:true,entries:[{expenseId:'B',date:'2026-09-30',amount:'150'}],budgetControl:{periodStart:'2026-09-01',periodEndExclusive:'2027-09-01',items:[{expenseId:'B',amount:'150'}]}});
const reviews=(statuses={})=>CATEGORIES.map(category=>({category,status:statuses[category]||'NOT_REVIEWED'}));
const flow={category:'FINANCING',direction:'INFLOW',date:'2026-09-29',amount:'200',reference:'draw-1',sourceRef:'source://draw',description:'Synthetic drawdown'};
const draft={openingDate:'2026-09-01',openingAmount:'0',sourceRef:'source://opening',reviewRef:'review://cash',confirmed:true,entries:[{leaseId:'LEASE-1',date:'2026-10-01',amount:'100',reference:'rent-1'}],otherFlows:{schemaVersion:1,entries:[flow,{...flow,category:'DEPOSIT',amount:'30',reference:'deposit-in'},{...flow,category:'DEPOSIT',direction:'OUTFLOW',date:'2026-10-02',amount:'30',reference:'deposit-out'},{...flow,category:'TAX',direction:'OUTFLOW',date:'2026-09-30',amount:'20.01',reference:'tax'}],categoryReviews:reviews({FINANCING:'ENTERED',TAX:'ENTERED',DEPOSIT:'ENTERED',FEES:'NONE_EXPECTED',OTHER:'NONE_EXPECTED'})}};
const saved=replaceCashScenario(c,draft),baseline=calculateContractRunoff(c),r=calculateContractRunoff(saved),p=r.cashScenario;
eq(p.status,'PARTIAL_SCENARIO');eq(p.coverageComplete,false);eq(p.actualBankBalance,false);
eq(p.rows[0].otherInflowsMinor,23000);eq(p.rows[0].otherOutflowsMinor,2001);eq(p.rows[0].closingMinor,5999);eq(p.rows[1].closingMinor,12999);eq(p.closingMinor,12999);
eq(p.liquidity.firstShortfallDate,null);eq(p.liquidity.minimumMinor,0);eq(p.liquidity.rows.at(-1).closingMinor,p.closingMinor);
eq(p.otherFlowCoverage.status,'REVIEW_DECLARED');eq(p.otherFlowCoverage.reviewedCategoryCount,5);eq(p.otherFlowCoverage.coverageComplete,false);
eq(p.otherFlowCoverage.categories.find(x=>x.category==='DEPOSIT'),{category:'DEPOSIT',reviewStatus:'ENTERED',entryCount:2,inflowsMinor:3000,outflowsMinor:3000});
eq(r.rows,baseline.rows);eq(r.totals,baseline.totals);eq(saved.receivablesLedger,c.receivablesLedger);eq(saved.rentCollections,c.rentCollections);
eq(parseResidentialIncomeOperatingCaseEnvelope(JSON.stringify(buildResidentialIncomeOperatingCaseEnvelope(saved))),saved);
eq(calculateContractRunoff(parseResidentialIncomeOperatingCaseEnvelope(JSON.stringify(buildResidentialIncomeOperatingCaseEnvelope(saved)))).cashScenario,p);
eq(updateVerifiedLeaseTerms(saved,{leaseId:'LEASE-1',endDate:'2027-02-01',baseRent:'1200000',sourceRef:'evidence://new',adoptionDecisionRef:'review://new',confirmed:true}).cashScenario,saved.cashScenario);
const withOther=(entries,categoryReviews=reviews())=>({...draft,otherFlows:{schemaVersion:1,entries,categoryReviews}});
const result=d=>calculateContractRunoff(replaceCashScenario(c,d)).cashScenario;
// Legacy snapshots and untouched categories remain unreviewed, never certified zero.
const legacy={...draft};delete legacy.otherFlows;
const legacyCase=replaceCashScenario(c,legacy);eq(legacyCase.cashScenario.otherFlows,undefined);eq(result(legacy).otherFlowCoverage.status,'REVIEW_INCOMPLETE');eq(result(legacy).otherFlowCoverage.reviewedCategoryCount,0);
const absent=result(withOther([]));eq(absent.otherFlowCoverage.categories.every(x=>x.reviewStatus==='NOT_REVIEWED'),true);
const none=result(withOther([],reviews(Object.fromEntries(CATEGORIES.map(k=>[k,'NONE_EXPECTED'])))));eq(none.otherFlowCoverage.status,'REVIEW_DECLARED');eq(none.coverageComplete,false);eq(none.closingMinor,absent.closingMinor);
eq(result(withOther([flow])).otherFlowCoverage.status,'REVIEW_INCOMPLETE');
// Every category accepts both explicit directions without changing rental NOI.
for(const category of CATEGORIES)for(const direction of ['INFLOW','OUTFLOW']){
  const x=result(withOther([{...flow,category,direction}]));
  eq(x.closingMinor,direction==='INFLOW'?15000:-25000);
  eq(x.otherFlowCoverage.categories.find(x=>x.category===category)[direction==='INFLOW'?'inflowsMinor':'outflowsMinor'],20000);
}
// Same-day funding cannot erase the conservative pre-receipt gap.
const late=result(withOther([{...flow,date:'2026-09-30'}]));eq(late.rows[0].closingMinor,5000);eq(late.liquidity.minimumMinor,-15000);eq(late.liquidity.firstShortfallDate,'2026-09-30');eq(late.liquidity.additionalOpeningRequiredMinor,15000);
eq(result({...draft,otherFlows:{...draft.otherFlows,entries:[...draft.otherFlows.entries].reverse()}}).liquidity,p.liquidity);
for(const otherFlows of [null,[],{}, {...draft.otherFlows,schemaVersion:2},{...draft.otherFlows,entries:Array(2001).fill(flow)}])reject(()=>replaceCashScenario(c,{...draft,otherFlows}),'CASH_OTHER_FLOWS_INVALID');
for(const category of ['',null,'UNKNOWN'])reject(()=>replaceCashScenario(c,withOther([{...flow,category}])),'CASH_OTHER_FLOW_CLASSIFICATION_REQUIRED');
for(const direction of ['inflow',null,'CREDIT'])reject(()=>replaceCashScenario(c,withOther([{...flow,direction}])),'CASH_OTHER_FLOW_CLASSIFICATION_REQUIRED');
for(const date of ['2026-02-30','2026-09-29T00:00:00Z',''])reject(()=>replaceCashScenario(c,withOther([{...flow,date}])),'CASH_DATE_INVALID');
for(const date of ['2026-08-31','2027-09-01'])reject(()=>replaceCashScenario(c,withOther([{...flow,date}])),'CASH_OTHER_FLOW_OUTSIDE_HORIZON');
for(const amount of ['',null,'0','-1','1.005','90071992547410'])reject(()=>replaceCashScenario(c,withOther([{...flow,amount}])),'LEDGER_AMOUNT_INVALID');
for(const key of ['description','sourceRef'])for(const v of ['',null,'x'.repeat(501)])reject(()=>replaceCashScenario(c,withOther([{...flow,[key]:v}])),'CASH_OTHER_FLOW_SOURCE_REQUIRED');
for(const reference of ['',null,'x'.repeat(501),' rent-1 '])reject(()=>replaceCashScenario(c,withOther([{...flow,reference}])),'CASH_UNIQUE_REFERENCE_REQUIRED');
reject(()=>replaceCashScenario(c,withOther([flow,{...flow,reference:' draw-1 '}])),'CASH_UNIQUE_REFERENCE_REQUIRED');
for(const categoryReviews of [[],reviews().slice(1),[...reviews(),reviews()[0]],reviews().map(x=>({...x,category:'FINANCING'})),reviews().map(x=>({...x,status:'VERIFIED'}))])reject(()=>replaceCashScenario(c,withOther([flow],categoryReviews)),'CASH_OTHER_FLOWS_INVALID|CASH_CATEGORY_REVIEW_INVALID');
reject(()=>replaceCashScenario(c,withOther([],reviews({FINANCING:'ENTERED'}))),'CASH_CATEGORY_REVIEW_CONFLICT');
reject(()=>replaceCashScenario(c,withOther([flow],reviews({FINANCING:'NONE_EXPECTED'}))),'CASH_CATEGORY_REVIEW_CONFLICT');
const arabic=replaceCashScenario(c,withOther([{...flow,amount:'٢٠٠٫٠١'}]));eq(arabic.cashScenario.otherFlows.entries[0].amountMinor,20001);
// Imported data is revalidated; invalid or outside-horizon rows cannot evade save checks.
let bad=JSON.parse(JSON.stringify(saved));bad.cashScenario.otherFlows.entries[0].amountMinor=0.01;reject(()=>createResidentialIncomeOperatingCase(bad),'CASH_AMOUNT_INVALID');
bad=JSON.parse(JSON.stringify(saved));bad.cashScenario.otherFlows.entries[0].date='2027-09-01';const outside=calculateContractRunoff(createResidentialIncomeOperatingCase(bad)).cashScenario;eq(outside.status,'NEEDS_REVIEW');eq(outside.rows,[]);eq(outside.closingMinor,null);eq(outside.liquidity,null);
const huge={...flow,amount:formatCashMinor(Number.MAX_SAFE_INTEGER)};
reject(()=>replaceCashScenario(c,withOther([huge,{...flow,reference:'overflow'}])),'CASH_AMOUNT_OUT_OF_RANGE');
const overflow=result({...withOther([huge]),openingAmount:formatCashMinor(Number.MAX_SAFE_INTEGER)});eq(overflow.status,'NEEDS_REVIEW');eq(overflow.rows,[]);eq(overflow.liquidity,null);
// A safe closing balance cannot mask an unsafe pre-receipt intermediate balance.
const unsafe=result({...withOther([{...flow,direction:'OUTFLOW',date:'2026-10-01',amount:'100'}]),openingAmount:formatCashMinor(-Number.MAX_SAFE_INTEGER),entries:[{...draft.entries[0],amount:'250'}]});eq(unsafe.status,'NEEDS_REVIEW');eq(unsafe.closingMinor,null);
eq(calculateCashScenario(saved,[]).otherFlowCoverage.status,'REVIEW_DECLARED');
console.log(`AUDIT_CASH_OTHER_FLOWS=PASS checks=${checks}`);
