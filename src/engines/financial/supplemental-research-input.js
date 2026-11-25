'use strict';
const engine=require('./supplemental-return-research');
const MAX_BYTES=256*1024;
const METHODS=Object.freeze({
 annual:engine.evaluateAnnualReturnResearch,gross:engine.evaluateGrossRentResearch,
 wacc:engine.evaluateWaccResearch,breakEven:engine.evaluateBreakEvenResearch,
 holding:engine.evaluateHoldingReturnResearch,portfolio:engine.evaluatePortfolioReturnResearch,
});
function reviewSupplementalText({method,text,expected}={}){
 const hold=code=>({status:'HOLD',metrics:[],blockers:[code],transactionAuthorized:false,investmentDecisionAuthorized:false,valuationChanged:false});
 if(!Object.hasOwn(METHODS,method))return hold('RESEARCH_METHOD_INVALID');
 if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_BYTES)return hold('RESEARCH_FILE_LIMIT');
 try{
  const data=JSON.parse(text,(k,v)=>{if(['__proto__','constructor','prototype'].includes(k))throw Error('unsafe');return v;});
  const result=METHODS[method](data,expected);
  return {...result,method};
 }catch{return hold('RESEARCH_INPUT_INVALID');}
}
function blankSupplementalInput(method,expected){
 const {caseId,propertyRef,asOfDate,portfolioId,assetIds=[]}=expected;
 const base={caseId,propertyRef,asOfDate,scope:'PROPERTY',currency:'SAR'};
 const e={caseId,propertyRef,sourceRef:'',sourceDate:''};
 const holding={basis:'OPENING_CLOSING_VALUE_CASH_DISTRIBUTIONS_NO_EXTERNAL_CAPITAL',unit:'SAR',periodStart:'',periodEnd:'',openingValue:null,closingValue:null,cashDistributions:null,externalCapitalFlows:null};
 switch(method){
  case 'annual':return {...base,cashflows:{...e,timing:'ANNUAL_END_OF_YEAR',basis:'OPERATING_ONLY',values:[null,null]},discountRate:{...e,unit:'ANNUAL_RATIO',value:null}};
  case 'gross':return {...base,price:{...e,unit:'SAR',basis:'PURCHASE_PRICE',value:null},annualGrossRent:{...e,unit:'SAR_PER_YEAR',basis:'CONTRACTUAL_GROSS_RENT',periodStart:'',periodEndExclusive:'',value:null}};
  case 'wacc':return {...base,capital:{...e,basis:'MARKET_VALUE_CAPITAL_STRUCTURE',unit:'SAR_AND_ANNUAL_RATIOS',taxShieldBasis:'',debt:null,equity:null,costOfDebt:null,costOfEquity:null,effectiveTaxShieldRate:null}};
  case 'breakEven':return {...base,activity:{...e,basis:'SINGLE_ACTIVITY_LINEAR_COST',unit:'SAR_AND_UNITS',periodStart:'',periodEndExclusive:'',fixedCost:null,unitPrice:null,variableCostPerUnit:null,units:null,unitName:''}};
  case 'holding':return {...base,holding:{...e,...holding},inflation:null};
  case 'portfolio':return {portfolioId,asOfDate,scope:'PORTFOLIO',currency:'SAR',periodStart:'',periodEnd:'',members:assetIds.map(assetId=>({...holding,assetId,portfolioId,currency:'SAR',sourceRef:'',sourceDate:''}))};
  default:throw Error('RESEARCH_METHOD_INVALID');
 }
}
module.exports={MAX_BYTES,METHODS,reviewSupplementalText,blankSupplementalInput};
