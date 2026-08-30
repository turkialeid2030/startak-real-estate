const { calculateInvestmentCase, STUDY_TYPE } = require('../src/engines');
const fs = require('fs');
for (const [fid, studyType, lev] of [['RE-GOLD-001-U', STUDY_TYPE.LAND_DEVELOPMENT, false], ['RE-GOLD-001-L', STUDY_TYPE.LAND_DEVELOPMENT, true]]) {
  const fixture = JSON.parse(fs.readFileSync(`tests/characterization/fixtures/${fid}.json`));
  const actual = calculateInvestmentCase({ studyType, inputs: fixture.input_set, leverageEnabled: lev });
  console.log(`=== ${fid} ===`);
  for (const key of Object.keys(fixture.expected_outputs)) {
    const exp = fixture.expected_outputs[key], act = actual[key];
    if (Array.isArray(exp)) {
      if (exp.some((v,i) => v !== act[i])) console.log(`  ${key}: array differs (e.g. last: ${exp[exp.length-1]} -> ${act[act.length-1]})`);
    } else if (exp !== act) {
      console.log(`  ${key}: ${exp} -> ${act} (diff=${(act-exp).toFixed(2)}, ${(((act-exp)/exp)*100).toFixed(3)}%)`);
    }
  }
}
