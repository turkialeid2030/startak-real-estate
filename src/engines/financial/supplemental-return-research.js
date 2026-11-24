'use strict';
// Supplemental research analytics only. Never an input to canonical valuation.
const {computeNPV}=require('./index');
const {strictCalendarDateMs}=require('../../validation/strict-calendar-instant');
const VERSION='RE_SUPPLEMENTAL_RETURN_RESEARCH_V1';
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const money=x=>finite(x)&&Math.abs(x)<=1e12;
const text=x=>typeof x==='string'&&x.trim()===x&&x.length>0&&x.length<=160;
const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(strictCalendarDateMs(x));
const plain=x=>!!x&&typeof x==='object'&&!Array.isArray(x)&&(Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);
function contextValid(input,expected){
 return plain(input)&&plain(expected)&&input.currency==='SAR'&&input.scope==='PROPERTY'
  &&['caseId','propertyRef','asOfDate'].every(k=>input[k]===expected[k])
  &&text(input.caseId)&&text(input.propertyRef)&&date(input.asOfDate);
}
function evidence(record,input){
 return plain(record)&&text(record.sourceRef)&&date(record.sourceDate)&&record.sourceDate<=input.asOfDate
  &&record.caseId===input.caseId&&record.propertyRef===input.propertyRef;
}
function result(input,status,metrics=[],blockers=[]){
 return {version:VERSION,status,caseId:input?.caseId??null,propertyRef:input?.propertyRef??null,
  asOfDate:input?.asOfDate??null,scope:'PROPERTY',currency:'SAR',metrics,blockers,
  independentlyVerified:false,valuationChanged:false,investmentDecisionAuthorized:false,transactionAuthorized:false,productionOverrideActivated:false};
}
function metric(id,value,unit,reason=null){
 return {id,value:finite(value)?value:null,unit,status:finite(value)?'ANALYTICAL_ONLY':'NOT_APPLICABLE',reason};
}
// Explicit end-of-year annual cash flow schedule; the initial investment is
// a time-zero outflow. PI here only applies to conventional cash flows.
function evaluateAnnualReturnResearch(input,expected){
 if(!contextValid(input,expected))return result(null,'HOLD',[],['RESEARCH_SCOPE_INVALID']);
 const f=input.cashflows,r=input.discountRate;
 if(!evidence(f,input)||!evidence(r,input)||f.timing!=='ANNUAL_END_OF_YEAR'
  ||!['OPERATING_ONLY','INCLUDING_TERMINAL_PROCEEDS'].includes(f.basis)
  ||r.unit!=='ANNUAL_RATIO'||!finite(r.value)||r.value<0||r.value>1
  ||!Array.isArray(f.values)||f.values.length<2||f.values.length>101
  ||!Array.from(f.values).every(money)||f.values[0]>=0){
  return result(input,'HOLD',[],['RETURN_EVIDENCE_OR_INPUT_INVALID']);
 }
 const cashflows=Array.from(f.values),rate=r.value,n=cashflows.length-1;
 try{
  const npv=computeNPV(rate,cashflows);
  const conventional=cashflows.slice(1).every(v=>v>=0);
  let recovery=null;
  // Period-end crossing, not fractional-year interpolation; includes terminal
  // proceeds only if the submitted basis explicitly includes them.
  for(let t=1;t<=n;t++){if(computeNPV(rate,cashflows.slice(0,t+1))>=0){recovery=t;break;}}
  const pi=conventional?(npv-cashflows[0])/(-cashflows[0]):null;
  const annuityFactor=rate===0?n:-Math.expm1(-n*Math.log1p(rate))/rate;
  const eaa=npv/annuityFactor;
  if(!finite(npv)||!finite(eaa)||(conventional&&!finite(pi)))return result(input,'HOLD',[],['RETURN_NON_FINITE']);
  return {...result(input,'ANALYTICAL_ONLY',[
   metric('DISCOUNTED_PAYBACK_PERIOD_END',recovery,'YEARS',recovery===null?'NOT_RECOVERED_WITHIN_STUDY':null),
   metric('PROFITABILITY_INDEX_CONVENTIONAL',pi,'RATIO',conventional?null:'NON_CONVENTIONAL_CASHFLOWS'),
   metric('EQUIVALENT_ANNUAL_ANNUITY',eaa,'SAR_PER_YEAR')
  ]),cashflowBasis:f.basis,timing:f.timing,horizonYears:n,discountRate:rate,
   lineage:{cashflows:{sourceRef:f.sourceRef,sourceDate:f.sourceDate},discountRate:{sourceRef:r.sourceRef,sourceDate:r.sourceDate}},
   semantics:'Annual end-period research. EAA comparison requires a common discount rate and compatible service/reinvestment assumptions; not a valuation.'};
 }catch{return result(input,'HOLD',[],['RETURN_CALCULATION_FAILED']);}
}
// Gross contractual/potential rent is not net income, NOI or market cap rate.
function evaluateGrossRentResearch(input,expected){
 if(!contextValid(input,expected))return result(null,'HOLD',[],['RESEARCH_SCOPE_INVALID']);
 const p=input.price,r=input.annualGrossRent;
 if(!evidence(p,input)||!evidence(r,input)||p.unit!=='SAR'||r.unit!=='SAR_PER_YEAR'
  ||!['PURCHASE_PRICE','MARKET_VALUE_INDICATION'].includes(p.basis)
  ||!['CONTRACTUAL_GROSS_RENT','POTENTIAL_GROSS_RENT'].includes(r.basis)
  ||!date(r.periodStart)||!date(r.periodEndExclusive)||r.periodStart>=r.periodEndExclusive
  ||!money(p.value)||p.value<=0||!money(r.value)||r.value<0){
  return result(input,'HOLD',[],['GROSS_RENT_OR_PRICE_EVIDENCE_INVALID']);
 }
 const days=(strictCalendarDateMs(r.periodEndExclusive)-strictCalendarDateMs(r.periodStart))/86400000;
 if(days!==365&&days!==366)return result(input,'HOLD',[],['ANNUAL_RENT_PERIOD_REQUIRED']);
 const yieldRate=r.value/p.value,grm=r.value===0?null:p.value/r.value;
 if(!finite(yieldRate)||(grm!==null&&!finite(grm)))return result(input,'HOLD',[],['GROSS_RENT_RATIO_NON_FINITE']);
 return {...result(input,'ANALYTICAL_ONLY',[
  metric('GROSS_RENTAL_YIELD',yieldRate,'RATIO'),
  metric('GROSS_RENT_MULTIPLIER',grm,'MULTIPLE',grm===null?'ZERO_GROSS_RENT':null)
 ]),priceBasis:p.basis,rentBasis:r.basis,periodStart:r.periodStart,periodEndExclusive:r.periodEndExclusive,
 lineage:{price:{sourceRef:p.sourceRef,sourceDate:p.sourceDate},annualGrossRent:{sourceRef:r.sourceRef,sourceDate:r.sourceDate}},
 semantics:'Gross annual rent ratios only, not NOI capitalization or a professional market valuation.'};
}
module.exports={VERSION,evaluateAnnualReturnResearch,evaluateGrossRentResearch};
