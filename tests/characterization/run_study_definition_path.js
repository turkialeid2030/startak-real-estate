const fs = require('fs');
const path = require('path');
const { ExistingBuildingStudyDefinition } = require('../../src/modules/studies/existing-building');
const { LandDevelopmentStudyDefinition } = require('../../src/modules/studies/land-development');

const FIXTURE_DIR = path.join(__dirname, 'fixtures');
const defs = { building: ExistingBuildingStudyDefinition, land: LandDevelopmentStudyDefinition };
const fixtureFiles = ['RE-GOLD-001-U', 'RE-GOLD-001-L', 'RE-GOLD-002-U', 'RE-GOLD-002-L'];
let total = 0, mismatches = 0;

for (const fid of fixtureFiles) {
  const fixture = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, fid + '.json'), 'utf8'));
  const result = defs[fixture.study_type].calculate(fixture.input_set);
  const m = [];
  for (const key of Object.keys(fixture.expected_outputs)) {
    total++;
    const ev = fixture.expected_outputs[key], av = result[key];
    if (Array.isArray(ev)) { if (!Array.isArray(av) || ev.length !== av.length || ev.some((v,i)=>v!==av[i])) m.push(key); }
    else if (ev !== av) m.push(key);
  }
  mismatches += m.length;
  console.log(`${fid} (StudyDefinition): mismatches=${m.length}`);
}
console.log(`\nSTUDY_DEFINITION_VS_GOLD_MISMATCHES=${mismatches} (of ${total} fields)`);
process.exit(mismatches === 0 ? 0 : 1);
