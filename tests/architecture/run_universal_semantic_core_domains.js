'use strict';

const assert = require('assert');
const {
  DOCUMENT_TYPE,
  AUTHORITY_CLASS,
  createDocumentRecord,
} = require('../../src/document-intelligence');
const {
  PARSER_FORMAT,
  PARSER_STATUS,
  PARSED_ATOM_KIND,
} = require('../../src/document-intelligence/parsers/contracts');
const {
  mapSemanticEvidence,
  semanticRuleById,
} = require('../../src/document-intelligence/semantics');
const {
  ASSET_CLASS,
  LIFECYCLE_STAGE,
  INVESTMENT_STRATEGY,
  INCOME_MODEL,
  OVERALL_RULE_COVERAGE,
  createProjectProfile,
  assessSemanticRuleCoverage,
} = require('../../src/project-model');

function doc(documentId, caseId, type, hashChar) {
  return createDocumentRecord({
    documentId,
    caseId,
    fileName: type === DOCUMENT_TYPE.FINANCIAL_MODEL ? `${documentId}.xlsx` : `${documentId}.pptx`,
    mimeType: type === DOCUMENT_TYPE.FINANCIAL_MODEL
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    sizeBytes: 100,
    contentHashSha256: hashChar.repeat(64),
    documentType: type,
    authorityClass: type === DOCUMENT_TYPE.FINANCIAL_MODEL ? AUTHORITY_CLASS.INTERNAL_MODEL : AUTHORITY_CLASS.PRESENTATION,
    receivedAt: '2026-08-31T08:30:00Z',
  });
}

function xlsxResult(document, rows) {
  const atoms = [];
  rows.forEach((row, index) => {
    const r = index + 1;
    atoms.push({
      documentId: document.documentId, caseId: document.caseId, adapterId: 'TEST_XLSX', kind: PARSED_ATOM_KIND.CELL,
      rawValue: row.label, valueType: 'STRING', location: { kind: 'CELL', sheet: 'Facts', cell: `A${r}` }, metadata: {},
    });
    atoms.push({
      documentId: document.documentId, caseId: document.caseId, adapterId: 'TEST_XLSX', kind: PARSED_ATOM_KIND.CELL,
      rawValue: row.value, valueType: typeof row.value === 'number' ? 'NUMBER' : 'STRING', location: { kind: 'CELL', sheet: 'Facts', cell: `B${r}` }, metadata: {},
    });
    if (row.unit) atoms.push({
      documentId: document.documentId, caseId: document.caseId, adapterId: 'TEST_XLSX', kind: PARSED_ATOM_KIND.CELL,
      rawValue: row.unit, valueType: 'STRING', location: { kind: 'CELL', sheet: 'Facts', cell: `C${r}` }, metadata: {},
    });
  });
  return { documentId: document.documentId, caseId: document.caseId, status: PARSER_STATUS.PARSED, format: PARSER_FORMAT.XLSX, atoms, warnings: [] };
}

function pptxResult(document, text) {
  return {
    documentId: document.documentId,
    caseId: document.caseId,
    status: PARSER_STATUS.PARSED,
    format: PARSER_FORMAT.PPTX,
    atoms: [{
      documentId: document.documentId, caseId: document.caseId, adapterId: 'TEST_PPTX', kind: PARSED_ATOM_KIND.TEXT,
      rawValue: text, valueType: 'STRING', location: { kind: 'SLIDE', slide: 1 }, metadata: {},
    }],
    warnings: [],
  };
}

function factByKey(mapping, key) {
  return mapping.facts.find((fact) => fact.key === key);
}

function main() {
  let checks = 0;
  const check = (condition, message) => { assert.ok(condition, message); checks++; };

  const caseId = 'CASE-CORE-DOMAINS';
  const spreadsheet = doc('DOC-CORE-X', caseId, DOCUMENT_TYPE.FINANCIAL_MODEL, 'd');
  const mapping = mapSemanticEvidence({
    document: spreadsheet,
    parserResult: xlsxResult(spreadsheet, [
      { label: 'المدينة', value: 'الرياض' },
      { label: 'الحي', value: 'الملقا' },
      { label: 'رقم الصك', value: 123456789 },
      { label: 'استخدام الأرض', value: 'تجاري' },
      { label: 'مخاطر السيول', value: 'منخفضة' },
      { label: 'إجمالي الربح التشغيلي', value: 50000000 },
      { label: 'عدد الغرف', value: 220 },
      { label: 'مبلغ التمويل', value: 100000000 },
      { label: 'نسبة التمويل إلى القيمة', value: 0.65, unit: '%' },
      { label: 'إجمالي النفقات الرأسمالية', value: 200000000 },
      { label: 'مدة التطوير بالأشهر', value: 24 },
      { label: 'نسبة ضريبة التصرفات العقارية', value: 0.05, unit: '%' },
      { label: 'معدل رسملة الخروج', value: '7.5%' },
      { label: 'الشهادة البيئية', value: 'LEED Gold' },
    ]),
    capturedAt: '2026-08-31T08:31:00Z',
  });

  check(mapping.status === 'MAPPED', 'Structured XLSX core-domain mapping should succeed');
  check(factByKey(mapping, 'location.city').normalizedValue === 'الرياض', 'City string mapping failed');
  check(factByKey(mapping, 'location.district').normalizedValue === 'الملقا', 'District string mapping failed');
  check(factByKey(mapping, 'ownership.title_deed_number').normalizedValue === '123456789', 'Numeric deed identifier must remain a STRING semantic value');
  check(factByKey(mapping, 'regulatory.land_use').normalizedValue === 'تجاري', 'Regulatory land-use mapping failed');
  check(factByKey(mapping, 'risk.flood_status').normalizedValue === 'منخفضة', 'Risk status mapping failed');
  check(factByKey(mapping, 'operations.gross_operating_profit').normalizedValue === 50000000, 'Operating GOP mapping failed');
  check(factByKey(mapping, 'operations.room_count').normalizedValue === 220, 'Room-count mapping failed');
  check(factByKey(mapping, 'financing.loan_amount').normalizedValue === 100000000, 'Loan amount mapping failed');
  check(Math.abs(factByKey(mapping, 'financing.ltv').normalizedValue - 0.65) < 1e-12, 'LTV ratio mapping failed');
  check(factByKey(mapping, 'capex.total').normalizedValue === 200000000, 'CAPEX mapping failed');
  check(factByKey(mapping, 'schedule.development_months').normalizedValue === 24, 'Schedule mapping failed');
  check(Math.abs(factByKey(mapping, 'tax.rett_rate').normalizedValue - 0.05) < 1e-12, 'RETT mapping failed');
  check(Math.abs(factByKey(mapping, 'exit.cap_rate').normalizedValue - 0.075) < 1e-12, 'Exit cap-rate mapping failed');
  check(factByKey(mapping, 'esg.environmental_certification').normalizedValue === 'LEED Gold', 'ESG certification mapping failed');

  const presentation = doc('DOC-CORE-P', caseId, DOCUMENT_TYPE.PRESENTATION, 'e');
  const slideMapping = mapSemanticEvidence({
    document: presentation,
    parserResult: pptxResult(presentation, 'المدينة الرياض اسم المالك شركة المثال إجمالي الربح التشغيلي 50,000,000'),
    capturedAt: '2026-08-31T08:32:00Z',
  });
  check(!factByKey(slideMapping, 'location.city'), 'Free-form PPTX must not auto-map string city without layout-aware boundaries');
  check(!factByKey(slideMapping, 'ownership.owner_name'), 'Free-form PPTX must not auto-map owner name without layout-aware boundaries');
  check(factByKey(slideMapping, 'operations.gross_operating_profit').normalizedValue === 50000000, 'Deterministic numeric PPTX mapping should remain supported');

  const hotel = createProjectProfile({
    projectId: 'GENERIC-HOTEL',
    assetClasses: [ASSET_CLASS.HOSPITALITY],
    lifecycleStage: LIFECYCLE_STAGE.EXISTING_OPERATING,
    investmentStrategy: INVESTMENT_STRATEGY.ACQUIRE_HOLD,
    incomeModel: INCOME_MODEL.OPERATING_BUSINESS,
  });
  const hotelCoverage = assessSemanticRuleCoverage(hotel);
  check(hotelCoverage.status === OVERALL_RULE_COVERAGE.NO_REQUIRED_DOMAIN_RULE_GAPS, `Hotel required-domain registry gaps remain: ${hotelCoverage.gapDomains.join(',')}`);

  const land = createProjectProfile({
    projectId: 'GENERIC-LAND',
    assetClasses: [ASSET_CLASS.LAND],
    lifecycleStage: LIFECYCLE_STAGE.PLANNED,
    investmentStrategy: INVESTMENT_STRATEGY.DEVELOPMENT,
    incomeModel: INCOME_MODEL.UNIT_SALES,
  });
  const landCoverage = assessSemanticRuleCoverage(land);
  check(landCoverage.status === OVERALL_RULE_COVERAGE.NO_REQUIRED_DOMAIN_RULE_GAPS, `Land-development required-domain registry gaps remain: ${landCoverage.gapDomains.join(',')}`);

  check(Boolean(semanticRuleById('LOCATION_CITY')), 'Core-domain rules must be registered in the canonical semantic registry');
  check(Boolean(semanticRuleById('OPERATIONS_GROSS_OPERATING_PROFIT')), 'Operating-business rules must be registered');
  check(Boolean(semanticRuleById('REGULATORY_LAND_USE')), 'Regulatory rules must be registered');

  console.log(`UNIVERSAL_SEMANTIC_CORE_DOMAIN_CHECKS=${checks}`);
  console.log(`MAPPED_FACTS=${mapping.mappedFactCount}`);
  console.log(`HOTEL_REQUIRED_DOMAIN_GAPS=${hotelCoverage.gapDomains.length}`);
  console.log(`LAND_REQUIRED_DOMAIN_GAPS=${landCoverage.gapDomains.length}`);
  console.log('UNIVERSAL_SEMANTIC_CORE_DOMAIN_RESULT=PASS');
}

main();
