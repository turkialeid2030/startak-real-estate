'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pdf, xlsx, pptx } = require('../../src/document-intelligence/parsers');

const root = path.resolve(__dirname, '../..');
const main = fs.readFileSync(path.join(root, 'src/main.jsx'), 'utf8');
const workspace = fs.readFileSync(path.join(root, 'src/components/LocalDocumentEvidenceWorkspace.jsx'), 'utf8');
const panel = fs.readFileSync(path.join(root, 'src/components/LocalDocumentEvidenceIntakePanel.jsx'), 'utf8');

let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
  console.log(`PASS ${name}`);
}

async function checkAsync(name, fn) {
  await fn();
  checks += 1;
  console.log(`PASS ${name}`);
}

(async () => {
  check('local document intake is mounted through the explicit composed application tree', () => {
    assert(main.includes("import LocalDocumentEvidenceWorkspace from './components/LocalDocumentEvidenceWorkspace.jsx';"));
    assert(main.includes('<LocalDocumentEvidenceWorkspace />'));
    assert(workspace.includes('<LocalDocumentEvidenceIntakePanel onRecordChange={handleIntakeChange} />'));
    assert(workspace.includes('setCandidate(null)'));
    assert(workspace.includes('setVerificationRecord(null)'));
    assert(!main.includes('window.__STARTAK_'));
  });

  check('intake is explicitly local and does not introduce a network client', () => {
    assert(panel.includes('Processing is local in this interface'));
    assert(panel.includes('المعالجة محلية في هذه الواجهة'));
    assert(!panel.includes('fetch('));
    assert(!panel.includes('axios'));
    assert(!panel.includes('XMLHttpRequest'));
    assert(!panel.includes('WebSocket'));
  });

  check('file scope is bounded to xlsx pptx and pdf with a pre-parse size cap', () => {
    assert(panel.includes("const MAX_FILE_BYTES = 40 * 1024 * 1024"));
    assert(panel.includes("const ACCEPTED_EXTENSIONS = ['.xlsx', '.pptx', '.pdf']"));
    assert(panel.includes('if (file.size > MAX_FILE_BYTES)'));
  });

  check('local file identity is content-bound with SHA-256', () => {
    assert(panel.includes("crypto.subtle.digest('SHA-256'"));
    assert(panel.includes('local-sha256:${digest}'));
    assert(panel.includes('LOCAL_INTAKE:${digest.slice(0, 16)}'));
  });

  check('parsed content is visibly separated from verified evidence and financial input', () => {
    assert(panel.includes('المحتوى المستخرج ليس دليلاً موثقًا'));
    assert(panel.includes('Parsed content is not verified evidence'));
    assert(panel.includes('never fed into the financial engine automatically'));
  });

  check('registered parsers preserve bounded capability claims', () => {
    assert.strictEqual(xlsx.ADAPTER_ID, 'XLSX_DETERMINISTIC_V1');
    assert.strictEqual(pptx.ADAPTER_ID, 'PPTX_DETERMINISTIC_V1');
    assert.strictEqual(pdf.ADAPTER_ID, 'PDF_FAIL_CLOSED_V1');
    assert.strictEqual(pdf.supports({ fileName: 'sample.pdf' }), true);
  });

  await checkAsync('PDF remains fail-closed even with a valid PDF header', async () => {
    const bytes = new TextEncoder().encode('%PDF-1.7\n% local fixture');
    const result = await pdf.parse({
      document: { documentId: 'doc-pdf-1', caseId: 'case-local-1', fileName: 'sample.pdf', mimeType: 'application/pdf' },
      content: bytes,
    });
    assert.strictEqual(result.status, 'UNSUPPORTED');
    assert.strictEqual(result.reason, 'PDF_BINARY_PARSER_NOT_YET_VETTED');
    assert.strictEqual(result.atoms.length, 0);
    assert.strictEqual(result.truthSemantics, 'Parser output is not Evidence and is never a financial-engine input by itself.');
  });

  console.log(`LOCAL_DOCUMENT_EVIDENCE_INTAKE_UI_V1=PASS checks=${checks}`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
