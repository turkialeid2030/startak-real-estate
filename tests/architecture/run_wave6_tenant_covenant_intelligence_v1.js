'use strict';

const assert = require('assert');
const {
  TENANT_EVIDENCE_STATUS,
  TENANT_RESULT_STATUS,
  AXIS,
  TENANT_CLASS,
  createTenantEvidenceFact,
  createTenantPolicyProfile,
  validatePolicy,
  resolveGuaranteeRequirement,
  createTenantFactsFromUniversalEvidence,
  assessTenant,
  createTenantDecisionSupportEnvelope,
} = require('../../src/tenant-intelligence');
const {
  createDocumentRecord,
  DOCUMENT_TYPE,
  AUTHORITY_CLASS,
  LOCATOR_KIND,
} = require('../../src/document-intelligence/contracts');
const {
  createParsedAtom,
  createParserResult,
  PARSER_FORMAT,
  PARSER_STATUS,
  PARSED_ATOM_KIND,
} = require('../../src/document-intelligence/parsers/contracts');
const {
  ASSET_CLASS,
  LIFECYCLE_STAGE,
  INVESTMENT_STRATEGY,
  INCOME_MODEL,
  createProjectProfile,
} = require('../../src/project-model/project-profile');
const {
  orchestrateProjectEvidence,
} = require('../../src/project-model/universal-evidence-orchestrator');

let checks = 0;
function check(fn) { fn(); checks += 1; }

const TENANT_ID = 'TENANT-SYNTHETIC-001';
const OBSERVED_AT = '2026-06-26T12:00:00.000Z';

const required60Keys = [
  'creditReport',
  'enforcementCases',
  'bankruptcyProceedings',
  'priorContractualRentalBehaviour',
  'businessAge',
  'sectorStability',
  'useCompatibility',
  'guaranteeStrength',
  'sectorRisk',
];

function valueForKey(key) {
  if (key === 'enforcementCases' || key === 'bankruptcyProceedings') return false;
  if (key === 'businessAge') return 12;
  return `SYNTHETIC_${key}`;
}

function fact(key, {
  score = 1,
  status = TENANT_EVIDENCE_STATUS.VERIFIED,
  sourceRef = `SYNTH:${key}`,
  observedAt = OBSERVED_AT,
  value = valueForKey(key),
} = {}) {
  return createTenantEvidenceFact({
    tenantId: TENANT_ID,
    key,
    value,
    score,
    status,
    sourceType: 'SYNTHETIC_TEST_FIXTURE',
    sourceRef,
    observedAt,
  });
}

function full60Facts() {
  return required60Keys.map((key) => fact(key));
}

function assess60(facts = full60Facts(), extra = {}) {
  return assessTenant({
    tenantId: TENANT_ID,
    facts,
    annualRent: 2000000,
    annualContractValue: 2000000,
    ...extra,
  });
}

const policy = createTenantPolicyProfile();

check(() => assert.strictEqual(validatePolicy(policy), policy));
check(() => assert.strictEqual(policy.policyId, 'TENANT_POLICY_PROFILE_REFERENCE_V1'));
check(() => assert.strictEqual(policy.version, 1));
check(() => assert.throws(
  () => createTenantPolicyProfile({
    axes: {
      [AXIS.SECTOR_RISK]: {
        weight: 11,
        items: [{ key: 'sectorRisk', weight: 11, required: true }],
      },
    },
  }),
  /axis weights must sum to 100/,
));

const baseline = assess60();
check(() => assert.strictEqual(baseline.status, TENANT_RESULT_STATUS.TENANT_ANALYTICAL_FAVOURABLE));
check(() => assert.strictEqual(baseline.rawWeightedPoints, 60));
check(() => assert.strictEqual(baseline.assessedWeight, 60));
check(() => assert.strictEqual(baseline.policyDecisionBasis, 'RAW_WEIGHTED_POINTS_NO_RENORMALIZATION'));
check(() => assert.strictEqual(baseline.financialCapacityApplicability, 'EXCLUDED_BY_REFERENCE_POLICY'));
check(() => assert.strictEqual(baseline.axes.find((axis) => axis.axis === AXIS.FINANCIAL_CAPACITY).status, 'NOT_APPLICABLE_BY_REFERENCE_POLICY'));
check(() => assert.strictEqual(baseline.transactionAuthorized, false));
check(() => assert.strictEqual(baseline.certifiedCreditRating, false));
check(() => assert.strictEqual(baseline.legalOpinionEstablished, false));
check(() => assert.deepStrictEqual(baseline.policy, { policyId: 'TENANT_POLICY_PROFILE_REFERENCE_V1', version: 1 }));
check(() => assert.deepStrictEqual(assess60([...full60Facts()].reverse()), baseline));

const v2 = createTenantPolicyProfile({ version: 2 });
const v2Result = assess60(full60Facts(), { policy: v2 });
check(() => assert.deepStrictEqual(v2Result.policy, { policyId: 'TENANT_POLICY_PROFILE_REFERENCE_V1', version: 2 }));

const missingDateFacts = full60Facts().map((item) =>
  item.key === 'guaranteeStrength' ? fact('guaranteeStrength', { observedAt: null }) : item
);
const missingDate = assess60(missingDateFacts);
check(() => assert.strictEqual(missingDate.status, TENANT_RESULT_STATUS.HOLD_EVIDENCE));
check(() => assert.ok(missingDate.evidenceGaps.some((gap) => gap.key === 'guaranteeStrength' && gap.code === 'EVIDENCE_DATE_REQUIRED')));

const missingSourceFacts = full60Facts().map((item) =>
  item.key === 'guaranteeStrength' ? fact('guaranteeStrength', { sourceRef: null }) : item
);
const missingSource = assess60(missingSourceFacts);
check(() => assert.strictEqual(missingSource.status, TENANT_RESULT_STATUS.HOLD_EVIDENCE));
check(() => assert.ok(missingSource.evidenceGaps.some((gap) => gap.code === 'EVIDENCE_PROVENANCE_REQUIRED')));

for (const unsafeStatus of [TENANT_EVIDENCE_STATUS.UNVERIFIED, TENANT_EVIDENCE_STATUS.ASSUMED]) {
  const unsafeFacts = full60Facts().map((item) =>
    item.key === 'guaranteeStrength' ? fact('guaranteeStrength', { status: unsafeStatus }) : item
  );
  const result = assess60(unsafeFacts);
  check(() => assert.strictEqual(result.status, TENANT_RESULT_STATUS.HOLD_EVIDENCE));
  check(() => assert.ok(result.evidenceGaps.some((gap) => gap.key === 'guaranteeStrength' && gap.code === 'EVIDENCE_STATUS_NOT_QUALIFIED')));
}

const contradictory = [
  ...full60Facts().filter((item) => item.key !== 'guaranteeStrength'),
  fact('guaranteeStrength', { value: 'STRONG', sourceRef: 'SYNTH:G:1' }),
  fact('guaranteeStrength', { value: 'WEAK', sourceRef: 'SYNTH:G:2' }),
];
const conflictResult = assess60(contradictory);
check(() => assert.strictEqual(conflictResult.status, TENANT_RESULT_STATUS.HOLD_EVIDENCE));
check(() => assert.ok(conflictResult.conflicts.some((item) => item.key === 'guaranteeStrength')));

const evidenceDeclaredNA = [
  ...full60Facts().filter((item) => item.key !== 'guaranteeStrength'),
  fact('guaranteeStrength', { score: null, status: TENANT_EVIDENCE_STATUS.NOT_APPLICABLE }),
];
const naResult = assess60(evidenceDeclaredNA);
check(() => assert.strictEqual(naResult.status, TENANT_RESULT_STATUS.HOLD_POLICY));
check(() => assert.ok(naResult.policyGaps.some((gap) => gap.key === 'guaranteeStrength' && gap.code === 'EXPLICIT_POLICY_RULE_REQUIRED_FOR_NOT_APPLICABLE')));

const highRentRequiredFacts = full60Facts();
const highRent = assessTenant({
  tenantId: TENANT_ID,
  facts: highRentRequiredFacts,
  annualRent: 4000000,
  annualContractValue: 5000000,
});
check(() => assert.strictEqual(highRent.status, TENANT_RESULT_STATUS.HOLD_EVIDENCE));
check(() => assert.ok(highRent.evidenceGaps.some((gap) => gap.key === 'auditedFinancialStatements3Y' && gap.code === 'REQUIRED_EVIDENCE_MISSING')));

const annualRevenueFact = createTenantEvidenceFact({
  tenantId: TENANT_ID,
  key: 'annualRevenue',
  value: 20000000,
  score: null,
  status: TENANT_EVIDENCE_STATUS.VERIFIED,
  sourceType: 'SYNTHETIC_FINANCIAL_STATEMENT',
  sourceRef: 'SYNTH:FS:2026',
  observedAt: OBSERVED_AT,
});
const affordable = assess60([...full60Facts(), annualRevenueFact], {
  annualRevenue: 20000000,
  tenantClass: TENANT_CLASS.LARGE,
});
check(() => assert.strictEqual(affordable.affordability.status, 'PASS'));
check(() => assert.strictEqual(affordable.affordability.ratio, 0.1));
check(() => assert.strictEqual(affordable.affordability.sourceRef, 'SYNTH:FS:2026'));

const mismatchRevenue = assess60([...full60Facts(), annualRevenueFact], {
  annualRevenue: 19000000,
  tenantClass: TENANT_CLASS.LARGE,
});
check(() => assert.strictEqual(mismatchRevenue.status, TENANT_RESULT_STATUS.HOLD_EVIDENCE));
check(() => assert.ok(mismatchRevenue.evidenceGaps.some((gap) => gap.code === 'ANNUAL_REVENUE_EVIDENCE_VALUE_MISMATCH')));

check(() => assert.deepStrictEqual(resolveGuaranteeRequirement(2000000, policy).requirement, 'AS_POLICY'));
check(() => assert.deepStrictEqual(resolveGuaranteeRequirement(5000000, policy).requirement, 'BANK_GUARANTEE'));
check(() => assert.deepStrictEqual(resolveGuaranteeRequirement(15000000, policy).requirement, 'BANK_GUARANTEE_PLUS_PARENT_GUARANTEE'));
check(() => assert.strictEqual(resolveGuaranteeRequirement(2500000, policy).status, 'HOLD_POLICY'));

const legalFacts = full60Facts().map((item) =>
  item.key === 'enforcementCases' ? fact('enforcementCases', { value: true }) : item
);
const legalResult = assess60(legalFacts);
check(() => assert.strictEqual(legalResult.status, TENANT_RESULT_STATUS.LEGAL_REVIEW_REQUIRED));
check(() => assert.strictEqual(legalResult.legalOpinionEstablished, false));

const external = createTenantDecisionSupportEnvelope(baseline, { locale: 'en' });
check(() => assert.strictEqual(external.outputType, 'SCREENING_RESULT'));
check(() => assert.strictEqual(external.transactionAuthorized, false));
check(() => assert.strictEqual(external.certifiedValuation, false));
check(() => assert.strictEqual(external.legalOpinionEstablished, false));
check(() => assert.ok(!/\b(approve tenant|reject tenant|credit rating|legal clear)\b/i.test(JSON.stringify(external))));

const externalLegal = createTenantDecisionSupportEnvelope(legalResult, { locale: 'en' });
check(() => assert.strictEqual(externalLegal.outputType, 'REQUIRES_LICENSED_REVIEW'));
check(() => assert.strictEqual(externalLegal.licensedReviewRequired, true));
check(() => assert.strictEqual(externalLegal.transactionAuthorized, false));

const profile = createProjectProfile({
  projectId: 'PROJECT-SYNTHETIC-TENANT',
  projectName: 'Synthetic tenant covenant integration fixture',
  assetClasses: [ASSET_CLASS.RETAIL],
  lifecycleStage: LIFECYCLE_STAGE.EXISTING_OPERATING,
  investmentStrategy: INVESTMENT_STRATEGY.ACQUIRE_HOLD,
  incomeModel: INCOME_MODEL.LEASE_INCOME,
  jurisdiction: { country: 'SA' },
});

function syntheticRevenueBundle({ documentId, hashChar, revenue }) {
  const document = createDocumentRecord({
    documentId,
    caseId: 'CASE-SYNTHETIC-TENANT',
    fileName: `${documentId}.xlsx`,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    sizeBytes: 256,
    contentHashSha256: hashChar.repeat(64),
    documentType: DOCUMENT_TYPE.FINANCIAL_MODEL,
    authorityClass: AUTHORITY_CLASS.INTERNAL_MODEL,
    receivedAt: OBSERVED_AT,
  });
  const adapterId = 'SYNTHETIC_XLSX_ADAPTER';
  const atoms = [
    createParsedAtom({
      atomId: `${documentId}:A1`,
      document,
      adapterId,
      kind: PARSED_ATOM_KIND.CELL,
      rawValue: 'الإيرادات السنوية للمستأجر',
      valueType: 'STRING',
      location: { kind: LOCATOR_KIND.CELL, sheet: 'Tenant', cell: 'A1' },
    }),
    createParsedAtom({
      atomId: `${documentId}:B1`,
      document,
      adapterId,
      kind: PARSED_ATOM_KIND.CELL,
      rawValue: revenue,
      valueType: 'NUMBER',
      location: { kind: LOCATOR_KIND.CELL, sheet: 'Tenant', cell: 'B1' },
    }),
  ];
  const parserResult = createParserResult({
    document,
    adapterId,
    format: PARSER_FORMAT.XLSX,
    status: PARSER_STATUS.PARSED,
    atoms,
  });
  return { document, parserResult };
}

const orchestration = orchestrateProjectEvidence({
  profile,
  caseId: 'CASE-SYNTHETIC-TENANT',
  parsedDocuments: [syntheticRevenueBundle({ documentId: 'DOC-REV-1', hashChar: 'a', revenue: 20000000 })],
  semanticRequirements: [],
  capturedAt: OBSERVED_AT,
});
check(() => assert.ok(orchestration.facts.some((item) => item.key === 'tenant.annual_revenue' && item.normalizedValue === 20000000)));
check(() => {
  const rec = orchestration.reconciliations.find((item) => item.key === 'tenant.annual_revenue');
  assert.ok(rec);
  assert.strictEqual(rec.evidence[0].capturedAt, OBSERVED_AT);
  assert.strictEqual(rec.evidence[0].documentId, 'DOC-REV-1');
});

const universal = createTenantFactsFromUniversalEvidence({
  tenantId: TENANT_ID,
  orchestration,
  keyMap: { annualRevenue: 'tenant.annual_revenue' },
});
check(() => assert.strictEqual(universal.transactionAuthorized, false));
check(() => assert.strictEqual(universal.facts.length, 1));
check(() => assert.strictEqual(universal.facts[0].score, null));
check(() => assert.strictEqual(universal.facts[0].status, TENANT_EVIDENCE_STATUS.UNVERIFIED));
check(() => assert.strictEqual(universal.facts[0].observedAt, OBSERVED_AT));
check(() => assert.strictEqual(universal.facts[0].provenance[0].documentId, 'DOC-REV-1'));
check(() => assert.strictEqual(universal.facts[0].provenance[0].capturedAt, OBSERVED_AT));

const unverifiedUniversalAssessment = assess60([...full60Facts(), ...universal.facts], {
  annualRevenue: 20000000,
  tenantClass: TENANT_CLASS.LARGE,
});
check(() => assert.strictEqual(unverifiedUniversalAssessment.status, TENANT_RESULT_STATUS.HOLD_EVIDENCE));
check(() => assert.ok(unverifiedUniversalAssessment.evidenceGaps.some((gap) => gap.code === 'EVIDENCE_STATUS_NOT_QUALIFIED')));

const conflictOrchestration = orchestrateProjectEvidence({
  profile,
  caseId: 'CASE-SYNTHETIC-TENANT',
  parsedDocuments: [
    syntheticRevenueBundle({ documentId: 'DOC-REV-1', hashChar: 'a', revenue: 20000000 }),
    syntheticRevenueBundle({ documentId: 'DOC-REV-2', hashChar: 'b', revenue: 22000000 }),
  ],
  semanticRequirements: [],
  capturedAt: OBSERVED_AT,
});
const universalConflict = createTenantFactsFromUniversalEvidence({
  tenantId: TENANT_ID,
  orchestration: conflictOrchestration,
  keyMap: { annualRevenue: 'tenant.annual_revenue' },
});
check(() => assert.strictEqual(universalConflict.facts[0].status, TENANT_EVIDENCE_STATUS.CONFLICT));
check(() => assert.strictEqual(universalConflict.conflicts.length, 1));
check(() => assert.strictEqual(universalConflict.facts[0].score, null));
check(() => assert.strictEqual(universalConflict.facts[0].provenance.length, 2));

const conflictAssessment = assess60([...full60Facts(), ...universalConflict.facts], {
  annualRevenue: 20000000,
  tenantClass: TENANT_CLASS.LARGE,
});
check(() => assert.strictEqual(conflictAssessment.status, TENANT_RESULT_STATUS.HOLD_EVIDENCE));
check(() => assert.ok(conflictAssessment.conflicts.some((item) => item.key === 'annualRevenue')));

console.log(`TENANT_COVENANT_INTELLIGENCE = PASS (${checks} checks)`);
