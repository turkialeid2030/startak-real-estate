'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const { validateEngineInputs } = require('../../src/validation/numeric-safety');
const { classifyFinancingModel } = require('../../src/engines/financial/monthly-debt');

const ROOT = path.join(__dirname, '..', '..');
const fixture = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'characterization', 'fixtures', name + '.json'), 'utf8')).input_set;
const approx = (a, b, tol = 0.02) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`);
function mustReject(inputs, studyType, field) {
  assert.throws(
    () => calculateInvestmentCase({ studyType, inputs, leverageEnabled: Boolean(inputs.leverageEnabled), assumptionModelVersion: 'LEGACY' }),
    (e) => e && e.name === 'ValidationError' && e.field === field,
    `expected ValidationError for ${field}`,
  );
}

const land = fixture('RE-GOLD-001-U');
const landResult = calculateInvestmentCase({ studyType: STUDY_TYPE.LAND_DEVELOPMENT, inputs: land, leverageEnabled: false, assumptionModelVersion: 'LEGACY' });
approx(landResult.totalProjectCost, landResult.totalLandAcquisitionCost + landResult.totalConstructionCost);
approx(landResult.stabilizedNOI, landResult.totalOperatingRevenue - landResult.operatingExpenses);
approx(landResult.marketValueAfterCompletion, landResult.stabilizedNOI / land.marketCapRate);
approx(landResult.terminalNetExitValue, landResult.terminalExitValue * (1 - land.exitTransferFeeRate));
assert.deepStrictEqual(
  landResult.criteriaDetail.map((x) => x.code),
  ['STABILIZED_NOI_POSITIVE', 'CUMULATIVE_PROJECT_PAYBACK', 'NPV_NON_NEGATIVE', 'IRR_MEETS_HURDLE', 'COMPLETION_VALUE_COVERS_COST'],
);
assert.strictEqual(landResult.c2, Number.isFinite(landResult.npv) && landResult.npv >= 0);

mustReject({ ...land, constructionCostPerSqm: -3000 }, STUDY_TYPE.LAND_DEVELOPMENT, 'constructionCostPerSqm');
mustReject({ ...land, landLength: -30 }, STUDY_TYPE.LAND_DEVELOPMENT, 'landLength');
mustReject({ ...land, officeFloorCount: 7.5 }, STUDY_TYPE.LAND_DEVELOPMENT, 'officeFloorCount');
mustReject({ ...land, servicesRatioPerFloor: 1 }, STUDY_TYPE.LAND_DEVELOPMENT, 'servicesRatioPerFloor');

const building = fixture('RE-GOLD-002-U');
const buildingResult = calculateInvestmentCase({ studyType: STUDY_TYPE.EXISTING_BUILDING, inputs: building, leverageEnabled: false, assumptionModelVersion: 'LEGACY' });
approx(buildingResult.totalPurchaseCost, building.buildingPrice + buildingResult.commissionAmount + buildingResult.transferFeeAmount + building.inspectionCost + building.valuationCost);
approx(buildingResult.NOI, buildingResult.totalAnnualIncome - buildingResult.opexAmount);
assert.strictEqual(buildingResult.c1, buildingResult.netYieldOnCost >= building.minYieldThreshold);
assert.strictEqual(buildingResult.c2, buildingResult.cumulativePaybackOnCost !== null && buildingResult.cumulativePaybackOnCost <= building.maxPaybackThreshold);
assert.strictEqual(buildingResult.c6, Number.isFinite(buildingResult.npv) && buildingResult.npv >= 0);
assert.deepStrictEqual(
  buildingResult.criteriaDetail.map((x) => x.code),
  ['STABILIZED_NOI_POSITIVE', 'NET_YIELD_ON_COST', 'CUMULATIVE_PAYBACK', 'IRR_MEETS_HURDLE', 'NPV_NON_NEGATIVE', 'INCOME_VALUE_COVERS_COST'],
);
mustReject({ ...building, floorCount: 3.5 }, STUDY_TYPE.EXISTING_BUILDING, 'floorCount');
mustReject({ ...building, netLeasableOverride: building.floorCount * building.floorAreaEach + 1 }, STUDY_TYPE.EXISTING_BUILDING, 'netLeasableOverride');

assert.strictEqual(classifyFinancingModel('مرابحة').exactContractModel, false);
assert.strictEqual(classifyFinancingModel('إجارة منتهية بالتمليك').exactContractModel, false);

const app = fs.readFileSync(path.join(ROOT, 'src', 'app', 'App.jsx'), 'utf8');
for (const needle of [
  'actual: fmtPct(r.netYieldOnCost)',
  'actual: formatRecommendationYears(r.paybackOnCost)',
  'ok: r.c6, label: t("recommendation.criteria.npvNonNegative")',
  'ok: r.c7, label: t("recommendation.criteria.leveredNpvNonNegative")',
  'ok: r.c2, label: t("recommendation.criteria.npvNonNegative")',
  'ok: r.c6, label: t("recommendation.criteria.leveredNpvNonNegative")',
  'inputBuilding.managementFeeRate',
  'inputBuilding.fixedOpexPerSqm',
  'inputBuilding.replacementReservePerSqm',
  'metricRowR2B2.firstYearNoiBuilding',
  'metricRowR2B2.firstOperatingYearNoi',
  'financingInput.proxyBoundaryNote',
  'recommendation.analyticalSectionHeading',
]) assert.ok(app.includes(needle), `missing UI parity marker: ${needle}`);
assert.ok(!app.includes('onChange(isNaN(parsed) ? 0'), 'blank numeric input must not silently become zero');
assert.ok(!app.includes('AuditMetricRow'), 'all dashboard audit rows must use canonical MetricRow');
assert.ok(!app.includes('locale === \"en\" ? \"Governed by Assumption Model V2.'), 'governed assumption note must be localized through i18n');
const enLocale = require('../../src/i18n/locales/en.js');
const arLocale = require('../../src/i18n/locales/ar-SA.js');
assert.ok(enLocale.globalApp.governedAssumptionV2Note && arLocale.globalApp.governedAssumptionV2Note, 'governed assumption note must exist in both locales');
const metricRowCalls = app.split('\n').filter((line) => line.includes('<MetricRow')).length;
assert.strictEqual(metricRowCalls, 78, 'canonical MetricRow source inventory must include 77 dashboard rows plus sensitivity');

validateEngineInputs({ ...land, leverageEnabled: false }, { studyType: STUDY_TYPE.LAND_DEVELOPMENT });
validateEngineInputs({ ...building, leverageEnabled: false }, { studyType: STUDY_TYPE.EXISTING_BUILDING });
console.log('DECISION_INTEGRITY_WAVE=PASS');
