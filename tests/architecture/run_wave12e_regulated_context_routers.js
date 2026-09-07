'use strict';

const assert = require('assert');
const { sha256 } = require('../../src/standards/standards-registry');
const {
  REGULATED_CONTEXT_STATUS,
  REGULATED_DOMAIN,
  AUTHORITY_ROLE,
  DOMAIN_GATE_STATUS,
  verifyStandardsRouteIntegrity,
  routeRegulatedContexts,
  verifyRegulatedContextIntegrity,
} = require('../../src/standards/regulated-context-router');

let checks = 0;
function check(value, message) { assert.ok(value, message); checks += 1; }
function equal(actual, expected, message) { assert.strictEqual(actual, expected, message); checks += 1; }
function throws(fn, re, message) { assert.throws(fn, re, message); checks += 1; }

const routeContext = Object.freeze({
  jurisdiction: 'SAUDI_ARABIA',
  valuation_purpose: 'FINANCIAL_REPORTING',
  intended_use: 'INSTITUTIONAL_REPORTING',
  intended_user: 'BOARD_AND_AUDITOR',
  asset_type: 'INVESTMENT_PROPERTY',
  reporting_framework: 'IFRS_SOCPA',
  regulated_entity_status: 'CMA_REGULATED_REIT',
  transaction_context: null,
  financing_context: 'SAMA_REGULATED_LENDER_REVIEW',
  as_of_date: '2026-09-01T00:00:00.000Z',
});

function standard(id, version = '2026', status = 'ACTIVE') {
  return Object.freeze({ standard_id: id, version, status });
}

const selectedStandards = Object.freeze([
  standard('IFRS-FR-001'),
  standard('SOCPA-ADOPTION-001'),
  standard('CMA-REG-001'),
  standard('SAMA-FIN-001'),
]);

function makeRoute({
  context = routeContext,
  selected = selectedStandards,
  selectedRuleset = selected.map((item) => `${item.standard_id}@${item.version}`).sort(),
  snapshotSelected = selected.map((item) => ({ standard_id: item.standard_id, version: item.version, status: item.status })),
  routeHash = null,
} = {}) {
  const payload = {
    schema_version: 1,
    context,
    selected_ruleset: [...selectedRuleset].sort(),
  };
  return Object.freeze({
    ...payload,
    route_hash: routeHash || sha256(payload),
    selected_standards: selected,
    standards_snapshot: Object.freeze({
      standards_snapshot_version: 'a'.repeat(64),
      selected: Object.freeze(snapshotSelected),
    }),
  });
}

const bindings = Object.freeze([
  Object.freeze({
    domain: REGULATED_DOMAIN.FINANCIAL_REPORTING,
    standardId: 'IFRS-FR-001',
    authorityRole: AUTHORITY_ROLE.FINANCIAL_REPORTING_STANDARD,
    rationale: 'Explicit reporting-framework standard selected by professional reviewer',
    evidenceRef: 'EVID-IFRS',
  }),
  Object.freeze({
    domain: REGULATED_DOMAIN.FINANCIAL_REPORTING,
    standardId: 'SOCPA-ADOPTION-001',
    authorityRole: AUTHORITY_ROLE.LOCAL_ACCOUNTING_ADOPTION,
    rationale: 'Explicit local accounting adoption reference selected by professional reviewer',
    evidenceRef: 'EVID-SOCPA',
  }),
  Object.freeze({
    domain: REGULATED_DOMAIN.CMA,
    standardId: 'CMA-REG-001',
    authorityRole: AUTHORITY_ROLE.CAPITAL_MARKETS_REGULATOR,
    rationale: 'Explicit capital-markets regulator reference selected for the regulated entity context',
    evidenceRef: 'EVID-CMA',
  }),
  Object.freeze({
    domain: REGULATED_DOMAIN.SAMA,
    standardId: 'SAMA-FIN-001',
    authorityRole: AUTHORITY_ROLE.BANKING_FINANCING_REGULATOR,
    rationale: 'Explicit banking/financing regulator reference selected for lender context',
    evidenceRef: 'EVID-SAMA',
  }),
]);

function build(overrides = {}) {
  return routeRegulatedContexts({
    regulatedContextId: 'REGCTX-12E-001',
    standardsRoute: makeRoute(),
    financialReportingRequired: true,
    financialReportingFramework: 'IFRS_SOCPA',
    cmaRegulatedContext: true,
    regulatedEntityStatus: 'CMA_REGULATED_REIT',
    samaRegulatedFinancingContext: true,
    financingContext: 'SAMA_REGULATED_LENDER_REVIEW',
    bindings,
    preparedByRef: 'VALUATION-TEAM',
    preparedAt: '2026-09-02T09:00:00.000Z',
    reviewedByRef: 'COMPLIANCE-REVIEWER',
    reviewedAt: '2026-09-02T12:00:00.000Z',
    reviewEvidenceRef: 'REVIEW-12E-001',
    ...overrides,
  });
}

const route = makeRoute();
check(verifyStandardsRouteIntegrity(route), 'qualified standards route integrity');

const result = build();
equal(result.status, REGULATED_CONTEXT_STATUS.READY_WITH_REQUIRED_REVIEW, 'regulated contexts route with required review');
check(verifyRegulatedContextIntegrity(result), 'regulated context result integrity');
equal(result.financialReportingGate.status, DOMAIN_GATE_STATUS.REVIEW_REQUIRED, 'financial reporting gate requires professional review');
equal(result.cmaGate.status, DOMAIN_GATE_STATUS.REVIEW_REQUIRED, 'CMA gate requires professional/compliance review');
equal(result.samaGate.status, DOMAIN_GATE_STATUS.REVIEW_REQUIRED, 'SAMA gate requires professional/compliance review');
equal(result.financialReportingGate.standardIds.length, 2, 'two explicit financial reporting bindings retained');
equal(result.cmaGate.standardIds[0], 'CMA-REG-001', 'CMA selected standard retained');
equal(result.samaGate.standardIds[0], 'SAMA-FIN-001', 'SAMA selected standard retained');
equal(result.accountingProfessionalReviewRequired, true, 'accounting professional review explicitly required');
equal(result.regulatoryProfessionalReviewRequired, true, 'regulatory professional review explicitly required');
equal(result.legalOrComplianceReviewRequired, true, 'regulated context requires legal/compliance review before conclusions');
equal(result.valuationArithmeticMutationAllowed, false, 'router cannot change valuation arithmetic');
equal(result.professionalValueIndicationMutable, false, 'router cannot change professional property value indication');
equal(result.financingCanAlterProfessionalValue, false, 'financing context cannot change professional property value');
equal(result.automaticAccountingClassificationPerformed, false, 'no automatic accounting classification');
equal(result.automaticRegulatoryApplicabilityConclusionPerformed, false, 'no automatic legal/regulatory applicability conclusion');
equal(result.financialReportingComplianceEstablished, false, 'no financial reporting compliance claim');
equal(result.regulatoryComplianceEstablished, false, 'no regulatory compliance claim');
equal(result.legalConclusionEstablished, false, 'no legal conclusion');
equal(result.creditDecisionAuthorized, false, 'no credit decision');
equal(result.regulatedInvestmentAdviceAuthorized, false, 'no regulated advice authorization');
equal(result.certifiedValuationEstablished, false, 'no certified valuation');
equal(result.transactionAuthorized, false, 'no transaction authority');
check(/^[a-f0-9]{64}$/.test(result.regulatedContextHashSha256), 'regulated context deterministic hash');

const tamperedResult = { ...result, financialReportingFramework: 'OTHER' };
equal(verifyRegulatedContextIntegrity(tamperedResult), false, 'tampered regulated result fails integrity');

const tamperedRoute = { ...route, route_hash: 'f'.repeat(64) };
equal(build({ standardsRoute: tamperedRoute }).status, REGULATED_CONTEXT_STATUS.HOLD_STANDARDS_ROUTE, 'tampered standards route blocked');

const missingReportingBinding = bindings.filter((binding) => binding.domain !== REGULATED_DOMAIN.FINANCIAL_REPORTING);
const missingReporting = build({ bindings: missingReportingBinding });
equal(missingReporting.status, REGULATED_CONTEXT_STATUS.HOLD_STANDARD_BINDING, 'financial reporting domain requires explicit selected standard binding');
check(missingReporting.blockers.includes('STANDARD_BINDING_REQUIRED:FINANCIAL_REPORTING'), 'financial reporting binding blocker explicit');

const missingCmaBinding = bindings.filter((binding) => binding.domain !== REGULATED_DOMAIN.CMA);
equal(build({ bindings: missingCmaBinding }).status, REGULATED_CONTEXT_STATUS.HOLD_STANDARD_BINDING, 'CMA context requires explicit selected standard binding');

const unknownStandardBinding = bindings.map((binding) => binding.domain === REGULATED_DOMAIN.SAMA
  ? { ...binding, standardId: 'SAMA-NOT-SELECTED' }
  : binding);
const unknownStandard = build({ bindings: unknownStandardBinding });
equal(unknownStandard.status, REGULATED_CONTEXT_STATUS.HOLD_STANDARD_BINDING, 'unselected standard cannot support regulated domain');
check(unknownStandard.blockers.some((item) => item.includes('BOUND_STANDARD_NOT_SELECTED:SAMA:SAMA-NOT-SELECTED')), 'unselected standard blocker explicit');

const duplicate = build({ bindings: [...bindings, bindings[2]] });
equal(duplicate.status, REGULATED_CONTEXT_STATUS.HOLD_STANDARD_BINDING, 'duplicate authority binding blocked');
check(duplicate.blockers.some((item) => item.startsWith('DUPLICATE_STANDARD_BINDING:')), 'duplicate binding reason explicit');

const frameworkMismatchRoute = makeRoute({ context: { ...routeContext, reporting_framework: 'OTHER_FRAMEWORK' } });
equal(build({ standardsRoute: frameworkMismatchRoute }).status, REGULATED_CONTEXT_STATUS.HOLD_CONTEXT, 'reporting framework must match qualified standards route context');

const entityMismatchRoute = makeRoute({ context: { ...routeContext, regulated_entity_status: 'OTHER_ENTITY' } });
equal(build({ standardsRoute: entityMismatchRoute }).status, REGULATED_CONTEXT_STATUS.HOLD_CONTEXT, 'regulated entity status must match qualified route');

const financingMismatchRoute = makeRoute({ context: { ...routeContext, financing_context: 'OTHER_FINANCING' } });
equal(build({ standardsRoute: financingMismatchRoute }).status, REGULATED_CONTEXT_STATUS.HOLD_CONTEXT, 'financing context must match qualified route');

const nonActive = [standard('IFRS-FR-001'), standard('SOCPA-ADOPTION-001'), standard('CMA-REG-001', '2026', 'DRAFT'), standard('SAMA-FIN-001')];
const nonActiveRoute = makeRoute({ selected: nonActive });
equal(build({ standardsRoute: nonActiveRoute }).status, REGULATED_CONTEXT_STATUS.HOLD_STANDARDS_ROUTE, 'non-ACTIVE selected standard blocked by production route assertion');

const missingFramework = build({ financialReportingFramework: null });
equal(missingFramework.status, REGULATED_CONTEXT_STATUS.HOLD_CONTEXT, 'missing reporting framework blocked');
check(missingFramework.blockers.includes('FINANCIAL_REPORTING_FRAMEWORK_REQUIRED'), 'missing reporting framework blocker explicit');

const notApplicable = routeRegulatedContexts({
  regulatedContextId: 'REGCTX-NONE',
  standardsRoute: route,
  financialReportingRequired: false,
  cmaRegulatedContext: false,
  samaRegulatedFinancingContext: false,
  bindings: [],
  preparedByRef: 'TEAM',
  preparedAt: '2026-09-02T09:00:00.000Z',
  reviewedByRef: 'REVIEWER',
  reviewedAt: '2026-09-02T10:00:00.000Z',
  reviewEvidenceRef: 'REVIEW-NONE',
});
equal(notApplicable.status, REGULATED_CONTEXT_STATUS.READY, 'no regulated context returns ready without inventing obligations');
equal(notApplicable.financialReportingGate.status, DOMAIN_GATE_STATUS.NOT_APPLICABLE, 'financial reporting gate not applicable explicitly');
equal(notApplicable.cmaGate.status, DOMAIN_GATE_STATUS.NOT_APPLICABLE, 'CMA gate not applicable explicitly');
equal(notApplicable.samaGate.status, DOMAIN_GATE_STATUS.NOT_APPLICABLE, 'SAMA gate not applicable explicitly');
check(verifyRegulatedContextIntegrity(notApplicable), 'not-applicable route remains integrity verifiable');

const strayBinding = routeRegulatedContexts({
  regulatedContextId: 'REGCTX-STRAY',
  standardsRoute: route,
  financialReportingRequired: false,
  cmaRegulatedContext: false,
  samaRegulatedFinancingContext: false,
  bindings: [bindings[2]],
  preparedByRef: 'TEAM',
  preparedAt: '2026-09-02T09:00:00.000Z',
  reviewedByRef: 'REVIEWER',
  reviewedAt: '2026-09-02T10:00:00.000Z',
  reviewEvidenceRef: 'REVIEW-STRAY',
});
equal(strayBinding.status, REGULATED_CONTEXT_STATUS.HOLD_CONTEXT, 'binding cannot silently create regulated applicability');
check(strayBinding.blockers.includes('NON_APPLICABLE_DOMAIN_HAS_STANDARD_BINDING:CMA'), 'stray CMA binding blocker explicit');

throws(() => routeRegulatedContexts({
  regulatedContextId: 'BAD-REVIEW', standardsRoute: route,
  financialReportingRequired: false, cmaRegulatedContext: false, samaRegulatedFinancingContext: false,
  bindings: [], preparedByRef: 'TEAM', preparedAt: '2026-09-02T12:00:00.000Z', reviewedByRef: 'R',
  reviewedAt: '2026-09-02T11:00:00.000Z', reviewEvidenceRef: 'R',
}), /REGULATED_CONTEXT_REVIEW_BEFORE_PREPARATION/, 'review cannot precede preparation');

throws(() => build({ bindings: [{
  domain: REGULATED_DOMAIN.CMA,
  standardId: 'CMA-REG-001',
  authorityRole: AUTHORITY_ROLE.FINANCIAL_REPORTING_STANDARD,
  rationale: 'wrong role',
  evidenceRef: 'EVID-WRONG',
}] }), /AUTHORITY_ROLE_NOT_ALLOWED_FOR_DOMAIN/, 'authority role cannot be reused across wrong regulator domain');

console.log(`WAVE_12E_REGULATED_CONTEXT_ROUTERS=PASS checks=${checks}`);
