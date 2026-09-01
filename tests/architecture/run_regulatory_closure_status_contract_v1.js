'use strict';

const assert = require('assert');
const {
  REGULATORY_CLOSURE_STATUS,
  REGULATORY_CLASSIFICATION,
  AUTHORIZED_REVIEWER_TYPE,
} = require('../../src/compliance/regulatory-closure-evidence');

assert.deepStrictEqual(Object.values(REGULATORY_CLOSURE_STATUS).sort(), [
  'EVIDENCE_PACK_COMPLETE',
  'HOLD_AUTHORIZATION',
  'HOLD_CLASSIFICATION',
  'HOLD_EVIDENCE_REFS',
  'HOLD_OPERATING_BOUNDARIES',
  'HOLD_REVIEW',
  'HOLD_SCOPE',
  'HOLD_SOURCE_EVIDENCE',
  'HOLD_SOURCE_FRESHNESS',
].sort());

assert.ok(Object.values(REGULATORY_CLASSIFICATION).includes('DECISION_SUPPORT_ONLY'));
assert.ok(Object.values(REGULATORY_CLASSIFICATION).includes('REGULATED_REAL_ESTATE_CONSULTATION_ANALYSIS'));
assert.ok(Object.values(AUTHORIZED_REVIEWER_TYPE).includes('LEGAL_COUNSEL'));

console.log('REGULATORY_CLOSURE_STATUS_CONTRACT_V1=PASS checks=4');
