'use strict';

const INSTITUTIONAL_GO_LIVE_STATUS = Object.freeze({
  READY_FOR_HUMAN_GO_LIVE_DECISION: 'READY_FOR_HUMAN_GO_LIVE_DECISION',
  HOLD_SCOPE: 'HOLD_SCOPE',
  HOLD_PRODUCTION_READINESS: 'HOLD_PRODUCTION_READINESS',
  HOLD_PILOT_EVIDENCE: 'HOLD_PILOT_EVIDENCE',
  HOLD_MARKET_EVIDENCE: 'HOLD_MARKET_EVIDENCE',
  HOLD_VALUATION_VALIDATION: 'HOLD_VALUATION_VALIDATION',
  HOLD_REGULATORY_CLOSURE: 'HOLD_REGULATORY_CLOSURE',
  HOLD_REVIEW_PACKET: 'HOLD_REVIEW_PACKET',
  HOLD_EVIDENCE_CHAIN: 'HOLD_EVIDENCE_CHAIN',
});

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isIsoDate(value) {
  return nonEmptyString(value) && Number.isFinite(Date.parse(value));
}

function cleanRefs(refs) {
  return Array.isArray(refs) ? [...new Set(refs.filter(nonEmptyString).map((ref) => ref.trim()))] : [];
}

function hold(status, reasons, context = {}, gates = {}) {
  return {
    caseId: context.caseId || null,
    projectId: context.projectId || null,
    status,
    reasons,
    gates,
    readyForHumanGoLiveDecision: false,
    goLiveAuthorized: false,
    productionDeploymentAuthorized: false,
    productionSecurityCertified: false,
    legalApprovalEstablished: false,
    certifiedValuationEstablished: false,
    humanApprovalRequired: true,
    transactionAuthorized: false,
  };
}

function qualifiedMarketUsages(marketEvidenceAssessments) {
  const usages = new Set();
  for (const assessment of marketEvidenceAssessments) {
    for (const item of assessment?.qualifiedEvidence || []) {
      if (nonEmptyString(item?.usage)) usages.add(item.usage.trim());
    }
  }
  return usages;
}

function collectEvidenceRefs({
  pilotEvidencePack,
  regulatoryClosure,
  marketEvidenceAssessments,
  externalValuationValidation,
  externalValidationEvidenceRef,
  reviewPacket,
}) {
  const refs = [];
  refs.push(...(pilotEvidencePack?.evidenceRefs || []));
  refs.push(...(regulatoryClosure?.evidenceRefs || []));
  for (const assessment of marketEvidenceAssessments || []) {
    for (const item of assessment?.qualifiedEvidence || []) {
      if (item?.sourceRef) refs.push(item.sourceRef);
      if (item?.reviewerRef) refs.push(item.reviewerRef);
    }
  }
  for (const observation of externalValuationValidation?.observations || []) {
    if (observation?.startakEvidenceRef) refs.push(observation.startakEvidenceRef);
    if (observation?.comparatorEvidenceRef) refs.push(observation.comparatorEvidenceRef);
    if (observation?.reviewerRef) refs.push(observation.reviewerRef);
  }
  if (externalValidationEvidenceRef) refs.push(externalValidationEvidenceRef);
  if (reviewPacket?.packetRef) refs.push(reviewPacket.packetRef);
  if (reviewPacket?.assembledByRef) refs.push(reviewPacket.assembledByRef);
  return cleanRefs(refs);
}

function buildInstitutionalGoLiveGate({
  caseId,
  projectId,
  productionReadinessAudit,
  pilotEvidencePack,
  marketEvidenceAssessments = [],
  marketGovernancePolicy,
  externalValuationValidation,
  externalValidationEvidenceRef,
  regulatoryClosure,
  reviewPacket,
  evidenceRefs = [],
}) {
  const context = { caseId, projectId };
  if (!nonEmptyString(caseId) || !nonEmptyString(projectId)) {
    return hold(INSTITUTIONAL_GO_LIVE_STATUS.HOLD_SCOPE, ['caseId/projectId required'], context);
  }

  const scoped = [productionReadinessAudit, pilotEvidencePack, regulatoryClosure, ...(marketEvidenceAssessments || [])]
    .filter(Boolean)
    .every((item) => item.caseId === caseId && item.projectId === projectId);
  if (!scoped) return hold(INSTITUTIONAL_GO_LIVE_STATUS.HOLD_SCOPE, ['scope mismatch'], context);

  const productionReadinessReady =
    productionReadinessAudit?.status === 'READY_FOR_PRODUCTION_REVIEW' &&
    productionReadinessAudit?.readyForHumanProductionReview === true &&
    productionReadinessAudit?.productionDeploymentAuthorized === false &&
    productionReadinessAudit?.productionSecurityCertified === false &&
    productionReadinessAudit?.legalApprovalEstablished === false &&
    productionReadinessAudit?.humanApprovalRequired === true &&
    productionReadinessAudit?.transactionAuthorized === false;

  const pilotReady =
    pilotEvidencePack?.status === 'EVIDENCE_PACK_COMPLETE' &&
    pilotEvidencePack?.readyForProductionReadinessAudit === true &&
    pilotEvidencePack?.productionReady === false &&
    pilotEvidencePack?.transactionAuthorized === false;

  const marketPolicyValid =
    marketGovernancePolicy &&
    Array.isArray(marketGovernancePolicy.requiredMarketUsages) &&
    marketGovernancePolicy.requiredMarketUsages.length > 0 &&
    marketGovernancePolicy.requiredMarketUsages.every(nonEmptyString);
  const marketAssessmentsValid =
    Array.isArray(marketEvidenceAssessments) &&
    marketEvidenceAssessments.length > 0 &&
    marketEvidenceAssessments.every((assessment) =>
      assessment?.status === 'QUALIFIED_FOR_ANALYTICAL_USE' &&
      assessment?.analyticalUseAllowed === true &&
      assessment?.externalMarketTruthEstablished === false &&
      assessment?.certifiedValuationEstablished === false &&
      assessment?.humanReviewRequired === true,
    );
  const usageSet = qualifiedMarketUsages(marketEvidenceAssessments);
  const requiredUsagesCovered = marketPolicyValid && marketGovernancePolicy.requiredMarketUsages.every((usage) => usageSet.has(usage));
  const marketReady = marketPolicyValid && marketAssessmentsValid && requiredUsagesCovered;

  const valuationValidationReady =
    externalValuationValidation?.status === 'VALIDATED_WITHIN_POLICY' &&
    externalValuationValidation?.validationPolicyPassed === true &&
    externalValuationValidation?.certifiedValuationEstablished === false &&
    externalValuationValidation?.productionDecisionAuthorized === false &&
    externalValuationValidation?.humanReviewRequired === true &&
    externalValuationValidation?.statisticalConfidenceEstablished === false &&
    Number.isInteger(externalValuationValidation?.metrics?.observationCount) &&
    externalValuationValidation.metrics.observationCount > 0 &&
    nonEmptyString(externalValidationEvidenceRef);

  const regulatoryReady =
    regulatoryClosure?.status === 'EVIDENCE_PACK_COMPLETE' &&
    regulatoryClosure?.readyForProductionReadinessAudit === true &&
    regulatoryClosure?.softwareDoesNotSelfEstablishLegalApproval === true &&
    regulatoryClosure?.legalApprovalEstablished === false &&
    regulatoryClosure?.productionDeploymentAuthorized === false &&
    regulatoryClosure?.humanApprovalRequired === true &&
    regulatoryClosure?.transactionAuthorized === false;

  const reviewPacketReady =
    reviewPacket &&
    nonEmptyString(reviewPacket.packetRef) &&
    nonEmptyString(reviewPacket.assembledByRef) &&
    isIsoDate(reviewPacket.assembledAt) &&
    reviewPacket.humanDecisionRequired === true &&
    reviewPacket.noAutomatedGoLive === true;

  const gates = {
    productionReadiness: productionReadinessReady,
    pilotEvidence: pilotReady,
    marketEvidence: marketReady,
    valuationValidation: valuationValidationReady,
    regulatoryClosure: regulatoryReady,
    reviewPacket: reviewPacketReady,
  };

  if (!productionReadinessReady) return hold(INSTITUTIONAL_GO_LIVE_STATUS.HOLD_PRODUCTION_READINESS, ['production-readiness audit is not ready for human review'], context, gates);
  if (!pilotReady) return hold(INSTITUTIONAL_GO_LIVE_STATUS.HOLD_PILOT_EVIDENCE, ['controlled-pilot execution evidence is incomplete'], context, gates);
  if (!marketReady) return hold(INSTITUTIONAL_GO_LIVE_STATUS.HOLD_MARKET_EVIDENCE, ['market evidence qualification or required-usage coverage is incomplete under caller policy'], context, gates);
  if (!valuationValidationReady) return hold(INSTITUTIONAL_GO_LIVE_STATUS.HOLD_VALUATION_VALIDATION, ['external valuation validation evidence is incomplete or outside caller policy'], context, gates);
  if (!regulatoryReady) return hold(INSTITUTIONAL_GO_LIVE_STATUS.HOLD_REGULATORY_CLOSURE, ['regulatory closure evidence is incomplete'], context, gates);
  if (!reviewPacketReady) return hold(INSTITUTIONAL_GO_LIVE_STATUS.HOLD_REVIEW_PACKET, ['human go-live review packet metadata is incomplete'], context, gates);

  const suppliedRefs = cleanRefs(evidenceRefs);
  const requiredRefs = collectEvidenceRefs({
    pilotEvidencePack,
    regulatoryClosure,
    marketEvidenceAssessments,
    externalValuationValidation,
    externalValidationEvidenceRef,
    reviewPacket,
  });
  const missingRefs = requiredRefs.filter((ref) => !suppliedRefs.includes(ref));
  if (missingRefs.length > 0) {
    return hold(INSTITUTIONAL_GO_LIVE_STATUS.HOLD_EVIDENCE_CHAIN, ['institutional go-live evidence chain is incomplete'], context, gates);
  }

  return {
    caseId,
    projectId,
    status: INSTITUTIONAL_GO_LIVE_STATUS.READY_FOR_HUMAN_GO_LIVE_DECISION,
    reasons: [],
    gates,
    requiredMarketUsages: [...marketGovernancePolicy.requiredMarketUsages],
    qualifiedMarketUsages: [...usageSet],
    externalValidationObservationCount: externalValuationValidation.metrics.observationCount,
    reviewPacket: {
      packetRef: reviewPacket.packetRef.trim(),
      assembledByRef: reviewPacket.assembledByRef.trim(),
      assembledAt: reviewPacket.assembledAt,
    },
    evidenceRefs: suppliedRefs,
    readyForHumanGoLiveDecision: true,
    goLiveAuthorized: false,
    productionDeploymentAuthorized: false,
    productionSecurityCertified: false,
    legalApprovalEstablished: false,
    certifiedValuationEstablished: false,
    humanApprovalRequired: true,
    transactionAuthorized: false,
    semantics: 'READY_FOR_HUMAN_GO_LIVE_DECISION means the supplied readiness, pilot, market-evidence, external-validation, regulatory, and review-packet evidence passed deterministic completeness checks. It is not production authorization, security certification, legal approval, certified valuation, statistical guarantee, or transaction authorization. A separate human go-live decision is required.',
  };
}

module.exports = {
  INSTITUTIONAL_GO_LIVE_STATUS,
  buildInstitutionalGoLiveGate,
};
