'use strict';
// Existing owner's alternatives, same valuation date and holding horizon.
// Unlevered pre-tax research; current net sale is an opportunity cost, not a new acquisition.
const P=require('../engines/financial/precision');
const {analyzeIRR,IRR_RELIABILITY}=require('../engines/financial/irr-diagnostics');
const {sha256Hex}=require('../crypto/sha256');
const VERSION='OWNER_REDEVELOPMENT_RESEARCH_V1';
const exact=(v,ks)=>v!==null&&typeof v==='object'&&Object.getPrototypeOf(v)===Object.prototype&&Object.keys(v).length===ks.length&&ks.every(k=>Object.hasOwn(v,k));
const text=v=>typeof v==='string'&&v.trim().length>0&&v.length<=200;
const day=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const money=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1e12&&P.money(v)===v;
const safe=v=>Number.isFinite(v)&&Math.abs(v)<=1e12;
const rate=(v,a,b)=>typeof v==='number'&&Number.isFinite(v)&&v>=a&&v<=b&&P.fromRate(P.toRate(v))===v;
const fail=c=>{throw Error(c);};
function evaluateRedevelopment(x){
 const keys=['version','propertyRef','valuationDate','currentState','propertyRight','identityRef','currentNetSaleSar','saleAssumptionRef','years','discountRate','planningStatus','planningRef','environmentalRef','costRef','incomeRef','exitRef','propertyIncomeOnly','noDuplicateCosts','demolitionYear','completionYear','retain','redevelop','stress'];
 if(!exact(x,keys)||x.version!==VERSION||!['propertyRef','identityRef','saleAssumptionRef','planningRef','environmentalRef','costRef','incomeRef','exitRef'].every(k=>text(x[k]))||!day(x.valuationDate)||!['IMPROVED','VACANT_LAND'].includes(x.currentState)||x.propertyRight!=='FREEHOLD'||!money(x.currentNetSaleSar)||x.currentNetSaleSar<=0||!Number.isInteger(x.years)||x.years<2||x.years>30||!rate(x.discountRate,0,.75)||!['DOCUMENT_DECLARED','ASSUMPTION_ONLY'].includes(x.planningStatus)||x.propertyIncomeOnly!==true||x.noDuplicateCosts!==true||!Number.isInteger(x.demolitionYear)||!Number.isInteger(x.completionYear)||x.demolitionYear<0||x.demolitionYear>=x.completionYear||x.completionYear<1||x.completionYear>=x.years)fail('REDEVELOPMENT_SCOPE_INVALID');
 if(!exact(x.stress,['incomeReduction','costIncrease','exitReduction'])||!Object.values(x.stress).every(v=>rate(v,0,1)))fail('REDEVELOPMENT_STRESS_INVALID');
 const rowKeys=['year','propertyRentSar','ownerOpexSar','sustainingCapexSar','demolitionSar','constructionSar','otherDevelopmentSar','netExitSar'];
 function rows(raw,dev){
  if(!Array.isArray(raw)||raw.length!==x.years+1)fail('REDEVELOPMENT_PERIODS_INVALID');
  const result=raw.map((p,i)=>{
   if(!exact(p,rowKeys)||p.year!==i||!rowKeys.slice(1).every(k=>money(p[k])))fail('REDEVELOPMENT_ROW_INVALID');
   if((i===0&&(p.propertyRentSar!==0||p.ownerOpexSar!==0||p.sustainingCapexSar!==0))||(i!==x.years&&p.netExitSar!==0))fail('REDEVELOPMENT_TIMING_INVALID');
   if(!dev&&(p.demolitionSar!==0||p.constructionSar!==0||p.otherDevelopmentSar!==0))fail('RETAIN_DEVELOPMENT_COST_INVALID');
   if(dev){
    if(p.demolitionSar!==0&&(i!==x.demolitionYear||x.currentState!=='IMPROVED'))fail('DEMOLITION_TIMING_INVALID');
    if(p.constructionSar!==0&&(i<x.demolitionYear||i>x.completionYear))fail('CONSTRUCTION_TIMING_INVALID');
    if(p.otherDevelopmentSar!==0&&i>x.completionYear)fail('DEVELOPMENT_TIMING_INVALID');
    if(i>=x.demolitionYear&&i<=x.completionYear&&(p.propertyRentSar!==0||p.sustainingCapexSar!==0))fail('CONSTRUCTION_RENT_INVALID');
   }
   const cash=P.moneyAdd(p.propertyRentSar,p.netExitSar,-p.ownerOpexSar,-p.sustainingCapexSar,-p.demolitionSar,-p.constructionSar,-p.otherDevelopmentSar);
   const downside=P.moneyAdd(P.moneyMulRate(p.propertyRentSar,1-x.stress.incomeReduction),P.moneyMulRate(p.netExitSar,1-x.stress.exitReduction),...['ownerOpexSar','sustainingCapexSar','demolitionSar','constructionSar','otherDevelopmentSar'].map(k=>-P.moneyMulRate(p[k],1+x.stress.costIncrease)));
   if(!safe(cash)||!safe(downside))fail('REDEVELOPMENT_RANGE_INVALID');
   return {...p,cashflowSar:cash,stressCashflowSar:downside};
  });
  if(result[x.years].netExitSar<=0)fail('COMMON_EXIT_REQUIRED');
  if(dev&&(!result.some(p=>p.constructionSar>0)||(x.currentState==='IMPROVED'&&!result.some(p=>p.demolitionSar>0))))fail('DEVELOPMENT_COST_REQUIRED');
  return result;
 }
 const retain=rows(x.retain,false),redevelop=rows(x.redevelop,true);
 function measure(periods){
  const flows=periods.map(p=>p.cashflowSar),stress=periods.map(p=>p.stressCashflowSar);
  const presentValueSar=P.preciseNPV(x.discountRate,flows),stressPresentValueSar=P.preciseNPV(x.discountRate,stress);
  const incrementalNpvSar=P.moneySub(presentValueSar,x.currentNetSaleSar),stressIncrementalNpvSar=P.moneySub(stressPresentValueSar,x.currentNetSaleSar);
  const investment=[...flows];investment[0]=P.moneySub(investment[0],x.currentNetSaleSar);
  const irr=analyzeIRR(investment,{financeRate:x.discountRate,reinvestRate:x.discountRate});
  if(![presentValueSar,stressPresentValueSar,incrementalNpvSar,stressIncrementalNpvSar,...investment].every(safe))fail('REDEVELOPMENT_RANGE_INVALID');
  return {presentValueSar,incrementalNpvSar,stressPresentValueSar,stressIncrementalNpvSar,opportunityCostIrr:irr.reliability===IRR_RELIABILITY.RELIABLE&&Number.isFinite(irr.irr)?irr.irr:null,irrReliability:irr.reliability,periods};
 }
 const a=measure(retain),b=measure(redevelop),issues=[];
 if(x.planningStatus!=='DOCUMENT_DECLARED')issues.push({code:'BUILDING_RIGHTS_UNVERIFIED',severity:'CRITICAL',ref:'planning'});
 issues.push({code:'REDEVELOPMENT_ASSUMPTIONS_UNVERIFIED',severity:'WARNING',ref:'scope'});
 const out={version:VERSION,scope:'OWNER_UNLEVERED_PRETAX_ALTERNATIVES_RESEARCH_ONLY',propertyRef:x.propertyRef,valuationDate:x.valuationDate,currentState:x.currentState,years:x.years,discountRate:x.discountRate,demolitionYear:x.demolitionYear,completionYear:x.completionYear,planningStatus:x.planningStatus,references:Object.fromEntries(['identityRef','saleAssumptionRef','planningRef','environmentalRef','costRef','incomeRef','exitRef'].map(k=>[k,x[k]])),stress:{...x.stress},sell:{presentValueSar:x.currentNetSaleSar,incrementalNpvSar:0},retain:a,redevelop:b,redevelopmentIncrementVsRetainSar:P.moneySub(b.presentValueSar,a.presentValueSar),issues,sourceAuthenticated:false,professionalValuationCertified:false,transactionAuthorized:false,canonicalModelUpdated:false,planningApproved:false,recommendationAuthorized:false};
 if(!safe(out.redevelopmentIncrementVsRetainSar))fail('REDEVELOPMENT_RANGE_INVALID');
 return {...out,reviewHashSha256:sha256Hex(JSON.stringify(out))};
}
module.exports={VERSION,evaluateRedevelopment};
