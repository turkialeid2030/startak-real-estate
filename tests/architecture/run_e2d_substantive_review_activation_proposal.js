'use strict';

const assert = require('assert');
const crypto = require('crypto');
const e2dPolicy = require('../../governance/e2d-substantive-review-activation-proposal-policy-2026-09-08.json');
const e2cPolicy = require('../../governance/e2c-external-authority-validation-policy-2026-09-08.json');
const e2bRequirements = require('../../governance/e2b-external-review-evidence-requirements-2026-09-08.json');
const matrix = require('../../governance/saudi-legal-professional-applicability-candidates-2026-09-08.json');
const valuationEvidence = require('../../governance/official-valuation-standards-source-evidence-2026-09-08.json');
const saudiEvidence = require('../../governance/official-saudi-regulatory-source-evidence-2026-09-08.json');
const contextEvidence = require('../../governance/saudi-regulatory-context-source-evidence-2026-09-08.json');
const phase2Evidence = require('../../governance/official-standards-and-licensing-source-evidence-phase2-2026-09-08.json');
const { sha256 } = require('../../src/standards/standards-registry');
const {
  REVIEW_DISPOSITION,
  createSaudiApplicabilityReviewPacket,
  recordHumanReviewDisposition,
  verifyApplicabilityPacketIntegrity,
} = require('../../src/standards/saudi-legal-professional-applicability');
const {
  E2B_STATUS,
  createExternalReviewCredentialEvidenceEnvelope,
  verifyExternalEvidenceEnvelopeIntegrity,
} = require('../../src/standards/external-review-credential-evidence');
const {
  E2C_STATUS,
  VALIDATION_TYPE,
  ATTESTATION_RESULT,
  normalizeTrustedVerifierRegistry,
  createAttestationSigningPayload,
  createExternalAuthorityValidationPacket,
  verifyExternalAuthorityValidationPacketIntegrity,
} = require('../../src/standards/external-authority-validation');
const {
  E2D_STATUS,
  validatePolicy,
  createSubstantiveReviewActivationProposal,
  verifySubstantiveReviewActivationProposalIntegrity,
} = require('../../src/standards/substantive-review-activation-proposal');

let checks = 0;
function check(fn) { fn(); checks += 1; }

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

const h = (char) => char.repeat(64);
const registers = [valuationEvidence, saudiEvidence, contextEvidence, phase2Evidence];

check(() => assert.strictEqual(e2dPolicy.policyId, 'STARTAK-E2D-SUBSTANTIVE-REVIEW-ACTIVATION-PROPOSAL-POLICY-2026-09-08'));
check(() => assert.strictEqual(e2dPolicy.operatingMode, 'UNLICENSED_DECISION_SUPPORT'));
check(() => assert.strictEqual(e2dPolicy.productionSubstantiveReviewEvidencePresent, false));
check(() => assert.strictEqual(e2dPolicy.productionRuleActivationMappingApproved, false));
check(() => assert.strictEqual(e2dPolicy.automaticActivationAllowed, false));
check(() => assert.strictEqual(e2dPolicy.callerDeclaredActivationAuthorityAccepted, false));
check(() => assert.strictEqual(validatePolicy(e2dPolicy), true));
check(() => assert.strictEqual(e2dPolicy.allowedDispositionActions.APPLICABLE, 'PROPOSE_RULE_IMPLEMENTATION'));
check(() => assert.strictEqual(e2dPolicy.allowedDispositionActions.NOT_APPLICABLE, 'NO_ACTIVATION_PROPOSED'));

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).trim();
const registryInput = {
  registryId: 'E2D-TEST-TRUSTED-VERIFIER-REGISTRY',
  status: 'EXTERNALLY_GOVERNED',
  governanceOwnerRef: 'test-external-governance-owner',
  verifiers: [{
    verifierId: 'e2d-independent-verifier',
    verifierSubjectRef: 'e2d-independent-verifier-org',
    authorityClass: 'EXTERNAL_AUTHORITY_VALIDATION_PROVIDER',
    publicKeyPem,
    publicKeySha256: sha256(publicKeyPem),
    governanceEvidenceRef: 'test-external-governance-evidence',
    activeFrom: '2026-01-01T00:00:00+03:00',
    activeUntil: '2026-12-31T23:59:59+03:00',
  }],
};
const registry = normalizeTrustedVerifierRegistry(registryInput);
check(() => assert.strictEqual(/^[a-f0-9]{64}$/.test(registry.registryHashSha256), true));

function signAttestation(raw) {
  const payload = createAttestationSigningPayload(raw, e2cPolicy);
  const signatureBase64 = crypto.sign('RSA-SHA256', Buffer.from(stableStringify(payload), 'utf8'), privateKey).toString('base64');
  return { ...raw, signatureBase64 };
}

function buildChain(disposition, suffix) {
  const basePacket = createSaudiApplicabilityReviewPacket({
    reviewPacketId: `E2D-E2-${suffix}`,
    caseContext: {
      serviceModel: 'INTERNAL_DECISION_SUPPORT',
      professionalValuationRequested: false,
      professionalReportRequested: true,
      capitalMarketsContext: null,
      financingRegulatoryContext: null,
      collateralValuationContext: false,
      financialReportingPurpose: false,
      reportingFramework: null,
      transactionContext: null,
      personalDataProcessed: false,
      crossBorderPersonalDataProcessing: false,
      realEstateContributionContext: false,
      measurementStandardRequested: null,
      costFrameworkRequested: null,
      comparativeProfessionalReference: null,
      ricsContextRequested: false,
    },
    candidateMatrix: matrix,
    evidenceRegisters: registers,
    preparedByRef: 'e2-engineering-preparer',
    preparedAt: '2026-09-08T13:45:00+03:00',
  });
  assert.strictEqual(basePacket.triggeredCandidates.length, 1);
  assert.strictEqual(basePacket.triggeredCandidates[0].candidateId, 'E2-TAQEEM-REPORT-QA-004');

  const reviewEvidence = [{
    evidenceId: `REV-PRO-${suffix}`,
    candidateId: 'E2-TAQEEM-REPORT-QA-004',
    evidenceClass: 'PROFESSIONAL_REVIEW',
    reviewerRef: `reviewer-pro-${suffix}`,
    issuerOrFirmRef: `professional-firm-${suffix}`,
    artifactId: `professional-review-artifact-${suffix}`,
    artifactSha256: h('a'),
    scopeRef: `taqeem-report-qa-scope-${suffix}`,
    issuedAt: '2026-09-08T13:46:00+03:00',
    receivedAt: '2026-09-08T13:47:00+03:00',
  }];
  const credentialEvidence = [{
    credentialEvidenceId: `CRED-PRO-${suffix}`,
    subjectReviewerRef: `reviewer-pro-${suffix}`,
    authorityRef: `professional-register-${suffix}`,
    credentialClass: 'PROFESSIONAL_REVIEWER_CREDENTIAL_EVIDENCE',
    artifactId: `credential-artifact-${suffix}`,
    artifactSha256: h('b'),
    observedAt: '2026-09-08T13:48:00+03:00',
    verificationSourceRef: `professional-register-source-${suffix}`,
  }];

  const dispositionPacket = recordHumanReviewDisposition(basePacket, {
    candidateId: 'E2-TAQEEM-REPORT-QA-004',
    disposition,
    reviewerRef: `reviewer-pro-${suffix}`,
    reviewerAuthorityClaim: `professional-reviewer-claim-${suffix}`,
    evidenceRef: `REV-PRO-${suffix}`,
    reviewedAt: '2026-09-08T13:49:00+03:00',
  });

  const envelope = createExternalReviewCredentialEvidenceEnvelope({
    envelopeId: `E2D-E2B-${suffix}`,
    applicabilityPacket: dispositionPacket,
    requirements: e2bRequirements,
    reviewEvidence,
    credentialEvidence,
    preparedByRef: 'e2b-engineering-preparer',
    preparedAt: '2026-09-08T13:50:00+03:00',
  });
  assert.strictEqual(envelope.status, E2B_STATUS.READY_FOR_EXTERNAL_AUTHORITY_VALIDATION);

  const baseAttestation = {
    result: ATTESTATION_RESULT.VERIFIED,
    verifierId: 'e2d-independent-verifier',
    verifiedAt: '2026-09-08T13:51:00+03:00',
    expiresAt: '2026-12-31T23:59:59+03:00',
    signatureAlgorithm: 'RSA-SHA256',
  };
  const attestations = [
    signAttestation({
      ...baseAttestation,
      attestationId: `ATT-REV-${suffix}`,
      validationType: VALIDATION_TYPE.REVIEW_EVIDENCE_AUTHENTICITY,
      targetRef: `REV-PRO-${suffix}`,
      subjectArtifactSha256: h('a'),
      verificationSourceRef: `verification-source-review-${suffix}`,
      verificationArtifactSha256: sha256(`verify-review-${suffix}`),
    }),
    signAttestation({
      ...baseAttestation,
      attestationId: `ATT-CRED-${suffix}`,
      validationType: VALIDATION_TYPE.CREDENTIAL_AUTHENTICITY,
      targetRef: `CRED-PRO-${suffix}`,
      subjectArtifactSha256: h('b'),
      verificationSourceRef: `verification-source-credential-${suffix}`,
      verificationArtifactSha256: sha256(`verify-credential-${suffix}`),
    }),
    signAttestation({
      ...baseAttestation,
      attestationId: `ATT-AUTH-${suffix}`,
      validationType: VALIDATION_TYPE.REVIEWER_AUTHORITY,
      targetRef: `reviewer-pro-${suffix}`,
      linkedCredentialEvidenceId: `CRED-PRO-${suffix}`,
      subjectArtifactSha256: h('b'),
      verificationSourceRef: `verification-source-authority-${suffix}`,
      verificationArtifactSha256: sha256(`verify-authority-${suffix}`),
    }),
    signAttestation({
      ...baseAttestation,
      attestationId: `ATT-IND-${suffix}`,
      validationType: VALIDATION_TYPE.REVIEWER_INDEPENDENCE,
      targetRef: `reviewer-pro-${suffix}`,
      linkedCredentialEvidenceId: `CRED-PRO-${suffix}`,
      subjectArtifactSha256: h('b'),
      verificationSourceRef: `verification-source-independence-${suffix}`,
      verificationArtifactSha256: sha256(`verify-independence-${suffix}`),
    }),
  ];

  const authorityPacket = createExternalAuthorityValidationPacket({
    validationPacketId: `E2D-E2C-${suffix}`,
    externalEvidenceEnvelope: envelope,
    policy: e2cPolicy,
    trustedVerifierRegistry: registryInput,
    expectedTrustedRegistryHashSha256: registry.registryHashSha256,
    attestations,
    preparedByRef: 'e2c-engineering-preparer',
    preparedAt: '2026-09-08T13:52:00+03:00',
  });
  assert.strictEqual(authorityPacket.status, E2C_STATUS.AUTHORITY_VALIDATION_COMPLETE_PENDING_SUBSTANTIVE_REVIEW);
  return { basePacket, dispositionPacket, envelope, authorityPacket };
}

const applicable = buildChain(REVIEW_DISPOSITION.APPLICABLE, 'APP');
check(() => assert.strictEqual(verifyApplicabilityPacketIntegrity(applicable.dispositionPacket), true));
check(() => assert.strictEqual(applicable.dispositionPacket.allTriggeredCandidateDispositionsRecorded, true));
check(() => assert.strictEqual(verifyExternalEvidenceEnvelopeIntegrity(applicable.envelope), true));
check(() => assert.strictEqual(verifyExternalAuthorityValidationPacketIntegrity(applicable.authorityPacket), true));
check(() => assert.strictEqual(applicable.authorityPacket.externalAuthorityValidationComplete, true));

const waiting = createSubstantiveReviewActivationProposal({
  proposalId: 'E2D-PROPOSAL-WAITING',
  applicabilityPacket: applicable.dispositionPacket,
  externalEvidenceEnvelope: applicable.envelope,
  authorityValidationPacket: applicable.authorityPacket,
  policy: e2dPolicy,
  activationMappings: [],
  preparedByRef: 'e2d-preparer',
  preparedAt: '2026-09-08T13:55:00+03:00',
});
check(() => assert.strictEqual(waiting.status, E2D_STATUS.WAITING_FOR_ACTIVATION_MAPPING));
check(() => assert.strictEqual(waiting.substantiveReviewDispositionChainValidated, true));
check(() => assert.strictEqual(waiting.activationProposalPrepared, false));
check(() => assert.deepStrictEqual(waiting.missingActivationMappings, ['E2-TAQEEM-REPORT-QA-004']));
check(() => assert.strictEqual(verifySubstantiveReviewActivationProposalIntegrity(waiting), true));

const validMapping = [{
  candidateId: 'E2-TAQEEM-REPORT-QA-004',
  ruleSetId: 'RULESET-TAQEEM-REPORT-QA-PROPOSAL',
  proposedRuleRefs: ['RULE-REPORT-QA-COMPLETENESS', 'RULE-REPORT-QA-CLARITY'],
  implementationScopeRef: 'implementation-scope-report-qa',
  mappingEvidenceRef: 'mapping-review-evidence-report-qa',
  mappingArtifactSha256: h('c'),
  mappedByRef: 'implementation-governance-preparer',
  mappedAt: '2026-09-08T13:53:00+03:00',
}];

const ready = createSubstantiveReviewActivationProposal({
  proposalId: 'E2D-PROPOSAL-READY',
  applicabilityPacket: applicable.dispositionPacket,
  externalEvidenceEnvelope: applicable.envelope,
  authorityValidationPacket: applicable.authorityPacket,
  policy: e2dPolicy,
  activationMappings: validMapping,
  preparedByRef: 'e2d-preparer',
  preparedAt: '2026-09-08T13:55:00+03:00',
});
check(() => assert.strictEqual(ready.status, E2D_STATUS.ACTIVATION_PROPOSAL_READY_FOR_IMPLEMENTATION_GOVERNANCE));
check(() => assert.strictEqual(ready.activationProposals.length, 1));
check(() => assert.strictEqual(ready.activationProposals[0].candidateId, 'E2-TAQEEM-REPORT-QA-004'));
check(() => assert.strictEqual(ready.activationProposals[0].validatedHumanDisposition, REVIEW_DISPOSITION.APPLICABLE));
check(() => assert.strictEqual(ready.activationProposals[0].proposedAction, 'PROPOSE_RULE_IMPLEMENTATION'));
check(() => assert.strictEqual(ready.activationProposals[0].proposalOnly, true));
check(() => assert.strictEqual(ready.activationProposals[0].activationAuthorized, false));
check(() => assert.strictEqual(ready.substantiveReviewDispositionChainValidated, true));
check(() => assert.strictEqual(ready.activationProposalPrepared, true));
check(() => assert.strictEqual(ready.implementationGovernanceRequired, true));
check(() => assert.strictEqual(ready.standardsOrRulesActivated, false));
check(() => assert.strictEqual(ready.legalConclusionEstablished, false));
check(() => assert.strictEqual(ready.professionalApplicabilityEstablished, false));
check(() => assert.strictEqual(ready.formalStandardsConformanceEstablished, false));
check(() => assert.strictEqual(ready.saudiProfessionalLicensingEstablished, false));
check(() => assert.strictEqual(ready.certifiedValuationAuthorityEstablished, false));
check(() => assert.strictEqual(ready.externalIssuanceAuthorized, false));
check(() => assert.strictEqual(ready.releaseAuthorized, false));
check(() => assert.strictEqual(ready.mergeAuthorized, false));
check(() => assert.strictEqual(ready.deploymentAuthorized, false));
check(() => assert.strictEqual(ready.transactionAuthorized, false));
check(() => assert.strictEqual(verifySubstantiveReviewActivationProposalIntegrity(ready), true));

// Mapping for a non-triggered candidate fails closed.
const badCandidateMapping = [{ ...validMapping[0], candidateId: 'E2-NOT-TRIGGERED' }];
const heldMapping = createSubstantiveReviewActivationProposal({
  proposalId: 'E2D-HOLD-BAD-MAPPING',
  applicabilityPacket: applicable.dispositionPacket,
  externalEvidenceEnvelope: applicable.envelope,
  authorityValidationPacket: applicable.authorityPacket,
  policy: e2dPolicy,
  activationMappings: badCandidateMapping,
  preparedByRef: 'e2d-preparer',
  preparedAt: '2026-09-08T13:55:00+03:00',
});
check(() => assert.strictEqual(heldMapping.status, E2D_STATUS.HOLD_PROPOSAL_INTEGRITY));
check(() => assert.strictEqual(heldMapping.blockers.some((x) => x.startsWith('ACTIVATION_MAPPING_FOR_NON_TRIGGERED_CANDIDATE:')), true));
check(() => assert.strictEqual(heldMapping.proposalPacketHashSha256, null));

// Mapping before the human review is invalid.
const earlyMapping = [{ ...validMapping[0], mappedAt: '2026-09-08T13:48:30+03:00' }];
const heldEarly = createSubstantiveReviewActivationProposal({
  proposalId: 'E2D-HOLD-EARLY-MAPPING',
  applicabilityPacket: applicable.dispositionPacket,
  externalEvidenceEnvelope: applicable.envelope,
  authorityValidationPacket: applicable.authorityPacket,
  policy: e2dPolicy,
  activationMappings: earlyMapping,
  preparedByRef: 'e2d-preparer',
  preparedAt: '2026-09-08T13:55:00+03:00',
});
check(() => assert.strictEqual(heldEarly.status, E2D_STATUS.HOLD_PROPOSAL_INTEGRITY));
check(() => assert.strictEqual(heldEarly.blockers.includes('ACTIVATION_MAPPING_BEFORE_HUMAN_REVIEW:E2-TAQEEM-REPORT-QA-004'), true));

// Conditional review requires a conditions reference.
const conditional = buildChain(REVIEW_DISPOSITION.CONDITIONAL, 'COND');
const conditionalNoConditions = [{ ...validMapping[0], mappedAt: '2026-09-08T13:53:00+03:00' }];
const heldConditional = createSubstantiveReviewActivationProposal({
  proposalId: 'E2D-HOLD-CONDITIONAL',
  applicabilityPacket: conditional.dispositionPacket,
  externalEvidenceEnvelope: conditional.envelope,
  authorityValidationPacket: conditional.authorityPacket,
  policy: e2dPolicy,
  activationMappings: conditionalNoConditions,
  preparedByRef: 'e2d-preparer',
  preparedAt: '2026-09-08T13:55:00+03:00',
});
check(() => assert.strictEqual(heldConditional.status, E2D_STATUS.HOLD_PROPOSAL_INTEGRITY));
check(() => assert.strictEqual(heldConditional.blockers.includes('CONDITIONAL_ACTIVATION_MAPPING_CONDITIONS_REQUIRED:E2-TAQEEM-REPORT-QA-004'), true));

const conditionalMapping = [{ ...validMapping[0], conditionsRef: 'conditions-reviewed-by-human-professional', mappedAt: '2026-09-08T13:53:00+03:00' }];
const conditionalReady = createSubstantiveReviewActivationProposal({
  proposalId: 'E2D-CONDITIONAL-READY',
  applicabilityPacket: conditional.dispositionPacket,
  externalEvidenceEnvelope: conditional.envelope,
  authorityValidationPacket: conditional.authorityPacket,
  policy: e2dPolicy,
  activationMappings: conditionalMapping,
  preparedByRef: 'e2d-preparer',
  preparedAt: '2026-09-08T13:55:00+03:00',
});
check(() => assert.strictEqual(conditionalReady.status, E2D_STATUS.ACTIVATION_PROPOSAL_READY_FOR_IMPLEMENTATION_GOVERNANCE));
check(() => assert.strictEqual(conditionalReady.activationProposals[0].proposedAction, 'PROPOSE_CONDITIONAL_RULE_IMPLEMENTATION'));
check(() => assert.strictEqual(conditionalReady.activationProposals[0].conditionsRef, 'conditions-reviewed-by-human-professional'));
check(() => assert.strictEqual(conditionalReady.standardsOrRulesActivated, false));

// NOT_APPLICABLE produces an exclusion, not a rule implementation proposal.
const notApplicable = buildChain(REVIEW_DISPOSITION.NOT_APPLICABLE, 'NA');
const noActivation = createSubstantiveReviewActivationProposal({
  proposalId: 'E2D-NO-ACTIVATION',
  applicabilityPacket: notApplicable.dispositionPacket,
  externalEvidenceEnvelope: notApplicable.envelope,
  authorityValidationPacket: notApplicable.authorityPacket,
  policy: e2dPolicy,
  activationMappings: [],
  preparedByRef: 'e2d-preparer',
  preparedAt: '2026-09-08T13:55:00+03:00',
});
check(() => assert.strictEqual(noActivation.status, E2D_STATUS.NO_ACTIVATION_PROPOSED));
check(() => assert.strictEqual(noActivation.activationProposals.length, 0));
check(() => assert.strictEqual(noActivation.exclusions.length, 1));
check(() => assert.strictEqual(noActivation.exclusions[0].action, 'NO_ACTIVATION_PROPOSED'));
check(() => assert.strictEqual(noActivation.standardsOrRulesActivated, false));
check(() => assert.strictEqual(verifySubstantiveReviewActivationProposalIntegrity(noActivation), true));

// HOLD disposition blocks the proposal stage.
const holdChain = buildChain(REVIEW_DISPOSITION.HOLD, 'HOLD');
const substantiveHold = createSubstantiveReviewActivationProposal({
  proposalId: 'E2D-SUBSTANTIVE-HOLD',
  applicabilityPacket: holdChain.dispositionPacket,
  externalEvidenceEnvelope: holdChain.envelope,
  authorityValidationPacket: holdChain.authorityPacket,
  policy: e2dPolicy,
  activationMappings: [],
  preparedByRef: 'e2d-preparer',
  preparedAt: '2026-09-08T13:55:00+03:00',
});
check(() => assert.strictEqual(substantiveHold.status, E2D_STATUS.HOLD_SUBSTANTIVE_REVIEW));
check(() => assert.strictEqual(substantiveHold.blockers.includes('HUMAN_REVIEW_DISPOSITION_HOLD:E2-TAQEEM-REPORT-QA-004'), true));
check(() => assert.strictEqual(substantiveHold.activationProposalPrepared, false));

// Tampered E2C authority packet breaks the chain.
const tamperedAuthority = JSON.parse(JSON.stringify(applicable.authorityPacket));
tamperedAuthority.reviewerAuthorityValidated = false;
const heldAuthority = createSubstantiveReviewActivationProposal({
  proposalId: 'E2D-HOLD-TAMPERED-E2C',
  applicabilityPacket: applicable.dispositionPacket,
  externalEvidenceEnvelope: applicable.envelope,
  authorityValidationPacket: tamperedAuthority,
  policy: e2dPolicy,
  activationMappings: validMapping,
  preparedByRef: 'e2d-preparer',
  preparedAt: '2026-09-08T13:55:00+03:00',
});
check(() => assert.strictEqual(heldAuthority.status, E2D_STATUS.HOLD_E2C_AUTHORITY_VALIDATION));
check(() => assert.strictEqual(heldAuthority.blockers.includes('E2C_REQUIRED_AUTHORITY_GATES_NOT_ALL_TRUE'), true));
check(() => assert.strictEqual(heldAuthority.transactionAuthorized, false));

// Tampering with a completed E2D proposal is detectable.
const tamperedProposal = JSON.parse(JSON.stringify(ready));
tamperedProposal.activationProposals[0].ruleSetId = 'TAMPERED-RULESET';
check(() => assert.strictEqual(verifySubstantiveReviewActivationProposalIntegrity(tamperedProposal), false));

console.log(`E2D_SUBSTANTIVE_REVIEW_ACTIVATION_PROPOSAL=PASS checks=${checks}`);
