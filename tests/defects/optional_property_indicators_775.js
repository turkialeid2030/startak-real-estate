'use strict';
const assert=require('node:assert/strict');
const {VERSION,INDICATORS,calculateOptionalPropertyIndicator:calc,calculateDeclaredOptionalResearchIndicator:declared}=
  require('../../src/analysis/optional-property-indicators');
let assertions=0;
function eq(actual,expected,label){assert.equal(actual,expected,label);assertions++;}
function near(actual,expected,label,epsilon=1e-11){
  assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<=epsilon,
    label+': expected '+expected+' got '+actual);assertions++;
}
function ok(id,inputs){
  const out=calc(id,inputs);
  eq(out.status,'CALCULATED_UNVERIFIED',id+' status');
  eq(out.sourceStatus,'USER_DECLARED_UNVERIFIED',id+' source');
  eq(out.professionalApproval,false,id+' professional');
  eq(out.transactionAuthorized,false,id+' authority');
  eq(out.version,VERSION,id+' version');
  return out;
}
function reject(id,inputs,reason){
  const out=calc(id,inputs);
  eq(out.status,'HOLD_INVALID_OR_INCOMPLETE',id+' HOLD');
  eq(out.reasonCode,reason,id+' reason');
  eq(out.value,null,id+' no invented number');
  eq(out.professionalApproval,false,id+' no approval');
}
eq(Object.keys(INDICATORS).length,7,'exactly seven independent optional formulas');
const gross=ok('GROSS_RENTAL_YIELD',{grossAnnualRentSar:120000,purchasePriceSar:2000000});
near(gross.value,0.06,'gross rental yield');
const grm=ok('GROSS_RENT_MULTIPLIER',{grossAnnualRentSar:120000,purchasePriceSar:2000000});
near(grm.value,2000000/120000,'gross rent multiplier');
near(gross.value*grm.value,1,'gross yield x GRM reciprocal');
near(ok('CASH_ON_CASH',{annualPreTaxEquityCashFlowSar:60000,cashEquityInvestedSar:600000}).value,.1,'positive cash on cash');
near(ok('CASH_ON_CASH',{annualPreTaxEquityCashFlowSar:-60000,cashEquityInvestedSar:600000}).value,-.1,'negative cash on cash');
const payback0=ok('DISCOUNTED_PAYBACK',{annualCashflowsSar:[-100,60,60],discountRate:0,includesTerminalSale:false});
near(payback0.value,1+40/60,'undiscounted annual interpolation');
eq(payback0.recoveryIncludesTerminalSale,false,'ordinary recovery');
const dp=ok('DISCOUNTED_PAYBACK',{annualCashflowsSar:[-100,60,60],discountRate:.1,includesTerminalSale:false});
near(dp.value,1+(100-60/1.1)/(60/(1.1*1.1)),'discounted crossing');
eq(dp.annualFlowsCount,2,'year count');
const exit=ok('DISCOUNTED_PAYBACK',{annualCashflowsSar:[-100,60,60],discountRate:0,includesTerminalSale:true,terminalSaleYear:2});
eq(exit.value,2,'sale recovery exact end-year, never fractional');
eq(exit.recoveryIncludesTerminalSale,true,'sale type disclosed');
const pi=ok('PROFITABILITY_INDEX',{initialInvestmentSar:100,futureAnnualInflowsSar:[60,60],discountRate:.1});
near(pi.value,(60/1.1+60/(1.1*1.1))/100,'PI discounted inflows / initial investment');
near(ok('MIRR',{annualCashflowsSar:[-100,60,60],financeRate:.1,reinvestmentRate:.1}).value,
  Math.sqrt(1.26)-1,'MIRR classic');
const mixed=ok('MIRR',{annualCashflowsSar:[-100,80,-10,100],financeRate:.1,reinvestmentRate:.08});
near(mixed.value,Math.cbrt((80*1.08**2+100)/(100+10/(1.1**2)))-1,'MIRR additional later outflow');
near(ok('EQUIVALENT_ANNUAL_ANNUITY',{npvSar:100,discountRate:.1,periodYears:2}).value,
  100*.1/(1-1/(1.1*1.1)),'EAA');
near(ok('EQUIVALENT_ANNUAL_ANNUITY',{npvSar:-100,discountRate:0,periodYears:5}).value,
  -20,'EAA zero discount limit and negative NPV');
near(ok('EQUIVALENT_ANNUAL_ANNUITY',{npvSar:100,discountRate:1e-20,periodYears:5}).value,
  20,'EAA tiny positive rate avoids catastrophic cancellation',1e-10);
const input={grossAnnualRentSar:120000,purchasePriceSar:2000000};
const provenance={sourceReference:'DOC-TEST-775',sourceDate:'2025-11-01',userAttested:true};
const withDeclaration=declared('GROSS_RENTAL_YIELD',input,provenance);
eq(withDeclaration.status,'CALCULATED_UNVERIFIED','attested source still unverified');
eq(withDeclaration.sourceStatus,'USER_DECLARED_UNVERIFIED','declared source not certified');
eq(withDeclaration.provenanceStatus,'USER_ATTESTED_NOT_INDEPENDENTLY_VERIFIED','attested provenance only');
eq(withDeclaration.sourceReference,'DOC-TEST-775','retained user reference');
eq(withDeclaration.sourceDate,'2025-11-01','retained source date');
eq(withDeclaration.professionalApproval,false,'no professional attestation inferred');
eq(withDeclaration.transactionAuthorized,false,'no transaction authority inferred');
function holdDeclared(provenanceInput,reason){
 const out=declared('GROSS_RENTAL_YIELD',input,provenanceInput);
 eq(out.status,'HOLD_INVALID_OR_INCOMPLETE','declared HOLD');
 eq(out.reasonCode,reason,'declared HOLD reason');
 eq(out.value,null,'no sourced invented value');
}
holdDeclared(null,'SOURCE_DECLARATION_REQUIRED');
holdDeclared({...provenance,sourceReference:'a'},'SOURCE_REFERENCE_REQUIRED');
holdDeclared({...provenance,sourceDate:'not-a-date'},'SOURCE_DATE_REQUIRED');
holdDeclared({...provenance,sourceDate:'2025-02-30'},'SOURCE_DATE_INVALID');
holdDeclared({...provenance,sourceDate:'2099-02-10'},'SOURCE_DATE_IN_FUTURE');
holdDeclared({...provenance,userAttested:false},'EXPLICIT_USER_ATTESTATION_REQUIRED');
// Zero denominator, text coercion, missing data and nonfinite numbers must never generate output.
reject('GROSS_RENTAL_YIELD',{grossAnnualRentSar:12,purchasePriceSar:0},'PURCHASE_PRICE_POSITIVE_REQUIRED');
reject('GROSS_RENT_MULTIPLIER',{grossAnnualRentSar:0,purchasePriceSar:20},'GROSS_ANNUAL_RENT_POSITIVE_REQUIRED');
reject('CASH_ON_CASH',{annualPreTaxEquityCashFlowSar:1,cashEquityInvestedSar:0},'ACTUAL_CASH_EQUITY_POSITIVE_REQUIRED');
reject('GROSS_RENTAL_YIELD',{grossAnnualRentSar:'100',purchasePriceSar:1000},'GROSS_ANNUAL_RENT_REQUIRED_FINITE');
reject('GROSS_RENTAL_YIELD',{grossAnnualRentSar:Infinity,purchasePriceSar:1000},'GROSS_ANNUAL_RENT_REQUIRED_FINITE');
reject('DISCOUNTED_PAYBACK',{annualCashflowsSar:[-100,30,30],discountRate:0,includesTerminalSale:false},'PAYBACK_NOT_RECOVERED_WITHIN_HORIZON');
reject('DISCOUNTED_PAYBACK',{annualCashflowsSar:[-100,120],discountRate:0},'PAYBACK_TERMINAL_SALE_DECLARATION_REQUIRED');
reject('DISCOUNTED_PAYBACK',{annualCashflowsSar:[-100,120],discountRate:0,includesTerminalSale:true,terminalSaleYear:2},'PAYBACK_TERMINAL_SALE_YEAR_REQUIRED_AT_HORIZON');
reject('DISCOUNTED_PAYBACK',{annualCashflowsSar:[-100,130],discountRate:0,includesTerminalSale:false,terminalSaleYear:1},'PAYBACK_TERMINAL_SALE_CONFLICT');
reject('DISCOUNTED_PAYBACK',{annualCashflowsSar:[-100,50,-20,100],discountRate:0,includesTerminalSale:false},'PAYBACK_LATER_CAPITAL_CALLS_UNSUPPORTED');
reject('DISCOUNTED_PAYBACK',{annualCashflowsSar:[-100,120],discountRate:-.1,includesTerminalSale:false},'DISCOUNT_RATE_NONNEGATIVE_REQUIRED');
reject('DISCOUNTED_PAYBACK',{annualCashflowsSar:[-100,NaN],discountRate:0,includesTerminalSale:false},'PAYBACK_CASHFLOWS_FINITE_NUMBERS_REQUIRED');
reject('PROFITABILITY_INDEX',{initialInvestmentSar:100,futureAnnualInflowsSar:[100,-10],discountRate:0},'PI_FUTURE_INFLOW_NONNEGATIVE_REQUIRED');
reject('PROFITABILITY_INDEX',{initialInvestmentSar:0,futureAnnualInflowsSar:[100],discountRate:0},'INITIAL_INVESTMENT_POSITIVE_REQUIRED');
reject('MIRR',{annualCashflowsSar:[-100,-30],financeRate:.1,reinvestmentRate:.1},'MIRR_POSITIVE_AND_NEGATIVE_FLOWS_REQUIRED');
reject('MIRR',{annualCashflowsSar:[100,30],financeRate:.1,reinvestmentRate:.1},'MIRR_POSITIVE_AND_NEGATIVE_FLOWS_REQUIRED');
reject('MIRR',{annualCashflowsSar:[-100,200],financeRate:-1,reinvestmentRate:.1},'FINANCE_RATE_NONNEGATIVE_REQUIRED');
reject('EQUIVALENT_ANNUAL_ANNUITY',{npvSar:100,discountRate:.1,periodYears:0},'EAA_PERIOD_YEARS_INVALID');
reject('EQUIVALENT_ANNUAL_ANNUITY',{npvSar:100,discountRate:.1,periodYears:2.5},'EAA_PERIOD_YEARS_INVALID');
reject('EQUIVALENT_ANNUAL_ANNUITY',{npvSar:NaN,discountRate:.1,periodYears:2},'NPV_REQUIRED_FINITE');
reject('UNLISTED_METRIC',{a:1},'UNSUPPORTED_INDICATOR');
const source={grossAnnualRentSar:120000,purchasePriceSar:2000000};
Object.freeze(source);ok('GROSS_RENTAL_YIELD',source);eq(source.grossAnnualRentSar,120000,'inputs preserved');
console.log('OPTIONAL_PROPERTY_INDICATORS_775=PASS assertions='+assertions+' optional_only=true production_wiring=false professional_approval=false');
