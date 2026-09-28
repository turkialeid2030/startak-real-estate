'use strict';

const assert = require('assert/strict');
const { getDecisionMetricLabelOverride } = require('../../src/i18n/decision-metric-semantics');

const ar = getDecisionMetricLabelOverride('ar-SA', 'inputBuilding.leaseYears');
const en = getDecisionMetricLabelOverride('en', 'inputBuilding.leaseYears');

assert.equal(ar, 'مدة التغطية التعاقدية المتبقية من تاريخ الدراسة');
assert.equal(en, 'Remaining Contractual Lease Coverage from Study Date');
assert.ok(!ar.includes('عدد سنوات عقد التأجير'));
assert.ok(!en.includes('Lease Contract Term'));

console.log('P23_LEASE_YEARS_REMAINING_COVERAGE_SEMANTICS=PASS');
