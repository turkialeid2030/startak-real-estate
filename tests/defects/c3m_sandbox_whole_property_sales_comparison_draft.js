'use strict';

const assert = require('assert/strict');
const {
  WHOLE_PROPERTY_UNIT_OF_COMPARISON,
} = require('../../src/contracts/whole-property-sales-comparison');
const {
  createSandboxWholePropertyComparableDraft,
  createSandboxWholePropertyReconciliationDraft,
} = require('../../src/valuation/sandbox-whole-property-sales-comparison-draft');

const comparable = createSandboxWholePropertyComparableDraft({
  comparableId: 'draft-comp-1',
  transactionKey: 'TX-001',
  sourcePropertyRef: 'source-property-1',
  assetType: 'OFFICE',
  unitOfComparison: WHOLE_PROPERTY_UNIT_OF_COMPARISON.GROSS_BUILDING_AREA_SQM,
  basisQuantity: 2000,
  sourceRef: 'DRAFT-MEASUREMENT-SOURCE',
});
assert.equal(comparable.unitOfComparison, 'GROSS_BUILDING_AREA_SQM');
assert.equal(comparable.verifiedBy, null);
assert.equal(comparable.verificationReference, null);
assert.equal(comparable.verifiedAt, null);
assert.equal(comparable.sandboxOnly, true);
assert.equal(comparable.decisionReady, false);
assert.equal(comparable.certifiedValuationEstablished, false);
assert.equal(comparable.transactionAuthorized, false);
assert.equal(comparable.publicAiAuthorized, false);

assert.throws(() => createSandboxWholePropertyComparableDraft({
  comparableId: 'authority-injection',
  transactionKey: 'TX-002',
  sourcePropertyRef: 'source-property-2',
  assetType: 'OFFICE',
  unitOfComparison: WHOLE_PROPERTY_UNIT_OF_COMPARISON.GROSS_BUILDING_AREA_SQM,
  basisQuantity: 2000,
  sourceRef: 'SOURCE',
  verifiedBy: 'CALLER-INVENTED-VERIFIER',
}), /cannot set trust\/authority fields/);

assert.throws(() => createSandboxWholePropertyComparableDraft({
  comparableId: 'land-basis',
  unitOfComparison: 'LAND_AREA_SQM',
}), /unsupported unitOfComparison/);

const reconciliation = createSandboxWholePropertyReconciliationDraft({
  reconciliationPolicyId: 'DRAFT-POLICY',
  weightsByComparableId: { 'draft-comp-1': 1 },
  rationale: 'Candidate weighting for professional review.',
  proposedByRef: 'analyst-draft',
});
assert.equal(reconciliation.weightsByComparableId['draft-comp-1'], 1);
assert.equal(reconciliation.reconciledBy, null);
assert.equal(reconciliation.reconciliationReference, null);
assert.equal(reconciliation.reconciledAt, null);
assert.equal(reconciliation.sandboxOnly, true);
assert.equal(reconciliation.decisionReady, false);

assert.throws(() => createSandboxWholePropertyReconciliationDraft({
  reconciliationPolicyId: 'DRAFT-POLICY',
  weightsByComparableId: { 'draft-comp-1': 1 },
  reconciledBy: 'CALLER-INVENTED-RECONCILER',
}), /cannot set trust\/authority fields/);

assert.throws(() => createSandboxWholePropertyReconciliationDraft({
  weightsByComparableId: [],
}), /weightsByComparableId must be an object/);

console.log('C3M_SANDBOX_WHOLE_PROPERTY_SALES_COMPARISON_DRAFT=PASS');
