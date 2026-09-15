'use strict';

// P1-07 boundary: these are SAMPLE/DEMO economic datasets, not New Deal data.
// Legacy hydration aliases intentionally preserve historical saved-deal fallback
// behavior while App wiring is migrated away from sample-prefilled New Deals.
const DEMO_BUILDING_INPUTS = Object.freeze({
  projectTitle: 'مبنى مكتبي قائم — طريق أبو بكر الصديق، حي الندى، الرياض',
  landLength: 100, landWidth: 53.26, buildingAge: 1,
  basementCount: 2, basementAreaEach: 7800, parkingAreaPerSpot: 60,
  floorCount: 3, floorAreaEach: 3060, efficiencyRatio: 0.85, netLeasableOverride: 7800,
  serviceElevators: 6,
  buildingPrice: 140000000, commissionRate: 0.025, transferFeeRate: 0.05, inspectionCost: 75000, valuationCost: 60000,
  rentPerSqm: 1800, occupancyRate: 1.0, leaseStatus: 'مؤجر', leaseYears: 5, vatRate: 0.15, serviceIncomeRate: 0.12,
  maintenanceRate: 0.05, insuranceRate: 0.005,
  managementFeeRate: 0, fixedOpexPerSqm: 0, replacementReservePerSqm: 0, opexGrowthRate: 0,
  exitCapRate: 0.07,
  marketCapRate: 0.07, discountRate: 0.08, holdPeriod: 5, rentGrowthRate: 0,
  basementConstructionCostPerSqm: 3000, floorConstructionCostPerSqm: 2000, currentLandPricePerSqm: 15000, buildingUsefulLife: 30,
  minYieldThreshold: 0.09, maxPaybackThreshold: 10,
  leverageEnabled: false, ltv: 0.5, loanRate: 0.06, loanTenor: 10, financingStructureLabel: 'مرابحة',
  minDscrThreshold: 1.25, equityRiskSpread: 0.02,
  titleDeedVerified: false, complianceCertified: false, rentFreezeChecked: false,
});

const DEMO_LAND_INPUTS = Object.freeze({
  projectTitle: 'أرض للتطوير — الدائري الشرقي، حي الوادي',
  landLength: 30, landWidth: 60, landPricePerSqm: 20000,
  buildableRatio: 0.6, buildingTypeLabel: 'برج مكتبي', officeFloorCount: 7, servicesRatioPerFloor: 0.15, basementFloorCount: 2,
  constructionCostPerSqm: 5500,
  landCommissionRate: 0.025, landTransferFeeRate: 0.05, engineeringCost: 200000, landValuationCost: 60000,
  marketRentPerSqm: 1800, occupancyRate: 1.0, serviceIncomeRate: 0.12, opexRate: 0.05, leaseUpMonths: 0,
  marketCapRate: 0.08,
  constructionPeriod: 2, rentGrowthRate: 0.03, operatingPeriod: 10, exitCapRate: 0.085, hurdleRate: 0.12,
  exitTransferFeeRate: 0.05,
  maxPaybackThreshold: 9,
  leverageEnabled: false, ltv: 0.6, loanRate: 0.065, loanTenor: 8, financingStructureLabel: 'مرابحة',
  minDscrThreshold: 1.25, equityRiskSpread: 0.02,
  titleDeedVerified: false, zoningConfirmed: false, buildingPermitStatus: 'لم يُستخرج', soilStudyDone: false, utilitiesConfirmed: false,
});

// Historical records were hydrated against the former App defaults. Keep that
// compatibility contract explicit instead of silently treating demo data as
// fresh-deal defaults.
const LEGACY_BUILDING_HYDRATION_DEFAULTS = DEMO_BUILDING_INPUTS;
const LEGACY_LAND_HYDRATION_DEFAULTS = DEMO_LAND_INPUTS;

module.exports = {
  DEMO_BUILDING_INPUTS,
  DEMO_LAND_INPUTS,
  LEGACY_BUILDING_HYDRATION_DEFAULTS,
  LEGACY_LAND_HYDRATION_DEFAULTS,
};
