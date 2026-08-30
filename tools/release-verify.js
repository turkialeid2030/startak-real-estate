#!/usr/bin/env node
// tools/release-verify.js -- THE canonical, provider-neutral release
// qualification gate. CI (whichever provider is eventually authorized)
// MUST invoke this script rather than reinventing its own checks.
// Fail-closed: any mandatory step failing exits non-zero immediately.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CANONICAL_HASH = 'ac0767d3f13c463259f401a5d7af06c1140ee780a9f86489eb17ad9d7c72dc71';
let failed = false;

function step(name, fn) {
  process.stdout.write(`\n=== ${name} ===\n`);
  try {
    fn();
    console.log(`${name}: PASS`);
  } catch (e) {
    console.log(`${name}: FAIL -- ${e.message}`);
    failed = true;
  }
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
      catch (e) { console.log(`  FAILING TEST: tests/${dir}/${f}`); }
    }
  }
  for (const dir of allJsDirs) {
    const full = path.join(ROOT, 'tests', dir);
    if (!fs.existsSync(full)) continue;
    for (const f of fs.readdirSync(full)) {
      if (!f.endsWith('.js')) continue;
      total++;
      try { execFileSync('node', [path.join(full, f)], { stdio: 'pipe' }); passed++; }
      catch (e) { console.log(`  FAILING TEST: tests/${dir}/${f}`); }
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
  // Path to the canonical original is environment-specific (not part of the
  // repository itself) -- read from an env var so this script contains zero
  // machine/environment-specific absolute paths and works unmodified in any
  // CI environment where that variable is set appropriately.
  const uploadPath = process.env.CANONICAL_ORIGINAL_PATH;
  if (!uploadPath || !fs.existsSync(uploadPath)) { console.log('  (CANONICAL_ORIGINAL_PATH not set or not found in this environment -- skipping, not a failure)'); return; }
  const hash = require('crypto').createHash('sha256').update(fs.readFileSync(uploadPath)).digest('hex');
  console.log(`  computed=${hash}`);
  if (hash !== CANONICAL_HASH) throw new Error(`canonical hash mismatch: expected ${CANONICAL_HASH}, got ${hash}`);
});

console.log(`\n${'='.repeat(50)}`);
console.log('RELEASE_VERIFY_RESULT=' + (failed ? 'FAIL' : 'PASS'));
process.exit(failed ? 1 : 0);
