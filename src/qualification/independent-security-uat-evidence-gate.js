'use strict';

const crypto = require('crypto');
const {strictCalendarDateMs} = require('../validation/strict-calendar-instant');
const {
  OBSERVABILITY_STATUS,
  verifyCompletedObservabilityQualification,
} = require('./controlled-observability-incident-qualification');

const SECURITY_UAT_STATUS = Object.freeze({
  HOLD_OBSERVABILITY_QUALIFICATION: 'HOLD_OBSERVABILITY_QUALIFICATION',
  HOLD_PENTEST_EVIDENCE: 'HOLD_PENTEST_EVIDENCE',
  HOLD_PENTEST_FINDINGS: 'HOLD_PENTEST_FINDINGS',
  HOLD_UAT_EVIDENCE: 'HOLD_UAT_EVIDENCE',
  HOLD_SCOPE_MISMATCH: 'HOLD_SCOPE_MISMATCH',
  HOLD_STALE_EVIDENCE: 'HOLD_STALE_EVIDENCE',
  INDEPENDENT_SECURITY_UAT_EVIDENCE_COMPLETE_NOT_RELEASE_AUTHORIZED: 'INDEPENDENT_SECURITY_UAT_EVIDENCE_COMPLETE_NOT_RELEASE_AUTHORIZED',
});

const AUTHORITY = Object.freeze({
  releaseAuthorized: false,
  mergeAuthorized: false,
  deploymentAuthorized: false,
  goLiveAuthorized: false,
  transactionAuthorized: false,
  productionSecurityValidated: false,
  productionUatValidated: false,
  externalEvidenceAuthenticityValidatedHere: false,
});

const SHA256_RE = /^[a-f0-9]{64}$/i;
const COMMIT_SHA_RE = /^[a-f0-9]{40}$/i;
const isDigest=value=>typeof value==='string'&&SHA256_RE.test(value);
const isHashRef=value=>typeof value==='string'&&/^sha256:[a-f0-9]{64}$/.test(value);
const SEVERITIES = Object.freeze(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']);

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function requiredCommitSha(value, field = 'exactCommitSha') {
  const normalized = requiredString(value, field).toLowerCase();
  if (!COMMIT_SHA_RE.test(normalized)) throw new TypeError(`${field} must be a 40-character git commit SHA`);
  return normalized;
}

function requiredSha256(value, field) {
  const normalized = requiredString(value, field).toLowerCase();
  if (!SHA256_RE.test(normalized)) throw new TypeError(`${field} must be a SHA-256 hex digest`);
  return normalized;
}

function requiredTimestamp(value, field) {
  const normalized = requiredString(value, field);
  const millis = strictCalendarDateMs(normalized);
  if (!Number.isFinite(millis)) throw new TypeError(`${field} must be an ISO-compatible timestamp`);
  return Object.freeze({ value: normalized, millis });
}

function nonNegativeInteger(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${field} must be a non-negative safe integer`);
  return value;
}

function nonNegativeNumber(value, field) {
  if (!Number.isFinite(value) || value < 0) throw new TypeError(`${field} must be a finite non-negative number`);
  return value;
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

function sha256Text(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function hashRef(value, field) {
  return `sha256:${sha256Text(requiredString(value, field))}`;
}

function normalizeEnvironment(value) {
  const normalized = requiredString(value, 'environment').toLowerCase();
  if (normalized !== 'staging') throw new TypeError('environment must be staging');
  return normalized;
}

function normalizeFindingCounts(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${field} must be an object`);
  const result = {};
  // Missing severity data is not evidence of zero findings.
  if (Object.keys(value).some(key => !SEVERITIES.includes(key))) throw new TypeError('unsupported finding severity');
  for (const severity of SEVERITIES) {
    if (!Object.hasOwn(value, severity)) throw new TypeError('missing finding severity');
    result[severity] = nonNegativeInteger(value[severity], `${field}.${severity}`);
  }
  return freeze(result);
}

function normalizePentestEvidence(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  try {
    const started = requiredTimestamp(value.startedAt, 'pentest.startedAt');
    const completed = requiredTimestamp(value.completedAt, 'pentest.completedAt');
    const reviewed = requiredTimestamp(value.reviewedAt, 'pentest.reviewedAt');
    if (completed.millis < started.millis || reviewed.millis < completed.millis) throw new TypeError('pentest timestamp order invalid');
    const findingCounts = normalizeFindingCounts(value.findingCounts, 'pentest.findingCounts');
    const openFindingCounts = normalizeFindingCounts(value.openFindingCounts, 'pentest.openFindingCounts');
    for (const severity of SEVERITIES) {
      if (openFindingCounts[severity] > findingCounts[severity]) throw new TypeError(`pentest.openFindingCounts.${severity} exceeds total findings`);
    }
    const testerOrganization = requiredString(value.testerOrganization, 'pentest.testerOrganization');
    const preparedBy = requiredString(value.preparedBy, 'pentest.preparedBy');
    const reviewedBy = requiredString(value.reviewedBy, 'pentest.reviewedBy');
    return freeze({
      status: requiredString(value.status, 'pentest.status'),
      environment: requiredString(value.environment, 'pentest.environment').toLowerCase(),
      serviceRef: requiredString(value.serviceRef, 'pentest.serviceRef'),
      exactCommitSha: requiredCommitSha(value.exactCommitSha, 'pentest.exactCommitSha'),
      reportRef: hashRef(value.reportRef, 'pentest.reportRef'),
      reportHashSha256: requiredSha256(value.reportHashSha256, 'pentest.reportHashSha256'),
      testerOrganizationRef: hashRef(testerOrganization, 'pentest.testerOrganization'),
      preparedByRef: hashRef(preparedBy, 'pentest.preparedBy'),
      reviewedByRef: hashRef(reviewedBy, 'pentest.reviewedBy'),
      independentAssessorAttested: value.independentAssessorAttested === true,
      scopeIncludesAuthentication: value.scopeIncludesAuthentication === true,
      scopeIncludesTenantIsolation: value.scopeIncludesTenantIsolation === true,
      scopeIncludesApiAuthorization: value.scopeIncludesApiAuthorization === true,
      scopeIncludesServerRuntime: value.scopeIncludesServerRuntime === true,
      retestCompletedForRemediatedCriticalHigh: value.retestCompletedForRemediatedCriticalHigh === true,
      findingCounts,
      openFindingCounts,
      startedAt: started.value,
      completedAt: completed.value,
      reviewedAt: reviewed.value,
      reviewerSeparateFromPreparer: preparedBy !== reviewedBy,
    });
  } catch (_) {
    return null;
  }
}

function normalizeUatEvidence(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  try {
    const started = requiredTimestamp(value.startedAt, 'uat.startedAt');
    const completed = requiredTimestamp(value.completedAt, 'uat.completedAt');
    const reviewed = requiredTimestamp(value.reviewedAt, 'uat.reviewedAt');
    if (completed.millis < started.millis || reviewed.millis < completed.millis) throw new TypeError('uat timestamp order invalid');
    const requiredScenarios = nonNegativeInteger(value.requiredScenarios, 'uat.requiredScenarios');
    const passedScenarios = nonNegativeInteger(value.passedScenarios, 'uat.passedScenarios');
    const failedScenarios = nonNegativeInteger(value.failedScenarios, 'uat.failedScenarios');
    if (requiredScenarios === 0 || passedScenarios + failedScenarios !== requiredScenarios) throw new TypeError('uat scenario counts inconsistent');
    const businessOwner = requiredString(value.businessOwner, 'uat.businessOwner');
    const reviewedBy = requiredString(value.reviewedBy, 'uat.reviewedBy');
    return freeze({
      status: requiredString(value.status, 'uat.status'),
      environment: requiredString(value.environment, 'uat.environment').toLowerCase(),
      serviceRef: requiredString(value.serviceRef, 'uat.serviceRef'),
      exactCommitSha: requiredCommitSha(value.exactCommitSha, 'uat.exactCommitSha'),
      acceptanceRef: hashRef(value.acceptanceRef, 'uat.acceptanceRef'),
      acceptanceArtifactHashSha256: requiredSha256(value.acceptanceArtifactHashSha256, 'uat.acceptanceArtifactHashSha256'),
      businessOwnerRef: hashRef(businessOwner, 'uat.businessOwner'),
      reviewedByRef: hashRef(reviewedBy, 'uat.reviewedBy'),
      reviewerSeparateFromBusinessOwner: businessOwner !== reviewedBy,
      criticalWorkflowCoverageComplete: value.criticalWorkflowCoverageComplete === true,
      tenantBoundaryAcceptanceComplete: value.tenantBoundaryAcceptanceComplete === true,
      authorizationWorkflowAcceptanceComplete: value.authorizationWorkflowAcceptanceComplete === true,
      requiredScenarios,
      passedScenarios,
      failedScenarios,
      startedAt: started.value,
      completedAt: completed.value,
      reviewedAt: reviewed.value,
    });
  } catch (_) {
    return null;
  }
}

// A caller-supplied plan is not an authenticated external approval. Bind the
// exact candidate, service, time window and individual role/scenario outcomes
// rather than accepting a matching aggregate count alone.
function scenarioIdentity(item){
  return {scenarioRef:hashRef('scenario:'+item.scenarioId,'scenarioId'),roleRef:hashRef('role:'+item.userRole,'userRole'),expectedOutcomeHashSha256:item.expectedOutcomeHashSha256};
}
function sortScenarioRefs(rows){return rows.sort((a,b)=>a.scenarioRef<b.scenarioRef?-1:a.scenarioRef>b.scenarioRef?1:0);}
function scenarioPlanWitness(plan){
  const {schemaVersion,environment,serviceRef,exactCommitSha,preparedAt,validUntil}=plan;
  return {schemaVersion,environment,serviceRef,exactCommitSha,preparedAt,validUntil,scenarios:sortScenarioRefs(plan.scenarios.map(scenarioIdentity))};
}
function createUatScenarioPlan(input = {}) {
  const prepared = requiredTimestamp(input.preparedAt,'uatPlan.preparedAt');
  const expires = requiredTimestamp(input.validUntil,'uatPlan.validUntil');
  if (expires.millis < prepared.millis) throw new TypeError('UAT_PLAN_WINDOW_INVALID');
  if (!Array.isArray(input.scenarios) || input.scenarios.length < 1 || input.scenarios.length > 10000)
    throw new TypeError('UAT_PLAN_SCENARIOS_REQUIRED');
  const ids = new Set();
  const scenarios = input.scenarios.map(item=>{
    const scenarioId=requiredString(item?.scenarioId,'scenarioId');
    if(ids.has(scenarioId))throw new TypeError('UAT_PLAN_DUPLICATE_SCENARIO');
    ids.add(scenarioId);
    return {scenarioId,userRole:requiredString(item.userRole,'userRole'),expectedOutcomeHashSha256:requiredSha256(item.expectedOutcomeHashSha256,'expectedOutcomeHashSha256')};
  }).sort((a,b)=>a.scenarioId.localeCompare(b.scenarioId));
  const core={schemaVersion:1,environment:normalizeEnvironment(input.environment),serviceRef:requiredString(input.serviceRef,'serviceRef'),exactCommitSha:requiredCommitSha(input.exactCommitSha),preparedAt:prepared.value,validUntil:expires.value,scenarios};
  return freeze({...core,planHashSha256:sha256Object(scenarioPlanWitness(core))});
}
function validateUatScenarioBinding(planInput, rawUat, uat, target) {
  try {
    const plan=createUatScenarioPlan(planInput);
    if(plan.planHashSha256!==planInput.planHashSha256 || rawUat.scenarioPlanHashSha256!==plan.planHashSha256)
      return {issue:'UAT_SCENARIO_PLAN_HASH_MISMATCH'};
    if(plan.environment!==target.environment||plan.serviceRef!==target.serviceRef||plan.exactCommitSha!==target.exactCommitSha)
      return {issue:'UAT_SCENARIO_PLAN_SCOPE_MISMATCH'};
    if(strictCalendarDateMs(plan.preparedAt)>strictCalendarDateMs(uat.startedAt)||strictCalendarDateMs(plan.validUntil)<strictCalendarDateMs(uat.completedAt))
      return {issue:'UAT_SCENARIO_PLAN_WINDOW_MISMATCH'};
    if(!Array.isArray(rawUat.scenarioResults)||rawUat.scenarioResults.length!==plan.scenarios.length||uat.requiredScenarios!==plan.scenarios.length)
      return {issue:'UAT_SCENARIO_COVERAGE_MISMATCH'};
    const expected=new Map(plan.scenarios.map(s=>[s.scenarioId,s]));
    const rows=[];
    for(const result of rawUat.scenarioResults){
      const id=requiredString(result?.scenarioId,'scenarioId');
      const item=expected.get(id);
      if(!item)return {issue:'UAT_SCENARIO_COVERAGE_MISMATCH'};
      expected.delete(id);
      if(result.userRole!==item.userRole||result.expectedOutcomeHashSha256!==item.expectedOutcomeHashSha256)
        return {issue:'UAT_SCENARIO_ROLE_OR_OUTCOME_MISMATCH'};
      if(result.passed!==true)return {issue:'UAT_SCENARIO_FAILURE_PRESENT'};
      rows.push({...scenarioIdentity(item),actualObservationHashSha256:requiredSha256(result.actualObservationHashSha256,'actualObservationHashSha256'),passed:true});
    }
    sortScenarioRefs(rows);
    if(expected.size)return {issue:'UAT_SCENARIO_COVERAGE_MISMATCH'};
    return {planHashSha256:plan.planHashSha256,scenarioResultsHashSha256:sha256Object(rows),scenarioCount:rows.length,planWitness:scenarioPlanWitness(plan),resultWitness:rows};
  }catch{return {issue:'UAT_SCENARIO_PLAN_OR_RESULTS_INVALID'};}
}

function exactKeys(value,keys){return !!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k));}
function verifyUatScenarioWitness(binding,uat,target){
 try{
  if(!exactKeys(binding,['planHashSha256','scenarioResultsHashSha256','scenarioCount','planWitness','resultWitness']))return false;
  const p=binding.planWitness,rows=binding.resultWitness;
  if(!exactKeys(p,['schemaVersion','environment','serviceRef','exactCommitSha','preparedAt','validUntil','scenarios'])||p.schemaVersion!==1||
    p.environment!==target.environment||p.serviceRef!==target.serviceRef||p.exactCommitSha!==target.exactCommitSha)return false;
  const prepared=requiredTimestamp(p.preparedAt,'preparedAt').millis,expires=requiredTimestamp(p.validUntil,'validUntil').millis;
  if(prepared>expires||prepared>strictCalendarDateMs(uat.startedAt)||expires<strictCalendarDateMs(uat.completedAt))return false;
  if(!Array.isArray(p.scenarios)||!Array.isArray(rows)||p.scenarios.length!==binding.scenarioCount||rows.length!==binding.scenarioCount||rows.length<1||rows.length>10000)return false;
  if(sha256Object(p)!==binding.planHashSha256||sha256Object(rows)!==binding.scenarioResultsHashSha256)return false;
  let previous='';
  for(let i=0;i<rows.length;i++){
    const item=p.scenarios[i],row=rows[i];
    if(!exactKeys(item,['scenarioRef','roleRef','expectedOutcomeHashSha256'])||!exactKeys(row,['scenarioRef','roleRef','expectedOutcomeHashSha256','actualObservationHashSha256','passed'])||
       !isHashRef(item.scenarioRef)||!isHashRef(item.roleRef)||item.scenarioRef<=previous||
       !isDigest(item.expectedOutcomeHashSha256)||row.scenarioRef!==item.scenarioRef||row.roleRef!==item.roleRef||row.expectedOutcomeHashSha256!==item.expectedOutcomeHashSha256||
       !isDigest(row.actualObservationHashSha256)||row.passed!==true)return false;
    previous=item.scenarioRef;
  }
  return true;
 }catch{return false;}
}
function makeResult({ status, plan, pentest, uat, issues = [] }) {
  const evidenceCore = {
    schemaVersion: 1,
    status,
    planHashSha256: plan.planHashSha256,
    observabilityQualificationRef: plan.observabilityQualificationRef,
    pentestEvidenceRef: pentest ? `sha256:${sha256Object(pentest)}` : null,
    uatEvidenceRef: uat ? `sha256:${sha256Object(uat)}` : null,
    issues: [...issues],
  };
  const evidenceBundleHashSha256 = sha256Object(evidenceCore);
  return freeze({
    ...evidenceCore,
    plan,
    pentest,
    uat,
    evidenceBundleHashSha256,
    evidenceBundleRef: `sha256:${evidenceBundleHashSha256}`,
    productionQualified: false,
    releaseCandidateAuthorityEstablished: false,
    authority: AUTHORITY,
    semantics: 'This gate deterministically validates supplied independent penetration-test and UAT evidence against the exact staging commit and completed observability qualification. External report authenticity and assessor credentials are not independently verified by this code. Completion does not certify production security or authorize release, merge, deployment, go-live, or transactions.',
  });
}

function createIndependentSecurityUatEvidenceGate() {
  return function qualify({
    observabilityQualification,
    environment,
    serviceRef,
    exactCommitSha,
    assessedAt = new Date().toISOString(),
    maximumEvidenceAgeDays = 30,
    pentestEvidence,
    uatEvidence,
    uatScenarioPlan,
  } = {}) {
    const env = normalizeEnvironment(environment);
    const service = requiredString(serviceRef, 'serviceRef');
    const commitSha = requiredCommitSha(exactCommitSha);
    const assessed = requiredTimestamp(assessedAt, 'assessedAt');
    if(assessed.millis>Date.now())throw new TypeError('assessedAt must not be in the future');
    const maxAgeDays = nonNegativeNumber(maximumEvidenceAgeDays, 'maximumEvidenceAgeDays');

    const observabilityComplete = Boolean(
      observabilityQualification
      && verifyCompletedObservabilityQualification(observabilityQualification,assessed.value)
      && typeof observabilityQualification.evidenceHashSha256 === 'string'
      && SHA256_RE.test(observabilityQualification.evidenceHashSha256)
      && observabilityQualification.plan?.environment === env
      && observabilityQualification.plan?.serviceRef === service
      && observabilityQualification.plan?.exactCommitSha === commitSha,
    );
    const observabilityQualificationRef = observabilityComplete
      ? `sha256:${observabilityQualification.evidenceHashSha256}`
      : null;

    const planCore = {
      schemaVersion: 1,
      environment: env,
      serviceRef: service,
      exactCommitSha: commitSha,
      assessedAt: assessed.value,
      maximumEvidenceAgeDays: maxAgeDays,
      observabilityQualificationRef,
      observabilityCompletedAt:observabilityComplete?observabilityQualification.incident.resolvedAt:null,
      requiredIndependentEvidence: ['penetrationTest', 'userAcceptanceTesting'],
      releaseAuthorityFromThisGate: false,
    };
    const plan = freeze({ ...planCore, planHashSha256: sha256Object(planCore) });

    if (!observabilityComplete) {
      return makeResult({ status: SECURITY_UAT_STATUS.HOLD_OBSERVABILITY_QUALIFICATION, plan });
    }

    const pentest = normalizePentestEvidence(pentestEvidence);
    if (!pentest) {
      return makeResult({ status: SECURITY_UAT_STATUS.HOLD_PENTEST_EVIDENCE, plan, issues: ['PENTEST_EVIDENCE_INVALID_OR_INCOMPLETE'] });
    }
    const uat = normalizeUatEvidence(uatEvidence);
    if (!uat) {
      return makeResult({ status: SECURITY_UAT_STATUS.HOLD_UAT_EVIDENCE, plan, pentest, issues: ['UAT_EVIDENCE_INVALID_OR_INCOMPLETE'] });
    }

    const scopeIssues = [];
    if (pentest.environment !== env || pentest.serviceRef !== service || pentest.exactCommitSha !== commitSha) scopeIssues.push('PENTEST_SCOPE_MISMATCH');
    if (uat.environment !== env || uat.serviceRef !== service || uat.exactCommitSha !== commitSha) scopeIssues.push('UAT_SCOPE_MISMATCH');
    if (scopeIssues.length > 0) return makeResult({ status: SECURITY_UAT_STATUS.HOLD_SCOPE_MISMATCH, plan, pentest, uat, issues: scopeIssues });

    const staleIssues = [];
    const maxAgeMs = maxAgeDays * 86400000;
    if(!Number.isFinite(maxAgeMs))return makeResult({status:SECURITY_UAT_STATUS.HOLD_STALE_EVIDENCE,plan,pentest,uat,issues:['EVIDENCE_FRESHNESS_WINDOW_INVALID']});
    const observedAt = strictCalendarDateMs(plan.observabilityCompletedAt);
    const observedAge = assessed.millis - observedAt;
    if (!Number.isFinite(observedAge) || observedAge < 0 || observedAge > maxAgeMs) staleIssues.push('OBSERVABILITY_EVIDENCE_OUTSIDE_FRESHNESS');
    // A later review does not refresh the date on which the tests ran.
    for (const [name, evidence] of [['PENTEST', pentest], ['UAT', uat]]) {
      const age = assessed.millis - strictCalendarDateMs(evidence.completedAt);
      if (age < 0 || age > maxAgeMs || strictCalendarDateMs(evidence.reviewedAt) > assessed.millis)
        staleIssues.push(`${name}_EVIDENCE_OUTSIDE_FRESHNESS`);
    }
    if (staleIssues.length > 0) return makeResult({ status: SECURITY_UAT_STATUS.HOLD_STALE_EVIDENCE, plan, pentest, uat, issues: staleIssues });

    const pentestEvidenceIssues = [];
    if (pentest.status !== 'PASS') pentestEvidenceIssues.push('PENTEST_STATUS_NOT_PASS');
    if (!pentest.independentAssessorAttested) pentestEvidenceIssues.push('PENTEST_INDEPENDENT_ASSESSOR_NOT_ATTESTED');
    if (!pentest.reviewerSeparateFromPreparer) pentestEvidenceIssues.push('PENTEST_REVIEWER_NOT_SEPARATE');
    if (!pentest.scopeIncludesAuthentication) pentestEvidenceIssues.push('PENTEST_AUTHENTICATION_SCOPE_MISSING');
    if (!pentest.scopeIncludesTenantIsolation) pentestEvidenceIssues.push('PENTEST_TENANT_ISOLATION_SCOPE_MISSING');
    if (!pentest.scopeIncludesApiAuthorization) pentestEvidenceIssues.push('PENTEST_API_AUTHORIZATION_SCOPE_MISSING');
    if (!pentest.scopeIncludesServerRuntime) pentestEvidenceIssues.push('PENTEST_SERVER_RUNTIME_SCOPE_MISSING');
    if (pentestEvidenceIssues.length > 0) return makeResult({ status: SECURITY_UAT_STATUS.HOLD_PENTEST_EVIDENCE, plan, pentest, uat, issues: pentestEvidenceIssues });

    const openCriticalHigh = pentest.openFindingCounts.CRITICAL + pentest.openFindingCounts.HIGH;
    if (openCriticalHigh > 0) {
      return makeResult({
        status: SECURITY_UAT_STATUS.HOLD_PENTEST_FINDINGS,
        plan,
        pentest,
        uat,
        issues: ['OPEN_CRITICAL_OR_HIGH_PENTEST_FINDINGS'],
      });
    }
    const remediatedCriticalHigh = (pentest.findingCounts.CRITICAL + pentest.findingCounts.HIGH) > 0;
    if (remediatedCriticalHigh && !pentest.retestCompletedForRemediatedCriticalHigh) {
      return makeResult({
        status: SECURITY_UAT_STATUS.HOLD_PENTEST_FINDINGS,
        plan,
        pentest,
        uat,
        issues: ['CRITICAL_HIGH_REMEDIATION_RETEST_NOT_COMPLETE'],
      });
    }

    const uatIssues = [];
    if (uat.status !== 'PASS') uatIssues.push('UAT_STATUS_NOT_PASS');
    if (!uat.reviewerSeparateFromBusinessOwner) uatIssues.push('UAT_REVIEWER_NOT_SEPARATE');
    if (!uat.criticalWorkflowCoverageComplete) uatIssues.push('UAT_CRITICAL_WORKFLOW_COVERAGE_INCOMPLETE');
    if (!uat.tenantBoundaryAcceptanceComplete) uatIssues.push('UAT_TENANT_BOUNDARY_ACCEPTANCE_INCOMPLETE');
    if (!uat.authorizationWorkflowAcceptanceComplete) uatIssues.push('UAT_AUTHORIZATION_WORKFLOW_ACCEPTANCE_INCOMPLETE');
    if (uat.failedScenarios !== 0 || uat.passedScenarios !== uat.requiredScenarios) uatIssues.push('UAT_SCENARIOS_NOT_ALL_PASSING');
    if (uatIssues.length > 0) return makeResult({ status: SECURITY_UAT_STATUS.HOLD_UAT_EVIDENCE, plan, pentest, uat, issues: uatIssues });

    const binding=validateUatScenarioBinding(uatScenarioPlan,uatEvidence,uat,plan);
    if(binding.issue)return makeResult({status:SECURITY_UAT_STATUS.HOLD_UAT_EVIDENCE,plan,pentest,uat,issues:[binding.issue]});
    return makeResult({
      status: SECURITY_UAT_STATUS.INDEPENDENT_SECURITY_UAT_EVIDENCE_COMPLETE_NOT_RELEASE_AUTHORIZED,
      plan,
      pentest,
      uat:freeze({...uat,scenarioBinding:binding}),
    });
  };
}

// Structural integrity and semantic checks at the P19 -> P20 boundary.
// This is not a signature, source authentication, or independent approval.
function verifyCompletedSecurityUatBundle(value, asOf) {
  try {
    const {plan,pentest,uat,issues}=value;
    if(value.status!==SECURITY_UAT_STATUS.INDEPENDENT_SECURITY_UAT_EVIDENCE_COMPLETE_NOT_RELEASE_AUTHORIZED||
       value.schemaVersion!==1||!Array.isArray(issues)||issues.length||
       value.productionQualified!==false||value.releaseCandidateAuthorityEstablished!==false||
       !value.authority||Object.keys(value.authority).length!==Object.keys(AUTHORITY).length||
       Object.keys(AUTHORITY).some(key=>value.authority[key]!==false))return false;
    const {planHashSha256,...planCore}=plan;
    if(!isDigest(planHashSha256)||sha256Object(planCore)!==planHashSha256||
       plan.schemaVersion!==1||plan.environment!=='staging'||requiredCommitSha(plan.exactCommitSha)!==plan.exactCommitSha||
       requiredString(plan.serviceRef,'serviceRef')!==plan.serviceRef||
       JSON.stringify(plan.requiredIndependentEvidence)!==JSON.stringify(['penetrationTest','userAcceptanceTesting'])||
       value.planHashSha256!==planHashSha256||plan.releaseAuthorityFromThisGate!==false||
       value.observabilityQualificationRef!==plan.observabilityQualificationRef||
       !isHashRef(plan.observabilityQualificationRef))return false;
    if(!pentest||!uat||value.pentestEvidenceRef!==`sha256:${sha256Object(pentest)}`||
       value.uatEvidenceRef!==`sha256:${sha256Object(uat)}`)return false;
    const evidenceCore={schemaVersion:1,status:value.status,planHashSha256,observabilityQualificationRef:value.observabilityQualificationRef,pentestEvidenceRef:value.pentestEvidenceRef,uatEvidenceRef:value.uatEvidenceRef,issues};
    const expected=sha256Object(evidenceCore);
    if(value.evidenceBundleHashSha256!==expected||value.evidenceBundleRef!==`sha256:${expected}`)return false;
    const total=normalizeFindingCounts(pentest.findingCounts,'findingCounts');
    const open=normalizeFindingCounts(pentest.openFindingCounts,'openFindingCounts');
    if(SEVERITIES.some(key=>open[key]>total[key])||open.CRITICAL!==0||open.HIGH!==0||
       ((total.CRITICAL>0||total.HIGH>0)&&pentest.retestCompletedForRemediatedCriticalHigh!==true))return false;
    if(pentest.status!=='PASS'||['independentAssessorAttested','scopeIncludesAuthentication','scopeIncludesTenantIsolation','scopeIncludesApiAuthorization','scopeIncludesServerRuntime','reviewerSeparateFromPreparer'].some(key=>pentest[key]!==true))return false;
    if(uat.status!=='PASS'||['reviewerSeparateFromBusinessOwner','criticalWorkflowCoverageComplete','tenantBoundaryAcceptanceComplete','authorizationWorkflowAcceptanceComplete'].some(key=>uat[key]!==true))return false;
    if(['reportRef','testerOrganizationRef','preparedByRef','reviewedByRef'].some(key=>!isHashRef(pentest[key]))||
       !isDigest(pentest.reportHashSha256)||pentest.preparedByRef===pentest.reviewedByRef||
       ['acceptanceRef','businessOwnerRef','reviewedByRef'].some(key=>!isHashRef(uat[key]))||
       !isDigest(uat.acceptanceArtifactHashSha256)||uat.businessOwnerRef===uat.reviewedByRef)return false;
    const binding=uat.scenarioBinding;
    if(!binding||!isDigest(binding.planHashSha256)||!isDigest(binding.scenarioResultsHashSha256)||
       !Number.isSafeInteger(uat.requiredScenarios)||uat.requiredScenarios<1||
       binding.scenarioCount!==uat.requiredScenarios||uat.passedScenarios!==uat.requiredScenarios||uat.failedScenarios!==0||!verifyUatScenarioWitness(binding,uat,plan))return false;
    const assessed=requiredTimestamp(plan.assessedAt,'plan.assessedAt').millis;
    const at=requiredTimestamp(asOf,'asOf').millis;
    const maxAge=nonNegativeNumber(plan.maximumEvidenceAgeDays,'maximumEvidenceAgeDays')*86400000;
    const monitored=requiredTimestamp(plan.observabilityCompletedAt,'observabilityCompletedAt').millis;
    if(!Number.isFinite(maxAge)||assessed>at||at>Date.now()||monitored>assessed||at-monitored>maxAge)return false;
    for(const evidence of [pentest,uat]){
      if(evidence.environment!==plan.environment||evidence.serviceRef!==plan.serviceRef||evidence.exactCommitSha!==plan.exactCommitSha)return false;
      const started=requiredTimestamp(evidence.startedAt,'startedAt').millis;
      const completed=requiredTimestamp(evidence.completedAt,'completedAt').millis;
      const reviewed=requiredTimestamp(evidence.reviewedAt,'reviewedAt').millis;
      if(started>completed||completed>reviewed||reviewed>assessed||at-completed>maxAge)return false;
    }
    return true;
  }catch{return false;}
}

const evaluateIndependentSecurityUatEvidence = createIndependentSecurityUatEvidenceGate();

module.exports = {
  SECURITY_UAT_STATUS,
  AUTHORITY,
  SEVERITIES,
  createUatScenarioPlan,
  verifyCompletedSecurityUatBundle,
  createIndependentSecurityUatEvidenceGate,
  evaluateIndependentSecurityUatEvidence,
};
