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

step('CANONICAL_SOURCE_HASH_VERIFICATION', () => {
  // The canonical original remains external to the repository. Engineering CI
  // may run without it, but absence must never be printed as PASS. Release-
  // authority or external-evidence jobs can set REQUIRE_CANONICAL_SOURCE_HASH=1
  // to make absence fail closed.
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
