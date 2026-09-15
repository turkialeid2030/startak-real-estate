'use strict';

const {
  sha256,
} = require('./standards-registry');
const {
  assertRouteProductionReady,
} = require('./purpose-based-standards-router');

const REGULATED_CONTEXT_STATUS = Object.freeze({
  READY: 'READY',
  READY_WITH_REQUIRED_REVIEW: 'READY_WITH_REQUIRED_REVIEW',
  HOLD_STANDARDS_ROUTE: 'HOLD_STANDARDS_ROUTE',
  HOLD_CONTEXT: 'HOLD_CONTEXT',
  HOLD_STANDARD_BINDING: 'HOLD_STANDARD_BINDING',
});

const REGULATED_DOMAIN = Object.freeze({
  FINANCIAL_REPORTING: 'FINANCIAL_REPORTING',
  CMA: 'CMA',
  SAMA: 'SAMA',
});

const AUTHORITY_ROLE = Object.freeze({
  FINANCIAL_REPORTING_STANDARD: 'FINANCIAL_REPORTING_STANDARD',
  LOCAL_ACCOUNTING_ADOPTION: 'LOCAL_ACCOUNTING_ADOPTION',
  CAPITAL_MARKETS_REGULATOR: 'CAPITAL_MARKETS_REGULATOR',
  BANKING_FINANCING_REGULATOR: 'BANKING_FINANCING_REGULATOR',
});

const DOMAIN_ALLOWED_ROLES = Object.freeze({
  [REGULATED_DOMAIN.FINANCIAL_REPORTING]: Object.freeze([
    AUTHORITY_ROLE.FINANCIAL_REPORTING_STANDARD,
    AUTHORITY_ROLE.LOCAL_ACCOUNTING_ADOPTION,
  ]),
  [REGULATED_DOMAIN.CMA]: Object.freeze([
    AUTHORITY_ROLE.CAPITAL_MARKETS_REGULATOR,
  ]),
  [REGULATED_DOMAIN.SAMA]: Object.freeze([
    AUTHORITY_ROLE.BANKING_FINANCING_REGULATOR,
  ]),
});

const DOMAIN_GATE_STATUS = Object.freeze({
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
});

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertNonEmpty(value, field) {
  if (!nonEmpty(value)) throw new TypeError(`${field} must be a non-empty string`);
}

function iso(value, field) {
  assertNonEmpty(value, field);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return date.toISOString();
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function verifyStandardsRouteIntegrity(route) {
  if (!route || typeof route !== 'object' || !/^[a-f0-9]{64}$/i.test(String(route.route_hash || ''))) return false;
  if (!route.context || !Array.isArray(route.selected_ruleset)) return false;
  const payload = {
    schema_version: route.schema_version,
    context: route.context,
    selected_ruleset: [...route.selected_ruleset].sort(),
  };
  return sha256(payload) === route.route_hash.toLowerCase();
}

function normalizeBinding(binding) {
  if (!binding || typeof binding !== 'object') throw new TypeError('binding must be an object');
  if (!Object.values(REGULATED_DOMAIN).includes(binding.domain)) throw new TypeError('binding.domain is invalid');
  if (!Object.values(AUTHORITY_ROLE).includes(binding.authorityRole)) throw new TypeError('binding.authorityRole is invalid');
  assertNonEmpty(binding.standardId, 'binding.standardId');
  assertNonEmpty(binding.rationale, 'binding.rationale');
  assertNonEmpty(binding.evidenceRef, 'binding.evidenceRef');
  if (!DOMAIN_ALLOWED_ROLES[binding.domain].includes(binding.authorityRole)) {
    throw new TypeError(`AUTHORITY_ROLE_NOT_ALLOWED_FOR_DOMAIN:${binding.domain}:${binding.authorityRole}`);
  }
  return deepFreeze({
    domain: binding.domain,
    standardId: binding.standardId.trim(),
    authorityRole: binding.authorityRole,
    rationale: binding.rationale.trim(),
    evidenceRef: binding.evidenceRef.trim(),
  });
}

function hold(status, blockers, context = {}) {
  return deepFreeze({
    schemaVersion: 1,
    regulatedContextId: context.regulatedContextId || null,
    status,
    blockers,
    standardsRouteHash: context.standardsRouteHash || null,
    financialReportingGate: { status: DOMAIN_GATE_STATUS.NOT_APPLICABLE, standardIds: [] },
    cmaGate: { status: DOMAIN_GATE_STATUS.NOT_APPLICABLE, standardIds: [] },
    samaGate: { status: DOMAIN_GATE_STATUS.NOT_APPLICABLE, standardIds: [] },
    valuationArithmeticMutationAllowed: false,
    professionalValueIndicationMutable: false,
    financingCanAlterProfessionalValue: false,
    financialReportingComplianceEstablished: false,
    regulatoryComplianceEstablished: false,
    legalConclusionEstablished: false,
    creditDecisionAuthorized: false,
    regulatedInvestmentAdviceAuthorized: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  });
}

function routeRegulatedContexts({
  regulatedContextId,
  standardsRoute,
  financialReportingRequired,
  financialReportingFramework = null,
  cmaRegulatedContext,
  regulatedEntityStatus = null,
  samaRegulatedFinancingContext,
  financingContext = null,
  bindings = [],
  preparedByRef,
  preparedAt,
  reviewedByRef,
  reviewedAt,
  reviewEvidenceRef,
} = {}) {
  for (const [field, value] of [
    ['regulatedContextId', regulatedContextId], ['preparedByRef', preparedByRef],
    ['reviewedByRef', reviewedByRef], ['reviewEvidenceRef', reviewEvidenceRef],
  ]) assertNonEmpty(value, field);
  for (const [field, value] of [
    ['financialReportingRequired', financialReportingRequired],
    ['cmaRegulatedContext', cmaRegulatedContext],
    ['samaRegulatedFinancingContext', samaRegulatedFinancingContext],
  ]) {
    if (typeof value !== 'boolean') throw new TypeError(`${field} must be boolean`);
  }
  const preparedAtIso = iso(preparedAt, 'preparedAt');
  const reviewedAtIso = iso(reviewedAt, 'reviewedAt');
  if (Date.parse(reviewedAtIso) < Date.parse(preparedAtIso)) throw new TypeError('REGULATED_CONTEXT_REVIEW_BEFORE_PREPARATION');

  const baseContext = {
    regulatedContextId: regulatedContextId.trim(),
    standardsRouteHash: standardsRoute?.route_hash || null,
  };

  if (!verifyStandardsRouteIntegrity(standardsRoute)) {
    return hold(REGULATED_CONTEXT_STATUS.HOLD_STANDARDS_ROUTE, ['STANDARDS_ROUTE_INTEGRITY_FAILED'], baseContext);
  }
  try {
    assertRouteProductionReady(standardsRoute);
  } catch (error) {
    return hold(REGULATED_CONTEXT_STATUS.HOLD_STANDARDS_ROUTE, [`STANDARDS_ROUTE_NOT_PRODUCTION_READY:${error.code || error.message}`], baseContext);
  }

  const contextBlockers = [];
  if (financialReportingRequired && !nonEmpty(financialReportingFramework)) contextBlockers.push('FINANCIAL_REPORTING_FRAMEWORK_REQUIRED');
  if (cmaRegulatedContext && !nonEmpty(regulatedEntityStatus)) contextBlockers.push('REGULATED_ENTITY_STATUS_REQUIRED');
  if (samaRegulatedFinancingContext && !nonEmpty(financingContext)) contextBlockers.push('FINANCING_CONTEXT_REQUIRED');

  if (financialReportingRequired && standardsRoute.context.reporting_framework !== financialReportingFramework) {
    contextBlockers.push('FINANCIAL_REPORTING_FRAMEWORK_ROUTE_MISMATCH');
  }
  if (cmaRegulatedContext && standardsRoute.context.regulated_entity_status !== regulatedEntityStatus) {
    contextBlockers.push('REGULATED_ENTITY_STATUS_ROUTE_MISMATCH');
  }
  if (samaRegulatedFinancingContext && standardsRoute.context.financing_context !== financingContext) {
    contextBlockers.push('FINANCING_CONTEXT_ROUTE_MISMATCH');
  }

  const normalizedBindings = Array.isArray(bindings) ? bindings.map(normalizeBinding) : (() => { throw new TypeError('bindings must be an array'); })();
  const applicable = {
    [REGULATED_DOMAIN.FINANCIAL_REPORTING]: financialReportingRequired,
    [REGULATED_DOMAIN.CMA]: cmaRegulatedContext,
    [REGULATED_DOMAIN.SAMA]: samaRegulatedFinancingContext,
  };

  for (const domain of Object.values(REGULATED_DOMAIN)) {
    if (!applicable[domain] && normalizedBindings.some((binding) => binding.domain === domain)) {
      contextBlockers.push(`NON_APPLICABLE_DOMAIN_HAS_STANDARD_BINDING:${domain}`);
    }
  }
  if (contextBlockers.length) return hold(REGULATED_CONTEXT_STATUS.HOLD_CONTEXT, contextBlockers, baseContext);

  const selectedById = new Map((standardsRoute.selected_standards || []).map((record) => [record.standard_id, record]));
  const bindingBlockers = [];
  const domainStandardIds = {};
  const seenBindingKeys = new Set();

  for (const domain of Object.values(REGULATED_DOMAIN)) {
    const domainBindings = normalizedBindings.filter((binding) => binding.domain === domain);
    domainStandardIds[domain] = [];
    if (applicable[domain] && domainBindings.length === 0) bindingBlockers.push(`STANDARD_BINDING_REQUIRED:${domain}`);
    for (const binding of domainBindings) {
      const key = `${binding.domain}:${binding.standardId}:${binding.authorityRole}`;
      if (seenBindingKeys.has(key)) bindingBlockers.push(`DUPLICATE_STANDARD_BINDING:${key}`);
      seenBindingKeys.add(key);
      const selected = selectedById.get(binding.standardId);
      if (!selected) {
        bindingBlockers.push(`BOUND_STANDARD_NOT_SELECTED:${domain}:${binding.standardId}`);
        continue;
      }
      if (selected.status !== 'ACTIVE') bindingBlockers.push(`BOUND_STANDARD_NOT_ACTIVE:${domain}:${binding.standardId}:${selected.status || 'UNKNOWN'}`);
      domainStandardIds[domain].push(binding.standardId);
    }
    domainStandardIds[domain] = [...new Set(domainStandardIds[domain])].sort();
  }
  if (bindingBlockers.length) return hold(REGULATED_CONTEXT_STATUS.HOLD_STANDARD_BINDING, bindingBlockers, baseContext);

  const gate = (domain) => deepFreeze({
    status: applicable[domain] ? DOMAIN_GATE_STATUS.REVIEW_REQUIRED : DOMAIN_GATE_STATUS.NOT_APPLICABLE,
    standardIds: applicable[domain] ? domainStandardIds[domain] : [],
  });

  const anyApplicable = Object.values(applicable).some(Boolean);
  const core = {
    schemaVersion: 1,
    regulatedContextId: regulatedContextId.trim(),
    standardsRouteHash: standardsRoute.route_hash,
    standardsSnapshotHash: standardsRoute.standards_snapshot?.standards_snapshot_version || null,
    routeAsOfDate: standardsRoute.context.as_of_date,
    financialReportingRequired,
    financialReportingFramework: financialReportingRequired ? financialReportingFramework : null,
    cmaRegulatedContext,
    regulatedEntityStatus: cmaRegulatedContext ? regulatedEntityStatus : null,
    samaRegulatedFinancingContext,
    financingContext: samaRegulatedFinancingContext ? financingContext : null,
    bindings: normalizedBindings,
    financialReportingGate: gate(REGULATED_DOMAIN.FINANCIAL_REPORTING),
    cmaGate: gate(REGULATED_DOMAIN.CMA),
    samaGate: gate(REGULATED_DOMAIN.SAMA),
    preparedByRef: preparedByRef.trim(),
    preparedAt: preparedAtIso,
    reviewedByRef: reviewedByRef.trim(),
    reviewedAt: reviewedAtIso,
    reviewEvidenceRef: reviewEvidenceRef.trim(),
  };

  return deepFreeze({
    ...core,
    regulatedContextHashSha256: sha256(core),
    status: anyApplicable ? REGULATED_CONTEXT_STATUS.READY_WITH_REQUIRED_REVIEW : REGULATED_CONTEXT_STATUS.READY,
    blockers: [],
    accountingProfessionalReviewRequired: financialReportingRequired,
    regulatoryProfessionalReviewRequired: cmaRegulatedContext || samaRegulatedFinancingContext,
    legalOrComplianceReviewRequired: cmaRegulatedContext || samaRegulatedFinancingContext,
    valuationArithmeticMutationAllowed: false,
    professionalValueIndicationMutable: false,
    financingCanAlterProfessionalValue: false,
    automaticAccountingClassificationPerformed: false,
    automaticRegulatoryApplicabilityConclusionPerformed: false,
    financialReportingComplianceEstablished: false,
    regulatoryComplianceEstablished: false,
    legalConclusionEstablished: false,
    creditDecisionAuthorized: false,
    regulatedInvestmentAdviceAuthorized: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    semantics: 'This router records explicit reviewer-bound financial-reporting and regulated-context applicability using only ACTIVE standards already selected by the qualified standards route. It does not change valuation arithmetic, classify accounting treatment automatically, establish regulatory/legal compliance, approve credit, provide regulated investment advice, certify a valuation or authorize a transaction.',
  });
}

function verifyRegulatedContextIntegrity(result) {
  if (!result || !/^[a-f0-9]{64}$/i.test(String(result.regulatedContextHashSha256 || ''))) return false;
  const core = { ...result };
  [
    'regulatedContextHashSha256', 'status', 'blockers', 'accountingProfessionalReviewRequired',
    'regulatoryProfessionalReviewRequired', 'legalOrComplianceReviewRequired', 'valuationArithmeticMutationAllowed',
    'professionalValueIndicationMutable', 'financingCanAlterProfessionalValue', 'automaticAccountingClassificationPerformed',
    'automaticRegulatoryApplicabilityConclusionPerformed', 'financialReportingComplianceEstablished',
    'regulatoryComplianceEstablished', 'legalConclusionEstablished', 'creditDecisionAuthorized',
    'regulatedInvestmentAdviceAuthorized', 'certifiedValuationEstablished', 'transactionAuthorized', 'semantics',
  ].forEach((key) => delete core[key]);
  return sha256(core) === result.regulatedContextHashSha256.toLowerCase();
}

module.exports = {
  REGULATED_CONTEXT_STATUS,
  REGULATED_DOMAIN,
  AUTHORITY_ROLE,
  DOMAIN_GATE_STATUS,
  verifyStandardsRouteIntegrity,
  routeRegulatedContexts,
  verifyRegulatedContextIntegrity,
};
