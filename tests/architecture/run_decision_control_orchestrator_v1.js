'use strict';

const assert = require('assert');
const { CONTROL_GATE_STATUS, buildDecisionControlGate } = require('../../src/project-model/decision-control-orchestrator');

const profile = {
  projectId: 'PROJECT-1',
  incomeModel: 'LEASE_INCOME',
  traits: { incomeProducing: true },
};

function evidence(engineQualified = true, readiness = 'READY_FOR_UNDERWRITING_INPUT') {
  return {
    projectId: 'PROJECT-1',
    caseId: 'CASE-1',
    readiness: { status: readiness },
    engineRoute: { financialEngineQualified: engineQualified },
  };
}

const titlePass = { caseId: 'CASE-1', status: 'FACTS_SUFFICIENT_FOR_ANALYSIS' };
const tenantPass = { status: 'TENANT_ANALYTICAL_FAVOURABLE' };
const regulatoryPass = { overallStatus: 'PASS_INFORMATIONAL' };

const ready = buildDecisionControlGate({ profile, evidenceOrchestration: evidence(), titleAssessment: titlePass, tenantAssessment: tenantPass, regulatoryAssessment: regulatoryPass });
assert.strictEqual(ready.status, CONTROL_GATE_STATUS.READY_FOR_ANALYTICAL_UNDERWRITING);
assert.strictEqual(ready.canRunAnalyticalUnderwriting, true);
assert.strictEqual(ready.canEmitInvestmentDecision, false);

const titleReview = buildDecisionControlGate({ profile, evidenceOrchestration: evidence(), titleAssessment: { caseId: 'CASE-1', status: 'LEGAL_REVIEW_REQUIRED' }, tenantAssessment: tenantPass, regulatoryAssessment: regulatoryPass });
assert.strictEqual(titleReview.status, CONTROL_GATE_STATUS.PROFESSIONAL_REVIEW_REQUIRED);
assert.strictEqual(titleReview.canRunAnalyticalUnderwriting, false);

const staleRegulation = buildDecisionControlGate({ profile, evidenceOrchestration: evidence(), titleAssessment: titlePass, tenantAssessment: tenantPass, regulatoryAssessment: { overallStatus: 'REGULATORY_REVIEW_REQUIRED' } });
assert.strictEqual(staleRegulation.status, CONTROL_GATE_STATUS.PROFESSIONAL_REVIEW_REQUIRED);

const triggeredRegulation = buildDecisionControlGate({ profile, evidenceOrchestration: evidence(), titleAssessment: titlePass, tenantAssessment: tenantPass, regulatoryAssessment: { overallStatus: 'REQUIREMENT_TRIGGERED' } });
assert.strictEqual(triggeredRegulation.status, CONTROL_GATE_STATUS.REGULATORY_REQUIREMENT_TRIGGERED);

const policyHold = buildDecisionControlGate({ profile, evidenceOrchestration: evidence(), titleAssessment: titlePass, tenantAssessment: { status: 'HOLD_POLICY' }, regulatoryAssessment: regulatoryPass });
assert.strictEqual(policyHold.status, CONTROL_GATE_STATUS.HOLD_POLICY);

const noEngine = buildDecisionControlGate({ profile, evidenceOrchestration: evidence(false), titleAssessment: titlePass, tenantAssessment: tenantPass, regulatoryAssessment: regulatoryPass });
assert.strictEqual(noEngine.status, CONTROL_GATE_STATUS.HOLD_NO_QUALIFIED_ENGINE);

const missingTenant = buildDecisionControlGate({ profile, evidenceOrchestration: evidence(), titleAssessment: titlePass, tenantAssessment: null, regulatoryAssessment: regulatoryPass });
assert.strictEqual(missingTenant.status, CONTROL_GATE_STATUS.HOLD_EVIDENCE);
assert.ok(missingTenant.blockers.some((item) => item.domain === 'TENANT' && item.code === 'TENANT_ASSESSMENT_REQUIRED'));

assert.throws(() => buildDecisionControlGate({ profile, evidenceOrchestration: { ...evidence(), projectId: 'OTHER' }, titleAssessment: titlePass, tenantAssessment: tenantPass, regulatoryAssessment: regulatoryPass }), /PROJECT_ISOLATION_VIOLATION/);

console.log('DECISION_CONTROL_ORCHESTRATOR_V1=PASS');
console.log('PROFESSIONAL_REVIEW_PRECEDENCE=PASS');
console.log('REGULATORY_TRIGGER_BLOCKS_UNDERWRITING=PASS');
console.log('TENANT_POLICY_HOLD_FAILS_CLOSED=PASS');
console.log('UNQUALIFIED_ENGINE_BLOCKS_UNDERWRITING=PASS');
console.log('NO_AUTOMATIC_INVESTMENT_DECISION=PASS');
