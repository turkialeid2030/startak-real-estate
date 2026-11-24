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
// Explicit market-value capital structure and effective usable tax shield.
// No tax regime, leverage recommendation or discount rate adoption inferred.
function evaluateWaccResearch(input,expected){
 if(!contextValid(input,expected))return result(null,'HOLD',[],['RESEARCH_SCOPE_INVALID']);
 const c=input.capital;
 if(!evidence(c,input)||c.basis!=='MARKET_VALUE_CAPITAL_STRUCTURE'||c.unit!=='SAR_AND_ANNUAL_RATIOS'
 ||!['NO_TAX_SHIELD','EXPLICIT_EFFECTIVE_TAX_SHIELD'].includes(c.taxShieldBasis)
 ||![c.debt,c.equity].every(v=>money(v)&&v>=0)||c.debt+c.equity<=0
 ||![c.costOfDebt,c.costOfEquity,c.effectiveTaxShieldRate].every(v=>finite(v)&&v>=0&&v<=1)
 ||(c.taxShieldBasis==='NO_TAX_SHIELD'&&c.effectiveTaxShieldRate!==0))
 return result(input,'HOLD',[],['CAPITAL_STRUCTURE_OR_RATE_INVALID']);
 const total=c.debt+c.equity;
 const value=c.equity/total*c.costOfEquity+c.debt/total*c.costOfDebt*(1-c.effectiveTaxShieldRate);
 return {...result(input,'ANALYTICAL_ONLY',[metric('WACC',value,'ANNUAL_RATIO')]),
  capitalBasis:c.basis,taxShieldBasis:c.taxShieldBasis,lineage:{capital:{sourceRef:c.sourceRef,sourceDate:c.sourceDate}},
  semantics:'Research WACC only; no tax opinion or automatic discount rate adoption.'};
}
// Single activity with linear variable expense, same period and volume basis.
function evaluateBreakEvenResearch(input,expected){
 if(!contextValid(input,expected))return result(null,'HOLD',[],['RESEARCH_SCOPE_INVALID']);
 const c=input.activity;
 if(!evidence(c,input)||c.basis!=='SINGLE_ACTIVITY_LINEAR_COST'||c.unit!=='SAR_AND_UNITS'
 ||!date(c.periodStart)||!date(c.periodEndExclusive)||c.periodStart>=c.periodEndExclusive
 ||![c.fixedCost,c.unitPrice,c.variableCostPerUnit,c.units].every(v=>money(v)&&v>=0)||c.unitPrice<=0
 ||!text(c.unitName)||!money(c.unitPrice*c.units)||!money(c.variableCostPerUnit*c.units))
 return result(input,'HOLD',[],['BREAK_EVEN_EVIDENCE_OR_INPUT_INVALID']);
 const margin=c.unitPrice-c.variableCostPerUnit;
 const revenue=c.unitPrice*c.units;
 const breakUnits=margin>0?c.fixedCost/margin:null;
 const breakRevenue=breakUnits===null?null:breakUnits*c.unitPrice;
 const safety=breakRevenue!==null&&revenue>0?(revenue-breakRevenue)/revenue:null;
 if([breakUnits,breakRevenue,safety].some(v=>v!==null&&!finite(v)))return result(input,'HOLD',[],['BREAK_EVEN_NON_FINITE']);
 return {...result(input,'ANALYTICAL_ONLY',[
 metric('PROJECT_BREAK_EVEN_UNITS',breakUnits,'UNITS',margin<=0?'NON_POSITIVE_CONTRIBUTION':null),
 metric('PROJECT_BREAK_EVEN_REVENUE',breakRevenue,'SAR',margin<=0?'NON_POSITIVE_CONTRIBUTION':null),
 metric('MARGIN_OF_SAFETY',safety,'RATIO',margin<=0?'NON_POSITIVE_CONTRIBUTION':revenue===0?'ZERO_REVENUE':null)
 ]),periodStart:c.periodStart,periodEndExclusive:c.periodEndExclusive,unitName:c.unitName,
 lineage:{activity:{sourceRef:c.sourceRef,sourceDate:c.sourceDate}},
 semantics:'Continuous-volume linear operating break-even, excludes financing unless explicitly classified in the submitted cost basis; not occupancy break-even.'};
}
function holdingValid(c){
 return date(c.periodStart)&&date(c.periodEnd)&&c.periodStart<c.periodEnd
 &&c.basis==='OPENING_CLOSING_VALUE_CASH_DISTRIBUTIONS_NO_EXTERNAL_CAPITAL'
 &&c.unit==='SAR'&&money(c.openingValue)&&c.openingValue>0
 &&money(c.closingValue)&&c.closingValue>=0&&money(c.cashDistributions)&&c.cashDistributions>=0
 &&c.externalCapitalFlows===false;
}
function holdingReturn(c){return (c.closingValue+c.cashDistributions-c.openingValue)/c.openingValue;}
function evaluateHoldingReturnResearch(input,expected){
 if(!contextValid(input,expected))return result(null,'HOLD',[],['RESEARCH_SCOPE_INVALID']);
 const c=input.holding,i=input.inflation;
 if(!evidence(c,input)||!holdingValid(c)||c.periodEnd>input.asOfDate||c.sourceDate<c.periodEnd)
 return result(input,'HOLD',[],['HOLDING_EVIDENCE_OR_INPUT_INVALID']);
 if(i!==undefined&&i!==null&&(!evidence(i,input)||i.unit!=='CUMULATIVE_PERIOD_RATIO'
 ||i.periodStart!==c.periodStart||i.periodEnd!==c.periodEnd||i.sourceDate<c.periodEnd
 ||!finite(i.value)||i.value<=-1||i.value>100))
 return result(input,'HOLD',[],['INFLATION_PERIOD_OR_INPUT_INVALID']);
 const years=(strictCalendarDateMs(c.periodEnd)-strictCalendarDateMs(c.periodStart))/(86400000*365.2425);
 const hpr=holdingReturn(c),cagr=Math.pow(c.closingValue/c.openingValue,1/years)-1;
 const real=i==null?null:(1+hpr)/(1+i.value)-1;
 if(!finite(hpr)||!finite(cagr)||(real!==null&&!finite(real)))return result(input,'HOLD',[],['HOLDING_RETURN_NON_FINITE']);
 return {...result(input,'ANALYTICAL_ONLY',[
 metric('HOLDING_PERIOD_RETURN',hpr,'PERIOD_RATIO'),
 metric('VALUE_ONLY_CAGR',cagr,'ANNUAL_RATIO'),
 metric('REAL_HOLDING_PERIOD_RETURN',real,'PERIOD_RATIO',i==null?'INFLATION_NOT_SUPPLIED':null)
 ]),periodStart:c.periodStart,periodEnd:c.periodEnd,yearCountConvention:'ACT/365.2425',years,
 lineage:{holding:{sourceRef:c.sourceRef,sourceDate:c.sourceDate},inflation:i==null?null:{sourceRef:i.sourceRef,sourceDate:i.sourceDate}},
 semantics:'HPR includes unreinvested cash distributions, CAGR excludes distributions; real return uses cumulative inflation for the identical period.'};
}
// Beginning-value-weighted simple holding-period return, no external capital
// contributions/withdrawals, no leverage or correlation inference.
function evaluatePortfolioReturnResearch(input,expected){
 const deny=code=>({...result(null,'HOLD',[],[code]),scope:'PORTFOLIO'});
 if(!plain(input)||!plain(expected)||input.scope!=='PORTFOLIO'||input.currency!=='SAR'
 ||!text(input.portfolioId)||input.portfolioId!==expected.portfolioId||input.asOfDate!==expected.asOfDate
 ||!date(input.asOfDate)||!date(input.periodStart)||!date(input.periodEnd)||input.periodStart>=input.periodEnd
 ||input.periodEnd>input.asOfDate||!Array.isArray(input.members)||input.members.length<2||input.members.length>1000
 ||!Array.isArray(expected.assetIds)||expected.assetIds.length!==input.members.length
 ||!Array.from(expected.assetIds).every(text)||new Set(expected.assetIds).size!==expected.assetIds.length)
 return deny('PORTFOLIO_SCOPE_OR_MEMBERSHIP_INVALID');
 const seen=new Set();let opening=0,ending=0,distributions=0;
 const members=[];
 for(const m of input.members){
  if(!plain(m)||!text(m.assetId)||seen.has(m.assetId)||!expected.assetIds.includes(m.assetId)
  ||m.portfolioId!==input.portfolioId||m.currency!=='SAR'||m.periodStart!==input.periodStart||m.periodEnd!==input.periodEnd
  ||!text(m.sourceRef)||!date(m.sourceDate)||m.sourceDate<m.periodEnd||m.sourceDate>input.asOfDate||!holdingValid(m))
  return deny('PORTFOLIO_MEMBER_EVIDENCE_INVALID');
  seen.add(m.assetId);opening+=m.openingValue;ending+=m.closingValue;distributions+=m.cashDistributions;
  members.push({assetId:m.assetId,openingValue:m.openingValue,periodReturn:holdingReturn(m),sourceRef:m.sourceRef,sourceDate:m.sourceDate});
 }
 const value=(ending+distributions-opening)/opening;
 if(!finite(value)||!money(opening)||!money(ending)||!money(distributions))return deny('PORTFOLIO_RETURN_NON_FINITE_OR_OUT_OF_RANGE');
 return {...result(null,'ANALYTICAL_ONLY',[metric('PORTFOLIO_HOLDING_PERIOD_RETURN',value,'PERIOD_RATIO')]),
 scope:'PORTFOLIO',portfolioId:input.portfolioId,asOfDate:input.asOfDate,periodStart:input.periodStart,periodEnd:input.periodEnd,
 members:members.map(m=>({...m,openingWeight:m.openingValue/opening})),
 semantics:'Beginning-value weighted total holding return, no external capital flows, not time-weighted or money-weighted multi-period performance.'};
}
module.exports={VERSION,evaluateAnnualReturnResearch,evaluateGrossRentResearch,evaluateWaccResearch,evaluateBreakEvenResearch,evaluateHoldingReturnResearch,evaluatePortfolioReturnResearch};
