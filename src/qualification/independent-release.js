'use strict';

const crypto = require('crypto');
const { SECURITY_QUALIFICATION_STATUS, verifySecurityQualificationEnvelope } = require('../security/security-qualification-envelope.js');
const { PERFORMANCE_QUALIFICATION_STATUS, verifyPerformanceResilienceQualification } = require('./performance-resilience.js');

const INDEPENDENT_RELEASE_STATUS = Object.freeze({
  READY_FOR_HUMAN_RELEASE_REVIEW: 'READY_FOR_HUMAN_RELEASE_REVIEW',
  HOLD_SECURITY_QUALIFICATION: 'HOLD_SECURITY_QUALIFICATION',
  HOLD_PERFORMANCE_QUALIFICATION: 'HOLD_PERFORMANCE_QUALIFICATION',
  HOLD_RELEASE_EVIDENCE: 'HOLD_RELEASE_EVIDENCE',
  HOLD_SCOPE_MISMATCH: 'HOLD_SCOPE_MISMATCH',
  HOLD_INTEGRITY: 'HOLD_INTEGRITY',
});

function req(v,f){if(typeof v!=='string'||!v.trim())throw new TypeError(`${f} must be a non-empty string`);return v.trim();}
function canon(v){if(Array.isArray(v))return v.map(canon);if(v&&typeof v==='object')return Object.keys(v).sort().reduce((a,k)=>{a[k]=canon(v[k]);return a;},{});return v;}
function hash(v){return crypto.createHash('sha256').update(JSON.stringify(canon(v))).digest('hex');}
function isHash(v){return typeof v==='string'&&/^[a-f0-9]{64}$/i.test(v);}

function createCanonicalReleaseEvidence(input={}){
  const commit=req(input.exactCommitSha,'exactCommitSha');
  if(!/^[a-f0-9]{40}$/i.test(commit))throw new TypeError('exactCommitSha must be 40 hex characters');
  if(!Number.isInteger(input.regressionTotal)||input.regressionTotal<0)throw new TypeError('regressionTotal must be a non-negative integer');
  if(!Number.isInteger(input.regressionPassed)||input.regressionPassed<0)throw new TypeError('regressionPassed must be a non-negative integer');
  const audit=input.npmAudit||{};
  for(const k of ['critical','high','moderate','low']) if(!Number.isInteger(audit[k])||audit[k]<0) throw new TypeError(`npmAudit.${k} must be a non-negative integer`);
  const payload={
    evidenceId:req(input.evidenceId,'evidenceId'), exactCommitSha:commit,
    regressionTotal:input.regressionTotal, regressionPassed:input.regressionPassed,
    regressionPass:input.regressionPassed===input.regressionTotal,
    productionBuildPass:input.productionBuildPass===true,
    packageVerificationPass:input.packageVerificationPass===true,
    releaseVerifyPass:input.releaseVerifyPass===true,
    npmAudit:{critical:audit.critical,high:audit.high,moderate:audit.moderate,low:audit.low},
    workflowRunRef:req(input.workflowRunRef,'workflowRunRef'), artifactRef:req(input.artifactRef,'artifactRef'),
    artifactHashSha256:req(input.artifactHashSha256,'artifactHashSha256').toLowerCase(),
    reviewedBy:req(input.reviewedBy,'reviewedBy'), reviewedAt:req(input.reviewedAt,'reviewedAt'),
  };
  if(!isHash(payload.artifactHashSha256))throw new TypeError('artifactHashSha256 must be SHA-256');
  return Object.freeze({...payload,releaseEvidenceHashSha256:hash(payload)});
}

function verifyCanonicalReleaseEvidence(e){
  if(!e||typeof e!=='object')return Object.freeze({valid:false,reason:'RELEASE_EVIDENCE_REQUIRED'});
  const {releaseEvidenceHashSha256,...payload}=e; const expected=hash(payload);
  return Object.freeze({valid:isHash(releaseEvidenceHashSha256)&&releaseEvidenceHashSha256===expected,reason:releaseEvidenceHashSha256===expected?null:'HASH_MISMATCH'});
}

function buildIndependentReleaseQualification({qualificationId,exactCommitSha,securityQualification,performanceQualification,releaseEvidence,preparedBy,reviewedBy,assessedAt}={}){
  const commit=req(exactCommitSha,'exactCommitSha');
  if(!/^[a-f0-9]{40}$/i.test(commit))throw new TypeError('exactCommitSha must be 40 hex characters');
  if(!securityQualification||typeof securityQualification!=='object')throw new TypeError('securityQualification is required');
  if(!performanceQualification||typeof performanceQualification!=='object')throw new TypeError('performanceQualification is required');
  if(!releaseEvidence||typeof releaseEvidence!=='object')throw new TypeError('releaseEvidence is required');
  let status=INDEPENDENT_RELEASE_STATUS.READY_FOR_HUMAN_RELEASE_REVIEW; const reasonCodes=[];

  if(!verifySecurityQualificationEnvelope(securityQualification).valid || !verifyPerformanceResilienceQualification(performanceQualification).valid || !verifyCanonicalReleaseEvidence(releaseEvidence).valid){
    status=INDEPENDENT_RELEASE_STATUS.HOLD_INTEGRITY; reasonCodes.push('UPSTREAM_OR_RELEASE_EVIDENCE_INTEGRITY');
  } else if(securityQualification.status!==SECURITY_QUALIFICATION_STATUS.READY_FOR_INDEPENDENT_SECURITY_VALIDATION){
    status=INDEPENDENT_RELEASE_STATUS.HOLD_SECURITY_QUALIFICATION; reasonCodes.push(`SECURITY:${String(securityQualification.status||'UNKNOWN')}`);
  } else if(performanceQualification.status!==PERFORMANCE_QUALIFICATION_STATUS.READY_FOR_INDEPENDENT_RELEASE_QUALIFICATION){
    status=INDEPENDENT_RELEASE_STATUS.HOLD_PERFORMANCE_QUALIFICATION; reasonCodes.push(`PERFORMANCE:${String(performanceQualification.status||'UNKNOWN')}`);
  } else if(securityQualification.exactCommitSha!==commit||performanceQualification.exactCommitSha!==commit||releaseEvidence.exactCommitSha!==commit){
    status=INDEPENDENT_RELEASE_STATUS.HOLD_SCOPE_MISMATCH; reasonCodes.push('EXACT_COMMIT_SCOPE_MISMATCH');
  } else if(!(releaseEvidence.regressionPass&&releaseEvidence.productionBuildPass&&releaseEvidence.packageVerificationPass&&releaseEvidence.releaseVerifyPass&&Object.values(releaseEvidence.npmAudit).every(v=>v===0))){
    status=INDEPENDENT_RELEASE_STATUS.HOLD_RELEASE_EVIDENCE; reasonCodes.push('CANONICAL_RELEASE_GATES_NOT_ALL_PASS');
  }

  const payload={
    qualificationId:req(qualificationId,'qualificationId'),status,reasonCodes,exactCommitSha:commit,
    securityQualificationHashSha256:securityQualification.qualificationHashSha256||null,
    performanceQualificationHashSha256:performanceQualification.qualificationHashSha256||null,
    releaseEvidenceHashSha256:releaseEvidence.releaseEvidenceHashSha256||null,
    preparedBy:req(preparedBy,'preparedBy'),reviewedBy:req(reviewedBy,'reviewedBy'),assessedAt:req(assessedAt,'assessedAt'),
    humanReleaseReviewRequired:true, releaseApproved:false, mergeAuthorized:false, deploymentAuthorized:false,
    productionSecurityValidated:false, productionCapacityEstablished:false, regulatoryApprovalEstablished:false,
    externalProfessionalApprovalEstablished:false, transactionAuthorized:false,
  };
  return Object.freeze({...payload,reasonCodes:Object.freeze(reasonCodes),qualificationHashSha256:hash(payload),semantics:'READY_FOR_HUMAN_RELEASE_REVIEW means only that the supplied Wave 17 security qualification, performance/resilience qualification, and canonical release evidence passed deterministic composition checks for the exact commit. It is not human release approval and does not authorize merge or deployment.'});
}

function verifyIndependentReleaseQualification(q){
  if(!q||typeof q!=='object')return Object.freeze({valid:false,reason:'QUALIFICATION_REQUIRED'});
  const {qualificationHashSha256,semantics,...payload}=q; const expected=hash(payload);
  return Object.freeze({valid:isHash(qualificationHashSha256)&&qualificationHashSha256===expected,reason:qualificationHashSha256===expected?null:'HASH_MISMATCH'});
}

module.exports={INDEPENDENT_RELEASE_STATUS,createCanonicalReleaseEvidence,verifyCanonicalReleaseEvidence,buildIndependentReleaseQualification,verifyIndependentReleaseQualification};
