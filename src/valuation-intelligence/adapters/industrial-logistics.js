'use strict';

const {
  BASIS_OF_VALUE,
  EXPENSE_TREATMENT,
  QUALITY_STATUS,
  assessEvidenceQuality,
  calculateDirectCapitalization,
} = require('..');

const INDUSTRIAL_SUBTYPE = Object.freeze({
  WAREHOUSE: 'WAREHOUSE',
  DISTRIBUTION_CENTER: 'DISTRIBUTION_CENTER',
  COLD_STORAGE: 'COLD_STORAGE',
  LIGHT_INDUSTRIAL: 'LIGHT_INDUSTRIAL',
  FACTORY: 'FACTORY',
  WORKSHOP: 'WORKSHOP',
  YARD: 'YARD',
  OTHER: 'OTHER',
});

const LEASE_STRUCTURE = Object.freeze({
  GROSS: 'GROSS',
  NET: 'NET',
  TRIPLE_NET: 'TRIPLE_NET',
  TENANT_BORNE_OPEX: 'TENANT_BORNE_OPEX',
  UNKNOWN: 'UNKNOWN',
});

const INTERNAL_INSPECTION_STATUS = Object.freeze({
  FULL_INTERNAL: 'FULL_INTERNAL',
  LIMITED_INTERNAL: 'LIMITED_INTERNAL',
  EXTERNAL_ONLY: 'EXTERNAL_ONLY',
  NOT_INSPECTED: 'NOT_INSPECTED',
});

const BUILDING_PERMIT_STATUS = Object.freeze({
  VERIFIED: 'VERIFIED',
  PROVIDED_UNVERIFIED: 'PROVIDED_UNVERIFIED',
  MISSING: 'MISSING',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
});

const ADAPTER_STATUS = Object.freeze({
  READY: 'READY',
  HOLD_ASSET_DATA: 'HOLD_ASSET_DATA',
  HOLD_EVIDENCE_QUALITY: 'HOLD_EVIDENCE_QUALITY',
});

const OPERATIONAL_SPEC_FIELDS = Object.freeze([
  'clearHeightMeters',
  'dockDoorCount',
  'gradeLevelDoorCount',
  'yardAreaSqm',
  'truckAccess',
  'powerCapacityKva',
  'fireLifeSafetyStatus',
  'constructionType',
  'physicalCondition',
]);

function positive(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new TypeError(`${field} must be > 0`);
  return value;
}

function optionalNonNegative(value, field) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new TypeError(`${field} must be >= 0 or null`);
  return value;
}

function optionalBoolean(value, field) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'boolean') throw new TypeError(`${field} must be boolean or null`);
  return value;
}

function optionalString(value, field) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string or null`);
  return value.trim();
}

function createIndustrialLogisticsAssetSpec({
  assetId,
  subtype,
  customSubtype = null,
  landAreaSqm,
  builtAreaSqm,
  netLeasableAreaSqm,
  leaseStructure = LEASE_STRUCTURE.UNKNOWN,
  internalInspectionStatus,
  buildingPermitStatus,
  clearHeightMeters = null,
  dockDoorCount = null,
  gradeLevelDoorCount = null,
  yardAreaSqm = null,
  truckAccess = null,
  powerCapacityKva = null,
  fireLifeSafetyStatus = null,
  constructionType = null,
  physicalCondition = null,
  singleTenant = null,
  metadata = {},
}) {
  if (typeof assetId !== 'string' || assetId.trim() === '') throw new TypeError('assetId is required');
  if (!Object.values(INDUSTRIAL_SUBTYPE).includes(subtype)) throw new TypeError(`invalid subtype: ${subtype}`);
  if (subtype === INDUSTRIAL_SUBTYPE.OTHER) optionalString(customSubtype, 'customSubtype') || (() => { throw new TypeError('customSubtype is required for OTHER'); })();
  positive(landAreaSqm, 'landAreaSqm');
  optionalNonNegative(builtAreaSqm, 'builtAreaSqm');
  optionalNonNegative(netLeasableAreaSqm, 'netLeasableAreaSqm');
  if (builtAreaSqm !== null && builtAreaSqm !== undefined && netLeasableAreaSqm !== null && netLeasableAreaSqm !== undefined && netLeasableAreaSqm > builtAreaSqm) {
    throw new RangeError('netLeasableAreaSqm cannot exceed builtAreaSqm');
  }
  if (!Object.values(LEASE_STRUCTURE).includes(leaseStructure)) throw new TypeError(`invalid leaseStructure: ${leaseStructure}`);
  if (!Object.values(INTERNAL_INSPECTION_STATUS).includes(internalInspectionStatus)) throw new TypeError(`invalid internalInspectionStatus: ${internalInspectionStatus}`);
  if (!Object.values(BUILDING_PERMIT_STATUS).includes(buildingPermitStatus)) throw new TypeError(`invalid buildingPermitStatus: ${buildingPermitStatus}`);
  optionalNonNegative(clearHeightMeters, 'clearHeightMeters');
  optionalNonNegative(dockDoorCount, 'dockDoorCount');
  optionalNonNegative(gradeLevelDoorCount, 'gradeLevelDoorCount');
  optionalNonNegative(yardAreaSqm, 'yardAreaSqm');
  optionalBoolean(truckAccess, 'truckAccess');
  optionalNonNegative(powerCapacityKva, 'powerCapacityKva');
  optionalString(fireLifeSafetyStatus, 'fireLifeSafetyStatus');
  optionalString(constructionType, 'constructionType');
  optionalString(physicalCondition, 'physicalCondition');
  optionalBoolean(singleTenant, 'singleTenant');
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) throw new TypeError('metadata must be an object');

  return Object.freeze({
    schemaVersion: 1,
    assetId: assetId.trim(),
    subtype,
    customSubtype: customSubtype ? String(customSubtype).trim() : null,
    landAreaSqm,
    builtAreaSqm: builtAreaSqm ?? null,
    netLeasableAreaSqm: netLeasableAreaSqm ?? null,
    leaseStructure,
    internalInspectionStatus,
    buildingPermitStatus,
    clearHeightMeters: clearHeightMeters ?? null,
    dockDoorCount: dockDoorCount ?? null,
    gradeLevelDoorCount: gradeLevelDoorCount ?? null,
    yardAreaSqm: yardAreaSqm ?? null,
    truckAccess: truckAccess ?? null,
    powerCapacityKva: powerCapacityKva ?? null,
    fireLifeSafetyStatus: fireLifeSafetyStatus ?? null,
    constructionType: constructionType ?? null,
    physicalCondition: physicalCondition ?? null,
    singleTenant: singleTenant ?? null,
    metadata: { ...metadata },
  });
}

function profileIndustrialLogisticsAsset(spec) {
  if (!spec || typeof spec !== 'object') throw new TypeError('spec is required');
  const missingOperationalSpecs = OPERATIONAL_SPEC_FIELDS.filter((field) => spec[field] === null || spec[field] === undefined);
  const warnings = [];
  if (spec.buildingPermitStatus === BUILDING_PERMIT_STATUS.MISSING) warnings.push('BUILDING_PERMIT_MISSING');
  if (spec.buildingPermitStatus === BUILDING_PERMIT_STATUS.PROVIDED_UNVERIFIED) warnings.push('BUILDING_PERMIT_UNVERIFIED');
  if ([INTERNAL_INSPECTION_STATUS.EXTERNAL_ONLY, INTERNAL_INSPECTION_STATUS.NOT_INSPECTED].includes(spec.internalInspectionStatus)) warnings.push('INTERNAL_CONDITION_NOT_FULLY_INSPECTED');
  if (spec.leaseStructure === LEASE_STRUCTURE.UNKNOWN) warnings.push('LEASE_STRUCTURE_UNKNOWN');
  if (spec.netLeasableAreaSqm === null || spec.netLeasableAreaSqm === undefined || spec.netLeasableAreaSqm <= 0) warnings.push('NET_LEASABLE_AREA_MISSING');

  return Object.freeze({
    coverageRatio: spec.builtAreaSqm === null ? null : spec.builtAreaSqm / spec.landAreaSqm,
    leasableEfficiency: spec.builtAreaSqm && spec.netLeasableAreaSqm !== null ? spec.netLeasableAreaSqm / spec.builtAreaSqm : null,
    missingOperationalSpecs,
    warnings,
    operationalSpecCompleteness: (OPERATIONAL_SPEC_FIELDS.length - missingOperationalSpecs.length) / OPERATIONAL_SPEC_FIELDS.length,
    semantics: 'Operational specification completeness is descriptive and must not be treated as a valuation confidence probability.',
  });
}

function deriveAnnualRentPerSqm({ annualRent, netLeasableAreaSqm }) {
  positive(annualRent, 'annualRent');
  positive(netLeasableAreaSqm, 'netLeasableAreaSqm');
  return annualRent / netLeasableAreaSqm;
}

function calculateIndustrialLogisticsIncomeIndication({
  spec,
  annualIncome,
  landlordOperatingExpenses,
  capitalizationRate,
  incomeEvidence,
  expenseEvidence,
  capRateEvidence,
  qualityEvidence,
  qualityPolicy,
  criticalRequirements = [],
  basis = BASIS_OF_VALUE.MARKET_VALUE,
  valuationDate = null,
  currency = 'SAR',
}) {
  const assetProfile = profileIndustrialLogisticsAsset(spec);
  if (!spec.netLeasableAreaSqm || spec.netLeasableAreaSqm <= 0) {
    return Object.freeze({ status: ADAPTER_STATUS.HOLD_ASSET_DATA, valuation: null, assetProfile, reason: 'NET_LEASABLE_AREA_REQUIRED' });
  }

  const quality = assessEvidenceQuality({ evidence: qualityEvidence, policy: qualityPolicy, criticalRequirements });
  if (quality.status !== QUALITY_STATUS.QUALIFIED) {
    return Object.freeze({ status: ADAPTER_STATUS.HOLD_EVIDENCE_QUALITY, valuation: null, assetProfile, quality });
  }

  let expenseTreatment;
  if ([LEASE_STRUCTURE.NET, LEASE_STRUCTURE.TRIPLE_NET, LEASE_STRUCTURE.TENANT_BORNE_OPEX].includes(spec.leaseStructure)) {
    expenseTreatment = landlordOperatingExpenses === 0 ? EXPENSE_TREATMENT.TENANT_BORNE_CONFIRMED : EXPENSE_TREATMENT.ACTUAL_LANDLORD_OPEX;
  } else if (spec.leaseStructure === LEASE_STRUCTURE.GROSS) {
    expenseTreatment = EXPENSE_TREATMENT.ACTUAL_LANDLORD_OPEX;
  } else {
    return Object.freeze({ status: ADAPTER_STATUS.HOLD_ASSET_DATA, valuation: null, assetProfile, quality, reason: 'LEASE_STRUCTURE_REQUIRED' });
  }

  const valuation = calculateDirectCapitalization({
    effectiveGrossIncome: annualIncome,
    operatingExpenses: landlordOperatingExpenses,
    capitalizationRate,
    expenseTreatment,
    incomeEvidence,
    expenseEvidence,
    capRateEvidence,
    basis,
    valuationDate,
    currency,
  });

  return Object.freeze({
    status: ADAPTER_STATUS.READY,
    assetProfile,
    quality,
    annualRentPerLeasableSqm: deriveAnnualRentPerSqm({ annualRent: annualIncome, netLeasableAreaSqm: spec.netLeasableAreaSqm }),
    valuation,
    semantics: 'Industrial/logistics adapter normalizes asset-specific evidence before using the generic income indication engine.',
  });
}

module.exports = {
  INDUSTRIAL_SUBTYPE,
  LEASE_STRUCTURE,
  INTERNAL_INSPECTION_STATUS,
  BUILDING_PERMIT_STATUS,
  ADAPTER_STATUS,
  OPERATIONAL_SPEC_FIELDS,
  createIndustrialLogisticsAssetSpec,
  profileIndustrialLogisticsAsset,
  deriveAnnualRentPerSqm,
  calculateIndustrialLogisticsIncomeIndication,
};
