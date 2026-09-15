'use strict';

const assert = require('assert');
const { recommendationMethodologyMetadata } = require('../../src/decision-governance/methodology-metadata');
const { MODEL_CARD, buildModelCardVerification, getAboutMethodology } = require('../../src/decision-governance/model-card');

assert.strictEqual(MODEL_CARD.modelVersion, recommendationMethodologyMetadata.modelVersion);
assert.strictEqual(MODEL_CARD.releaseDate, recommendationMethodologyMetadata.effectiveDate);
assert.strictEqual(MODEL_CARD.scope, recommendationMethodologyMetadata.decisionScope);
assert.strictEqual(MODEL_CARD.hardGates, recommendationMethodologyMetadata.hardGates);
assert.ok(MODEL_CARD.unsupportedUses.includes('FORMAL_ACCREDITED_VALUATION'));
assert.ok(MODEL_CARD.unsupportedUses.includes('AUTOMATIC_TRANSACTION_EXECUTION'));
assert.ok(MODEL_CARD.knownLimitations.includes('LOCAL_HISTORY_IS_NOT_AN_ENTERPRISE_AUDIT_TRAIL'));

const verified = buildModelCardVerification({
  regressionTestCount: 430,
  lastVerifiedCommit: '0123456789abcdef0123456789abcdef01234567',
});
assert.strictEqual(verified.validationStatus, 'VERIFIED');
assert.strictEqual(verified.regressionTestCount, 430);
assert.strictEqual(verified.lastVerifiedCommit, '0123456789abcdef0123456789abcdef01234567');
assert.throws(() => buildModelCardVerification({ regressionTestCount: -1, lastVerifiedCommit: 'bad' }), TypeError);

const aboutAr = getAboutMethodology('ar');
const aboutEn = getAboutMethodology('en');
assert.strictEqual(aboutAr.modelVersion, aboutEn.modelVersion);
assert.strictEqual(aboutAr.notice, recommendationMethodologyMetadata.scopeNotice.ar);
assert.strictEqual(aboutEn.notice, recommendationMethodologyMetadata.scopeNotice.en);
assert.deepStrictEqual(aboutAr.hardGates, aboutEn.hardGates);

console.log('MODEL_CARD_TESTS=PASS');
