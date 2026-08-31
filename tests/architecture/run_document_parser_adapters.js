'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const {
  ingestDocument,
  TRUTH_STATUS,
  PARSER_FORMAT,
  PARSER_STATUS,
  parseDocument,
  mapParsedAtomToEvidenceFact,
} = require('../../src/document-intelligence');
const { readZipEntries } = require('../../src/document-intelligence/parsers/zip-reader');

function zipFixture(entries, compressionMethod = 8) {
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const [name, value] of Object.entries(entries)) {
    const nameBytes = Buffer.from(name, 'utf8');
    const raw = Buffer.from(value, 'utf8');
    const compressed = compressionMethod === 8 ? zlib.deflateRawSync(raw) : raw;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(compressionMethod, 8);
    local.writeUInt32LE(0, 10);
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBytes, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(compressionMethod, 10);
    central.writeUInt32LE(0, 12);
    central.writeUInt32LE(0, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBytes);

    offset += local.length + nameBytes.length + compressed.length;
  }

  const centralBytes = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(Object.keys(entries).length, 8);
  eocd.writeUInt16LE(Object.keys(entries).length, 10);
  eocd.writeUInt32LE(centralBytes.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);
  return new Uint8Array(Buffer.concat([...locals, centralBytes, eocd]));
}

function xlsxFixture() {
  return zipFixture({
    '[Content_Types].xml': '<Types/>',
    'xl/workbook.xml': '<workbook xmlns:r="r"><sheets><sheet name="Input" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/sharedStrings.xml': '<sst><si><t>حي الوادي</t></si></sst>',
    'xl/worksheets/sheet1.xml': '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1"><v>140000000</v></c><c r="C1"><f>B1*2</f><v>280000000</v></c></row></sheetData></worksheet>',
  }, 8);
}

function pptxFixture() {
  return zipFixture({
    '[Content_Types].xml': '<Types/>',
    'ppt/presentation.xml': '<p:presentation xmlns:p="p"/>',
    'ppt/slides/slide1.xml': '<p:sld xmlns:p="p" xmlns:a="a"><a:t>فرصة</a:t><a:t>استثمارية</a:t></p:sld>',
  }, 8);
}

async function documentFor({ documentId, caseId = 'CASE-PARSER-001', fileName, mimeType, content }) {
  return ingestDocument({ documentId, caseId, fileName, mimeType, content, receivedAt: '2026-08-31T07:30:00Z' });
}

async function main() {
  let checks = 0;
  const check = (condition, message) => { assert.ok(condition, message); checks++; };

  const xlsxBytes = xlsxFixture();
  const xlsxDoc = await documentFor({
    documentId: 'DOC-XLSX-001',
    fileName: 'underwriting-model.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    content: xlsxBytes,
  });
  const xlsxResult = await parseDocument({ document: xlsxDoc, content: xlsxBytes });
  check(xlsxResult.status === PARSER_STATUS.PARSED, `XLSX expected PARSED, got ${xlsxResult.status}:${xlsxResult.reason}`);
  check(xlsxResult.format === PARSER_FORMAT.XLSX, 'XLSX format mismatch');
  check(xlsxResult.atoms.length === 3, `XLSX atom count expected 3, got ${xlsxResult.atoms.length}`);
  check(Object.isFrozen(xlsxResult) && Object.isFrozen(xlsxResult.atoms[0]), 'Parser result/atoms must be immutable');

  const a1 = xlsxResult.atoms.find((a) => a.location.cell === 'A1');
  const b1 = xlsxResult.atoms.find((a) => a.location.cell === 'B1');
  const c1 = xlsxResult.atoms.find((a) => a.location.cell === 'C1');
  check(a1 && a1.rawValue === 'حي الوادي' && a1.location.sheet === 'Input', 'XLSX shared string/sheet name parse failed');
  check(b1 && b1.rawValue === 140000000 && b1.valueType === 'NUMBER', 'XLSX numeric cell parse failed');
  check(c1 && c1.metadata.formula === 'B1*2', 'XLSX formula metadata missing');
  check(xlsxResult.warnings.includes('XLSX_FORMULAS_NOT_RECALCULATED_CACHED_VALUES_ONLY'), 'XLSX formula warning missing');
  check(a1.truthSemantics === 'PARSED_CONTENT_ONLY_NOT_EVIDENCE', 'Parser atom was overclaimed as evidence');

  const purchasePriceFact = mapParsedAtomToEvidenceFact({
    atom: b1,
    document: xlsxDoc,
    factId: 'FACT-PURCHASE-PRICE-001',
    semanticKey: 'financial.purchase_price',
    valueType: 'NUMBER',
    unit: 'SAR',
    capturedAt: '2026-08-31T07:31:00Z',
  });
  check(purchasePriceFact.truthStatus === TRUTH_STATUS.EXTRACTED_EVIDENCE, 'Mapped atom must become EXTRACTED_EVIDENCE only');
  check(purchasePriceFact.normalizedValue === 140000000, 'Mapped numeric evidence value mismatch');
  check(purchasePriceFact.sourceLocator.cell === 'B1' && purchasePriceFact.sourceLocator.sheet === 'Input', 'Evidence source locator lost XLSX cell traceability');

  assert.throws(() => mapParsedAtomToEvidenceFact({ atom: b1, document: xlsxDoc, factId: 'FACT-BAD' }), /semanticKey is required/);
  checks++;

  const otherCaseDoc = await documentFor({
    documentId: 'DOC-XLSX-OTHER', caseId: 'CASE-OTHER', fileName: 'other.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', content: xlsxBytes,
  });
  assert.throws(() => mapParsedAtomToEvidenceFact({
    atom: b1, document: otherCaseDoc, factId: 'FACT-CROSS-CASE', semanticKey: 'financial.purchase_price', valueType: 'NUMBER',
  }), /CASE_OR_DOCUMENT_ISOLATION_VIOLATION/);
  checks++;

  const pptxBytes = pptxFixture();
  const pptxDoc = await documentFor({
    documentId: 'DOC-PPTX-001',
    fileName: 'investment-presentation.pptx',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    content: pptxBytes,
  });
  const pptxResult = await parseDocument({ document: pptxDoc, content: pptxBytes });
  check(pptxResult.status === PARSER_STATUS.PARSED, `PPTX expected PARSED, got ${pptxResult.status}:${pptxResult.reason}`);
  check(pptxResult.format === PARSER_FORMAT.PPTX, 'PPTX format mismatch');
  check(pptxResult.atoms.length === 1 && pptxResult.atoms[0].rawValue === 'فرصة استثمارية', 'PPTX slide text extraction failed');
  check(pptxResult.atoms[0].location.slide === 1, 'PPTX slide locator missing');
  check(pptxResult.warnings.some((w) => w.includes('TEXT_ONLY')), 'PPTX scope warning missing');

  const pdfBytes = new TextEncoder().encode('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n');
  const pdfDoc = await documentFor({ documentId: 'DOC-PDF-001', fileName: 'valuation.pdf', mimeType: 'application/pdf', content: pdfBytes });
  const pdfResult = await parseDocument({ document: pdfDoc, content: pdfBytes });
  check(pdfResult.status === PARSER_STATUS.UNSUPPORTED, 'Qualified PDF parser must remain fail-closed at this wave');
  check(pdfResult.reason === 'PDF_BINARY_PARSER_NOT_YET_VETTED', 'PDF fail-closed reason mismatch');

  const invalidPdf = new TextEncoder().encode('not-a-pdf');
  const invalidPdfDoc = await documentFor({ documentId: 'DOC-PDF-002', fileName: 'bad.pdf', mimeType: 'application/pdf', content: invalidPdf });
  const invalidPdfResult = await parseDocument({ document: invalidPdfDoc, content: invalidPdf });
  check(invalidPdfResult.status === PARSER_STATUS.REJECTED && invalidPdfResult.reason === 'INVALID_PDF_HEADER', 'Invalid PDF was not rejected');

  const ambiguousDoc = await documentFor({ documentId: 'DOC-AMB-001', fileName: 'conflict.xlsx', mimeType: 'application/pdf', content: xlsxBytes });
  const ambiguous = await parseDocument({ document: ambiguousDoc, content: xlsxBytes });
  check(ambiguous.status === PARSER_STATUS.REJECTED && String(ambiguous.reason).startsWith('AMBIGUOUS_FORMAT_METADATA'), 'Ambiguous metadata did not fail closed');

  const unknownBytes = new TextEncoder().encode('plain');
  const unknownDoc = await documentFor({ documentId: 'DOC-UNKNOWN-001', fileName: 'plain.bin', mimeType: 'application/octet-stream', content: unknownBytes });
  const unknown = await parseDocument({ document: unknownDoc, content: unknownBytes });
  check(unknown.status === PARSER_STATUS.UNSUPPORTED && unknown.format === PARSER_FORMAT.UNKNOWN, 'Unknown format must be unsupported');

  const unsafeZip = zipFixture({ '../evil.txt': 'bad' }, 0);
  await assert.rejects(() => readZipEntries(unsafeZip), /ZIP_UNSAFE_PATH/);
  checks++;

  const limitedXlsx = await parseDocument({ document: xlsxDoc, content: xlsxBytes, options: { maxAtoms: 2 } });
  check(limitedXlsx.status === PARSER_STATUS.REJECTED && limitedXlsx.reason === 'XLSX_ATOM_LIMIT_EXCEEDED', 'XLSX max atom bound did not fail closed');

  const parserRoot = path.join(__dirname, '..', '..', 'src', 'document-intelligence', 'parsers');
  for (const file of fs.readdirSync(parserRoot).filter((f) => f.endsWith('.js'))) {
    const source = fs.readFileSync(path.join(parserRoot, file), 'utf8');
    check(!source.includes('calculateInvestmentCase') && !source.includes("require('../../engines"), `Parser file ${file} must not call financial engine directly`);
  }

  console.log(`DOCUMENT_PARSER_ADAPTER_CHECKS=${checks}`);
  console.log(`XLSX_ATOMS=${xlsxResult.atoms.length}`);
  console.log(`PPTX_ATOMS=${pptxResult.atoms.length}`);
  console.log(`PDF_STATUS=${pdfResult.status}`);
  console.log('DOCUMENT_PARSER_ADAPTER_RESULT=PASS');
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
