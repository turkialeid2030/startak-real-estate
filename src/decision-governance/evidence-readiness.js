'use strict';
const { EVIDENCE_READINESS }=require('./overall-decision-gate');
function daysBetween(a,b){const x=new Date(a),y=new Date(b);if(!Number.isFinite(x.getTime())||!Number.isFinite(y.getTime()))return null;return Math.max(0,Math.floor((y-x)/86400000));}
function evaluateEvidenceReadiness(input={}){
 const items=Array.isArray(input.items)?input.items:[]; const now=input.asOf||new Date().toISOString(); const required=items.filter(x=>x&&x.required);
 if(!items.length)return out(EVIDENCE_READINESS.NOT_STARTED,['NO_EVIDENCE']);
 const missing=required.filter(x=>!x.sourceName||!x.sourceDate||x.missing===true); if(missing.length)return out(EVIDENCE_READINESS.INSUFFICIENT,['MISSING_CRITICAL_EVIDENCE']);
 if(items.some(x=>x.conflicted===true))return out(EVIDENCE_READINESS.CONFLICTED,['CONFLICTING_EVIDENCE']);
 const stale=items.some(x=>{const age=daysBetween(x.sourceDate,now);return age==null||(Number.isFinite(x.maxAgeDays)&&age>x.maxAgeDays);}); if(stale)return out(EVIDENCE_READINESS.STALE,['STALE_OR_UNDATED_EVIDENCE']);
 const qualityOk=required.every(x=>['A','B','HIGH','VERIFIED'].includes(String(x.evidenceGrade||x.quality||'').toUpperCase()));
 const comparableOk=(input.comparableCount||0)>=(input.minimumComparableCount||0) && input.locationComparability!==false && input.assetTypeComparability!==false;
 if(qualityOk&&comparableOk)return out(EVIDENCE_READINESS.SUFFICIENT_FOR_IC,[]);
 if(required.length&&required.every(x=>x.sourceName&&x.sourceDate))return out(EVIDENCE_READINESS.SUFFICIENT_FOR_ANALYSIS,['NOT_SUFFICIENT_FOR_IC']);
 return out(EVIDENCE_READINESS.PARTIAL,['PARTIAL_EVIDENCE']);
}
function out(status,reasonCodes){return Object.freeze({status,reasonCodes:Object.freeze(reasonCodes)});}
module.exports={evaluateEvidenceReadiness,daysBetween};
