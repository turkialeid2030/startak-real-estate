'use strict';

const CONTROL_GATE_STATUS = Object.freeze({
  READY_FOR_ANALYTICAL_UNDERWRITING: 'READY_FOR_ANALYTICAL_UNDERWRITING',
  HOLD_EVIDENCE: 'HOLD_EVIDENCE',
  HOLD_POLICY: 'HOLD_POLICY',
  REGULATORY_REQUIREMENT_TRIGGERED: 'REGULATORY_REQUIREMENT_TRIGGERED',
  PROFESSIONAL_REVIEW_REQUIRED: 'PROFESSIONAL_REVIEW_REQUIRED',
  HOLD_NO_QUALIFIED_ENGINE: 'HOLD_NO_QUALIFIED_ENGINE',
});

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freeze(child);
  return value;
}

function requiredObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${field} must be an object`);
  return value;
}

function buildDecisionControlGate({
  profile,
  evidenceOrchestration,
  titleAssessment,
  tenantAssessment = null,
  regulatoryAssessment,
}) {
  requiredObject(profile, 'profile');
  requiredObject(evidenceOrchestration, 'evidenceOrchestration');
  requiredObject(titleAssessment, 'titleAssessment');
  requiredObject(regulatoryAssessment, 'regulatoryAssessment');

  if (profile.projectId !== evidenceOrchestration.projectId) throw new TypeError('PROJECT_ISOLATION_VIOLATION');
  if (evidenceOrchestration.caseId !== titleAssessment.caseId) throw new TypeError('CASE_ISOLATION_VIOLATION');

  const blockers = [];
  const professionalReview = [];
  const checks = [];

  const evidenceReady = evidenceOrchestration.readiness && evidenceOrchestration.readiness.status === 'READY_FOR_UNDERWRITING_INPUT';
  if (!evidenceReady) blockers.push({ domain: 'EVIDENCE', code: evidenceOrchestration.readiness ? evidenceOrchestration.readiness.status : 'EVIDENCE_READINESS_MISSING' });
  checks.push({ domain: 'EVIDENCE', status: evidenceReady ? 'PASS' : 'HOLD' });

  if (titleAssessment.status === 'LEGAL_REVIEW_REQUIRED') {
    professionalReview.push({ domain: 'TITLE', code: 'LEGAL_REVIEW_REQUIRED' });
    checks.push({ domain: 'TITLE', status: 'PROFESSIONAL_REVIEW_REQUIRED' });
  } else if (titleAssessment.status !== 'FACTS_SUFFICIENT_FOR_ANALYSIS') {
    blockers.push({ domain: 'TITLE', code: titleAssessment.status });
    checks.push({ domain: 'TITLE', status: 'HOLD' });
  } else {
    checks.push({ domain: 'TITLE', status: 'PASS_FACTUAL_ONLY' });
  }

  const tenantRequired = Boolean(profile.traits && profile.traits.incomeProducing && profile.incomeModel === 'LEASE_INCOME');
  if (tenantRequired && !tenantAssessment) {
    blockers.push({ domain: 'TENANT', code: 'TENANT_ASSESSMENT_REQUIRED' });
    checks.push({ domain: 'TENANT', status: 'HOLD' });
  } else if (tenantAssessment) {
    if (tenantAssessment.status === 'LEGAL_REVIEW_REQUIRED') {
      professionalReview.push({ domain: 'TENANT', code: 'LEGAL_REVIEW_REQUIRED' });
      checks.push({ domain: 'TENANT', status: 'PROFESSIONAL_REVIEW_REQUIRED' });
    } else if (tenantAssessment.status === 'HOLD_EVIDENCE') {
      blockers.push({ domain: 'TENANT', code: 'HOLD_EVIDENCE' });
      checks.push({ domain: 'TENANT', status: 'HOLD' });
    } else if (tenantAssessment.status === 'HOLD_POLICY') {
      blockers.push({ domain: 'TENANT', code: 'HOLD_POLICY' });
      checks.push({ domain: 'TENANT', status: 'HOLD_POLICY' });
    } else if (tenantAssessment.status === 'TENANT_HIGH_RISK') {
      blockers.push({ domain: 'TENANT', code: 'TENANT_HIGH_RISK' });
      checks.push({ domain: 'TENANT', status: 'RISK_BLOCKER' });
    } else {
      checks.push({ domain: 'TENANT', status: 'PASS_ANALYTICAL' });
    }
  } else {
    checks.push({ domain: 'TENANT', status: 'NOT_REQUIRED_FOR_PROFILE' });
  }

  const regulatoryStatus = regulatoryAssessment.overallStatus;
  if (regulatoryStatus === 'REGULATORY_REVIEW_REQUIRED') {
    professionalReview.push({ domain: 'REGULATORY', code: 'REGULATORY_REVIEW_REQUIRED' });
    checks.push({ domain: 'REGULATORY', status: 'PROFESSIONAL_REVIEW_REQUIRED' });
  } else if (regulatoryStatus === 'HOLD_EVIDENCE') {
    blockers.push({ domain: 'REGULATORY', code: 'HOLD_EVIDENCE' });
    checks.push({ domain: 'REGULATORY', status: 'HOLD' });
  } else if (regulatoryStatus === 'REQUIREMENT_TRIGGERED') {
    blockers.push({ domain: 'REGULATORY', code: 'REQUIREMENT_TRIGGERED' });
    checks.push({ domain: 'REGULATORY', status: 'REQUIREMENT_TRIGGERED' });
  } else if (regulatoryStatus === 'PASS_INFORMATIONAL') {
    checks.push({ domain: 'REGULATORY', status: 'PASS_INFORMATIONAL_ONLY' });
  } else {
    blockers.push({ domain: 'REGULATORY', code: 'UNKNOWN_REGULATORY_STATUS' });
    checks.push({ domain: 'REGULATORY', status: 'HOLD' });
  }

  const engineQualified = evidenceOrchestration.engineRoute && evidenceOrchestration.engineRoute.financialEngineQualified === true;
  if (!engineQualified) blockers.push({ domain: 'ENGINE', code: 'HOLD_NO_QUALIFIED_ENGINE' });
  checks.push({ domain: 'ENGINE', status: engineQualified ? 'QUALIFIED' : 'HOLD_NO_QUALIFIED_ENGINE' });

  let status = CONTROL_GATE_STATUS.READY_FOR_ANALYTICAL_UNDERWRITING;
  if (professionalReview.length > 0) status = CONTROL_GATE_STATUS.PROFESSIONAL_REVIEW_REQUIRED;
  else if (blockers.some((item) => item.domain === 'REGULATORY' && item.code === 'REQUIREMENT_TRIGGERED')) status = CONTROL_GATE_STATUS.REGULATORY_REQUIREMENT_TRIGGERED;
  else if (blockers.some((item) => item.code === 'HOLD_POLICY')) status = CONTROL_GATE_STATUS.HOLD_POLICY;
  else if (blockers.some((item) => item.code === 'HOLD_NO_QUALIFIED_ENGINE')) status = CONTROL_GATE_STATUS.HOLD_NO_QUALIFIED_ENGINE;
  else if (blockers.length > 0) status = CONTROL_GATE_STATUS.HOLD_EVIDENCE;

  return freeze({
    schemaVersion: 1,
    projectId: profile.projectId,
    caseId: evidenceOrchestration.caseId,
    status,
    blockers,
    professionalReview,
    checks,
    canRunAnalyticalUnderwriting: status === CONTROL_GATE_STATUS.READY_FOR_ANALYTICAL_UNDERWRITING,
    canEmitInvestmentDecision: false,
    semantics: 'This gate controls analytical-underwriting readiness only. It does not authorize a transaction, certify legal compliance, issue a certified valuation, or make the human investment decision.',
  });
}

module.exports = { CONTROL_GATE_STATUS, buildDecisionControlGate };
