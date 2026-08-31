'use strict';

const assert = require('assert');
const {
  REGULATORY_RULE_STATUS,
  REGULATORY_RESULT_STATUS,
  createRegulatoryRule,
  ruleApplies,
  evaluateRegulatoryContext,
} = require('../../src/regulatory-intelligence');

const currentRule = createRegulatoryRule({
  ruleId: 'SYNTH-REG-001',
  authority: 'SYNTHETIC_AUTHORITY',
  regulationName: 'Synthetic zoning rule',
  officialSource: 'https://example.invalid/official-rule',
  lastVerifiedDate: '2026-08-31',
  versionHash: 'synthetic-v1',
  reviewAfterDate: '2026-12-31',
  applicability: { jurisdiction: 'SA', assetClass: ['OFFICE', 'RETAIL'] },
  trigger: 'Development or use change',
  requirement: 'Verified zoning/use evidence required before decision',
  status: REGULATORY_RULE_STATUS.CURRENT,
  professionalReviewType: 'REGULATORY_REVIEW',
});

assert.strictEqual(ruleApplies(currentRule, { jurisdiction: 'SA', assetClass: 'OFFICE' }), true);
assert.strictEqual(ruleApplies(currentRule, { jurisdiction: 'SA', assetClass: 'INDUSTRIAL_LOGISTICS' }), false);

const noEvidence = evaluateRegulatoryContext({
  rules: [currentRule],
  context: { jurisdiction: 'SA', assetClass: 'OFFICE' },
  asOfDate: '2026-08-31',
  evidence: {},
});
assert.strictEqual(noEvidence.overallStatus, REGULATORY_RESULT_STATUS.HOLD_EVIDENCE);
assert.strictEqual(noEvidence.blockers[0].reason, 'REQUIREMENT_EVIDENCE_NOT_PROVIDED');

const satisfied = evaluateRegulatoryContext({
  rules: [currentRule],
  context: { jurisdiction: 'SA', assetClass: 'OFFICE' },
  asOfDate: '2026-08-31',
  evidence: { 'rule:SYNTH-REG-001:satisfied': true },
});
assert.strictEqual(satisfied.overallStatus, REGULATORY_RESULT_STATUS.PASS_INFORMATIONAL);
assert.ok(satisfied.semantics.includes('does not constitute legal compliance certification'));

const triggered = evaluateRegulatoryContext({
  rules: [currentRule],
  context: { jurisdiction: 'SA', assetClass: 'OFFICE' },
  asOfDate: '2026-08-31',
  evidence: { 'rule:SYNTH-REG-001:satisfied': false },
});
assert.strictEqual(triggered.overallStatus, REGULATORY_RESULT_STATUS.REQUIREMENT_TRIGGERED);

const staleRule = createRegulatoryRule({
  ...currentRule,
  ruleId: 'SYNTH-REG-STALE',
  reviewAfterDate: '2026-08-01',
});
const stale = evaluateRegulatoryContext({
  rules: [staleRule],
  context: { jurisdiction: 'SA', assetClass: 'OFFICE' },
  asOfDate: '2026-08-31',
  evidence: { 'rule:SYNTH-REG-STALE:satisfied': true },
});
assert.strictEqual(stale.overallStatus, REGULATORY_RESULT_STATUS.REGULATORY_REVIEW_REQUIRED);
assert.strictEqual(stale.blockers[0].reason, 'RULE_FRESHNESS_EXPIRED');

const supersededRule = createRegulatoryRule({
  ...currentRule,
  ruleId: 'SYNTH-REG-SUPERSEDED',
  status: REGULATORY_RULE_STATUS.SUPERSEDED,
});
const superseded = evaluateRegulatoryContext({
  rules: [supersededRule],
  context: { jurisdiction: 'SA', assetClass: 'OFFICE' },
  asOfDate: '2026-08-31',
  evidence: { 'rule:SYNTH-REG-SUPERSEDED:satisfied': true },
});
assert.strictEqual(superseded.overallStatus, REGULATORY_RESULT_STATUS.REGULATORY_REVIEW_REQUIRED);
assert.strictEqual(superseded.blockers[0].reason, 'RULE_STATUS_SUPERSEDED');

console.log('REGULATORY_INTELLIGENCE_V1=PASS');
console.log('RULE_APPLICABILITY_IS_CONTEXTUAL_NOT_PROJECT_NAME_DRIVEN=PASS');
console.log('STALE_OR_SUPERSEDED_RULES_FAIL_CLOSED=PASS');
console.log('MISSING_REGULATORY_EVIDENCE_FAILS_CLOSED=PASS');
console.log('PASS_DOES_NOT_CLAIM_LEGAL_COMPLIANCE_CERTIFICATION=PASS');
