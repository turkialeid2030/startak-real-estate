'use strict';

const assert = require('assert');
const { loadReview, validateReview } = require('../../tools/c45-internal-source-rights-advisory-review');

const review = loadReview();
const result = validateReview(review);

assert.strictEqual(result.sourceCount, 6);
assert.strictEqual(result.conditionalCount, 5);
assert.strictEqual(result.holdCount, 1);
assert.strictEqual(result.internalAdvisoryDecision, 'APPROVED_WITH_RESTRICTIONS');
assert.strictEqual(result.gate548Satisfied, false);

const byId = Object.fromEntries(review.sources.map((source) => [source.sourceId, source]));
assert.strictEqual(byId.REGA_REAL_ESTATE_INDICATORS.advisoryDisposition, 'CONDITIONAL_OPEN_DATA_ONLY');
assert.strictEqual(byId.GASTAT_REAL_ESTATE_STATISTICS.advisoryDisposition, 'CONDITIONAL_OPEN_DATA_API_ALLOWED');
assert.strictEqual(byId.ZATCA_REAL_ESTATE_TAX.advisoryDisposition, 'CONDITIONAL_OPEN_DATA_AND_REGULATORY_REFERENCE_ONLY');
assert.strictEqual(byId.SAMA_REAL_ESTATE_FINANCE.advisoryDisposition, 'CONDITIONAL_OPEN_DATA_API_ONLY');
assert.strictEqual(byId.MOJ_REAL_ESTATE_TRANSACTIONS.advisoryDisposition, 'CONDITIONAL_OPEN_DATA_ALLOWED');
assert.strictEqual(byId.EJAR_RENTAL_ECOSYSTEM.advisoryDisposition, 'HOLD_EXPLICIT_PERMISSION_REQUIRED');

for (const source of review.sources) {
  assert.strictEqual(source.externalAuthorization, false);
}

assert.strictEqual(review.externalSourceRightsAuthorizationGranted, false);
assert.strictEqual(review.mergeAuthorized, false);
assert.strictEqual(review.deploymentAuthorized, false);
assert.strictEqual(review.commercialGoLiveAuthorized, false);
assert.strictEqual(review.publicAiAuthorized, false);

console.log('C45_INTERNAL_SOURCE_RIGHTS_ADVISORY_REVIEW_REGRESSION=PASS');
console.log('C45_INTERNAL_ADVISORY_APPROVED_WITH_RESTRICTIONS=PASS');
console.log('C45_EXTERNAL_LEGAL_AUTHORITY_NOT_IMPERSONATED=PASS');
console.log('C45_EJAR_EXPLICIT_PERMISSION_REQUIRED=PASS');
