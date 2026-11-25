'use strict';
// Freehold acquisition/hold research. Use property-only contractual or assumed
// lease revenue, never operating-business turnover, EBITDA or historical KPIs.
// Other property rights and development remain in their dedicated workflows.
const precision=require('../engines/financial/precision');
const {analyzeIRR,IRR_RELIABILITY}=require('../engines/financial/irr-diagnostics');
const UNITS=Object.freeze({RESIDENTIAL:'UNIT',OFFICE:'SQM',RETAIL:'SQM',INDUSTRIAL_LOGISTICS:'SQM',HOSPITALITY:'ROOM_KEY',HEALTHCARE:'BED',EDUCATION:'SEAT',MIXED_USE:'WHOLE_PROPERTY',PARKING:'SPACE',DATA_CENTER:'MW_IT',SPECIAL_PURPOSE:'WHOLE_PROPERTY',FUEL_STATION:'WHOLE_PROPERTY'});
const STATUS=Object.freeze({HOLD:'HOLD',READY:'PERSONAL_PROPERTY_DCF_ONLY'});
const money=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1e12&&precision.money(v)===v;
const rate=(v,lo,hi)=>typeof v==='number'&&Number.isFinite(v)&&v>=lo&&v<=hi&&precision.fromRate(precision.toRate(v))===v;
const text=v=>typeof v==='string'&&v.trim().length>0&&v.length<=200;
const day=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const freeze=v=>{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
function result(status,issues,details={}){return freeze({version:'SECTOR_FREEHOLD_PROPERTY_DCF_V1',status,issues,assetClass:null,periods:[],scenarios:null,investmentNpvSar:null,irr:null,propertyMarketValueEstablished:false,professionalValuationCertified:false,transactionAuthorized:false,financialModelUpdated:false,independentlyVerified:false,...details});}
function evaluateSectorPropertyDcf(x){
 if(!x||typeof x!=='object'||Array.isArray(x)||typeof x.assetClass!=='string'||!Object.hasOwn(UNITS,x.assetClass))return result(STATUS.HOLD,['SECTOR_UNSUPPORTED']);
 const unit=UNITS[x.assetClass],issues=[];
 if(x.propertyRight!=='FREEHOLD'||x.propertyIncomeOnly!==true||x.businessAssetsExcluded!==true||!text(x.propertyRef)||!text(x.leaseAssumptionRef)||!day(x.valuationDate))
  issues.push('PROPERTY_SCOPE_OR_EVIDENCE_REQUIRED');
 if(!Number.isInteger(x.years)||x.years<1||x.years>30||!rate(x.quantity,0.000001,1e9)||(['UNIT','ROOM_KEY','BED','SEAT','SPACE','WHOLE_PROPERTY'].includes(unit)&&!Number.isInteger(x.quantity))||(unit==='WHOLE_PROPERTY'&&x.quantity!==1))issues.push('HORIZON_OR_CAPACITY_INVALID');
 if(!['annualRentPerUnitSar','annualOwnerExpensesSar','annualSustainingCapexSar','purchasePriceSar','acquisitionCostsSar','terminalNetSaleSar'].every(k=>money(x[k]))||x.purchasePriceSar<=0)issues.push('MONEY_INVALID');
 if(!rate(x.leasedFraction,0,1)||!rate(x.collectionFraction,0,1)||!rate(x.rentGrowth,-.25,.25)||!rate(x.expenseGrowth,-.25,.25)||!rate(x.discountRate,0,.75)||!rate(x.stressRevenueReduction,0,1)||!rate(x.stressExpenseIncrease,0,1)||!rate(x.stressDiscountIncrease,0,.25)||x.discountRate+x.stressDiscountIncrease>1)issues.push('RATE_INVALID');
 if(!['NONE','EXPLICIT_NET_SALE'].includes(x.terminalMode)||(x.terminalMode==='NONE'&&x.terminalNetSaleSar!==0)||(x.terminalMode==='EXPLICIT_NET_SALE'&&(x.terminalNetSaleSar<=0||!text(x.terminalEvidenceRef))))issues.push('TERMINAL_ASSUMPTION_INVALID');
 if(x.assetClass==='MIXED_USE'&&x.mixedAllocationConfirmed!==true)issues.push('MIXED_USE_ALLOCATION_REQUIRED');
 if(x.assetClass==='FUEL_STATION'&&x.environmentalObligationsReviewed!==true)issues.push('FUEL_ENVIRONMENTAL_REVIEW_REQUIRED');
 if(issues.length)return result(STATUS.HOLD,issues,{assetClass:x.assetClass});
 try{
  const initial=precision.moneyAdd(x.purchasePriceSar,x.acquisitionCostsSar);
  if(initial>1e12)return result(STATUS.HOLD,['MONEY_INVALID'],{assetClass:x.assetClass});
  const safe=v=>Number.isFinite(v)&&Math.abs(v)<=1e12;
  let rent=precision.moneyMulRate(x.annualRentPerUnitSar,x.quantity),expense=x.annualOwnerExpensesSar;
  if(!safe(rent))throw Error('range');
  const periods=[],flows=[-initial],stressFlows=[-initial];
  for(let year=1;year<=x.years;year++){
   const collectedRent=precision.moneyMulRate(precision.moneyMulRate(rent,x.leasedFraction),x.collectionFraction);
   const net=precision.moneySub(collectedRent,expense);
   const base=precision.moneySub(net,x.annualSustainingCapexSar);
   const terminal=year===x.years?x.terminalNetSaleSar:0;
   const stressRent=precision.moneyMulRate(collectedRent,precision.fromRate(precision.RATE_SCALE-precision.toRate(x.stressRevenueReduction)));
   const stressExpense=precision.moneyMulRate(expense,precision.fromRate(precision.RATE_SCALE+precision.toRate(x.stressExpenseIncrease)));
   const stressTerminal=precision.moneyMulRate(terminal,precision.fromRate(precision.RATE_SCALE-precision.toRate(x.stressRevenueReduction)));
   const cashflow=precision.moneyAdd(base,terminal);
   const stressed=precision.moneyAdd(stressRent,-stressExpense,-x.annualSustainingCapexSar,stressTerminal);
   if(![rent,expense,collectedRent,net,base,cashflow,stressed,stressRent,stressExpense,stressTerminal].every(safe))throw Error('range');
   periods.push({year,potentialRentSar:rent,collectedPropertyRentSar:collectedRent,ownerExpensesSar:expense,propertyNoiSar:net,sustainingCapexSar:x.annualSustainingCapexSar,terminalNetSaleSar:terminal,cashflowSar:cashflow,stressCashflowSar:stressed});
   flows.push(cashflow);stressFlows.push(stressed);
   if(year<x.years){rent=precision.moneyMulRate(rent,precision.fromRate(precision.RATE_SCALE+precision.toRate(x.rentGrowth)));expense=precision.moneyMulRate(expense,precision.fromRate(precision.RATE_SCALE+precision.toRate(x.expenseGrowth)));}
  }
  const npv=precision.preciseNPV(x.discountRate,flows),stressRate=precision.fromRate(precision.toRate(x.discountRate)+precision.toRate(x.stressDiscountIncrease)),stressNpv=precision.preciseNPV(stressRate,stressFlows);
  const ir=analyzeIRR(flows,{financeRate:x.discountRate,reinvestRate:x.discountRate});
  if(!safe(npv)||!safe(stressNpv))throw Error('range');
  return result(STATUS.READY,[],{assetClass:x.assetClass,unit,propertyRef:x.propertyRef,valuationDate:x.valuationDate,leaseAssumptionRef:x.leaseAssumptionRef,years:x.years,periods,initialInvestmentSar:initial,investmentNpvSar:npv,irr:ir.reliability===IRR_RELIABILITY.RELIABLE&&Number.isFinite(ir.irr)?ir.irr:null,irrReliability:ir.reliability,irrReasonCode:ir.reasonCode,scenarios:{base:{npvSar:npv,discountRate:x.discountRate},downside:{npvSar:stressNpv,discountRate:stressRate,revenueReduction:x.stressRevenueReduction,expenseIncrease:x.stressExpenseIncrease,terminalReduction:x.stressRevenueReduction}},terminalMode:x.terminalMode,semantics:'Unlevered annual nominal property cash-flow research; end-year cashflows; no tax, debt, automatic terminal capitalization or operating-profit adoption.'});
 }catch{return result(STATUS.HOLD,['CALCULATION_RANGE_INVALID'],{assetClass:x.assetClass});}
}
module.exports={UNITS,STATUS,evaluateSectorPropertyDcf};
