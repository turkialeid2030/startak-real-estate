#!/usr/bin/env node
'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const EVIDENCE_DIR = path.join(ROOT, 'runtime-evidence', 'deep-platform');
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

const steps = [];
let failed = false;
function run(name, command, args, env = {}) {
  const startedAt = new Date().toISOString();
  try {
    execFileSync(command, args, { cwd: ROOT, stdio: 'inherit', env: { ...process.env, ...env } });
    steps.push({ name, status: 'PASS', startedAt, completedAt: new Date().toISOString() });
  } catch (error) {
    failed = true;
    steps.push({ name, status: 'FAIL', error: error.message, startedAt, completedAt: new Date().toISOString() });
  }
}

run('canonical_release_verify', 'npm', ['run', 'release:verify']);

for (const seed of ['17', '101', '2026', '9001', '20260901']) {
  run(`financial_metamorphic_seed_${seed}`, 'node', ['tests/architecture/run_financial_metamorphic_stress_v1.js'], { TEST_SEED: seed });
}

run('content_neutrality_reality', 'node', ['tests/architecture/run_content_neutrality_reality_v1.js']);
run('lifecycle_fail_closed_stress', 'node', ['tests/architecture/run_lifecycle_fail_closed_stress_v1.js']);
run('real_browser_core_e2e', 'node', ['tests/e2e/run_runtime_e2e_ci.mjs']);
run('real_browser_full_ui_e2e', 'node', ['tests/e2e/run_full_e2e_ci.mjs']);
run('strict_comprehensive_qualification', 'node', ['tools/comprehensive-verify.js']);

const summary = {
  schemaVersion: 1,
  suite: 'DEEP_PLATFORM_QUALITY_VERIFICATION_V1',
  dimensions: [
    'full-regression', 'randomized-financial-stress', 'metamorphic-accuracy', 'determinism',
    'boundary-variation', 'content-neutrality', 'realism', 'fail-closed-governance',
    'scope-isolation', 'pilot-safety', 'real-browser-ui', 'responsive-runtime', 'package-integrity',
  ],
  totalSteps: steps.length,
  passedSteps: steps.filter((x) => x.status === 'PASS').length,
  failedSteps: steps.filter((x) => x.status === 'FAIL').length,
  result: failed ? 'FAIL' : 'PASS',
  caveats: [
    'Synthetic and quasi-real automated tests validate software behavior, not external market truth.',
    'Accuracy against real property facts still requires authoritative evidence for each study.',
    'Security contract tests are not independent penetration testing or production security certification.',
    'Neutrality tests guard output behavior and language; they do not prove absence of every possible model bias.',
  ],
  steps,
};
fs.writeFileSync(path.join(EVIDENCE_DIR, 'deep-platform-verification-summary.json'), JSON.stringify(summary, null, 2));
console.log(`DEEP_PLATFORM_QUALITY_VERIFICATION_V1=${summary.result} passed=${summary.passedSteps}/${summary.totalSteps}`);
process.exit(failed ? 1 : 0);
