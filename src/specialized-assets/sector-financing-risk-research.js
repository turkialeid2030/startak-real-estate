'use strict';
// Separate research overlay: recompute base from its input archive state.
// No amendment of canonical valuation, financing policy, tax rules or authority.
const P=require('../engines/financial/precision');
const {buildMonthlyDebtPlan}=require('../engines/financial/monthly-debt');
const {analyzeIRR,IRR_RELIABILITY}=require('../engines/financial/irr-diagnostics');
const {calculateDcfStudy}=require('./sector-property-dcf-archive');
const {STATUS:BASE_STATUS}=require('./sector-property-dcf');
const STATUS=Object.freeze({HOLD:'HOLD',READY:'PERSONAL_FINANCING_RISK_RESEARCH_ONLY'});
const amount=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1e12&&P.money(v)===v;
const rate=(v,lo,hi)=>typeof v==='number'&&Number.isFinite(v)&&v>=lo&&v<=hi&&P.fromRate(P.toRate(v))===v;
const text=v=>typeof v==='string'&&v.trim().length>0&&v.length<=200;
const safe=v=>Number.isFinite(v)&&Math.abs(v)<=1e12;
function hold(code){return {status:STATUS.HOLD,issues:[code],equityNpvSar:null,equityIrr:null,simulation:null,periods:[],transactionAuthorized:false,professionalValuationCertified:false,financeApproved:false,taxOpinionEstablished:false,financialModelUpdated:false};}
function percentile(sorted,p){return sorted[Math.floor((sorted.length-1)*p)];}
// Reproducible unsigned 32-bit xorshift. Zero seed is rejected.
function rng(seed){let s=seed>>>0;return ()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return (s>>>0)/4294967296;};}
function evaluateSectorFinancingRisk({study,financing,risk}={}){
 let base;
 try{base=calculateDcfStudy(study);}catch{return hold('BASE_DCF_REQUIRED');}
 if(base.status!==BASE_STATUS.READY)return hold('BASE_DCF_REQUIRED');
 const f=financing,m=risk;
 if(!f||!m||!['UNFINANCED','FIXED_RATE_AMORTIZING_PROXY'].includes(f.mode)||!text(f.financingAssumptionRef)||!text(f.taxCashflowAssumptionRef)||f.additionalTaxCashflowsConfirmed!==true||f.noDuplicateCostsConfirmed!==true||!['principalSar','upfrontFinanceFeeSar','annualAdditionalTaxSar','exitAdditionalTaxSar'].every(k=>amount(f[k]))||!rate(f.annualRate,0,.5)||!rate(f.equityDiscountRate,0,.75)||!Number.isInteger(f.tenorYears)||f.tenorYears<0||f.tenorYears>30)return hold('FINANCING_TAX_INPUTS_INVALID');
 if(f.mode==='UNFINANCED'&&[f.principalSar,f.upfrontFinanceFeeSar,f.annualRate,f.tenorYears].some(v=>v!==0))return hold('UNFINANCED_FIELDS_MUST_BE_ZERO');
 if(f.mode==='FIXED_RATE_AMORTIZING_PROXY'&&(f.principalSar<=0||f.principalSar>=base.initialInvestmentSar||f.tenorYears<1||(f.tenorYears>base.years&&base.terminalMode!=='EXPLICIT_NET_SALE')))return hold('DEBT_OR_EXIT_INVALID');
 if(base.terminalMode==='NONE'&&f.exitAdditionalTaxSar!==0)return hold('EXIT_TAX_REQUIRES_SALE');
 if(!text(m.assumptionRef)||!Number.isInteger(m.seed)||m.seed<1||m.seed>4294967295||!Number.isInteger(m.samples)||m.samples<64||m.samples>512||!['rentVariation','expenseVariation','saleVariation'].every(k=>rate(m[k],0,1)))return hold('SIMULATION_INPUTS_INVALID');
 try{
  const loan=f.mode==='UNFINANCED'?{annualSchedule:[]}:buildMonthlyDebtPlan(f.principalSar,f.annualRate,f.tenorYears);
  const equity=P.moneyAdd(base.initialInvestmentSar,f.upfrontFinanceFeeSar,-f.principalSar);
  if(!amount(equity)||equity<=0)return hold('EQUITY_INVALID');
  const periods=base.periods.map(p=>{
   const debt=loan.annualSchedule[p.year-1],service=debt?.payment??0;
   const exitPayoff=p.year===base.years?debt?.balance??0:0;
   const exitTax=p.year===base.years?f.exitAdditionalTaxSar:0;
   const tax=f.annualAdditionalTaxSar;
   const cash=P.moneyAdd(p.cashflowSar,-service,-exitPayoff,-tax,-exitTax);
   if(![service,exitPayoff,tax,exitTax,cash].every(safe))throw Error('range');
   return {year:p.year,propertyNoiSar:p.propertyNoiSar,propertyCashflowSar:p.cashflowSar,additionalTaxSar:tax,exitAdditionalTaxSar:exitTax,debtServiceSar:service,exitDebtPayoffSar:exitPayoff,endingDebtSar:exitPayoff?0:debt?.balance??0,dscr:service>0?p.propertyNoiSar/service:null,equityCashflowSar:cash};
  });
  const flows=[-equity,...periods.map(p=>p.equityCashflowSar)];
  const npv=P.preciseNPV(f.equityDiscountRate,flows),ir=analyzeIRR(flows,{financeRate:f.equityDiscountRate,reinvestRate:f.equityDiscountRate});
  if(!safe(npv))throw Error('range');
  const next=rng(m.seed),draws=[];
  for(let i=0;i<m.samples;i++){
   // Independent uniform level shocks, fixed across the holding horizon.
   // Not calibrated empirical distributions or annual independent draws.
   const factor=v=>P.fromRate(P.toRate(1+(2*next()-1)*v));
   const rf=factor(m.rentVariation),ef=factor(m.expenseVariation),sf=factor(m.saleVariation);
   const simulated=[-equity,...base.periods.map((p,j)=>{
    const a=periods[j],cash=P.moneyAdd(P.moneyMulRate(p.collectedPropertyRentSar,rf),-P.moneyMulRate(p.ownerExpensesSar,ef),-p.sustainingCapexSar,P.moneyMulRate(p.terminalNetSaleSar,sf),-a.debtServiceSar,-a.exitDebtPayoffSar,-a.additionalTaxSar,-a.exitAdditionalTaxSar);
    if(!safe(cash))throw Error('range');return cash;
   })];
   const value=P.preciseNPV(f.equityDiscountRate,simulated);if(!safe(value))throw Error('range');draws.push(value);
  }
  draws.sort((a,b)=>a-b);
  const dscrs=periods.filter(p=>p.dscr!==null).map(p=>p.dscr);
  return {status:STATUS.READY,issues:[],assetClass:base.assetClass,propertyRef:base.propertyRef,valuationDate:base.valuationDate,initialEquitySar:equity,equityNpvSar:npv,equityIrr:ir.reliability===IRR_RELIABILITY.RELIABLE&&Number.isFinite(ir.irr)?ir.irr:null,irrReliability:ir.reliability,minAnnualNoiDscr:dscrs.length?Math.min(...dscrs):null,periods,
   simulation:{seed:m.seed,samples:m.samples,distribution:'INDEPENDENT_UNIFORM_HORIZON_LEVEL_SHOCKS',p10NpvSar:percentile(draws,.1),p50NpvSar:percentile(draws,.5),p90NpvSar:percentile(draws,.9),negativeNpvShare:draws.filter(x=>x<0).length/draws.length},
   financingAssumptionRef:f.financingAssumptionRef,taxCashflowAssumptionRef:f.taxCashflowAssumptionRef,riskAssumptionRef:m.assumptionRef,
   transactionAuthorized:false,professionalValuationCertified:false,financeApproved:false,taxOpinionEstablished:false,financialModelUpdated:false,
   semantics:'Annual aggregation of monthly fixed-rate debt proxy; additional user-declared tax cashflows only, no legal tax computation; DSCR excludes separate exit payoff; simulated frequencies reflect specified uniform shocks, not real-world probabilities.'};
 }catch{return hold('CALCULATION_RANGE_INVALID');}
}
module.exports={STATUS,evaluateSectorFinancingRisk};
