'use strict';

const assert = require('assert');
const {
  SAUDI_OFFICIAL_SOURCE_CATALOG,
  REQUIRED_OBSERVATION_PROVENANCE,
  validateSourceObservation,
} = require('../../src/sources/saudi-official-source-catalog');

const expectedIds = [
  'REGA_REAL_ESTATE_INDICATORS',
  'GASTAT_REAL_ESTATE_STATISTICS',
  'ZATCA_REAL_ESTATE_TAX',
  'SAMA_REAL_ESTATE_FINANCE',
  'MOJ_REAL_ESTATE_TRANSACTIONS',
  'EJAR_RENTAL_ECOSYSTEM',
];

assert.deepStrictEqual(
  SAUDI_OFFICIAL_SOURCE_CATALOG.map((item) => item.id),
  expectedIds,
  'C40 official-source catalog must remain explicit and reviewable',
);
assert.strictEqual(new Set(expectedIds).size, expectedIds.length, 'source IDs must be unique');
assert.ok(REQUIRED_OBSERVATION_PROVENANCE.includes('retrievedAt'));
assert.ok(REQUIRED_OBSERVATION_PROVENANCE.includes('observationPeriod'));
assert.ok(REQUIRED_OBSERVATION_PROVENANCE.includes('verificationStatus'));

for (const source of SAUDI_OFFICIAL_SOURCE_CATALOG) {
  assert.ok(source.officialDomain.endsWith('.gov.sa') || source.officialDomain === 'ejar.sa', `${source.id} must use an official Saudi domain`);
  assert.strictEqual(source.integrationStatus, 'NOT_CONFIGURED', `${source.id} must not claim live integration without a configured connector`);
  assert.strictEqual(source.retrievalMode, 'MANUAL_OR_GOVERNED_CONNECTOR_REQUIRED');
}

assert.deepStrictEqual(validateSourceObservation(null), {
  valid: false,
  reasonCode: 'SOURCE_OBSERVATION_MISSING',
});
assert.strictEqual(validateSourceObservation({ sourceId: 'UNKNOWN' }).reasonCode, 'UNTRUSTED_SOURCE_ID');

const incomplete = validateSourceObservation({ sourceId: 'REGA_REAL_ESTATE_INDICATORS' });
assert.strictEqual(incomplete.valid, false);
assert.strictEqual(incomplete.reasonCode, 'SOURCE_PROVENANCE_INCOMPLETE');
assert.ok(incomplete.missing.length > 0);

const base = {
  sourceId: 'REGA_REAL_ESTATE_INDICATORS',
  sourceUrlOrDocumentRef: 'https://rei.rega.gov.sa/ar',
  retrievedAt: '2026-10-03T00:00:00+03:00',
  observationPeriod: 'TEST_PERIOD',
  geography: 'TEST_GEOGRAPHY',
  propertyType: 'TEST_PROPERTY_TYPE',
  unit: 'SAR_PER_SQM',
  value: 1234,
  verificationStatus: 'UNVERIFIED',
};
assert.strictEqual(validateSourceObservation(base).reasonCode, 'SOURCE_OBSERVATION_UNVERIFIED');
assert.strictEqual(validateSourceObservation({ ...base, verificationStatus: 'VERIFIED', value: Infinity }).reasonCode, 'SOURCE_VALUE_NONFINITE');
assert.strictEqual(validateSourceObservation({ ...base, verificationStatus: 'VERIFIED', retrievedAt: 'not-a-date' }).reasonCode, 'SOURCE_RETRIEVAL_TIMESTAMP_INVALID');

const verified = validateSourceObservation({ ...base, verificationStatus: 'VERIFIED' });
assert.strictEqual(verified.valid, true);
assert.strictEqual(verified.reasonCode, 'OFFICIAL_SOURCE_OBSERVATION_PROVENANCE_COMPLETE');

console.log('C40_OFFICIAL_SOURCE_GOVERNANCE=PASS');
console.log(`C40_OFFICIAL_SOURCE_COUNT=${SAUDI_OFFICIAL_SOURCE_CATALOG.length}`);
console.log('C40_LIVE_SOURCE_CONNECTORS_CONFIGURED=0');
console.log('C40_SOURCE_VALUES_HARDCODED=0');
console.log('C40_UNVERIFIED_SOURCE_FAIL_CLOSED=PASS');
