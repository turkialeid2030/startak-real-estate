'use strict';
const assert=require('node:assert/strict');
const {operatingCase,verified}=require('../fixtures/synthetic-collections-case');
const {calculateContractRunoff}=require('../../src/residential-income-acquisition/contract-runoff');
const {createOperatingExpense,hydrateResidentialIncomeOperatingCaseSnapshot,createResidentialIncomeAcquisitionViewModel}=require('../../src/residential-income-acquisition');
let checks=0;
const equal=(a,b)=>{assert.deepEqual(a,b);checks++;};
const near=(a,b)=>{assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);checks++;};
const copy=()=>JSON.parse(JSON.stringify(operatingCase()));
const cost=(value=12000,basis='NORMALIZED')=>createOperatingExpense({caseId:'CASE-COLLECTIONS-1',expenseId:'EXP-1',propertyId:'PROPERTY-1',category:'MAINTENANCE',basis,annualAmount:verified('opex.maintenance',value,'SAR/year','evidence://lease/rent')});
const base=copy();base.operatingExpenses=[cost()];
const result=calculateContractRunoff(hydrateResidentialIncomeOperatingCaseSnapshot(base));
equal(result.status,'ILLUSTRATIVE_RUNOFF');equal(result.rows.length,12);near(result.totals.contractRent,400000);near(result.totals.normalizedOpex,12000);near(result.totals.contractNetBeforeCapex,388000);
equal(result.rows[4].contractRent,0);equal(result.rows[4].contractNetBeforeCapex,-1000);
equal(result.historicalCollections.totals.rentCollected,90000);equal(result.collectionForecast,null);equal(result.capexCashflow,null);equal(result.financialEngineUpdated,false);
equal(createResidentialIncomeAcquisitionViewModel(hydrateResidentialIncomeOperatingCaseSnapshot(base)).contractRunoff,result);
for(const basis of ['ACTUAL','BUDGET','BENCHMARK']){const c=copy();c.operatingExpenses=[cost(12000,basis)];const r=calculateContractRunoff(c);equal(r.status,'RENT_ONLY');equal(r.totals.normalizedOpex,null);equal(r.totals.contractNetBeforeCapex,null);}
const zero=copy();zero.operatingExpenses=[cost(0)];equal(calculateContractRunoff(zero).totals.contractNetBeforeCapex,400000);
for(const key of ['value','sourceRef','effectiveDate','adoptionDecisionRef']){const c=copy();c.operatingExpenses=[JSON.parse(JSON.stringify(cost()))];c.operatingExpenses[0].annualAmount[key]=null;equal(calculateContractRunoff(c).totals.contractNetBeforeCapex,null);}
for(const date of ['2026-09-02','2026-02-30','bad']){const c=copy();c.operatingExpenses=[JSON.parse(JSON.stringify(cost()))];c.operatingExpenses[0].annualAmount.effectiveDate=date;equal(calculateContractRunoff(c).totals.contractNetBeforeCapex,null);}
const partial=copy();partial.asOfDate='2026-09-16';partial.operatingExpenses=[cost()];const p=calculateContractRunoff(partial);near(p.rows[0].contractRent,50000);near(p.rows[0].normalizedOpex,500);near(p.totals.contractRent,350000);near(p.totals.normalizedOpex,11500);
for(const [frequency,value,unit] of [['MONTHLY',100000,'SAR/month'],['QUARTERLY',300000,'SAR/quarter'],['SEMI_ANNUAL',600000,'SAR/half-year'],['ANNUAL',1200000,'SAR/year']]){const c=copy();c.leases[0].rentFrequency=frequency;c.leases[0].baseRent.value=value;c.leases[0].baseRent.unit=unit;near(calculateContractRunoff(c).totals.contractRent,400000);}
const future=copy();const second=JSON.parse(JSON.stringify(future.leases[0]));second.leaseId='LEASE-2';second.lifecycleStatus='FUTURE';second.startDate='2027-01-01';second.endDate='2028-01-01';future.leases.push(second);future.units[0].leaseIds.push('LEASE-2');near(calculateContractRunoff(hydrateResidentialIncomeOperatingCaseSnapshot(future)).totals.contractRent,1200000);
future.leases[1].startDate='2026-12-01';equal(calculateContractRunoff(future).status,'NOT_CALCULABLE');equal(calculateContractRunoff(future).totals,null);
for(const mutate of [c=>{c.leases[0].baseRent.effectiveDate='2026-09-02';},c=>{c.leases[0].termsEvidenceRef=null;},c=>{c.leases[0].baseRent.sourceRef=null;},c=>{c.propertyInterest.interestType='LEASEHOLD';},c=>{c.asOfDate='bad';},c=>{c.leases[0].escalation.type='INDEXED';}]){const c=copy();mutate(c);equal(calculateContractRunoff(c).status,'NOT_CALCULABLE');equal(calculateContractRunoff(c).totals,null);}
for(let rent=0;rent<=2400000;rent+=100000){const c=copy();c.leases[0].baseRent.value=rent;c.operatingExpenses=[cost()];const r=calculateContractRunoff(c);near(r.totals.contractRent,rent/3);near(r.totals.contractNetBeforeCapex,rent/3-12000);}
const serialized=JSON.stringify(base);calculateContractRunoff(base);equal(JSON.stringify(base),serialized);equal(Object.isFrozen(result.rows),true);
console.log(`AUDIT_CONTRACT_RUNOFF=PASS checks=${checks}`);
