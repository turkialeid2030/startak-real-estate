'use strict';

const assert = require('assert/strict');
const {
  SAUDI_RETT_EVIDENCE,
  getDecisionMetricLabelOverride,
} = require('../../src/i18n/decision-metric-semantics');

assert.equal(SAUDI_RETT_EVIDENCE.authority, 'ZATCA_AND_UMM_AL_QURA');
assert.equal(SAUDI_RETT_EVIDENCE.reviewedOn, '2026-09-27');
assert.equal(SAUDI_RETT_EVIDENCE.effectiveDate, '2025-04-10');
assert.equal(SAUDI_RETT_EVIDENCE.statutoryRate, 0.05);
assert.equal(SAUDI_RETT_EVIDENCE.statutoryResponsibleParty, 'DISPOSER_TRANSFEROR');
assert.equal(SAUDI_RETT_EVIDENCE.exemptionsExist, true);
assert.equal(SAUDI_RETT_EVIDENCE.economicIncidenceRequiresDealEvidence, true);
assert.equal(SAUDI_RETT_EVIDENCE.runtimeApplicabilityEngineComplete, false);
assert.ok(Object.isFrozen(SAUDI_RETT_EVIDENCE));
assert.ok(Object.isFrozen(SAUDI_RETT_EVIDENCE.sources));

const buildingAr = getDecisionMetricLabelOverride('ar-SA', 'inputBuilding.transferFeeRate');
assert.ok(buildingAr.includes('سيناريو اقتصادي'));
assert.ok(buildingAr.includes('الاستحواذ والخروج'));
assert.ok(!buildingAr.includes('المشتري ملزم نظامًا'));

const landAcqAr = getDecisionMetricLabelOverride('ar-SA', 'inputLand.landTransferFeeRate');
assert.ok(landAcqAr.includes('المحمّلة اقتصاديًا على المشتري'));

const landExitAr = getDecisionMetricLabelOverride('ar-SA', 'inputLand.exitTransferFeeRate');
assert.ok(landExitAr.includes('المحمّلة اقتصاديًا على البائع'));
const landExitNoteAr = getDecisionMetricLabelOverride('ar-SA', 'inputLand.exitTransferFeeRateNote');
assert.ok(landExitNoteAr.includes('ليس تحديدًا تلقائيًا للمكلّف نظامًا'));
assert.ok(landExitNoteAr.includes('المتصرف مسؤولًا'));
assert.ok(landExitNoteAr.includes('إعفاءات'));

const landExitEn = getDecisionMetricLabelOverride('en', 'inputLand.exitTransferFeeRate');
assert.ok(landExitEn.includes('Seller-Borne'));
const landExitNoteEn = getDecisionMetricLabelOverride('en', 'inputLand.exitTransferFeeRateNote');
assert.ok(landExitNoteEn.includes('not an automatic statement of the statutory taxpayer'));
assert.ok(landExitNoteEn.includes('disposer/transferor'));

console.log('RETT_INCIDENCE_SEMANTICS_P18=PASS');
