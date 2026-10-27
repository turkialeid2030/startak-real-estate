'use strict';
const {validateProgram, assessQualificationProgram}=require('./qualification-program-gate');
const ID=/^Q(?:0[1-9]|1[0-2])$/;
const YYYYMMDD=/^\d{4}-\d{2}-\d{2}$/;
function parseDay(value){
 if(typeof value!=='string'||!YYYYMMDD.test(value))return null;
 const ms=Date.parse(value+'T00:00:00.000Z');
 if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,10)!==value)return null;
 return ms;
}
function board(program,registry,{asOf=program?.preparedAt,evidence={}}={}){
 const errors=validateProgram(program);
 if(errors.length)return {status:'INVALID_PROGRAM',errors,commercialGoLiveAuthorized:false};
 if(!registry||registry.schemaVersion!==1||registry.programId!==program.programId||
   registry.parentIssue!==747||!Array.isArray(registry.mapping)||
   registry.mapping.length!==program.workstreams.length)return {status:'INVALID_ISSUE_REGISTRY',errors:['ISSUE_REGISTRY_INVALID'],commercialGoLiveAuthorized:false};
 const pairs=new Map();
 for(const r of registry.mapping){
  if(!r||!ID.test(r.id||'')||pairs.has(r.id)||!Number.isInteger(r.issue)||
    r.issue<1||r.url!==`https://github.com/turkialeid2030/startak-real-estate/issues/${r.issue}`||
    [...pairs.values()].some(x=>x.issue===r.issue))
    return {status:'INVALID_ISSUE_REGISTRY',errors:['ISSUE_REGISTRY_INVALID'],commercialGoLiveAuthorized:false};
  pairs.set(r.id,r);
 }
 if(!program.workstreams.every(w=>pairs.has(w.id)))
  return {status:'INVALID_ISSUE_REGISTRY',errors:['ISSUE_REGISTRY_MISSING_STREAM'],commercialGoLiveAuthorized:false};
 const now=parseDay(asOf),start=parseDay(program.preparedAt);
 if(now===null||start===null)return {status:'INVALID_REPORT_DATE',errors:['AS_OF_DATE_INVALID'],commercialGoLiveAuthorized:false};
 const state=assessQualificationProgram(program,evidence);
 if(!state.technicalPlanningRegistryValid)
  return {status:'INVALID_EVIDENCE_INDEX',errors:state.errors,commercialGoLiveAuthorized:false};
 const evidenceById=new Map(state.workstreams.map(w=>[w.id,w]));
 const rows=program.workstreams.map(w=>{
  const dueDate=new Date(start+w.targetDay*86400000).toISOString().slice(0,10);
  const due=parseDay(dueDate),e=evidenceById.get(w.id),link=pairs.get(w.id);
  return {
    id:w.id,titleAr:w.titleAr,priority:w.priority,responsibleRole:w.responsibleRole,
    appointedPersonVerified:false,issueNumber:link.issue,issueUrl:link.url,
    targetDate:dueDate,daysUntilTarget:Math.round((due-now)/86400000),
    scheduleLabel:now>due?'TARGET_PASSED_NOT_EVIDENCE_OF_BREACH':now===due?'TARGET_TODAY':'TARGET_FUTURE',
    evidenceSlots:e.required,metadataSubmittedUnverified:e.submitted,
    independentlyVerified:0,closed:false,approvalStatus:'HOLD_EXTERNAL_EVIDENCE'
  };
 });
 return {
  programId:program.programId,asOf,reportType:'EXECUTION_ONLY_NOT_PROFESSIONAL_APPROVAL',
  status:'HOLD_NOT_AUTHORIZED',commercialGoLiveAuthorized:false,
  productionAiAuthorized:false,valuationAccreditationGranted:false,
  totals:{streams:rows.length,streamsClosed:0,streamsWithVerifiedSpecialistAppointment:0,
    requiredEvidence:rows.reduce((n,x)=>n+x.evidenceSlots,0),
    submittedUnverifiedMetadata:rows.reduce((n,x)=>n+x.metadataSubmittedUnverified,0),
    independentApprovals:0,
    targetDatePassed:rows.filter(r=>r.daysUntilTarget<0).length,
    targetDateToday:rows.filter(r=>r.daysUntilTarget===0).length},
  limitations:[
   'The issue tracker and its checkbox state are not independent proof.',
   'GitHub owner authorization is not a data provider license, signed appraisal, regulatory clearance or credential.',
   'Submitted evidence metadata and hashes are never authenticated by this reader.',
   'Timelines are planning targets only; expired dates are not automatic SLA breach or GO.'
  ],rows
 };
}
module.exports={board,parseDay};
