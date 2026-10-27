'use strict';
const assert=require('node:assert/strict');
const {operatingCase,verified}=require('../fixtures/synthetic-collections-case');
const {createOperatingExpense,createCapexItem}=require('../../src/residential-income-acquisition');
const {replaceCapitalPaymentPlan}=require('../../src/residential-income-acquisition/capital-payment-plan');
const {calculateContractRunoff}=require('../../src/residential-income-acquisition/contract-runoff');
const {buildPersonalFinancialStudy,verifyPersonalFinancialStudy,htmlFinancialStudy}=require('../../src/app/personal-financial-study');
const {createRentalCalendar}=require('../../src/app/rental-calendar-disclosure');
const {reconcileOperatingHorizon}=require('../../src/app/operating-financial-reconciliation');
const gold=require('../reference/RE-GOLD-baseline.json')['RE-GOLD-002_existing_building'].inputs;
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-6,`${actual} != ${expected}`);
const base=JSON.parse(JSON.stringify(operatingCase()));
base.operatingExpenses=[createOperatingExpense({caseId:base.caseId,expenseId:'EXP-1',propertyId:'PROPERTY-1',category:'MAINTENANCE',basis:'NORMALIZED',annualAmount:verified('opex',12000,'SAR/year','evidence://lease/rent')})];
base.capexItems=[createCapexItem({caseId:base.caseId,capexItemId:'CAP-1',propertyId:'PROPERTY-1',category:'OTHER',severity:'LOW',estimatedCost:verified('capex.cost',12000,'SAR','evidence://lease/rent'),requiredByDate:'2027-09-01'})];
const source=replaceCapitalPaymentPlan(base,{sourceRef:'synthetic-plan',reviewRef:'synthetic-review',confirmed:true,entries:[{capexItemId:'CAP-1',date:'2027-09-01',amount:'12000'}]});
const calendar=start=>createRentalCalendar({studyStartDate:start,locationScope:'OTHER',leaseCategory:'RESIDENTIAL',contractReference:'',lastRentReference:'',exceptionReference:''});
const build=(c=source,start='2026-09-01')=>buildPersonalFinancialStudy({mode:'building',inputs:{...gold,holdPeriod:3,replacementReservePerSqm:7},assumptionModelVersion:'LEGACY',operatingCase:c,rentalContext:calendar(start)});
const report=build(),h=report.operatingReport.horizonReconciliation;
assert.equal(h.status,'ARITHMETIC_HORIZON_COMPLETE');
assert.equal(h.years.length,3);
assert.deepEqual(h.years.map(y=>y.contractRent),[400000,0,0]);
assert.deepEqual(h.years.map(y=>y.normalizedOpex),[12000,12000,12000]);
assert.deepEqual(h.years.map(y=>y.scheduledCapex),[0,12000,0]);
assert.deepEqual(h.years.map(y=>y.netAfterScheduledCapexBeforeReserve),[388000,-24000,-12000]);
assert.ok(h.years.every(y=>Math.abs(y.bridge.rows.at(-1).amount)<.005));
assert.equal(h.fullReconciliationEstablished,false);
assert.equal(h.renewalAssumed,false);
assert.equal(verifyPersonalFinancialStudy(report),true);
assert.ok(htmlFinancialStudy(report).includes('تسوية العقود على كامل مدة الدراسة'));
assert.ok(htmlFinancialStudy(report,{locale:'en'}).includes('Contract reconciliation over the study horizon'));
const missing=JSON.parse(JSON.stringify(source));missing.operatingExpenses=[];
assert.equal(build(missing).operatingReport.horizonReconciliation.status,'PARTIAL');
assert.equal(build(source,'2026-09-02').operatingReport.horizonReconciliation.status,'NOT_COMPARABLE');
// Mid-month annual periods include 13 partial/full monthly rows with no overlap.
const mid=JSON.parse(JSON.stringify(source));mid.asOfDate='2026-09-16';mid.leases[0].endDate='2029-09-16';
const midReport=build(mid,'2026-09-16');
assert.equal(midReport.operatingReport.horizonReconciliation.status,'ARITHMETIC_HORIZON_COMPLETE');
for(const y of midReport.operatingReport.horizonReconciliation.years){near(y.contractRent,1200000);near(y.normalizedOpex,12000);}
const window=calculateContractRunoff(mid,{periodStart:'2027-09-16',periodEndExclusive:'2028-09-16'});
assert.equal(window.rows.length,13);near(window.totals.contractRent,1200000);
// Known step rent is applied by date, not copied as a stabilized annual rate.
const step=JSON.parse(JSON.stringify(source));step.leases[0].endDate='2029-09-01';
step.leases[0].escalation={type:'STEP_RENT',schedule:[{effectiveDate:'2027-03-01',rent:verified('step',1320000,'SAR/year','evidence://lease/rent')}]};
const stepped=build(step).operatingReport.horizonReconciliation;
near(stepped.years[0].contractRent,1260000);near(stepped.years[1].contractRent,1320000);
for(const window of [{periodStart:'2026-08-01',periodEndExclusive:'2027-08-01'},{periodStart:'2026-09-01',periodEndExclusive:'2028-09-01'},{periodStart:'bad',periodEndExclusive:'2027-09-01'}])
  assert.equal(calculateContractRunoff(source,window).status,'NOT_CALCULABLE');
const badCalendar=JSON.parse(JSON.stringify(report.financial.rentalCalendar));badCalendar.periods[1].endDateExclusive='2028-09-02';
assert.equal(reconcileOperatingHorizon(source,report.financial.results,badCalendar).status,'NOT_COMPARABLE');
const changed=JSON.parse(JSON.stringify(report));changed.operatingReport.horizonReconciliation.years[1].scheduledCapex=0;
assert.equal(verifyPersonalFinancialStudy(changed),false);
const reserved=JSON.parse(JSON.stringify(source));
reserved.operatingExpenses.push(createOperatingExpense({caseId:base.caseId,expenseId:'RESERVE-1',propertyId:'PROPERTY-1',category:'REPLACEMENT_RESERVE',basis:'NORMALIZED',annualAmount:verified('reserve',1200,'SAR/year','evidence://lease/rent')}));
const reserveReport=build(reserved),reserveHorizon=reserveReport.operatingReport.horizonReconciliation;
assert.equal(reserveHorizon.status,'ARITHMETIC_HORIZON_COMPLETE');
assert.deepEqual(reserveHorizon.years.map(y=>y.sourceReplacementReserve),[1200,1200,1200]);
assert.deepEqual(reserveHorizon.years.map(y=>y.netAfterScheduledCapexBeforeReserve),[388000,-24000,-12000]);
assert.equal(reserveReport.operatingReport.contractRunoff.totals.contractNetBeforeCapex,386800);

// Malformed restored annual series and operating cases fail closed instead of throwing
// or silently producing a partial but apparently comparable certificate.
const untrustedCalendar=JSON.parse(JSON.stringify(report.financial.rentalCalendar));
const untrustedEconomics=JSON.parse(JSON.stringify(report.financial.results));
const sourcePeriod=untrustedCalendar.periods[0];
const assertHeld=(c,r,cal)=>{
  let state;
  assert.doesNotThrow(()=>{state=reconcileOperatingHorizon(c,r,cal);});
  assert.equal(state.status,'NOT_COMPARABLE');
  assert.deepEqual(state.years,[]);
  assert.equal(state.fullReconciliationEstablished,false);
  assert.equal(state.transactionAuthorized,false);
};
assertHeld(source,untrustedEconomics,{periods:[null,...untrustedCalendar.periods.slice(1)]});
assertHeld(source,untrustedEconomics,{periods:[undefined,...untrustedCalendar.periods.slice(1)]});
assertHeld(source,untrustedEconomics,{periods:[]});
assertHeld(source,untrustedEconomics,{periods:[{...sourcePeriod,startDate:null},...untrustedCalendar.periods.slice(1)]});
assertHeld(source,{...untrustedEconomics,annualOperatingEconomics:[null,...untrustedEconomics.annualOperatingEconomics.slice(1)]},untrustedCalendar);
assertHeld(source,{...untrustedEconomics,annualOperatingEconomics:[undefined,...untrustedEconomics.annualOperatingEconomics.slice(1)]},untrustedCalendar);
assertHeld({...source,asOfDate:null},untrustedEconomics,untrustedCalendar);
assertHeld({...source,contractType:'UNTRUSTED_CASE'},untrustedEconomics,untrustedCalendar);
console.log('OPERATING_HORIZON_RECONCILIATION: PASS');
