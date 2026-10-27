'use strict';
// Governance planning/coverage ledger only. It cannot authenticate real records
// or sign approvals. Existing external and institutional gates remain authoritative.
const REQUIRED_GAPS = Object.freeze(Array.from({length:14},(_,i)=>'G'+String(i+1).padStart(2,'0')));
const RESTRICTED = Object.freeze({
commercialGoLiveAuthorized:false,certifiedAppraisalIssuance:false,
productionAiAuthorized:false,autonomousTransactionAuthorized:false,
realCustomerDataAllowed:false
});
const REF=/^[A-Za-z0-9][A-Za-z0-9_./:@-]{11,511}$/;
const SHA=/^[a-f0-9]{64}$/;
const GIT_COMMIT_SHA=/^[a-f0-9]{40}$/;
const MAX_EVIDENCE_ENTRIES=128;
const MAX_EVIDENCE_INDEX_BYTES=65536;
const EXPECTED_WORKSTREAMS=Object.freeze(Array.from({length:12},(_,i)=>'Q'+String(i+1).padStart(2,'0')));
function isRecord(x){return !!x && typeof x==='object' && !Array.isArray(x);}
function validateProgram(program){
 const failures=[];
 if(!isRecord(program)||program.schemaVersion!==1||!/^STARTAK-QCR-\d{4}-\d{2}-\d{2}$/.test(program.programId||''))return ['INVALID_PROGRAM_HEADER'];
 if(!Number.isInteger(program.planningHorizonDays)||program.planningHorizonDays!==90)failures.push('INVALID_PLANNING_HORIZON');
 // Program-owner mandate is execution of evidence gathering; no unilateral
 // configuration edit may turn that mandate into commercial/professional GO.
 if(program.status!=='HOLD_NOT_AUTHORIZED')failures.push('PROGRAM_AUTHORITY_STATUS_INVALID');
 if(program.serviceBoundary?.personalResearchOnly!==true)failures.push('UNAUTHORIZED_SCOPE:personalResearchOnly');
 if(program.pilot?.commercialServicesEnabled!==false)failures.push('UNAUTHORIZED_SCOPE:commercialServicesEnabled');
 if(!GIT_COMMIT_SHA.test(program.basis?.productionBaselineSha||''))failures.push('BASELINE_SHA_REQUIRED');
 if(!Array.isArray(program.workstreams)||program.workstreams.length!==EXPECTED_WORKSTREAMS.length)return [...failures,'WORKSTREAM_CARDINALITY_INVALID'];
 const ids=new Set(), coverage=new Set(),evidenceKeys=new Set();
 for(const w of program.workstreams){
  if(!isRecord(w)||!/^Q\d{2}$/.test(w.id||'')||ids.has(w.id)){failures.push('WORKSTREAM_ID_INVALID_OR_DUPLICATE');continue;}
  ids.add(w.id);
  if(!['P0','P1'].includes(w.priority)||!Number.isInteger(w.targetDay)||w.targetDay<1||w.targetDay>90||w.executionMode!=='PARALLEL')failures.push('WORKSTREAM_SCHEDULE_INVALID:'+w.id);
  if(![w.responsibleRole,w.accountableRole,w.informedRole].every(v=>typeof v==='string'&&v.trim().length>0))
   failures.push('RACI_MISSING:'+w.id);
  // Names may be recorded only with a real appointment; the initial
  // execution ledger cannot silently promote an asserted person to an owner.
  if(w.assignedPerson!==null)failures.push('UNVERIFIED_ASSIGNMENT:'+w.id);
  if(!Array.isArray(w.evidenceRequired)||w.evidenceRequired.length===0)failures.push('EVIDENCE_SCHEMA_MISSING:'+w.id);
  else for(const e of w.evidenceRequired){
   if(typeof e!=='string'||!/^\w{3,80}$/.test(e)||evidenceKeys.has(w.id+':'+e))failures.push('EVIDENCE_ID_INVALID:'+w.id);
   evidenceKeys.add(w.id+':'+e);
  }
  if(!Array.isArray(w.relatedGapIds)||w.relatedGapIds.length===0)failures.push('GAP_MAPPING_MISSING:'+w.id);
  else for(const g of w.relatedGapIds){
   if(typeof g!=='string'||!/^(G(0[1-9]|1[0-4])|N[0-9]{2})$/.test(g))
    failures.push('UNKNOWN_GAP_CODE:'+w.id);
   else coverage.add(g);
  }
  if(w.approvedExternalEvidence!==false||w.closed!==false)failures.push('IMPLICIT_EXTERNAL_APPROVAL:'+w.id);
 }
 for(const g of REQUIRED_GAPS)if(!coverage.has(g))failures.push('GAP_NOT_COVERED:'+g);
 for(const id of EXPECTED_WORKSTREAMS)if(!ids.has(id))failures.push('WORKSTREAM_MISSING:'+id);
 for(const [field,expected] of Object.entries(RESTRICTED)){
  const group=field==='realCustomerDataAllowed'?program.pilot:program.serviceBoundary;
  if(group?.[field]!==expected)failures.push('UNAUTHORIZED_SCOPE:'+field);
 }
 if(program.financial?.approvedBudgetSar!==null||program.financial?.actualSpendSar!==null||
     program.financial?.pricingApproved!==false)
   failures.push('BUDGET_FABRICATION_OR_UNAUTHORIZED');
 return [...new Set(failures)];
}
function validReference(v){return typeof v==='string'&&REF.test(v)&&!/(token|secret|password|apikey|bearer)/i.test(v)&&!/[?&#]/.test(v);}
function assessQualificationProgram(program,submittedEvidence={}){
 const structuralErrors=validateProgram(program);
 if(structuralErrors.length)return Object.freeze({status:'INVALID_PROGRAM',errors:structuralErrors,commercialGoLiveAuthorized:false,transactionAuthorized:false});
 if(!isRecord(submittedEvidence))return Object.freeze({status:'INVALID_EVIDENCE_INDEX',errors:['EVIDENCE_INDEX_INVALID'],commercialGoLiveAuthorized:false,transactionAuthorized:false});
 // Never stringify unknown attacker-defined object keys into a public status,
 // nor parse unbounded owner evidence packs as trustworthy metadata.
 let size;
 try { size=Buffer.byteLength(JSON.stringify(submittedEvidence),'utf8'); }
 catch { return Object.freeze({status:'INVALID_EVIDENCE_INDEX',errors:['EVIDENCE_INDEX_NOT_SERIALIZABLE'],commercialGoLiveAuthorized:false,transactionAuthorized:false}); }
 const entries=Object.entries(submittedEvidence);
 if(entries.length>MAX_EVIDENCE_ENTRIES||size>MAX_EVIDENCE_INDEX_BYTES)
  return Object.freeze({status:'INVALID_EVIDENCE_INDEX',errors:['EVIDENCE_INDEX_BOUNDS_EXCEEDED'],commercialGoLiveAuthorized:false,transactionAuthorized:false});
 const records=Object.create(null), required=new Set();
 for(const w of program.workstreams)for(const id of w.evidenceRequired)required.add(w.id+':'+id);
 // The input may contain an accidental token as a JSON key. Never echo it.
 const ignoredCount=entries.filter(([k])=>!required.has(k)).length;
 let submitted=0;
 for(const k of required){
  const value=Object.hasOwn(submittedEvidence,k)?submittedEvidence[k]:null;
  // Self-attested fields (verified:true, reviewer:signed, etc.) are intentionally
  // never accepted as proof of external authenticity or authorization.
  const metadataValid=isRecord(value)&&validReference(value.artifactRef)&&SHA.test(value.sha256||'')&&
    /^\d{4}-\d{2}-\d{2}$/.test(value.observedDate||'')&&
    Number.isFinite(Date.parse(value.observedDate+'T00:00:00Z'))&&
    new Date(value.observedDate+'T00:00:00Z').toISOString().slice(0,10)===value.observedDate;
  if(metadataValid)submitted++;
  records[k]=metadataValid?'SUBMITTED_UNVERIFIED':'MISSING_OR_INVALID';
 }
 const workstreams=program.workstreams.map(w=>{
  const keys=w.evidenceRequired.map(id=>w.id+':'+id);
  const provided=keys.filter(k=>records[k]==='SUBMITTED_UNVERIFIED').length;
  return Object.freeze({id:w.id,priority:w.priority,targetDay:w.targetDay,ownerRole:w.responsibleRole,
   assignedPerson:w.assignedPerson||null,required:keys.length,submitted:provided,remaining:keys.length-provided,
   status:provided===keys.length?'EXTERNAL_INDEPENDENT_REVIEW_REQUIRED':'HOLD_EVIDENCE_INCOMPLETE',
   closed:false});
 });
 const missing=Object.entries(records).filter(([,v])=>v!=='SUBMITTED_UNVERIFIED').map(([k])=>k);
 return Object.freeze({
  programId:program.programId,technicalPlanningRegistryValid:true,
  status:'HOLD_NOT_AUTHORIZED',releaseGate:'NO_COMMERCIAL_GO_LIVE',
  scope:'PERSONAL_RESEARCH_ONLY',
  counts:{workstreams:workstreams.length,evidenceItems:required.size,metadataSubmitted:submitted,
   missingOrInvalid:missing.length,workstreamsClosed:0,independentlyAuthenticatedEvidence:0},
  unmappedEvidenceCount:ignoredCount,missingEvidenceIds:missing,workstreams,
  evidenceAuthenticityVerified:false,independentReviewCompleted:false,
  licensedAppraisalAuthorized:false,commercialGoLiveAuthorized:false,productionAiAuthorized:false,
  realCustomerDataAllowed:false,transactionAuthorized:false,
  note:'Submitted names/hashes are only operator-provided metadata; never cryptographic, licensing, professional, legal, or market-source proof. Existing gated production/go-live systems remain authoritative.'
 });
}
module.exports={REQUIRED_GAPS,EXPECTED_WORKSTREAMS,validateProgram,assessQualificationProgram};
