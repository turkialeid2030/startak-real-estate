'use strict';

const DATED_RETURNS_VERSION='DATED_RETURNS_V4';
const DATED_RETURNS_STATUS=Object.freeze({QUALIFIED:'QUALIFIED',HOLD:'HOLD'});
const DAY_MS=86400000;
const DAYS_PER_YEAR=365.2425;
function freeze(v){if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.freeze(v);Object.values(v).forEach(freeze);}return v;}
function finite(v){return typeof v==='number'&&Number.isFinite(v);}
function parseDate(s){
 if(typeof s!=='string'||!/^(\d{4})-(\d{2})-(\d{2})$/.test(s))return null;
 const [y,m,d]=s.split('-').map(Number),dt=new Date(Date.UTC(y,m-1,d));
 if(dt.getUTCFullYear()!==y||dt.getUTCMonth()!==m-1||dt.getUTCDate()!==d)return null;
 return dt;
}
function normalizeCashflows(cashflows){
 if(!Array.isArray(cashflows)||cashflows.length<1)return null;
 const byDate=new Map();
 for(const c of cashflows){
  const d=parseDate(c&&c.date);
  if(!c||!d||!finite(c.amount))return null;
  byDate.set(c.date,(byDate.get(c.date)||0)+c.amount);
 }
 return [...byDate.entries()].map(([date,amount])=>({date,amount})).sort((a,b)=>parseDate(a.date)-parseDate(b.date));
}
function xnpv(rate,cashflows){
 if(!finite(rate)||rate<=-1)return NaN;
 const normalized=normalizeCashflows(cashflows);if(!normalized||!normalized.length)return NaN;
 const d0=parseDate(normalized[0].date);
 return normalized.reduce((sum,c)=>sum+c.amount/Math.pow(1+rate,(parseDate(c.date)-d0)/(DAYS_PER_YEAR*DAY_MS)),0);
}
function signChanges(cashflows){let last=0,changes=0;for(const c of cashflows){const s=Math.sign(c.amount);if(!s)continue;if(last&&s!==last)changes++;last=s;}return changes;}
function hold(blockers,extra={}){return freeze({version:DATED_RETURNS_VERSION,status:DATED_RETURNS_STATUS.HOLD,blockers,xirr:null,transactionAuthorized:false,humanDecisionRequired:true,...extra});}
function solveDatedXirr({cashflows,tolerance=1e-10,npvToleranceSar=null,maxIterations=300,lowerBound=-.9999,upperBound=100}={}){
 if(!Array.isArray(cashflows)||cashflows.length<2)return hold(['DATED_CASHFLOWS_REQUIRED']);
 const normalized=normalizeCashflows(cashflows);if(!normalized)return hold(['INVALID_DATED_CASHFLOW']);
 if(normalized.length<2)return hold(['DISTINCT_DATED_CASHFLOWS_REQUIRED']);
 if(!normalized.some(c=>c.amount<0)||!normalized.some(c=>c.amount>0))return hold(['CASHFLOW_SIGN_CHANGE_REQUIRED']);
 if(signChanges(normalized)>1)return hold(['MULTIPLE_IRR_AMBIGUITY'],{semantics:'Multiple net dated cash-flow sign changes can create multiple economically valid IRRs; no single XIRR is asserted.'});
 const cashflowScale=normalized.reduce((sum,c)=>sum+Math.abs(c.amount),0);
 const effectiveNpvTolerance=npvToleranceSar===null?Math.max(.01,cashflowScale*1e-10):npvToleranceSar;
 if(!finite(tolerance)||tolerance<=0||!finite(effectiveNpvTolerance)||effectiveNpvTolerance<=0||!Number.isInteger(maxIterations)||maxIterations<1||!finite(lowerBound)||!finite(upperBound)||lowerBound<=-1||upperBound<=lowerBound)return hold(['SOLVER_CONFIGURATION_INVALID']);
 let lo=lowerBound,hi=upperBound,flo=xnpv(lo,normalized),fhi=xnpv(hi,normalized);
 if(!finite(flo)||!finite(fhi))return hold(['XIRR_BRACKET_INVALID']);
 if(Math.abs(flo)<=effectiveNpvTolerance)return freeze({version:DATED_RETURNS_VERSION,status:DATED_RETURNS_STATUS.QUALIFIED,blockers:[],xirr:lo,residualNpvSar:flo,iterations:0,npvToleranceSar:effectiveNpvTolerance,dayCount:'ACT/365.2425',transactionAuthorized:false,humanDecisionRequired:true});
 if(Math.abs(fhi)<=effectiveNpvTolerance)return freeze({version:DATED_RETURNS_VERSION,status:DATED_RETURNS_STATUS.QUALIFIED,blockers:[],xirr:hi,residualNpvSar:fhi,iterations:0,npvToleranceSar:effectiveNpvTolerance,dayCount:'ACT/365.2425',transactionAuthorized:false,humanDecisionRequired:true});
 if(Math.sign(flo)===Math.sign(fhi))return hold(['XIRR_ROOT_NOT_BRACKETED']);
 let mid=null,fmid=null,i=0;
 for(;i<maxIterations;i++){
  mid=(lo+hi)/2;fmid=xnpv(mid,normalized);
  if(!finite(fmid))return hold(['XIRR_NUMERIC_FAILURE']);
  if(Math.abs(fmid)<=effectiveNpvTolerance)break;
  if(Math.abs(hi-lo)<=tolerance)break;
  if(Math.sign(fmid)===Math.sign(flo)){lo=mid;flo=fmid;}else{hi=mid;fhi=fmid;}
 }
 if(i>=maxIterations)return hold(['XIRR_DID_NOT_CONVERGE']);
 if(Math.abs(fmid)>effectiveNpvTolerance)return hold(['XIRR_RESIDUAL_NPV_TOO_LARGE'],{residualNpvSar:fmid,npvToleranceSar:effectiveNpvTolerance,iterations:i+1});
 return freeze({version:DATED_RETURNS_VERSION,status:DATED_RETURNS_STATUS.QUALIFIED,blockers:[],xirr:mid,residualNpvSar:fmid,npvToleranceSar:effectiveNpvTolerance,iterations:i+1,dayCount:'ACT/365.2425',normalizedCashflowCount:normalized.length,transactionAuthorized:false,humanDecisionRequired:true,semantics:'Dated XIRR is a mathematical return metric for aggregated same-date supplied cash flows under ACT/365.2425; it is not an investment approval, certified valuation, forecast, or transaction authority.'});
}
module.exports={DATED_RETURNS_VERSION,DATED_RETURNS_STATUS,normalizeCashflows,xnpv,solveDatedXirr};
