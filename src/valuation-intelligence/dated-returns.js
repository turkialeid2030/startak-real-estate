'use strict';
const DATED_RETURNS_VERSION='DATED_RETURNS_V1';
const DATED_RETURNS_STATUS=Object.freeze({QUALIFIED:'QUALIFIED',HOLD:'HOLD'});
function freeze(v){if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.freeze(v);Object.values(v).forEach(freeze);}return v;}
function finite(v){return typeof v==='number'&&Number.isFinite(v);}
function parseDate(s){const d=new Date(`${s}T00:00:00Z`);return Number.isFinite(d.getTime())?d:null;}
function xnpv(rate,cashflows){if(!finite(rate)||rate<=-1)return NaN;const d0=parseDate(cashflows[0].date);return cashflows.reduce((sum,c)=>sum+c.amount/Math.pow(1+rate,(parseDate(c.date)-d0)/(365.2425*86400000)),0);}
function solveDatedXirr({cashflows,tolerance=1e-9,maxIterations=300,lowerBound=-.9999,upperBound=100}={}){
 if(!Array.isArray(cashflows)||cashflows.length<2)return freeze({version:DATED_RETURNS_VERSION,status:DATED_RETURNS_STATUS.HOLD,blockers:['DATED_CASHFLOWS_REQUIRED'],xirr:null});
 const normalized=[];for(const c of cashflows){const d=parseDate(c&&c.date);if(!c||!d||!finite(c.amount))return freeze({version:DATED_RETURNS_VERSION,status:DATED_RETURNS_STATUS.HOLD,blockers:['INVALID_DATED_CASHFLOW'],xirr:null});normalized.push({date:c.date,amount:c.amount});}
 normalized.sort((a,b)=>parseDate(a.date)-parseDate(b.date));if(!normalized.some(c=>c.amount<0)||!normalized.some(c=>c.amount>0))return freeze({version:DATED_RETURNS_VERSION,status:DATED_RETURNS_STATUS.HOLD,blockers:['CASHFLOW_SIGN_CHANGE_REQUIRED'],xirr:null});
 if(!finite(tolerance)||tolerance<=0||!Number.isInteger(maxIterations)||maxIterations<1)return freeze({version:DATED_RETURNS_VERSION,status:DATED_RETURNS_STATUS.HOLD,blockers:['SOLVER_CONFIGURATION_INVALID'],xirr:null});
 let lo=lowerBound,hi=upperBound,flo=xnpv(lo,normalized),fhi=xnpv(hi,normalized);if(!finite(flo)||!finite(fhi)||flo===0||fhi===0){const exact=flo===0?lo:fhi===0?hi:null;return exact===null?freeze({version:DATED_RETURNS_VERSION,status:DATED_RETURNS_STATUS.HOLD,blockers:['XIRR_BRACKET_INVALID'],xirr:null}):freeze({version:DATED_RETURNS_VERSION,status:DATED_RETURNS_STATUS.QUALIFIED,blockers:[],xirr:exact,residualNpvSar:0,iterations:0});}
 if(Math.sign(flo)===Math.sign(fhi))return freeze({version:DATED_RETURNS_VERSION,status:DATED_RETURNS_STATUS.HOLD,blockers:['XIRR_ROOT_NOT_BRACKETED'],xirr:null});
 let mid=null,fmid=null,i=0;for(;i<maxIterations;i++){mid=(lo+hi)/2;fmid=xnpv(mid,normalized);if(!finite(fmid))return freeze({version:DATED_RETURNS_VERSION,status:DATED_RETURNS_STATUS.HOLD,blockers:['XIRR_NUMERIC_FAILURE'],xirr:null});if(Math.abs(fmid)<=tolerance||Math.abs(hi-lo)<=tolerance)break;if(Math.sign(fmid)===Math.sign(flo)){lo=mid;flo=fmid;}else{hi=mid;fhi=fmid;}}
 if(i>=maxIterations)return freeze({version:DATED_RETURNS_VERSION,status:DATED_RETURNS_STATUS.HOLD,blockers:['XIRR_DID_NOT_CONVERGE'],xirr:null});
 return freeze({version:DATED_RETURNS_VERSION,status:DATED_RETURNS_STATUS.QUALIFIED,blockers:[],xirr:mid,residualNpvSar:fmid,iterations:i+1,dayCount:'ACT/365.2425',semantics:'Dated XIRR is a mathematical return metric for the supplied cash flows; it is not an investment approval or forecast.'});
}
module.exports={DATED_RETURNS_VERSION,DATED_RETURNS_STATUS,xnpv,solveDatedXirr};
