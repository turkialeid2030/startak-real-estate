'use strict';

// Triple-path contract after Financial Remediation Wave B2, price-basis
// disclosure #398, P22 exit-cost governance, and P23 lease-horizon governance:
// frozen legacy remains historical evidence, direct Wave-A valuation engines
// remain the raw numerical layer, and the canonical production entrypoint
// intentionally overlays versioned financing plus governed metadata.
const fs = require('fs');
const path = require('path');
const { loadCurrentEngines } = require('../load_engines');
const { calculateInvestmentCase, STUDY_TYPE, PRICE_BASIS_VERSION } = require('../../src/engines');
const { calcExistingBuilding } = require('../../src/engines/valuation/existing-building');
const { calcLandDevelopment } = require('../../src/engines/valuation/land-development');
const { EXIT_TRANSACTION_COST_SOURCE } = require('../../src/engines/valuation/exit-transaction-cost-resolver');
const { LEASE_ROLL_FORWARD_STATUS } = require('../../src/engines/valuation/existing-building-lease-roll-forward-governance');

const FIXTURE_DIR = path.join(__dirname, 'fixtures');
const legacy = loadCurrentEngines();
const direct = { building: calcExistingBuilding, land: calcLandDevelopment };
const legacyCalc = { building: legacy.calcExistingBuilding, land: legacy.calcLandDevelopment };
const studyTypeMap = { building: STUDY_TYPE.EXISTING_BUILDING, land: STUDY_TYPE.LAND_DEVELOPMENT };
const fixtureFiles = ['RE-GOLD-001-U', 'RE-GOLD-001-L', 'RE-GOLD-002-U', 'RE-GOLD-002-L'];
const invariantFields = [
  'financialModelVersion', 'financialModelStatus', 'irr', 'npv', 'cashflows',
  'NOI', 'stabilizedNOI', 'marketValueByIncomeCap', 'marketValueAfterCompletion',
  'terminalSaleValue', 'terminalNetSaleProceeds', 'terminalExitValue', 'totalPurchaseCost', 'totalProjectCost',
];

const CANONICAL_METADATA_FIELDS = [
  'priceBasis',
  'exitTransactionCostSource',
  'exitTransactionCostRate',
  'exitTransactionCostRequiresVisibleDisclosure',
  'statutoryExitTaxpayerDetermined',
  'leaseRollForwardStatus',
  'contractCoversHoldPeriod',
  'leaseSupportedThroughYear',
  'leaseRollForwardModeled',
  'leaseDependentAnalyticsReady',
  'leaseRollForwardRequiresVisibleDisclosure',
];

function withoutCanonicalMetadata(result) {
  const copy = { ...result };
  for (const field of CANONICAL_METADATA_FIELDS) delete copy[field];
  return copy;
}

function validPriceBasis(result, studyType) {
  if (!result || !result.priceBasis || result.priceBasis.version !== PRICE_BASIS_VERSION) return false;
  if (result.priceBasis.solvesAllFinancialHardGates !== false) return false;
  if (studyType === 'building') {
    return result.priceBasis.metric === 'maxJustifiedPrice'
      && JSON.stringify(result.priceBasis.thresholdBasis) === JSON.stringify(['MIN_NET_YIELD_THRESHOLD', 'MAX_PAYBACK_THRESHOLD']);
  }
  return result.priceBasis.metric === 'maxJustifiedLandPricePerSqm'
    && JSON.stringify(result.priceBasis.thresholdBasis) === JSON.stringify(['MAX_PAYBACK_THRESHOLD']);
}

function validLegacyExitCostMetadata(result, fixture) {
  if (fixture.study_type !== 'building') {
    return result.exitTransactionCostSource === undefined
      && result.exitTransactionCostRate === undefined
      && result.exitTransactionCostRequiresVisibleDisclosure === undefined
      && result.statutoryExitTaxpayerDetermined === undefined;
  }
  return result.exitTransactionCostSource === EXIT_TRANSACTION_COST_SOURCE.LEGACY_ACQUISITION_RATE_FALLBACK
    && result.exitTransactionCostRate === fixture.input_set.transferFeeRate
    && result.exitTransactionCostRequiresVisibleDisclosure === true
    && result.statutoryExitTaxpayerDetermined === false;
}

function validLegacyLeaseMetadata(result, fixture) {
  if (fixture.study_type !== 'building') {
    return result.leaseRollForwardStatus === undefined
      && result.contractCoversHoldPeriod === undefined
      && result.leaseSupportedThroughYear === undefined
      && result.leaseRollForwardModeled === undefined
      && result.leaseDependentAnalyticsReady === undefined
      && result.leaseRollForwardRequiresVisibleDisclosure === undefined;
  }
  const coversHold = fixture.input_set.leaseYears >= fixture.input_set.holdPeriod;
  if (coversHold) {
    return result.leaseRollForwardStatus === LEASE_ROLL_FORWARD_STATUS.CONTRACT_COVERS_HOLD
      && result.contractCoversHoldPeriod === true
      && result.leaseSupportedThroughYear === fixture.input_set.holdPeriod
      && result.leaseRollForwardModeled === false
      && result.leaseDependentAnalyticsReady === true
      && result.leaseRollForwardRequiresVisibleDisclosure === false;
  }
  return result.leaseRollForwardStatus === LEASE_ROLL_FORWARD_STATUS.LEGACY_UNMODELED_ROLLOVER
    && result.contractCoversHoldPeriod === false
    && result.leaseSupportedThroughYear === fixture.input_set.leaseYears
    && result.leaseRollForwardModeled === false
    && result.leaseDependentAnalyticsReady === false
    && result.leaseRollForwardRequiresVisibleDisclosure === true;
}

let unexpectedMismatches = 0;
let intentionalFinancingOverlays = 0;
let intentionalPriceBasisOverlays = 0;
let intentionalExitCostMetadataOverlays = 0;
let intentionalLeaseMetadataOverlays = 0;
let legacyVsV2DifferentFixtures = 0;

for (const fid of fixtureFiles) {
  const fixture = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, fid + '.json'), 'utf8'));
  const legacyResult = legacyCalc[fixture.study_type](fixture.input_set);
  const directV2 = direct[fixture.study_type](fixture.input_set);
  const productionV2 = calculateInvestmentCase({
    studyType: studyTypeMap[fixture.study_type],
    inputs: fixture.input_set,
    leverageEnabled: fixture.input_set.leverageEnabled,
  });

  if (validPriceBasis(productionV2, fixture.study_type)) {
    intentionalPriceBasisOverlays += 1;
  } else {
    unexpectedMismatches += 1;
    console.log(`${fid}: price_basis_metadata=INVALID`);
  }

  if (validLegacyExitCostMetadata(productionV2, fixture)) {
    if (fixture.study_type === 'building') intentionalExitCostMetadataOverlays += 1;
  } else {
    unexpectedMismatches += 1;
    console.log(`${fid}: exit_cost_metadata=INVALID`);
  }

  if (validLegacyLeaseMetadata(productionV2, fixture)) {
    if (fixture.study_type === 'building') intentionalLeaseMetadataOverlays += 1;
  } else {
    unexpectedMismatches += 1;
    console.log(`${fid}: lease_roll_forward_metadata=INVALID`);
  }

  const isFinancingOverlayCase = fixture.input_set.leverageEnabled === true;
  if (isFinancingOverlayCase) {
    intentionalFinancingOverlays += 1;
    const expectedFinancingVersion = fixture.study_type === 'building'
      ? 'MONTHLY_DSCR_WAVE_B_1.0'
      : 'CONSTRUCTION_MONTHLY_DSCR_WAVE_B_2.0';
    if (productionV2.financingEngineVersion !== expectedFinancingVersion) unexpectedMismatches += 1;
    if (directV2.financingEngineVersion !== undefined) unexpectedMismatches += 1;
    for (const field of invariantFields) {
      if (!(field in directV2) && !(field in productionV2)) continue;
      if (JSON.stringify(directV2[field]) !== JSON.stringify(productionV2[field])) {
        unexpectedMismatches += 1;
        console.log(`${fid}: unexpected non-financing divergence field=${field}`);
      }
    }
    console.log(`${fid}: production financing overlay=EXPECTED version=${productionV2.financingEngineVersion} constraint=${productionV2.loanSizingConstraint}; canonical_metadata=EXPECTED`);
  } else if (JSON.stringify(directV2) !== JSON.stringify(withoutCanonicalMetadata(productionV2))) {
    unexpectedMismatches += 1;
    console.log(`${fid}: production_vs_direct=UNEXPECTED_DIFF`);
  } else {
    console.log(`${fid}: production_vs_direct=MATCH_AFTER_CANONICAL_METADATA; canonical_metadata=EXPECTED`);
  }

  if (JSON.stringify(legacyResult) !== JSON.stringify(directV2)) legacyVsV2DifferentFixtures += 1;
  const versionOk = fixture.study_type === 'building'
    ? /^BUILDING_WAVE_A_/.test(productionV2.financialModelVersion)
    : /^LAND_WAVE_A_/.test(productionV2.financialModelVersion);
  if (!versionOk) unexpectedMismatches += 1;
}

console.log(`\nTRIPLE_PATH_UNEXPECTED_MISMATCHES=${unexpectedMismatches}`);
console.log(`INTENTIONAL_FINANCING_OVERLAYS=${intentionalFinancingOverlays}`);
console.log(`INTENTIONAL_PRICE_BASIS_OVERLAYS=${intentionalPriceBasisOverlays}`);
console.log(`INTENTIONAL_EXIT_COST_METADATA_OVERLAYS=${intentionalExitCostMetadataOverlays}`);
console.log(`INTENTIONAL_LEASE_METADATA_OVERLAYS=${intentionalLeaseMetadataOverlays}`);
console.log(`LEGACY_VS_V2_DIFFERENT_FIXTURES=${legacyVsV2DifferentFixtures}`);
process.exit(
  unexpectedMismatches === 0
  && intentionalFinancingOverlays >= 2
  && intentionalPriceBasisOverlays === fixtureFiles.length
  && intentionalExitCostMetadataOverlays === 2
  && intentionalLeaseMetadataOverlays === 2
  && legacyVsV2DifferentFixtures > 0
    ? 0
    : 1,
);
