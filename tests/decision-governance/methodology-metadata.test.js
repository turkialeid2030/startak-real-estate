'use strict';
const assert = require('assert');
const { getRecommendationMethodologyMetadata } = require('../../src/decision-governance/methodology-metadata');

const m = getRecommendationMethodologyMetadata();
assert.ok(m.modelVersion);
assert.ok(m.effectiveDate);
assert.ok(m.hardGates.includes('EVIDENCE_READINESS'));
assert.ok(m.hardGates.includes('LEGAL_DUE_DILIGENCE'));
assert.ok(m.hardGates.includes('REGULATORY_DUE_DILIGENCE'));
assert.ok(m.hardGates.includes('TECHNICAL_DUE_DILIGENCE'));
assert.ok(m.financingGates.includes('DSCR'));
assert.strictEqual(m.financialResultLabels.PASS.en, 'Financial Analysis Passed');
assert.strictEqual(m.financialResultLabels.PASS.ar, 'اجتاز التحليل المالي');
assert.match(m.scopeNotice.ar, /لا تمثل اعتمادًا قانونيًا أو نظاميًا/);
assert.match(m.scopeNotice.en, /not legal or regulatory approval/i);
assert.ok(!/investment approved/i.test(JSON.stringify(m.financialResultLabels)));
assert.ok(!/يوصى بالشراء/.test(JSON.stringify(m.financialResultLabels)));
console.log('METHODOLOGY_METADATA_TESTS=PASS');
