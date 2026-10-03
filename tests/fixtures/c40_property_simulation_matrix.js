'use strict';

const landGold = require('../characterization/fixtures/RE-GOLD-001-U.json');
const buildingGold = require('../characterization/fixtures/RE-GOLD-002-U.json');
const { STUDY_TYPE } = require('../../src/contracts/study-type');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildingScenario(id, archetype, overrides = {}, meta = {}) {
  return Object.freeze({
    id,
    archetype,
    studyType: STUDY_TYPE.EXISTING_BUILDING,
    leverageEnabled: Object.prototype.hasOwnProperty.call(overrides, 'leverageEnabled')
      ? overrides.leverageEnabled
      : buildingGold.input_set.leverageEnabled,
    inputs: Object.freeze({ ...clone(buildingGold.input_set), ...overrides }),
    expectedIncomeMode: meta.expectedIncomeMode || 'POSITIVE',
    expectedLeverageMode: meta.expectedLeverageMode || 'UNLEVERED',
    note: meta.note || null,
  });
}

function landScenario(id, archetype, overrides = {}, meta = {}) {
  return Object.freeze({
    id,
    archetype,
    studyType: STUDY_TYPE.LAND_DEVELOPMENT,
    leverageEnabled: Object.prototype.hasOwnProperty.call(overrides, 'leverageEnabled')
      ? overrides.leverageEnabled
      : landGold.input_set.leverageEnabled,
    inputs: Object.freeze({ ...clone(landGold.input_set), ...overrides }),
    expectedIncomeMode: meta.expectedIncomeMode || 'POSITIVE',
    expectedLeverageMode: meta.expectedLeverageMode || 'UNLEVERED',
    note: meta.note || null,
  });
}

const C40_PROPERTY_SIMULATION_MATRIX = Object.freeze([
  buildingScenario('C40-BLD-RES-001', 'مبنى سكني مؤجر', {
    rentPerSqm: 950,
    serviceIncomeRate: 0.04,
    occupancyRate: 0.92,
    leaseStatus: 'مؤجر',
  }),
  buildingScenario('C40-BLD-OFF-002', 'مبنى مكاتب تجاري', {
    rentPerSqm: 1800,
    serviceIncomeRate: 0.12,
    occupancyRate: 1,
    leaseStatus: 'مؤجر',
  }),
  buildingScenario('C40-BLD-RET-003', 'مبنى تجزئة / مركز تجاري', {
    rentPerSqm: 2200,
    serviceIncomeRate: 0.16,
    occupancyRate: 0.88,
    leaseStatus: '3 أشهر',
  }),
  buildingScenario('C40-BLD-WHS-004', 'مستودع / لوجستيات', {
    floorCount: 1,
    floorAreaEach: 7800,
    efficiencyRatio: 0.95,
    netLeasableOverride: 7400,
    rentPerSqm: 420,
    serviceIncomeRate: 0.02,
    occupancyRate: 0.95,
  }),
  buildingScenario('C40-BLD-TWR-005', 'برج متعدد الاستخدامات', {
    floorCount: 12,
    floorAreaEach: 1800,
    netLeasableOverride: 18000,
    efficiencyRatio: 0.84,
    rentPerSqm: 2100,
    serviceIncomeRate: 0.14,
    occupancyRate: 0.9,
  }),
  buildingScenario('C40-BLD-VAC-006', 'عقار قائم بدون دخل', {
    rentPerSqm: 0,
    serviceIncomeRate: 0,
    occupancyRate: 0,
    leaseStatus: 'سنة',
  }, {
    expectedIncomeMode: 'ZERO',
    note: 'Zero-income simulation validates that no synthetic rent is manufactured.',
  }),
  buildingScenario('C40-BLD-LEV-007', 'عقار دخل سنوي ممول', {
    leverageEnabled: true,
    ltv: 0.5,
    rentPerSqm: 1750,
    occupancyRate: 0.95,
  }, {
    expectedLeverageMode: 'LEVERED',
  }),
  buildingScenario('C40-BLD-ZD-008', 'عقار مع طلب تمويل بنسبة دين صفر', {
    leverageEnabled: true,
    ltv: 0,
  }, {
    expectedLeverageMode: 'ZERO_DEBT_NORMALIZED',
  }),
  landScenario('C40-LND-RES-009', 'أرض تطوير سكني', {
    buildingTypeLabel: 'تطوير سكني',
    marketRentPerSqm: 900,
    serviceIncomeRate: 0.03,
    occupancyRate: 0.9,
  }),
  landScenario('C40-LND-COM-010', 'أرض تطوير تجاري', {
    buildingTypeLabel: 'تطوير تجاري',
    marketRentPerSqm: 1700,
    serviceIncomeRate: 0.1,
    occupancyRate: 0.9,
  }),
  landScenario('C40-LND-TWR-011', 'أرض برج متعدد الاستخدامات', {
    buildingTypeLabel: 'برج متعدد الاستخدامات',
    officeFloorCount: 15,
    buildableRatio: 0.55,
    marketRentPerSqm: 1900,
    occupancyRate: 0.88,
  }),
  landScenario('C40-LND-WHS-012', 'أرض تطوير مستودعات ولوجستيات', {
    buildingTypeLabel: 'مستودعات ولوجستيات',
    officeFloorCount: 1,
    buildableRatio: 0.7,
    servicesRatioPerFloor: 0.05,
    basementFloorCount: 1,
    marketRentPerSqm: 380,
    serviceIncomeRate: 0.01,
    occupancyRate: 0.95,
  }),
  landScenario('C40-LND-ZERO-013', 'أرض تطوير بافتراض دخل تشغيلي صفر', {
    buildingTypeLabel: 'اختبار دخل صفري',
    marketRentPerSqm: 0,
    serviceIncomeRate: 0,
    occupancyRate: 0,
  }, {
    expectedIncomeMode: 'ZERO',
    note: 'Zero-income development simulation validates fail-safe financial propagation.',
  }),
]);

module.exports = {
  C40_PROPERTY_SIMULATION_MATRIX,
  buildingScenario,
  landScenario,
};
