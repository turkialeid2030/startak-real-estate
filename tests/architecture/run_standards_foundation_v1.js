'use strict';

const assert = require('assert');
const {
  STANDARD_STATUS,
  MANDATORY_OR_GUIDANCE,
  LEGAL_REVIEW_STATUS,
  DRAFT_ALLOWED_USES,
  ACTIVATION_GATE_KEYS,
  validateStandardRecord,
  evaluateProductionApplicability,
  selectProductionStandards,
  assertNoNonActiveProductionStandards,
  activateFutureStandard,
  supersedeStandard,
  createStandardsSnapshot,
  resolveStandardConflict,
  sha256,
} = require('../../src/standards/standards-registry');
const {
  RULE_EFFECT,
  validateStandardRule,
  bindRuleToStandard,
  evaluateRuleProductionEligibility,
  assertProductionRulesEligible,
  buildStandardRequirementsMatrix,
} = require('../../src/standards/standard-rule-engine');

const AS_OF = '2026-09-07';
const RULE_HASH = sha256('synthetic-standard-rule-v1');

function standard(overrides = {}) {
  return {
    standard_id: 'SYNTHETIC_SA_VALUATION',
    title_ar: 'معيار اصطناعي للاختبار فقط',
    title_en: 'Synthetic Standard — Test Only',
    issuer: 'SYNTHETIC_TEST_ISSUER',
    jurisdiction: 'SAUDI_ARABIA',
    category: 'VALUATION',
    version: '1.0',
    publication_date: '2025-12-01',
    effective_date: '2026-01-01',
    expiry_date: null,
    status: STANDARD_STATUS.ACTIVE,
    source_url: 'https://example.invalid/synthetic-test-standard',
    official_source: false,
    last_verified: '2026-09-01',
    next_review: '2026-12-31',
    supersedes: [],
    superseded_by: [],
    applicable_asset_classes: ['OFFICE'],
    applicable_purposes: ['ACQUISITION_ANALYSIS'],
    mandatory_or_guidance: MANDATORY_OR_GUIDANCE.MANDATORY,
    rule_version_hash: RULE_HASH,
    reviewer: 'SYNTHETIC_TEST_REVIEWER',
    legal_review_status: LEGAL_REVIEW_STATUS.PENDING,
    ...overrides,
  };
}

function rule(overrides = {}) {
  return {
    rule_id: 'RULE-SYN-001',
    standard_id: 'SYNTHETIC_SA_VALUATION',
    provision: 'SYNTHETIC-PROVISION-1',
    version: '1.0',
    effective_date: '2026-01-01',
    module: 'standards',
    implementation: 'production eligibility guard',
    code_reference: 'src/standards/standards-registry.js',
    test_reference: 'tests/architecture/run_standards_foundation_v1.js',
    rule_version_hash: RULE_HASH,
    effect: RULE_EFFECT.REQUIRE,
    ...overrides,
  };
}

function expectThrow(fn, code) {
  let thrown = null;
  try { fn(); } catch (error) { thrown = error; }
  assert(thrown, `Expected error ${code}`);
  assert.strictEqual(thrown.code, code, `Expected ${code}, got ${thrown.code}`);
}

function main() {
  let checks = 0;
  const check = (condition, message) => { assert(condition, message); checks++; };

  check(
    JSON.stringify(Object.values(STANDARD_STATUS).sort()) === JSON.stringify([
      'ACTIVE', 'DRAFT', 'FUTURE', 'RETIRED', 'SUPERSEDED', 'SUSPENDED', 'UNDER_REVIEW',
    ].sort()),
    'Lifecycle statuses must be the seven directive states only',
  );

  const active = standard();
  const activeValidation = validateStandardRecord(active);
  check(activeValidation.valid === true, `Active synthetic standard must validate: ${activeValidation.errors.join(',')}`);

  const invalidStatus = validateStandardRecord(standard({ status: 'PROPOSED' }));
  check(invalidStatus.valid === false && invalidStatus.errors.some((item) => item.startsWith('INVALID_STATUS:')), 'Unknown lifecycle status must fail closed');

  check(
    JSON.stringify(DRAFT_ALLOWED_USES) === JSON.stringify(['GAP_ANALYSIS', 'FUTURE_READINESS', 'IMPACT_ASSESSMENT', 'DEVELOPMENT_PLANNING']),
    'Draft usage must be limited to non-production analysis contexts',
  );

  const draft = standard({ version: '2.0-draft', status: STANDARD_STATUS.DRAFT, rule_version_hash: sha256('draft-rule') });
  const future = standard({
    version: '2.0',
    status: STANDARD_STATUS.FUTURE,
    publication_date: '2026-08-01',
    effective_date: '2026-10-01',
    rule_version_hash: sha256('future-rule'),
  });

  const context = {
    as_of_date: AS_OF,
    jurisdiction: 'SAUDI_ARABIA',
    purpose: 'ACQUISITION_ANALYSIS',
    asset_class: 'OFFICE',
  };

  const routed = selectProductionStandards([active, draft, future], context);
  check(routed.selected.length === 1 && routed.selected[0].version === '1.0', 'Only ACTIVE standard may enter production selection');
  check(routed.excluded.some((item) => item.status === 'DRAFT'), 'DRAFT standard must be excluded');
  check(routed.excluded.some((item) => item.status === 'FUTURE'), 'FUTURE standard must be excluded before activation');
  check(routed.transaction_authorized === false && routed.legal_approval_established === false, 'Registry routing must not create transaction or legal authority');

  const draftEval = evaluateProductionApplicability(draft, context);
  check(draftEval.enforceable_in_production === false && draftEval.reasons.includes('NON_ACTIVE_STATUS:DRAFT'), 'Draft must never be production-enforceable');
  const futureEval = evaluateProductionApplicability(future, context);
  check(futureEval.enforceable_in_production === false && futureEval.reasons.includes('NON_ACTIVE_STATUS:FUTURE'), 'Future standard must never be production-enforceable before governed activation');

  expectThrow(() => assertNoNonActiveProductionStandards([active, draft]), 'NON_ACTIVE_STANDARD_ENFORCED');
  checks++;

  const allGates = Object.fromEntries(ACTIVATION_GATE_KEYS.map((key) => [key, true]));
  expectThrow(() => activateFutureStandard(future, allGates, AS_OF), 'FUTURE_STANDARD_NOT_YET_EFFECTIVE');
  checks++;
  expectThrow(() => activateFutureStandard(future, { ...allGates, reportTemplatesUpdated: false }, '2026-10-01'), 'STANDARD_ACTIVATION_GATES_INCOMPLETE');
  checks++;

  const activated = activateFutureStandard(future, allGates, '2026-10-01');
  check(activated.status === STANDARD_STATUS.ACTIVE, 'Future standard may activate only after date + all gates');
  check(/^[a-f0-9]{64}$/.test(activated.activation_evidence_hash), 'Activation evidence must be integrity-hashed');

  const prior = supersedeStandard(active, activated);
  check(prior.status === STANDARD_STATUS.SUPERSEDED, 'Prior active version must become SUPERSEDED after governed replacement');
  check(prior.superseded_by[0] === 'SYNTHETIC_SA_VALUATION@2.0', 'Supersession link must preserve replacement identity/version');

  const snapshot = createStandardsSnapshot([active, draft, future], context);
  check(snapshot.selected.length === 1 && snapshot.selected[0].version === '1.0', 'Historical snapshot must preserve exact active version');
  check(/^[a-f0-9]{64}$/.test(snapshot.standards_snapshot_version), 'Standards snapshot must have deterministic version hash');
  check(snapshot.automatic_recalculation_on_new_standard === false && snapshot.historical_reproduction_required === true, 'Historical deals must not silently rebase onto new standards');
  const snapshotAgain = createStandardsSnapshot([future, draft, active], context);
  check(snapshotAgain.standards_snapshot_version === snapshot.standards_snapshot_version, 'Snapshot hash must be stable regardless registry input ordering');

  const stale = standard({ next_review: '2026-09-01' });
  const staleEval = evaluateProductionApplicability(stale, context);
  check(staleEval.stale === true && staleEval.warning_code === 'STANDARD_VERIFICATION_STALE', 'Stale verification must emit required warning');

  const internationalMandatory = standard({
    standard_id: 'SYNTHETIC_INTERNATIONAL',
    jurisdiction: 'INTERNATIONAL',
    version: '1.0',
  });
  const conflict = resolveStandardConflict(active, internationalMandatory);
  check(conflict.resolution === 'SAUDI_MANDATORY_REQUIREMENT_PREVAILS', 'Saudi mandatory requirement must prevail over conflicting international mandatory reference');
  check(conflict.legal_approval_established === false, 'Conflict resolution rule must not self-establish legal approval');

  const validRule = rule();
  check(validateStandardRule(validRule).valid === true, 'Synthetic standard rule must validate');
  check(bindRuleToStandard(validRule, active).valid === true, 'Rule must bind only to matching standard/version/effective date/hash');
  const eligibility = evaluateRuleProductionEligibility(validRule, active, context);
  check(eligibility.eligible_for_production_effect === true, 'Bound ACTIVE rule must be eligible in matching context');

  const draftRule = rule({
    version: '2.0-draft',
    effective_date: draft.effective_date,
    rule_version_hash: draft.rule_version_hash,
  });
  const draftRuleEligibility = evaluateRuleProductionEligibility(draftRule, draft, context);
  check(draftRuleEligibility.eligible_for_production_effect === false, 'Rule from DRAFT standard must not affect production');
  expectThrow(() => assertProductionRulesEligible([{ rule: draftRule, standard: draft }], context), 'INELIGIBLE_STANDARD_RULES');
  checks++;

  const matrix = buildStandardRequirementsMatrix([active], [validRule], context);
  check(matrix.traceability_complete === true, 'Standard requirements matrix must preserve standard→provision→module→code→test traceability');
  check(matrix.rows[0].result === 'PASS' && matrix.rows[0].status === 'ACTIVE', 'Traceability row must reflect active eligible rule');
  check(/^[a-f0-9]{64}$/.test(matrix.matrix_hash), 'Requirements matrix must be integrity-hashed');

  console.log(`WAVE_7A_STANDARDS_FOUNDATION=PASS checks=${checks}`);
}

main();
