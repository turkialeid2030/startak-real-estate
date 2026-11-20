'use strict';

const assert = require('assert');
const {
  createProjectProfile,
  ASSET_CLASS,
  LIFECYCLE_STAGE,
  INVESTMENT_STRATEGY,
  INCOME_MODEL,
} = require('../../src/project-model');
const {
  createCanonicalWorkspaceFromSavedDeal,
} = require('../../src/runtime/saved-deal-canonical-workspace-bridge');

const landInputs = {
  projectTitle: 'Bridge Test Land Development',
  landLength: 30,
  landWidth: 60,
  landPricePerSqm: 20000,
  buildableRatio: 0.6,
  buildingTypeLabel: 'برج مكتبي',
  officeFloorCount: 7,
  servicesRatioPerFloor: 0.15,
  basementFloorCount: 2,
  constructionCostPerSqm: 5500,
  landCommissionRate: 0.025,
  landTransferFeeRate: 0.05,
  engineeringCost: 200000,
  landValuationCost: 60000,
  marketRentPerSqm: 1800,
  occupancyRate: 1,
  serviceIncomeRate: 0.12,
  opexRate: 0.05,
  marketCapRate: 0.08,
  constructionPeriod: 2,
  rentGrowthRate: 0.03,
  operatingPeriod: 10,
  exitCapRate: 0.085,
  hurdleRate: 0.12,
  exitTransferFeeRate: 0.05,
  maxPaybackThreshold: 9,
  leverageEnabled: false,
  ltv: 0.6,
  loanRate: 0.065,
  loanTenor: 8,
  financingStructureLabel: 'مرابحة',
  minDscrThreshold: 1.25,
  equityRiskSpread: 0.02,
  titleDeedVerified: false,
  zoningConfirmed: false,
  buildingPermitStatus: 'لم يُستخرج',
  soilStudyDone: false,
  utilitiesConfirmed: false,
};

const savedDeal = {
  id: 'deal-001',
  name: 'Bridge test deal',
  mode: 'land',
  inputs: landInputs,
  savedAt: '2026-09-08T18:00:00.000Z',
};

const projectProfile = createProjectProfile({
  projectId: 'PROJECT-BRIDGE-001',
  projectName: 'Bridge Test Project',
  assetClasses: [ASSET_CLASS.LAND],
  lifecycleStage: LIFECYCLE_STAGE.PLANNED,
  investmentStrategy: INVESTMENT_STRATEGY.DEVELOPMENT,
  incomeModel: INCOME_MODEL.LEASE_INCOME,
  jurisdiction: { country: 'SA', city: 'Riyadh' },
});

const workspace = createCanonicalWorkspaceFromSavedDeal({
  savedDeal,
  workspaceId: 'WORKSPACE-BRIDGE-001',
  projectProfile,
  caseId: 'CASE-BRIDGE-001',
  attribution: { actorId: 'USER-001', actorRole: 'ANALYST' },
});

assert.strictEqual(workspace.workspaceId, 'WORKSPACE-BRIDGE-001');
assert.strictEqual(workspace.projectId, 'PROJECT-BRIDGE-001');
assert.strictEqual(workspace.caseId, 'CASE-BRIDGE-001');
assert.strictEqual(workspace.sourceRecord.type, 'SAVED_DEAL');
assert.strictEqual(workspace.sourceRecord.id, 'deal-001');
assert.strictEqual(workspace.sourceRecord.mode, 'land');
assert.strictEqual(workspace.sourceRecord.historicalStandardsSnapshotPresent, false);
assert.strictEqual(workspace.boundaries.savedDealStructurallyValidated, true);
assert.strictEqual(workspace.boundaries.economicInputsValidatedByCanonicalEngine, true);
assert.strictEqual(workspace.boundaries.canonicalEngineInvocations, 1);
assert.strictEqual(workspace.boundaries.professionalValuationCertified, false);
assert.strictEqual(workspace.boundaries.investmentDecisionAutomated, false);
assert.strictEqual(workspace.boundaries.transactionAuthorized, false);
assert.strictEqual(workspace.executableCase.projectId, 'PROJECT-BRIDGE-001');
assert.strictEqual(workspace.executableCase.caseId, 'CASE-BRIDGE-001');
assert.strictEqual(workspace.executableCase.financialModel.status, 'IMPLEMENTED');
assert.strictEqual(workspace.executableCase.valuation.status, 'NOT_EVALUATED');
assert.strictEqual(workspace.executableCase.authority.operatingMode, 'UNLICENSED_DECISION_SUPPORT');
assert.strictEqual(workspace.authority.releaseAuthorized, false);
assert.strictEqual(workspace.authority.mergeAuthorized, false);
assert.strictEqual(workspace.authority.deploymentAuthorized, false);
assert.strictEqual(workspace.authority.transactionAuthorized, false);
assert(workspace.executableCase.lifecycleCoverage.unresolved.length > 0);
assert(Object.isFrozen(workspace));
assert(Object.isFrozen(workspace.sourceRecord));

assert.throws(() => createCanonicalWorkspaceFromSavedDeal({
  savedDeal: { ...savedDeal, mode: 'unsupported' },
  workspaceId: 'WORKSPACE-X',
  projectProfile,
  caseId: 'CASE-X',
}), (error) => error && error.name === 'SavedDealValidationError');

const mismatchedProfile = { ...projectProfile, projectId: 'PROJECT-OTHER' };
const explicitMismatchProfile = { ...mismatchedProfile, projectId: '' };
assert.throws(() => createCanonicalWorkspaceFromSavedDeal({
  savedDeal,
  workspaceId: 'WORKSPACE-X',
  projectProfile: explicitMismatchProfile,
  caseId: 'CASE-X',
}), /projectProfile\.projectId must be a non-empty string/);


// A historical P25 override must never be dropped by the saved-deal ->
// canonical bridge and silently relabeled as an investment-ready financial
// model. Legacy provenance remains in the stored deal for remediation.
const unsupportedHistorical = createCanonicalWorkspaceFromSavedDeal({
  savedDeal: {
    ...savedDeal,
    id: 'deal-p25-unapproved',
    assumptionModelVersion: 'V2',
    assumptionRegistry: [{
      id: 'maintenanceRate',
      value: 0.06,
      critical: true,
      override: true,
      overrideReason: 'Synthetic pending financial override',
      approvalStatus: 'PENDING',
    }],
  },
  workspaceId: 'WORKSPACE-P25-PENDING',
  projectProfile,
  caseId: 'CASE-P25-PENDING',
  attribution: { actorId: 'USER-001', actorRole: 'ANALYST' },
});
assert.equal(unsupportedHistorical.executableCase.financialModel.status, 'ANALYTICAL_HOLD');
assert.equal(unsupportedHistorical.executableCase.financialModel.decisionStatus, 'INCOMPLETE_INPUTS');
assert.equal(unsupportedHistorical.executableCase.financialModel.analyticalResultsOnly, true);
assert.equal(unsupportedHistorical.executableCase.financialModel.unsupportedAssumptionOverride, true);
assert.equal(unsupportedHistorical.executableCase.assumptions.overrideRegistryPresent, true);
assert.equal(unsupportedHistorical.executableCase.assumptions.overrideDocumentationHold, true);
assert.equal(unsupportedHistorical.authority.transactionAuthorized, false);
assert.equal(unsupportedHistorical.orchestration.transactionAuthorized, false);

console.log('SAVED_DEAL_CANONICAL_WORKSPACE_BRIDGE=PASS');
