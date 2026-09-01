'use strict';

// Financial Model v2 intentionally diverges from the frozen legacy source.
// This test no longer demands byte/value equivalence between a known-defective
// baseline and the remediated canonical engine. Instead it proves both paths
// remain independently executable and that the specific corrected defects are
// observable as intentional divergences.
const { loadCurrentEngines } = require('../load_engines');
const { calcExistingBuilding } = require('../../src/engines/valuation/existing-building');
const { calcLandDevelopment } = require('../../src/engines/valuation/land-development');
const gold = require('../reference/RE-GOLD-baseline.json');

const legacy = loadCurrentEngines();
const checks = [];
function check(id, cond, detail) { checks.push(cond); console.log(`${id}: ${cond ? 'PASS' : 'FAIL'} -- ${detail}`); }

check('LEGACY-BUILDING-CALLABLE', typeof legacy.calcExistingBuilding === 'function', 'frozen legacy building engine available');
check('LEGACY-LAND-CALLABLE', typeof legacy.calcLandDevelopment === 'function', 'frozen legacy land engine available');

const B = { ...gold['RE-GOLD-002_existing_building'].inputs, leverageEnabled: false };
const legacyBuilding = legacy.calcExistingBuilding(B);
const v2Building = calcExistingBuilding(B);
check('BUILDING-V2-VERSIONED', /^BUILDING_WAVE_A_/.test(v2Building.financialModelVersion), v2Building.financialModelVersion);
check('BUILDING-BOTH-PATHS-FINITE-BASELINE', Number.isFinite(legacyBuilding.NOI) && Number.isFinite(v2Building.NOI),
  `legacyNOI=${legacyBuilding.NOI} v2NOI=${v2Building.NOI}`);

const vacantB = { ...B, leaseStatus: 'سنة' };
const legacyVacant = legacy.calcExistingBuilding(vacantB);
const v2Vacant = calcExistingBuilding(vacantB);
check('VACANCY-DIVERGENCE-EXPECTED', legacyVacant.marketValueByIncomeCap === 0 && v2Vacant.marketValueByIncomeCap > 0,
  `legacy=${legacyVacant.marketValueByIncomeCap} v2=${v2Vacant.marketValueByIncomeCap}`);
check('VACANCY-STABILIZED-NOI-PRESERVED', v2Vacant.NOI === v2Building.NOI && v2Vacant.firstYearNOI < v2Building.firstYearNOI,
  'temporary lease-up changes year 1 but not stabilized NOI');

const highDiscount = { ...B, discountRate: 0.30 };
const legacyHighDiscount = legacy.calcExistingBuilding(highDiscount);
const v2HighDiscount = calcExistingBuilding(highDiscount);
check('NPV-HARD-GATE-DIVERGENCE', v2HighDiscount.npv < 0 && v2HighDiscount.verdict === 'لا يوصى بالشراء' && v2HighDiscount.decisionStatus === 'HARD_GATE_FAILED',
  `legacy=${legacyHighDiscount.verdict} v2=${v2HighDiscount.verdict}`);

const L = { ...gold['RE-GOLD-001_land_development'].inputs, leverageEnabled: false };
const legacyLand = legacy.calcLandDevelopment(L);
const v2Land = calcLandDevelopment(L);
check('LAND-V2-VERSIONED', /^LAND_WAVE_A_/.test(v2Land.financialModelVersion), v2Land.financialModelVersion);
check('LAND-BOTH-PATHS-FINITE-BASELINE', Number.isFinite(legacyLand.stabilizedNOI) && Number.isFinite(v2Land.stabilizedNOI),
  `legacyNOI=${legacyLand.stabilizedNOI} v2NOI=${v2Land.stabilizedNOI}`);

const zeroRent = { ...L, marketRentPerSqm: 0 };
const legacyZeroRent = legacy.calcLandDevelopment(zeroRent);
const v2ZeroRent = calcLandDevelopment(zeroRent);
check('ZERO-NOI-PAYBACK-DIVERGENCE',
  legacyZeroRent.simplePaybackYears === 0 && legacyZeroRent.c1 === true &&
  v2ZeroRent.cumulativeProjectPaybackYears === null && Number.isNaN(v2ZeroRent.simplePaybackYears) && v2ZeroRent.c1 === false,
  `legacyPayback=${legacyZeroRent.simplePaybackYears} v2Nullable=${v2ZeroRent.cumulativeProjectPaybackYears} v2LegacyDisplay=${v2ZeroRent.simplePaybackYears}`);
check('DUPLICATE-CRITERION-REMOVED', v2Land.criteriaDetail.some((c) => c.code === 'NPV_NON_NEGATIVE') && new Set(v2Land.criteriaDetail.map((c) => c.code)).size === v2Land.criteriaDetail.length,
  'v2 uses independently named criteria including NPV hard gate');

const allPass = checks.every(Boolean);
console.log(`\nDUAL_PATH_LEGACY_V2_DIVERGENCE_EVIDENCE=${allPass ? 'PASS' : 'FAIL'}`);
process.exit(allPass ? 0 : 1);
