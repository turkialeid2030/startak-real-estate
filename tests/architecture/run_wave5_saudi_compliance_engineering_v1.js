'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  OPERATING_MODE,
  DECISION_SUPPORT_OUTPUT_TYPE,
  EXTERNAL_DECISION_LABEL,
  VALUATION_STATUS,
  LEGAL_REVIEW_STATUS,
  PROHIBITED_EXTERNAL_OUTPUT,
  FULL_SCOPE_NOTICE,
  SHORT_SCOPE_NOTICE,
  assertPermittedExternalOutput,
  createDecisionSupportEnvelope,
  createValuationIndicationEnvelope,
  createLegalTitleBoundary,
} = require('../../src/compliance/decision-support.js');
const {
  SAUDI_REGULATORY_SOURCES,
  SOURCE_STATUS,
  evaluateSaudiRegulatoryRegistry,
} = require('../../src/compliance/saudi-regulatory-source-registry.js');
const {
  PDPL_ENGINEERING_STATUS,
  REQUIRED_CONTROL_KEYS,
  evaluatePdplEngineeringControls,
} = require('../../src/compliance/pdpl-engineering-controls.js');
const {
  BACKUP_VERSION,
  buildExportPayload,
  validateBackupEnvelope,
  BackupError,
} = require('../../src/storage/saved-deals-backup.js');

const results = [];
function check(id, fn) {
  try {
    fn();
    results.push(true);
    console.log(`${id}=PASS`);
  } catch (error) {
    results.push(false);
    console.error(`${id}=FAIL -- ${error.message}`);
  }
}

function mockProvider(store) {
  return {
    get: async (key) => store[key] || null,
    set: async (key, value) => { store[key] = value; },
  };
}

(async () => {
  check('W5_OUTPUT_TAXONOMY', () => {
    assert.deepStrictEqual(new Set(Object.values(DECISION_SUPPORT_OUTPUT_TYPE)), new Set([
      'ANALYTICAL_INDICATION',
      'SCREENING_RESULT',
      'SCENARIO_RESULT',
      'RISK_FLAG',
      'EVIDENCE_GAP',
      'REQUIRES_LICENSED_REVIEW',
    ]));
  });

  check('W5_PROHIBITED_REGULATED_OUTPUTS', () => {
    for (const outputType of ['CERTIFIED_VALUATION', 'LEGAL_OPINION', 'REGULATED_INVESTMENT_ADVICE', 'BROKER_RECOMMENDATION', 'BUY', 'SELL', 'APPROVE', 'REJECT']) {
      assert.ok(PROHIBITED_EXTERNAL_OUTPUT.has(outputType));
      assert.throws(
        () => assertPermittedExternalOutput(outputType),
        (error) => error?.code === 'COMPLIANCE_GUARD_BLOCKED_OUTPUT',
      );
    }
  });

  check('W5_SCOPE_NOTICE_EXACT_AR', () => {
    assert.strictEqual(FULL_SCOPE_NOTICE.ar, 'أداة دعم قرار وتحليل معلوماتي وليست استشارة عقارية مرخصة أو تقييماً عقارياً معتمداً أو رأياً قانونياً أو توصية استثمارية ملزمة. تعتمد النتائج على البيانات والافتراضات المتاحة، ويجب التحقق منها ومراجعة المسائل التي تتطلب ترخيصاً أو رأياً مهنياً لدى المختص المرخص قبل اتخاذ القرار أو إتمام أي تصرف.');
    assert.strictEqual(SHORT_SCOPE_NOTICE.ar, 'تحليل داعم للقرار — غير مرخص كاستشارة أو تقييم معتمد.');
    assert.ok(FULL_SCOPE_NOTICE.en.includes('not licensed real-estate consultancy'));
  });

  check('W5_DECISION_ENVELOPE_NO_TRANSACTION_AUTHORITY', () => {
    const envelope = createDecisionSupportEnvelope({
      analyticalLabel: EXTERNAL_DECISION_LABEL.FAVOURABLE_ANALYTICAL_CASE,
      evidenceProvenance: [{ source: 'SYNTHETIC', qualificationStatus: 'TEST_ONLY' }],
    });
    assert.strictEqual(envelope.operatingMode, OPERATING_MODE.UNLICENSED_DECISION_SUPPORT);
    assert.strictEqual(envelope.certifiedValuation, false);
    assert.strictEqual(envelope.legalOpinionEstablished, false);
    assert.strictEqual(envelope.transactionAuthorized, false);
    assert.strictEqual(envelope.evidenceProvenance.length, 1);
  });

  check('W5_VALUATION_ALWAYS_NON_CERTIFIED', () => {
    const indication = createValuationIndicationEnvelope({ analyticalLabel: EXTERNAL_DECISION_LABEL.CONDITIONAL });
    assert.strictEqual(indication.outputType, DECISION_SUPPORT_OUTPUT_TYPE.ANALYTICAL_INDICATION);
    assert.strictEqual(indication.valuationStatus, VALUATION_STATUS.NON_CERTIFIED_ANALYTICAL_INDICATION);
    assert.strictEqual(indication.certifiedValuation, false);
    assert.strictEqual(indication.transactionAuthorized, false);

    const review = createValuationIndicationEnvelope({
      analyticalLabel: EXTERNAL_DECISION_LABEL.REQUIRES_LICENSED_REVIEW,
      licensedReviewRequired: true,
    });
    assert.strictEqual(review.outputType, DECISION_SUPPORT_OUTPUT_TYPE.REQUIRES_LICENSED_REVIEW);
    assert.strictEqual(review.valuationStatus, VALUATION_STATUS.REQUIRES_LICENSED_VALUER_REVIEW);
    assert.strictEqual(review.certifiedValuation, false);
  });

  check('W5_LEGAL_TITLE_INTERPRETATION_FAILS_CLOSED', () => {
    const factual = createLegalTitleBoundary({ facts: [{ key: 'owner', value: 'Synthetic Owner' }] });
    assert.strictEqual(factual.legalReviewStatus, LEGAL_REVIEW_STATUS.FACTUAL_EXTRACTION_ONLY);
    assert.strictEqual(factual.legalConclusion, null);
    const interpretive = createLegalTitleBoundary({
      facts: [{ key: 'mortgageDetected', value: true }],
      inconsistencies: ['Synthetic legal-sensitive fact'],
      interpretationRequired: true,
    });
    assert.strictEqual(interpretive.legalReviewStatus, LEGAL_REVIEW_STATUS.LEGAL_REVIEW_REQUIRED);
    assert.strictEqual(interpretive.outputType, DECISION_SUPPORT_OUTPUT_TYPE.REQUIRES_LICENSED_REVIEW);
    assert.strictEqual(interpretive.licensedReviewRequired, true);
    assert.strictEqual(interpretive.legalConclusion, null);
    assert.strictEqual(interpretive.transactionAuthorized, false);
  });

  check('W5_REGULATORY_SOURCE_METADATA', () => {
    assert.ok(SAUDI_REGULATORY_SOURCES.length >= 5);
    for (const source of SAUDI_REGULATORY_SOURCES) {
      for (const key of ['authority', 'sourceUrl', 'effectiveDate', 'lastVerifiedDate', 'reviewAfterDate', 'versionHash']) {
        assert.ok(typeof source[key] === 'string' && source[key].trim().length > 0, `${source.id}.${key}`);
      }
      assert.ok(source.sourceUrl.startsWith('https://'));
      assert.ok(Number.isInteger(source.reviewCadenceDays) && source.reviewCadenceDays > 0);
      assert.strictEqual(source.sourcePriority, 'OFFICIAL_GOVERNMENT_PRIMARY');
    }
    const current = evaluateSaudiRegulatoryRegistry('2026-09-06');
    assert.strictEqual(current.status, SOURCE_STATUS.ACTIVE_AT_LAST_VERIFICATION);
    assert.strictEqual(current.legalApprovalEstablished, false);
    assert.strictEqual(current.transactionAuthorized, false);
  });

  check('W5_STALE_REGULATORY_SOURCE_FAILS_CLOSED', () => {
    const stale = evaluateSaudiRegulatoryRegistry('2026-12-06');
    assert.strictEqual(stale.status, SOURCE_STATUS.REGULATORY_REVIEW_REQUIRED);
    assert.ok(stale.sources.some((source) => source.usableForComplianceEvidence === false));
  });

  check('W5_PDPL_ENGINEERING_GATE_FAILS_CLOSED', () => {
    const incomplete = evaluatePdplEngineeringControls({
      controls: { tenantIsolation: true },
      evidenceRefs: { tenantIsolation: 'tests/architecture/run_tenant_boundary_security_v1.js' },
    });
    assert.strictEqual(incomplete.status, PDPL_ENGINEERING_STATUS.HOLD_MISSING_ENGINEERING_CONTROLS);
    assert.strictEqual(incomplete.readyForEngineeringReleaseGate, false);
    assert.strictEqual(incomplete.legalComplianceEstablished, false);
  });

  check('W5_PDPL_CROSS_BORDER_GATE', () => {
    const controls = Object.fromEntries(REQUIRED_CONTROL_KEYS.map((key) => [key, true]));
    const evidenceRefs = Object.fromEntries(REQUIRED_CONTROL_KEYS.map((key) => [key, `SYNTHETIC_EVIDENCE:${key}`]));
    const hold = evaluatePdplEngineeringControls({ controls, evidenceRefs, crossBorderTransfer: true });
    assert.strictEqual(hold.status, PDPL_ENGINEERING_STATUS.HOLD_CROSS_BORDER_REVIEW);
    const syntheticComplete = evaluatePdplEngineeringControls({
      controls,
      evidenceRefs,
      crossBorderTransfer: true,
      crossBorderReviewEvidenceRef: 'SYNTHETIC_AUTHORIZED_REVIEW_EVIDENCE',
    });
    assert.strictEqual(syntheticComplete.status, PDPL_ENGINEERING_STATUS.ENGINEERING_CONTROLS_PRESENT);
    assert.strictEqual(syntheticComplete.legalComplianceEstablished, false);
    assert.strictEqual(syntheticComplete.transactionAuthorized, false);
  });

  check('W5_EXISTING_SECURITY_EVIDENCE_FILES_PRESENT', () => {
    for (const relative of [
      'tests/architecture/run_tenant_boundary_security_v1.js',
      'tests/architecture/run_authorization_audit_security_v1.js',
      'tests/architecture/run_runtime_rls_verification_v1.js',
      'src/observability/report-runtime-error.js',
      'src/storage/storage-provider.js',
    ]) {
      assert.ok(fs.existsSync(path.resolve(__dirname, '../..', relative)), relative);
    }
    const telemetry = fs.readFileSync(path.resolve(__dirname, '../../src/observability/report-runtime-error.js'), 'utf8');
    assert.match(telemetry, /sendDefaultPii:\s*false/);
    assert.match(telemetry, /ALLOWED_ENVELOPE_FIELDS/);
    const storage = fs.readFileSync(path.resolve(__dirname, '../../src/storage/storage-provider.js'), 'utf8');
    assert.match(storage, /delete\(key:string\)/);
  });

  const store = {
    'deal:w5': JSON.stringify({
      id: 'w5',
      name: 'Synthetic compliance export',
      mode: 'building',
      inputs: { buildingPrice: 140000000 },
      savedAt: '2026-09-06',
    }),
  };
  const exportPayload = await buildExportPayload([{ id: 'w5' }], mockProvider(store));

  check('W5_EXPORT_V4_SCOPE_AND_PROVENANCE', () => {
    assert.strictEqual(BACKUP_VERSION, 4);
    assert.strictEqual(exportPayload.backupVersion, 4);
    assert.strictEqual(exportPayload.compliance.operatingMode, OPERATING_MODE.UNLICENSED_DECISION_SUPPORT);
    assert.strictEqual(exportPayload.compliance.certifiedValuation, false);
    assert.strictEqual(exportPayload.compliance.transactionAuthorized, false);
    assert.strictEqual(exportPayload.compliance.fullNotice.ar, FULL_SCOPE_NOTICE.ar);
    assert.strictEqual(exportPayload.evidenceProvenance.exportedAt, exportPayload.exportedAt);
    assert.strictEqual(exportPayload.evidenceProvenance.dealCount, 1);
    assert.strictEqual(exportPayload.evidenceProvenance.qualification, 'STRUCTURAL_VALIDATION_ONLY_NOT_PROFESSIONAL_CERTIFICATION');
    assert.strictEqual(validateBackupEnvelope(exportPayload), exportPayload);
  });

  check('W5_EXPORT_V4_TAMPERING_FAILS_CLOSED', () => {
    const tampered = JSON.parse(JSON.stringify(exportPayload));
    tampered.compliance.transactionAuthorized = true;
    assert.throws(
      () => validateBackupEnvelope(tampered),
      (error) => error instanceof BackupError && error.reasonCode === 'V4_COMPLIANCE_METADATA_INVALID',
    );
    const missingProvenance = JSON.parse(JSON.stringify(exportPayload));
    delete missingProvenance.evidenceProvenance;
    assert.throws(
      () => validateBackupEnvelope(missingProvenance),
      (error) => error instanceof BackupError && error.reasonCode === 'V4_EXPORT_PROVENANCE_INVALID',
    );
  });

  check('W5_PERSISTENT_UI_BOUNDARY_WIRING', () => {
    const mainSource = fs.readFileSync(path.resolve(__dirname, '../../src/main.jsx'), 'utf8');
    const noticeSource = fs.readFileSync(path.resolve(__dirname, '../../src/components/ComplianceBoundaryNotice.jsx'), 'utf8');
    assert.match(mainSource, /activateCustomerFacingVerdictPresentation\(\);/);
    assert.match(mainSource, /<ComplianceBoundaryNotice\s*\/>/);
    assert.match(noticeSource, /data-testid="compliance-short-notice"/);
    assert.match(noticeSource, /data-testid="compliance-full-notice"/);
    assert.match(noticeSource, /SHORT_SCOPE_NOTICE/);
    assert.match(noticeSource, /FULL_SCOPE_NOTICE/);
  });

  check('W5_EXTERNAL_PRESENTATION_SOURCE_NO_DIRECT_TRANSACTION_ACTION', () => {
    const presentation = fs.readFileSync(path.resolve(__dirname, '../../src/app/compliance-verdict-presentation.js'), 'utf8');
    assert.doesNotMatch(presentation, /\b(BUY|SELL|APPROVE|REJECT)\b/);
    assert.doesNotMatch(presentation, /يوصى بالشراء|لا يوصى بالشراء/);
  });

  const allPass = results.every(Boolean);
  console.log(`WAVE5_SAUDI_COMPLIANCE_ENGINEERING_CHECKS=${results.length}`);
  console.log(`WAVE5_SAUDI_COMPLIANCE_ENGINEERING_RESULT=${allPass ? 'PASS' : 'FAIL'}`);
  console.log('SAUDI_LEGAL_REVIEW_STATUS=PENDING');
  console.log('COMMERCIAL_EXTERNAL_LAUNCH=HOLD');
  console.log('TRANSACTION_AUTHORIZED=false');
  process.exit(allPass ? 0 : 1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
