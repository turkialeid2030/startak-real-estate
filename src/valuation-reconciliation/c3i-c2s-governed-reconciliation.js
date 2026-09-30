'use strict';

const {
  RECONCILIATION_GATE_STATUS,
  RECONCILIATION_CONFIDENCE_CLASS,
} = require('../contracts/valuation-reconciliation');
const {
  SOURCE_PROVENANCE_GATE_STATUS,
} = require('../contracts/source-intelligence');
const {
  evaluateSourceProvenanceBundle,
  hashValue,
} = require('../source-intelligence/source-provenance-governance');
const {
  evaluateValuationReconciliation,
} = require('./valuation-reconciliation-governance');

const C3I_C2S_GOVERNED_RECONCILIATION_VERSION = 'C3I_C2S_GOVERNED_RECONCILIATION_V1';

const EVIDENCE_DOMAIN = Object.freeze({
  GEOSPATIAL: 'GEOSPATIAL',
  MARKET: 'MARKET',
});

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function freezeArray(values) {
  return Object.freeze([...values]);
}

function evidenceKey(domain, evidenceRecordId) {
  return `${domain}:${evidenceRecordId}`;
}

function normalizeSourceUrl(value) {
  const text = cleanString(value);
  if (!text) return null;
  try {
    const parsed = new URL(text);
    if (parsed.protocol !== 'https:') return null;
    parsed.hash = '';
    return parsed.toString();
  } catch (_) {
    return null;
  }
}

function collectExpectedEvidence(input, blockers) {
  const out = new Map();
  const domains = [
    [EVIDENCE_DOMAIN.GEOSPATIAL, input.geospatialEvidence && input.geospatialEvidence.evidenceRecords],
    [EVIDENCE_DOMAIN.MARKET, input.marketEvidence && input.marketEvidence.evidenceRecords],
  ];

  for (const [domain, records] of domains) {
    if (!Array.isArray(records)) {
      blockers.push(`C3I_C2S_${domain}_EVIDENCE_RECORDS_ARRAY_REQUIRED`);
      continue;
    }
    for (const record of records) {
      if (!record || typeof record !== 'object' || Array.isArray(record)) {
        blockers.push(`C3I_C2S_${domain}_EVIDENCE_RECORD_OBJECT_REQUIRED`);
        continue;
      }
      const recordId = cleanString(record.id);
      if (!recordId) {
        blockers.push(`C3I_C2S_${domain}_EVIDENCE_RECORD_ID_REQUIRED`);
        continue;
      }
      const key = evidenceKey(domain, recordId);
      if (out.has(key)) {
        blockers.push(`C3I_C2S_DUPLICATE_EVIDENCE_RECORD_KEY:${key}`);
        continue;
      }
      out.set(key, { domain, recordId, record });
    }
  }
  return out;
}

function evaluateEvidenceBindings(input, provenanceEvaluation) {
  const blockers = [];
  const expectedEvidence = collectExpectedEvidence(input, blockers);
  const bindings = Array.isArray(input.sourceProvenanceBindings) ? input.sourceProvenanceBindings : [];
  if (!Array.isArray(input.sourceProvenanceBindings)) blockers.push('C3I_C2S_SOURCE_PROVENANCE_BINDINGS_ARRAY_REQUIRED');

  const normalizedById = new Map((provenanceEvaluation.records || []).map((record) => [record.id, record]));
  const bindingByEvidenceKey = new Map();
  const usedSourceRecordIds = new Set();
  const normalizedBindings = [];

  for (const binding of bindings) {
    if (!binding || typeof binding !== 'object' || Array.isArray(binding)) {
      blockers.push('C3I_C2S_SOURCE_PROVENANCE_BINDING_OBJECT_REQUIRED');
      continue;
    }
    const domain = cleanString(binding.evidenceDomain);
    const evidenceRecordId = cleanString(binding.evidenceRecordId);
    const sourceRecordId = cleanString(binding.sourceRecordId);
    if (!Object.values(EVIDENCE_DOMAIN).includes(domain)) {
      blockers.push(`C3I_C2S_BINDING_DOMAIN_INVALID:${domain || 'MISSING'}`);
      continue;
    }
    if (!evidenceRecordId) {
      blockers.push(`C3I_C2S_BINDING_EVIDENCE_RECORD_ID_REQUIRED:${domain}`);
      continue;
    }
    if (!sourceRecordId) {
      blockers.push(`C3I_C2S_BINDING_SOURCE_RECORD_ID_REQUIRED:${domain}:${evidenceRecordId}`);
      continue;
    }

    const key = evidenceKey(domain, evidenceRecordId);
    if (!expectedEvidence.has(key)) {
      blockers.push(`C3I_C2S_BINDING_EVIDENCE_TARGET_NOT_FOUND:${key}`);
      continue;
    }
    if (bindingByEvidenceKey.has(key)) {
      blockers.push(`C3I_C2S_DUPLICATE_EVIDENCE_BINDING:${key}`);
      continue;
    }
    if (usedSourceRecordIds.has(sourceRecordId)) {
      blockers.push(`C3I_C2S_SOURCE_RECORD_REUSED:${sourceRecordId}`);
      continue;
    }

    bindingByEvidenceKey.set(key, sourceRecordId);
    usedSourceRecordIds.add(sourceRecordId);

    const expected = expectedEvidence.get(key);
    const sourceRecord = normalizedById.get(sourceRecordId);
    if (!sourceRecord) {
      blockers.push(`C3I_C2S_BOUND_SOURCE_RECORD_NOT_FOUND:${sourceRecordId}`);
      continue;
    }
    if (sourceRecord.authoritativeEvidenceEligible !== true || (sourceRecord.blockers || []).length > 0) {
      blockers.push(`C3I_C2S_BOUND_SOURCE_NOT_AUTHORITATIVE:${key}:${sourceRecordId}`);
    }

    const evidenceSourceId = cleanString(expected.record.sourceId);
    if (!evidenceSourceId || sourceRecord.sourceProvider !== evidenceSourceId) {
      blockers.push(`C3I_C2S_SOURCE_PROVIDER_MISMATCH:${key}:${sourceRecord.sourceProvider || 'MISSING'}/${evidenceSourceId || 'MISSING'}`);
    }

    const evidenceSourceReference = cleanString(expected.record.sourceReference);
    if (!evidenceSourceReference || sourceRecord.originalSourceReference !== evidenceSourceReference) {
      blockers.push(`C3I_C2S_SOURCE_REFERENCE_MISMATCH:${key}`);
    }

    const evidenceSourceUrl = normalizeSourceUrl(expected.record.sourceUrl);
    const provenanceSourceUrl = normalizeSourceUrl(sourceRecord.sourceUrl);
    if (!evidenceSourceUrl || !provenanceSourceUrl || provenanceSourceUrl !== evidenceSourceUrl) {
      blockers.push(`C3I_C2S_SOURCE_URL_MISMATCH:${key}`);
    }

    const expectedEvidenceHash = hashValue(expected.record);
    if (!expectedEvidenceHash || sourceRecord.evidenceHashSha256 !== expectedEvidenceHash) {
      blockers.push(`C3I_C2S_EVIDENCE_HASH_BINDING_MISMATCH:${key}`);
    }

    normalizedBindings.push(Object.freeze({
      evidenceDomain: domain,
      evidenceRecordId,
      sourceRecordId,
      evidenceHashSha256: expectedEvidenceHash,
      sourceProvider: sourceRecord.sourceProvider,
      underlyingAuthority: sourceRecord.underlyingAuthority,
    }));
  }

  for (const key of expectedEvidence.keys()) {
    if (!bindingByEvidenceKey.has(key)) blockers.push(`C3I_C2S_EVIDENCE_BINDING_REQUIRED:${key}`);
  }

  return Object.freeze({
    status: blockers.length ? 'HOLD' : 'READY',
    expectedEvidenceCount: expectedEvidence.size,
    boundEvidenceCount: normalizedBindings.length,
    bindings: freezeArray(normalizedBindings),
    blockers: freezeArray([...new Set(blockers)]),
  });
}

function heldResult(input, blockers, provenanceEvaluation = null, bindingEvaluation = null) {
  const uniqueBlockers = [...new Set(blockers)];
  return Object.freeze({
    version: C3I_C2S_GOVERNED_RECONCILIATION_VERSION,
    status: RECONCILIATION_GATE_STATUS.HOLD_EVIDENCE,
    decisionReady: false,
    propertyRef: cleanString(input && input.propertyRef) || null,
    valuationDate: cleanString(input && input.valuationDate) || null,
    valuationScope: cleanString(input && input.valuationScope) || null,
    sourceProvenanceReady: false,
    sourceProvenanceEvaluation: provenanceEvaluation,
    sourceProvenanceBindingEvaluation: bindingEvaluation,
    sourceProvenanceBundleHashSha256: provenanceEvaluation && provenanceEvaluation.bundleHashSha256 || null,
    candidateWeightedValueSar: null,
    analyticalValueIndicationSar: null,
    analyticalRangeLowSar: null,
    analyticalRangeHighSar: null,
    spreadRatio: null,
    analyticalConfidenceClass: RECONCILIATION_CONFIDENCE_CLASS.NOT_ESTABLISHED,
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    publicAiAuthorized: false,
    blockers: freezeArray(uniqueBlockers),
    semantics: 'C3I/C2S fails closed before valuation reconciliation when source provenance or exact evidence-to-provenance binding is not independently governed. No analytical value is emitted from a provenance-held request.',
  });
}

function evaluateC3IC2SGovernedReconciliation(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return heldResult({}, ['C3I_C2S_INPUT_OBJECT_REQUIRED']);
  }

  const packet = input.sourceProvenance;
  if (!packet || typeof packet !== 'object' || Array.isArray(packet)) {
    return heldResult(input, ['C3I_C2S_SOURCE_PROVENANCE_PACKET_REQUIRED']);
  }

  let provenanceEvaluation;
  try {
    provenanceEvaluation = evaluateSourceProvenanceBundle({
      records: packet.records,
      asOf: input.asOf,
      governedProfessionalProviders: packet.governedProfessionalProviders || {},
      trustedProvenanceVerifierIds: packet.trustedProvenanceVerifierIds || [],
      trustedLicenseVerifierIds: packet.trustedLicenseVerifierIds || [],
    });
  } catch (error) {
    return heldResult(input, [`C3I_C2S_SOURCE_PROVENANCE_EVALUATION_ERROR:${error && error.message ? error.message : 'UNKNOWN'}`]);
  }

  if (provenanceEvaluation.status !== SOURCE_PROVENANCE_GATE_STATUS.READY) {
    return heldResult(input, [
      'C3I_C2S_SOURCE_PROVENANCE_NOT_READY',
      ...(provenanceEvaluation.blockers || []).map((blocker) => `C3I_C2S_PROVENANCE:${blocker}`),
    ], provenanceEvaluation, null);
  }

  const bindingEvaluation = evaluateEvidenceBindings(input, provenanceEvaluation);
  if (bindingEvaluation.status !== 'READY') {
    return heldResult(input, [
      'C3I_C2S_SOURCE_PROVENANCE_BINDING_NOT_READY',
      ...bindingEvaluation.blockers,
    ], provenanceEvaluation, bindingEvaluation);
  }

  const reconciliation = evaluateValuationReconciliation(input);
  return Object.freeze({
    ...reconciliation,
    version: C3I_C2S_GOVERNED_RECONCILIATION_VERSION,
    sourceProvenanceReady: true,
    sourceProvenanceEvaluation: provenanceEvaluation,
    sourceProvenanceBindingEvaluation: bindingEvaluation,
    sourceProvenanceBundleHashSha256: provenanceEvaluation.bundleHashSha256,
    decisionReady: reconciliation.decisionReady === true,
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    publicAiAuthorized: false,
    semantics: `${reconciliation.semantics || ''} C3I/C2S additionally requires independently governed authoritative provenance and exact hash-bound source evidence for every C1/C2 record consumed by reconciliation.`,
  });
}

module.exports = {
  C3I_C2S_GOVERNED_RECONCILIATION_VERSION,
  EVIDENCE_DOMAIN,
  evaluateC3IC2SGovernedReconciliation,
};