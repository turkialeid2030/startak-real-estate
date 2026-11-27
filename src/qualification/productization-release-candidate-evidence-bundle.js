'use strict';

const crypto = require('crypto');
const {strictCalendarDateMs} = require('../validation/strict-calendar-instant');
const {
  PRODUCTION_QUALIFICATION_STATUS,
} = require('../runtime/production-qualification-service');
const {
  SECURITY_UAT_STATUS,
  verifyCompletedSecurityUatBundle,
} = require('./independent-security-uat-evidence-gate');

const RELEASE_CANDIDATE_STATUS = Object.freeze({
  READY_FOR_EXISTING_RELEASE_GOVERNANCE_REVIEW: 'READY_FOR_EXISTING_RELEASE_GOVERNANCE_REVIEW',
  HOLD_PRODUCTION_QUALIFICATION: 'HOLD_PRODUCTION_QUALIFICATION',
  HOLD_SECURITY_UAT_EVIDENCE: 'HOLD_SECURITY_UAT_EVIDENCE',
  HOLD_SCOPE_MISMATCH: 'HOLD_SCOPE_MISMATCH',
  HOLD_EXTERNAL_BLOCKER_REGISTER: 'HOLD_EXTERNAL_BLOCKER_REGISTER',
  HOLD_REVIEW_GOVERNANCE: 'HOLD_REVIEW_GOVERNANCE',
});

const REQUIRED_OPEN_EXTERNAL_BLOCKERS = Object.freeze([
  'PRODUCTION_IDP_AND_SESSION_VALIDATION',
  'PRODUCTION_DATABASE_RLS_BACKUP_DR_VALIDATION',
  'PENTEST_UAT_ARTIFACT_AUTHENTICITY_AND_REVIEWER_CREDENTIALS',
  'INDEPENDENT_PRODUCTION_PERFORMANCE_RESILIENCE_VALIDATION',
  'PDPL_DATA_GOVERNANCE_AND_LEGAL_REVIEW',
  'SAUDI_PROFESSIONAL_LICENSING_AND_REPORTING_AUTHORITY',
  'CANONICAL_EXTERNAL_SOURCE_HASH_COMPARISON',
  'GIT_HISTORY_SECRET_SCAN_REMEDIATION_AND_ROTATION',
  'HUMAN_RELEASE_AUTHORITY_APPROVAL',
  'MERGE_DEPLOY_GO_LIVE_AUTHORIZATION',
]);

const AUTHORITY = Object.freeze({
  releaseAuthorized: false,
  mergeAuthorized: false,
  deploymentAuthorized: false,
  goLiveAuthorized: false,
  transactionAuthorized: false,
  productionAuthenticationValidated: false,
  productionPersistenceValidated: false,
  productionSecurityValidated: false,
  productionPerformanceValidated: false,
  productionResilienceValidated: false,
  legalApprovalEstablished: false,
  pdplComplianceEstablished: false,
  certifiedValuationEstablished: false,
});

const COMMIT_SHA_RE = /^[a-f0-9]{40}$/i;

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function requiredCommitSha(value, field = 'exactCommitSha') {
  const normalized = requiredString(value, field).toLowerCase();
  if (!COMMIT_SHA_RE.test(normalized)) throw new TypeError(`${field} must be a 40-character git commit SHA`);
  return normalized;
}

function requiredTimestamp(value, field) {
  const normalized = requiredString(value, field);
  const millis = strictCalendarDateMs(normalized);
  if (!Number.isFinite(millis)) throw new TypeError(`${field} must be an ISO-compatible timestamp`);
  return Object.freeze({ value: normalized, millis });
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freeze(child);
  return value;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    // Preserve all own JSON keys, including "__proto__", in the digest.
    return Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,canonicalize(value[key])]));
  }
  return value;
}

function sha256Object(value) {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value)), 'utf8').digest('hex');
}

function normalizeEnvironment(value) {
  const normalized = requiredString(value, 'environment').toLowerCase();
  if (normalized !== 'staging') throw new TypeError('environment must be staging');
  return normalized;
}

function normalizeBlockers(value) {
  if (!Array.isArray(value)) throw new TypeError('openExternalBlockers must be an array');
  const normalized = value.map((item, index) => requiredString(item, `openExternalBlockers[${index}]`));
  if(normalized.some(item=>! /^[A-Z][A-Z0-9_]{0,127}$/.test(item)))throw new TypeError('openExternalBlockers must be bounded blocker identifiers');
  if (new Set(normalized).size !== normalized.length) throw new TypeError('openExternalBlockers must not contain duplicates');
  return Object.freeze([...normalized].sort());
}

function assertNoAuthorityOverride(value = {}) {
  const keys = [
    'releaseAuthorized',
    'mergeAuthorized',
    'deploymentAuthorized',
    'goLiveAuthorized',
    'transactionAuthorized',
    'productionAuthenticationValidated',
    'productionPersistenceValidated',
    'productionSecurityValidated',
    'productionPerformanceValidated',
    'productionResilienceValidated',
    'legalApprovalEstablished',
    'pdplComplianceEstablished',
    'certifiedValuationEstablished',
  ];
  if (keys.some((key) => Object.hasOwn(value,key)) || Object.hasOwn(value,'authority')) {
    const error = new Error('CALLER_RELEASE_CANDIDATE_AUTHORITY_OVERRIDE_NOT_ALLOWED');
    error.code = 'CALLER_RELEASE_CANDIDATE_AUTHORITY_OVERRIDE_NOT_ALLOWED';
    throw error;
  }
}

const P9_AUTHORITY_KEYS=Object.freeze([
  'releaseAuthorized','mergeAuthorized','deploymentAuthorized','goLiveAuthorized','transactionAuthorized',
  'productionAuthenticationValidated','productionPersistenceValidated','productionSecurityValidated',
  'productionPerformanceValidated','legalApprovalEstablished','certifiedValuationEstablished'
]);
const SHA256_RE=/^[a-f0-9]{64}$/i;
const isDigest=value=>typeof value==='string'&&SHA256_RE.test(value);
const isCommit=value=>typeof value==='string'&&COMMIT_SHA_RE.test(value);
const safeStatus=(value,allowed)=>allowed.includes(value)?value:null;
function productionQualificationReady(value, target) {
  const gates=value?.gates,refs=value?.evidenceRefs,boundary=value?.evidenceBoundary;
  return Boolean(
    value && typeof value==='object'
    && value.status===PRODUCTION_QUALIFICATION_STATUS.READY_FOR_EXISTING_RELEASE_GOVERNANCE_REVIEW
    && value.releaseGovernanceReviewEligible===true
    && value.humanReleaseAuthorityApprovalRequired===true
    && value.nextStep==='EXISTING_RELEASE_GOVERNANCE_REVIEW'
    && Array.isArray(value.reasonCodes)&&value.reasonCodes.length===0
    && gates?.productionReadiness?.status==='READY_FOR_PRODUCTION_REVIEW'
    && gates.productionReadiness.ready===true
    && gates?.independentReleaseQualification?.status==='READY_FOR_RELEASE_AUTHORITY_REVIEW'
    && gates.independentReleaseQualification.ready===true
    && gates.independentReleaseQualification.integrityValid===true
    && gates.independentReleaseQualification.exactCommitSha===target.exactCommitSha
    && isDigest(gates.independentReleaseQualification.qualificationHashSha256)
    && gates?.institutionalGoLiveReview?.status==='READY_FOR_HUMAN_GO_LIVE_DECISION'
    && gates.institutionalGoLiveReview.ready===true
    && ['productionReadinessRef','independentReleaseQualificationRef','institutionalGoLiveRef'].every(k=>typeof refs?.[k]==='string'&&refs[k].trim().length>0)
    && boundary?.independentReleaseIntegrityVerified===true
    && boundary.externalEvidenceRequired===true
    && ['productionEvidenceValidatedByThisService','productionReadinessProvenanceVerifiedByThisService','institutionalEvidenceProvenanceVerifiedByThisService','productionAuthenticationValidated','productionPersistenceValidated'].every(k=>boundary[k]===false)
    && value.authority && Object.keys(value.authority).length===P9_AUTHORITY_KEYS.length
    && P9_AUTHORITY_KEYS.every(k=>Object.hasOwn(value.authority,k)&&value.authority[k]===false)
  );
}

function securityUatReady(value, target, asOf) {
  return Boolean(
    value
    && typeof value === 'object'
    && value.status === SECURITY_UAT_STATUS.INDEPENDENT_SECURITY_UAT_EVIDENCE_COMPLETE_NOT_RELEASE_AUTHORIZED
    && verifyCompletedSecurityUatBundle(value, asOf)
    && value.plan?.environment === target.environment
    && value.plan?.serviceRef === target.serviceRef
    && value.plan?.exactCommitSha === target.exactCommitSha
    && value.productionQualified === false
    && value.releaseCandidateAuthorityEstablished === false
    && value.authority
    && Object.values(value.authority).every((item) => item === false)
  );
}

function safeProductionQualificationSummary(value,verified) {
  if (!value || typeof value !== 'object') return null;
  return freeze({
    status: safeStatus(value.status,Object.values(PRODUCTION_QUALIFICATION_STATUS)),
    structurallyVerified:verified,
    releaseGovernanceReviewEligible: verified && value.releaseGovernanceReviewEligible === true,
    humanReleaseAuthorityApprovalRequired: value.humanReleaseAuthorityApprovalRequired === true,
    nextStep: ['EXISTING_RELEASE_GOVERNANCE_REVIEW','COMPLETE_EXTERNAL_QUALIFICATION_EVIDENCE'].includes(value.nextStep) ? value.nextStep : null,
    evidenceReferenceDigests: Object.fromEntries(['productionReadinessRef','independentReleaseQualificationRef','institutionalGoLiveRef'].map(k=>[k,verified&&typeof value.evidenceRefs?.[k]==='string'&&value.evidenceRefs[k].trim()?sha256Object(value.evidenceRefs[k].trim()):null])),
    gates: {
      productionReadiness: {
        status: safeStatus(value.gates?.productionReadiness?.status,['READY_FOR_PRODUCTION_REVIEW']),
        ready: verified && value.gates?.productionReadiness?.ready === true,
      },
      independentReleaseQualification: {
        status: safeStatus(value.gates?.independentReleaseQualification?.status,['READY_FOR_RELEASE_AUTHORITY_REVIEW']),
        ready: verified && value.gates?.independentReleaseQualification?.ready === true,
        integrityValid: verified && value.gates?.independentReleaseQualification?.integrityValid === true,
        exactCommitSha: verified && isCommit(value.gates?.independentReleaseQualification?.exactCommitSha) ? value.gates.independentReleaseQualification.exactCommitSha : null,
        qualificationHashSha256: verified && isDigest(value.gates?.independentReleaseQualification?.qualificationHashSha256) ? value.gates.independentReleaseQualification.qualificationHashSha256 : null,
      },
      institutionalGoLiveReview: {
        status: safeStatus(value.gates?.institutionalGoLiveReview?.status,['READY_FOR_HUMAN_GO_LIVE_DECISION']),
        ready: verified && value.gates?.institutionalGoLiveReview?.ready === true,
      },
    },
  });
}

function safeSecurityUatSummary(value,verified) {
  if (!value || typeof value !== 'object') return null;
  return freeze({
    status: safeStatus(value.status,Object.values(SECURITY_UAT_STATUS)),
    structurallyVerified:verified,
    evidenceBundleRef: verified && typeof value.evidenceBundleRef === 'string' && /^sha256:[a-f0-9]{64}$/i.test(value.evidenceBundleRef) ? value.evidenceBundleRef : null,
    pentestEvidenceRef: verified && typeof value.pentestEvidenceRef === 'string' && /^sha256:[a-f0-9]{64}$/i.test(value.pentestEvidenceRef) ? value.pentestEvidenceRef : null,
    uatEvidenceRef: verified && typeof value.uatEvidenceRef === 'string' && /^sha256:[a-f0-9]{64}$/i.test(value.uatEvidenceRef) ? value.uatEvidenceRef : null,
    openCriticalFindings: verified && Number.isSafeInteger(value.pentest?.openFindingCounts?.CRITICAL) && value.pentest.openFindingCounts.CRITICAL>=0 ? value.pentest.openFindingCounts.CRITICAL : null,
    openHighFindings: verified && Number.isSafeInteger(value.pentest?.openFindingCounts?.HIGH) && value.pentest.openFindingCounts.HIGH>=0 ? value.pentest.openFindingCounts.HIGH : null,
    uatFailedScenarios: verified && Number.isSafeInteger(value.uat?.failedScenarios) && value.uat.failedScenarios>=0 ? value.uat.failedScenarios : null,
    uatScenarioCount: verified && Number.isSafeInteger(value.uat?.scenarioBinding?.scenarioCount) && value.uat.scenarioBinding.scenarioCount>0 ? value.uat.scenarioBinding.scenarioCount : null,
    uatScenarioPlanHashSha256: verified && isDigest(value.uat?.scenarioBinding?.planHashSha256) ? value.uat.scenarioBinding.planHashSha256 : null,
    uatScenarioResultsHashSha256:verified&&isDigest(value.uat?.scenarioBinding?.scenarioResultsHashSha256)?value.uat.scenarioBinding.scenarioResultsHashSha256:null,
    observabilityCompletedAt:verified && typeof value.plan?.observabilityCompletedAt==='string'&&Number.isFinite(strictCalendarDateMs(value.plan.observabilityCompletedAt))?new Date(strictCalendarDateMs(value.plan.observabilityCompletedAt)).toISOString():null,
  });
}

function buildProductizationReleaseCandidateEvidenceBundle(input = {}) {
  assertNoAuthorityOverride(input);

  const candidateId = requiredString(input.candidateId, 'candidateId');
  const environment = normalizeEnvironment(input.environment);
  const serviceRef = requiredString(input.serviceRef, 'serviceRef');
  const exactCommitSha = requiredCommitSha(input.exactCommitSha);
  const assembled = requiredTimestamp(input.assembledAt, 'assembledAt');
  const reviewed = requiredTimestamp(input.reviewedAt, 'reviewedAt');
  if (reviewed.millis < assembled.millis) throw new TypeError('reviewedAt must be on or after assembledAt');
  if (reviewed.millis > Date.now()) throw new TypeError('reviewedAt must not be in the future');
  const assembledBy = requiredString(input.assembledBy, 'assembledBy');
  const reviewedBy = requiredString(input.reviewedBy, 'reviewedBy');
  const blockers = normalizeBlockers(input.openExternalBlockers);

  const target = { environment, serviceRef, exactCommitSha };
  const productionVerified=productionQualificationReady(input.productionQualification,target);
  const securityVerified=securityUatReady(input.securityUatEvidence,target,assembled.value)&&securityUatReady(input.securityUatEvidence,target,reviewed.value);
  const productionSummary = safeProductionQualificationSummary(input.productionQualification,productionVerified);
  const securityUatSummary = safeSecurityUatSummary(input.securityUatEvidence,securityVerified);
  const issues = [];
  let status = RELEASE_CANDIDATE_STATUS.READY_FOR_EXISTING_RELEASE_GOVERNANCE_REVIEW;

  if (!productionVerified) {
    status = RELEASE_CANDIDATE_STATUS.HOLD_PRODUCTION_QUALIFICATION;
    issues.push('PRODUCTION_QUALIFICATION_NOT_READY');
  }
  if (!securityVerified) {
    const hasExpectedStatus = input.securityUatEvidence?.status === SECURITY_UAT_STATUS.INDEPENDENT_SECURITY_UAT_EVIDENCE_COMPLETE_NOT_RELEASE_AUTHORIZED;
    const scopeMismatch=hasExpectedStatus&&(input.securityUatEvidence?.plan?.environment!==target.environment||input.securityUatEvidence?.plan?.serviceRef!==target.serviceRef||input.securityUatEvidence?.plan?.exactCommitSha!==target.exactCommitSha);
    if(status===RELEASE_CANDIDATE_STATUS.READY_FOR_EXISTING_RELEASE_GOVERNANCE_REVIEW)status=scopeMismatch?RELEASE_CANDIDATE_STATUS.HOLD_SCOPE_MISMATCH:RELEASE_CANDIDATE_STATUS.HOLD_SECURITY_UAT_EVIDENCE;
    issues.push(scopeMismatch?'SECURITY_UAT_TARGET_SCOPE_MISMATCH':'SECURITY_UAT_EVIDENCE_NOT_READY_OR_INVALID');
  }

  const missingBlockers = REQUIRED_OPEN_EXTERNAL_BLOCKERS.filter((item) => !blockers.includes(item));
  if (missingBlockers.length > 0) {
    if(status===RELEASE_CANDIDATE_STATUS.READY_FOR_EXISTING_RELEASE_GOVERNANCE_REVIEW)status = RELEASE_CANDIDATE_STATUS.HOLD_EXTERNAL_BLOCKER_REGISTER;
    issues.push(...missingBlockers.map((item) => `MISSING_OPEN_EXTERNAL_BLOCKER:${item}`));
  }

  if (assembledBy === reviewedBy) {
    if(status===RELEASE_CANDIDATE_STATUS.READY_FOR_EXISTING_RELEASE_GOVERNANCE_REVIEW)status = RELEASE_CANDIDATE_STATUS.HOLD_REVIEW_GOVERNANCE;
    issues.push('RELEASE_CANDIDATE_REQUIRES_SEPARATE_REVIEWER');
  }

  const core = {
    schemaVersion: 1,
    candidateId,
    environment,
    serviceRef,
    exactCommitSha,
    productionQualification: productionSummary,
    securityUatEvidence: securityUatSummary,
    openExternalBlockers: [...blockers],
    assembledBy,
    reviewedBy,
    assembledAt: assembled.value,
    reviewedAt: reviewed.value,
    status,
    issues,
  };
  const ready = status === RELEASE_CANDIDATE_STATUS.READY_FOR_EXISTING_RELEASE_GOVERNANCE_REVIEW;

  const manifestCore={
    ...core,
    manifestDigestVersion:2,
    releaseGovernanceReviewEligible: ready,
    engineeringEvidenceBundleAssembled: ready,
    externalBlockersRemainOpen: true,
    humanReleaseAuthorityApprovalRequired: true,
    productionQualified: false,
    authority: AUTHORITY,
    semantics: ready
      ? 'READY_FOR_EXISTING_RELEASE_GOVERNANCE_REVIEW means the existing production-qualification composition and exact-commit P19 security/UAT evidence are assembled into a deterministic manifest, all required unresolved external blockers are explicitly registered, and a separate reviewer is recorded. It authorizes only entry into the existing human release-governance process; every listed external blocker remains open and all release/deployment authority remains false.'
      : 'HOLD means the release-candidate evidence manifest is incomplete, target scope is inconsistent, required external blockers are not explicitly registered, or review separation is missing. This module does not validate external evidence authenticity or authorize release, merge, deployment, go-live, or transactions.',
  };
  const manifestHashSha256=sha256Object(manifestCore);
  return freeze({...manifestCore,manifestHashSha256,manifestRef:`sha256:${manifestHashSha256}`});
}

// Compare JSON structure before digest comparison; undefined extra keys and
// non-JSON representations must not be silently ignored by canonicalization.
function exactJsonShape(a,b){
 if(a===null||b===null||typeof a!=='object'||typeof b!=='object')return a===b;
 if(Array.isArray(a)!==Array.isArray(b))return false;
 if(Object.getPrototypeOf(a)!==Object.getPrototypeOf(b)&&Object.getPrototypeOf(a)!==null)return false;
 const keys=Reflect.ownKeys(a),expected=Reflect.ownKeys(b);
 if(keys.length!==expected.length||keys.some(k=>typeof k!=='string'||!Object.hasOwn(b,k)))return false;
 return keys.every(k=>{const desc=Object.getOwnPropertyDescriptor(a,k);return Object.hasOwn(desc,'value')&&exactJsonShape(desc.value,b[k]);});
}
// Verify by reconstruction from separately supplied source inputs, not by
// accepting a self-reported digest. Recheck time-sensitive P19 evidence as of
// the requested review time; this is structural integrity, not authentication.
function verifyReleaseCandidateManifest(manifest, sourceInput, asOf) {
  try {
    const at=requiredTimestamp(asOf,'asOf').millis;
    const expected=buildProductizationReleaseCandidateEvidenceBundle(sourceInput);
    if(at>Date.now()||at<strictCalendarDateMs(expected.reviewedAt))return false;
    if(expected.status!==RELEASE_CANDIDATE_STATUS.READY_FOR_EXISTING_RELEASE_GOVERNANCE_REVIEW)return false;
    if(!securityUatReady(sourceInput.securityUatEvidence,expected,asOf))return false;
    // Exact normalized manifest including authority and non-claim flags.
    return exactJsonShape(manifest,expected)&&sha256Object(manifest)===sha256Object(expected);
  }catch{return false;}
}

module.exports = {
  RELEASE_CANDIDATE_STATUS,
  REQUIRED_OPEN_EXTERNAL_BLOCKERS,
  AUTHORITY,
  buildProductizationReleaseCandidateEvidenceBundle,
  verifyReleaseCandidateManifest,
};
