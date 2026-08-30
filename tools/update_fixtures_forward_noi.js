const { calculateInvestmentCase, STUDY_TYPE } = require('../src/engines');
const fs = require('fs');
const AFFECTED = ['cashflows', 'irr', 'npv', 'leveredCashflows', 'leveredIRR', 'leveredNPV'];

for (const [fid, lev] of [['RE-GOLD-001-U', false], ['RE-GOLD-001-L', true]]) {
  const path = `tests/characterization/fixtures/${fid}.json`;
  const fixture = JSON.parse(fs.readFileSync(path));
  const actual = calculateInvestmentCase({ studyType: STUDY_TYPE.LAND_DEVELOPMENT, inputs: fixture.input_set, leverageEnabled: lev });
  for (const key of AFFECTED) {
    if (key in fixture.expected_outputs) fixture.expected_outputs[key] = actual[key];
  }
  if ('expected_cash_flows' in fixture) fixture.expected_cash_flows = lev ? actual.leveredCashflows : actual.cashflows;
  fixture._def001_convention_update = {
    date: new Date().toISOString().slice(0,10),
    reason: "DEF-001 FINAL decision: BOTH studies standardized on Convention B (Forward NOI Cap). Land Development fixture values restored to Forward NOI values (reverting the D4 Direct-Cap update). See DECISION-DEF-001/ and the D5/D6 verification+execution trail.",
    fields_updated: AFFECTED.filter(k => k in fixture.expected_outputs),
  };
  fs.writeFileSync(path, JSON.stringify(fixture, null, 2));
  console.log(`${fid}: updated ${AFFECTED.length} fields to Forward NOI convention`);
}
