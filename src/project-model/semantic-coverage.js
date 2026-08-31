'use strict';

const { SEMANTIC_RULES } = require('../document-intelligence/semantics/registry');
const { EVIDENCE_DOMAIN, REQUIREMENT, buildEvidenceDomainPlan } = require('./evidence-plan');

const RULE_COVERAGE_STATUS = Object.freeze({
  RULES_AVAILABLE: 'RULES_AVAILABLE',
  NO_RULES_REGISTERED: 'NO_RULES_REGISTERED',
});

const OVERALL_RULE_COVERAGE = Object.freeze({
  NO_REQUIRED_DOMAIN_RULE_GAPS: 'NO_REQUIRED_DOMAIN_RULE_GAPS',
  REQUIRED_DOMAIN_RULE_GAPS: 'REQUIRED_DOMAIN_RULE_GAPS',
});

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freeze(child);
  return value;
}

function domainForSemanticKey(key) {
  if (key === 'property.land_area') return EVIDENCE_DOMAIN.SITE_LAND;
  if (String(key).startsWith('property.')) return EVIDENCE_DOMAIN.BUILT_FORM;
  if (String(key).startsWith('transaction.')) return EVIDENCE_DOMAIN.TRANSACTION;
  if (String(key).startsWith('leasing.')) return EVIDENCE_DOMAIN.LEASING;
  if (String(key).startsWith('financial.')) return EVIDENCE_DOMAIN.FINANCIAL;
  if (String(key).startsWith('market.')) return EVIDENCE_DOMAIN.MARKET;
  if (String(key).startsWith('development.')) return EVIDENCE_DOMAIN.DEVELOPMENT;
  if (String(key).startsWith('financing.')) return EVIDENCE_DOMAIN.FINANCING;
  if (String(key).startsWith('operations.')) return EVIDENCE_DOMAIN.OPERATIONS;
  if (String(key).startsWith('valuation.')) return EVIDENCE_DOMAIN.VALUATION;
  if (String(key).startsWith('regulatory.')) return EVIDENCE_DOMAIN.REGULATORY;
  if (String(key).startsWith('tax.')) return EVIDENCE_DOMAIN.TAX;
  if (String(key).startsWith('capex.')) return EVIDENCE_DOMAIN.CAPEX;
  if (String(key).startsWith('exit.')) return EVIDENCE_DOMAIN.EXIT;
  if (String(key).startsWith('schedule.')) return EVIDENCE_DOMAIN.SCHEDULE;
  if (String(key).startsWith('risk.')) return EVIDENCE_DOMAIN.RISK;
  if (String(key).startsWith('location.')) return EVIDENCE_DOMAIN.LOCATION;
  if (String(key).startsWith('ownership.') || String(key).startsWith('rights.')) return EVIDENCE_DOMAIN.RIGHTS_OWNERSHIP;
  if (String(key).startsWith('identity.')) return EVIDENCE_DOMAIN.IDENTITY;
  if (String(key).startsWith('esg.')) return EVIDENCE_DOMAIN.ESG;
  return null;
}

function assessSemanticRuleCoverage(profile) {
  const plan = buildEvidenceDomainPlan(profile);
  const rulesByDomain = new Map();

  for (const rule of SEMANTIC_RULES) {
    const domain = domainForSemanticKey(rule.key);
    if (!domain) continue;
    if (!rulesByDomain.has(domain)) rulesByDomain.set(domain, []);
    rulesByDomain.get(domain).push({ id: rule.id, key: rule.key });
  }

  const requiredDomainCoverage = plan.requiredDomains.map((entry) => {
    const rules = rulesByDomain.get(entry.domain) || [];
    return {
      domain: entry.domain,
      requirement: REQUIREMENT.REQUIRED,
      status: rules.length ? RULE_COVERAGE_STATUS.RULES_AVAILABLE : RULE_COVERAGE_STATUS.NO_RULES_REGISTERED,
      registeredRuleCount: rules.length,
      registeredRules: rules,
      note: rules.length
        ? 'At least one deterministic semantic rule is registered for this domain; this does not mean the full domain is semantically complete.'
        : 'No deterministic semantic rule is currently registered for this required domain.',
    };
  });

  const gaps = requiredDomainCoverage.filter((entry) => entry.status === RULE_COVERAGE_STATUS.NO_RULES_REGISTERED);
  return freeze({
    schemaVersion: 1,
    projectId: profile.projectId,
    status: gaps.length ? OVERALL_RULE_COVERAGE.REQUIRED_DOMAIN_RULE_GAPS : OVERALL_RULE_COVERAGE.NO_REQUIRED_DOMAIN_RULE_GAPS,
    requiredDomainCoverage,
    gapDomains: gaps.map((entry) => entry.domain),
    registeredSemanticRuleCount: SEMANTIC_RULES.length,
    semantics: 'Coverage reports registry presence only. It never upgrades extracted evidence to verified fact and never implies investment readiness.',
  });
}

module.exports = {
  RULE_COVERAGE_STATUS,
  OVERALL_RULE_COVERAGE,
  domainForSemanticKey,
  assessSemanticRuleCoverage,
};
