'use strict';

const {
  AUTHORITY_CLASS,
  TRUTH_STATUS,
  VERIFICATION_STATUS,
  READINESS_STATUS,
  deepFreeze,
  verifyEvidenceFact,
} = require('./contracts');
const { reconcileEvidenceFacts } = require('./reconciliation');
const { assessDecisionReadiness } = require('./readiness');

const EVIDENCE_VERIFICATION_GATE_STATUS = Object.freeze({
  READY_FOR_HUMAN_VERIFICATION_DECISION: 'READY_FOR_HUMAN_VERIFICATION_DECISION',
  HOLD_CANDIDATE: 'HOLD_CANDIDATE',
  HOLD_ATTESTATION: 'HOLD_ATTESTATION',
  HOLD_TIMELINE: 'HOLD_TIMELINE',
  HOLD_EVIDENCE_CHAIN: 'HOLD_EVIDENCE_CHAIN',
});

const EVIDENCE_VERIFICATION_OUTCOME = Object.freeze({
  VERIFY_FACT: 'VERIFY_FACT',
  REJECT_CANDIDATE: 'REJECT_CANDIDATE',
  DEFER: 'DEFER',
});

const EVIDENCE_VERIFICATION_DECISION_STATUS = Object.freeze({
  DECISION_RECORDED: 'DECISION_RECORDED',
  HOLD_GATE: 'HOLD_GATE',
  HOLD_DECISION: 'HOLD_DECISION',
  HOLD_TIMELINE: 'HOLD_TIMELINE',
  HOLD_ACKNOWLEDGEMENTS: 'HOLD_ACKNOWLEDGEMENTS',
  HOLD_EVIDENCE_CHAIN: 'HOLD_EVIDENCE_CHAIN',
});

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isoTimestamp(value) {
  if (!nonEmptyString(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : Object.freeze({ canonical: date.toISOString(), epochMs: date.getTime() });
}

function cleanRefs(refs) {
  return Array.isArray(refs) ? [...new Set(refs.filter(nonEmptyString).map((ref) => ref.trim()))] : [];
}

function gateHold(status, reasons, context = {}) {
  return Object.freeze({
    schemaVersion: 1,
    status,
    reasons: Object.freeze(reasons),
    caseId: context.caseId || null,
    documentId: context.documentId || null,
    factId: context.factId || null,
    readyForHumanVerificationDecision: false,
    verifiedFactEstablished: false,
    readyForUnderwritingInput: false,
    financialEngineEligible: false,
    authorityVerifiedByThisModule: false,
    externalCertificationEstablished: false,
    transactionAuthorized: false,
  });
}

function decisionHold(status, reasons, context = {}) {
  return Object.freeze({
    schemaVersion: 1,
    status,
    reasons: Object.freeze(reasons),
    caseId: context.caseId || null,
    documentId: context.documentId || null,
    factId: context.factId || null,
    humanVerificationDecisionRecorded: false,
    verifiedFact: null,
    verifiedFactEstablished: false,
    readyForUnderwritingInput: false,
    financialEngineEligible: false,
    externalCertificationEstablished: false,
    transactionAuthorized: false,
  });
}

function buildEvidenceVerificationGate({ candidate, verificationAttestation, evidenceRefs = [] } = {}) {
  const context = {
    caseId: candidate?.caseId,
    documentId: candidate?.documentId,
    factId: candidate?.fact?.factId,
  };

  const candidateValid = candidate
    && candidate.status === 'CANDIDATE_REQUIRES_VERIFICATION'
    && candidate.fact
    && candidate.fact.caseId === candidate.caseId
    && candidate.fact.documentId === candidate.documentId
    && candidate.fact.documentHashSha256 === candidate.documentHashSha256
    && candidate.fact.truthStatus === TRUTH_STATUS.EXTRACTED_EVIDENCE
    && candidate.fact.verification?.status === VERIFICATION_STATUS.NOT_VERIFIED
    && candidate.authorityVerified === false
    && candidate.readyForUnderwritingInput === false
    && candidate.financialEngineEligible === false
    && candidate.transactionAuthorized === false;
  if (!candidateValid) {
    return gateHold(EVIDENCE_VERIFICATION_GATE_STATUS.HOLD_CANDIDATE, ['a bounded EXTRACTED_EVIDENCE candidate in the same case/document is required'], context);
  }

  const verifiedAt = isoTimestamp(verificationAttestation?.verifiedAt);
  const allowedAuthorityClasses = Object.values(AUTHORITY_CLASS).filter((value) => value !== AUTHORITY_CLASS.UNKNOWN);
  const attestationValid = verificationAttestation
    && nonEmptyString(verificationAttestation.attestationId)
    && nonEmptyString(verificationAttestation.verifierRef)
    && nonEmptyString(verificationAttestation.verifierRole)
    && nonEmptyString(verificationAttestation.verifierIdentityEvidenceRef)
    && nonEmptyString(verificationAttestation.verificationMethod)
    && nonEmptyString(verificationAttestation.verificationReference)
    && allowedAuthorityClasses.includes(verificationAttestation.authorityClass)
    && nonEmptyString(verificationAttestation.authorityEvidenceRef)
    && verificationAttestation.sourceCheckedAgainstOriginal === true
    && verificationAttestation.semanticMappingReviewed === true
    && verificationAttestation.conflictDeclarationCompleted === true
    && verifiedAt;
  if (!attestationValid) {
    return gateHold(
      EVIDENCE_VERIFICATION_GATE_STATUS.HOLD_ATTESTATION,
      ['verification attestation requires verifier identity evidence, method/reference, non-UNKNOWN authority classification with authority evidence, original-source check, semantic review, conflict declaration, and timezone-valid verifiedAt'],
      context,
    );
  }

  const candidateCapturedAt = isoTimestamp(candidate.fact.capturedAt);
  if (!candidateCapturedAt || verifiedAt.epochMs < candidateCapturedAt.epochMs) {
    return gateHold(EVIDENCE_VERIFICATION_GATE_STATUS.HOLD_TIMELINE, ['verification cannot predate the extracted evidence candidate'], context);
  }

  const suppliedRefs = cleanRefs(evidenceRefs);
  const requiredRefs = cleanRefs([
    candidate.sourceProvenance?.sourceReference,
    candidate.sourceProvenance?.reviewerRef,
    verificationAttestation.verifierRef,
    verificationAttestation.verifierIdentityEvidenceRef,
    verificationAttestation.verificationReference,
    verificationAttestation.authorityEvidenceRef,
  ]);
  const missingRefs = requiredRefs.filter((ref) => !suppliedRefs.includes(ref));
  if (!suppliedRefs.length || missingRefs.length) {
    return gateHold(EVIDENCE_VERIFICATION_GATE_STATUS.HOLD_EVIDENCE_CHAIN, ['verification evidence-reference chain is incomplete'], context);
  }

  return Object.freeze({
    schemaVersion: 1,
    status: EVIDENCE_VERIFICATION_GATE_STATUS.READY_FOR_HUMAN_VERIFICATION_DECISION,
    reasons: Object.freeze([]),
    caseId: candidate.caseId,
    documentId: candidate.documentId,
    factId: candidate.fact.factId,
    candidate,
    verificationAttestation: Object.freeze({
      attestationId: verificationAttestation.attestationId.trim(),
      verifierRef: verificationAttestation.verifierRef.trim(),
      verifierRole: verificationAttestation.verifierRole.trim(),
      verifierIdentityEvidenceRef: verificationAttestation.verifierIdentityEvidenceRef.trim(),
      verificationMethod: verificationAttestation.verificationMethod.trim(),
      verificationReference: verificationAttestation.verificationReference.trim(),
      authorityClass: verificationAttestation.authorityClass,
      authorityEvidenceRef: verificationAttestation.authorityEvidenceRef.trim(),
      verifiedAt: verifiedAt.canonical,
      sourceCheckedAgainstOriginal: true,
      semanticMappingReviewed: true,
      conflictDeclarationCompleted: true,
    }),
    evidenceRefs: Object.freeze(suppliedRefs),
    readyForHumanVerificationDecision: true,
    verifiedFactEstablished: false,
    readyForUnderwritingInput: false,
    financialEngineEligible: false,
    authorityVerifiedByThisModule: false,
    externalCertificationEstablished: false,
    transactionAuthorized: false,
    semantics: 'READY_FOR_HUMAN_VERIFICATION_DECISION means the caller supplied a complete verification packet and evidence-reference chain. It does not itself verify the fact, authenticate the verifier, certify source authority, establish legal/certified status, make the fact ready for underwriting, or authorize a transaction. A separate accountable human verification decision is required.',
  });
}

function recordEvidenceVerificationDecision({ gate, decision, evidenceRefs = [] } = {}) {
  const context = { caseId: gate?.caseId, documentId: gate?.documentId, factId: gate?.factId };
  const gateValid = gate
    && gate.status === EVIDENCE_VERIFICATION_GATE_STATUS.READY_FOR_HUMAN_VERIFICATION_DECISION
    && gate.readyForHumanVerificationDecision === true
    && gate.verifiedFactEstablished === false
    && gate.readyForUnderwritingInput === false
    && gate.transactionAuthorized === false;
  if (!gateValid) {
    return decisionHold(EVIDENCE_VERIFICATION_DECISION_STATUS.HOLD_GATE, ['complete verification gate is required'], context);
  }

  const decidedAt = isoTimestamp(decision?.decidedAt);
  const decisionValid = decision
    && nonEmptyString(decision.decisionId)
    && nonEmptyString(decision.decidedByRef)
    && nonEmptyString(decision.decisionEvidenceRef)
    && Object.values(EVIDENCE_VERIFICATION_OUTCOME).includes(decision.outcome)
    && decision.conflictDeclarationCompleted === true
    && decidedAt;
  if (!decisionValid) {
    return decisionHold(EVIDENCE_VERIFICATION_DECISION_STATUS.HOLD_DECISION, ['human decision identity, outcome, evidence reference, conflict declaration, and valid decidedAt are required'], context);
  }

  const verifiedAt = isoTimestamp(gate.verificationAttestation?.verifiedAt);
  if (!verifiedAt || decidedAt.epochMs < verifiedAt.epochMs) {
    return decisionHold(EVIDENCE_VERIFICATION_DECISION_STATUS.HOLD_TIMELINE, ['human verification decision cannot predate the verification attestation'], context);
  }

  const acknowledgements = decision.acknowledgements || {};
  const keys = ['sourceReferenceReviewed', 'semanticMappingReviewed', 'authorityEvidenceReviewed', 'verificationMethodReviewed', 'humanAccountabilityAccepted'];
  if (!keys.every((key) => acknowledgements[key] === true)) {
    return decisionHold(EVIDENCE_VERIFICATION_DECISION_STATUS.HOLD_ACKNOWLEDGEMENTS, ['all verification-decision acknowledgements are required'], context);
  }

  const suppliedRefs = cleanRefs(evidenceRefs);
  const requiredRefs = cleanRefs([
    ...(gate.evidenceRefs || []),
    decision.decidedByRef,
    decision.decisionEvidenceRef,
  ]);
  const missingRefs = requiredRefs.filter((ref) => !suppliedRefs.includes(ref));
  if (!suppliedRefs.length || missingRefs.length) {
    return decisionHold(EVIDENCE_VERIFICATION_DECISION_STATUS.HOLD_EVIDENCE_CHAIN, ['human verification decision evidence chain is incomplete'], context);
  }

  let verifiedFact = null;
  if (decision.outcome === EVIDENCE_VERIFICATION_OUTCOME.VERIFY_FACT) {
    const promoted = verifyEvidenceFact(gate.candidate.fact, {
      verificationMethod: gate.verificationAttestation.verificationMethod,
      verifierType: gate.verificationAttestation.verifierRole,
      verificationReference: gate.verificationAttestation.verificationReference,
      verifiedAt: gate.verificationAttestation.verifiedAt,
    });
    verifiedFact = deepFreeze({
      ...promoted,
      authorityClass: gate.verificationAttestation.authorityClass,
      authorityVerified: true,
      authorityVerification: {
        evidenceRef: gate.verificationAttestation.authorityEvidenceRef,
        reviewedByRef: decision.decidedByRef.trim(),
        decisionEvidenceRef: decision.decisionEvidenceRef.trim(),
        decidedAt: decidedAt.canonical,
      },
    });
  }

  return Object.freeze({
    schemaVersion: 1,
    status: EVIDENCE_VERIFICATION_DECISION_STATUS.DECISION_RECORDED,
    reasons: Object.freeze([]),
    caseId: gate.caseId,
    documentId: gate.documentId,
    factId: gate.factId,
    decision: Object.freeze({
      decisionId: decision.decisionId.trim(),
      outcome: decision.outcome,
      decidedByRef: decision.decidedByRef.trim(),
      decisionEvidenceRef: decision.decisionEvidenceRef.trim(),
      decidedAt: decidedAt.canonical,
      conflictDeclarationCompleted: true,
      acknowledgements: Object.freeze(Object.fromEntries(keys.map((key) => [key, true]))),
    }),
    evidenceRefs: Object.freeze(suppliedRefs),
    humanVerificationDecisionRecorded: true,
    verifiedFact,
    verifiedFactEstablished: Boolean(verifiedFact),
    rejectedCandidate: decision.outcome === EVIDENCE_VERIFICATION_OUTCOME.REJECT_CANDIDATE,
    deferredCandidate: decision.outcome === EVIDENCE_VERIFICATION_OUTCOME.DEFER,
    readyForUnderwritingInput: false,
    financialEngineEligible: false,
    externalCertificationEstablished: false,
    transactionAuthorized: false,
    semantics: 'A VERIFY_FACT outcome records an accountable human verification decision inside this evidence system using caller-supplied verification and authority evidence. It is not an external certification, licensed valuation, legal opinion, or automatic underwriting approval. Readiness remains a separate policy gate and financial-engine adoption remains separate and explicit.',
  });
}

function assessVerificationRecordsForUnderwriting({ caseId, verificationRecords, requirements, numericToleranceByKey = {} } = {}) {
  if (!nonEmptyString(caseId)) throw new TypeError('caseId is required');
  if (!Array.isArray(verificationRecords)) throw new TypeError('verificationRecords must be an array');
  if (!Array.isArray(requirements) || requirements.length === 0) throw new TypeError('requirements must be a non-empty caller-supplied array');

  const facts = verificationRecords
    .filter((record) => record && record.caseId === caseId && record.verifiedFactEstablished === true && record.verifiedFact)
    .map((record) => record.verifiedFact);
  const foreignRecord = verificationRecords.find((record) => record && record.caseId && record.caseId !== caseId);
  if (foreignRecord) throw new TypeError('CASE_ISOLATION_VIOLATION: verification records from another case are not allowed');

  const keys = [...new Set(requirements.map((requirement) => requirement?.key).filter(nonEmptyString))];
  const reconciliations = reconcileEvidenceFacts(facts, { caseId, keys, numericToleranceByKey });
  const baseReadiness = assessDecisionReadiness({ caseId, reconciliations, requirements });

  const authorityBlockers = [];
  const authorityChecks = [];
  for (const requirement of requirements) {
    if (!requirement || !nonEmptyString(requirement.key)) continue;
    const allowed = Array.isArray(requirement.allowedAuthorityClasses)
      ? [...new Set(requirement.allowedAuthorityClasses)]
      : [];
    if (allowed.some((value) => !Object.values(AUTHORITY_CLASS).includes(value) || value === AUTHORITY_CLASS.UNKNOWN)) {
      throw new TypeError(`invalid allowedAuthorityClasses for ${requirement.key}`);
    }
    const matching = facts.filter((fact) => fact.key === requirement.key);
    const authoritySatisfied = allowed.length === 0
      ? true
      : matching.some((fact) => fact.authorityVerified === true && allowed.includes(fact.authorityClass));
    if (!authoritySatisfied) authorityBlockers.push({ key: requirement.key, code: 'REQUIRED_AUTHORITY_CLASS_NOT_VERIFIED' });
    authorityChecks.push({ key: requirement.key, allowedAuthorityClasses: allowed, satisfied: authoritySatisfied });
  }

  const blockers = [...baseReadiness.blockers, ...authorityBlockers];
  const status = blockers.length ? READINESS_STATUS.HOLD_EVIDENCE : READINESS_STATUS.READY_FOR_UNDERWRITING_INPUT;
  return deepFreeze({
    schemaVersion: 1,
    caseId,
    status,
    blockers,
    checks: baseReadiness.checks,
    authorityChecks,
    reconciliations,
    verifiedFactCount: facts.length,
    readyForUnderwritingInput: status === READINESS_STATUS.READY_FOR_UNDERWRITING_INPUT,
    financialEngineInputsWritten: false,
    financialEngineEligible: status === READINESS_STATUS.READY_FOR_UNDERWRITING_INPUT,
    automaticFinancialEngineAdoption: false,
    transactionAuthorized: false,
    semantics: 'READY_FOR_UNDERWRITING_INPUT means caller-supplied evidence requirements, reconciliation rules, verified-fact requirements, and any declared authority-class requirements are satisfied. It does not write or overwrite financial inputs. A separate explicit human adoption step with versioned traceability remains required.',
  });
}

module.exports = {
  EVIDENCE_VERIFICATION_GATE_STATUS,
  EVIDENCE_VERIFICATION_OUTCOME,
  EVIDENCE_VERIFICATION_DECISION_STATUS,
  buildEvidenceVerificationGate,
  recordEvidenceVerificationDecision,
  assessVerificationRecordsForUnderwriting,
};
