import { chromium, request } from 'playwright';
import fs from 'fs';

const BASE_URL = process.env.BASE_URL || 'https://startak-real-estate.pages.dev';
const EXPECTED_DEPLOYED_SHA = process.env.EXPECTED_DEPLOYED_SHA || null;
const EVIDENCE_DIR = 'runtime-evidence/production-compliance';
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

const SHORT_AR = 'تحليل داعم للقرار — غير مرخص كاستشارة أو تقييم معتمد.';
const FULL_AR = 'أداة دعم قرار وتحليل معلوماتي وليست استشارة عقارية مرخصة أو تقييماً عقارياً معتمداً أو رأياً قانونياً أو توصية استثمارية ملزمة. تعتمد النتائج على البيانات والافتراضات المتاحة، ويجب التحقق منها ومراجعة المسائل التي تتطلب ترخيصاً أو رأياً مهنياً لدى المختص المرخص قبل اتخاذ القرار أو إتمام أي تصرف.';
const SHORT_EN = 'Decision-support analysis — not licensed as consultancy or certified valuation.';
const FULL_EN = 'Decision-support and information-analysis tool only. It is not licensed real-estate consultancy, a certified appraisal, a legal opinion, or binding investment advice. Results depend on available data and assumptions and must be independently verified; matters requiring professional licensing or legal interpretation must be reviewed by the appropriate licensed professional before any final decision or transaction.';
const LEGACY_IMPERATIVE_RE = /يوصى بالشراء|لا يوصى بالشراء|\bRecommended to Buy\b|\bNot Recommended\b/i;

const report = {
  schemaVersion: 1,
  suite: 'STARTAK_PRODUCTION_COMPLIANCE_BOUNDARY_V1',
  baseUrl: BASE_URL,
  expectedDeployedSha: EXPECTED_DEPLOYED_SHA,
  checks: [],
  startedAt: new Date().toISOString(),
  legalReviewStatus: 'PENDING',
  commercialExternalLaunch: 'HOLD',
  transactionAuthorized: false,
};

let failed = false;
let browser;
let api;
function record(name, passed, detail = null) {
  report.checks.push({ name, status: passed ? 'PASS' : 'FAIL', detail });
  if (!passed) failed = true;
  console.log(`${name}=${passed ? 'PASS' : 'FAIL'}${detail ? ` -- ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
}

try {
  api = await request.newContext({ baseURL: BASE_URL, extraHTTPHeaders: { 'user-agent': 'STARTAK-Production-Compliance-Verify/1.0' } });
  const response = await api.get('/');
  record('COMPLIANCE_PROD_HTTP_200', response.status() === 200, `status=${response.status()}`);

  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ar-SA' });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const pageErrors = [];
  const consoleErrors = [];
  const failedResponses = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('response', (item) => { if (item.status() >= 500) failedResponses.push({ status: item.status(), url: item.url() }); });

  const navigation = await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.locator('#root').waitFor({ state: 'attached' });
  await page.waitForTimeout(500);
  record('COMPLIANCE_PROD_BROWSER_200', navigation?.status() === 200, `status=${navigation?.status()}`);

  const notice = page.getByTestId('compliance-boundary-notice');
  const shortAr = page.getByTestId('compliance-short-notice');
  const fullAr = page.getByTestId('compliance-full-notice');
  record('COMPLIANCE_PROD_NOTICE_PRESENT', (await notice.count()) === 1);
  record('COMPLIANCE_PROD_SHORT_AR_EXACT', (await shortAr.innerText()).trim() === SHORT_AR);
  record('COMPLIANCE_PROD_FULL_AR_EXACT', (await fullAr.textContent()).trim() === FULL_AR);

  const arBody = await page.locator('body').innerText();
  record('COMPLIANCE_PROD_NO_LEGACY_IMPERATIVE_AR', !LEGACY_IMPERATIVE_RE.test(arBody));

  const englishButton = page.getByRole('button', { name: 'EN' }).first();
  record('COMPLIANCE_PROD_EN_SWITCH_PRESENT', (await englishButton.count()) > 0);
  if ((await englishButton.count()) > 0) {
    await englishButton.click();
    await page.waitForTimeout(250);
    const shortEn = page.getByTestId('compliance-short-notice');
    const fullEn = page.getByTestId('compliance-full-notice');
    record('COMPLIANCE_PROD_SHORT_EN_EXACT', (await shortEn.innerText()).trim() === SHORT_EN);
    record('COMPLIANCE_PROD_FULL_EN_EXACT', (await fullEn.textContent()).trim() === FULL_EN);
    const enBody = await page.locator('body').innerText();
    record('COMPLIANCE_PROD_NO_LEGACY_IMPERATIVE_EN', !LEGACY_IMPERATIVE_RE.test(enBody));
  }

  record('COMPLIANCE_PROD_NO_PAGE_ERRORS', pageErrors.length === 0, pageErrors.slice(0, 5));
  record('COMPLIANCE_PROD_NO_CONSOLE_ERRORS', consoleErrors.length === 0, consoleErrors.slice(0, 5));
  record('COMPLIANCE_PROD_NO_HTTP_5XX', failedResponses.length === 0, failedResponses.slice(0, 5));
  await context.close();
} catch (error) {
  failed = true;
  report.fatalError = { name: error.name, message: error.message };
  console.error('PRODUCTION_COMPLIANCE_FATAL', error);
} finally {
  if (browser) await browser.close();
  if (api) await api.dispose();
  report.completedAt = new Date().toISOString();
  report.totalChecks = report.checks.length;
  report.passedChecks = report.checks.filter((item) => item.status === 'PASS').length;
  report.failedChecks = report.checks.filter((item) => item.status === 'FAIL').length;
  report.engineeringResult = failed || report.failedChecks > 0 ? 'FAIL' : 'PASS';
  report.complianceGuard = 'ENGINEERING_ONLY';
  report.legalComplianceEstablished = false;
  report.caveats = [
    'This suite validates visible production engineering boundaries only; it is not legal advice or a legal compliance certification.',
    'Exact-SHA correlation is inherited from the successful Post-Release Production Verify workflow-run chain.',
    'Commercial external launch remains HOLD until documented Saudi legal/regulatory review is completed.',
    'No transaction authorization is performed.',
  ];
  fs.writeFileSync(`${EVIDENCE_DIR}/production-compliance-result.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.engineeringResult === 'PASS' ? 0 : 1);
}
