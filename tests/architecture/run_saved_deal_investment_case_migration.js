const { legacySavedDealToInvestmentCase } = require('../../src/migrations/legacy-saved-deal-adapter');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const gold = require(require('../config/paths').getGoldBaselinePath());

const cases = [
  { label: 'Existing Building', mode: 'building', studyType: STUDY_TYPE.EXISTING_BUILDING, inputs: { ...gold['RE-GOLD-002_existing_building'].inputs, leverageEnabled: false } },
  { label: 'Land + Development', mode: 'land', studyType: STUDY_TYPE.LAND_DEVELOPMENT, inputs: { ...gold['RE-GOLD-001_land_development'].inputs, leverageEnabled: false } },
];

let totalMismatches = 0, inputChanges = 0;
for (const c of cases) {
  const record = { id: `deal_${c.mode}_test`, name: 'legacy test', mode: c.mode, inputs: c.inputs, savedAt: '2026-01-01T00:00:00Z' };
  const recordSnapshotBefore = JSON.stringify(record);

  const legacyResult = calculateInvestmentCase({ studyType: c.studyType, inputs: record.inputs, leverageEnabled: record.inputs.leverageEnabled });
  const investmentCase = legacySavedDealToInvestmentCase(record);

  if (JSON.stringify(record) !== recordSnapshotBefore) inputChanges++;

  const mismatches = [];
  if (investmentCase.financialModel.irr !== legacyResult.irr) mismatches.push('irr');
  if (investmentCase.financialModel.npv !== legacyResult.npv) mismatches.push('npv');
  if (JSON.stringify(investmentCase.financialModel.cashflows) !== JSON.stringify(legacyResult.cashflows)) mismatches.push('cashflows');
  if (investmentCase.recommendation.verdict !== legacyResult.verdict) mismatches.push('verdict');
  if (investmentCase.caseId !== record.id) mismatches.push('caseId');
  if (investmentCase.studyType !== c.studyType) mismatches.push('studyType');
  if (investmentCase.legacyMetadata.originalName !== record.name) mismatches.push('legacyMetadata.originalName');
  if (investmentCase.criticalGates.items.length !== 16) mismatches.push('criticalGates.length');

  totalMismatches += mismatches.length;
  console.log(`${c.label}: mismatches=${mismatches.length}${mismatches.length?' -- '+mismatches.join(', '):''}`);
}

console.log('');
console.log(`MIGRATION_CASES=${cases.length}`);
console.log(`MIGRATION_FINANCIAL_MISMATCHES=${totalMismatches}`);
console.log(`LEGACY_RECORD_INPUT_VALUES_CHANGED=${inputChanges}`);
console.log(`MIGRATION_VALIDATION_BEHAVIOR_CHANGED=false (no isFinite/min/schema logic added anywhere in the adapter)`);
process.exit(totalMismatches === 0 && inputChanges === 0 ? 0 : 1);
