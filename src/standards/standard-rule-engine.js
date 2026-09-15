'use strict';

const {
  STANDARD_STATUS,
  validateStandardRecord,
  evaluateProductionApplicability,
  sha256,
} = require('./standards-registry');

const RULE_EFFECT = Object.freeze({
  REQUIRE: 'REQUIRE',
  BLOCK: 'BLOCK',
  WARN: 'WARN',
  INFORMATIONAL: 'INFORMATIONAL',
});

const REQUIRED_RULE_KEYS = Object.freeze([
  'rule_id',
  'standard_id',
  'provision',
  'version',
  'effective_date',
  'module',
  'implementation',
  'code_reference',
  'test_reference',
  'rule_version_hash',
  'effect',
]);

function validateStandardRule(rule) {
  const errors = [];
  if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
    return Object.freeze({ valid: false, errors: Object.freeze(['STANDARD_RULE_MUST_BE_OBJECT']) });
  }
  for (const key of REQUIRED_RULE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(rule, key)) errors.push(`MISSING_RULE_FIELD:${key}`);
  }
  for (const key of REQUIRED_RULE_KEYS.filter((key) => key !== 'effect')) {
    if (Object.prototype.hasOwnProperty.call(rule, key) && (typeof rule[key] !== 'string' || rule[key].trim() === '')) {
      errors.push(`INVALID_RULE_STRING:${key}`);
    }
  }
  if (!Object.values(RULE_EFFECT).includes(rule.effect)) errors.push(`INVALID_RULE_EFFECT:${rule.effect}`);
  if (typeof rule.rule_version_hash === 'string' && !/^[a-f0-9]{64}$/i.test(rule.rule_version_hash)) {
    errors.push('INVALID_RULE_VERSION_HASH');
  }
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

function bindRuleToStandard(rule, standard) {
  const ruleValidation = validateStandardRule(rule);
  const standardValidation = validateStandardRecord(standard);
  const errors = [...ruleValidation.errors, ...standardValidation.errors];
  if (rule?.standard_id !== standard?.standard_id) errors.push('RULE_STANDARD_ID_MISMATCH');
  if (rule?.version !== standard?.version) errors.push('RULE_STANDARD_VERSION_MISMATCH');
  if (rule?.effective_date !== standard?.effective_date) errors.push('RULE_EFFECTIVE_DATE_MISMATCH');
  if (rule?.rule_version_hash !== standard?.rule_version_hash) errors.push('RULE_VERSION_HASH_MISMATCH');

  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors),
    standard_id: standard?.standard_id || null,
    version: standard?.version || null,
    rule_id: rule?.rule_id || null,
  });
}

function evaluateRuleProductionEligibility(rule, standard, context = {}) {
  const binding = bindRuleToStandard(rule, standard);
  const applicability = evaluateProductionApplicability(standard, context);
  const productionEffect = rule?.effect === RULE_EFFECT.REQUIRE || rule?.effect === RULE_EFFECT.BLOCK;
  const reasons = [...binding.errors, ...applicability.reasons];

  if (productionEffect && standard?.status !== STANDARD_STATUS.ACTIVE) {
    reasons.push('PRODUCTION_EFFECT_REQUIRES_ACTIVE_STANDARD');
  }

  return Object.freeze({
    rule_id: rule?.rule_id || null,
    standard_id: standard?.standard_id || null,
    version: standard?.version || null,
    eligible_for_production_effect: binding.valid && applicability.enforceable_in_production && reasons.length === 0,
    informational_only: !productionEffect,
    stale_standard_warning: applicability.warning_code,
    reasons: Object.freeze([...new Set(reasons)]),
    legal_approval_established: false,
    transaction_authorized: false,
  });
}

function assertProductionRulesEligible(bindings, context = {}) {
  const failures = [];
  for (const item of Array.isArray(bindings) ? bindings : []) {
    const result = evaluateRuleProductionEligibility(item.rule, item.standard, context);
    if ((item.rule?.effect === RULE_EFFECT.REQUIRE || item.rule?.effect === RULE_EFFECT.BLOCK) && !result.eligible_for_production_effect) {
      failures.push(result);
    }
  }
  if (failures.length) {
    const error = new Error(`INELIGIBLE_STANDARD_RULES:${failures.map((item) => item.rule_id).join(',')}`);
    error.code = 'INELIGIBLE_STANDARD_RULES';
    error.failures = failures;
    throw error;
  }
  return true;
}

function buildStandardRequirementsMatrix(standards, rules, context = {}) {
  const standardMap = new Map((Array.isArray(standards) ? standards : []).map((standard) => [`${standard.standard_id}@${standard.version}`, standard]));
  const rows = (Array.isArray(rules) ? rules : []).map((rule) => {
    const standard = standardMap.get(`${rule.standard_id}@${rule.version}`) || null;
    const eligibility = standard
      ? evaluateRuleProductionEligibility(rule, standard, context)
      : Object.freeze({ eligible_for_production_effect: false, reasons: Object.freeze(['STANDARD_NOT_FOUND']) });
    return Object.freeze({
      standard: rule.standard_id,
      provision: rule.provision,
      version: rule.version,
      effective_date: rule.effective_date,
      module: rule.module,
      implementation: rule.implementation,
      code_reference: rule.code_reference,
      test: rule.test_reference,
      rule_id: rule.rule_id,
      rule_version_hash: rule.rule_version_hash,
      effect: rule.effect,
      result: eligibility.eligible_for_production_effect || rule.effect === RULE_EFFECT.INFORMATIONAL || rule.effect === RULE_EFFECT.WARN ? 'PASS' : 'BLOCKED',
      status: standard?.status || 'STANDARD_NOT_FOUND',
      reasons: eligibility.reasons,
    });
  });

  const payload = {
    schema_version: 1,
    as_of_date: context.as_of_date || null,
    rows,
  };
  return Object.freeze({
    ...payload,
    matrix_hash: sha256(payload),
    traceability_complete: rows.every((row) => row.standard && row.provision && row.module && row.code_reference && row.test),
    legal_approval_established: false,
    transaction_authorized: false,
  });
}

module.exports = {
  RULE_EFFECT,
  REQUIRED_RULE_KEYS,
  validateStandardRule,
  bindRuleToStandard,
  evaluateRuleProductionEligibility,
  assertProductionRulesEligible,
  buildStandardRequirementsMatrix,
};
