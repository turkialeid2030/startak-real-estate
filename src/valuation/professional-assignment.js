'use strict';

const { routeStandards, ROUTE_STATUS, assertRouteProductionReady } = require('../standards/purpose-based-standards-router');

const CONFLICT_INDEPENDENCE_STATUS = Object.freeze({
  CLEAR: 'CLEAR',
  DISCLOSURE_REQUIRED: 'DISCLOSURE_REQUIRED',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  CANNOT_PROCEED: 'CANNOT_PROCEED',
});

const COMPETENCE_STATUS = Object.freeze({
  CLEAR: 'CLEAR',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  SPECIALIST_REVIEW_REQUIRED: 'SPECIALIST_REVIEW_REQUIRED',
  CANNOT_PROCEED: 'CANNOT_PROCEED',
});

const ASSIGNMENT_STATUS = Object.freeze({
  READY_FOR_STANDARDS_ROUTING: 'READY_FOR_STANDARDS_ROUTING',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  SPECIALIST_REVIEW_REQUIRED: 'SPECIALIST_REVIEW_REQUIRED',
  CANNOT_PROCEED: 'CANNOT_PROCEED',
  VALUATION_SCOPE_INCOMPLETE: 'VALUATION_SCOPE_INCOMPLETE',
  ASSIGNMENT_INCOMPLETE: 'ASSIGNMENT_INCOMPLETE',
  STANDARDS_ROUTE_UNAVAILABLE: 'STANDARDS_ROUTE_UNAVAILABLE',
});

const RIGHT_TYPE = Object.freeze({
  OWNERSHIP: 'OWNERSHIP',
  USUFRUCT: 'USUFRUCT',
  LEASE: 'LEASE',
  MORTGAGE: 'MORTGAGE',
  EASEMENT: 'EASEMENT',
  RESTRICTION: 'RESTRICTION',
  ENCUMBRANCE: 'ENCUMBRANCE',
  REGISTERED_RIGHT: 'REGISTERED_RIGHT',
});

const RIGHT_SOURCE_CLASS = Object.freeze({
  REGISTERED: 'REGISTERED',
  VERIFIED: 'VERIFIED',
  EXTRACTED: 'EXTRACTED',
  CLIENT_PROVIDED: 'CLIENT_PROVIDED',
  ASSUMED: 'ASSUMED',
});

const REQUIRED_ASSIGNMENT_KEYS = Object.freeze([
  'client',
  'intended_user',
  'intended_use',
  'purpose',
  'asset',
  'rights',
  'basis',
  'valuation_date',
  'report_date',
  'scope',
  'assumptions',
  'special_assumptions',
  'information_reliance',
  'limitations',
  'conflicts',
  'independence',
  'competence',
  'reviewer',
]);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function dateMs(value) {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : NaN;
}

function validateRight(right, index) {
  const errors = [];
  if (!right || typeof right !== 'object' || Array.isArray(right)) return [`INVALID_RIGHT_OBJECT:${index}`];
  if (!Object.values(RIGHT_TYPE).includes(right.type)) errors.push(`INVALID_RIGHT_TYPE:${index}:${right.type}`);
  if (!Object.values(RIGHT_SOURCE_CLASS).includes(right.source_class)) errors.push(`INVALID_RIGHT_SOURCE_CLASS:${index}:${right.source_class}`);
  if (!isNonEmptyString(right.description)) errors.push(`INVALID_RIGHT_DESCRIPTION:${index}`);
  if (right.source_reference !== null && right.source_reference !== undefined && !isNonEmptyString(right.source_reference)) {
    errors.push(`INVALID_RIGHT_SOURCE_REFERENCE:${index}`);
  }
  return errors;
}

function validateConflictIndependence(value, field) {
  const errors = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [`INVALID_${field.toUpperCase()}_OBJECT`];
  if (!Object.values(CONFLICT_INDEPENDENCE_STATUS).includes(value.status)) errors.push(`INVALID_${field.toUpperCase()}_STATUS:${value.status}`);
  if (value.notes !== null && value.notes !== undefined && typeof value.notes !== 'string') errors.push(`INVALID_${field.toUpperCase()}_NOTES`);
  return errors;
}

function validateCompetence(value) {
  const errors = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ['INVALID_COMPETENCE_OBJECT'];
  if (!Object.values(COMPETENCE_STATUS).includes(value.status)) errors.push(`INVALID_COMPETENCE_STATUS:${value.status}`);
  for (const key of ['location', 'complexity']) {
    if (!isNonEmptyString(value[key])) errors.push(`INVALID_COMPETENCE_${key.toUpperCase()}`);
  }
  if (typeof value.specialization_required !== 'boolean') errors.push('INVALID_COMPETENCE_SPECIALIZATION_REQUIRED');
  if (value.specialist_reviewer !== null && value.specialist_reviewer !== undefined && !isNonEmptyString(value.specialist_reviewer)) {
    errors.push('INVALID_COMPETENCE_SPECIALIST_REVIEWER');
  }
  return errors;
}

function validateProfessionalAssignment(assignment) {
  const errors = [];
  if (!assignment || typeof assignment !== 'object' || Array.isArray(assignment)) {
    return Object.freeze({ valid: false, errors: Object.freeze(['ASSIGNMENT_MUST_BE_OBJECT']) });
  }

  for (const key of REQUIRED_ASSIGNMENT_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(assignment, key)) errors.push(`MISSING_ASSIGNMENT_FIELD:${key}`);
  }

  for (const key of ['client', 'intended_user', 'intended_use', 'purpose', 'basis', 'valuation_date', 'report_date', 'reviewer']) {
    if (Object.prototype.hasOwnProperty.call(assignment, key) && !isNonEmptyString(assignment[key])) errors.push(`INVALID_ASSIGNMENT_STRING:${key}`);
  }

  if (!assignment.asset || typeof assignment.asset !== 'object' || Array.isArray(assignment.asset)) {
    errors.push('INVALID_ASSET_OBJECT');
  } else {
    for (const key of ['type', 'jurisdiction', 'location']) {
      if (!isNonEmptyString(assignment.asset[key])) errors.push(`INVALID_ASSET_${key.toUpperCase()}`);
    }
  }

  if (!Array.isArray(assignment.rights) || assignment.rights.length === 0) {
    errors.push('RIGHTS_REQUIRED');
  } else {
    assignment.rights.forEach((right, index) => errors.push(...validateRight(right, index)));
  }

  for (const key of ['assumptions', 'special_assumptions', 'information_reliance', 'limitations']) {
    if (!Array.isArray(assignment[key])) errors.push(`INVALID_ASSIGNMENT_ARRAY:${key}`);
  }

  if (!(isNonEmptyString(assignment.scope) || (assignment.scope && typeof assignment.scope === 'object' && !Array.isArray(assignment.scope)))) {
    errors.push('INVALID_SCOPE');
  }

  errors.push(...validateConflictIndependence(assignment.conflicts, 'conflicts'));
  errors.push(...validateConflictIndependence(assignment.independence, 'independence'));
  errors.push(...validateCompetence(assignment.competence));

  const valuationDate = dateMs(assignment.valuation_date);
  const reportDate = dateMs(assignment.report_date);
  if (!Number.isFinite(valuationDate)) errors.push('INVALID_VALUATION_DATE');
  if (!Number.isFinite(reportDate)) errors.push('INVALID_REPORT_DATE');
  if (Number.isFinite(valuationDate) && Number.isFinite(reportDate) && reportDate < valuationDate) {
    errors.push('REPORT_DATE_BEFORE_VALUATION_DATE');
  }

  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

function evaluateBasisOfValueGate(assignment) {
  const missing = [];
  if (!isNonEmptyString(assignment?.basis)) missing.push('basis');
  if (!isNonEmptyString(assignment?.valuation_date) || !Number.isFinite(dateMs(assignment?.valuation_date))) missing.push('valuation_date');
  if (!isNonEmptyString(assignment?.purpose)) missing.push('purpose');
  if (!Array.isArray(assignment?.rights) || assignment.rights.length === 0) missing.push('rights');

  return Object.freeze({
    status: missing.length ? ASSIGNMENT_STATUS.VALUATION_SCOPE_INCOMPLETE : 'VALUATION_SCOPE_COMPLETE',
    minimum_scope_gate_passed: missing.length === 0,
    missing: Object.freeze(missing),
    official_value_calculation_gate_passed: missing.length === 0,
    certified_valuation_authorized: false,
    legal_approval_established: false,
    transaction_authorized: false,
  });
}

function assertValuationScopeComplete(assignment) {
  const result = evaluateBasisOfValueGate(assignment);
  if (!result.minimum_scope_gate_passed) {
    const error = new Error(`VALUATION_SCOPE_INCOMPLETE:${result.missing.join(',')}`);
    error.code = 'VALUATION_SCOPE_INCOMPLETE';
    error.missing = result.missing;
    throw error;
  }
  return true;
}

function effectiveCompetenceStatus(competence) {
  if (!competence || typeof competence !== 'object') return COMPETENCE_STATUS.CANNOT_PROCEED;
  if (competence.status === COMPETENCE_STATUS.CANNOT_PROCEED) return COMPETENCE_STATUS.CANNOT_PROCEED;
  if (competence.specialization_required === true && !isNonEmptyString(competence.specialist_reviewer)) {
    return COMPETENCE_STATUS.SPECIALIST_REVIEW_REQUIRED;
  }
  return competence.status;
}

function evaluateProfessionalAssignment(assignment) {
  const basisGate = evaluateBasisOfValueGate(assignment);
  if (!basisGate.minimum_scope_gate_passed) {
    return Object.freeze({
      status: ASSIGNMENT_STATUS.VALUATION_SCOPE_INCOMPLETE,
      validation_errors: Object.freeze([]),
      basis_gate: basisGate,
      human_review_required: true,
      standards_routing_allowed: false,
      certified_valuation_established: false,
      transaction_authorized: false,
    });
  }

  const validation = validateProfessionalAssignment(assignment);
  if (!validation.valid) {
    return Object.freeze({
      status: ASSIGNMENT_STATUS.ASSIGNMENT_INCOMPLETE,
      validation_errors: validation.errors,
      basis_gate: basisGate,
      human_review_required: true,
      standards_routing_allowed: false,
      certified_valuation_established: false,
      transaction_authorized: false,
    });
  }

  const conflictStatus = assignment.conflicts.status;
  const independenceStatus = assignment.independence.status;
  const competenceStatus = effectiveCompetenceStatus(assignment.competence);
  const assumedRights = assignment.rights.filter((right) => right.source_class === RIGHT_SOURCE_CLASS.ASSUMED);

  if (
    conflictStatus === CONFLICT_INDEPENDENCE_STATUS.CANNOT_PROCEED
    || independenceStatus === CONFLICT_INDEPENDENCE_STATUS.CANNOT_PROCEED
    || competenceStatus === COMPETENCE_STATUS.CANNOT_PROCEED
  ) {
    return Object.freeze({
      status: ASSIGNMENT_STATUS.CANNOT_PROCEED,
      validation_errors: Object.freeze([]),
      basis_gate: basisGate,
      human_review_required: true,
      standards_routing_allowed: false,
      conflict_status: conflictStatus,
      independence_status: independenceStatus,
      competence_status: competenceStatus,
      assumed_rights_count: assumedRights.length,
      certified_valuation_established: false,
      transaction_authorized: false,
    });
  }

  if (competenceStatus === COMPETENCE_STATUS.SPECIALIST_REVIEW_REQUIRED) {
    return Object.freeze({
      status: ASSIGNMENT_STATUS.SPECIALIST_REVIEW_REQUIRED,
      validation_errors: Object.freeze([]),
      basis_gate: basisGate,
      human_review_required: true,
      standards_routing_allowed: false,
      conflict_status: conflictStatus,
      independence_status: independenceStatus,
      competence_status: competenceStatus,
      assumed_rights_count: assumedRights.length,
      certified_valuation_established: false,
      transaction_authorized: false,
    });
  }

  const reviewRequired = assumedRights.length > 0
    || conflictStatus === CONFLICT_INDEPENDENCE_STATUS.DISCLOSURE_REQUIRED
    || conflictStatus === CONFLICT_INDEPENDENCE_STATUS.REVIEW_REQUIRED
    || independenceStatus === CONFLICT_INDEPENDENCE_STATUS.DISCLOSURE_REQUIRED
    || independenceStatus === CONFLICT_INDEPENDENCE_STATUS.REVIEW_REQUIRED
    || competenceStatus === COMPETENCE_STATUS.REVIEW_REQUIRED;

  if (reviewRequired) {
    return Object.freeze({
      status: ASSIGNMENT_STATUS.REVIEW_REQUIRED,
      validation_errors: Object.freeze([]),
      basis_gate: basisGate,
      human_review_required: true,
      standards_routing_allowed: false,
      conflict_status: conflictStatus,
      independence_status: independenceStatus,
      competence_status: competenceStatus,
      assumed_rights_count: assumedRights.length,
      certified_valuation_established: false,
      transaction_authorized: false,
    });
  }

  return Object.freeze({
    status: ASSIGNMENT_STATUS.READY_FOR_STANDARDS_ROUTING,
    validation_errors: Object.freeze([]),
    basis_gate: basisGate,
    human_review_required: false,
    standards_routing_allowed: true,
    conflict_status: conflictStatus,
    independence_status: independenceStatus,
    competence_status: competenceStatus,
    assumed_rights_count: assumedRights.length,
    certified_valuation_established: false,
    transaction_authorized: false,
  });
}

function buildRouterContextFromAssignment(assignment) {
  return Object.freeze({
    jurisdiction: assignment.asset.jurisdiction,
    valuation_purpose: assignment.purpose,
    intended_use: assignment.intended_use,
    intended_user: assignment.intended_user,
    asset_type: assignment.asset.type,
    reporting_framework: assignment.reporting_framework || null,
    regulated_entity_status: assignment.regulated_entity_status || null,
    transaction_context: assignment.transaction_context || null,
    financing_context: assignment.financing_context || null,
    as_of_date: assignment.valuation_date,
  });
}

function routeAssignmentStandards(assignment, registry) {
  const assignmentEvaluation = evaluateProfessionalAssignment(assignment);
  if (!assignmentEvaluation.standards_routing_allowed) {
    return Object.freeze({
      status: assignmentEvaluation.status,
      assignment: assignmentEvaluation,
      standards_route: null,
      certified_valuation_established: false,
      transaction_authorized: false,
    });
  }

  const route = routeStandards(registry, buildRouterContextFromAssignment(assignment));
  if (route.status === ROUTE_STATUS.NO_ACTIVE_STANDARD) {
    return Object.freeze({
      status: ASSIGNMENT_STATUS.STANDARDS_ROUTE_UNAVAILABLE,
      assignment: assignmentEvaluation,
      standards_route: route,
      certified_valuation_established: false,
      transaction_authorized: false,
    });
  }

  assertRouteProductionReady(route);
  return Object.freeze({
    status: ASSIGNMENT_STATUS.READY_FOR_STANDARDS_ROUTING,
    assignment: assignmentEvaluation,
    standards_route: route,
    certified_valuation_established: false,
    transaction_authorized: false,
  });
}

module.exports = {
  CONFLICT_INDEPENDENCE_STATUS,
  COMPETENCE_STATUS,
  ASSIGNMENT_STATUS,
  RIGHT_TYPE,
  RIGHT_SOURCE_CLASS,
  REQUIRED_ASSIGNMENT_KEYS,
  validateProfessionalAssignment,
  evaluateBasisOfValueGate,
  assertValuationScopeComplete,
  effectiveCompetenceStatus,
  evaluateProfessionalAssignment,
  buildRouterContextFromAssignment,
  routeAssignmentStandards,
};
