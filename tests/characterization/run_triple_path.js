'use strict';

// Triple-path contract after Financial Remediation Wave B2, price-basis
// disclosure #398, P22 exit-cost governance, P23 lease-horizon governance,
// and P24 timing disclosure: frozen legacy remains historical evidence, direct
// Wave-A valuation engines remain the raw numerical layer, and the canonical
// production entrypoint intentionally overlays versioned financing plus governed
// descriptive metadata without changing raw valuation arithmetic.
const fs = require('fs');
const path = require('path');
const { loadCurrentEngines } = require('../load_engines');
const { calculateInvestmentCase, STUDY_TYPE, PRICE_BASIS_VERSION, CASHFLOW_TIMING_VERSION } = require('../../src/engines');
const { calcExistingBuilding } = require('../../src/engines/valuation/existing-building');
const { calcLandDevelopment } = require('../../src/engines/valuation/land-development');
const { EXIT_TRANSACTION_COST_SOURCE } = require('../../src/engines/valuation/exit-transaction-cost-resolver');
const { LEASE_ROLL_FORWARD_STATUS } = require('../../src/engines/valuation/existing-building-lease-roll-forward-governance');
const { TIMING_CODE } = require('../../src/engines/financial/timing-conventions');

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
  'cashflowTiming',
  'exitTransactionCostSource',
  'exitTransactionCostRate',
  'exitTransactionCostRequiresVisibleDisclosure',
  'statutoryExitTaxpayerDetermined',
  'leaseRollForwardStatus',
  'contractCoversHoldPeriod',
  'contractCoversForwardTerminalNoi',
  'forwardTerminalNoiYear',
  'contractualCoverageThroughYear',
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

function validTimingMetadata(result, fixture) {
  const timing = result && result.cashflowTiming;
  if (!timing || timing.version !== CASHFLOW_TIMING_VERSION) return false;
  const financed = typeof result.financingEngineVersion === 'string' && result.financingEngineVersion.length > 0;
  const land = fixture.study_type === 'land';
  const common = timing.returnCalculationBasis === TIMING_CODE.PERIODIC
    && timing.npvConvention === TIMING_CODE.PERIODIC_ANNUAL_NPV
    && timing.irrConvention === TIMING_CODE.PERIODIC_ANNUAL_IRR
    && timing.dateAwareReturns === false
    && timing.dayCountBasis === null
    && timing.initialInvestmentTiming === TIMING_CODE.PERIOD_0
    && timing.unleveredOperatingCashflowTiming === TIMING_CODE.ANNUAL_END_OF_PERIOD
    && timing.terminalValueTiming === TIMING_CODE.ANNUAL_END_OF_PERIOD
    && timing.terminalValueNoiBasis === TIMING_CODE.FORWARD_YEAR_N_PLUS_1_STABILIZED_NOI
    && timing.financingModelApplied === financed
    && timing.datedReturnEngineUsed === false
    && timing.xnpvUsed === false
    && timing.xirrUsed === false
    && timing.transactionAuthorized === false
    && timing.disclosure
    && typeof timing.disclosure.ar === 'string'
    && typeof timing.disclosure.en === 'string';
  if (!common) return false;

  if (land && timing.unleveredConstructionCostTiming !== TIMING_CODE.ANNUAL_END_OF_PERIOD) return false;
  if (!land && timing.unleveredConstructionCostTiming !== null) return false;

  if (!financed) {
    return timing.debtCalculationFrequency === null
      && timing.debtFundingTiming === null
      && timing.termDebtPaymentTiming === null
      && timing.annualDebtServiceAggregation === null
      && timing.leveredValuationCashflowTiming === null
      && timing.constructionDebtDrawTiming === null
      && timing.constructionInterestTiming === null;
  }

  if (timing.debtCalculationFrequency !== TIMING_CODE.MONTHLY
      || timing.debtFundingTiming !== TIMING_CODE.PERIOD_0
      || timing.termDebtPaymentTiming !== TIMING_CODE.MONTHLY_END_OF_PERIOD_AFTER_INTEREST_ACCRUAL
      || timing.annualDebtServiceAggregation !== TIMING_CODE.SUM_MONTHLY_PAYMENTS_BY_MODEL_YEAR
      || timing.leveredValuationCashflowTiming !== TIMING_CODE.ANNUAL_END_OF_PERIOD) return false;

  if (land) {
    return timing.constructionDebtDrawTiming === TIMING_CODE.MONTHLY_BEGINNING_OF_PERIOD_BEFORE_INTEREST_ACCRUAL
      && timing.constructionInterestTiming === TIMING_CODE.MONTHLY_AFTER_CONSTRUCTION_DRAW_CAPITALIZED;
  }
  return timing.constructionDebtDrawTiming === null && timing.constructionInterestTiming === null;
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
      && result.contractCoversForwardTerminalNoi === undefined
      && result.forwardTerminalNoiYear === undefined
      && result.contractualCoverageThroughYear === undefined
      && result.leaseSupportedThroughYear === undefined
      && result.leaseRollForwardModeled === undefined
      && result.leaseDependentAnalyticsReady === undefined
      && result.leaseRollForwardRequiresVisibleDisclosure === undefined;
  }

  const leaseYears = fixture.input_set.leaseYears;
  const holdPeriod = fixture.input_set.holdPeriod;
  const coversHold = leaseYears >= holdPeriod;
  const coversForwardNoi = leaseYears >= holdPeriod + 1;
  const common = result.contractCoversHoldPeriod === coversHold
    && result.contractCoversForwardTerminalNoi === coversForwardNoi
    && result.forwardTerminalNoiYear === holdPeriod + 1
    && result.contractualCoverageThroughYear === leaseYears
    && result.leaseSupportedThroughYear === Math.min(leaseYears, holdPeriod)
    && result.leaseRollForwardModeled === false;
  if (!common) return false;

  if (coversForwardNoi) {
    return result.leaseRollForwardStatus === LEASE_ROLL_FORWARD_STATUS.CONTRACT_COVERS_HOLD_AND_FORWARD_NOI
      && result.leaseDependentAnalyticsReady === true
      && result.leaseRollForwardRequiresVisibleDisclosure === false;
  }
  return result.leaseRollForwardStatus === LEASE_ROLL_FORWARD_STATUS.LEGACY_UNMODELED_ROLLOVER
    && result.leaseDependentAnalyticsReady === false
    && result.leaseRollForwardRequiresVisibleDisclosure === true;
}

let unexpectedMismatches = 0;
let intentionalFinancingOverlays = 0;
let intentionalPriceBasisOverlays = 0;
let intentionalTimingMetadataOverlays = 0;
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

  if (validPriceBasis(productionV2, fixture.study_type)) intentionalPriceBasisOverlays += 1;
  else { unexpectedMismatches += 1; console.log(`${fid}: price_basis_metadata=INVALID`); }

  if (validTimingMetadata(productionV2, fixture)) intentionalTimingMetadataOverlays += 1;
  else { unexpectedMismatches += 1; console.log(`${fid}: cashflow_timing_metadata=INVALID`); }

  if (validLegacyExitCostMetadata(productionV2, fixture)) {
    if (fixture.study_type === 'building') intentionalExitCostMetadataOverlays += 1;
  } else { unexpectedMismatches += 1; console.log(`${fid}: exit_cost_metadata=INVALID`); }

  if (validLegacyLeaseMetadata(productionV2, fixture)) {
    if (fixture.study_type === 'building') intentionalLeaseMetadataOverlays += 1;
  } else { unexpectedMismatches += 1; console.log(`${fid}: lease_roll_forward_metadata=INVALID`); }

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
console.log(`INTENTIONAL_TIMING_METADATA_OVERLAYS=${intentionalTimingMetadataOverlays}`);
console.log(`INTENTIONAL_EXIT_COST_METADATA_OVERLAYS=${intentionalExitCostMetadataOverlays}`);
console.log(`INTENTIONAL_LEASE_METADATA_OVERLAYS=${intentionalLeaseMetadataOverlays}`);
console.log(`LEGACY_VS_V2_DIFFERENT_FIXTURES=${legacyVsV2DifferentFixtures}`);
process.exit(
  unexpectedMismatches === 0
  && intentionalFinancingOverlays >= 2
  && intentionalPriceBasisOverlays === fixtureFiles.length
  && intentionalTimingMetadataOverlays === fixtureFiles.length
  && intentionalExitCostMetadataOverlays === 2
  && intentionalLeaseMetadataOverlays === 2
  && legacyVsV2DifferentFixtures > 0
    ? 0
    : 1,
);
