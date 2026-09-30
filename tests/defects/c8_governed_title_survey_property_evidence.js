'use strict';

const assert = require('assert');
const {
  TRUTH_STATUS,
  VERIFICATION_STATUS,
} = require('../../src/document-intelligence/contracts');
const {
  EVIDENCE_SOURCE_ROLE,
  EVIDENCE_SENSITIVITY_CLASS,
  EXTRACTOR_TYPE,
  PROFESSIONAL_REVIEW_OUTCOME,
  createProfessionalEvidenceChainRecord,
  recordProfessionalEvidenceReview,
  validateProfessionalEvidenceChainIntegrity,
} = require('../../src/document-intelligence/professional-evidence-chain');
const {
  TITLE_SURVEY_VERIFICATION_STATUS,
  PROPERTY_EVIDENCE_CLASS,
  verifyGovernedTitleSurveyPropertyEvidence,
} = require('../../src/property/governed-title-survey-verification');

let checks = 0;
function check(condition, message) {
  assert.ok(condition, message);
  checks += 1;
}

const CASE_ID = 'CASE-C8-001';
const PROPERTY_REF = 'PROPERTY-C8-001';
const AS_OF = '2026-09-30T12:00:00Z';
const DEFAULT_VERIFIED_AT = '2026-09-25T12:00:00Z';

const KEY = Object.freeze({
  OWNER: 'property.owner_identity',
  PARCEL: 'property.parcel_id',
  PLOT: 'property.plot_number',
  PLAN: 'property.plan_number',
  AREA: 'property.land_area',
  ENCUMBRANCE: 'property.encumbrance_status',
});

function policy(overrides = {}) {
  const base = {
    policyId: 'C8-SYNTHETIC-POLICY',
    version: '1.0.0',
    requiredSourceRoles: [
      EVIDENCE_SOURCE_ROLE.TITLE_DEED,
      EVIDENCE_SOURCE_ROLE.REAL_ESTATE_REGISTRY,
      EVIDENCE_SOURCE_ROLE.SURVEY,
    ],
    requiredKeys: [KEY.OWNER, KEY.PARCEL, KEY.PLOT, KEY.PLAN, KEY.AREA],
    keyClassByKey: {
      [KEY.OWNER]: PROPERTY_EVIDENCE_CLASS.OWNER,
      [KEY.PARCEL]: PROPERTY_EVIDENCE_CLASS.PARCEL,
      [KEY.PLOT]: PROPERTY_EVIDENCE_CLASS.PLOT,
      [KEY.PLAN]: PROPERTY_EVIDENCE_CLASS.PLAN,
      [KEY.AREA]: PROPERTY_EVIDENCE_CLASS.LAND_AREA,
      [KEY.ENCUMBRANCE]: PROPERTY_EVIDENCE_CLASS.ENCUMBRANCE,
    },
    maxAgeDaysBySourceRole: {
      [EVIDENCE_SOURCE_ROLE.TITLE_DEED]: 60,
      [EVIDENCE_SOURCE_ROLE.REAL_ESTATE_REGISTRY]: 30,
      [EVIDENCE_SOURCE_ROLE.SURVEY]: 60,
    },
    minimumIndependentSourcesByKey: {
      [KEY.OWNER]: 2,
      [KEY.PARCEL]: 2,
      [KEY.PLOT]: 2,
      [KEY.PLAN]: 2,
      [KEY.AREA]: 2,
    },
    numericToleranceByKey: {
      [KEY.AREA]: { absolute: 2 },
    },
    blockingFindingValuesByKey: {
      [KEY.ENCUMBRANCE]: ['ACTIVE'],
    },
  };
  return { ...base, ...overrides };
}

let hashCounter = 0;
function nextHashChar() {
  const chars = '123456789abcdef';
  const char = chars[hashCounter % chars.length];
  hashCounter += 1;
  return char;
}

function reviewedEvidence({
  id,
  key,
  value,
  sourceRole,
  unit = null,
  valueType = 'STRING',
  verifiedAt = DEFAULT_VERIFIED_AT,
  verified = true,
  caseId = CASE_ID,
}) {
  const hashChar = nextHashChar();
  const capturedAt = verifiedAt || '2026-09-25T10:00:00Z';
  const fact = {
    schemaVersion: 1,
    factId: `FACT-${id}`,
    caseId,
    documentId: `DOC-${id}`,
    documentHashSha256: hashChar.repeat(64),
    documentType: sourceRole,
    authorityClass: 'OFFICIAL_OR_PROFESSIONAL_EVIDENCE',
    authorityVerified: true,
    key,
    rawValue: String(value),
    normalizedValue: value,
    valueType,
    unit,
    sourceLocator: { kind: 'PAGE_OR_FIELD', reference: `${id}:1` },
    extraction: { method: 'STRUCTURED_CAPTURE', confidence: 0.99 },
    materiality: 'MATERIAL',
    truthStatus: verified ? TRUTH_STATUS.VERIFIED_FACT : TRUTH_STATUS.EXTRACTED_EVIDENCE,
    verification: verified
      ? { status: VERIFICATION_STATUS.VERIFIED, method: 'HUMAN_SOURCE_CHECK', verifierType: 'REVIEWER', reference: `VERIFY-${id}`, verifiedAt }
      : { status: VERIFICATION_STATUS.NOT_VERIFIED, method: null, verifierType: null, reference: null, verifiedAt: null },
    capturedAt,
  };
  let record = createProfessionalEvidenceChainRecord({
    recordId: `CHAIN-${id}`,
    fact,
    sourceRole,
    sourceReference: `SOURCE-${id}`,
    evidenceLink: `evidence://${id}`,
    extractor: { type: EXTRACTOR_TYPE.SYSTEM, name: 'STARTAK_C8_FIXTURE', version: '1.0.0' },
    capturedByRef: 'SYSTEM:C8',
    sensitivityClass: EVIDENCE_SENSITIVITY_CLASS.CRITICAL,
    createdAt: capturedAt,
  });
  record = recordProfessionalEvidenceReview({
    record,
    review: {
      reviewId: `REVIEW-${id}`,
      outcome: PROFESSIONAL_REVIEW_OUTCOME.APPROVED,
      reviewedByRef: 'USER:C8-REVIEWER',
      reviewEvidenceRef: `review://${id}`,
      reviewedAt: verifiedAt || '2026-09-25T11:00:00Z',
      acknowledgements: {
        sourceViewed: true,
        locatorChecked: true,
        semanticMappingChecked: true,
        documentHashChecked: true,
        accountabilityAccepted: true,
      },
    },
  });
  return record;
}

function buildGoodEvidence() {
  hashCounter = 0;
  return [
    reviewedEvidence({ id: 'OWNER-DEED', key: KEY.OWNER, value: 'OWNER-001', sourceRole: EVIDENCE_SOURCE_ROLE.TITLE_DEED }),
    reviewedEvidence({ id: 'OWNER-REG', key: KEY.OWNER, value: 'OWNER-001', sourceRole: EVIDENCE_SOURCE_ROLE.REAL_ESTATE_REGISTRY }),
    reviewedEvidence({ id: 'PARCEL-DEED', key: KEY.PARCEL, value: 'PARCEL-001', sourceRole: EVIDENCE_SOURCE_ROLE.TITLE_DEED }),
    reviewedEvidence({ id: 'PARCEL-SURVEY', key: KEY.PARCEL, value: 'PARCEL-001', sourceRole: EVIDENCE_SOURCE_ROLE.SURVEY }),
    reviewedEvidence({ id: 'PLOT-DEED', key: KEY.PLOT, value: 'PLOT-10', sourceRole: EVIDENCE_SOURCE_ROLE.TITLE_DEED }),
    reviewedEvidence({ id: 'PLOT-SURVEY', key: KEY.PLOT, value: 'PLOT-10', sourceRole: EVIDENCE_SOURCE_ROLE.SURVEY }),
    reviewedEvidence({ id: 'PLAN-DEED', key: KEY.PLAN, value: 'PLAN-20', sourceRole: EVIDENCE_SOURCE_ROLE.TITLE_DEED }),
    reviewedEvidence({ id: 'PLAN-SURVEY', key: KEY.PLAN, value: 'PLAN-20', sourceRole: EVIDENCE_SOURCE_ROLE.SURVEY }),
    reviewedEvidence({ id: 'AREA-DEED', key: KEY.AREA, value: 1000, unit: 'sqm', valueType: 'NUMBER', sourceRole: EVIDENCE_SOURCE_ROLE.TITLE_DEED }),
    reviewedEvidence({ id: 'AREA-SURVEY', key: KEY.AREA, value: 1001, unit: 'sqm', valueType: 'NUMBER', sourceRole: EVIDENCE_SOURCE_ROLE.SURVEY }),
    reviewedEvidence({ id: 'ENC-REG', key: KEY.ENCUMBRANCE, value: 'NONE', sourceRole: EVIDENCE_SOURCE_ROLE.REAL_ESTATE_REGISTRY }),
  ];
}

function verify(evidenceRecords, suppliedPolicy = policy()) {
  return verifyGovernedTitleSurveyPropertyEvidence({
    caseId: CASE_ID,
    propertyRef: PROPERTY_REF,
    evidenceRecords,
    policy: suppliedPolicy,
    asOf: AS_OF,
  });
}

const good = buildGoodEvidence();
const ready = verify(good);
check(ready.status === TITLE_SURVEY_VERIFICATION_STATUS.READY_FOR_PROFESSIONAL_REVIEW, 'complete governed title/survey evidence is ready for professional review');
check(ready.professionalReviewReady === true, 'ready state is limited to professional review readiness');
check(ready.legalTitleValidityEstablished === false && ready.transactionAuthorized === false, 'C8 never establishes legal title validity or transaction authority');
check(ready.automaticUnderwritingAdoption === false && ready.financialEngineInputsWritten === false, 'C8 never writes financial-engine inputs');
check(/^[a-f0-9]{64}$/.test(ready.resultHashSha256), 'C8 result is hash-bound');
check(ready.findings.some((item) => item.evidenceClass === PROPERTY_EVIDENCE_CLASS.ENCUMBRANCE && item.normalizedValue === 'NONE'), 'encumbrance evidence is surfaced with provenance');
check(ready.reconciliationChecks.find((item) => item.key === KEY.AREA).status === 'AGREEMENT', 'area values inside explicit tolerance reconcile');

const reversed = verify([...good].reverse());
check(reversed.resultHashSha256 === ready.resultHashSha256, 'canonical sorting makes result deterministic across evidence input order');

const noSurvey = verify(good.filter((record) => record.sourceRole !== EVIDENCE_SOURCE_ROLE.SURVEY));
check(noSurvey.status === TITLE_SURVEY_VERIFICATION_STATUS.HOLD_EVIDENCE, 'missing required survey source fails closed');
check(noSurvey.reasons.some((reason) => reason === `REQUIRED_SOURCE_ROLE_MISSING:${EVIDENCE_SOURCE_ROLE.SURVEY}`), 'missing required source role is explicit');

const noPlan = verify(good.filter((record) => record.fact.key !== KEY.PLAN));
check(noPlan.status === TITLE_SURVEY_VERIFICATION_STATUS.HOLD_EVIDENCE, 'missing required plan key fails closed');
check(noPlan.reasons.some((reason) => reason === `REQUIRED_PROPERTY_KEY_MISSING:${KEY.PLAN}`), 'missing material key is explicit');

const ownerMismatchEvidence = good.filter((record) => record.recordId !== 'CHAIN-OWNER-REG');
ownerMismatchEvidence.push(reviewedEvidence({ id: 'OWNER-REG-BAD', key: KEY.OWNER, value: 'OWNER-999', sourceRole: EVIDENCE_SOURCE_ROLE.REAL_ESTATE_REGISTRY }));
const ownerMismatch = verify(ownerMismatchEvidence);
check(ownerMismatch.status === TITLE_SURVEY_VERIFICATION_STATUS.MATERIAL_PROPERTY_DATA_CONFLICT, 'owner disagreement blocks C8');
check(ownerMismatch.reasons.includes(`OWNER_MISMATCH:${KEY.OWNER}`), 'owner mismatch has explicit reason code');

const areaMismatchEvidence = good.filter((record) => record.recordId !== 'CHAIN-AREA-SURVEY');
areaMismatchEvidence.push(reviewedEvidence({ id: 'AREA-SURVEY-BAD', key: KEY.AREA, value: 1005, unit: 'sqm', valueType: 'NUMBER', sourceRole: EVIDENCE_SOURCE_ROLE.SURVEY }));
const areaMismatch = verify(areaMismatchEvidence);
check(areaMismatch.status === TITLE_SURVEY_VERIFICATION_STATUS.MATERIAL_PROPERTY_DATA_CONFLICT, 'area outside explicit tolerance blocks C8');
check(areaMismatch.reasons.includes(`LAND_AREA_MISMATCH:${KEY.AREA}`), 'area mismatch has explicit reason code');

const areaUnitEvidence = good.filter((record) => record.recordId !== 'CHAIN-AREA-SURVEY');
areaUnitEvidence.push(reviewedEvidence({ id: 'AREA-SURVEY-UNIT', key: KEY.AREA, value: 1001, unit: 'sqft', valueType: 'NUMBER', sourceRole: EVIDENCE_SOURCE_ROLE.SURVEY }));
const areaUnitMismatch = verify(areaUnitEvidence);
check(areaUnitMismatch.reasons.includes(`LAND_AREA_UNIT_MISMATCH:${KEY.AREA}`), 'C8 does not silently convert area units');

const staleEvidence = good.filter((record) => record.recordId !== 'CHAIN-OWNER-REG');
staleEvidence.push(reviewedEvidence({ id: 'OWNER-REG-STALE', key: KEY.OWNER, value: 'OWNER-001', sourceRole: EVIDENCE_SOURCE_ROLE.REAL_ESTATE_REGISTRY, verifiedAt: '2026-08-01T12:00:00Z' }));
const stale = verify(staleEvidence);
check(stale.status === TITLE_SURVEY_VERIFICATION_STATUS.HOLD_FRESHNESS, 'stale evidence fails closed under supplied max-age policy');
check(stale.reasons.some((reason) => reason.startsWith('EVIDENCE_STALE:')), 'staleness reason is explicit');

const futureEvidence = good.filter((record) => record.recordId !== 'CHAIN-OWNER-REG');
futureEvidence.push(reviewedEvidence({ id: 'OWNER-REG-FUTURE', key: KEY.OWNER, value: 'OWNER-001', sourceRole: EVIDENCE_SOURCE_ROLE.REAL_ESTATE_REGISTRY, verifiedAt: '2026-10-01T12:00:00Z' }));
const future = verify(futureEvidence);
check(future.status === TITLE_SURVEY_VERIFICATION_STATUS.HOLD_FRESHNESS, 'future verification timestamp fails closed');
check(future.reasons.some((reason) => reason.startsWith('EVIDENCE_VERIFICATION_TIMESTAMP_IN_FUTURE:')), 'future timestamp reason is explicit');

const missingTimestampEvidence = good.filter((record) => record.recordId !== 'CHAIN-OWNER-REG');
missingTimestampEvidence.push(reviewedEvidence({ id: 'OWNER-REG-NO-TIME', key: KEY.OWNER, value: 'OWNER-001', sourceRole: EVIDENCE_SOURCE_ROLE.REAL_ESTATE_REGISTRY, verifiedAt: null }));
const missingTimestamp = verify(missingTimestampEvidence);
check(missingTimestamp.status === TITLE_SURVEY_VERIFICATION_STATUS.HOLD_FRESHNESS, 'missing verification timestamp fails closed');

const unverifiedEvidence = good.filter((record) => record.recordId !== 'CHAIN-OWNER-REG');
unverifiedEvidence.push(reviewedEvidence({ id: 'OWNER-REG-UNVERIFIED', key: KEY.OWNER, value: 'OWNER-001', sourceRole: EVIDENCE_SOURCE_ROLE.REAL_ESTATE_REGISTRY, verified: false }));
const unverified = verify(unverifiedEvidence);
check(unverified.status === TITLE_SURVEY_VERIFICATION_STATUS.HOLD_EVIDENCE, 'unverified critical evidence is inadmissible');

const tamperTarget = good[0];
const tampered = {
  ...tamperTarget,
  fact: { ...tamperTarget.fact, normalizedValue: 'OWNER-TAMPERED' },
};
check(validateProfessionalEvidenceChainIntegrity(tampered) === true, 'fixture demonstrates legacy chain hash alone does not rebind a replaced fact payload');
const tamperedEvidence = [tampered, ...good.slice(1)];
const tamperResult = verify(tamperedEvidence);
check(tamperResult.status === TITLE_SURVEY_VERIFICATION_STATUS.HOLD_INTEGRITY, 'C8 closes fact/projection tamper gap and fails closed');
check(tamperResult.reasons.some((reason) => reason.startsWith('EVIDENCE_CHAIN_OR_FACT_BINDING_FAILED:')), 'fact/projection binding failure is explicit');

const policyWithoutAreaTolerance = policy({ numericToleranceByKey: {} });
const noTolerance = verify(good, policyWithoutAreaTolerance);
check(noTolerance.status === TITLE_SURVEY_VERIFICATION_STATUS.HOLD_POLICY, 'land-area verification requires explicit tolerance policy');

const activeEncumbranceEvidence = good.filter((record) => record.recordId !== 'CHAIN-ENC-REG');
activeEncumbranceEvidence.push(reviewedEvidence({ id: 'ENC-REG-ACTIVE', key: KEY.ENCUMBRANCE, value: 'ACTIVE', sourceRole: EVIDENCE_SOURCE_ROLE.REAL_ESTATE_REGISTRY }));
const blockedFinding = verify(activeEncumbranceEvidence);
check(blockedFinding.status === TITLE_SURVEY_VERIFICATION_STATUS.HOLD_MATERIAL_FINDING, 'policy-declared blocking encumbrance value holds C8');
check(blockedFinding.findings.some((item) => item.normalizedValue === 'ACTIVE'), 'blocking finding remains visible with provenance');

const nonBlockingPolicy = policy({ blockingFindingValuesByKey: {} });
const surfacedOnly = verify(activeEncumbranceEvidence, nonBlockingPolicy);
check(surfacedOnly.status === TITLE_SURVEY_VERIFICATION_STATUS.READY_FOR_PROFESSIONAL_REVIEW, 'material finding does not become a hard gate unless policy explicitly says so');
check(surfacedOnly.findings.some((item) => item.normalizedValue === 'ACTIVE'), 'non-blocking finding is still surfaced');

const incompleteFreshnessPolicy = policy({
  maxAgeDaysBySourceRole: {
    [EVIDENCE_SOURCE_ROLE.TITLE_DEED]: 60,
    [EVIDENCE_SOURCE_ROLE.SURVEY]: 60,
  },
});
const policyHold = verify(good, incompleteFreshnessPolicy);
check(policyHold.status === TITLE_SURVEY_VERIFICATION_STATUS.HOLD_POLICY, 'missing required-role freshness policy fails closed');

console.log(`C8_GOVERNED_TITLE_SURVEY_PROPERTY_EVIDENCE=PASS checks=${checks}`);
