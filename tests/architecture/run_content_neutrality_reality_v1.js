'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { getCustomerFacingVerdictLabel, activateCustomerFacingVerdictPresentation } = require('../../src/app/compliance-verdict-presentation');
const { getVerdictPresentationMode, VERDICT_PRESENTATION_MODE } = require('../../src/i18n/domain-presentation');

const ROOT = path.join(__dirname, '..', '..');
const EVIDENCE_DIR = path.join(ROOT, 'runtime-evidence', 'deep-platform');
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

const results = [];
function check(name, fn) {
  try { fn(); results.push({ name, status: 'PASS' }); }
  catch (error) { results.push({ name, status: 'FAIL', error: error.message }); throw error; }
}

check('production activates decision-support presentation', () => {
  const main = fs.readFileSync(path.join(ROOT, 'src', 'main.jsx'), 'utf8');
  assert(main.includes('activateCustomerFacingVerdictPresentation()'));
  activateCustomerFacingVerdictPresentation();
  assert.strictEqual(getVerdictPresentationMode(), VERDICT_PRESENTATION_MODE.EXTERNAL_DECISION_SUPPORT);
});

check('external verdict labels remain analytical not imperative', () => {
  const legacy = ['يوصى بالشراء', 'يوصى بالشراء بشروط', 'لا يوصى بالشراء'];
  const arT = (key) => ({
    'recommendation.buy': 'يوصى بالشراء',
    'recommendation.conditionalBuy': 'يوصى بالشراء بشروط',
    'recommendation.noBuy': 'لا يوصى بالشراء',
  }[key]);
  for (const raw of legacy) {
    const label = getCustomerFacingVerdictLabel(raw, arT);
    assert(label && typeof label === 'string');
    assert(!legacy.includes(label), `customer-facing label leaked imperative legacy verdict: ${label}`);
    assert(!/(شراء|بيع|اعتماد|رفض)\s*$/u.test(label), `customer-facing label must remain analytical: ${label}`);
  }
});

check('unknown verdict fails closed', () => {
  assert.throws(() => getCustomerFacingVerdictLabel('UNKNOWN_VERDICT', (x) => x), /Unmapped recommendation verdict/);
});

check('production runtime contains no embedded synthetic study payloads', () => {
  const main = fs.readFileSync(path.join(ROOT, 'src', 'main.jsx'), 'utf8');
  for (const marker of ['case-e2e-', 'case-workspace-', 'smoke-c1', 'project-e2e-', 'synthetic-evidence']) {
    assert(!main.includes(marker), `synthetic runtime marker embedded in production main: ${marker}`);
  }
});

check('customer-facing components do not hardcode legacy investment recommendation phrases', () => {
  const componentDir = path.join(ROOT, 'src', 'components');
  const files = fs.readdirSync(componentDir).filter((f) => /\.(jsx|js)$/.test(f));
  const prohibited = ['يوصى بالشراء', 'يوصى بالشراء بشروط', 'لا يوصى بالشراء'];
  for (const file of files) {
    const text = fs.readFileSync(path.join(componentDir, file), 'utf8');
    for (const phrase of prohibited) assert(!text.includes(phrase), `${file} hardcodes legacy recommendation phrase: ${phrase}`);
  }
});

check('AI and decision surfaces retain human authority and no transaction authorization', () => {
  const files = [
    'src/decision-intelligence/ai-expert-orchestrator.js',
    'src/decision-quality/orchestrator.js',
    'src/investment-committee/human-decision-record.js',
    'src/decision-quality/outcome-feedback.js',
    'src/decision-quality/learning-loop.js',
    'src/pilot/controlled-pilot-readiness-v2.js',
    'src/pilot/pilot-execution-evidence-pack.js',
  ];
  for (const rel of files) {
    const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert(/transactionAuthorized\s*:\s*false/.test(text), `${rel} must explicitly keep transaction authorization false`);
  }
});

check('no fake live or official integration claims in source-ingestion contracts', () => {
  const dir = path.join(ROOT, 'src', 'source-ingestion');
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) {
    const text = fs.readFileSync(path.join(dir, file), 'utf8');
    if (/liveConnected/.test(text)) assert(!/liveConnected\s*:\s*true/.test(text), `${file} claims live connection`);
    if (/officialApiUsed/.test(text)) assert(!/officialApiUsed\s*:\s*true/.test(text), `${file} claims official API use`);
  }
});

const summary = {
  schemaVersion: 1,
  dimensions: ['neutrality', 'non-imperative-language', 'fail-closed-content', 'realism', 'no-fake-live-claims', 'human-authority'],
  passed: results.filter((r) => r.status === 'PASS').length,
  failed: results.filter((r) => r.status === 'FAIL').length,
  results,
};
fs.writeFileSync(path.join(EVIDENCE_DIR, 'content-neutrality-reality.json'), JSON.stringify(summary, null, 2));
console.log(`CONTENT_NEUTRALITY_REALITY_V1=PASS checks=${results.length}`);
