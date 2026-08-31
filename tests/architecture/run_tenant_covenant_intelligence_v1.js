'use strict';

const assert = require('assert');
const {
  TENANT_EVIDENCE_STATUS,
  TENANT_RESULT_STATUS,
  createTenantEvidenceFact,
  createTenantPolicyProfile,
  validatePolicy,
  assessTenant,
} = require('../../src/tenant-intelligence');

function fact(tenantId, key, score, value = null, status = TENANT_EVIDENCE_STATUS.VERIFIED) {
  return createTenantEvidenceFact({
    tenantId,
    key,
    value,
    score,
    status,
    sourceType: 'SYNTHETIC_TEST_FIXTURE',
    sourceRef: `SYNTH-${key}`,
    observedAt: '2026-08-31',
  });
}

const policy = createTenantPolicyProfile();
assert.strictEqual(validatePolicy(policy), policy);
assert.strictEqual(policy.policyId, 'TENANT_POLICY_PROFILE_REFERENCE_V1');

const tenantId = 'TENANT-SYNTH-001';
const facts = [
  fact(tenantId, 'auditedFinancialStatements3Y', 0.9),
  fact(tenantId, 'liquidity', 0.9),
  fact(tenantId, 'operatingCashFlow', 0.9),
  fact(tenantId, 'leverageDebtRatio', 0.8),
  fact(tenantId, 'paidInCapital', 0.9),
  fact(tenantId, 'creditReport', 0.9),
  fact(tenantId, 'enforcementCases', 1.0, false),
  fact(tenantId, 'bankruptcyProceedings', 1.0, false),
  fact(tenantId, 'priorContractualRentalBehaviour', 0.8),
  fact(tenantId, 'businessAge', 0.9),
  fact(tenantId, 'sectorStability', 0.8),
  fact(tenantId, 'useCompatibility', 1.0),
  fact(tenantId, 'guaranteeStrength', 0.9),
  fact(tenantId, 'sectorRisk', 0.8),
  fact(tenantId, 'annualRevenue', 1.0, 10000000),
];

const favourable = assessTenant({
  tenantId,
  facts,
  policy,
  annualRent: 600000,
  annualRevenue: 10000000,
  revenueEvidenceKey: 'annualRevenue',
});
assert.strictEqual(favourable.status, TENANT_RESULT_STATUS.TENANT_ANALYTICAL_FAVOURABLE);
assert.strictEqual(favourable.affordability.status, 'PASS');
assert.ok(favourable.score >= 80);
assert.deepStrictEqual(favourable.prohibitedClaims, ['CREDIT_RATING', 'LEGAL_CLEAR', 'APPROVE_TENANT', 'REJECT_TENANT']);

const missingFinancials = facts.filter((x) => x.key !== 'auditedFinancialStatements3Y');
const hold = assessTenant({ tenantId, facts: missingFinancials, policy });
assert.strictEqual(hold.status, TENANT_RESULT_STATUS.HOLD_EVIDENCE);
assert.ok(hold.evidenceGaps.some((x) => x.key === 'auditedFinancialStatements3Y'));

const conflictingFacts = [...facts, createTenantEvidenceFact({
  tenantId,
  key: 'liquidity',
  score: 0.2,
  status: TENANT_EVIDENCE_STATUS.CONFLICT,
  sourceType: 'SYNTHETIC_CONFLICT',
  sourceRef: 'SYNTH-CONFLICT-LIQUIDITY',
  observedAt: '2026-08-31',
})];
const conflict = assessTenant({ tenantId, facts: conflictingFacts, policy });
assert.strictEqual(conflict.status, TENANT_RESULT_STATUS.HOLD_EVIDENCE);
assert.ok(conflict.conflicts.some((x) => x.key === 'liquidity'));

const legalFlagFacts = facts.map((x) => x.key === 'enforcementCases' ? fact(tenantId, 'enforcementCases', 0.2, true) : x);
const legalReview = assessTenant({ tenantId, facts: legalFlagFacts, policy });
assert.strictEqual(legalReview.status, TENANT_RESULT_STATUS.LEGAL_REVIEW_REQUIRED);
assert.ok(legalReview.legalReviewFlags.some((x) => x.key === 'enforcementCases'));

const affordabilityFail = assessTenant({
  tenantId,
  facts,
  policy,
  annualRent: 1500000,
  annualRevenue: 10000000,
  revenueEvidenceKey: 'annualRevenue',
});
assert.strictEqual(affordabilityFail.affordability.status, 'FAIL');
assert.strictEqual(affordabilityFail.status, TENANT_RESULT_STATUS.TENANT_HIGH_RISK);

const weakRevenue = facts.map((x) => x.key === 'annualRevenue'
  ? fact(tenantId, 'annualRevenue', 1.0, 10000000, TENANT_EVIDENCE_STATUS.UNVERIFIED)
  : x);
const affordabilityHold = assessTenant({
  tenantId,
  facts: weakRevenue,
  policy,
  annualRent: 600000,
  annualRevenue: 10000000,
  revenueEvidenceKey: 'annualRevenue',
});
assert.strictEqual(affordabilityHold.status, TENANT_RESULT_STATUS.HOLD_EVIDENCE);
assert.strictEqual(affordabilityHold.affordability.status, 'HOLD_EVIDENCE');

assert.throws(() => createTenantPolicyProfile({
  axes: {
    FINANCIAL_CAPACITY: {
      weight: 50,
      items: [{ key: 'auditedFinancialStatements3Y', weight: 50, required: true }],
    },
  },
}), /weights must sum|axis weights must sum/);

assert.throws(() => assessTenant({
  tenantId,
  facts: [fact('OTHER-TENANT', 'liquidity', 0.8)],
  policy,
}), /TENANT_ISOLATION_VIOLATION/);

console.log('TENANT_COVENANT_INTELLIGENCE_V1=PASS');
console.log('TENANT_POLICY_VERSIONING_AND_WEIGHT_VALIDATION=PASS');
console.log('MISSING_EVIDENCE_FAILS_CLOSED=PASS');
console.log('CONFLICTING_TENANT_EVIDENCE_FAILS_CLOSED=PASS');
console.log('LEGAL_SENSITIVE_FACTS_REQUIRE_REVIEW=PASS');
console.log('RENT_AFFORDABILITY_IS_EVIDENCE_QUALIFIED=PASS');
console.log('NO_CREDIT_RATING_OR_TENANT_APPROVAL_CLAIM=PASS');
