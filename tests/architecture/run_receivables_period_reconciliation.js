'use strict';
const assert=require('node:assert/strict');
const {operatingCase}=require('../fixtures/synthetic-collections-case');
const {appendReceivablesEvent,calculateReceivablesLedger}=require('../../src/residential-income-acquisition/receivables-ledger');
const {calculateReceivablesPeriodReconciliation:calculate}=require('../../src/residential-income-acquisition/receivables-period-reconciliation');
const {replaceBankRentStatement,calculateBankRentReconciliation}=require('../../src/residential-income-acquisition/bank-rent-reconciliation');
const {createResidentialIncomeOperatingCase}=require('../../src/residential-income-acquisition/contracts');
const {buildResidentialIncomeOperatingCaseEnvelope,parseResidentialIncomeOperatingCaseEnvelope}=require('../../src/residential-income-acquisition/operating-case-snapshot');
const {buildPersonalFinancialStudy,verifyPersonalFinancialStudy,htmlFinancialStudy}=require('../../src/app/personal-financial-study');
const {receivablesPeriodHtml}=require('../../src/app/receivables-period-presentation');
let checks=0;
const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
const ok=(v,message)=>{assert.ok(v,message);checks++;};
const add=(c,draft)=>appendReceivablesEvent(c,{leaseId:'LEASE-1',sourceRef:'source://'+draft.id,reviewRef:'review://'+draft.id,confirmed:true,...draft});
const charge=(id,date,amount,periodStart,periodEndExclusive)=>({id,date,type:'CHARGE',amount,reference:'invoice-'+id,periodStart,periodEndExclusive,dueDate:date});
let c=operatingCase({collections:[]});
eq(calculate(c).openingMinor,null);
eq(calculate(c).blockers,['LEDGER_PERIOD_REQUIRED']);
const period={periodStart:'2026-08-01',periodEndExclusive:'2026-08-15'};
eq(calculate(c,period).status,'NOT_AVAILABLE');
eq(calculate(c,period).closingMinor,null);
for(const patch of [{periodStart:'2026-02-30'},{periodStart:period.periodEndExclusive},{periodEndExclusive:'2026-09-03'},{periodEndExclusive:'2026-08-15T00:00:00Z'}])eq(calculate(c,{...period,...patch}).status,'NEEDS_REVIEW');
c=add(c,charge('C0','2026-07-01','100.00','2026-07-01','2026-08-01'));
c=add(c,{id:'R0',date:'2026-07-01',type:'RECEIPT',reference:'receipt-R0',amount:'150.00'});
c=add(c,{id:'A0',date:'2026-07-02',type:'ALLOCATION',chargeId:'C0',receiptId:'R0',amount:'60.00'});
c=add(c,charge('C1','2026-08-01','80.00','2026-08-01','2026-09-01'));
c=add(c,{id:'K',date:'2026-08-02',type:'CREDIT',chargeId:'C0',amount:'10.00',reference:'credit-K',reason:'Documented credit'});
c=add(c,{id:'R1',date:'2026-08-03',type:'RECEIPT',amount:'50.00',reference:'receipt-R1'});
c=add(c,{id:'A1',date:'2026-08-04',type:'ALLOCATION',chargeId:'C0',receiptId:'R0',amount:'20.00'});
c=add(c,{id:'F',date:'2026-08-05',type:'REFUND',receiptId:'R0',amount:'25.00',reference:'refund-F',reason:'Entered refund'});
c=add(c,{id:'XA0',date:'2026-08-06',type:'REVERSAL',targetId:'A0',reason:'Allocation correction'});
c=add(c,{id:'XK',date:'2026-08-07',type:'REVERSAL',targetId:'K',reason:'Credit correction'});
c=add(c,{id:'XA1',date:'2026-08-08',type:'REVERSAL',targetId:'A1',reason:'Allocation correction'});
c=add(c,{id:'XC0',date:'2026-08-09',type:'REVERSAL',targetId:'C0',reason:'Document correction, no cash movement'});
c=add(c,{id:'XR1',date:'2026-08-20',type:'REVERSAL',targetId:'R1',reason:'Later document correction'});
const before=JSON.stringify(c),bridge=calculate(c,period);
eq(bridge.status,'ARITHMETIC_BRIDGE_COMPLETE');
// Independently worked journal: opening unpaid=100-60=40, unallocated=150-60=90.
// The old charge and both allocations are corrected. At the exclusive cutoff,
// only new charge 80 remains; entered receipts 150+50 less refund 25 = 175.
eq(bridge.openingMinor,{outstandingMinor:4000,unallocatedMinor:9000});
eq(bridge.closingMinor,{outstandingMinor:8000,unallocatedMinor:17500});
eq(bridge.rows.map(r=>[r.code,r.outstandingMinor,r.unallocatedMinor]),[
 ['OPENING',4000,9000],['CHARGE',8000,0],['CREDIT',-1000,0],['RECEIPT',0,5000],
 ['REFUND',0,-2500],['ALLOCATION',-2000,-2000],['REVERSAL',-1000,8000],['CLOSING',8000,17500],['RESIDUAL',0,0],
]);
eq(bridge.eventRows.map(e=>e.id),['C1','K','R1','A1','F','XA0','XK','XA1','XC0']);
eq(bridge.postPeriodCorrections.map(e=>[e.id,e.targetId,e.reversedType,e.unallocatedMinor]),[['XR1','R1','RECEIPT',-5000]]);
eq(calculateReceivablesLedger(c).totalsMinor.unallocated,12500);
eq(bridge.byLease,[{leaseId:'LEASE-1',openingMinor:bridge.openingMinor,closingMinor:bridge.closingMinor}]);
for(const e of [...bridge.eventRows,...bridge.postPeriodCorrections]){
 eq(e.sourceRef,'source://'+e.id);eq(e.reviewRef,'review://'+e.id);eq(e.leaseId,'LEASE-1');
}
for(const flag of ['coverageComplete','sourceIndependentlyVerified','actualBankBalance','aggregateEngineUpdated','transactionAuthorized'])eq(bridge[flag],false);
eq(JSON.stringify(c),before);
// Start is inclusive and end is exclusive, including reversals exactly at end.
eq(calculate(c,{periodStart:'2026-08-20',periodEndExclusive:'2026-08-21'}).rows.find(r=>r.code==='REVERSAL').unallocatedMinor,-5000);
eq(calculate(c,{periodStart:'2026-08-19',periodEndExclusive:'2026-08-20'}).postPeriodCorrections.map(e=>e.id),['XR1']);
eq(calculate(c,{periodStart:'2026-08-21',periodEndExclusive:'2026-09-02'}).closingMinor,{outstandingMinor:8000,unallocatedMinor:12500});
eq(calculate(c,{periodStart:'2026-01-01',periodEndExclusive:'2026-02-01'}).openingMinor,{outstandingMinor:0,unallocatedMinor:0});
// Opposing balances on two leases remain separate instead of cancelling out.
let multi=createResidentialIncomeOperatingCase({...c,
 units:[...c.units,{...c.units[0],unitId:'UNIT-2',leaseIds:['LEASE-2']}],
 buildings:[{...c.buildings[0],unitIds:['UNIT-1','UNIT-2']}],
 leases:[...c.leases,{...c.leases[0],leaseId:'LEASE-2',unitId:'UNIT-2'}]});
multi=add(multi,{...charge('C2','2026-08-01','25.00','2026-08-01','2026-09-01'),leaseId:'LEASE-2'});
multi=add(multi,{id:'R2',date:'2026-08-01',type:'RECEIPT',amount:'5.00',reference:'receipt-R2',leaseId:'LEASE-2'});
eq(calculate(multi,period).byLease.map(r=>[r.leaseId,r.closingMinor]),[
 ['LEASE-1',{outstandingMinor:8000,unallocatedMinor:17500}],['LEASE-2',{outstandingMinor:2500,unallocatedMinor:500}],
]);
// A correction must not predate the last dependent allocation/reversal. Such
// a graph used to replay today yet fail when reconstructed at an earlier cutoff.
let chronology=operatingCase({collections:[]});
chronology=add(chronology,charge('C','2026-08-01','10','2026-08-01','2026-09-01'));
chronology=add(chronology,{id:'R',date:'2026-08-01',type:'RECEIPT',amount:'10',reference:'receipt-R'});
chronology=add(chronology,{id:'A',date:'2026-08-05',type:'ALLOCATION',chargeId:'C',receiptId:'R',amount:'10'});
chronology=add(chronology,{id:'XA',date:'2026-08-07',type:'REVERSAL',targetId:'A',reason:'Correction'});
for(const targetId of ['C','R']){
 assert.throws(()=>add(chronology,{id:'X'+targetId,date:'2026-08-06',type:'REVERSAL',targetId,reason:'Backdated correction'}),/LEDGER_EVENT_CHRONOLOGY/);checks++;
 eq(add(chronology,{id:'X'+targetId,date:'2026-08-07',type:'REVERSAL',targetId,reason:'Same-day correction'}).receivablesLedger.events.length,5);
}
assert.throws(()=>add(chronology,{id:'A2',type:'ALLOCATION',date:'2026-08-06',chargeId:'C',receiptId:'R',amount:'7'}),/LEDGER_EVENT_CHRONOLOGY/);checks++;
let ordered=add(chronology,{id:'A2',type:'ALLOCATION',date:'2026-08-08',chargeId:'C',receiptId:'R',amount:'7'});
assert.throws(()=>add(ordered,{id:'XA2',type:'REVERSAL',date:'2026-08-07',targetId:'A2',reason:'Backdated reversal'}),/LEDGER_EVENT_CHRONOLOGY/);checks++;
ordered=add(ordered,{id:'XA2',type:'REVERSAL',date:'2026-08-09',targetId:'A2',reason:'Correction'});
// Every date prefix of the accepted linked sequence remains replayable.
for(let day=2;day<=10;day++)eq(calculate(ordered,{periodStart:'2026-08-01',periodEndExclusive:`2026-08-${String(day).padStart(2,'0')}`}).status,'ARITHMETIC_BRIDGE_COMPLETE');
const max=Number.MAX_SAFE_INTEGER;
const huge={...c,receivablesLedger:{schemaVersion:1,caseId:c.caseId,events:[
 {id:'H1',caseId:c.caseId,type:'RECEIPT',date:'2026-08-01',amountMinor:max,leaseId:'LEASE-1',reference:'huge1',sourceRef:'s',reviewRef:'r'},
 {id:'H2',caseId:c.caseId,type:'RECEIPT',date:'2026-08-02',amountMinor:1,leaseId:'LEASE-1',reference:'huge2',sourceRef:'s',reviewRef:'r'},
]}};
eq(calculate(huge,period).status,'NEEDS_REVIEW');eq(calculate(huge,period).rows,[]);eq(calculate(huge,period).closingMinor,null);
eq(calculate({...c,receivablesLedger:{...c.receivablesLedger,caseId:'OTHER'}},period).status,'NEEDS_REVIEW');
const saved=replaceBankRentStatement(c,{...period,accountRef:'Synthetic account',sourceRef:'Synthetic statement',reviewRef:'Synthetic review',confirmed:true,entries:[
 {id:'BC',date:'2026-08-03',direction:'CREDIT',amount:'50',reference:'bank-credit',ledgerEventId:'R1'},
 {id:'BD',date:'2026-08-05',direction:'DEBIT',amount:'25',reference:'bank-debit',ledgerEventId:'F'},
]});
eq(calculateBankRentReconciliation(saved).status,'NEEDS_REVIEW'); // current correction is not hidden
eq(calculateBankRentReconciliation(saved).ledgerPeriodReconciliation,bridge);
const restored=parseResidentialIncomeOperatingCaseEnvelope(JSON.stringify(buildResidentialIncomeOperatingCaseEnvelope(saved)));
eq(calculateBankRentReconciliation(restored),calculateBankRentReconciliation(saved));
const context={mode:'building',inputs:require('../reference/RE-GOLD-baseline.json')['RE-GOLD-002_existing_building'].inputs,assumptionModelVersion:'LEGACY'};
const report=buildPersonalFinancialStudy({...context,operatingCase:saved});
eq(report.operatingReport.bankRentReconciliation,calculateBankRentReconciliation(saved));
eq(report.financial.results,buildPersonalFinancialStudy(context).financial.results);
eq(verifyPersonalFinancialStudy(report),true);
const tampered=JSON.parse(JSON.stringify(report));tampered.operatingReport.bankRentReconciliation.ledgerPeriodReconciliation.closingMinor.unallocatedMinor--;
eq(verifyPersonalFinancialStudy(tampered),false);
for(const locale of ['ar-SA','en']){
 const html=htmlFinancialStudy(report,{locale});
 ok(html.includes(locale==='en'?'Receivables and receipts over the statement period':'تسوية المستحقات والمقبوضات خلال فترة الكشف'));
 ok(html.includes('175.00')&&html.includes('XR1')&&html.includes('review://XR1'));
 ok(html.includes(locale==='en'?'Later corrections':'تصحيحات لاحقة'));
 const injected={...bridge,eventRows:[{...bridge.eventRows[0],sourceRef:'<img src=x onerror=bad()>'}]};
 ok(!receivablesPeriodHtml(injected,locale).includes('<img'));
 ok(receivablesPeriodHtml(injected,locale).includes('&lt;img'));
}
console.log(`RECEIVABLES_PERIOD_RECONCILIATION=PASS checks=${checks}`);
