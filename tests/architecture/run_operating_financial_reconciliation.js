'use strict';
const assert = require('node:assert/strict');
const {reconcileOperatingFinancial, reconciliationHtml} = require('../../src/app/operating-financial-reconciliation');
const runoff = {periodStart:'2026-01-01',periodEndExclusive:'2027-01-01',totals:{contractRent:1000,normalizedOpex:200,normalizedOpexBeforeReserve:200,normalizedReplacementReserve:0}};
const model = {rentalIncomeAfterVacancy:1200,firstYearServiceIncome:100,firstYearTotalAnnualIncome:1300,firstYearNOI:900,replacementReserveAmount:50};
const calendar = {periods:[{startDate:'2026-01-01',endDateExclusive:'2027-01-01'}]};
const bridge = reconcileOperatingFinancial(runoff,model,calendar);
assert.equal(bridge.status,'ARITHMETIC_BRIDGE_COMPLETE');
assert.deepEqual(bridge.rows.map(r=>r.amount),[900,-200,-100,150,50,800,0]);
assert.equal(bridge.fullReconciliationEstablished,false);
assert.equal(bridge.aggregateEngineUpdated,false);
assert.equal(reconcileOperatingFinancial(runoff,model,null).status,'NOT_COMPARABLE');
assert.equal(reconcileOperatingFinancial({...runoff,periodStart:'2026-01-02'},model,calendar).status,'NOT_COMPARABLE');
for (const bad of [null,undefined,NaN,Infinity,'200']) {
  assert.equal(reconcileOperatingFinancial(runoff,{...model,firstYearNOI:bad},calendar).status,'NOT_COMPARABLE');
}
const withCash = {...runoff,historicalCollections:{totals:{rentCollected:900000}},totals:{...runoff.totals,scheduledCapex:700}};
assert.deepEqual(reconcileOperatingFinancial(withCash,model,calendar),bridge);
for(const locale of ['en','ar-SA']) assert.ok(reconciliationHtml(bridge,locale).includes('<table>'));
// Imported or corrupted report rows must not throw or print fabricated financial figures.
for(const invalid of [
  {...bridge,rows:[{code:'<img src=x onerror=alert(1)>',amount:1}]},
  {...bridge,rows:bridge.rows.map((row,i)=>i===0?{...row,amount:Infinity}:row)},
  {...bridge,status:'APPROVED_VALUATION'},
  {...bridge,rows:null},
]){
  let html;
  assert.doesNotThrow(()=>{html=reconciliationHtml(invalid,'en');});
  assert.ok(html.includes('Comparison withheld'));
  assert.ok(!html.includes('<table>'));
  assert.ok(!html.includes('<img'));
}
const {operatingCase,verified} = require('../fixtures/synthetic-collections-case');
const {createOperatingExpense} = require('../../src/residential-income-acquisition');
const {buildPersonalFinancialStudy,verifyPersonalFinancialStudy,htmlFinancialStudy} = require('../../src/app/personal-financial-study');
const {createRentalCalendar} = require('../../src/app/rental-calendar-disclosure');
const inputs = require('../reference/RE-GOLD-baseline.json')['RE-GOLD-002_existing_building'].inputs;
const context={mode:'building',inputs,assumptionModelVersion:'LEGACY',operatingCase:operatingCase(),rentalContext:createRentalCalendar({studyStartDate:'2026-09-01',locationScope:'OTHER',leaseCategory:'RESIDENTIAL',contractReference:'',lastRentReference:'',exceptionReference:''})};
assert.equal(buildPersonalFinancialStudy(context).operatingReport.reconciliation.status,'NOT_COMPARABLE');
context.operatingCase=JSON.parse(JSON.stringify(context.operatingCase));
context.operatingCase.operatingExpenses=[createOperatingExpense({caseId:'CASE-COLLECTIONS-1',expenseId:'EXP-1',propertyId:'PROPERTY-1',category:'MAINTENANCE',basis:'NORMALIZED',annualAmount:verified('opex.maintenance',12000,'SAR/year','evidence://lease/rent')})];
const report=buildPersonalFinancialStudy(context);
assert.equal(report.operatingReport.reconciliation.status,'ARITHMETIC_BRIDGE_COMPLETE');
assert.equal(verifyPersonalFinancialStudy(report),true);
assert.ok(htmlFinancialStudy(report).includes('تسوية الاستحقاق للسنة الأولى'));
const tampered=JSON.parse(JSON.stringify(report));tampered.operatingReport.reconciliation.rows[0].amount++;
assert.equal(verifyPersonalFinancialStudy(tampered),false);
console.log('OPERATING_FINANCIAL_RECONCILIATION: PASS');
