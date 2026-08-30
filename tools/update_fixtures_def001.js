const { calculateInvestmentCase, STUDY_TYPE } = require('../src/engines');
const fs = require('fs');
const AFFECTED = ['cashflows', 'irr', 'npv', 'leveredCashflows', 'leveredIRR', 'leveredNPV'];

for (const [fid, lev] of [['RE-GOLD-001-U', false], ['RE-GOLD-001-L', true]]) {
  const path = `tests/characterization/fixtures/${fid}.json`;
  const fixture = JSON.parse(fs.readFileSync(path));
  const actual = calculateInvestmentCase({ studyType: STUDY_TYPE.LAND_DEVELOPMENT, inputs: fixture.input_set, leverageEnabled: lev });
  const before = {};
  for (const key of AFFECTED) {
    if (key in fixture.expected_outputs) {
      before[key] = fixture.expected_outputs[key];
      fixture.expected_outputs[key] = actual[key];
    }
  }
  // Keep other convenience fields consistent if present
  if ('expected_cash_flows' in fixture) fixture.expected_cash_flows = lev ? actual.leveredCashflows : actual.cashflows;
  fixture._def001_convention_update = {
    date: new Date().toISOString().slice(0,10),
    reason: "DEF-001 resolved: Land Development standardized on Convention A (Direct Cap) to match Existing Building. Fixture values for the 6 exitValue-derived fields updated to reflect the corrected engine output. See DECISION-DEF-001/ for the decision brief and impact analysis.",
    fields_updated: AFFECTED.filter(k => k in before),
  };
  fs.writeFileSync(path, JSON.stringify(fixture, null, 2));
  console.log(`${fid}: updated ${Object.keys(before).length} fields`);
}
