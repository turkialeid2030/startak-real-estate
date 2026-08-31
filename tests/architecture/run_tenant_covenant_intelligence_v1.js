'use strict';

const assert = require('assert');
const {
  TENANT_EVIDENCE_STATUS,
  TENANT_RESULT_STATUS,
  TENANT_CLASS,
  createTenantEvidenceFact,
  createTenantPolicyProfile,
  validatePolicy,
  assessTenant,
  resolveGuaranteeRequirement,
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
assert.strictEqual(policy.applicability.financialCapacityMinimumAnnualRent, 3000000);
assert.strictEqual(policy.rentAffordability.classThresholds[TENANT_CLASS.LARGE], 0.15);
assert.strictEqual(policy.rentAffordability.classThresholds[TENANT_CLASS.MEDIUM], 0.10);
assert.strictEqual(policy.rentAffordability.classThresholds[TENANT_CLASS.SMALL], 0.08);

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
  fact(tenantId, 'businessAge', 1.0),
  fact(tenantId, 'sectorStability', 1.0),
  fact(tenantId, 'useCompatibility', 1.0),
  fact(tenantId, 'guaranteeStrength', 1.0),
  fact(tenantId, 'sectorRisk', 1.0),
  fact(tenantId, 'annualRevenue', 1.0, 10000000),
];

// Supplied form excludes the 40-point financial-capacity axis for annual rent below SAR 3m.
// It then uses a 60-point result table. The engine preserves that source-specific policy rather
// than normalizing it into an invented 100-point decision threshold.
const favourable = assessTenant({
  tenantId,
  facts,
  policy,
  annualRent: 600000,
  annualRevenue: 10000000,
  tenantClass: TENANT_CLASS.LARGE,
  annualContractValue: 2000000,
  revenueEvidenceKey: 'annualRevenue',
});
assert.strictEqual(favourable.financialCapacityApplicability, 'EXCLUDED_BY_REFERENCE_POLICY');
assert.strictEqual(favourable.assessedWeight, 60);
assert.strictEqual(favourable.status, TENANT_RESULT_STATUS.TENANT_ANALYTICAL_FAVOURABLE);
assert.strictEqual(favourable.affordability.status, 'PASS');
assert.strictEqual(favourable.affordability.threshold, 0.15);
assert.ok(favourable.rawWeightedPoints >= 40);
assert.strictEqual(favourable.referenceDecisionBand.sourceLabel, 'قبول مباشر');
assert.deepStrictEqual(favourable.prohibitedClaims, ['CREDIT_RATING', 'LEGAL_CLEAR', 'APPROVE_TENANT', 'REJECT_TENANT']);

// Financial evidence is not silently required when the explicit reference-policy rent threshold excludes it.
const noFinancialFacts = facts.filter((x) => ![
  'auditedFinancialStatements3Y', 'liquidity', 'operatingCashFlow', 'leverageDebtRatio', 'paidInCapital',
].includes(x.key));
const below3m = assessTenant({
  tenantId,
  facts: noFinancialFacts,
  policy,
  annualRent: 600000,
  annualRevenue: 10000000,
  tenantClass: TENANT_CLASS.LARGE,
  annualContractValue: 2000000,
});
assert.notStrictEqual(below3m.status, TENANT_RESULT_STATUS.HOLD_EVIDENCE);
assert.ok(!below3m.evidenceGaps.some((x) => x.key === 'auditedFinancialStatements3Y'));

// At/above SAR 3m the reference form brings financial capacity into scope, but the supplied
// document does not define a 100-point final decision table. Complete evidence therefore
// produces HOLD_POLICY rather than an invented approval threshold.
const fullProfile = assessTenant({
  tenantId,
  facts,
  policy,
  annualRent: 3000000,
  annualRevenue: 30000000,
  tenantClass: TENANT_CLASS.LARGE,
  annualContractValue: 5000000,
});
assert.strictEqual(fullProfile.assessedWeight, 100);
assert.strictEqual(fullProfile.status, TENANT_RESULT_STATUS.HOLD_POLICY);
assert.ok(fullProfile.policyGaps.some((x) => x.code === 'REFERENCE_FORM_DOES_NOT_DEFINE_DECISION_BANDS_FOR_100_POINT_PROFILE'));

const missingLegal = facts.filter((x) => x.key !== 'creditReport');
const hold = assessTenant({ tenantId, facts: missingLegal, policy, annualRent: 600000, annualContractValue: 2000000 });
assert.strictEqual(hold.status, TENANT_RESULT_STATUS.HOLD_EVIDENCE);
assert.ok(hold.evidenceGaps.some((x) => x.key === 'creditReport'));

const conflictingFacts = [...facts, createTenantEvidenceFact({
  tenantId,
  key: 'sectorRisk',
  score: 0.2,
  status: TENANT_EVIDENCE_STATUS.CONFLICT,
  sourceType: 'SYNTHETIC_CONFLICT',
  sourceRef: 'SYNTH-CONFLICT-SECTOR',
  observedAt: '2026-08-31',
})];
const conflict = assessTenant({ tenantId, facts: conflictingFacts, policy, annualRent: 600000, annualContractValue: 2000000 });
assert.strictEqual(conflict.status, TENANT_RESULT_STATUS.HOLD_EVIDENCE);
assert.ok(conflict.conflicts.some((x) => x.key === 'sectorRisk'));

const legalFlagFacts = facts.map((x) => x.key === 'enforcementCases' ? fact(tenantId, 'enforcementCases', 0.2, true) : x);
const legalReview = assessTenant({ tenantId, facts: legalFlagFacts, policy, annualRent: 600000, annualContractValue: 2000000 });
assert.strictEqual(legalReview.status, TENANT_RESULT_STATUS.LEGAL_REVIEW_REQUIRED);
assert.ok(legalReview.legalReviewFlags.some((x) => x.key === 'enforcementCases'));

const affordabilityFail = assessTenant({
  tenantId,
  facts,
  policy,
  annualRent: 1600000,
  annualRevenue: 10000000,
  tenantClass: TENANT_CLASS.LARGE,
  annualContractValue: 2000000,
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
  tenantClass: TENANT_CLASS.LARGE,
  annualContractValue: 2000000,
});
assert.strictEqual(affordabilityHold.status, TENANT_RESULT_STATUS.HOLD_EVIDENCE);
assert.strictEqual(affordabilityHold.affordability.status, 'HOLD_EVIDENCE');

assert.strictEqual(resolveGuaranteeRequirement(2000000, policy).requirement, 'AS_POLICY');
assert.strictEqual(resolveGuaranteeRequirement(5000000, policy).requirement, 'BANK_GUARANTEE');
assert.strictEqual(resolveGuaranteeRequirement(12000000, policy).requirement, 'BANK_GUARANTEE_PLUS_PARENT_GUARANTEE');
assert.strictEqual(resolveGuaranteeRequirement(2500000, policy).status, 'HOLD_POLICY');

assert.throws(() => createTenantPolicyProfile({
  axes: {
    FINANCIAL_CAPACITY: {
      weight: 50,
      items: [{ key: 'auditedFinancialStatements3Y', weight: 50, required: true }],
    },
  },
}), /axis weights must sum/);

assert.throws(() => assessTenant({
  tenantId,
  facts: [fact('OTHER-TENANT', 'liquidity', 0.8)],
  policy,
}), /TENANT_ISOLATION_VIOLATION/);

console.log('TENANT_COVENANT_INTELLIGENCE_V1=PASS');
console.log('SUPPLIED_FORM_POLICY_PRESERVED_WITHOUT_INVENTED_100_POINT_BANDS=PASS');
console.log('FINANCIAL_CAPACITY_RENT_THRESHOLD_APPLICABILITY=PASS');
console.log('MISSING_EVIDENCE_FAILS_CLOSED=PASS');
console.log('CONFLICTING_TENANT_EVIDENCE_FAILS_CLOSED=PASS');
console.log('LEGAL_SENSITIVE_FACTS_REQUIRE_REVIEW=PASS');
console.log('RENT_AFFORDABILITY_CLASS_THRESHOLDS=PASS');
console.log('GUARANTEE_REFERENCE_BANDS_AND_GAPS_VISIBLE=PASS');
console.log('NO_CREDIT_RATING_OR_TENANT_APPROVAL_CLAIM=PASS');
