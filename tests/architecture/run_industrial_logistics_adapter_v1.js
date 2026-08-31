'use strict';

const assert = require('assert');
const {
  EVIDENCE_GRADE,
  INPUT_STATUS,
  createEvidenceRecord,
  INDUSTRIAL_SUBTYPE,
  LEASE_STRUCTURE,
  INTERNAL_INSPECTION_STATUS,
  BUILDING_PERMIT_STATUS,
  ADAPTER_STATUS,
  createIndustrialLogisticsAssetSpec,
  profileIndustrialLogisticsAsset,
  deriveAnnualRentPerSqm,
  calculateIndustrialLogisticsIncomeIndication,
} = require('../../src/valuation-intelligence');

function evidence(field, grade, status, sourceType = 'SYNTHETIC_TEST_FIXTURE') {
  return createEvidenceRecord({ field, grade, status, sourceType });
}

function descriptor(grade, status, sourceType) {
  return { grade, status, sourceType };
}

const spec = createIndustrialLogisticsAssetSpec({
  assetId: 'SYNTHETIC-WH-001',
  subtype: INDUSTRIAL_SUBTYPE.WAREHOUSE,
  landAreaSqm: 5000,
  builtAreaSqm: 3200,
  netLeasableAreaSqm: 3000,
  leaseStructure: LEASE_STRUCTURE.TENANT_BORNE_OPEX,
  internalInspectionStatus: INTERNAL_INSPECTION_STATUS.FULL_INTERNAL,
  buildingPermitStatus: BUILDING_PERMIT_STATUS.VERIFIED,
  clearHeightMeters: 9,
  dockDoorCount: 4,
  gradeLevelDoorCount: 2,
  yardAreaSqm: 1200,
  truckAccess: true,
  powerCapacityKva: 1000,
  fireLifeSafetyStatus: 'VERIFIED',
  constructionType: 'STEEL_FRAME',
  physicalCondition: 'GOOD',
  singleTenant: true,
});

const profile = profileIndustrialLogisticsAsset(spec);
assert.strictEqual(profile.missingOperationalSpecs.length, 0);
assert.strictEqual(profile.operationalSpecCompleteness, 1);
assert.strictEqual(profile.coverageRatio, 0.64);
assert.strictEqual(profile.leasableEfficiency, 0.9375);
assert.strictEqual(deriveAnnualRentPerSqm({ annualRent: 600000, netLeasableAreaSqm: 3000 }), 200);

const qualityEvidence = [
  evidence('titleDeed', EVIDENCE_GRADE.A_VERIFIED_OFFICIAL, INPUT_STATUS.VERIFIED),
  evidence('netLeasableAreaSqm', EVIDENCE_GRADE.A_VERIFIED_OFFICIAL, INPUT_STATUS.VERIFIED),
  evidence('annualIncome', EVIDENCE_GRADE.C_CONTRACTUAL, INPUT_STATUS.VERIFIED),
  evidence('operatingExpenses', EVIDENCE_GRADE.C_CONTRACTUAL, INPUT_STATUS.VERIFIED),
  evidence('capitalizationRate', EVIDENCE_GRADE.E_MARKET_OBSERVATION, INPUT_STATUS.OBSERVED),
];
const qualityPolicy = { minEvidenceCount: 5, maxAssumptionBurdenRatio: 0.2, maxLowGradeRatio: 0.2 };
const criticalRequirements = [
  {
    field: 'titleDeed',
    allowedGrades: [EVIDENCE_GRADE.A_VERIFIED_OFFICIAL],
    allowedStatuses: [INPUT_STATUS.VERIFIED],
  },
  {
    field: 'netLeasableAreaSqm',
    allowedGrades: [EVIDENCE_GRADE.A_VERIFIED_OFFICIAL, EVIDENCE_GRADE.C_CONTRACTUAL, EVIDENCE_GRADE.E_MARKET_OBSERVATION],
    allowedStatuses: [INPUT_STATUS.VERIFIED, INPUT_STATUS.OBSERVED],
  },
];

const common = {
  annualIncome: 600000,
  capitalizationRate: 0.08,
  incomeEvidence: descriptor(EVIDENCE_GRADE.C_CONTRACTUAL, INPUT_STATUS.VERIFIED, 'LEASE'),
  expenseEvidence: descriptor(EVIDENCE_GRADE.C_CONTRACTUAL, INPUT_STATUS.VERIFIED, 'LEASE'),
  capRateEvidence: descriptor(EVIDENCE_GRADE.E_MARKET_OBSERVATION, INPUT_STATUS.OBSERVED, 'MARKET'),
  qualityEvidence,
  qualityPolicy,
  criticalRequirements,
  valuationDate: '2026-08-31',
};

const result = calculateIndustrialLogisticsIncomeIndication({ ...common, spec, landlordOperatingExpenses: 0 });
assert.strictEqual(result.status, ADAPTER_STATUS.READY);
assert.strictEqual(result.annualRentPerLeasableSqm, 200);
assert.strictEqual(result.valuation.components.netOperatingIncome, 600000);
assert.strictEqual(result.valuation.value, 7500000);
assert.strictEqual(result.valuation.components.expenseTreatment, 'TENANT_BORNE_CONFIRMED');

const netLease = createIndustrialLogisticsAssetSpec({ ...spec, assetId: 'SYNTHETIC-WH-NET', leaseStructure: LEASE_STRUCTURE.NET });
const zeroOpexNet = calculateIndustrialLogisticsIncomeIndication({ ...common, spec: netLease, landlordOperatingExpenses: 0 });
assert.strictEqual(zeroOpexNet.status, ADAPTER_STATUS.HOLD_ASSET_DATA);
assert.strictEqual(zeroOpexNet.reason, 'ZERO_LANDLORD_OPEX_REQUIRES_EXPLICIT_TENANT_BORNE_STRUCTURE');
const netWithLandlordOpex = calculateIndustrialLogisticsIncomeIndication({ ...common, spec: netLease, landlordOperatingExpenses: 60000 });
assert.strictEqual(netWithLandlordOpex.status, ADAPTER_STATUS.READY);
assert.strictEqual(netWithLandlordOpex.valuation.components.netOperatingIncome, 540000);

const missingNla = createIndustrialLogisticsAssetSpec({
  assetId: 'SYNTHETIC-WH-002',
  subtype: INDUSTRIAL_SUBTYPE.WAREHOUSE,
  landAreaSqm: 5000,
  builtAreaSqm: 3200,
  netLeasableAreaSqm: null,
  leaseStructure: LEASE_STRUCTURE.TENANT_BORNE_OPEX,
  internalInspectionStatus: INTERNAL_INSPECTION_STATUS.EXTERNAL_ONLY,
  buildingPermitStatus: BUILDING_PERMIT_STATUS.MISSING,
});
const missingProfile = profileIndustrialLogisticsAsset(missingNla);
assert.ok(missingProfile.warnings.includes('NET_LEASABLE_AREA_MISSING'));
assert.ok(missingProfile.warnings.includes('BUILDING_PERMIT_MISSING'));
assert.ok(missingProfile.warnings.includes('INTERNAL_CONDITION_NOT_FULLY_INSPECTED'));
const missingNlaResult = calculateIndustrialLogisticsIncomeIndication({ ...common, spec: missingNla, landlordOperatingExpenses: 0 });
assert.strictEqual(missingNlaResult.status, ADAPTER_STATUS.HOLD_ASSET_DATA);
assert.strictEqual(missingNlaResult.reason, 'NET_LEASABLE_AREA_REQUIRED');

const unknownLease = createIndustrialLogisticsAssetSpec({ ...spec, assetId: 'SYNTHETIC-WH-003', leaseStructure: LEASE_STRUCTURE.UNKNOWN });
const unknownLeaseResult = calculateIndustrialLogisticsIncomeIndication({ ...common, spec: unknownLease, landlordOperatingExpenses: 0 });
assert.strictEqual(unknownLeaseResult.status, ADAPTER_STATUS.HOLD_ASSET_DATA);
assert.strictEqual(unknownLeaseResult.reason, 'LEASE_STRUCTURE_REQUIRED');

const weakEvidence = [
  evidence('titleDeed', EVIDENCE_GRADE.H_CLIENT_SUPPLIED_UNVERIFIED, INPUT_STATUS.UNVERIFIED),
  evidence('netLeasableAreaSqm', EVIDENCE_GRADE.G_EXPERT_ASSUMPTION, INPUT_STATUS.ASSUMED),
  evidence('annualIncome', EVIDENCE_GRADE.G_EXPERT_ASSUMPTION, INPUT_STATUS.ASSUMED),
  evidence('operatingExpenses', EVIDENCE_GRADE.G_EXPERT_ASSUMPTION, INPUT_STATUS.ASSUMED),
  evidence('capitalizationRate', EVIDENCE_GRADE.E_MARKET_OBSERVATION, INPUT_STATUS.OBSERVED),
];
const weakResult = calculateIndustrialLogisticsIncomeIndication({ ...common, spec, landlordOperatingExpenses: 0, qualityEvidence: weakEvidence });
assert.strictEqual(weakResult.status, ADAPTER_STATUS.HOLD_EVIDENCE_QUALITY);
assert.strictEqual(weakResult.valuation, null);

console.log('INDUSTRIAL_LOGISTICS_ADAPTER_V1=PASS');
console.log('OPERATIONAL_SPEC_GAPS_VISIBLE=PASS');
console.log('LEASE_STRUCTURE_FAIL_CLOSED=PASS');
console.log('NET_LEASE_DOES_NOT_IMPLY_ZERO_OPEX=PASS');
console.log('EVIDENCE_QUALITY_REQUIRED_BEFORE_INCOME_VALUE=PASS');
