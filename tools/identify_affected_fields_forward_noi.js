const { calculateInvestmentCase, STUDY_TYPE } = require('../src/engines');
const fs = require('fs');
for (const fid of ['RE-GOLD-001-U', 'RE-GOLD-001-L', 'RE-GOLD-002-U', 'RE-GOLD-002-L']) {
  const fixture = JSON.parse(fs.readFileSync(`tests/characterization/fixtures/${fid}.json`));
  const studyType = fixture.study_type === 'land' ? STUDY_TYPE.LAND_DEVELOPMENT : STUDY_TYPE.EXISTING_BUILDING;
  const lev = fid.endsWith('-L');
  const actual = calculateInvestmentCase({ studyType, inputs: fixture.input_set, leverageEnabled: lev });
  console.log(`=== ${fid} (rentGrowthRate=${fixture.input_set.rentGrowthRate}) ===`);
  const diffs = [];
  for (const key of Object.keys(fixture.expected_outputs)) {
    const exp = fixture.expected_outputs[key], act = actual[key];
    if (Array.isArray(exp)) { if (exp.some((v,i)=>v!==act[i])) diffs.push(key); }
    else if (exp !== act) diffs.push(key);
  }
  console.log('  affected fields:', diffs.length ? diffs.join(', ') : '(none -- growth=0, both conventions identical)');
}
