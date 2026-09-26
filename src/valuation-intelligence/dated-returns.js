'use strict';
const DATED_RETURNS_VERSION='DATED_RETURNS_V2';
const DATED_RETURNS_STATUS=Object.freeze({QUALIFIED:'QUALIFIED',HOLD:'HOLD'});
function freeze(v){if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.freeze(v);Object.values(v).forEach(freeze);}return v;}
function finite(v){return typeof v==='number'&&Number.isFinite(v);}
function parseDate(s){if(typeof s!=='string'||!/^(\d{4})-(\d{2})-(\d{2})$/.test(s))return null;const [y,m,d]=s.split('-').map(Number);const dt=new Date(Date.UTC(y,m-1,d));if(dt.getUTCFullYear()!==y||dt.getUTCMonth()!==m-1||dt.getUTCDate()!==d)return null;return dt;}
function normalizeCashflows(cashflows){if(!Array.isArray(cashflows)||cashflows.length<2)return null;const out=[];for(const c of cashflows){const d=parseDate(c&&c.date);if(!c||!d||!finite(c.amount))return null;out.push({date:c.date,amount:c.amount});}out.sort((a,b)=>parseDate(a.date)-parseDate(b.date));return out;}
function xnpv(rate,cashflows){if(!finite(rate)||rate<=-1)return NaN;const normalized=normalizeCashflows(cashflows);if(!normalized)return NaN;const d0=parseDate(normalized[0].date);return normalized.reduce((sum,c)=>sum+c.amount/Math.pow(1+rate,(parseDate(c.date)-d0)/(365.2425*86400000)),0);}
function signChanges(cashflows){let last=0,changes=0;for(const c of cashflows){const s=Math.sign(c.amount);if(!s)continue;if(last&&s!==last)changes++;last=s;}return changes;}
function solveDatedXirr({cashflows,tolerance=1e-9,maxIterations=300,lowerBound=-.9999,upperBound=100}={}){
 if(!Array.isArray(cashflows)||cashflows.length<2)return freeze({version:DATED_RETURNS_VERSION,status:DATED_RETURNS_STATUS.HOLD,blockers:['DATED_CASHFLOWS_REQUIRED'],xirr:null});
 const normalized=normalizeCashflows(cashflows);if(!normalized)return freeze({version:DATED_RETURNS_VERSION,status:DATED_RETURNS_STATUS.HOLD,blockers:['INVALID_DATED_CASHFLOW'],xirr:null});
 if(!normalized.some(c=>c.amount<0)||!normalized.some(c=>c.amount>0))return freeze({version:DATED_RETURNS_VERSION,status:DATED_RETURNS_STATUS.HOLD,blockers:['CASHFLOW_SIGN_CHANGE_REQUIRED'],xirr:null});
 if(signChanges(normalized)>1)return freeze({version:DATED_RETURNS_VERSION,status:DATED_RETURNS_STATUS.HOLD,blockers:['MULTIPLE_IRR_AMBIGUITY'],xirr:null,semantics:'Multiple cash-flow sign changes can create multiple economically valid IRRs; no single XIRR is asserted.'});
 if(!finite(tolerance)||tolerance<=0||!Number.isInteger(maxIterations)||maxIterations<1||!finite(lowerBound)||!finite(upperBound)||lowerBound<=-1||upperBound<=lowerBound)return freeze({version:DATED_RETURNS_VERSION,status:DATED_RETURNS_STATUS.HOLD,blockers:['SOLVER_CONFIGURATION_INVALID'],xirr:null});
 let lo=lowerBound,hi=upperBound,flo=xnpv(lo,normalized),fhi=xnpv(hi,normalized);if(!finite(flo)||!finite(fhi)||flo===0||fhi===0){const exact=flo===0?lo:fhi===0?hi:null;return exact===null?freeze({version:DATED_RETURNS_VERSION,status:DATED_RETURNS_STATUS.HOLD,blockers:['XIRR_BRACKET_INVALID'],xirr:null}):freeze({version:DATED_RETURNS_VERSION,status:DATED_RETURNS_STATUS.QUALIFIED,blockers:[],xirr:exact,residualNpvSar:0,iterations:0});}
 if(Math.sign(flo)===Math.sign(fhi))return freeze({version:DATED_RETURNS_VERSION,status:DATED_RETURNS_STATUS.HOLD,blockers:['XIRR_ROOT_NOT_BRACKETED'],xirr:null});
 let mid=null,fmid=null,i=0;for(;i<maxIterations;i++){mid=(lo+hi)/2;fmid=xnpv(mid,normalized);if(!finite(fmid))return freeze({version:DATED_RETURNS_VERSION,status:DATED_RETURNS_STATUS.HOLD,blockers:['XIRR_NUMERIC_FAILURE'],xirr:null});if(Math.abs(fmid)<=tolerance||Math.abs(hi-lo)<=tolerance)break;if(Math.sign(fmid)===Math.sign(flo)){lo=mid;flo=fmid;}else{hi=mid;fhi=fmid;}}
 if(i>=maxIterations)return freeze({version:DATED_RETURNS_VERSION,status:DATED_RETURNS_STATUS.HOLD,blockers:['XIRR_DID_NOT_CONVERGE'],xirr:null});
 return freeze({version:DATED_RETURNS_VERSION,status:DATED_RETURNS_STATUS.QUALIFIED,blockers:[],xirr:mid,residualNpvSar:fmid,iterations:i+1,dayCount:'ACT/365.2425',semantics:'Dated XIRR is a mathematical return metric for the supplied cash flows; it is not an investment approval or forecast.'});
}
module.exports={DATED_RETURNS_VERSION,DATED_RETURNS_STATUS,xnpv,solveDatedXirr};
