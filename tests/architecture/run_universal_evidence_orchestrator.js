'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  DOCUMENT_TYPE,
  AUTHORITY_CLASS,
  RECONCILIATION_STATUS,
  READINESS_STATUS,
  createDocumentRecord,
} = require('../../src/document-intelligence');
const {
  PARSER_FORMAT,
  PARSER_STATUS,
  PARSED_ATOM_KIND,
} = require('../../src/document-intelligence/parsers/contracts');
const {
  ASSET_CLASS,
  LIFECYCLE_STAGE,
  INVESTMENT_STRATEGY,
  INCOME_MODEL,
  ENGINE_ROUTE_STATUS,
  ORCHESTRATION_STATUS,
  OVERALL_RULE_COVERAGE,
  createProjectProfile,
  orchestrateProjectEvidence,
} = require('../../src/project-model');

function document({ documentId, caseId, type, authority, hashChar }) {
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
    authorityClass: authority,
    receivedAt: '2026-08-31T08:20:00Z',
  });
}

function xlsxResult(doc) {
  const cells = [
    ['A1', 'إجمالي تكلفة الاستحواذ', 'STRING'], ['B1', 150000000, 'NUMBER'],
    ['A2', 'معدل العائد الداخلي', 'STRING'], ['B2', 0.149, 'NUMBER'], ['C2', '%', 'STRING'],
  ];
  return {
    documentId: doc.documentId,
    caseId: doc.caseId,
    status: PARSER_STATUS.PARSED,
    format: PARSER_FORMAT.XLSX,
    atoms: cells.map(([cell, rawValue, valueType]) => ({
      documentId: doc.documentId,
      caseId: doc.caseId,
      adapterId: 'TEST_XLSX',
      kind: PARSED_ATOM_KIND.CELL,
      rawValue,
      valueType,
      location: { kind: 'CELL', sheet: 'Input', cell },
      metadata: {},
    })),
    warnings: [],
  };
}

function pptxResult(doc) {
  return {
    documentId: doc.documentId,
    caseId: doc.caseId,
    status: PARSER_STATUS.PARSED,
    format: PARSER_FORMAT.PPTX,
    atoms: [{
      documentId: doc.documentId,
      caseId: doc.caseId,
      adapterId: 'TEST_PPTX',
      kind: PARSED_ATOM_KIND.TEXT,
      rawValue: 'تكلفة الاستحواذ 150,000,000 معدل العائد الداخلي 14.90%',
      valueType: 'STRING',
      location: { kind: 'SLIDE', slide: 1 },
      metadata: {},
    }],
    warnings: [],
  };
}

function main() {
  let checks = 0;
  const check = (condition, message) => { assert.ok(condition, message); checks++; };

  const caseId = 'CASE-UNIVERSAL-001';
  const officeProfile = createProjectProfile({
    projectId: 'PROJECT-UNIVERSAL-001',
    projectName: 'Any Leased Existing Asset',
    assetClasses: [ASSET_CLASS.OFFICE],
    lifecycleStage: LIFECYCLE_STAGE.EXISTING_OPERATING,
    investmentStrategy: INVESTMENT_STRATEGY.ACQUIRE_HOLD,
    incomeModel: INCOME_MODEL.LEASE_INCOME,
  });
  const xlsxDoc = document({ documentId: 'DOC-X', caseId, type: DOCUMENT_TYPE.FINANCIAL_MODEL, authority: AUTHORITY_CLASS.INTERNAL_MODEL, hashChar: 'a' });
  const pptxDoc = document({ documentId: 'DOC-P', caseId, type: DOCUMENT_TYPE.PRESENTATION, authority: AUTHORITY_CLASS.PRESENTATION, hashChar: 'b' });

  const office = orchestrateProjectEvidence({
    profile: officeProfile,
    caseId,
    parsedDocuments: [
      { document: xlsxDoc, parserResult: xlsxResult(xlsxDoc) },
      { document: pptxDoc, parserResult: pptxResult(pptxDoc) },
    ],
    semanticRequirements: [
      { key: 'transaction.total_acquisition_cost', minimumIndependentSources: 2 },
      { key: 'financial.irr', minimumIndependentSources: 2 },
    ],
    capturedAt: '2026-08-31T08:21:00Z',
  });

  check(office.orchestrationStatus === ORCHESTRATION_STATUS.PROCESSED, 'Office orchestration should process mapped evidence');
  check(office.counts.parsedDocumentBundles === 2 && office.counts.mappedDocuments === 2, 'Both independent documents should be mapped');
  const acquisition = office.reconciliations.find((item) => item.key === 'transaction.total_acquisition_cost');
  const irr = office.reconciliations.find((item) => item.key === 'financial.irr');
  check(acquisition && acquisition.status === RECONCILIATION_STATUS.AGREEMENT && acquisition.independentSourceCount === 2, 'Acquisition cost should reconcile across independent XLSX/PPTX sources');
  check(irr && irr.status === RECONCILIATION_STATUS.AGREEMENT && Math.abs(irr.consensusValue - 0.149) < 1e-12, 'IRR percentage normalization should reconcile 0.149 with 14.90%');
  check(office.readiness.status === READINESS_STATUS.READY_FOR_UNDERWRITING_INPUT, 'Explicit semantic requirements should be evidence-ready');
  check(office.engineRoute.status === ENGINE_ROUTE_STATUS.QUALIFIED, 'Qualified leased existing asset should receive an executable engine route');
  check(office.semanticRuleCoverage.status === OVERALL_RULE_COVERAGE.NO_REQUIRED_DOMAIN_RULE_GAPS, 'Core semantic expansion should provide at least one deterministic rule for every required office evidence domain');

  const hotelProfile = createProjectProfile({
    projectId: 'PROJECT-HOTEL-001',
    assetClasses: [ASSET_CLASS.HOSPITALITY],
    lifecycleStage: LIFECYCLE_STAGE.EXISTING_OPERATING,
    investmentStrategy: INVESTMENT_STRATEGY.ACQUIRE_HOLD,
    incomeModel: INCOME_MODEL.OPERATING_BUSINESS,
  });
  const hotel = orchestrateProjectEvidence({
    profile: hotelProfile,
    caseId: 'CASE-HOTEL-001',
    parsedDocuments: [],
    semanticRequirements: [{ key: 'operations.gross_operating_profit', minimumIndependentSources: 1 }],
  });
  check(hotel.orchestrationStatus === ORCHESTRATION_STATUS.NO_SEMANTIC_EVIDENCE, 'Hotel with no parsed documents should remain a valid but evidence-empty case');
  check(hotel.engineRoute.status === ENGINE_ROUTE_STATUS.HOLD_NO_QUALIFIED_ENGINE && hotel.engineRoute.evidencePipelineSupported === true, 'Operating hotel should use universal evidence pipeline but fail closed for financial routing');
  check(hotel.semanticRuleCoverage.status === OVERALL_RULE_COVERAGE.NO_REQUIRED_DOMAIN_RULE_GAPS, 'Core semantic expansion should provide rule presence for every required hotel evidence domain');
  check(hotel.readiness.status === READINESS_STATUS.HOLD_EVIDENCE, 'Missing hotel operating evidence must block readiness');

  const wrongCaseDoc = document({ documentId: 'DOC-WRONG', caseId: 'CASE-WRONG', type: DOCUMENT_TYPE.PRESENTATION, authority: AUTHORITY_CLASS.PRESENTATION, hashChar: 'c' });
  assert.throws(() => orchestrateProjectEvidence({
    profile: officeProfile,
    caseId,
    parsedDocuments: [{ document: wrongCaseDoc, parserResult: pptxResult(wrongCaseDoc) }],
  }), /CASE_ISOLATION_VIOLATION/);
  checks++;

  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'project-model', 'universal-evidence-orchestrator.js'), 'utf8');
  check(!source.includes('calculateInvestmentCase'), 'Universal evidence orchestrator must never invoke financial calculations directly');
  check(!/ابو\s*بكر|أبو\s*بكر|الوادي|حي\s*الندى/i.test(source), 'Universal evidence orchestrator must not encode exemplar project names');

  console.log(`UNIVERSAL_EVIDENCE_ORCHESTRATOR_CHECKS=${checks}`);
  console.log(`OFFICE_FACTS=${office.counts.evidenceFacts}`);
  console.log(`OFFICE_READINESS=${office.readiness.status}`);
  console.log(`HOTEL_ENGINE_ROUTE=${hotel.engineRoute.status}`);
  console.log(`HOTEL_RULE_GAPS=${hotel.semanticRuleCoverage.gapDomains.join(',')}`);
  console.log('UNIVERSAL_EVIDENCE_ORCHESTRATOR_RESULT=PASS');
}

main();
