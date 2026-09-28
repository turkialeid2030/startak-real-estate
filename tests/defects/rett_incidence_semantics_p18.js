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

const buildingAcqAr = getDecisionMetricLabelOverride('ar-SA', 'inputBuilding.transferFeeRate');
assert.ok(buildingAcqAr.includes('الاستحواذ'));
assert.ok(!buildingAcqAr.includes('الخروج'));
assert.ok(!buildingAcqAr.includes('المشتري ملزم نظامًا'));

const buildingExitAr = getDecisionMetricLabelOverride('ar-SA', 'inputBuilding.exitTransferFeeRate');
assert.ok(buildingExitAr.includes('المحمّلة اقتصاديًا على البائع'));
const buildingExitNoteAr = getDecisionMetricLabelOverride('ar-SA', 'inputBuilding.exitTransferFeeRateNote');
assert.ok(buildingExitNoteAr.includes('لا يحدد المكلّف نظامًا'));
assert.ok(buildingExitNoteAr.includes('0%'));
assert.ok(buildingExitNoteAr.includes('الإعفاءات'));

const buildingExitEn = getDecisionMetricLabelOverride('en', 'inputBuilding.exitTransferFeeRate');
assert.ok(buildingExitEn.includes('Seller-Borne'));
const buildingExitNoteEn = getDecisionMetricLabelOverride('en', 'inputBuilding.exitTransferFeeRateNote');
assert.ok(buildingExitNoteEn.includes('does not determine the statutory taxpayer'));
assert.ok(buildingExitNoteEn.includes('0%'));

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
