'use strict';

const assert = require('assert');
const {
  STANDARD_STATUS,
  MANDATORY_OR_GUIDANCE,
  LEGAL_REVIEW_STATUS,
  sha256,
} = require('../../src/standards/standards-registry');
const {
  CONFLICT_INDEPENDENCE_STATUS,
  COMPETENCE_STATUS,
  ASSIGNMENT_STATUS,
  RIGHT_TYPE,
  RIGHT_SOURCE_CLASS,
  REQUIRED_ASSIGNMENT_KEYS,
  validateProfessionalAssignment,
  evaluateBasisOfValueGate,
  assertValuationScopeComplete,
  evaluateProfessionalAssignment,
  buildRouterContextFromAssignment,
  routeAssignmentStandards,
} = require('../../src/valuation/professional-assignment');

function assignment(overrides = {}) {
  return {
    client: 'SYNTHETIC CLIENT',
    intended_user: 'INVESTMENT_COMMITTEE',
    intended_use: 'INTERNAL_INVESTMENT_DECISION_SUPPORT',
    purpose: 'ACQUISITION_ANALYSIS',
    asset: {
      type: 'OFFICE',
      jurisdiction: 'SAUDI_ARABIA',
      location: 'SYNTHETIC_RIYADH_LOCATION',
    },
    rights: [{
      type: RIGHT_TYPE.OWNERSHIP,
      source_class: RIGHT_SOURCE_CLASS.VERIFIED,
      description: 'Synthetic verified ownership interest',
      source_reference: 'SYNTHETIC-DOC-1',
    }],
    basis: 'SYNTHETIC_MARKET_VALUE_BASIS',
    valuation_date: '2026-09-07',
    report_date: '2026-09-07',
    scope: 'Synthetic scope for architecture testing only',
    assumptions: [],
    special_assumptions: [],
    information_reliance: ['SYNTHETIC-DOC-1'],
    limitations: [],
    conflicts: { status: CONFLICT_INDEPENDENCE_STATUS.CLEAR, notes: null },
    independence: { status: CONFLICT_INDEPENDENCE_STATUS.CLEAR, notes: null },
    competence: {
      status: COMPETENCE_STATUS.CLEAR,
      location: 'RIYADH',
      complexity: 'STANDARD',
      specialization_required: false,
      specialist_reviewer: null,
    },
    reviewer: 'SYNTHETIC_REVIEWER',
    transaction_context: 'ACQUISITION',
    ...overrides,
  };
}

function registryStandard(overrides = {}) {
  return {
    standard_id: 'SYNTHETIC_ASSIGNMENT_STANDARD',
    title_ar: 'معيار اصطناعي لاختبار التكليف',
    title_en: 'Synthetic Assignment Standard',
    issuer: 'SYNTHETIC_TEST_ISSUER',
    jurisdiction: 'SAUDI_ARABIA',
    category: 'VALUATION',
    version: '2026.1',
    publication_date: '2025-12-01',
    effective_date: '2026-01-01',
    expiry_date: null,
    status: STANDARD_STATUS.ACTIVE,
    source_url: 'https://example.invalid/synthetic-assignment-standard',
    official_source: false,
    last_verified: '2026-09-01',
    next_review: '2026-12-31',
    supersedes: [],
    superseded_by: [],
    applicable_asset_classes: ['OFFICE'],
    applicable_purposes: ['ACQUISITION_ANALYSIS'],
    applicable_intended_uses: ['INTERNAL_INVESTMENT_DECISION_SUPPORT'],
    applicable_intended_users: ['INVESTMENT_COMMITTEE'],
    applicable_transaction_contexts: ['ACQUISITION'],
    mandatory_or_guidance: MANDATORY_OR_GUIDANCE.MANDATORY,
    rule_version_hash: sha256('synthetic-assignment-standard-2026.1'),
    reviewer: 'SYNTHETIC_STANDARDS_REVIEWER',
    legal_review_status: LEGAL_REVIEW_STATUS.PENDING,
    ...overrides,
  };
}

function expectThrow(fn, code) {
  let thrown = null;
  try { fn(); } catch (error) { thrown = error; }
  assert(thrown, `Expected ${code}`);
  assert.strictEqual(thrown.code, code, `Expected ${code}, got ${thrown.code}`);
}

function main() {
  let checks = 0;
  const check = (condition, message) => { assert(condition, message); checks++; };

  check(REQUIRED_ASSIGNMENT_KEYS.length === 18, 'Assignment contract must contain the 18 directive fields');
  check(REQUIRED_ASSIGNMENT_KEYS.includes('basis') && REQUIRED_ASSIGNMENT_KEYS.includes('rights') && REQUIRED_ASSIGNMENT_KEYS.includes('competence'), 'Assignment contract must include basis, rights and competence');

  const complete = assignment();
  const validation = validateProfessionalAssignment(complete);
  check(validation.valid === true, `Complete synthetic assignment must validate: ${validation.errors.join(',')}`);

  const basisGate = evaluateBasisOfValueGate(complete);
  check(basisGate.minimum_scope_gate_passed === true, 'Complete basis-of-value gate must pass minimum scope');
  check(basisGate.certified_valuation_authorized === false && basisGate.transaction_authorized === false, 'Scope completion must not create certified-valuation or transaction authority');
  check(assertValuationScopeComplete(complete) === true, 'Complete assignment must pass explicit valuation-scope assertion');

  for (const [field, mutated] of [
    ['basis', { basis: '' }],
    ['valuation_date', { valuation_date: '' }],
    ['purpose', { purpose: '' }],
    ['rights', { rights: [] }],
  ]) {
    const gate = evaluateBasisOfValueGate(assignment(mutated));
    check(gate.status === ASSIGNMENT_STATUS.VALUATION_SCOPE_INCOMPLETE && gate.missing.includes(field), `${field} must be mandatory for formal valuation scope gate`);
    expectThrow(() => assertValuationScopeComplete(assignment(mutated)), 'VALUATION_SCOPE_INCOMPLETE');
    checks++;
  }

  const invalidRight = validateProfessionalAssignment(assignment({
    rights: [{ type: 'OTHER_RIGHT', source_class: RIGHT_SOURCE_CLASS.VERIFIED, description: 'x', source_reference: null }],
  }));
  check(invalidRight.valid === false && invalidRight.errors.some((item) => item.startsWith('INVALID_RIGHT_TYPE:')), 'Unsupported right type must fail closed');

  const invalidSource = validateProfessionalAssignment(assignment({
    rights: [{ type: RIGHT_TYPE.LEASE, source_class: 'UNVERIFIED_UNKNOWN', description: 'x', source_reference: null }],
  }));
  check(invalidSource.valid === false && invalidSource.errors.some((item) => item.startsWith('INVALID_RIGHT_SOURCE_CLASS:')), 'Unsupported right source classification must fail closed');

  const badConflict = validateProfessionalAssignment(assignment({
    conflicts: { status: 'MAYBE', notes: null },
  }));
  check(badConflict.valid === false && badConflict.errors.some((item) => item.startsWith('INVALID_CONFLICTS_STATUS:')), 'Conflict state must use governed enum only');

  const cannotProceed = evaluateProfessionalAssignment(assignment({
    conflicts: { status: CONFLICT_INDEPENDENCE_STATUS.CANNOT_PROCEED, notes: 'Synthetic conflict' },
  }));
  check(cannotProceed.status === ASSIGNMENT_STATUS.CANNOT_PROCEED && cannotProceed.standards_routing_allowed === false, 'CANNOT_PROCEED conflict must block standards routing');

  const disclosure = evaluateProfessionalAssignment(assignment({
    independence: { status: CONFLICT_INDEPENDENCE_STATUS.DISCLOSURE_REQUIRED, notes: 'Synthetic disclosure' },
  }));
  check(disclosure.status === ASSIGNMENT_STATUS.REVIEW_REQUIRED && disclosure.human_review_required === true, 'Disclosure-required independence state must require human review');

  const assumedRight = evaluateProfessionalAssignment(assignment({
    rights: [{
      type: RIGHT_TYPE.OWNERSHIP,
      source_class: RIGHT_SOURCE_CLASS.ASSUMED,
      description: 'Synthetic assumed interest',
      source_reference: null,
    }],
  }));
  check(assumedRight.status === ASSIGNMENT_STATUS.REVIEW_REQUIRED && assumedRight.assumed_rights_count === 1, 'Assumed property right must require professional review before routing');

  const specialist = evaluateProfessionalAssignment(assignment({
    competence: {
      status: COMPETENCE_STATUS.CLEAR,
      location: 'RIYADH',
      complexity: 'SPECIALIZED',
      specialization_required: true,
      specialist_reviewer: null,
    },
  }));
  check(specialist.status === ASSIGNMENT_STATUS.SPECIALIST_REVIEW_REQUIRED, 'Specialized assignment without specialist reviewer must emit SPECIALIST_REVIEW_REQUIRED');
  check(specialist.standards_routing_allowed === false, 'Specialist review gap must block standards routing');

  const specialistCleared = evaluateProfessionalAssignment(assignment({
    competence: {
      status: COMPETENCE_STATUS.CLEAR,
      location: 'RIYADH',
      complexity: 'SPECIALIZED',
      specialization_required: true,
      specialist_reviewer: 'SYNTHETIC_SPECIALIST',
    },
  }));
  check(specialistCleared.status === ASSIGNMENT_STATUS.READY_FOR_STANDARDS_ROUTING, 'Named specialist reviewer may clear the specialization-presence gate when competence status is otherwise CLEAR');

  const wrongDate = validateProfessionalAssignment(assignment({
    valuation_date: '2026-09-08',
    report_date: '2026-09-07',
  }));
  check(wrongDate.valid === false && wrongDate.errors.includes('REPORT_DATE_BEFORE_VALUATION_DATE'), 'Report date before valuation date must fail semantic validation');

  const ready = evaluateProfessionalAssignment(complete);
  check(ready.status === ASSIGNMENT_STATUS.READY_FOR_STANDARDS_ROUTING && ready.standards_routing_allowed === true, 'Clean assignment must become eligible for standards routing');

  const routerContext = buildRouterContextFromAssignment(complete);
  check(routerContext.as_of_date === complete.valuation_date && routerContext.valuation_purpose === complete.purpose, 'Standards router context must derive valuation date and purpose from assignment without replacement defaults');
  check(routerContext.asset_type === complete.asset.type && routerContext.jurisdiction === complete.asset.jurisdiction, 'Router context must derive asset type and jurisdiction from assignment');

  const routed = routeAssignmentStandards(complete, [registryStandard()]);
  check(routed.status === ASSIGNMENT_STATUS.READY_FOR_STANDARDS_ROUTING, 'Complete assignment with matching active standard must route successfully');
  check(routed.standards_route.selected_standards.length === 1, 'Assignment route must contain matching active standard');
  check(routed.standards_route.standards_snapshot.selected[0].version === '2026.1', 'Assignment route must preserve standards snapshot version identity');
  check(routed.certified_valuation_established === false && routed.transaction_authorized === false, 'Assignment routing must not create certified valuation or transaction authority');

  const blockedByReview = routeAssignmentStandards(assignment({
    conflicts: { status: CONFLICT_INDEPENDENCE_STATUS.REVIEW_REQUIRED, notes: 'Synthetic review' },
  }), [registryStandard()]);
  check(blockedByReview.standards_route === null && blockedByReview.status === ASSIGNMENT_STATUS.REVIEW_REQUIRED, 'Human-review gate must stop before standards router execution');

  const noStandard = routeAssignmentStandards(complete, [registryStandard({ applicable_asset_classes: ['HOTEL'] })]);
  check(noStandard.status === ASSIGNMENT_STATUS.STANDARDS_ROUTE_UNAVAILABLE, 'No matching active standard must not silently route to another ruleset');

  console.log(`WAVE_7C_PROFESSIONAL_ASSIGNMENT=PASS checks=${checks}`);
}

main();
