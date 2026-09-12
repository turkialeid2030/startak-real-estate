'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  createProjectProfile,
  ASSET_CLASS,
  LIFECYCLE_STAGE,
  INVESTMENT_STRATEGY,
  INCOME_MODEL,
} = require('../../src/project-model');
const { createCanonicalCaseWorkspace } = require('../../src/runtime/canonical-case-workspace');
const {
  projectCanonicalWorkspaceToDecisionIntelligence,
  buildCanonicalCommitteePreparation,
} = require('../../src/runtime/canonical-governance-projections');

const profile = createProjectProfile({
  projectId: 'PROJECT-GOV-001',
  projectName: 'Governance Projection Test',
  assetClasses: [ASSET_CLASS.OFFICE],
  lifecycleStage: LIFECYCLE_STAGE.EXISTING_OPERATING,
  investmentStrategy: INVESTMENT_STRATEGY.ACQUIRE_HOLD,
  incomeModel: INCOME_MODEL.LEASE_INCOME,
  jurisdiction: { country: 'SA', city: 'Riyadh' },
});

const engineResult = {
  cashflows: [-100, 20, 20, 20, 20, 120],
  irr: 0.12,
  npv: 11,
  metCount: 2,
  totalCriteria: 3,
};

function completeDomainOutputs(caseId) {
  const scoped = (status = 'IMPLEMENTED', extra = {}) => ({
    status,
    projectId: 'PROJECT-GOV-001',
    caseId,
    ...extra,
  });
  return {
    assignment: scoped(),
    scope: scoped(),
    documents: scoped('IMPLEMENTED', { items: [] }),
    inspection: scoped('IMPLEMENTED', { items: [] }),
    market: scoped('IMPLEMENTED', { items: [] }),
    hbu: scoped(),
    valuation: scoped(),
    development: scoped(),
    finance: scoped(),
    reconciliation: scoped(),
    uncertainty: scoped(),
    review: scoped(),
    reporting: scoped(),
    scenarios: scoped('IMPLEMENTED', { items: [] }),
    risks: scoped('IMPLEMENTED', { items: [] }),
    investmentCommittee: scoped(),
    governance: scoped(),
  };
}

const completeWorkspace = createCanonicalCaseWorkspace({
  workspaceId: 'WS-GOV-001',
  projectId: 'PROJECT-GOV-001',
  caseId: 'CASE-GOV-001',
  projectProfile: profile,
  studyType: 'EXISTING_BUILDING',
  inputs: { buildingPrice: 100 },
  engineResult,
  verdict: 'REVIEW',
  domainOutputs: completeDomainOutputs('CASE-GOV-001'),
  attribution: { actorId: 'ACTOR-GOV-001', actorRole: 'ANALYST' },
});

assert.strictEqual(completeWorkspace.orchestration.unresolvedLifecycleSections.length, 0);
const decisionProjection = projectCanonicalWorkspaceToDecisionIntelligence(completeWorkspace);
assert.strictEqual(decisionProjection.status, 'HOLD_AI_OUTPUTS');
assert(decisionProjection.reasonCodes.includes('REQUIRED_AI_ROLE_OUTPUTS_MISSING'));
assert.strictEqual(decisionProjection.summary.acceptedAiRoleCount, 0);
assert.deepStrictEqual([...decisionProjection.summary.missingAiRoles], ['ANALYST', 'CHALLENGER', 'SYNTHESIZER']);
assert.strictEqual(decisionProjection.decisionQuality.reliability, 'UNQUALIFIED_FOR_PROFESSIONAL_RELEASE');
assert.strictEqual(decisionProjection.transactionAuthorized, false);

const preparation = buildCanonicalCommitteePreparation(completeWorkspace);
assert.strictEqual(preparation.committeeDossier.status, 'HOLD_WORKSPACE');
assert.strictEqual(preparation.committeeDossier.readyForHumanCommittee, false);
assert.strictEqual(preparation.actionRegister.openCount, 0);
assert.deepStrictEqual([...preparation.actionRegister.actions], []);
assert.strictEqual(preparation.authority.committeeDecisionRecorded, false);
assert.strictEqual(preparation.authority.releaseAuthorized, false);
assert.strictEqual(preparation.authority.mergeAuthorized, false);
assert.strictEqual(preparation.authority.deploymentAuthorized, false);
assert.strictEqual(preparation.authority.transactionAuthorized, false);
assert.strictEqual(preparation.committeeDossier.transactionAuthorized, false);
assert(Object.isFrozen(preparation));
assert(Object.isFrozen(preparation.committeeDossier));

const gappedWorkspace = createCanonicalCaseWorkspace({
  workspaceId: 'WS-GOV-002',
  projectId: 'PROJECT-GOV-001',
  caseId: 'CASE-GOV-002',
  projectProfile: profile,
  studyType: 'EXISTING_BUILDING',
  inputs: { buildingPrice: 100 },
  engineResult,
  verdict: 'REVIEW',
  domainOutputs: {
    assignment: { status: 'IMPLEMENTED', projectId: 'PROJECT-GOV-001', caseId: 'CASE-GOV-002' },
  },
});
const heldProjection = buildCanonicalCommitteePreparation(gappedWorkspace);
assert.strictEqual(heldProjection.decisionWorkspace.status, 'HOLD_STUDY');
assert(heldProjection.decisionWorkspace.reasonCodes.some((code) => code.startsWith('LIFECYCLE_GAP:')));
assert.strictEqual(heldProjection.committeeDossier.status, 'HOLD_WORKSPACE');
assert.strictEqual(heldProjection.committeeDossier.readyForHumanCommittee, false);

assert.throws(
  () => projectCanonicalWorkspaceToDecisionIntelligence({ orchestration: {} }),
  /projectId must be a non-empty string/,
);

const panelPath = path.join(__dirname, '../../src/components/CanonicalCaseWorkspacePanel.jsx');
const panelSource = fs.readFileSync(panelPath, 'utf8');
assert(panelSource.includes('InvestmentCommitteeDossierPanel'));
assert(panelSource.includes('buildCanonicalCommitteePreparation'));
assert(!panelSource.includes('function buildDecisionWorkspace'));
assert(!panelSource.includes('window.'));

console.log('CANONICAL_GOVERNANCE_PROJECTION=PASS');
