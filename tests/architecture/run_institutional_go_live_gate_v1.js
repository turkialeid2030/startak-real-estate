'use strict';

const assert = require('assert');
const {
  INSTITUTIONAL_GO_LIVE_STATUS: STATUS,
  buildInstitutionalGoLiveGate,
} = require('../../src/production-readiness/institutional-go-live-gate');

const scope = { caseId: 'CASE-GOLIVE-001', projectId: 'PROJECT-GOLIVE-001' };

function base() {
  const pilotRefs = ['evidence://pilot/1'];
  const regulatoryRefs = ['reviewer://regulatory/1', 'evidence://regulatory/review/1', 'evidence://regulatory/source/1'];
  const marketRefs = [
    'evidence://market/rent/1', 'reviewer://market/rent/1',
    'evidence://market/cap/1', 'reviewer://market/cap/1',
    'evidence://market/vacancy/1', 'reviewer://market/vacancy/1',
  ];
  const valuationRefs = [
    'evidence://valuation/startak/1',
    'evidence://valuation/comparator/1',
    'reviewer://valuation/1',
    'evidence://valuation/validation-report/1',
  ];
  const reviewPacketRefs = ['evidence://go-live/review-packet/1', 'reviewer://go-live/assembler/1'];

  return {
    ...scope,
    productionReadinessAudit: {
      ...scope,
      status: 'READY_FOR_PRODUCTION_REVIEW',
      readyForHumanProductionReview: true,
      productionDeploymentAuthorized: false,
      productionSecurityCertified: false,
      legalApprovalEstablished: false,
      humanApprovalRequired: true,
      transactionAuthorized: false,
    },
    pilotEvidencePack: {
      ...scope,
      status: 'EVIDENCE_PACK_COMPLETE',
      readyForProductionReadinessAudit: true,
      productionReady: false,
      transactionAuthorized: false,
      evidenceRefs: pilotRefs,
    },
    marketEvidenceAssessments: [{
      ...scope,
      status: 'QUALIFIED_FOR_ANALYTICAL_USE',
      analyticalUseAllowed: true,
      externalMarketTruthEstablished: false,
      certifiedValuationEstablished: false,
      humanReviewRequired: true,
      qualifiedEvidence: [
        { usage: 'MARKET_RENT', sourceRef: marketRefs[0], reviewerRef: marketRefs[1] },
        { usage: 'CAP_RATE', sourceRef: marketRefs[2], reviewerRef: marketRefs[3] },
        { usage: 'VACANCY', sourceRef: marketRefs[4], reviewerRef: marketRefs[5] },
      ],
    }],
    marketGovernancePolicy: {
      requiredMarketUsages: ['MARKET_RENT', 'CAP_RATE', 'VACANCY'],
    },
    externalValuationValidation: {
      status: 'VALIDATED_WITHIN_POLICY',
      validationPolicyPassed: true,
      certifiedValuationEstablished: false,
      productionDecisionAuthorized: false,
      humanReviewRequired: true,
      statisticalConfidenceEstablished: false,
      metrics: { observationCount: 1 },
      observations: [{
        startakEvidenceRef: valuationRefs[0],
        comparatorEvidenceRef: valuationRefs[1],
        reviewerRef: valuationRefs[2],
      }],
    },
    externalValidationEvidenceRef: valuationRefs[3],
    regulatoryClosure: {
      ...scope,
      status: 'EVIDENCE_PACK_COMPLETE',
      readyForProductionReadinessAudit: true,
      softwareDoesNotSelfEstablishLegalApproval: true,
      legalApprovalEstablished: false,
      productionDeploymentAuthorized: false,
      humanApprovalRequired: true,
      transactionAuthorized: false,
      evidenceRefs: regulatoryRefs,
    },
    reviewPacket: {
      packetRef: reviewPacketRefs[0],
      assembledByRef: reviewPacketRefs[1],
      assembledAt: '2026-09-01T14:30:00Z',
      humanDecisionRequired: true,
      noAutomatedGoLive: true,
    },
    evidenceRefs: [...pilotRefs, ...regulatoryRefs, ...marketRefs, ...valuationRefs, ...reviewPacketRefs],
  };
}

let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
  console.log(`PASS ${name}`);
}

check('complete evidence is ready only for human go-live decision', () => {
  const result = buildInstitutionalGoLiveGate(base());
  assert.strictEqual(result.status, STATUS.READY_FOR_HUMAN_GO_LIVE_DECISION);
  assert.strictEqual(result.readyForHumanGoLiveDecision, true);
  assert.strictEqual(result.goLiveAuthorized, false);
  assert.strictEqual(result.productionDeploymentAuthorized, false);
  assert.strictEqual(result.productionSecurityCertified, false);
  assert.strictEqual(result.legalApprovalEstablished, false);
  assert.strictEqual(result.certifiedValuationEstablished, false);
  assert.strictEqual(result.humanApprovalRequired, true);
  assert.strictEqual(result.transactionAuthorized, false);
});

check('scope mismatch fails closed', () => {
  const input = base();
  input.regulatoryClosure = { ...input.regulatoryClosure, caseId: 'OTHER' };
  assert.strictEqual(buildInstitutionalGoLiveGate(input).status, STATUS.HOLD_SCOPE);
});

check('production readiness is mandatory', () => {
  const input = base();
  input.productionReadinessAudit = { ...input.productionReadinessAudit, readyForHumanProductionReview: false };
  assert.strictEqual(buildInstitutionalGoLiveGate(input).status, STATUS.HOLD_PRODUCTION_READINESS);
});

check('pilot execution evidence is mandatory', () => {
  const input = base();
  input.pilotEvidencePack = { ...input.pilotEvidencePack, status: 'HOLD_EXECUTION_EVIDENCE' };
  assert.strictEqual(buildInstitutionalGoLiveGate(input).status, STATUS.HOLD_PILOT_EVIDENCE);
});

check('required market usage coverage is mandatory', () => {
  const input = base();
  input.marketGovernancePolicy = { requiredMarketUsages: ['MARKET_RENT', 'CAP_RATE', 'LAND_PRICE'] };
  assert.strictEqual(buildInstitutionalGoLiveGate(input).status, STATUS.HOLD_MARKET_EVIDENCE);
});

check('unqualified market assessment fails closed', () => {
  const input = base();
  input.marketEvidenceAssessments[0] = { ...input.marketEvidenceAssessments[0], status: 'HOLD_STALE' };
  assert.strictEqual(buildInstitutionalGoLiveGate(input).status, STATUS.HOLD_MARKET_EVIDENCE);
});

check('external valuation validation is mandatory', () => {
  const input = base();
  input.externalValuationValidation = { ...input.externalValuationValidation, status: 'HOLD_THRESHOLD', validationPolicyPassed: false };
  assert.strictEqual(buildInstitutionalGoLiveGate(input).status, STATUS.HOLD_VALUATION_VALIDATION);
});

check('regulatory closure is mandatory', () => {
  const input = base();
  input.regulatoryClosure = { ...input.regulatoryClosure, status: 'HOLD_AUTHORIZATION', readyForProductionReadinessAudit: false };
  assert.strictEqual(buildInstitutionalGoLiveGate(input).status, STATUS.HOLD_REGULATORY_CLOSURE);
});

check('human review packet cannot authorize go-live automatically', () => {
  const input = base();
  input.reviewPacket = { ...input.reviewPacket, noAutomatedGoLive: false };
  assert.strictEqual(buildInstitutionalGoLiveGate(input).status, STATUS.HOLD_REVIEW_PACKET);
});

check('evidence chain must contain all source and reviewer refs', () => {
  const input = base();
  input.evidenceRefs = input.evidenceRefs.filter((ref) => ref !== 'evidence://valuation/comparator/1');
  assert.strictEqual(buildInstitutionalGoLiveGate(input).status, STATUS.HOLD_EVIDENCE_CHAIN);
});

check('missing caller market policy fails closed', () => {
  const input = base();
  input.marketGovernancePolicy = null;
  assert.strictEqual(buildInstitutionalGoLiveGate(input).status, STATUS.HOLD_MARKET_EVIDENCE);
});

console.log(`INSTITUTIONAL_GO_LIVE_GATE_V1=PASS checks=${checks}`);
