'use strict';

// Issue #775: OPTIONAL personal-research indicators only.
// This file is intentionally not imported by the canonical valuation engines,
// report exports, deployment approvals, or production decision gates.
// All inputs are explicit numbers; no source, evidence or market approval is inferred.
const VERSION = 'PROPERTY_OPTIONAL_INDICATORS_775_V1';
const INDICATORS = Object.freeze({
  GROSS_RENTAL_YIELD: Object.freeze({
    nameAr: 'العائد الإيجاري الإجمالي', unit: 'ratio',
    expression: 'GrossAnnualRent / PurchasePrice',
    scope: 'PROPERTY_PERSONAL_RESEARCH',
  }),
  GROSS_RENT_MULTIPLIER: Object.freeze({
    nameAr: 'مضاعف الإيجار الإجمالي', unit: 'years',
    expression: 'PurchasePrice / GrossAnnualRent',
    scope: 'PROPERTY_PERSONAL_RESEARCH',
  }),
  CASH_ON_CASH: Object.freeze({
    nameAr: 'العائد النقدي على رأس المال النقدي', unit: 'ratio',
    expression: 'AnnualPreTaxEquityCashFlow / CashEquityInvested',
    scope: 'EQUITY_PERSONAL_RESEARCH',
  }),
  DISCOUNTED_PAYBACK: Object.freeze({
    nameAr: 'الاسترداد المخصوم', unit: 'years',
    expression: 'First cumulative discounted cash-flow recovery (annual periods)',
    scope: 'PROJECT_PERSONAL_RESEARCH',
  }),
  PROFITABILITY_INDEX: Object.freeze({
    nameAr: 'مؤشر الربحية', unit: 'multiple',
    expression: 'PV(ExplicitNonnegativeFutureInflows) / InitialInvestment',
    scope: 'PROJECT_PERSONAL_RESEARCH',
  }),
  MIRR: Object.freeze({
    nameAr: 'العائد الداخلي المعدل', unit: 'ratio',
    expression: '(FV(PositiveCashFlows,ReinvestmentRate) / PV(NegativeCashFlows,FinanceRate))^(1/Years)-1',
    scope: 'PROJECT_PERSONAL_RESEARCH',
  }),
  EQUIVALENT_ANNUAL_ANNUITY: Object.freeze({
    nameAr: 'المكافئ السنوي الصافي', unit: 'SAR/year',
    expression: 'NPV * Rate / (1-(1+Rate)^(-Years)); Rate=0 => NPV/Years',
    scope: 'PROJECT_PERSONAL_RESEARCH',
  }),
});
const finite = value => typeof value === 'number' && Number.isFinite(value);
function requireNumber(value,code,{positive=false,nonnegative=false}={}){
  if(!finite(value))throw code+'_REQUIRED_FINITE';
  if(positive && value<=0)throw code+'_POSITIVE_REQUIRED';
  if(nonnegative && value<0)throw code+'_NONNEGATIVE_REQUIRED';
  return value;
}
function cashflows(values,code){
  if(!Array.isArray(values)||values.length<2||values.length>1001)throw code+'_TWO_OR_MORE_ANNUAL_PERIODS_REQUIRED';
  for(const v of values)if(!finite(v))throw code+'_FINITE_NUMBERS_REQUIRED';
  return values;
}
function rate(value,code){
  return requireNumber(value,code,{nonnegative:true});
}
function result(id,value,detail={}){
  if(!finite(value))throw 'INDICATOR_ARITHMETIC_NOT_FINITE';
  return Object.freeze({
    version:VERSION, metricId:id, status:'CALCULATED_UNVERIFIED',
    value, unit:INDICATORS[id].unit, periodBasis:'ANNUAL',
    sourceStatus:'USER_DECLARED_UNVERIFIED',
    professionalApproval:false, transactionAuthorized:false, ...detail,
  });
}
function hold(id,reasonCode){
  return Object.freeze({
    version:VERSION,metricId:id,status:'HOLD_INVALID_OR_INCOMPLETE',
    value:null,unit:INDICATORS[id]?.unit||null,periodBasis:'ANNUAL',
    sourceStatus:'USER_DECLARED_UNVERIFIED',professionalApproval:false,
    transactionAuthorized:false,reasonCode,
  });
}
function calculateOptionalPropertyIndicator(id,inputs){
  if(!Object.prototype.hasOwnProperty.call(INDICATORS,id))return hold(id,'UNSUPPORTED_INDICATOR');
  if(!inputs||typeof inputs!=='object'||Array.isArray(inputs))return hold(id,'EXPLICIT_INPUT_OBJECT_REQUIRED');
  try{
    let value;
    switch(id){
      case 'GROSS_RENTAL_YIELD': {
        const rent=requireNumber(inputs.grossAnnualRentSar,'GROSS_ANNUAL_RENT',{nonnegative:true});
        const price=requireNumber(inputs.purchasePriceSar,'PURCHASE_PRICE',{positive:true});
        value=rent/price;
        break;
      }
      case 'GROSS_RENT_MULTIPLIER': {
        const rent=requireNumber(inputs.grossAnnualRentSar,'GROSS_ANNUAL_RENT',{positive:true});
        const price=requireNumber(inputs.purchasePriceSar,'PURCHASE_PRICE',{positive:true});
        value=price/rent;
        break;
      }
      case 'CASH_ON_CASH': {
        const cf=requireNumber(inputs.annualPreTaxEquityCashFlowSar,'PRETAX_EQUITY_CASHFLOW');
        const equity=requireNumber(inputs.cashEquityInvestedSar,'ACTUAL_CASH_EQUITY',{positive:true});
        value=cf/equity;
        break;
      }
      case 'DISCOUNTED_PAYBACK': {
        const flows=cashflows(inputs.annualCashflowsSar,'PAYBACK_CASHFLOWS');
        const r=rate(inputs.discountRate,'DISCOUNT_RATE');
        if(flows[0]>=0)throw 'PAYBACK_INITIAL_NET_OUTFLOW_REQUIRED';
        if(flows.slice(1).some(x=>x<0))throw 'PAYBACK_LATER_CAPITAL_CALLS_UNSUPPORTED';
        if(typeof inputs.includesTerminalSale!=='boolean')throw 'PAYBACK_TERMINAL_SALE_DECLARATION_REQUIRED';
        const n=flows.length-1;
        if(inputs.includesTerminalSale){
          if(inputs.terminalSaleYear!==n)throw 'PAYBACK_TERMINAL_SALE_YEAR_REQUIRED_AT_HORIZON';
        }else if(inputs.terminalSaleYear!==undefined&&inputs.terminalSaleYear!==null){
          throw 'PAYBACK_TERMINAL_SALE_CONFLICT';
        }
        let balance=flows[0],year=null,includesTerminalSaleInRecovery=false;
        for(let t=1;t<=n;t++){
          const pv=flows[t]/Math.pow(1+r,t);
          if(!finite(pv))throw 'PAYBACK_DISCOUNTING_NON_FINITE';
          const before=balance;balance+=pv;
          if(!finite(balance))throw 'PAYBACK_CUMULATIVE_NON_FINITE';
          if(before<0&&balance>=0){
            includesTerminalSaleInRecovery=inputs.includesTerminalSale&&t===n;
            year=includesTerminalSaleInRecovery?t:(t-1)+(-before/pv);
            break;
          }
        }
        if(year===null)throw 'PAYBACK_NOT_RECOVERED_WITHIN_HORIZON';
        value=year;
        return result(id,value,{recoveryIncludesTerminalSale:includesTerminalSaleInRecovery,
          annualFlowsCount:n,terminalSaleIncluded:inputs.includesTerminalSale});
      }
      case 'PROFITABILITY_INDEX': {
        const investment=requireNumber(inputs.initialInvestmentSar,'INITIAL_INVESTMENT',{positive:true});
        const flows=inputs.futureAnnualInflowsSar;
        if(!Array.isArray(flows)||flows.length<1||flows.length>1000)throw 'PI_FUTURE_INFLOWS_REQUIRED';
        const r=rate(inputs.discountRate,'DISCOUNT_RATE');
        let pv=0;
        flows.forEach((f,i)=>{
          requireNumber(f,'PI_FUTURE_INFLOW',{nonnegative:true});
          pv+=f/Math.pow(1+r,i+1);
        });
        if(!finite(pv))throw 'PI_PRESENT_VALUE_NON_FINITE';
        value=pv/investment;
        break;
      }
      case 'MIRR': {
        const flows=cashflows(inputs.annualCashflowsSar,'MIRR_CASHFLOWS');
        const finance=rate(inputs.financeRate,'FINANCE_RATE');
        const reinvest=rate(inputs.reinvestmentRate,'REINVESTMENT_RATE');
        const n=flows.length-1;
        let fv=0,pvOut=0;
        flows.forEach((f,t)=>{
          if(f>0)fv+=f*Math.pow(1+reinvest,n-t);
          else if(f<0)pvOut+=(-f)/Math.pow(1+finance,t);
        });
        if(!(fv>0&&pvOut>0&&finite(fv)&&finite(pvOut)))throw 'MIRR_POSITIVE_AND_NEGATIVE_FLOWS_REQUIRED';
        value=Math.pow(fv/pvOut,1/n)-1;
        break;
      }
      case 'EQUIVALENT_ANNUAL_ANNUITY': {
        const npv=requireNumber(inputs.npvSar,'NPV');
        const r=rate(inputs.discountRate,'DISCOUNT_RATE');
        const n=inputs.periodYears;
        if(!Number.isInteger(n)||n<1||n>1000)throw 'EAA_PERIOD_YEARS_INVALID';
        value=r===0?npv/n:npv*r/(1-Math.pow(1+r,-n));
        break;
      }
      default:throw 'UNSUPPORTED_INDICATOR';
    }
    return result(id,value);
  }catch(code){
    return hold(id,typeof code==='string'?code:'INDICATOR_COMPUTATION_FAILED');
  }
}
module.exports={VERSION,INDICATORS,calculateOptionalPropertyIndicator};
