'use strict';

const assert = require('assert');
const {
  EXECUTABLE_CASE_SCHEMA_VERSION,
  LIFECYCLE_SECTIONS,
  createExecutableInvestmentCase,
} = require('../../src/contracts/executable-investment-case');

function baseArgs(overrides = {}) {
  return {
    caseId: 'CASE-POST-E2I-001',
    studyType: 'EXISTING_BUILDING',
    inputs: { purchasePrice: 10_000_000 },
    engineResult: {
      cashflows: [-10_000_000, 1_000_000],
      irr: 0.1,
      npv: 125_000,
      metCount: 2,
      totalCriteria: 3,
    },
    verdict: 'REVIEW',
    ...overrides,
  };
}

function main() {
  let checks = 0;
  const check = (condition, message) => {
    checks += 1;
    assert.ok(condition, message);
  };

  const legacyCompatible = createExecutableInvestmentCase(baseArgs());
  check(legacyCompatible.schemaVersion === EXECUTABLE_CASE_SCHEMA_VERSION, 'schema version must be explicit');
  check(legacyCompatible.financialModel.status === 'IMPLEMENTED', 'legacy financial behavior must be preserved');
  check(legacyCompatible.recommendation.verdict === 'REVIEW', 'legacy recommendation behavior must be preserved');
  check(legacyCompatible.assignment.status === 'NOT_EVALUATED', 'missing assignment must fail truthful, not be fabricated');
  check(legacyCompatible.inspection.status === 'NOT_EVALUATED', 'missing inspection must remain not evaluated');
  check(legacyCompatible.market.status === 'NOT_EVALUATED', 'missing market must remain not evaluated');
  check(legacyCompatible.hbu.status === 'NOT_EVALUATED', 'missing HBU must remain not evaluated');
  check(legacyCompatible.reporting.status === 'NOT_EVALUATED', 'missing reporting must remain not evaluated');
  check(legacyCompatible.lifecycleCoverage.status === 'LIFECYCLE_GAPS_REMAIN', 'legacy case must expose lifecycle gaps');

  const domainOutputs = {
    assignment: { status: 'COMPLETE', purpose: 'INVESTMENT_DECISION_SUPPORT' },
    scope: { status: 'COMPLETE', basis: 'SUPPLIED_SCOPE' },
    documents: { status: 'COMPLETE', items: ['TITLE', 'LEASE'] },
    inspection: { status: 'COMPLETE', inspectionId: 'INSP-1' },
    market: { status: 'COMPLETE', comparableCount: 5 },
    hbu: { status: 'COMPLETE', conclusion: 'CURRENT_USE' },
    valuation: { status: 'COMPLETE', amount: 11_250_000 },
    development: { status: 'NOT_APPLICABLE' },
    finance: { status: 'COMPLETE', source: 'CANONICAL_ENGINE' },
    reconciliation: { status: 'COMPLETE', conclusion: 11_100_000 },
    uncertainty: { status: 'COMPLETE', material: false },
    review: { status: 'COMPLETE', reviewType: 'INTERNAL_ANALYTICAL' },
    reporting: { status: 'COMPLETE', reportId: 'RPT-1' },
    scenarios: { status: 'COMPLETE', items: [{ id: 'BASE' }, { id: 'DOWNSIDE' }] },
    risks: { status: 'COMPLETE', items: [{ id: 'RISK-1' }] },
    investmentCommittee: { status: 'COMPLETE', packetId: 'IC-1' },
    governance: { status: 'COMPLETE', auditTrailId: 'AUD-1' },
    property: { propertyId: 'PROP-1', assetType: 'OFFICE' },
    evidence: { status: 'COMPLETE', items: [{ evidenceId: 'EV-1' }] },
    analyticalPackage: { status: 'ANALYTICAL_PACKAGE_READY', caseId: 'CASE-POST-E2I-001' },
    authority: {
      operatingMode: 'CERTIFIED_VALUATION',
      releaseAuthorized: true,
      mergeAuthorized: true,
      deploymentAuthorized: true,
      transactionAuthorized: true,
      reviewerNote: 'internal-only note',
    },
  };

  const hydrated = createExecutableInvestmentCase(baseArgs({
    domainOutputs,
    standardsContext: {
      snapshotId: 'STD-SNAPSHOT-001',
      lifecycleStatus: 'UNDER_REVIEW',
    },
  }));

  check(hydrated.property.status === 'IMPLEMENTED', 'supplied unstatused property output must be represented');
  check(hydrated.property.propertyId === 'PROP-1', 'property payload must survive hydration');
  check(hydrated.evidence.items[0].evidenceId === 'EV-1', 'evidence payload must survive hydration');
  check(hydrated.valuation.amount === 11_250_000, 'valuation output must survive hydration');
  check(hydrated.reconciliation.conclusion === 11_100_000, 'reconciliation output must survive hydration');
  check(hydrated.analyticalPackage.status === 'ANALYTICAL_PACKAGE_READY', 'vertical slice package must be representable');
  check(hydrated.standardsContext.snapshotId === 'STD-SNAPSHOT-001', 'standards snapshot context must be representable');

  for (const key of LIFECYCLE_SECTIONS) {
    check(hydrated.lifecycleCoverage.statuses[key] !== undefined, `lifecycle coverage missing ${key}`);
  }
  check(hydrated.lifecycleCoverage.unresolved.length === 0, 'fully supplied lifecycle must have no unresolved structural section');
  check(hydrated.lifecycleCoverage.status === 'LIFECYCLE_SECTIONS_SUPPLIED', 'fully supplied lifecycle must be structurally complete');
  check(hydrated.lifecycleCoverage.professionalConformanceEstablished === false, 'structural completion must not assert professional conformance');
  check(hydrated.lifecycleCoverage.releaseAuthorized === false, 'structural completion must not authorize release');
  check(hydrated.lifecycleCoverage.transactionAuthorized === false, 'structural completion must not authorize transaction');

  check(hydrated.authority.operatingMode === 'UNLICENSED_DECISION_SUPPORT', 'operating mode must remain fail-closed');
  check(hydrated.authority.certifiedValuationAuthorityEstablished === false, 'certified valuation authority must remain false');
  check(hydrated.authority.professionalReportExternalIssuanceAuthorized === false, 'external professional issuance must remain false');
  check(hydrated.authority.releaseAuthorized === false, 'domain outputs must not self-authorize release');
  check(hydrated.authority.mergeAuthorized === false, 'domain outputs must not self-authorize merge');
  check(hydrated.authority.deploymentAuthorized === false, 'domain outputs must not self-authorize deployment');
  check(hydrated.authority.transactionAuthorized === false, 'domain outputs must not self-authorize transaction');
  check(hydrated.authority.reviewerNote === 'internal-only note', 'non-authority metadata may be retained');

  const first = createExecutableInvestmentCase(baseArgs({ caseId: 'CASE-A' }));
  const second = createExecutableInvestmentCase(baseArgs({ caseId: 'CASE-B' }));
  first.criticalGates.items[0].status = 'MUTATED_FOR_TEST';
  check(second.criticalGates.items[0].status !== 'MUTATED_FOR_TEST', 'critical gate defaults must not share references across cases');

  assert.throws(
    () => createExecutableInvestmentCase(baseArgs({ domainOutputs: [] })),
    /domainOutputs must be an object/,
    'array domainOutputs must fail closed',
  );
  checks += 1;

  console.log(`POST_E2I_EXECUTABLE_CASE_LIFECYCLE=PASS checks=${checks}`);
}

main();
