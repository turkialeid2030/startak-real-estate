'use strict';
const {sha256Hex}=require('../crypto/sha256');
const VERSION='LOCAL_REVIEW_JOURNAL_V1';
function invalid(code='LOCAL_RECORD_INVALID'){throw Object.assign(new Error(code),{code});}
function bounded(value,depth=0) {
 if(depth>20)invalid();
 if(value===null||typeof value==='boolean')return;
 if(typeof value==='number'){if(!Number.isFinite(value))invalid();return;}
 if(typeof value==='string'){if(value.length>32000)invalid();return;}
 if(Array.isArray(value)){if(value.length>5000)invalid();value.forEach(v=>bounded(v,depth+1));return;}
 if(typeof value!=='object')invalid();
 for(const [key,v] of Object.entries(value)){if(['__proto__','constructor','prototype'].includes(key))invalid();bounded(v,depth+1);}
}
function scopeString(value){return typeof value==='string'&&value.trim().length>0&&value.length<=160&&!/[\u0000-\u001f]/.test(value);}
function createLocalReviewJournal({caseId,projectId=null,kind,payload,recordedAt=new Date().toISOString()}){
 if(!scopeString(caseId)||(projectId!==null&&!scopeString(projectId))||!['EVIDENCE','ACTIONS'].includes(kind)||!Number.isFinite(Date.parse(recordedAt)))invalid();
 bounded(payload);const data={version:VERSION,caseId,projectId,kind,payload,recordedAt,
   provenance:'SELF_ASSERTED_LOCAL_RECORD_NOT_AUTHENTICATED',financialEngineEligible:false,transactionAuthorized:false};
 const encoded=JSON.stringify(data);if(encoded.length>2000000)invalid();
 return {...data,recordHashSha256:sha256Hex(encoded)};
}
function readLocalReviewJournal(text,{caseId,projectId=null,kind}={}){
 if(typeof text!=='string'||text.length>2000000)invalid();let record;try{record=JSON.parse(text);}catch{invalid();}
 if(!record||record.version!==VERSION||record.caseId!==caseId||record.projectId!==projectId||record.kind!==kind)invalid('LOCAL_RECORD_SCOPE_MISMATCH');
 const rebuilt=createLocalReviewJournal(record);
 if(rebuilt.recordHashSha256!==record.recordHashSha256||record.transactionAuthorized!==false||record.financialEngineEligible!==false||record.provenance!==rebuilt.provenance)invalid();
 return rebuilt;
}
function journalKey({caseId,projectId=null,kind}){return `review-journal:${sha256Hex(JSON.stringify([caseId,projectId,kind]))}`;}
module.exports={VERSION,createLocalReviewJournal,readLocalReviewJournal,journalKey};
