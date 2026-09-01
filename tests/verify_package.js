// tests/verify_package.js -- npm run verify:package
// Proves the package is fully self-contained: builds, runs every regression
// test, confirms zero external /mnt/user-data dependency, and verifies the
// source-bound release manifest emitted into the built artifact.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const pkg = require('../package.json');
const glob = (dir, ext) => fs.readdirSync(dir).filter((f) => f.endsWith(ext)).map((f) => path.join(dir, f));

console.log('=== STEP 1: build ===');
execSync('npm run build', { stdio: 'inherit' });

console.log('');
console.log('=== STEP 2: full regression ===');
const testDirs = ['tests/characterization', 'tests/architecture', 'tests/defects', 'tests/runtime'];
let total = 0, passed = 0;
const failures = [];
for (const dir of testDirs) {
  if (!fs.existsSync(dir)) continue;
  for (const f of glob(dir, '.js')) {
    if (!f.includes('run_') && !dir.includes('defects') && !dir.includes('runtime')) continue;
    total++;
    try { execSync(`node ${f}`, { stdio: 'pipe' }); passed++; }
    catch (e) { failures.push(f); }
  }
}
console.log(`REGRESSION_TOTAL=${total} PASSED=${passed} FAILED=${total - passed}`);
if (failures.length) console.log('FAILED_FILES:', failures.join(', '));

console.log('');
console.log('=== STEP 3: external dependency check ===');
let externalFiles = 0;
const scanDirs = ['src', 'tests', 'tools'];
function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) scan(full);
    else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) {
      const content = fs.readFileSync(full, 'utf8');
      if (/\/mnt\/user-data/.test(content.replace(/\/\/.*$/gm, ''))) { externalFiles++; console.log('  EXTERNAL_REF:', full); }
    }
  }
}
for (const d of scanDirs) if (fs.existsSync(d)) scan(d);
console.log(`HARD_CODED_UPLOAD_PATHS=${externalFiles}`);

console.log('');
console.log('=== STEP 4: release manifest traceability ===');
let manifestOk = true;
const manifestPath = path.join('dist', 'release-manifest.json');
if (!fs.existsSync(manifestPath)) {
  manifestOk = false;
  console.log('RELEASE_MANIFEST_PRESENT=false');
} else {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const expectedCommit = /^[0-9a-f]{40}$/i.test(String(process.env.STARTAK_SOURCE_COMMIT || process.env.CF_PAGES_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || ''))
    ? String(process.env.STARTAK_SOURCE_COMMIT || process.env.CF_PAGES_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA).toLowerCase()
    : null;
  manifestOk = manifest.schemaVersion === 1
    && manifest.appVersion === pkg.version
    && typeof manifest.buildId === 'string'
    && manifest.buildId.length > 0
    && manifest.deploymentVerified === false
    && manifest.productionDeploymentAuthorized === false
    && manifest.evidenceBoundary === 'BUILD_TRACE_ONLY_NOT_DEPLOYMENT_PROOF'
    && (expectedCommit === null || (manifest.sourceCommit === expectedCommit && manifest.sourceCommitBound === true));
  console.log(`RELEASE_MANIFEST_PRESENT=true`);
  console.log(`RELEASE_MANIFEST_BUILD_ID=${manifest.buildId}`);
  console.log(`RELEASE_MANIFEST_SOURCE_BOUND=${manifest.sourceCommitBound}`);
  console.log(`RELEASE_MANIFEST_ENV=${manifest.buildEnvironment}`);
  console.log(`RELEASE_MANIFEST_VALID=${manifestOk}`);
}

console.log('');
const ok = (total - passed === 0) && externalFiles === 0 && manifestOk;
console.log(ok ? 'VERIFY_PACKAGE=PASS' : 'VERIFY_PACKAGE=FAIL');
process.exit(ok ? 0 : 1);
