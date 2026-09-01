'use strict';

// Verifies calculate -> ExecutableInvestmentCase carries the CURRENT canonical
// engine result without loss. The frozen RE-GOLD fixtures remain input/source
// integrity fixtures; after Financial Model v2 they are no longer normative
// expected-output fixtures for the corrected canonical engine.
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
  const raw = calculateInvestmentCase({
    studyType: studyTypeMap[fixture.study_type],
    inputs: fixture.input_set,
    leverageEnabled: fixture.input_set.leverageEnabled,
  });
  const investmentCase = createExecutableInvestmentCase({
    caseId: fid,
    studyType: studyTypeMap[fixture.study_type],
    inputs: fixture.input_set,
    engineResult: raw,
    verdict: raw.verdict,
  });

  const mismatches = [];
  if (JSON.stringify(investmentCase.financialModel.cashflows) !== JSON.stringify(raw.cashflows)) mismatches.push('financialModel.cashflows');
  if (!Object.is(investmentCase.financialModel.irr, raw.irr)) mismatches.push('financialModel.irr');
  if (investmentCase.financialModel.npv !== raw.npv) mismatches.push('financialModel.npv');
  if (investmentCase.recommendation.verdict !== raw.verdict) mismatches.push('recommendation.verdict');
  if (investmentCase.recommendation.metCount !== raw.metCount) mismatches.push('recommendation.metCount');
  if (investmentCase.recommendation.totalCriteria !== raw.totalCriteria) mismatches.push('recommendation.totalCriteria');
  if (!raw.financialModelVersion || !raw.financialModelStatus) mismatches.push('financialModelVersion/status');
  if (!investmentCase.versions || !investmentCase.versions.source_version) mismatches.push('versions.missing');
  if (investmentCase.caseId !== fid) mismatches.push('caseId');
  if (investmentCase.studyType !== studyTypeMap[fixture.study_type]) mismatches.push('studyType');
  if (JSON.stringify(investmentCase.inputs) !== JSON.stringify(fixture.input_set)) mismatches.push('inputs');

  totalMismatches += mismatches.length;
  console.log(`${fid}: current-canonical propagation mismatches=${mismatches.length}${mismatches.length ? ' -- ' + mismatches.join(', ') : ''}`);
}
console.log(`\nINVESTMENT_CASE_CURRENT_CANONICAL_MISMATCHES=${totalMismatches}`);
process.exit(totalMismatches === 0 ? 0 : 1);
