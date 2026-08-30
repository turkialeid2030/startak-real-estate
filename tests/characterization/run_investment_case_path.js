// tests/characterization/run_investment_case_path.js -- Section 22: for all 4
// Golden cases, calculate → construct ExecutableInvestmentCase → verify financial
// results against raw modular engine. No value loss, no reinterpretation.
const fs = require('fs');
const path = require('path');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const { createExecutableInvestmentCase } = require('../../src/contracts/executable-investment-case');

const FIXTURE_DIR = path.join(__dirname, 'fixtures');
const studyTypeMap = { land: STUDY_TYPE.LAND_DEVELOPMENT, building: STUDY_TYPE.EXISTING_BUILDING };
const fixtureFiles = ['RE-GOLD-001-U', 'RE-GOLD-001-L', 'RE-GOLD-002-U', 'RE-GOLD-002-L'];

let totalMismatches = 0;
for (const fid of fixtureFiles) {
  const fixture = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, fid + '.json'), 'utf8'));
  const raw = calculateInvestmentCase({ studyType: studyTypeMap[fixture.study_type], inputs: fixture.input_set, leverageEnabled: fixture.input_set.leverageEnabled });
  const investmentCase = createExecutableInvestmentCase({ caseId: fid, studyType: studyTypeMap[fixture.study_type], inputs: fixture.input_set, engineResult: raw, verdict: raw.verdict });

  const mismatches = [];
  // financialModel: cashflows/irr/npv must be value-identical to raw.
  if (JSON.stringify(investmentCase.financialModel.cashflows) !== JSON.stringify(raw.cashflows)) mismatches.push('financialModel.cashflows');
  if (investmentCase.financialModel.irr !== raw.irr) mismatches.push('financialModel.irr');
  if (investmentCase.financialModel.npv !== raw.npv) mismatches.push('financialModel.npv');
  // recommendation: verdict/metCount/totalCriteria must match RE-GOLD exactly.
  if (investmentCase.recommendation.verdict !== fixture.expected_recommendation) mismatches.push('recommendation.verdict');
  if (investmentCase.recommendation.metCount !== fixture.expected_outputs.metCount) mismatches.push('recommendation.metCount');
  if (investmentCase.recommendation.totalCriteria !== fixture.expected_outputs.totalCriteria) mismatches.push('recommendation.totalCriteria');
  // versions: must be present and NOT affect the above (already proven by the fact none of the above changed).
  if (!investmentCase.versions || !investmentCase.versions.source_version) mismatches.push('versions.missing');
  // No value loss: caseId/studyType/inputs must round-trip exactly.
  if (investmentCase.caseId !== fid) mismatches.push('caseId');
  if (investmentCase.studyType !== studyTypeMap[fixture.study_type]) mismatches.push('studyType');
  if (JSON.stringify(investmentCase.inputs) !== JSON.stringify(fixture.input_set)) mismatches.push('inputs (not round-tripped exactly)');

  totalMismatches += mismatches.length;
  console.log(`${fid}: mismatches=${mismatches.length}${mismatches.length ? ' -- ' + mismatches.join(', ') : ''}`);
}
console.log('');
console.log(`INVESTMENT_CASE_GOLD_MISMATCHES=${totalMismatches}`);
process.exit(totalMismatches === 0 ? 0 : 1);
