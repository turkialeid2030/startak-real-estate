'use strict';

const crypto = require('crypto');

const CAPABILITY = 'C50_INTERNAL_HUMAN_UAT_READINESS_V1';
const POLICY_VERSION = 'C50_UAT_HUMAN_APPROVAL_PREP_V1';
const GATE_ID = '549';
const EVIDENCE_ID = 'UAT_HUMAN_APPROVAL';
const STATUS = Object.freeze({
  READY_FOR_INDEPENDENT_HUMAN_UAT: 'READY_FOR_INDEPENDENT_HUMAN_UAT',
  READY_FOR_C30_GATE_INGESTION: 'READY_FOR_C30_GATE_INGESTION',
  HOLD_INTEGRITY: 'HOLD_INTEGRITY',
  HOLD_CONFIGURATION: 'HOLD_CONFIGURATION',
  HOLD_WINDOW: 'HOLD_WINDOW',
  HOLD_EXTERNAL_HUMAN_UAT: 'HOLD_EXTERNAL_HUMAN_UAT',
  REJECTED: 'REJECTED',
});
const EXTERNAL_STATUS = Object.freeze({ NOT_SUPPLIED: 'NOT_SUPPLIED', SUPPLIED_VERIFIED: 'SUPPLIED_VERIFIED', REJECTED: 'REJECTED' });
const HASH_RE = /^[a-f0-9]{64}$/i;
const COMMIT_RE = /^[a-f0-9]{40}$/i;
const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;
const clean = (v) => nonEmpty(v) ? v.trim() : '';
function stable(v) { if (Array.isArray(v)) return v.map(stable); if (!v || typeof v !== 'object') return v; return Object.keys(v).sort().reduce((o,k)=>{o[k]=stable(v[k]);return o;},{}); }
function sha256(v) { return crypto.createHash('sha256').update(JSON.stringify(stable(v))).digest('hex'); }
function frozen(v) { if (!v || typeof v !== 'object' || Object.isFrozen(v)) return v; Object.values(v).forEach(frozen); return Object.freeze(v); }
function iso(v, field) { if (!nonEmpty(v) || !Number.isFinite(Date.parse(v))) throw new TypeError(`${field} must be a valid date/time`); return new Date(v).toISOString(); }
function commit(v, field) { const x=clean(v).toLowerCase(); if (!COMMIT_RE.test(x)) throw new TypeError(`${field} must be a 40-character Git commit SHA`); return x; }
function hash(v, field) { const x=clean(v).toLowerCase(); if (!HASH_RE.test(x)) throw new TypeError(`${field} must be SHA-256`); return x; }
function without(v, field) { const o={...v}; delete o[field]; return o; }
function integrity(v, field) { return !!v && typeof v === 'object' && HASH_RE.test(clean(v[field])) && sha256(without(v, field)) === clean(v[field]).toLowerCase(); }

function createUatPlan(input={}) {
  const candidateHeadSha = commit(input.candidateHeadSha, 'candidateHeadSha');
  if (!nonEmpty(input.productScopeRef)) throw new TypeError('productScopeRef required');
  if (!Array.isArray(input.scenarios) || input.scenarios.length < 1) throw new TypeError('scenarios must be a non-empty array');
  const scenarios = input.scenarios.map((s) => {
    if (!s || !nonEmpty(s.scenarioId) || !nonEmpty(s.expectedOutcomeRef) || !nonEmpty(s.userRole)) throw new TypeError('C50_SCENARIO_FIELDS_REQUIRED');
    return { scenarioId: s.scenarioId.trim(), userRole: s.userRole.trim(), expectedOutcomeRef: s.expectedOutcomeRef.trim() };
  }).sort((a,b)=>a.scenarioId.localeCompare(b.scenarioId));
  if (new Set(scenarios.map(s=>s.scenarioId)).size !== scenarios.length) throw new TypeError('C50_DUPLICATE_SCENARIO_ID');
  const preparedAt = iso(input.preparedAt, 'preparedAt');
  const validUntil = iso(input.validUntil, 'validUntil');
  if (Date.parse(validUntil) < Date.parse(preparedAt)) throw new TypeError('C50_PLAN_VALIDITY_INVALID');
  const core={schemaVersion:1,candidateHeadSha,productScopeRef:input.productScopeRef.trim(),scenarios,preparedAt,validUntil,humanUatApproved:false,deploymentAuthorized:false,commercialGoLiveAuthorized:false};
  return frozen({...core,planHashSha256:sha256(core)});
}
function verifyUatPlan(v) { return integrity(v,'planHashSha256'); }

function createExternalUatRecord(input={}) {
  if (!Object.values(EXTERNAL_STATUS).includes(input.status)) throw new TypeError('C50_EXTERNAL_STATUS_INVALID');
  if (input.evidenceId !== EVIDENCE_ID) throw new TypeError('C50_EVIDENCE_ID_INVALID');
  const core={schemaVersion:1,evidenceId:EVIDENCE_ID,gateId:GATE_ID,candidateHeadSha:commit(input.candidateHeadSha,'candidateHeadSha'),status:input.status,evidenceRef:null,evidenceHashSha256:null,verifiedByRef:null,verifiedAt:null,validUntil:null,reviewers:[],scenarioResults:[],materialDefectsDispositionRef:null,usabilityWorkflowIssuesRef:null,signOffRef:null,unresolvedBlocker:false,reasonCode:null,engineeringSelfTestIsHumanUat:false};
  if (input.status === EXTERNAL_STATUS.NOT_SUPPLIED) {
    if (['evidenceRef','evidenceHashSha256','verifiedByRef','verifiedAt','signOffRef'].some(f=>input[f])) throw new TypeError('C50_NOT_SUPPLIED_MUST_NOT_CARRY_SYNTHETIC_UAT_EVIDENCE');
    if (!nonEmpty(input.reasonCode)) throw new TypeError('C50_NOT_SUPPLIED_REASON_REQUIRED');
    core.reasonCode=input.reasonCode.trim();
  } else {
    for (const f of ['evidenceRef','verifiedByRef','verifiedAt','materialDefectsDispositionRef','usabilityWorkflowIssuesRef','signOffRef']) if (!nonEmpty(input[f])) throw new TypeError(`C50_${f}_REQUIRED`);
    if (!Array.isArray(input.reviewers) || input.reviewers.length < 1 || input.reviewers.some(r=>!nonEmpty(r.nameRef)||!nonEmpty(r.role))) throw new TypeError('C50_NAMED_REVIEWERS_REQUIRED');
    if (!Array.isArray(input.scenarioResults) || input.scenarioResults.length < 1) throw new TypeError('C50_SCENARIO_RESULTS_REQUIRED');
    const scenarioResults=input.scenarioResults.map(r=>{
      if (!r || !nonEmpty(r.scenarioId) || !nonEmpty(r.actualObservationRef) || typeof r.passed !== 'boolean') throw new TypeError('C50_SCENARIO_RESULT_FIELDS_REQUIRED');
      return {scenarioId:r.scenarioId.trim(),actualObservationRef:r.actualObservationRef.trim(),passed:r.passed};
    }).sort((a,b)=>a.scenarioId.localeCompare(b.scenarioId));
    if (new Set(scenarioResults.map(r=>r.scenarioId)).size!==scenarioResults.length) throw new TypeError('C50_DUPLICATE_SCENARIO_RESULT');
    core.evidenceRef=input.evidenceRef.trim(); core.evidenceHashSha256=hash(input.evidenceHashSha256,'evidenceHashSha256'); core.verifiedByRef=input.verifiedByRef.trim(); core.verifiedAt=iso(input.verifiedAt,'verifiedAt'); core.validUntil=input.validUntil?iso(input.validUntil,'validUntil'):null;
    if (core.validUntil && Date.parse(core.validUntil)<Date.parse(core.verifiedAt)) throw new TypeError('C50_EXTERNAL_VALIDITY_INVALID');
    core.reviewers=input.reviewers.map(r=>({nameRef:r.nameRef.trim(),role:r.role.trim()})); core.scenarioResults=scenarioResults; core.materialDefectsDispositionRef=input.materialDefectsDispositionRef.trim(); core.usabilityWorkflowIssuesRef=input.usabilityWorkflowIssuesRef.trim(); core.signOffRef=input.signOffRef.trim(); core.unresolvedBlocker=Boolean(input.unresolvedBlocker);
    if (input.status===EXTERNAL_STATUS.SUPPLIED_VERIFIED && core.unresolvedBlocker) throw new TypeError('C50_UNRESOLVED_BLOCKER_CANNOT_BE_APPROVED');
    if (input.status===EXTERNAL_STATUS.REJECTED) { if (!nonEmpty(input.reasonCode)) throw new TypeError('C50_REJECTION_REASON_REQUIRED'); core.reasonCode=input.reasonCode.trim(); }
  }
  return frozen({...core,recordHashSha256:sha256(core)});
}
function verifyExternalUatRecord(v) { return integrity(v,'recordHashSha256'); }

function evaluateInternalUatReadiness({uatPlan,asOf}={}) {
  const at=iso(asOf,'asOf'); const blockers=[];
  if (!verifyUatPlan(uatPlan)) blockers.push('C50_INTEGRITY_UAT_PLAN');
  else { if (Date.parse(uatPlan.preparedAt)>Date.parse(at)) blockers.push('C50_WINDOW_PLAN_FUTURE'); if (Date.parse(uatPlan.validUntil)<Date.parse(at)) blockers.push('C50_WINDOW_PLAN_EXPIRED'); if (uatPlan.humanUatApproved!==false) blockers.push('C50_CONFIGURATION_AUTHORITY_INJECTION'); }
  const unique=[...new Set(blockers)].sort();
  const status=unique.some(x=>x.startsWith('C50_INTEGRITY_'))?STATUS.HOLD_INTEGRITY:unique.some(x=>x.startsWith('C50_WINDOW_'))?STATUS.HOLD_WINDOW:unique.length?STATUS.HOLD_CONFIGURATION:STATUS.READY_FOR_INDEPENDENT_HUMAN_UAT;
  return frozen({capability:CAPABILITY,policyVersion:POLICY_VERSION,status,internalEngineeringReady:unique.length===0,blockers:unique,externalGateId:GATE_ID,humanUatApproved:false,deploymentAuthorized:false,commercialGoLiveAuthorized:false});
}

function evaluateExternalUatForGateIngestion({uatPlan,uatRecord,asOf}={}) {
  const at=iso(asOf,'asOf'); const internal=evaluateInternalUatReadiness({uatPlan,asOf:at}); const blockers=[...internal.blockers];
  if (!verifyExternalUatRecord(uatRecord)) blockers.push('C50_INTEGRITY_EXTERNAL_UAT_RECORD');
  else {
    if (uatRecord.candidateHeadSha!==uatPlan.candidateHeadSha) blockers.push('C50_EXTERNAL_BINDING_MISMATCH:candidateHeadSha');
    if (uatRecord.gateId!==GATE_ID || uatRecord.evidenceId!==EVIDENCE_ID) blockers.push('C50_EXTERNAL_WRONG_GATE');
    if (uatRecord.status===EXTERNAL_STATUS.NOT_SUPPLIED) blockers.push('C50_EXTERNAL_HUMAN_UAT_NOT_SUPPLIED');
    if (uatRecord.status===EXTERNAL_STATUS.REJECTED) blockers.push(`C50_EXTERNAL_HUMAN_UAT_REJECTED:${uatRecord.reasonCode||'UNSPECIFIED'}`);
    if (uatRecord.status===EXTERNAL_STATUS.SUPPLIED_VERIFIED) {
      const planned=uatPlan.scenarios.map(s=>s.scenarioId).sort(); const actual=uatRecord.scenarioResults.map(s=>s.scenarioId).sort();
      if (JSON.stringify(planned)!==JSON.stringify(actual)) blockers.push('C50_EXTERNAL_SCENARIO_COVERAGE_MISMATCH');
      if (uatRecord.scenarioResults.some(r=>!r.passed)) blockers.push('C50_EXTERNAL_SCENARIO_FAILURE_PRESENT');
      if (uatRecord.unresolvedBlocker) blockers.push('C50_EXTERNAL_UNRESOLVED_BLOCKER');
      if (Date.parse(uatRecord.verifiedAt)>Date.parse(at)) blockers.push('C50_EXTERNAL_UAT_FUTURE');
      if (uatRecord.validUntil && Date.parse(uatRecord.validUntil)<Date.parse(at)) blockers.push('C50_EXTERNAL_UAT_EXPIRED');
    }
  }
  const unique=[...new Set(blockers)].sort(); const rejected=unique.some(x=>x.startsWith('C50_EXTERNAL_HUMAN_UAT_REJECTED:')); const complete=unique.length===0 && uatRecord.status===EXTERNAL_STATUS.SUPPLIED_VERIFIED;
  return frozen({capability:CAPABILITY,policyVersion:POLICY_VERSION,status:rejected?STATUS.REJECTED:complete?STATUS.READY_FOR_C30_GATE_INGESTION:STATUS.HOLD_EXTERNAL_HUMAN_UAT,readyForC30GateIngestion:complete,blockers:unique,externalGateId:GATE_ID,independentAuthorityStillMustBeValidatedByC30:true,humanUatApproved:false,deploymentAuthorized:false,commercialGoLiveAuthorized:false});
}

module.exports=Object.freeze({CAPABILITY,POLICY_VERSION,GATE_ID,EVIDENCE_ID,STATUS,EXTERNAL_STATUS,createUatPlan,verifyUatPlan,createExternalUatRecord,verifyExternalUatRecord,evaluateInternalUatReadiness,evaluateExternalUatForGateIngestion});
