'use strict';

const {
  AUTHORITY_CLASS,
  MATERIALITY,
  TRUTH_STATUS,
  VERIFICATION_STATUS,
  createDocumentRecord,
} = require('./contracts');
const { classifyDocument } = require('./pipeline');
const { mapParsedAtomToEvidenceFact } = require('./parsers/evidence-mapper');

const PARSED_EVIDENCE_QUALIFICATION_STATUS = Object.freeze({
  CANDIDATE_REQUIRES_VERIFICATION: 'CANDIDATE_REQUIRES_VERIFICATION',
  HOLD_INTAKE_RECORD: 'HOLD_INTAKE_RECORD',
  HOLD_PARSER_RESULT: 'HOLD_PARSER_RESULT',
  HOLD_ATOM: 'HOLD_ATOM',
  HOLD_SEMANTIC_MAPPING: 'HOLD_SEMANTIC_MAPPING',
  HOLD_PROVENANCE: 'HOLD_PROVENANCE',
});

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validIsoDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? false : date.toISOString();
}

function hold(status, reasons, context = {}) {
  return Object.freeze({
    schemaVersion: 1,
    status,
    reasons: Object.freeze(reasons),
    caseId: context.caseId || null,
    documentId: context.documentId || null,
    fact: null,
    sourceProvenance: null,
    authorityVerified: false,
    verifiedFactEstablished: false,
    readyForUnderwritingInput: false,
    financialEngineEligible: false,
    transactionAuthorized: false,
  });
}

function buildParsedEvidenceCandidate({
  intakeRecord,
  atomId,
  semanticKey,
  valueType,
  unit = null,
  materiality = MATERIALITY.SUPPORTING,
  sourceReference,
  sourceDate = null,
  reviewerRef,
  reviewerNote,
  capturedAt,
} = {}) {
  const caseId = intakeRecord?.caseId || intakeRecord?.result?.atoms?.[0]?.caseId || null;
  const documentId = intakeRecord?.documentId || null;
  const context = { caseId, documentId };

  const intakeValid = intakeRecord
    && nonEmptyString(intakeRecord.fileName)
    && Number.isInteger(intakeRecord.size)
    && intakeRecord.size >= 0
    && typeof intakeRecord.digest === 'string'
    && /^[a-f0-9]{64}$/i.test(intakeRecord.digest)
    && nonEmptyString(intakeRecord.mimeType)
    && nonEmptyString(intakeRecord.documentId)
    && nonEmptyString(intakeRecord.caseId);
  if (!intakeValid) {
    return hold(PARSED_EVIDENCE_QUALIFICATION_STATUS.HOLD_INTAKE_RECORD, ['complete local intake identity, SHA-256 digest, file metadata, caseId, and documentId are required'], context);
  }

  if (!intakeRecord.result || intakeRecord.result.status !== 'PARSED' || !Array.isArray(intakeRecord.result.atoms) || intakeRecord.result.atoms.length === 0) {
    return hold(PARSED_EVIDENCE_QUALIFICATION_STATUS.HOLD_PARSER_RESULT, ['only a successful PARSED result with extracted atoms can enter semantic qualification'], context);
  }

  if (!nonEmptyString(atomId)) {
    return hold(PARSED_EVIDENCE_QUALIFICATION_STATUS.HOLD_ATOM, ['atomId is required'], context);
  }
  const atom = intakeRecord.result.atoms.find((candidate) => candidate?.atomId === atomId) || null;
  if (!atom || atom.caseId !== intakeRecord.caseId || atom.documentId !== intakeRecord.documentId) {
    return hold(PARSED_EVIDENCE_QUALIFICATION_STATUS.HOLD_ATOM, ['selected atom must exist in the same intake document and case'], context);
  }

  if (!nonEmptyString(semanticKey) || !nonEmptyString(valueType) || !Object.values(MATERIALITY).includes(materiality)) {
    return hold(PARSED_EVIDENCE_QUALIFICATION_STATUS.HOLD_SEMANTIC_MAPPING, ['explicit semanticKey, valueType, and valid materiality are required; parser output is never self-mapped'], context);
  }

  const normalizedSourceDate = validIsoDate(sourceDate);
  if (!nonEmptyString(sourceReference)
      || !nonEmptyString(reviewerRef)
      || !nonEmptyString(reviewerNote)
      || normalizedSourceDate === false) {
    return hold(PARSED_EVIDENCE_QUALIFICATION_STATUS.HOLD_PROVENANCE, ['sourceReference, reviewerRef, reviewerNote, and any supplied sourceDate must be explicit and valid'], context);
  }

  const document = createDocumentRecord({
    documentId: intakeRecord.documentId,
    caseId: intakeRecord.caseId,
    fileName: intakeRecord.fileName,
    mimeType: intakeRecord.mimeType,
    sizeBytes: intakeRecord.size,
    contentHashSha256: intakeRecord.digest,
    documentType: classifyDocument({ fileName: intakeRecord.fileName, mimeType: intakeRecord.mimeType }),
    authorityClass: AUTHORITY_CLASS.UNKNOWN,
    receivedAt: intakeRecord.receivedAt || capturedAt,
  });

  let fact;
  try {
    fact = mapParsedAtomToEvidenceFact({
      atom,
      document,
      factId: `local-fact:${intakeRecord.digest.slice(0, 16)}:${atom.atomId.split(':').slice(-2).join(':')}`,
      semanticKey: semanticKey.trim(),
      valueType: valueType.trim(),
      unit: nonEmptyString(unit) ? unit.trim() : null,
      materiality,
      extractionConfidence: 1,
      capturedAt,
    });
  } catch (error) {
    return hold(PARSED_EVIDENCE_QUALIFICATION_STATUS.HOLD_SEMANTIC_MAPPING, [error?.message || 'semantic mapping failed'], context);
  }

  return Object.freeze({
    schemaVersion: 1,
    status: PARSED_EVIDENCE_QUALIFICATION_STATUS.CANDIDATE_REQUIRES_VERIFICATION,
    reasons: Object.freeze([]),
    caseId: intakeRecord.caseId,
    documentId: intakeRecord.documentId,
    documentHashSha256: intakeRecord.digest.toLowerCase(),
    sourceProvenance: Object.freeze({
      sourceReference: sourceReference.trim(),
      sourceDate: normalizedSourceDate,
      reviewerRef: reviewerRef.trim(),
      reviewerNote: reviewerNote.trim(),
      provenanceClaimVerified: false,
    }),
    fact,
    authorityVerified: false,
    verifiedFactEstablished: fact.truthStatus === TRUTH_STATUS.VERIFIED_FACT,
    verificationStatus: fact.verification?.status || VERIFICATION_STATUS.NOT_VERIFIED,
    readyForUnderwritingInput: false,
    financialEngineEligible: false,
    transactionAuthorized: false,
    semantics: 'This object is a human-semantically-mapped evidence candidate derived from parsed local content. The source authority claim remains unverified, the fact remains EXTRACTED_EVIDENCE / NOT_VERIFIED, and it must not enter underwriting or the financial engine until a separate evidence verification and readiness process succeeds.',
  });
}

module.exports = {
  PARSED_EVIDENCE_QUALIFICATION_STATUS,
  buildParsedEvidenceCandidate,
};
