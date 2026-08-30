// tests/verify_package.js -- npm run verify:package
// Proves the package is fully self-contained: builds, runs every regression
// test, and confirms zero external /mnt/user-data dependency.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
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
const ok = (total - passed === 0) && externalFiles === 0;
console.log(ok ? 'VERIFY_PACKAGE=PASS' : 'VERIFY_PACKAGE=FAIL');
process.exit(ok ? 0 : 1);
