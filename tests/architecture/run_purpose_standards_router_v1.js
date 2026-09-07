'use strict';

const assert = require('assert');
const {
  STANDARD_STATUS,
  MANDATORY_OR_GUIDANCE,
  LEGAL_REVIEW_STATUS,
  sha256,
} = require('../../src/standards/standards-registry');
const {
  ROUTE_STATUS,
  REQUIRED_ROUTER_INPUTS,
  validateRouterContext,
  routeStandards,
  assertRouteProductionReady,
} = require('../../src/standards/purpose-based-standards-router');

const AS_OF = '2026-09-07';

function standard(id, version, overrides = {}) {
  return {
    standard_id: id,
    title_ar: `معيار اصطناعي ${id}`,
    title_en: `Synthetic ${id}`,
    issuer: 'SYNTHETIC_TEST_ISSUER',
    jurisdiction: 'SAUDI_ARABIA',
    category: 'VALUATION',
    version,
    publication_date: '2025-12-01',
    effective_date: '2026-01-01',
    expiry_date: null,
    status: STANDARD_STATUS.ACTIVE,
    source_url: `https://example.invalid/${id}`,
    official_source: false,
    last_verified: '2026-09-01',
    next_review: '2026-12-31',
    supersedes: [],
    superseded_by: [],
    applicable_asset_classes: ['OFFICE'],
    applicable_purposes: ['ACQUISITION_ANALYSIS'],
    mandatory_or_guidance: MANDATORY_OR_GUIDANCE.MANDATORY,
    rule_version_hash: sha256(`${id}@${version}`),
    reviewer: 'SYNTHETIC_TEST_REVIEWER',
    legal_review_status: LEGAL_REVIEW_STATUS.PENDING,
    ...overrides,
  };
}

function context(overrides = {}) {
  return {
    jurisdiction: 'SAUDI_ARABIA',
    valuation_purpose: 'ACQUISITION_ANALYSIS',
    intended_use: 'INTERNAL_INVESTMENT_DECISION_SUPPORT',
    intended_user: 'INVESTMENT_COMMITTEE',
    asset_type: 'OFFICE',
    reporting_framework: null,
    regulated_entity_status: null,
    transaction_context: 'ACQUISITION',
    financing_context: null,
    as_of_date: AS_OF,
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

  check(
    JSON.stringify(REQUIRED_ROUTER_INPUTS) === JSON.stringify([
      'jurisdiction', 'valuation_purpose', 'intended_use', 'intended_user', 'asset_type', 'as_of_date',
    ]),
    'Router must require the non-defaultable core context dimensions',
  );

  const missing = validateRouterContext(context({ intended_user: '' }));
  check(missing.valid === false && missing.missing.includes('intended_user'), 'Missing intended user must fail context validation');
  expectThrow(() => routeStandards([], context({ valuation_purpose: null })), 'STANDARDS_ROUTER_CONTEXT_INCOMPLETE');
  checks++;

  const saudi = standard('SYNTHETIC_SAUDI_FRAMEWORK', '2026.1', {
    applicable_intended_uses: ['INTERNAL_INVESTMENT_DECISION_SUPPORT'],
    applicable_intended_users: ['INVESTMENT_COMMITTEE'],
    applicable_transaction_contexts: ['ACQUISITION'],
  });
  const internationalLayer = standard('SYNTHETIC_IVS_LAYER', '2026.1', {
    issuer: 'SYNTHETIC_INTERNATIONAL_ISSUER',
    mandatory_or_guidance: MANDATORY_OR_GUIDANCE.GUIDANCE,
  });
  const unrelatedFinance = standard('SYNTHETIC_FINANCIAL_REPORTING', '2026.1', {
    applicable_purposes: ['FINANCIAL_REPORTING'],
    applicable_reporting_frameworks: ['IFRS'],
  });
  const future = standard('SYNTHETIC_SAUDI_FRAMEWORK', '2027.1', {
    publication_date: '2026-08-15',
    effective_date: '2027-01-01',
    status: STANDARD_STATUS.FUTURE,
    expected_system_impact: 'Synthetic future migration impact only',
  });
  const draft = standard('SYNTHETIC_COMPARABLE_GUIDANCE', 'draft-2026', {
    status: STANDARD_STATUS.DRAFT,
    mandatory_or_guidance: MANDATORY_OR_GUIDANCE.GUIDANCE,
  });
  const underReview = standard('SYNTHETIC_REVIEW_ITEM', 'review-1', {
    status: STANDARD_STATUS.UNDER_REVIEW,
    mandatory_or_guidance: MANDATORY_OR_GUIDANCE.GUIDANCE,
  });

  const registry = [saudi, internationalLayer, unrelatedFinance, future, draft, underReview];
  const routed = routeStandards(registry, context());

  check(routed.status === ROUTE_STATUS.READY_WITH_WARNINGS, 'Future/draft/review awareness should produce a ready route with warnings');
  check(routed.selected_standards.length === 2, 'Acquisition route must select only the two matching ACTIVE standards');
  check(routed.selected_standards.every((item) => item.status === STANDARD_STATUS.ACTIVE), 'Production ruleset must contain ACTIVE standards only');
  check(!routed.selected_standards.some((item) => item.standard_id === 'SYNTHETIC_FINANCIAL_REPORTING'), 'Wrong-purpose standard must not be selected');
  check(routed.future_requirements.length === 1 && routed.future_requirements[0].production_enforced === false, 'Future standard must be visible but never enforced');
  check(routed.future_requirements[0].current_active_version === '2026.1', 'Future advisory must show current active version');
  check(routed.draft_references.length === 1 && routed.draft_references[0].production_enforced === false, 'Draft reference must remain non-production');
  check(routed.under_review.length === 1 && routed.under_review[0].production_enforced === false, 'Under-review reference must remain non-production');
  check(routed.silent_defaults_used === false, 'Purpose router must not silently default missing standards context');
  check(routed.transaction_authorized === false && routed.certified_valuation_established === false, 'Router must not create transaction or certified-valuation authority');
  check(assertRouteProductionReady(routed) === true, 'Qualified route and standards snapshot must reconcile exactly');

  const selectedIdentities = routed.selected_standards.map((item) => `${item.standard_id}@${item.version}`).sort();
  const snapshotIdentities = routed.standards_snapshot.selected.map((item) => `${item.standard_id}@${item.version}`).sort();
  check(JSON.stringify(selectedIdentities) === JSON.stringify(snapshotIdentities), 'Route and historical snapshot must preserve identical active ruleset');
  check(/^[a-f0-9]{64}$/.test(routed.route_hash), 'Route must be integrity-hashed');
  check(/^[a-f0-9]{64}$/.test(routed.standards_snapshot.standards_snapshot_version), 'Route must include deterministic standards snapshot version');

  const reordered = routeStandards([...registry].reverse(), context());
  check(reordered.route_hash === routed.route_hash, 'Route hash must be stable regardless registry input ordering');
  check(reordered.standards_snapshot.standards_snapshot_version === routed.standards_snapshot.standards_snapshot_version, 'Snapshot must be stable regardless registry input ordering');

  const financial = routeStandards(registry, context({
    valuation_purpose: 'FINANCIAL_REPORTING',
    reporting_framework: 'IFRS',
    transaction_context: null,
  }));
  check(financial.selected_standards.length === 1 && financial.selected_standards[0].standard_id === 'SYNTHETIC_FINANCIAL_REPORTING', 'Purpose + reporting framework must route to the matching active financial-reporting standard only');

  const wrongFramework = routeStandards(registry, context({
    valuation_purpose: 'FINANCIAL_REPORTING',
    reporting_framework: 'SOCPA_OTHER',
    transaction_context: null,
  }));
  check(wrongFramework.status === ROUTE_STATUS.NO_ACTIVE_STANDARD, 'Wrong reporting framework must not fall back silently to another ruleset');
  expectThrow(() => assertRouteProductionReady(wrongFramework), 'NO_ACTIVE_STANDARD_FOR_ROUTE');
  checks++;

  const staleSaudi = { ...saudi, next_review: '2026-09-01' };
  const staleRoute = routeStandards([staleSaudi], context());
  check(staleRoute.warnings.some((item) => item.code === 'STANDARD_VERIFICATION_STALE'), 'Stale active standard must propagate freshness warning through router');

  const invalidRegistryItem = { ...saudi, status: 'PROPOSED' };
  expectThrow(() => routeStandards([invalidRegistryItem], context()), 'STANDARDS_ROUTER_INVALID_REGISTRY');
  checks++;

  console.log(`WAVE_7B_PURPOSE_STANDARDS_ROUTER=PASS checks=${checks}`);
}

main();
