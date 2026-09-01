import { preview } from 'vite';
import { chromium } from 'playwright';
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { findChromiumExecutable } = require('../config/paths');

const EXECUTABLE = findChromiumExecutable();
const EVIDENCE_DIR = 'runtime-evidence/deep-platform';
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
const result = {};
let previewServer = null;
let browser = null;
let failed = false;

function record(id, passed, detail = null) {
  result[id] = passed ? 'PASS' : 'FAIL';
  if (detail !== null) result[`${id}_DETAIL`] = detail;
  if (!passed) failed = true;
  console.log(`${id} ${result[id]}${detail ? ` -- ${detail}` : ''}`);
}

try {
  previewServer = await preview({ preview: { host: '127.0.0.1', port: 4173, strictPort: false } });
  const addr = previewServer.httpServer.address();
  const url = `http://127.0.0.1:${addr.port}/`;
  result.preview_url = url;

  browser = await chromium.launch({ headless: true, executablePath: EXECUTABLE, args: ['--no-sandbox', '--disable-gpu'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  const page = await context.newPage();
  page.setDefaultTimeout(7000);

  const pageErrors = [];
  const consoleErrors = [];
  const requests = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('request', (request) => requests.push(request.url()));

  await page.goto(url, { waitUntil: 'networkidle' });
  const panel = page.getByTestId('local-document-evidence-intake');
  record('DOC-E2E-01-PANEL', await panel.isVisible(), `count=${await panel.count()}`);
  const bodyAr = await panel.innerText();
  record('DOC-E2E-02-LOCAL-PROCESSING-BOUNDARY', bodyAr.includes('المعالجة محلية في هذه الواجهة') && bodyAr.includes('لا تُرسل الملفات إلى جهة خارجية'), 'Arabic local-processing boundary visible before file selection');

  const requestCountBeforeUpload = requests.length;
  const pdfFixture = Buffer.from('%PDF-1.7\n% STARTAK local deterministic fixture\n', 'utf8');
  await page.getByTestId('local-document-file-input').setInputFiles({
    name: 'local-evidence-fixture.pdf',
    mimeType: 'application/pdf',
    buffer: pdfFixture,
  });
  await page.getByTestId('local-document-digest').waitFor({ state: 'visible' });

  const panelAfterPdf = await panel.innerText();
  const digest = (await page.getByTestId('local-document-digest').innerText()).trim();
  const atomCount = (await page.getByTestId('local-document-atom-count').innerText()).trim();
  record('DOC-E2E-03-PDF-FAIL-CLOSED', panelAfterPdf.includes('UNSUPPORTED') && panelAfterPdf.includes('PDF_BINARY_PARSER_NOT_YET_VETTED') && atomCount === '0', `atoms=${atomCount}`);
  record('DOC-E2E-04-CONTENT-DIGEST', /^[a-f0-9]{64}$/i.test(digest), `digestLength=${digest.length}`);
  record('DOC-E2E-04B-EVIDENCE-SEMANTIC-BOUNDARY', panelAfterPdf.includes('المحتوى المستخرج ليس دليلاً موثقًا') && panelAfterPdf.includes('لا يدخل المحرك المالي تلقائيًا'), 'Parsed-content/evidence boundary visible once a parser result exists');

  const newRequests = requests.slice(requestCountBeforeUpload);
  const externalAfterUpload = newRequests.filter((requestUrl) => {
    try { return new URL(requestUrl).origin !== new URL(url).origin; } catch (_) { return true; }
  });
  record('DOC-E2E-05-NO-EXTERNAL-UPLOAD', externalAfterUpload.length === 0, JSON.stringify(externalAfterUpload));

  await page.getByRole('button', { name: 'مسح النتيجة', exact: true }).click();
  await page.getByTestId('local-document-file-input').setInputFiles({
    name: 'not-supported.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not a supported file', 'utf8'),
  });
  const invalidAlert = await panel.getByRole('alert').innerText();
  record('DOC-E2E-06-INVALID-TYPE', invalidAlert.includes('نوع الملف غير مدعوم'), invalidAlert);

  await page.getByTitle('Switch to English').click();
  await page.waitForTimeout(200);
  const htmlDir = await page.locator('html').getAttribute('dir');
  const bodyEn = await panel.innerText();
  record('DOC-E2E-07-BILINGUAL', htmlDir === 'ltr' && bodyEn.includes('Local document intake') && bodyEn.includes('Processing is local'), `dir=${htmlDir}`);

  result.PAGE_ERRORS = pageErrors.length;
  result.CONSOLE_ERRORS = consoleErrors.length;
  record('DOC-E2E-08-NO-PAGE-ERRORS', pageErrors.length === 0, JSON.stringify(pageErrors.slice(0, 3)));
  record('DOC-E2E-09-NO-CONSOLE-ERRORS', consoleErrors.length === 0, JSON.stringify(consoleErrors.slice(0, 3)));
} catch (error) {
  failed = true;
  result.fatal_error = error.message;
  console.error(error);
} finally {
  if (browser) await browser.close();
  if (previewServer) await new Promise((resolve) => previewServer.httpServer.close(resolve));
  result.result = failed ? 'FAIL' : 'PASS';
  fs.writeFileSync(`${EVIDENCE_DIR}/local-document-intake-e2e.json`, JSON.stringify(result, null, 2));
  console.log(`LOCAL_DOCUMENT_INTAKE_E2E=${result.result}`);
  if (failed) process.exitCode = 1;
}
