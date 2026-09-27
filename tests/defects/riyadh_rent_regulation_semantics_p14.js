'use strict';

const assert = require('assert/strict');
const {
  RIYADH_RENT_CONTROL_EVIDENCE,
  getDecisionMetricLabelOverride,
} = require('../../src/i18n/decision-metric-semantics');

assert.equal(RIYADH_RENT_CONTROL_EVIDENCE.authority, 'GENERAL_REAL_ESTATE_AUTHORITY_REGA');
assert.equal(RIYADH_RENT_CONTROL_EVIDENCE.reviewedOn, '2026-09-27');
assert.equal(RIYADH_RENT_CONTROL_EVIDENCE.effectiveDate, '2025-09-25');
assert.equal(RIYADH_RENT_CONTROL_EVIDENCE.coreRestrictionYears, 5);
assert.equal(RIYADH_RENT_CONTROL_EVIDENCE.geography, 'RIYADH_CITY');
assert.equal(RIYADH_RENT_CONTROL_EVIDENCE.appliesToExistingContractsAtEffectiveDate, true);
assert.equal(RIYADH_RENT_CONTROL_EVIDENCE.appliesToContractsConcludedAfterEffectiveDate, true);
assert.equal(RIYADH_RENT_CONTROL_EVIDENCE.firstRentForNeverPreviouslyLeasedPropertySetByAgreement, true);
assert.equal(RIYADH_RENT_CONTROL_EVIDENCE.runtimeApplicabilityEngineComplete, false);
assert.ok(Object.isFrozen(RIYADH_RENT_CONTROL_EVIDENCE));

const arNote = getDecisionMetricLabelOverride('ar-SA', 'inputBuilding.rentFreezeCheckedNote');
assert.ok(arNote.includes('العقود القائمة عند النفاذ'));
assert.ok(arNote.includes('العقود التي تُبرم بعده'));
assert.ok(arNote.includes('25 سبتمبر 2025'));
assert.ok(arNote.includes('لم يسبق تأجيره'));
assert.ok(arNote.includes('الأجرة الإجمالية الأولى بالاتفاق'));
assert.ok(!arNote.includes('العقود الجديدة وأول تأجير غير متأثرين'));

const arDashboard = getDecisionMetricLabelOverride('ar-SA', 'dashboardR3.regRentFreezeNote');
assert.ok(arDashboard.includes('العقود التي تُبرم بعده'));
assert.ok(arDashboard.includes('الأجرة الأولى بالاتفاق'));

const enNote = getDecisionMetricLabelOverride('en', 'inputBuilding.rentFreezeCheckedNote');
assert.ok(enNote.includes('leases concluded afterwards'));
assert.ok(enNote.includes('never previously leased'));
assert.ok(enNote.includes('does not mean later increases are exempt'));

console.log('RIYADH_RENT_REGULATION_SEMANTICS_P14=PASS');
