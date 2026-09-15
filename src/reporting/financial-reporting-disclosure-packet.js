'use strict';

const crypto = require('crypto');
const {
  REGULATED_CONTEXT_STATUS,
  DOMAIN_GATE_STATUS,
  verifyRegulatedContextIntegrity,
} = require('../standards/regulated-context-router');

const FINANCIAL_REPORTING_DISCLOSURE_STATUS = Object.freeze({
  READY_FOR_REPORT_DRAFT: 'READY_FOR_REPORT_DRAFT',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  HOLD_REGULATED_CONTEXT: 'HOLD_REGULATED_CONTEXT',
  HOLD_DISCLOSURES: 'HOLD_DISCLOSURES',
  HOLD_INTEGRITY: 'HOLD_INTEGRITY',
});

const DISCLOSURE_TOPIC = Object.freeze({
  FAIR_VALUE_MEASUREMENT: 'FAIR_VALUE_MEASUREMENT',
  INVESTMENT_PROPERTY: 'INVESTMENT_PROPERTY',
  PROPERTY_PLANT_EQUIPMENT: 'PROPERTY_PLANT_EQUIPMENT',
  IMPAIRMENT: 'IMPAIRMENT',
  LEASE_ACCOUNTING: 'LEASE_ACCOUNTING',
  VALUATION_TECHNIQUES_AND_INPUTS: 'VALUATION_TECHNIQUES_AND_INPUTS',
  VALUATION_UNCERTAINTY: 'VALUATION_UNCERTAINTY',
  OTHER: 'OTHER',
});

const DISCLOSURE_DECISION = Object.freeze({
  DISCLOSURE_REQUIRED: 'DISCLOSURE_REQUIRED',
  DISCLOSURE_NOT_REQUIRED: 'DISCLOSURE_NOT_REQUIRED',
  PROFESSIONAL_POSITION_RECORDED: 'PROFESSIONAL_POSITION_RECORDED',
  MATERIAL_REVIEW_REQUIRED: 'MATERIAL_REVIEW_REQUIRED',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
});

const CLAIM_NATURE = Object.freeze({
  FACT: 'FACT',
  ACCOUNTING_JUDGMENT: 'ACCOUNTING_JUDGMENT',
  VALUATION_REFERENCE: 'VALUATION_REFERENCE',
  REPORTING_DISCLOSURE: 'REPORTING_DISCLOSURE',
});

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertNonEmpty(value, field) {
  if (!nonEmpty(value)) throw new TypeError(`${field} must be a non-empty string`);
}

function assertEnum(value, enumeration, field) {
  if (!Object.values(enumeration).includes(value)) throw new TypeError(`${field} is invalid`);
}

function iso(value, field) {
  assertNonEmpty(value, field);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return date.toISOString();
}

function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => {
    out[key] = stableClone(value[key]);
    return out;
  }, {});
}

function sha256(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stableClone(value))).digest('hex');
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function normalizeRefs(values, field) {
  if (!Array.isArray(values) || values.length === 0 || values.some((value) => !nonEmpty(value))) {
    throw new TypeError(`${field} must contain at least one non-empty reference`);
  }
  return [...new Set(values.map((value) => value.trim()))].sort();
}

function validHash(value) {
  return nonEmpty(value) && /^[a-f0-9]{64}$/i.test(value);
}

function createDisclosureRecord({
  disclosureId,
  topic,
  decision,
  claimNature,
  statement,
  rationale,
  standardIds,
  evidenceRefs,
  asOfDate,
  preparedByRef,
  preparedAt,
  reviewedByRef,
  reviewedAt,
  reviewEvidenceRef,
} = {}) {
  for (const [field, value] of [
    ['disclosureId', disclosureId], ['statement', statement], ['rationale', rationale],
    ['preparedByRef', preparedByRef], ['reviewedByRef', reviewedByRef], ['reviewEvidenceRef', reviewEvidenceRef],
  ]) assertNonEmpty(value, field);
  assertEnum(topic, DISCLOSURE_TOPIC, 'topic');
  assertEnum(decision, DISCLOSURE_DECISION, 'decision');
  assertEnum(claimNature, CLAIM_NATURE, 'claimNature');
  const standards = normalizeRefs(standardIds, 'standardIds');
  const evidence = normalizeRefs(evidenceRefs, 'evidenceRefs');
  const asOfDateIso = iso(asOfDate, 'asOfDate');
  const preparedAtIso = iso(preparedAt, 'preparedAt');
  const reviewedAtIso = iso(reviewedAt, 'reviewedAt');
  if (Date.parse(preparedAtIso) < Date.parse(asOfDateIso)) throw new TypeError('DISCLOSURE_PREPARATION_BEFORE_AS_OF_DATE');
  if (Date.parse(reviewedAtIso) < Date.parse(preparedAtIso)) throw new TypeError('DISCLOSURE_REVIEW_BEFORE_PREPARATION');

  const core = {
    schemaVersion: 1,
    disclosureId: disclosureId.trim(),
    topic,
    decision,
    claimNature,
    statement: statement.trim(),
    rationale: rationale.trim(),
    standardIds: standards,
    evidenceRefs: evidence,
    asOfDate: asOfDateIso,
    preparedByRef: preparedByRef.trim(),
    preparedAt: preparedAtIso,
    reviewedByRef: reviewedByRef.trim(),
    reviewedAt: reviewedAtIso,
    reviewEvidenceRef: reviewEvidenceRef.trim(),
    professionalReviewExplicit: true,
    automaticallyConcluded: false,
  };
  return deepFreeze({ ...core, disclosureHashSha256: sha256(core) });
}

function verifyDisclosureRecordIntegrity(record) {
  if (!record || !validHash(record.disclosureHashSha256)) return false;
  const { disclosureHashSha256, ...core } = record;
  return sha256(core) === record.disclosureHashSha256.toLowerCase();
}

function createValuationReference({
  referenceId,
  method,
  valueIndicationSar,
  calculationHashSha256,
  valuationDate,
  sourceRef,
  evidenceRefs,
} = {}) {
  for (const [field, value] of [['referenceId', referenceId], ['method', method], ['sourceRef', sourceRef]]) assertNonEmpty(value, field);
  if (typeof valueIndicationSar !== 'number' || !Number.isFinite(valueIndicationSar)) throw new TypeError('valueIndicationSar must be finite');
  if (!validHash(calculationHashSha256)) throw new TypeError('calculationHashSha256 must be SHA-256');
  const core = {
    schemaVersion: 1,
    referenceId: referenceId.trim(),
    method: method.trim(),
    valueIndicationSar,
    calculationHashSha256: calculationHashSha256.toLowerCase(),
    valuationDate: iso(valuationDate, 'valuationDate'),
    sourceRef: sourceRef.trim(),
    evidenceRefs: normalizeRefs(evidenceRefs, 'evidenceRefs'),
    recalculated: false,
    accountingTreatmentApplied: false,
  };
  return deepFreeze({ ...core, valuationReferenceHashSha256: sha256(core) });
}

function verifyValuationReferenceIntegrity(reference) {
  if (!reference || !validHash(reference.valuationReferenceHashSha256)) return false;
  const { valuationReferenceHashSha256, ...core } = reference;
  return sha256(core) === reference.valuationReferenceHashSha256.toLowerCase();
}

function hold(status, blockers, context = {}) {
  return deepFreeze({
    schemaVersion: 1,
    packetId: context.packetId || null,
    caseId: context.caseId || null,
    propertyRef: context.propertyRef || null,
    valuationDate: context.valuationDate || null,
    reportDate: context.reportDate || null,
    regulatedContextHashSha256: context.regulatedContextHashSha256 || null,
    status,
    blockers,
    reportDraftAllowed: false,
    disclosures: [],
    valuationReferences: [],
    valuationArithmeticMutationAllowed: false,
    accountingTreatmentAutomaticallyApplied: false,
    financialReportingComplianceEstablished: false,
    legalConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  });
}

function buildFinancialReportingDisclosurePacket({
  packetId,
  caseId,
  propertyRef,
  valuationDate,
  reportDate,
  regulatedContextResult,
  disclosures = [],
  valuationReferences = [],
  preparedByRef,
  preparedAt,
  reviewedByRef,
  reviewedAt,
  reviewEvidenceRef,
} = {}) {
  for (const [field, value] of [
    ['packetId', packetId], ['caseId', caseId], ['propertyRef', propertyRef],
    ['preparedByRef', preparedByRef], ['reviewedByRef', reviewedByRef], ['reviewEvidenceRef', reviewEvidenceRef],
  ]) assertNonEmpty(value, field);
  const valuationDateIso = iso(valuationDate, 'valuationDate');
  const reportDateIso = iso(reportDate, 'reportDate');
  const preparedAtIso = iso(preparedAt, 'preparedAt');
  const reviewedAtIso = iso(reviewedAt, 'reviewedAt');
  if (Date.parse(reportDateIso) < Date.parse(valuationDateIso)) throw new TypeError('REPORT_DATE_BEFORE_VALUATION_DATE');
  if (Date.parse(preparedAtIso) < Date.parse(reportDateIso)) throw new TypeError('DISCLOSURE_PACKET_PREPARED_BEFORE_REPORT_DATE');
  if (Date.parse(reviewedAtIso) < Date.parse(preparedAtIso)) throw new TypeError('DISCLOSURE_PACKET_REVIEW_BEFORE_PREPARATION');

  const context = {
    packetId: packetId.trim(), caseId: caseId.trim(), propertyRef: propertyRef.trim(),
    valuationDate: valuationDateIso, reportDate: reportDateIso,
    regulatedContextHashSha256: regulatedContextResult?.regulatedContextHashSha256 || null,
  };

  if (!regulatedContextResult || !verifyRegulatedContextIntegrity(regulatedContextResult)
      || ![REGULATED_CONTEXT_STATUS.READY, REGULATED_CONTEXT_STATUS.READY_WITH_REQUIRED_REVIEW].includes(regulatedContextResult.status)) {
    return hold(FINANCIAL_REPORTING_DISCLOSURE_STATUS.HOLD_REGULATED_CONTEXT, ['REGULATED_CONTEXT_NOT_READY_OR_INTEGRITY_FAILED'], context);
  }

  if (!Array.isArray(disclosures)) throw new TypeError('disclosures must be an array');
  if (!Array.isArray(valuationReferences)) throw new TypeError('valuationReferences must be an array');

  const financialGate = regulatedContextResult.financialReportingGate;
  if (!financialGate || financialGate.status === DOMAIN_GATE_STATUS.NOT_APPLICABLE) {
    if (disclosures.length || valuationReferences.length) {
      return hold(FINANCIAL_REPORTING_DISCLOSURE_STATUS.HOLD_DISCLOSURES, ['FINANCIAL_REPORTING_NOT_APPLICABLE_BUT_DISCLOSURE_CONTENT_PROVIDED'], context);
    }
    const core = {
      schemaVersion: 1,
      packetId: packetId.trim(),
      caseId: caseId.trim(),
      propertyRef: propertyRef.trim(),
      valuationDate: valuationDateIso,
      reportDate: reportDateIso,
      regulatedContextHashSha256: regulatedContextResult.regulatedContextHashSha256,
      financialReportingGateStatus: DOMAIN_GATE_STATUS.NOT_APPLICABLE,
      disclosures: [],
      valuationReferences: [],
      preparedByRef: preparedByRef.trim(),
      preparedAt: preparedAtIso,
      reviewedByRef: reviewedByRef.trim(),
      reviewedAt: reviewedAtIso,
      reviewEvidenceRef: reviewEvidenceRef.trim(),
    };
    return deepFreeze({
      ...core,
      disclosurePacketHashSha256: sha256(core),
      status: FINANCIAL_REPORTING_DISCLOSURE_STATUS.NOT_APPLICABLE,
      blockers: [],
      reportDraftAllowed: false,
      valuationArithmeticMutationAllowed: false,
      accountingTreatmentAutomaticallyApplied: false,
      financialReportingComplianceEstablished: false,
      legalConclusionEstablished: false,
      certifiedValuationEstablished: false,
      transactionAuthorized: false,
    });
  }

  if (financialGate.status !== DOMAIN_GATE_STATUS.REVIEW_REQUIRED) {
    return hold(FINANCIAL_REPORTING_DISCLOSURE_STATUS.HOLD_REGULATED_CONTEXT, [`UNSUPPORTED_FINANCIAL_REPORTING_GATE_STATUS:${financialGate.status || 'UNKNOWN'}`], context);
  }

  if (disclosures.length === 0) {
    return hold(FINANCIAL_REPORTING_DISCLOSURE_STATUS.HOLD_DISCLOSURES, ['AT_LEAST_ONE_REVIEWED_DISCLOSURE_REQUIRED'], context);
  }

  const allowedStandardIds = new Set(financialGate.standardIds || []);
  const disclosureBlockers = [];
  const integrityBlockers = [];
  const disclosureIds = new Set();
  const normalizedDisclosures = [];
  for (const disclosure of disclosures) {
    if (!verifyDisclosureRecordIntegrity(disclosure)) {
      integrityBlockers.push(`DISCLOSURE_INTEGRITY_FAILED:${disclosure?.disclosureId || 'UNKNOWN'}`);
      continue;
    }
    if (disclosureIds.has(disclosure.disclosureId)) disclosureBlockers.push(`DUPLICATE_DISCLOSURE_ID:${disclosure.disclosureId}`);
    disclosureIds.add(disclosure.disclosureId);
    if (Date.parse(disclosure.asOfDate) > Date.parse(reportDateIso)) disclosureBlockers.push(`DISCLOSURE_AS_OF_AFTER_REPORT_DATE:${disclosure.disclosureId}`);
    if (Date.parse(disclosure.reviewedAt) > Date.parse(reviewedAtIso)) disclosureBlockers.push(`DISCLOSURE_REVIEW_AFTER_PACKET_REVIEW:${disclosure.disclosureId}`);
    for (const standardId of disclosure.standardIds) {
      if (!allowedStandardIds.has(standardId)) disclosureBlockers.push(`DISCLOSURE_STANDARD_NOT_BOUND_TO_FINANCIAL_REPORTING_GATE:${disclosure.disclosureId}:${standardId}`);
    }
    normalizedDisclosures.push(disclosure);
  }

  const referenceIds = new Set();
  const normalizedReferences = [];
  for (const reference of valuationReferences) {
    if (!verifyValuationReferenceIntegrity(reference)) {
      integrityBlockers.push(`VALUATION_REFERENCE_INTEGRITY_FAILED:${reference?.referenceId || 'UNKNOWN'}`);
      continue;
    }
    if (referenceIds.has(reference.referenceId)) disclosureBlockers.push(`DUPLICATE_VALUATION_REFERENCE_ID:${reference.referenceId}`);
    referenceIds.add(reference.referenceId);
    if (reference.valuationDate !== valuationDateIso) disclosureBlockers.push(`VALUATION_REFERENCE_DATE_MISMATCH:${reference.referenceId}`);
    normalizedReferences.push(reference);
  }

  if (integrityBlockers.length) return hold(FINANCIAL_REPORTING_DISCLOSURE_STATUS.HOLD_INTEGRITY, integrityBlockers, context);
  if (disclosureBlockers.length) return hold(FINANCIAL_REPORTING_DISCLOSURE_STATUS.HOLD_DISCLOSURES, disclosureBlockers, context);

  const core = {
    schemaVersion: 1,
    packetId: packetId.trim(),
    caseId: caseId.trim(),
    propertyRef: propertyRef.trim(),
    valuationDate: valuationDateIso,
    reportDate: reportDateIso,
    regulatedContextHashSha256: regulatedContextResult.regulatedContextHashSha256,
    standardsRouteHash: regulatedContextResult.standardsRouteHash,
    standardsSnapshotHash: regulatedContextResult.standardsSnapshotHash || null,
    financialReportingFramework: regulatedContextResult.financialReportingFramework,
    financialReportingStandardIds: [...allowedStandardIds].sort(),
    disclosures: normalizedDisclosures,
    valuationReferences: normalizedReferences,
    preparedByRef: preparedByRef.trim(),
    preparedAt: preparedAtIso,
    reviewedByRef: reviewedByRef.trim(),
    reviewedAt: reviewedAtIso,
    reviewEvidenceRef: reviewEvidenceRef.trim(),
  };
  return deepFreeze({
    ...core,
    disclosurePacketHashSha256: sha256(core),
    status: FINANCIAL_REPORTING_DISCLOSURE_STATUS.READY_FOR_REPORT_DRAFT,
    blockers: [],
    reportDraftAllowed: true,
    professionalAccountingReviewRecorded: true,
    valuationReferencesRecalculated: false,
    valuationArithmeticMutationAllowed: false,
    professionalValueIndicationMutable: false,
    accountingTreatmentAutomaticallyApplied: false,
    financialReportingComplianceEstablished: false,
    legalConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    semantics: 'This packet records professionally reviewed financial-reporting disclosure positions and immutable valuation references for later report drafting. It does not recalculate property value, automatically determine accounting treatment, establish financial-reporting compliance, provide a legal conclusion, certify a valuation or authorize a transaction.',
  });
}

function verifyFinancialReportingDisclosurePacketIntegrity(packet) {
  if (!packet || !validHash(packet.disclosurePacketHashSha256)) return false;
  const core = { ...packet };
  [
    'disclosurePacketHashSha256', 'status', 'blockers', 'reportDraftAllowed', 'professionalAccountingReviewRecorded',
    'valuationReferencesRecalculated', 'valuationArithmeticMutationAllowed', 'professionalValueIndicationMutable',
    'accountingTreatmentAutomaticallyApplied', 'financialReportingComplianceEstablished', 'legalConclusionEstablished',
    'certifiedValuationEstablished', 'transactionAuthorized', 'semantics',
  ].forEach((key) => delete core[key]);
  return sha256(core) === packet.disclosurePacketHashSha256.toLowerCase();
}

module.exports = {
  FINANCIAL_REPORTING_DISCLOSURE_STATUS,
  DISCLOSURE_TOPIC,
  DISCLOSURE_DECISION,
  CLAIM_NATURE,
  createDisclosureRecord,
  verifyDisclosureRecordIntegrity,
  createValuationReference,
  verifyValuationReferenceIntegrity,
  buildFinancialReportingDisclosurePacket,
  verifyFinancialReportingDisclosurePacketIntegrity,
};
