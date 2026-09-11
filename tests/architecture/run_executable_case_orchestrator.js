'use strict';

const assert = require('assert');
const {
  assembleExecutableInvestmentCase,
  EXECUTABLE_CASE_ORCHESTRATION_STATUS,
} = require('../../src/project-model');

function baseProfile() {
  return {
    schemaVersion: 1,
    projectId: 'PROJECT-CASE-ORCH-001',
    projectName: 'Case Orchestration Test',
    assetClasses: ['OFFICE'],
    lifecycleStage: 'EXISTING_OPERATING',
    investmentStrategy: 'ACQUIRE_HOLD',
    incomeModel: 'LEASE_INCOME',
  };
}

function baseEngineResult() {
  return {
    projectId: 'PROJECT-CASE-ORCH-001',
    caseId: 'CASE-ORCH-001',
    cashflows: [-10_000_000, 1_100_000, 12_000_000],
    irr: 0.137654321,
    npv: 987654.32,
    leveredIRR: 0.1625,
    metCount: 3,
    totalCriteria: 4,
  };
}

function completeDomainOutputs() {
  const identity = { projectId: 'PROJECT-CASE-ORCH-001', caseId: 'CASE-ORCH-001' };
  return {
    assignment: { ...identity, status: 'COMPLETE', purpose: 'INVESTMENT_DECISION_SUPPORT' },
    scope: { ...identity, status: 'COMPLETE' },
    documents: { ...identity, status: 'COMPLETE', items: [{ ...identity, documentId: 'DOC-1' }] },
    inspection: { ...identity, status: 'COMPLETE', inspectionId: 'INSP-1' },
    market: { ...identity, status: 'COMPLETE', comparableCount: 5 },
    hbu: { ...identity, status: 'COMPLETE', conclusion: 'CURRENT_USE' },
    valuation: { ...identity, status: 'COMPLETE', amount: 11_250_000 },
    development: { ...identity, status: 'NOT_APPLICABLE' },
    finance: { ...identity, status: 'COMPLETE', source: 'CANONICAL_ENGINE' },
    reconciliation: { ...identity, status: 'COMPLETE', conclusion: 11_100_000 },
    uncertainty: { ...identity, status: 'COMPLETE', material: false },
    review: { ...identity, status: 'COMPLETE', reviewType: 'INTERNAL_ANALYTICAL' },
    reporting: { ...identity, status: 'COMPLETE', reportId: 'RPT-1' },
    scenarios: { ...identity, status: 'COMPLETE', items: [{ ...identity, id: 'BASE' }, { ...identity, id: 'DOWNSIDE' }] },
    risks: { ...identity, status: 'COMPLETE', items: [{ ...identity, id: 'RISK-1' }] },
    investmentCommittee: { ...identity, status: 'COMPLETE', packetId: 'IC-1' },
    governance: { ...identity, status: 'COMPLETE', auditTrailId: 'AUD-1' },
    property: { ...identity, status: 'COMPLETE', propertyId: 'PROP-1' },
    evidence: { ...identity, status: 'COMPLETE', items: [{ ...identity, evidenceId: 'EV-1' }] },
    authority: {
      operatingMode: 'CERTIFIED_VALUATION',
      releaseAuthorized: true,
      mergeAuthorized: true,
      deploymentAuthorized: true,
      transactionAuthorized: true,
      orchestrationNote: 'retain-safe-metadata',
    },
  };
}

function assemble(overrides = {}) {
  return assembleExecutableInvestmentCase({
    profile: baseProfile(),
    caseId: 'CASE-ORCH-001',
    studyType: 'EXISTING_BUILDING',
    inputs: { purchasePrice: 10_000_000, exitCap: 0.075 },
    engineResult: baseEngineResult(),
    verdict: 'REVIEW',
    domainOutputs: completeDomainOutputs(),
    analyticalPackage: {
      projectId: 'PROJECT-CASE-ORCH-001',
      caseId: 'CASE-ORCH-001',
      status: 'ANALYTICAL_PACKAGE_READY',
      dossierId: 'DOSSIER-1',
    },
    standardsContext: {
      projectId: 'PROJECT-CASE-ORCH-001',
      caseId: 'CASE-ORCH-001',
      snapshotId: 'STD-SNAPSHOT-001',
      lifecycleStatus: 'UNDER_REVIEW',
    },
    ...overrides,
  });
}

function main() {
  let checks = 0;
  const check = (condition, message) => {
    checks += 1;
    assert.ok(condition, message);
  };

  const full = assemble();
  check(full.status === EXECUTABLE_CASE_ORCHESTRATION_STATUS.CASE_ASSEMBLED, 'full lifecycle must assemble');
  check(full.projectId === 'PROJECT-CASE-ORCH-001', 'orchestration must bind projectId');
  check(full.caseId === 'CASE-ORCH-001', 'orchestration must bind caseId');
  check(full.executableCase.projectId === full.projectId, 'case must retain project identity');
  check(full.executableCase.projectProfile.projectId === full.projectId, 'case must retain project profile');
  check(full.executableCase.lifecycleCoverage.unresolved.length === 0, 'full lifecycle must have no structural gaps');
  check(full.executableCase.financialModel.irr === 0.137654321, 'supplied engine IRR must be retained exactly');
  check(full.executableCase.financialModel.npv === 987654.32, 'supplied engine NPV must be retained exactly');
  check(full.executableCase.analyticalPackage.dossierId === 'DOSSIER-1', 'analytical package must be carried');
  check(full.executableCase.standardsContext.snapshotId === 'STD-SNAPSHOT-001', 'standards context must be carried');
  check(full.boundaries.financialEngineInvokedByThisOrchestrator === false, 'orchestrator must not create a second calculation path');
  check(full.boundaries.canonicalFinancialFormulaChanged === false, 'orchestrator must not alter formulas');
  check(full.humanDecisionRequired === true, 'human decision must remain required');
  check(full.transactionAuthorized === false, 'orchestrator must never authorize a transaction');
  check(full.executableCase.authority.operatingMode === 'UNLICENSED_DECISION_SUPPORT', 'operating mode must remain fail-closed');
  check(full.executableCase.authority.releaseAuthorized === false, 'domain output cannot self-authorize release');
  check(full.executableCase.authority.mergeAuthorized === false, 'domain output cannot self-authorize merge');
  check(full.executableCase.authority.deploymentAuthorized === false, 'domain output cannot self-authorize deployment');
  check(full.executableCase.authority.transactionAuthorized === false, 'domain output cannot self-authorize transaction');
  check(full.executableCase.authority.orchestrationNote === 'retain-safe-metadata', 'non-authority metadata may survive');
  check(Object.isFrozen(full) && Object.isFrozen(full.executableCase), 'assembled package must be immutable');

  const partial = assemble({ domainOutputs: { valuation: { status: 'COMPLETE', amount: 9_900_000 } } });
  check(partial.status === EXECUTABLE_CASE_ORCHESTRATION_STATUS.CASE_ASSEMBLED_WITH_LIFECYCLE_GAPS, 'partial lifecycle must expose gaps');
  check(partial.unresolvedLifecycleSections.includes('assignment'), 'missing assignment must be explicit');
  check(partial.unresolvedLifecycleSections.includes('inspection'), 'missing inspection must be explicit');
  check(partial.reasonCodes.includes('LIFECYCLE_GAP:market'), 'market gap must have a reason code');

  assert.throws(
    () => assemble({ profile: { ...baseProfile(), projectId: 'OTHER-PROJECT' } }),
    /PROJECT_ISOLATION_VIOLATION:ENGINE_RESULT/,
    'engine output from another project must fail closed',
  );
  checks += 1;

  assert.throws(
    () => assemble({ analyticalPackage: { projectId: 'PROJECT-CASE-ORCH-001', caseId: 'OTHER-CASE' } }),
    /CASE_ISOLATION_VIOLATION:ANALYTICAL_PACKAGE/,
    'analytical package from another case must fail closed',
  );
  checks += 1;

  const mismatchedDomain = completeDomainOutputs();
  mismatchedDomain.market = { projectId: 'OTHER-PROJECT', caseId: 'CASE-ORCH-001', status: 'COMPLETE' };
  assert.throws(
    () => assemble({ domainOutputs: mismatchedDomain }),
    /PROJECT_ISOLATION_VIOLATION:DOMAIN_OUTPUT:market/,
    'cross-project domain output must fail closed',
  );
  checks += 1;

  const mismatchedItemDomain = completeDomainOutputs();
  mismatchedItemDomain.evidence = {
    projectId: 'PROJECT-CASE-ORCH-001',
    caseId: 'CASE-ORCH-001',
    status: 'COMPLETE',
    items: [{ projectId: 'PROJECT-CASE-ORCH-001', caseId: 'OTHER-CASE', evidenceId: 'EV-BAD' }],
  };
  assert.throws(
    () => assemble({ domainOutputs: mismatchedItemDomain }),
    /CASE_ISOLATION_VIOLATION:DOMAIN_OUTPUT:evidence.items\[0\]/,
    'cross-case evidence item must fail closed',
  );
  checks += 1;

  assert.throws(
    () => assemble({ domainOutputs: [] }),
    /domainOutputs must be an object/,
    'non-object domain output collection must fail closed',
  );
  checks += 1;

  console.log(`POST_E2I_EXECUTABLE_CASE_ORCHESTRATOR=PASS checks=${checks}`);
}

main();
