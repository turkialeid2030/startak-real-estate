'use strict';

const assert = require('assert');
const {
  TITLE_FACT_STATUS,
  TITLE_RESULT_STATUS,
  createTitleFact,
  assessTitleFacts,
} = require('../../src/title-intelligence');

function fact(key, value, status = TITLE_FACT_STATUS.VERIFIED, sourceRef = 'SYNTHETIC-DOC-1') {
  return createTitleFact({
    caseId: 'CASE-TITLE-001',
    propertyId: 'PROPERTY-001',
    key,
    value,
    status,
    sourceType: 'SYNTHETIC_TITLE_FIXTURE',
    sourceRef,
    observedAt: '2026-08-31',
  });
}

const completeFacts = [
  fact('documentId', 'DOC-001'),
  fact('ownerName', 'Synthetic Owner'),
  fact('propertyAreaSqm', 4918.61),
  fact('city', 'Synthetic City'),
  fact('parcelOrPlotId', 'PLOT-33'),
];

const complete = assessTitleFacts({ caseId: 'CASE-TITLE-001', propertyId: 'PROPERTY-001', facts: completeFacts });
assert.strictEqual(complete.status, TITLE_RESULT_STATUS.FACTS_SUFFICIENT_FOR_ANALYSIS);
assert.strictEqual(complete.legalConclusion, null);
assert.strictEqual(complete.blockers.length, 0);

const missing = assessTitleFacts({ caseId: 'CASE-TITLE-001', propertyId: 'PROPERTY-001', facts: completeFacts.filter((item) => item.key !== 'ownerName') });
assert.strictEqual(missing.status, TITLE_RESULT_STATUS.HOLD_EVIDENCE);
assert.ok(missing.blockers.some((item) => item.key === 'ownerName' && item.code === 'REQUIRED_TITLE_FACT_MISSING'));

const conflictFacts = [...completeFacts, fact('propertyAreaSqm', 5000, TITLE_FACT_STATUS.CONFLICT, 'SYNTHETIC-DOC-2')];
const conflict = assessTitleFacts({ caseId: 'CASE-TITLE-001', propertyId: 'PROPERTY-001', facts: conflictFacts });
assert.strictEqual(conflict.status, TITLE_RESULT_STATUS.HOLD_EVIDENCE);
assert.ok(conflict.blockers.some((item) => item.key === 'propertyAreaSqm' && item.code === 'UNRESOLVED_TITLE_FACT_CONFLICT'));

// Legacy C8 reconciliation gap: silently divergent VERIFIED values must not
// pass merely because no upstream reader used the explicit CONFLICT tag.
const implicitConflict = assessTitleFacts({
  caseId: 'CASE-TITLE-001',
  propertyId: 'PROPERTY-001',
  facts: [...completeFacts, fact('propertyAreaSqm', 5000, TITLE_FACT_STATUS.VERIFIED, 'SYNTHETIC-DOC-2')],
});
assert.strictEqual(implicitConflict.status, TITLE_RESULT_STATUS.HOLD_EVIDENCE);
assert.ok(implicitConflict.blockers.some((item) =>
  item.key === 'propertyAreaSqm' && item.code === 'UNRESOLVED_TITLE_FACT_CONFLICT'));

// A self-declared VERIFIED status without identifiable source provenance is
// insufficient even for non-certified analytical title-fact readiness.
const untraceable = assessTitleFacts({
  caseId: 'CASE-TITLE-001',
  propertyId: 'PROPERTY-001',
  facts: [
    ...completeFacts.filter((item) => item.key !== 'documentId'),
    createTitleFact({
      caseId: 'CASE-TITLE-001', propertyId: 'PROPERTY-001',
      key: 'documentId', value: 'DOC-001', status: TITLE_FACT_STATUS.VERIFIED,
      sourceType: 'SYNTHETIC_TITLE_FIXTURE',
    }),
  ],
});
assert.strictEqual(untraceable.status, TITLE_RESULT_STATUS.HOLD_EVIDENCE);
assert.ok(untraceable.blockers.some((item) =>
  item.key === 'documentId' && item.code === 'REQUIRED_TITLE_SOURCE_PROVENANCE_MISSING'));

const invalidRequiredValue = assessTitleFacts({
  caseId: 'CASE-TITLE-001',
  propertyId: 'PROPERTY-001',
  facts: [
    ...completeFacts.filter((item) => item.key !== 'ownerName'),
    fact('ownerName', null, TITLE_FACT_STATUS.VERIFIED),
  ],
});
assert.strictEqual(invalidRequiredValue.status, TITLE_RESULT_STATUS.HOLD_EVIDENCE);
assert.ok(invalidRequiredValue.blockers.some((item) =>
  item.key === 'ownerName' && item.code === 'INVALID_REQUIRED_TITLE_FACT_VALUE'));

// Text-only Unicode normalization and whitespace variation are not by
// themselves contradictory documentary owner names.
const compatibleNames = assessTitleFacts({
  caseId: 'CASE-TITLE-001',
  propertyId: 'PROPERTY-001',
  facts: [...completeFacts, fact('ownerName', 'Synthetic   Owner', TITLE_FACT_STATUS.OBSERVED, 'SYNTHETIC-DOC-2')],
});
assert.strictEqual(compatibleNames.status, TITLE_RESULT_STATUS.FACTS_SUFFICIENT_FOR_ANALYSIS);
assert.strictEqual(compatibleNames.legalConclusion, null);

const legalFlag = assessTitleFacts({
  caseId: 'CASE-TITLE-001',
  propertyId: 'PROPERTY-001',
  facts: [...completeFacts, fact('mortgageDetected', true, TITLE_FACT_STATUS.OBSERVED)],
});
assert.strictEqual(legalFlag.status, TITLE_RESULT_STATUS.LEGAL_REVIEW_REQUIRED);
assert.ok(legalFlag.legalReviewFlags.some((item) => item.key === 'mortgageDetected'));
assert.strictEqual(legalFlag.legalConclusion, null);

assert.throws(() => assessTitleFacts({
  caseId: 'CASE-TITLE-001',
  propertyId: 'PROPERTY-001',
  facts: [createTitleFact({ caseId: 'OTHER-CASE', propertyId: 'PROPERTY-001', key: 'documentId', value: 'X', status: TITLE_FACT_STATUS.VERIFIED, sourceType: 'SYNTHETIC' })],
}), /PROPERTY_OR_CASE_ISOLATION_VIOLATION/);

console.log('TITLE_INTELLIGENCE_V1=PASS');
console.log('TITLE_FACTS_DO_NOT_CREATE_LEGAL_CONCLUSION=PASS');
console.log('TITLE_CONFLICTS_FAIL_CLOSED=PASS');
console.log('TITLE_MULTI_SOURCE_AND_PROVENANCE_GUARDS=PASS');
console.log('LEGAL_SENSITIVE_FACTS_REQUIRE_REVIEW=PASS');
console.log('PROPERTY_CASE_ISOLATION=PASS');
