'use strict';

const assert = require('assert');
const {
  createDocumentRecord,
  createParsedAtom,
  createParserResult,
  DOCUMENT_TYPE,
  AUTHORITY_CLASS,
  PARSER_FORMAT,
  PARSER_STATUS,
  TRUTH_STATUS,
  RECONCILIATION_STATUS,
  mapSemanticEvidence,
  reconcileSemanticEvidence,
} = require('../../src/document-intelligence');

function document({ id, caseId = 'CASE-SEM-001', fileName, mimeType, hashChar }) {
  return createDocumentRecord({
    documentId: id,
    caseId,
    fileName,
    mimeType,
    sizeBytes: 1024,
    contentHashSha256: hashChar.repeat(64),
    documentType: fileName.endsWith('.xlsx') ? DOCUMENT_TYPE.FINANCIAL_MODEL : DOCUMENT_TYPE.PRESENTATION,
    authorityClass: AUTHORITY_CLASS.INTERNAL_MODEL,
    receivedAt: '2026-08-31T08:00:00Z',
  });
}

function cell(document, ref, rawValue, valueType = 'STRING', sheet = 'Study') {
  return createParsedAtom({
    atomId: `${document.documentId}:${sheet}:${ref}`,
    document,
    adapterId: 'XLSX_DETERMINISTIC_V1',
    kind: 'CELL',
    rawValue,
    valueType,
    location: { kind: 'CELL', sheet, cell: ref, packagePath: 'xl/worksheets/sheet1.xml' },
  });
}

function slide(document, number, text) {
  return createParsedAtom({
    atomId: `${document.documentId}:slide:${number}`,
    document,
    adapterId: 'PPTX_DETERMINISTIC_V1',
    kind: 'TEXT',
    rawValue: text,
    valueType: 'STRING',
    location: { kind: 'SLIDE', slide: number, packagePath: `ppt/slides/slide${number}.xml` },
  });
}

function parserResult(document, format, atoms) {
  return createParserResult({ document, adapterId: format === PARSER_FORMAT.XLSX ? 'XLSX_DETERMINISTIC_V1' : 'PPTX_DETERMINISTIC_V1', format, status: PARSER_STATUS.PARSED, atoms });
}

function byKey(items, key) { return items.filter((item) => item.key === key); }

function main() {
  let checks = 0;
  const check = (condition, message) => { assert.ok(condition, message); checks++; };

  const xlsxDoc = document({
    id: 'DOC-XLSX-SEM', fileName: 'study.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', hashChar: 'a',
  });
  const xlsxAtoms = [
    cell(xlsxDoc, 'A1', 'إجمالي تكلفة شراء المبنى'), cell(xlsxDoc, 'B1', 150635000, 'NUMBER'), cell(xlsxDoc, 'C1', 'ريال'),
    cell(xlsxDoc, 'A2', 'صافي الدخل التشغيلي (NOI)'), cell(xlsxDoc, 'B2', 14859936, 'NUMBER'), cell(xlsxDoc, 'C2', 'ريال/سنة'),
    cell(xlsxDoc, 'A3', 'معدل العائد الداخلي (IRR)'), cell(xlsxDoc, 'B3', 0.1488723, 'NUMBER'), cell(xlsxDoc, 'C3', '%'),
    cell(xlsxDoc, 'A4', 'إجمالي المساحة التأجيرية الصافية'), cell(xlsxDoc, 'B4', 7800, 'NUMBER'), cell(xlsxDoc, 'C4', 'متر مربع'),
    cell(xlsxDoc, 'A5', 'قيمة شراء المبنى'), cell(xlsxDoc, 'B5', 140000000, 'NUMBER'), cell(xlsxDoc, 'C5', 'ريال'),
    cell(xlsxDoc, 'A6', 'معدل الرسملة السوقي (Cap Rate)'), cell(xlsxDoc, 'B6', 0.07, 'NUMBER'), cell(xlsxDoc, 'C6', '%'),
    cell(xlsxDoc, 'A7', 'العائد على التكلفة (Cap Rate)'), cell(xlsxDoc, 'B7', 0.0986, 'NUMBER'), cell(xlsxDoc, 'C7', '%'),
  ];
  const xlsxMapped = mapSemanticEvidence({ document: xlsxDoc, parserResult: parserResult(xlsxDoc, PARSER_FORMAT.XLSX, xlsxAtoms), capturedAt: '2026-08-31T08:01:00Z' });
  check(xlsxMapped.status === 'MAPPED', 'XLSX semantic mapping did not map');
  check(byKey(xlsxMapped.facts, 'transaction.purchase_price').length === 1, 'Purchase price mapping missing');
  check(byKey(xlsxMapped.facts, 'transaction.total_acquisition_cost').length === 1, 'Total acquisition cost mapping missing');
  check(byKey(xlsxMapped.facts, 'transaction.purchase_price')[0].normalizedValue === 140000000, 'Purchase price was conflated with acquisition cost');
  check(byKey(xlsxMapped.facts, 'transaction.total_acquisition_cost')[0].normalizedValue === 150635000, 'Acquisition cost value mismatch');
  check(byKey(xlsxMapped.facts, 'market.cap_rate')[0].normalizedValue === 0.07, 'Market cap rate mapping mismatch');
  check(byKey(xlsxMapped.facts, 'financial.return_on_cost')[0].normalizedValue === 0.0986, 'Return-on-cost mapping mismatch');
  check(byKey(xlsxMapped.facts, 'market.cap_rate')[0].key !== byKey(xlsxMapped.facts, 'financial.return_on_cost')[0].key, 'Market cap rate and return on cost were conflated');
  check(xlsxMapped.facts.every((fact) => fact.truthStatus === TRUTH_STATUS.EXTRACTED_EVIDENCE), 'Semantic mapper overclaimed verification');

  const pptxDoc = document({
    id: 'DOC-PPTX-SEM', fileName: 'study.pptx',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', hashChar: 'b',
  });
  const pptxText = 'ملخص النتائج — المساحة التأجيرية 7,800 متر مربع — تكلفة الاستحواذ 150,635,000 ريال — صافي الدخل التشغيلي 14,859,936 ريال — معدل العائد الداخلي 14.90%';
  const pptxMapped = mapSemanticEvidence({ document: pptxDoc, parserResult: parserResult(pptxDoc, PARSER_FORMAT.PPTX, [slide(pptxDoc, 1, pptxText)]), capturedAt: '2026-08-31T08:02:00Z' });
  check(pptxMapped.status === 'MAPPED', 'PPTX semantic mapping did not map');
  const pptIrr = byKey(pptxMapped.facts, 'financial.irr')[0];
  check(Boolean(pptIrr), 'PPTX IRR mapping missing');
  check(pptIrr.rawValue.includes('%'), 'PPTX raw percentage was not preserved');
  check(Math.abs(pptIrr.normalizedValue - 0.149) < 1e-12, 'PPTX percentage normalization to ratio failed');

  const combined = [...xlsxMapped.facts, ...pptxMapped.facts];
  const reconciled = reconcileSemanticEvidence(combined, {
    caseId: 'CASE-SEM-001',
    keys: ['transaction.total_acquisition_cost', 'financial.noi_annual', 'financial.irr', 'leasing.lettable_area'],
  });
  const status = Object.fromEntries(reconciled.map((item) => [item.key, item.status]));
  check(status['transaction.total_acquisition_cost'] === RECONCILIATION_STATUS.AGREEMENT, 'Acquisition cost should agree across documents');
  check(status['financial.noi_annual'] === RECONCILIATION_STATUS.AGREEMENT, 'NOI should agree across documents');
  check(status['financial.irr'] === RECONCILIATION_STATUS.AGREEMENT, 'Rounded presentation IRR should agree within governed tolerance');
  check(status['leasing.lettable_area'] === RECONCILIATION_STATUS.AGREEMENT, 'Lettable area should agree across documents');

  const conflictDoc = document({
    id: 'DOC-PPTX-CONFLICT', fileName: 'conflict.pptx',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', hashChar: 'c',
  });
  const conflictMapped = mapSemanticEvidence({
    document: conflictDoc,
    parserResult: parserResult(conflictDoc, PARSER_FORMAT.PPTX, [slide(conflictDoc, 1, 'تكلفة الاستحواذ 152,000,000 ريال')]),
    capturedAt: '2026-08-31T08:03:00Z',
  });
  const costConflict = reconcileSemanticEvidence([
    ...byKey(xlsxMapped.facts, 'transaction.total_acquisition_cost'),
    ...byKey(conflictMapped.facts, 'transaction.total_acquisition_cost'),
  ], { caseId: 'CASE-SEM-001', keys: ['transaction.total_acquisition_cost'] })[0];
  check(costConflict.status === RECONCILIATION_STATUS.CONFLICT, 'Material acquisition-cost conflict was not surfaced');
  check(costConflict.consensusValue === null, 'Conflict must not silently select a winner');

  const ambiguousLandDoc = document({
    id: 'DOC-LAND-PPTX', fileName: 'land.pptx',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', hashChar: 'd',
  });
  const ambiguousLandMapped = mapSemanticEvidence({
    document: ambiguousLandDoc,
    parserResult: parserResult(ambiguousLandDoc, PARSER_FORMAT.PPTX, [slide(ambiguousLandDoc, 1, 'قيمة الأرض 36,000,000 ريال')]),
  });
  check(byKey(ambiguousLandMapped.facts, 'transaction.purchase_price').length === 0, 'Ambiguous generic land value must not auto-map to purchase price');

  const otherCaseDoc = document({
    id: 'DOC-OTHER-CASE', caseId: 'CASE-OTHER', fileName: 'other.pptx',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', hashChar: 'e',
  });
  const otherCaseMapped = mapSemanticEvidence({
    document: otherCaseDoc,
    parserResult: parserResult(otherCaseDoc, PARSER_FORMAT.PPTX, [slide(otherCaseDoc, 1, 'تكلفة الاستحواذ 150,635,000 ريال')]),
  });
  assert.throws(() => reconcileSemanticEvidence([...xlsxMapped.facts, ...otherCaseMapped.facts]), /CASE_ISOLATION_VIOLATION/);
  checks++;

  console.log(`SEMANTIC_EVIDENCE_MAPPING_CHECKS=${checks}`);
  console.log(`XLSX_SEMANTIC_FACTS=${xlsxMapped.facts.length}`);
  console.log(`PPTX_SEMANTIC_FACTS=${pptxMapped.facts.length}`);
  console.log('SEMANTIC_EVIDENCE_MAPPING_RESULT=PASS');
}

main();
