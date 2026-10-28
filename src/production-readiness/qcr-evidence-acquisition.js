'use strict';
// Operational request pack derived from the existing QCR board, not a new approval gate.
const {board} = require('./qualification-execution-board');

function makeAcquisitionPack(program,registry,{asOf='2026-10-28'}={}){
 const status=board(program,registry,{asOf});
 if(status.status!=='HOLD_NOT_AUTHORIZED'||!Array.isArray(status.rows))
  return Object.freeze({status:'INVALID_QCR_INPUT',errors:status.errors||['QCR_BOARD_NOT_VALID'],
    requests:[],commercialGoLiveAuthorized:false,independentApprovalCount:0});
 const mapping=new Map(status.rows.map(r=>[r.id,r]));
 const requests=[];
 for(const stream of program.workstreams){
  const row=mapping.get(stream.id);
  if(!row||!Array.isArray(stream.evidenceRequired))return Object.freeze({
   status:'INVALID_QCR_INPUT',errors:['QCR_WORKSTREAM_UNMAPPED'],
   requests:[],commercialGoLiveAuthorized:false,independentApprovalCount:0});
  for(const evidenceType of stream.evidenceRequired){
   requests.push(Object.freeze({
    requestId:stream.id+':'+evidenceType,
    streamId:stream.id,issueUrl:row.issueUrl,priority:stream.priority,
    evidenceType,requestedFromRole:stream.responsibleRole,
    accountableRole:stream.accountableRole,
    independentReviewerRole:'مراجع مستقل مؤهل يثبت اختصاصه واستقلاله',
    targetReviewDate:row.targetDate,
    acceptanceCriteriaAr:stream.acceptanceAr,
    relatedGapIds:Object.freeze([...(stream.relatedGapIds||[])]),
    requestTextAr:'يرجى توفير الدليل الأصلي المصرح باستخدامه للمتطلب '+evidenceType+
      ' ضمن '+stream.id+' ('+stream.titleAr+'). نطاق القبول: '+stream.acceptanceAr+
      '. يلزم بيان المصدر وحقوق الاستخدام وتاريخ السريان ونطاق العقار/الخدمة، '+
      'مع مراجعة وتوقيع مستقلين حيث ينطبق ذلك. لا تُرسل الملفات السرية إلى GitHub العام.',
    requestSent:false,externalEvidenceReceived:false,
    sourceRightsVerified:false,independentlyAuthenticated:false,
    independentlyApproved:false,approvalRecorded:false,
    status:'REQUEST_PREPARED_NOT_SENT',
    actualPersonAssigned:false,
    artifactSha256:null,protectedEvidenceLocation:null
   }));
  }
 }
 if(requests.length!==status.totals.requiredEvidence||
    new Set(requests.map(r=>r.requestId)).size!==requests.length)
   return Object.freeze({status:'INVALID_QCR_INPUT',errors:['EVIDENCE_REQUEST_CARDINALITY'],
     requests:[],commercialGoLiveAuthorized:false,independentApprovalCount:0});
 return Object.freeze({
  schemaVersion:1,programId:status.programId,asOf:status.asOf,
  status:'REQUEST_PACK_READY_NOT_SENT',operatingDecision:'HOLD_NOT_AUTHORIZED',
  requestCount:requests.length,streamCount:status.totals.streams,
  pendingIndependentEvidence:status.totals.requiredEvidence,
  independentlyApprovedCount:0,requests:Object.freeze(requests),
  safety:'Request preparation is not actual communication, receipt, source authentication, reviewer assignment or human signoff. Never put deeds, customer data, contracts, signing material or secrets in a public repo.',
  releaseAuthorized:false,commercialGoLiveAuthorized:false,
  professionalAppraisalAuthorized:false,productionAiAuthorized:false,
  transactionAuthorized:false
 });
}
module.exports={makeAcquisitionPack};
