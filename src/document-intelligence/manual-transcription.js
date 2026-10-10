'use strict';
const {createParsedAtom,createParserResult,PARSER_STATUS,PARSED_ATOM_KIND}=require('./parsers/contracts');
function createManualTranscription({intakeRecord,text,page,reviewerRef,note,capturedAt}) {
  const reject=()=>{throw Object.assign(new Error('LOCAL_RECORD_INVALID'),{code:'LOCAL_RECORD_INVALID'});};
  if(!intakeRecord||!/^[a-f0-9]{64}$/i.test(intakeRecord.digest||'')||!intakeRecord.documentId||!intakeRecord.caseId
    ||typeof text!=='string'||!text.trim()||text.length>32000||!Number.isInteger(page)||page<1||page>200
    ||typeof reviewerRef!=='string'||!reviewerRef.trim()||reviewerRef.length>160||typeof note!=='string'||!note.trim()||note.length>2000
    ||!Number.isFinite(Date.parse(capturedAt)))reject();
  const document={documentId:intakeRecord.documentId,caseId:intakeRecord.caseId};
  const atom=createParsedAtom({atomId:`${document.documentId}:manual:${page}`,document,
    adapterId:'MANUAL_TRANSCRIPTION_V1',kind:PARSED_ATOM_KIND.TEXT,rawValue:text,valueType:'STRING',
    location:{kind:'PAGE',page},metadata:{reviewerRef,note,capturedAt,sourceDigest:intakeRecord.digest,independentlyVerified:false}});
  const result=createParserResult({document,adapterId:'MANUAL_TRANSCRIPTION_V1',format:intakeRecord.result.format,
    status:PARSER_STATUS.PARSED,atoms:[atom],warnings:['MANUAL_TRANSCRIPTION_UNVERIFIED']});
  return Object.freeze({...intakeRecord,result,originalParserOutcome:intakeRecord.originalParserOutcome||{status:intakeRecord.result.status,reason:intakeRecord.result.reason},manualTranscription:true});
}
module.exports={createManualTranscription};
