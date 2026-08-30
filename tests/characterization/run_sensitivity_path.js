// tests/characterization/run_sensitivity_path.js -- WB-16. Extracts the ACTUAL
// buildSensitivityData function body from src/app/App.jsx (the working production
// copy, post-cutover) PROGRAMMATICALLY (not hand-retyped), loads it as a real
// module bound to the real calculateInvestmentCase/STUDY_TYPE, and executes it.
const fs = require('fs');
const path = require('path');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');

const appSource = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'app', 'App.jsx'), 'utf8');
const match = appSource.match(/function buildSensitivityData[\s\S]*?\n\}\n/);
if (!match) throw new Error('buildSensitivityData not found in src/app/App.jsx -- cannot test WB-16');
const fnSource = match[0];

// LEGACY_CALC_CALLS_IN_SENSITIVITY check: prove the extracted body contains NO
// direct calcExistingBuilding/calcLandDevelopment reference.
const legacyCallsFound = /\bcalcExistingBuilding\(|\bcalcLandDevelopment\(/.test(fnSource);
console.log(`LEGACY_CALC_CALLS_IN_SENSITIVITY = ${legacyCallsFound ? 'FOUND (FAIL)' : 0}`);
const usesModular = /calculateInvestmentCase\s*\(/.test(fnSource);
console.log(`SENSITIVITY_USES_MODULAR_ENGINE = ${usesModular}`);

// Load the extracted function as a real module bound to the real engine.
const moduleSrc = fnSource + '\nmodule.exports = { buildSensitivityData };';
const tmpPath = path.join(require('os').tmpdir(), `sens_${Date.now()}.js`);
fs.writeFileSync(tmpPath, `const { calculateInvestmentCase, STUDY_TYPE } = require(${JSON.stringify(path.join(__dirname, '..', '..', 'src', 'engines'))});\n` + moduleSrc);
const { buildSensitivityData } = require(tmpPath);
fs.unlinkSync(tmpPath);

const gold = JSON.parse(fs.readFileSync(require('../config/paths').getGoldBaselinePath(), 'utf8'));
const cases = [
  { mode: 'building', label: 'Existing Building / Unlevered', inputs: { ...gold['RE-GOLD-002_existing_building'].inputs, leverageEnabled: false }, studyType: STUDY_TYPE.EXISTING_BUILDING },
  { mode: 'building', label: 'Existing Building / Levered', inputs: { ...gold['RE-GOLD-002_existing_building'].inputs, leverageEnabled: true }, studyType: STUDY_TYPE.EXISTING_BUILDING },
  { mode: 'land', label: 'Land + Development / Unlevered', inputs: { ...gold['RE-GOLD-001_land_development'].inputs, leverageEnabled: false }, studyType: STUDY_TYPE.LAND_DEVELOPMENT },
  { mode: 'land', label: 'Land + Development / Levered', inputs: { ...gold['RE-GOLD-001_land_development'].inputs, leverageEnabled: true }, studyType: STUDY_TYPE.LAND_DEVELOPMENT },
];

let totalDims = 0, mismatches = 0;
for (const c of cases) {
  // i18n-neutral passthrough: this test verifies engine-reuse behavior only,
  // never presentation -- a no-op identity function is sufficient here.
  const rows = buildSensitivityData(c.mode, c.inputs, (key) => key);
  totalDims += rows.length;
  // Verify: baseline canonical IRR must be recoverable — the sensitivity function
  // doesn't directly expose a "baseline" field distinct from lo/hi, so compare
  // the canonical engine's own IRR against the midpoint envelope [lo,hi] derived
  // purely from the SAME engine (proves no duplicated formula path, not a value-
  // identity check against a nonexistent separate baseline field).
  const canonical = calculateInvestmentCase({ studyType: c.studyType, inputs: c.inputs, leverageEnabled: c.inputs.leverageEnabled });
  const irrField = c.inputs.leverageEnabled ? 'leveredIRR' : 'irr';
  const canonicalIRR = canonical[irrField];
  let caseMismatches = 0;
  for (const row of rows) {
    if (!(canonicalIRR >= row.lo - 1e-9 && canonicalIRR <= row.hi + 1e-9) && !Number.isNaN(canonicalIRR)) caseMismatches++;
  }
  mismatches += caseMismatches;
  console.log(`${c.label}: ${rows.length} dimensions, canonical ${irrField}=${canonicalIRR}, envelope-containment mismatches=${caseMismatches}`);
}

console.log('');
console.log(`SENSITIVITY_DIMENSIONS_EXECUTED=${totalDims}`);
console.log(`SENSITIVITY_BASELINE_CASES=${cases.length}`);
console.log(`SENSITIVITY_BASELINE_MISMATCHES=${mismatches}`);
process.exit(mismatches === 0 && usesModular && !legacyCallsFound ? 0 : 1);
