'use strict';

const crypto=require('crypto');

const RESULT=Object.freeze({PASS:'PASS',FAIL:'FAIL',NOT_EVALUATED:'NOT_EVALUATED'});
const STATUS=Object.freeze({
  TECHNICALLY_QUALIFIED:'TECHNICALLY_QUALIFIED',
  TECHNICALLY_QUALIFIED_EXTERNAL_ITEMS_OPEN:'TECHNICALLY_QUALIFIED_EXTERNAL_ITEMS_OPEN',
  HOLD_FAILURE:'HOLD_FAILURE',
  HOLD_EVIDENCE:'HOLD_EVIDENCE',
  HOLD_INTEGRITY:'HOLD_INTEGRITY',
});
const TECHNICAL_GATE=Object.freeze({
  FULL_REGRESSION:'FULL_REGRESSION',PRODUCTION_BUILD:'PRODUCTION_BUILD',PACKAGE_VERIFICATION:'PACKAGE_VERIFICATION',
  NPM_AUDIT_RELEASE_THRESHOLD:'NPM_AUDIT_RELEASE_THRESHOLD',CANONICAL_BASELINE_REGISTRY:'CANONICAL_BASELINE_REGISTRY',
  CANONICAL_RELEASE_VERIFY:'CANONICAL_RELEASE_VERIFY',AI_GROUNDING:'C23_AI_GROUNDING',CASE_ORCHESTRATION:'C24_CASE_ORCHESTRATION',
  SOURCE_READINESS:'C25_SOURCE_READINESS',RBAC:'C26_RBAC',OBSERVABILITY:'C27_OBSERVABILITY',
});
const EXTERNAL_GATE=Object.freeze({
  COMPOSITE_BASELINE_SHADOW:'COMPOSITE_BASELINE_SHADOW',FRESH_COMPOSITE_SHADOW:'FRESH_COMPOSITE_SHADOW',
  SUCCESSOR_FRESH_COMPOSITE_SHADOW:'SUCCESSOR_FRESH_COMPOSITE_SHADOW',CUTOVER_SAFETY:'CUTOVER_SAFETY',
  CANONICAL_EXTERNAL_SOURCE_HASH:'CANONICAL_EXTERNAL_SOURCE_HASH',SECURITY_PRIVACY_APPROVAL:'SECURITY_PRIVACY_APPROVAL',
  LIVE_AI_PROVIDER_AUTHORIZATION:'LIVE_AI_PROVIDER_AUTHORIZATION',UAT_PROFESSIONAL_REVIEW:'UAT_PROFESSIONAL_REVIEW',
});
const SHA256=/^[a-f0-9]{64}$/;
const GIT_SHA=/^[a-f0-9]{40}$/;
function canon(v){if(Array.isArray(v))return v.map(canon);if(v&&typeof v==='object')return Object.keys(v).sort().reduce((o,k)=>{o[k]=canon(v[k]);return o;},{});return v;}
function hash(v){return crypto.createHash('sha256').update(JSON.stringify(canon(v))).digest('hex');}
function text(v,c){if(typeof v!=='string'||!v.trim())throw new Error(c);return v;}
function sha256(v,c){if(typeof v!=='string'||!SHA256.test(v))throw new Error(c);return v;}
function gitSha(v,c){if(typeof v!=='string'||!GIT_SHA.test(v))throw new Error(c);return v;}
function iso(v,c){text(v,c);if(Number.isNaN(Date.parse(v)))throw new Error(c);return v;}

function checkMaterial(i){return {checkId:i.checkId,gate:i.gate,gateClass:i.gateClass,result:i.result,candidateHeadSha:i.candidateHeadSha,evidenceRef:i.evidenceRef||null,evidenceHashSha256:i.evidenceHashSha256||null,observedAt:i.observedAt||null,reasonCode:i.reasonCode||null};}
function createQualificationCheck(input){
  if(!input||typeof input!=='object')throw new Error('C28_CHECK_REQUIRED');
  const technical=Object.values(TECHNICAL_GATE).includes(input.gate), external=Object.values(EXTERNAL_GATE).includes(input.gate);
  if(!technical&&!external)throw new Error('C28_GATE_UNKNOWN');
  if(!Object.values(RESULT).includes(input.result))throw new Error('C28_RESULT_UNKNOWN');
  if(technical&&input.result===RESULT.NOT_EVALUATED)throw new Error('C28_TECHNICAL_GATE_CANNOT_BE_NOT_EVALUATED');
  const material=checkMaterial({
    checkId:text(input.checkId,'C28_CHECK_ID_REQUIRED'),gate:input.gate,gateClass:technical?'TECHNICAL':'EXTERNAL',result:input.result,
    candidateHeadSha:gitSha(input.candidateHeadSha,'C28_CANDIDATE_HEAD_INVALID'),
    evidenceRef:input.evidenceRef||null,evidenceHashSha256:input.evidenceHashSha256||null,observedAt:input.observedAt||null,reasonCode:input.reasonCode||null,
  });
  if(input.result===RESULT.NOT_EVALUATED){
    if(!material.reasonCode)throw new Error('C28_NOT_EVALUATED_REASON_REQUIRED');
    if(material.evidenceRef||material.evidenceHashSha256||material.observedAt)throw new Error('C28_NOT_EVALUATED_MUST_NOT_FABRICATE_EVIDENCE');
  }else{
    text(material.evidenceRef,'C28_EVIDENCE_REF_REQUIRED');sha256(material.evidenceHashSha256,'C28_EVIDENCE_HASH_INVALID');iso(material.observedAt,'C28_OBSERVED_AT_INVALID');
  }
  return Object.freeze({...material,checkHashSha256:hash(material)});
}
function verifyCheck(c){return !!c&&SHA256.test(c.checkHashSha256||'')&&hash(checkMaterial(c))===c.checkHashSha256;}

function evaluateIntegrationQualification({qualificationId,candidateHeadSha,checks,evaluatedAt}){
  text(qualificationId,'C28_QUALIFICATION_ID_REQUIRED');gitSha(candidateHeadSha,'C28_CANDIDATE_HEAD_INVALID');iso(evaluatedAt,'C28_EVALUATED_AT_INVALID');
  if(!Array.isArray(checks))throw new Error('C28_CHECKS_REQUIRED');
  const blockers=[]; const seen=new Set();
  for(const c of checks){
    if(!verifyCheck(c)){blockers.push('C28_INTEGRITY_CHECK_TAMPERED');continue;}
    if(c.candidateHeadSha!==candidateHeadSha)blockers.push(`C28_HEAD_MISMATCH:${c.gate}`);
    if(seen.has(c.gate))blockers.push(`C28_DUPLICATE_GATE:${c.gate}`); else seen.add(c.gate);
    if(c.observedAt&&Date.parse(c.observedAt)>Date.parse(evaluatedAt))blockers.push(`C28_FUTURE_EVIDENCE:${c.gate}`);
  }
  for(const gate of Object.values(TECHNICAL_GATE))if(!seen.has(gate))blockers.push(`C28_MISSING_TECHNICAL_GATE:${gate}`);
  if(blockers.some(b=>b.startsWith('C28_INTEGRITY')||b.startsWith('C28_HEAD_MISMATCH')||b.startsWith('C28_DUPLICATE')||b.startsWith('C28_FUTURE')))return finalize(STATUS.HOLD_INTEGRITY,blockers,checks,candidateHeadSha,evaluatedAt);
  if(blockers.some(b=>b.startsWith('C28_MISSING_TECHNICAL_GATE')))return finalize(STATUS.HOLD_EVIDENCE,blockers,checks,candidateHeadSha,evaluatedAt);
  const failures=checks.filter(c=>c.result===RESULT.FAIL).map(c=>`C28_GATE_FAILED:${c.gate}`);
  if(failures.length)return finalize(STATUS.HOLD_FAILURE,failures,checks,candidateHeadSha,evaluatedAt);
  const externalOpen=Object.values(EXTERNAL_GATE).filter(g=>!seen.has(g)||checks.some(c=>c.gate===g&&c.result===RESULT.NOT_EVALUATED));
  const status=externalOpen.length?STATUS.TECHNICALLY_QUALIFIED_EXTERNAL_ITEMS_OPEN:STATUS.TECHNICALLY_QUALIFIED;
  return finalize(status,externalOpen.map(g=>`C28_EXTERNAL_NOT_EVALUATED:${g}`),checks,candidateHeadSha,evaluatedAt);
}
function finalize(status,blockers,checks,candidateHeadSha,evaluatedAt){
  const material={status,candidateHeadSha,evaluatedAt,blockers:[...new Set(blockers)].sort(),checkHashesSha256:checks.map(c=>c.checkHashSha256).filter(Boolean).sort()};
  return Object.freeze({...material,technicalQualificationReached:status===STATUS.TECHNICALLY_QUALIFIED||status===STATUS.TECHNICALLY_QUALIFIED_EXTERNAL_ITEMS_OPEN,productionAuthorized:false,transactionAuthorized:false,approvalAuthorized:false,publicAiAuthorized:false,canonicalBaselineActivationAuthorized:false,commercialGoLive:'HOLD',resultHashSha256:hash(material)});
}

module.exports={RESULT,STATUS,TECHNICAL_GATE,EXTERNAL_GATE,createQualificationCheck,evaluateIntegrationQualification};
