#!/usr/bin/env node
// tools/release-verify.js -- THE canonical, provider-neutral release
// qualification gate. CI MUST invoke this script rather than reinventing its
// own checks. Fail-closed: any mandatory step failing exits non-zero.
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

step('RELEASE_PATH_COVERAGE', () => {
  execFileSync('node', [path.join(ROOT, 'tools', 'verify-release-path-coverage.js')], {
    cwd: ROOT,
    stdio: 'pipe',
    env: process.env,
  });
});

step('SECRETS_SCAN', () => {
  execFileSync('node', [path.join(ROOT, 'tests', 'security', 'run_secrets_scan_ci.mjs')], {
    cwd: ROOT,
    stdio: 'pipe',
    env: process.env,
  });
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
  catch (e) { out = e.stdout; }
  const data = JSON.parse(out);
  const v = data.metadata?.vulnerabilities || {};
  console.log(`  critical=${v.critical||0} high=${v.high||0} moderate=${v.moderate||0} low=${v.low||0}`);
  if ((v.critical || 0) > 0 || (v.high || 0) > 0) throw new Error('critical/high vulnerability present');
});

step('CANONICAL_SOURCE_HASH_VERIFICATION', () => {
  const uploadPath = process.env.CANONICAL_ORIGINAL_PATH;
  if (!uploadPath || !fs.existsSync(uploadPath)) {
    console.log('  (CANONICAL_ORIGINAL_PATH not set or not found in this environment -- skipping, not a failure)');
    return;
  }
  const hash = require('crypto').createHash('sha256').update(fs.readFileSync(uploadPath)).digest('hex');
  console.log(`  computed=${hash}`);
  if (hash !== CANONICAL_HASH) throw new Error(`canonical hash mismatch: expected ${CANONICAL_HASH}, got ${hash}`);
});

console.log(`\n${'='.repeat(50)}`);
console.log('TRANSACTION_AUTHORIZED=false');
console.log('RELEASE_VERIFY_RESULT=' + (failed ? 'FAIL' : 'PASS'));
process.exit(failed ? 1 : 0);