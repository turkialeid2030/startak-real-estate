#!/usr/bin/env node
// tools/release-verify.js -- THE canonical, provider-neutral release
// qualification gate. CI (whichever provider is eventually authorized)
// MUST invoke this script rather than reinventing its own checks.
// Fail-closed: any mandatory step failing exits non-zero immediately.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const {
  EXPECTED_CANONICAL_SHA256,
  CANONICAL_SOURCE_STATUS,
  evaluateCanonicalSourceEvidence,
} = require('./canonical-source-evidence');
const {
  STATUS: CANONICAL_BASELINE_REGISTRY_GATE_STATUS,
  verifyCanonicalBaselineRegistryFile,
} = require('./canonical-baseline-registry-gate');
const {
  STATUS: COMPOSITE_BASELINE_SHADOW_GATE_STATUS,
  evaluateCompositeBaselineShadowFromEnvironment,
} = require('./composite-baseline-shadow-release-gate');
const {
  STATUS: COMPOSITE_CUTOVER_SAFETY_GATE_STATUS,
  evaluateCompositeBaselineCutoverSafetyFromEnvironment,
} = require('./composite-baseline-cutover-safety-gate');

const ROOT = path.join(__dirname, '..');
let failed = false;

function step(name, fn) {
  process.stdout.write(`\n=== ${name} ===\n`);
  try {
    const outcome = fn();
    const displayStatus = outcome && typeof outcome.stepStatus === 'string'
      ? outcome.stepStatus
      : 'PASS';
    console.log(`${name}: ${displayStatus}`);
  } catch (e) {
    console.log(`${name}: FAIL -- ${e.message}`);
    failed = true;
  }
}

function printFailureDiagnostic(error) {
  const stdout = error && error.stdout ? String(error.stdout) : '';
  const stderr = error && error.stderr ? String(error.stderr) : '';
  const combined = [stdout, stderr].filter(Boolean).join('\n').trim();
  if (!combined) return;
  const max = 3500;
  const text = combined.length > max ? `${combined.slice(0, max)}\n... [diagnostic truncated]` : combined;
  for (const line of text.split(/\r?\n/)) console.log(`    ${line}`);
}

step('TEST_DISCOVERY_AND_REGRESSION', () => {
  // Mirrors the exact glob pattern used throughout this program's manual
  // regression loop: run_*.js for characterization/architecture/i18n/
  // saved-deals, but ALL *.js for defects/ and runtime/ (those two
  // directories contain permanent tests that don't all use the run_ prefix,
  // e.g. tests/defects/engine_rejection_matrix.js).
  const runPrefixDirs = ['characterization', 'architecture', 'i18n', 'saved-deals'];
  const allJsDirs = ['defects', 'runtime'];
  let total = 0, passed = 0;
  for (const dir of runPrefixDirs) {
    const full = path.join(ROOT, 'tests', dir);
    if (!fs.existsSync(full)) continue;
    for (const f of fs.readdirSync(full)) {
      if (!f.endsWith('.js') || !f.startsWith('run_')) continue;
      total++;
      try { execFileSync('node', [path.join(full, f)], { stdio: 'pipe' }); passed++; }
      catch (e) {
        console.log(`  FAILING TEST: tests/${dir}/${f}`);
        printFailureDiagnostic(e);
      }
    }
  }
  for (const dir of allJsDirs) {
    const full = path.join(ROOT, 'tests', dir);
    if (!fs.existsSync(full)) continue;
    for (const f of fs.readdirSync(full)) {
      if (!f.endsWith('.js')) continue;
      total++;
      try { execFileSync('node', [path.join(full, f)], { stdio: 'pipe' }); passed++; }
      catch (e) {
        console.log(`  FAILING TEST: tests/${dir}/${f}`);
        printFailureDiagnostic(e);
      }
    }
  }
  console.log(`  REGRESSION_TOTAL=${total} PASSED=${passed}`);
  if (passed !== total) throw new Error(`${total - passed} test(s) failed`);
});

step('PRODUCTION_BUILD', () => {
  if (fs.existsSync(path.join(ROOT, 'dist'))) fs.rmSync(path.join(ROOT, 'dist'), { recursive: true });
  execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'pipe' });
  if (!fs.existsSync(path.join(ROOT, 'dist', 'assets'))) throw new Error('dist/assets not produced');
});

step('VERIFY_PACKAGE', () => {
  execFileSync('node', [path.join(ROOT, 'tests', 'verify_package.js')], { cwd: ROOT, stdio: 'pipe' });
});

step('NPM_AUDIT_RELEASE_THRESHOLD', () => {
  let out;
  try { out = execFileSync('npm', ['audit', '--json'], { cwd: ROOT, encoding: 'utf8' }); }
  catch (e) { out = e.stdout; } // npm audit exits non-zero when vulnerabilities exist; we parse regardless
  const data = JSON.parse(out);
  const v = data.metadata?.vulnerabilities || {};
  console.log(`  critical=${v.critical||0} high=${v.high||0} moderate=${v.moderate||0} low=${v.low||0}`);
  if ((v.critical || 0) > 0 || (v.high || 0) > 0) throw new Error('critical/high vulnerability present');
});

step('CANONICAL_BASELINE_REGISTRY_VERIFICATION', () => {
  const result = verifyCanonicalBaselineRegistryFile();
  console.log(`  registry_status=${result.status}`);
  if (result.activeMode) console.log(`  active_mode=${result.activeMode}`);
  if (result.registryHashSha256) console.log(`  registry_sha256=${result.registryHashSha256}`);
  if (result.status !== CANONICAL_BASELINE_REGISTRY_GATE_STATUS.VERIFIED || result.verified !== true) {
    const blockers = Array.isArray(result.blockers) && result.blockers.length > 0
      ? ` blockers=${result.blockers.join(',')}`
      : '';
    throw new Error(`${result.reasonCode || 'CANONICAL_BASELINE_REGISTRY_NOT_VERIFIED'}${blockers}`);
  }
  return { stepStatus: 'PASS' };
});

step('COMPOSITE_BASELINE_SHADOW_VERIFICATION', () => {
  const result = evaluateCompositeBaselineShadowFromEnvironment();
  console.log(`  shadow_status=${result.status}`);
  console.log(`  authoritative_mode=${result.authoritativeMode}`);
  console.log(`  shadow_mode=${result.shadowMode}`);
  if (result.shadowEvaluationHashSha256) console.log(`  shadow_evaluation_sha256=${result.shadowEvaluationHashSha256}`);
  if (result.reasonCode) console.log(`  reason_code=${result.reasonCode}`);

  if (result.status === COMPOSITE_BASELINE_SHADOW_GATE_STATUS.HOLD) {
    throw new Error(result.reasonCode || 'COMPOSITE_BASELINE_SHADOW_HOLD');
  }
  if (result.status === COMPOSITE_BASELINE_SHADOW_GATE_STATUS.MISSING_REQUIRED) {
    throw new Error(result.reasonCode || 'COMPOSITE_BASELINE_SHADOW_REQUIRED');
  }
  if (result.status === COMPOSITE_BASELINE_SHADOW_GATE_STATUS.NOT_EVALUATED) {
    return { stepStatus: 'NOT_EVALUATED' };
  }
  if (result.status !== COMPOSITE_BASELINE_SHADOW_GATE_STATUS.VERIFIED || result.verified !== true) {
    throw new Error('COMPOSITE_BASELINE_SHADOW_UNEXPECTED_STATUS');
  }
  return { stepStatus: 'PASS' };
});

step('COMPOSITE_BASELINE_CUTOVER_SAFETY_GUARD', () => {
  // P38 is an optional engineering evidence gate until real reviewer-locked
  // P30/P31/P36/P37 artifacts are supplied. Strict controlled runs can require
  // the complete set with REQUIRE_COMPOSITE_CUTOVER_SAFETY=1.
  const result = evaluateCompositeBaselineCutoverSafetyFromEnvironment();
  console.log(`  cutover_safety_status=${result.status}`);
  console.log(`  authoritative_mode=${result.authoritativeMode}`);
  console.log(`  proposed_mode=${result.proposedMode}`);
  console.log(`  activation_authorization_granted=${result.activationAuthorizationGranted}`);
  if (result.cutoverSafetyGuardHashSha256) console.log(`  cutover_safety_guard_sha256=${result.cutoverSafetyGuardHashSha256}`);
  if (result.reasonCode) console.log(`  reason_code=${result.reasonCode}`);

  if (result.status === COMPOSITE_CUTOVER_SAFETY_GATE_STATUS.HOLD) {
    throw new Error(result.reasonCode || 'COMPOSITE_CUTOVER_SAFETY_HOLD');
  }
  if (result.status === COMPOSITE_CUTOVER_SAFETY_GATE_STATUS.MISSING_REQUIRED) {
    throw new Error(result.reasonCode || 'COMPOSITE_CUTOVER_SAFETY_REQUIRED');
  }
  if (result.status === COMPOSITE_CUTOVER_SAFETY_GATE_STATUS.NOT_EVALUATED) {
    return { stepStatus: 'NOT_EVALUATED' };
  }
  if (result.status !== COMPOSITE_CUTOVER_SAFETY_GATE_STATUS.VERIFIED || result.verified !== true) {
    throw new Error('COMPOSITE_CUTOVER_SAFETY_UNEXPECTED_STATUS');
  }
  return { stepStatus: 'PASS' };
});

step('CANONICAL_SOURCE_HASH_VERIFICATION', () => {
  const result = evaluateCanonicalSourceEvidence({
    filePath: process.env.CANONICAL_ORIGINAL_PATH,
    expectedSha256: EXPECTED_CANONICAL_SHA256,
    requireEvidence: process.env.REQUIRE_CANONICAL_SOURCE_HASH === '1',
  });

  console.log(`  evidence_status=${result.status}`);
  console.log(`  expected=${result.expectedSha256}`);
  if (result.computedSha256) console.log(`  computed=${result.computedSha256}`);

  if (result.status === CANONICAL_SOURCE_STATUS.MISSING_REQUIRED) {
    throw new Error('canonical source evidence is required but CANONICAL_ORIGINAL_PATH is unavailable');
  }
  if (result.status === CANONICAL_SOURCE_STATUS.MISMATCH) {
    throw new Error(`canonical hash mismatch: expected ${result.expectedSha256}, got ${result.computedSha256}`);
  }
  if (result.status === CANONICAL_SOURCE_STATUS.NOT_EVALUATED) {
    console.log('  (external canonical source was not supplied; engineering checks continue, but canonical-source evidence remains open)');
    return { stepStatus: 'NOT_EVALUATED' };
  }

  return { stepStatus: 'PASS' };
});

console.log(`\n${'='.repeat(50)}`);
console.log('RELEASE_VERIFY_RESULT=' + (failed ? 'FAIL' : 'PASS'));
process.exit(failed ? 1 : 0);
