'use strict';

const { createEvidenceFact, MATERIALITY } = require('../contracts');
const { normalizeExtractedValue } = require('../pipeline');

function mapParsedAtomToEvidenceFact({
  atom,
  document,
  factId,
  semanticKey,
  valueType,
  unit = null,
  materiality = MATERIALITY.SUPPORTING,
  extractionConfidence = 1,
  capturedAt,
}) {
  if (!atom || typeof atom !== 'object') throw new TypeError('atom is required');
  if (!document || typeof document !== 'object') throw new TypeError('document is required');
  if (atom.documentId !== document.documentId || atom.caseId !== document.caseId) {
    throw new TypeError('CASE_OR_DOCUMENT_ISOLATION_VIOLATION while mapping parser atom');
  }
  if (typeof semanticKey !== 'string' || semanticKey.trim() === '') {
    throw new TypeError('semanticKey is required; parser atoms cannot become evidence without explicit semantic mapping');
  }
  const targetValueType = valueType || atom.valueType || 'STRING';
  const normalizedValue = normalizeExtractedValue(atom.rawValue, targetValueType);
  const ocr=atom.adapterId==='LOCAL_OCR_PAGE_V1';
  if(ocr&&(atom.metadata?.extraction!=='LOCAL_OCR_UNVERIFIED'
    ||atom.metadata.sourceDigestSha256!==document.contentHashSha256
    ||!Number.isFinite(atom.metadata.engineConfidence)||atom.metadata.engineConfidence<0||atom.metadata.engineConfidence>100))
    throw new TypeError('OCR_SOURCE_OR_CONFIDENCE_INVALID');

  return createEvidenceFact({
    factId,
    caseId: document.caseId,
    document,
    key: semanticKey,
    rawValue: atom.rawValue,
    normalizedValue,
    valueType: targetValueType,
    unit,
    sourceLocator: atom.location,
    extractionMethod: atom.adapterId,
    extractionConfidence:ocr?atom.metadata.engineConfidence/100:extractionConfidence,
    materiality,
    capturedAt,
  });
}

module.exports = { mapParsedAtomToEvidenceFact };
