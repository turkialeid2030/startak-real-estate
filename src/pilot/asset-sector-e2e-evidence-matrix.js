'use strict';

const crypto = require('node:crypto');
const {ASSET_CLASS} = require('../project-model/project-profile');

const VERSION = 'C57_ASSET_CLASS_E2E_EVIDENCE_MATRIX_V1';
const STATUS = Object.freeze({
  HOLD: 'HOLD_MISSING_ACTUAL_E2E_EVIDENCE',
  READY_FOR_INDEPENDENT_REVIEW: 'READY_FOR_INDEPENDENT_REVIEW',
});
const JOURNEY_STEPS = Object.freeze([
  'INPUT_AND_DOCUMENT_INTAKE',
  'EVIDENCE_AND_DATE_VALIDATION',
  'ASSET_METHOD_ROUTING',
  'FINANCIAL_CALCULATION_AND_EDGE_CASES',
  'DECISION_HARD_GATES',
  'PERSISTENCE_AND_RELOAD',
  'AUDIT_TRAIL',
  'ARABIC_RTL_GOVERNED_REPORT',
  'REAL_HUMAN_UAT_SIGNOFF',
]);
const REQUIRED_SCENARIOS = Object.freeze([
  {id:'RESIDENTIAL_APARTMENT_VILLA',assetClass:ASSET_CLASS.RESIDENTIAL},
  {id:'OFFICE_COMMERCIAL_INCOME',assetClass:ASSET_CLASS.OFFICE},
  {id:'RETAIL_COMMERCIAL_INCOME',assetClass:ASSET_CLASS.RETAIL},
  {id:'VACANT_LAND_HBU',assetClass:ASSET_CLASS.LAND},
  {id:'LAND_DEVELOPMENT_RESIDUAL',assetClass:ASSET_CLASS.LAND},
  {id:'INDUSTRIAL_WAREHOUSE_FACTORY',assetClass:ASSET_CLASS.INDUSTRIAL_LOGISTICS},
  {id:'HOTEL_OPERATING_INTEREST',assetClass:ASSET_CLASS.HOSPITALITY},
  {id:'MIXED_USE_ALLOCATION',assetClass:ASSET_CLASS.MIXED_USE},
]);
const HASH = /^[a-f0-9]{64}$/i;
function present(v) { return typeof v === 'string' && v.trim().length > 0; }
function validTimestamp(v) { return present(v) && Number.isFinite(Date.parse(v)); }
function freeze(v) { if (v && typeof v === 'object' && !Object.isFrozen(v)) { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }
function digest(v) {return crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');}
/**
 * Intake evidence matrix, not a simulator or UI assertion. The engineering
 * result cannot become real-human-UAT approval, accredited valuation or launch.
 */
function assessAssetSectorE2ECoverage({candidateHeadSha, records=[], asOf}={}) {
  const blockers=[];
  if (!/^[a-f0-9]{40}$/i.test(candidateHeadSha || '')) blockers.push('EXACT_HEAD_SHA_REQUIRED');
  if (!validTimestamp(asOf)) blockers.push('AS_OF_TIMESTAMP_REQUIRED');
  if (!Array.isArray(records)) return freeze({
    version:VERSION,status:STATUS.HOLD,blockers:['RECORDS_NOT_AN_ARRAY'],
    realE2ECoverageEstablished:false,productionAuthorized:false,
  });
  const seenIds=new Set();
  const byScenario=[];
  for (const target of REQUIRED_SCENARIOS) {
    const matches=records.filter(r=>r && r.scenarioId===target.id);
    const gaps=[];
    if (matches.length!==1) gaps.push('SCENARIO_REQUIRES_EXACTLY_ONE_EVIDENCE_PACKET');
    if (matches.length===1) {
      const packet=matches[0];
      if (packet.assetClass!==target.assetClass) gaps.push('ASSET_CLASS_MISMATCH');
      if (packet.candidateHeadSha!==candidateHeadSha) gaps.push('CANDIDATE_SHA_MISMATCH');
      if (!present(packet.caseId) || seenIds.has(packet.caseId)) gaps.push('CASE_ID_MISSING_OR_REPEATED');
      if (present(packet.caseId)) seenIds.add(packet.caseId);
      if (packet.synthetic!==false || packet.testMode!=='LIVE_USER_OPERATED_REAL_BROWSER') gaps.push('NOT_AUTHENTIC_USER_EXECUTED_BROWSER_JOURNEY');
      if (!HASH.test(packet.evidencePackSha256||'')) gaps.push('EVIDENCE_ARTIFACT_HASH_REQUIRED');
      if (!present(packet.sourceRightsRef)) gaps.push('SOURCE_RIGHTS_EVIDENCE_REF_REQUIRED');
      if (!present(packet.independentReviewerRef) || !present(packet.humanUatApprovalRef)) gaps.push('INDEPENDENT_HUMAN_UAT_EVIDENCE_REQUIRED');
      if (!validTimestamp(packet.executedAt) || (validTimestamp(asOf) && Date.parse(packet.executedAt)>Date.parse(asOf))) gaps.push('EXECUTION_TIMESTAMP_INVALID');
      if (!Array.isArray(packet.steps)) gaps.push('E2E_STEPS_REQUIRED');
      else {
        const steps=new Map();
        for(const item of packet.steps) {
          if (!item || !JOURNEY_STEPS.includes(item.step) || steps.has(item.step)) {
            gaps.push('DUPLICATE_OR_UNKNOWN_JOURNEY_STEP');continue;
          }
          steps.set(item.step,item);
        }
        for(const name of JOURNEY_STEPS) {
          const step=steps.get(name);
          if (!step || step.status!=='PASS' || !HASH.test(step.artifactSha256||'') || !present(step.evidenceRef)) {
            gaps.push('MISSING_FAILED_OR_UNVERIFIABLE_STEP:'+name);
          }
        }
      }
      if (!Array.isArray(packet.negativeScenarios) || packet.negativeScenarios.length<2
        || packet.negativeScenarios.some(x=>!present(x.caseRef) || x.expectedGate!=='HOLD' || x.actualGate!=='HOLD' || !HASH.test(x.artifactSha256||''))) {
        gaps.push('NEGATIVE_AND_CONFLICT_CASE_EVIDENCE_REQUIRED');
      }
    }
    byScenario.push({scenarioId:target.id,assetClass:target.assetClass,status:gaps.length?'HOLD':'STRUCTURALLY_READY_FOR_REVIEW',gaps});
    blockers.push(...gaps.map(g=>target.id+':'+g));
  }
  if (records.some(r=>!r || !REQUIRED_SCENARIOS.some(s=>s.id===r.scenarioId))) blockers.push('UNRECOGNIZED_OR_EXTRA_SCENARIO');
  const ready=blockers.length===0;
  const core={
    version:VERSION,
    candidateHeadSha:candidateHeadSha||null,
    asOf:asOf||null,
    scenarioCount:REQUIRED_SCENARIOS.length,
    structurallyReadyCount:byScenario.filter(v=>v.status==='STRUCTURALLY_READY_FOR_REVIEW').length,
    byScenario,
    blockers,
    status:ready?STATUS.READY_FOR_INDEPENDENT_REVIEW:STATUS.HOLD,
    evidenceMatrixHashSha256:digest(byScenario),
    realE2ECoverageEstablished:false,
    independentlyValidatedHumanUatApprovalEstablished:false,
    certifiedValuationEstablished:false,
    transactionAuthorized:false,
    productionAuthorized:false,
    commercialGoLiveAuthorized:false,
    semantics:'All record attributes are structural declarations that must be authenticated independently. Even full coverage means ready for independent review, never proven live UAT or permission for commercial deployment.',
  };
  return freeze(core);
}
module.exports={VERSION,STATUS,JOURNEY_STEPS,REQUIRED_SCENARIOS,assessAssetSectorE2ECoverage};
