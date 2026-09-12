'use strict';

const assert = require('assert');
const {
  createProjectProfile,
  ASSET_CLASS,
  LIFECYCLE_STAGE,
  INVESTMENT_STRATEGY,
  INCOME_MODEL,
} = require('../../src/project-model');
const { createCanonicalCaseWorkspace } = require('../../src/runtime/canonical-case-workspace');

const projectProfile = createProjectProfile({
  projectId: 'PROJECT-001',
  projectName: 'Canonical Workspace Test',
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

const domainOutputs = {
  assignment: { status: 'IMPLEMENTED', projectId: 'PROJECT-001', caseId: 'CASE-001' },
  scope: { status: 'IMPLEMENTED', projectId: 'PROJECT-001', caseId: 'CASE-001' },
  documents: { status: 'IMPLEMENTED', projectId: 'PROJECT-001', caseId: 'CASE-001', items: [] },
  inspection: { status: 'IMPLEMENTED', projectId: 'PROJECT-001', caseId: 'CASE-001', items: [] },
  market: { status: 'IMPLEMENTED', projectId: 'PROJECT-001', caseId: 'CASE-001', items: [] },
  hbu: { status: 'IMPLEMENTED', projectId: 'PROJECT-001', caseId: 'CASE-001' },
  valuation: { status: 'IMPLEMENTED', projectId: 'PROJECT-001', caseId: 'CASE-001' },
  development: { status: 'IMPLEMENTED', projectId: 'PROJECT-001', caseId: 'CASE-001' },
  finance: { status: 'IMPLEMENTED', projectId: 'PROJECT-001', caseId: 'CASE-001' },
  reconciliation: { status: 'IMPLEMENTED', projectId: 'PROJECT-001', caseId: 'CASE-001' },
  uncertainty: { status: 'IMPLEMENTED', projectId: 'PROJECT-001', caseId: 'CASE-001' },
  review: { status: 'IMPLEMENTED', projectId: 'PROJECT-001', caseId: 'CASE-001' },
  reporting: { status: 'IMPLEMENTED', projectId: 'PROJECT-001', caseId: 'CASE-001' },
  scenarios: { status: 'IMPLEMENTED', projectId: 'PROJECT-001', caseId: 'CASE-001', items: [] },
  risks: { status: 'IMPLEMENTED', projectId: 'PROJECT-001', caseId: 'CASE-001', items: [] },
  investmentCommittee: { status: 'IMPLEMENTED', projectId: 'PROJECT-001', caseId: 'CASE-001' },
  governance: { status: 'IMPLEMENTED', projectId: 'PROJECT-001', caseId: 'CASE-001' },
};

const workspace = createCanonicalCaseWorkspace({
  workspaceId: 'WS-001',
  projectId: 'PROJECT-001',
  caseId: 'CASE-001',
  projectProfile,
  studyType: 'EXISTING_BUILDING',
  inputs: { buildingPrice: 100 },
  engineResult,
  verdict: 'REVIEW',
  domainOutputs,
  attribution: { actorId: 'USER-001', actorRole: 'ANALYST' },
});

assert.strictEqual(workspace.workspaceId, 'WS-001');
assert.strictEqual(workspace.projectId, 'PROJECT-001');
assert.strictEqual(workspace.caseId, 'CASE-001');
assert.strictEqual(workspace.executableCase.projectId, 'PROJECT-001');
assert.strictEqual(workspace.executableCase.caseId, 'CASE-001');
assert.strictEqual(workspace.executableCase.authority.operatingMode, 'UNLICENSED_DECISION_SUPPORT');
assert.strictEqual(workspace.authority.releaseAuthorized, false);
assert.strictEqual(workspace.authority.mergeAuthorized, false);
assert.strictEqual(workspace.authority.deploymentAuthorized, false);
assert.strictEqual(workspace.authority.transactionAuthorized, false);
assert(Object.isFrozen(workspace));
assert(Object.isFrozen(workspace.executableCase));

assert.throws(() => createCanonicalCaseWorkspace({
  workspaceId: 'WS-X',
  projectId: 'PROJECT-001',
  caseId: 'CASE-001',
  projectProfile: { ...projectProfile, projectId: 'PROJECT-OTHER' },
  studyType: 'EXISTING_BUILDING',
  inputs: { buildingPrice: 100 },
  engineResult,
  verdict: 'REVIEW',
  domainOutputs,
}), (error) => error && error.code === 'WORKSPACE_PROJECT_ISOLATION_VIOLATION');

const gappedWorkspace = createCanonicalCaseWorkspace({
  workspaceId: 'WS-002',
  projectId: 'PROJECT-001',
  caseId: 'CASE-002',
  projectProfile,
  studyType: 'EXISTING_BUILDING',
  inputs: { buildingPrice: 100 },
  engineResult,
  verdict: 'REVIEW',
  domainOutputs: {
    assignment: { status: 'IMPLEMENTED', projectId: 'PROJECT-001', caseId: 'CASE-002' },
  },
});
assert.strictEqual(gappedWorkspace.status, 'CASE_ASSEMBLED_WITH_LIFECYCLE_GAPS');
assert(gappedWorkspace.executableCase.lifecycleCoverage.unresolved.length > 0);

console.log('CANONICAL_CASE_WORKSPACE=PASS');
