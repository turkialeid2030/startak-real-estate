'use strict';

const {
  STANDARD_STATUS,
  validateStandardRecord,
  selectProductionStandards,
  createStandardsSnapshot,
  assertNoNonActiveProductionStandards,
  sha256,
} = require('./standards-registry');

const ROUTE_STATUS = Object.freeze({
  READY: 'READY',
  READY_WITH_WARNINGS: 'READY_WITH_WARNINGS',
  NO_ACTIVE_STANDARD: 'NO_ACTIVE_STANDARD',
});

const REQUIRED_ROUTER_INPUTS = Object.freeze([
  'jurisdiction',
  'valuation_purpose',
  'intended_use',
  'intended_user',
  'asset_type',
  'as_of_date',
]);

const OPTIONAL_ROUTER_INPUTS = Object.freeze([
  'reporting_framework',
  'regulated_entity_status',
  'transaction_context',
  'financing_context',
]);

function isPresent(value) {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

function validateRouterContext(context) {
  const missing = REQUIRED_ROUTER_INPUTS.filter((key) => !isPresent(context?.[key]));
  const invalid = [];
  if (isPresent(context?.as_of_date) && !Number.isFinite(Date.parse(String(context.as_of_date)))) invalid.push('INVALID_AS_OF_DATE');
  return Object.freeze({
    valid: missing.length === 0 && invalid.length === 0,
    missing: Object.freeze(missing),
    invalid: Object.freeze(invalid),
  });
}

function assertRouterContext(context) {
  const result = validateRouterContext(context);
  if (!result.valid) {
    const error = new Error(`STANDARDS_ROUTER_CONTEXT_INCOMPLETE:${[...result.missing, ...result.invalid].join(',')}`);
    error.code = 'STANDARDS_ROUTER_CONTEXT_INCOMPLETE';
    error.missing = result.missing;
    error.invalid = result.invalid;
    throw error;
  }
  return true;
}

function listMatches(values, value) {
  const list = Array.isArray(values) ? values : [];
  if (list.length === 0) return true;
  return isPresent(value) && list.includes(String(value));
}

function contextMatchesRecord(record, context) {
  if (record?.jurisdiction !== context.jurisdiction) return false;
  if (!listMatches(record?.applicable_purposes, context.valuation_purpose)) return false;
  if (!listMatches(record?.applicable_asset_classes, context.asset_type)) return false;
  if (!listMatches(record?.applicable_reporting_frameworks, context.reporting_framework)) return false;
  if (!listMatches(record?.applicable_regulated_entity_statuses, context.regulated_entity_status)) return false;
  if (!listMatches(record?.applicable_transaction_contexts, context.transaction_context)) return false;
  if (!listMatches(record?.applicable_financing_contexts, context.financing_context)) return false;
  if (!listMatches(record?.applicable_intended_uses, context.intended_use)) return false;
  if (!listMatches(record?.applicable_intended_users, context.intended_user)) return false;
  return true;
}

function toRegistryContext(context) {
  return Object.freeze({
    as_of_date: context.as_of_date,
    jurisdiction: context.jurisdiction,
    purpose: context.valuation_purpose,
    asset_class: context.asset_type,
    reporting_framework: context.reporting_framework || null,
    regulated_entity_status: context.regulated_entity_status || null,
    transaction_context: context.transaction_context || null,
    financing_context: context.financing_context || null,
    intended_use: context.intended_use,
    intended_user: context.intended_user,
  });
}

function advisoryRecord(record, selected) {
  const activeVersion = selected.find((item) => item.standard_id === record.standard_id) || null;
  return Object.freeze({
    standard_id: record.standard_id,
    title_ar: record.title_ar,
    title_en: record.title_en,
    version: record.version,
    status: record.status,
    effective_date: record.effective_date,
    current_active_version: activeVersion?.version || null,
    expected_system_impact: record.expected_system_impact || null,
    source_url: record.source_url,
    official_source: record.official_source,
    legal_review_status: record.legal_review_status,
    production_enforced: false,
  });
}

function routeStandards(records, context) {
  assertRouterContext(context);
  const registry = Array.isArray(records) ? records : [];
  const invalidRecords = registry
    .map((record) => ({ record, validation: validateStandardRecord(record) }))
    .filter((item) => !item.validation.valid)
    .map((item) => Object.freeze({
      standard_id: item.record?.standard_id || null,
      version: item.record?.version || null,
      errors: item.validation.errors,
    }));

  if (invalidRecords.length) {
    const error = new Error(`STANDARDS_ROUTER_INVALID_REGISTRY:${invalidRecords.map((item) => `${item.standard_id}@${item.version}`).join(',')}`);
    error.code = 'STANDARDS_ROUTER_INVALID_REGISTRY';
    error.invalidRecords = invalidRecords;
    throw error;
  }

  const registryContext = toRegistryContext(context);
  const production = selectProductionStandards(registry, registryContext);
  assertNoNonActiveProductionStandards(production.selected);

  const futureRequirements = registry
    .filter((record) => record.status === STANDARD_STATUS.FUTURE && contextMatchesRecord(record, context))
    .map((record) => advisoryRecord(record, production.selected));
  const draftReferences = registry
    .filter((record) => record.status === STANDARD_STATUS.DRAFT && contextMatchesRecord(record, context))
    .map((record) => advisoryRecord(record, production.selected));
  const underReview = registry
    .filter((record) => record.status === STANDARD_STATUS.UNDER_REVIEW && contextMatchesRecord(record, context))
    .map((record) => advisoryRecord(record, production.selected));

  const snapshot = createStandardsSnapshot(registry, registryContext);
  const warnings = [...production.warnings];
  if (futureRequirements.length) warnings.push(Object.freeze({ code: 'FUTURE_STANDARD_CHANGE_PENDING', count: futureRequirements.length }));
  if (draftReferences.length) warnings.push(Object.freeze({ code: 'DRAFT_STANDARD_REFERENCE_AVAILABLE', count: draftReferences.length }));
  if (underReview.length) warnings.push(Object.freeze({ code: 'STANDARD_UNDER_REVIEW', count: underReview.length }));

  const selectedIdentity = production.selected
    .map((record) => `${record.standard_id}@${record.version}`)
    .sort();
  const routePayload = {
    schema_version: 1,
    context: Object.freeze({
      jurisdiction: context.jurisdiction,
      valuation_purpose: context.valuation_purpose,
      intended_use: context.intended_use,
      intended_user: context.intended_user,
      asset_type: context.asset_type,
      reporting_framework: context.reporting_framework || null,
      regulated_entity_status: context.regulated_entity_status || null,
      transaction_context: context.transaction_context || null,
      financing_context: context.financing_context || null,
      as_of_date: context.as_of_date,
    }),
    selected_ruleset: Object.freeze(selectedIdentity),
  };

  const status = production.selected.length === 0
    ? ROUTE_STATUS.NO_ACTIVE_STANDARD
    : warnings.length > 0
      ? ROUTE_STATUS.READY_WITH_WARNINGS
      : ROUTE_STATUS.READY;

  return Object.freeze({
    ...routePayload,
    status,
    route_hash: sha256(routePayload),
    selected_standards: production.selected,
    excluded_standards: production.excluded,
    future_requirements: Object.freeze(futureRequirements),
    draft_references: Object.freeze(draftReferences),
    under_review: Object.freeze(underReview),
    warnings: Object.freeze(warnings),
    standards_snapshot: snapshot,
    silent_defaults_used: false,
    legal_approval_established: false,
    licensed_provider_status_established: false,
    certified_valuation_established: false,
    transaction_authorized: false,
  });
}

function assertRouteProductionReady(route) {
  if (!route || typeof route !== 'object') {
    const error = new Error('INVALID_STANDARDS_ROUTE');
    error.code = 'INVALID_STANDARDS_ROUTE';
    throw error;
  }
  if (route.status === ROUTE_STATUS.NO_ACTIVE_STANDARD || !Array.isArray(route.selected_standards) || route.selected_standards.length === 0) {
    const error = new Error('NO_ACTIVE_STANDARD_FOR_ROUTE');
    error.code = 'NO_ACTIVE_STANDARD_FOR_ROUTE';
    throw error;
  }
  assertNoNonActiveProductionStandards(route.selected_standards);
  const selected = route.selected_standards.map((record) => `${record.standard_id}@${record.version}`).sort();
  const snap = route.standards_snapshot?.selected?.map((record) => `${record.standard_id}@${record.version}`).sort() || [];
  if (JSON.stringify(selected) !== JSON.stringify(snap)) {
    const error = new Error('STANDARDS_ROUTE_SNAPSHOT_MISMATCH');
    error.code = 'STANDARDS_ROUTE_SNAPSHOT_MISMATCH';
    throw error;
  }
  return true;
}

module.exports = {
  ROUTE_STATUS,
  REQUIRED_ROUTER_INPUTS,
  OPTIONAL_ROUTER_INPUTS,
  validateRouterContext,
  assertRouterContext,
  contextMatchesRecord,
  routeStandards,
  assertRouteProductionReady,
};
