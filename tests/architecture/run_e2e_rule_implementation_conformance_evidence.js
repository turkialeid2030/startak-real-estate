'use strict';

const assert = require('assert');
const policy = require('../../governance/e2e-rule-implementation-conformance-evidence-policy-2026-09-08.json');
const { sha256 } = require('../../src/standards/standards-registry');
const {
  E2D_STATUS,
  verifySubstantiveReviewActivationProposalIntegrity,
} = require('../../src/standards/substantive-review-activation-proposal');
const {
  E2E_STATUS,
  validatePolicy,
  normalizeImplementation,
  normalizeConformance,
  createRuleImplementationConformanceEvidencePacket,
  verifyRuleImplementationConformanceEvidencePacketIntegrity,
} = require('../../src/standards/rule-implementation-conformance-evidence');

let checks = 0;
function check(fn) { fn(); checks += 1; }
const h = (char) => char.repeat(64);
const c = (char) => char.repeat(40);

check(() => assert.strictEqual(policy.policyId, 'STARTAK-E2E-RULE-IMPLEMENTATION-CONFORMANCE-EVIDENCE-POLICY-2026-09-08'));
check(() => assert.strictEqual(policy.operatingMode, 'UNLICENSED_DECISION_SUPPORT'));
check(() => assert.strictEqual(policy.status, 'ENGINEERING_EVIDENCE_GATE_DEFINED_PRODUCTION_IMPLEMENTATION_NOT_AUTHORIZED'));
check(() => assert.strictEqual(policy.productionImplementationEvidencePresent, false));
check(() => assert.strictEqual(policy.productionIndependentConformanceEvidencePresent, false));
check(() => assert.strictEqual(policy.implementationSelfVerificationAllowed, false));
check(() => assert.strictEqual(policy.callerDeclaredConformanceAcceptedAsFormalConformance, false));
check(() => assert.strictEqual(policy.automaticRuleActivationAllowed, false));
check(() => assert.strictEqual(policy.automaticReleaseAllowed, false));
check(() => assert.strictEqual(policy.exactRuleCoverageRequired, true));
check(() => assert.strictEqual(validatePolicy(policy), true));

const activationProposal = Object.freeze({
  candidateId: 'E2-TAQEEM-REPORT-QA-004',
  domain: 'TAQEEM_PROFESSIONAL_REPORT_QA',
  reviewClass: 'PROFESSIONAL_REVIEW',
  validatedHumanDisposition: 'APPLICABLE',
  reviewerRef: 'reviewer-pro-e2e',
  humanReviewEvidenceRef: 'REV-PRO-E2E',
  sourceEvidenceRefs: Object.freeze([]),
  proposedAction: 'PROPOSE_RULE_IMPLEMENTATION',
  ruleSetId: 'RULESET-TAQEEM-REPORT-QA-PROPOSAL',
  proposedRuleRefs: Object.freeze(['RULE-REPORT-QA-CLARITY', 'RULE-REPORT-QA-COMPLETENESS']),
  implementationScopeRef: 'implementation-scope-report-qa',
  mappingEvidenceRef: 'mapping-evidence-report-qa',
  mappingArtifactSha256: h('d'),
  conditionsRef: null,
  mappedByRef: 'implementation-governance-preparer',
  mappedAt: '2026-09-08T11:05:00.000Z',
  proposalOnly: true,
  activationAuthorized: false,
});

const upstreamCore = {
  schemaVersion: 1,
  proposalId: 'E2E-UPSTREAM-E2D-PROPOSAL',
  applicabilityPacketId: 'E2E-UPSTREAM-E2',
  applicabilityPacketHashSha256: h('a'),
  externalEvidenceEnvelopeId: 'E2E-UPSTREAM-E2B',
  externalEvidenceEnvelopeHashSha256: h('b'),
  authorityValidationPacketId: 'E2E-UPSTREAM-E2C',
  authorityValidationPacketHashSha256: h('c'),
  policyId: 'STARTAK-E2D-TEST-UPSTREAM-POLICY',
  activationProposals: Object.freeze([activationProposal]),
  exclusions: Object.freeze([]),
  preparedByRef: 'e2d-preparer',
  preparedAt: '2026-09-08T11:06:00.000Z',
};
const upstreamProposal = Object.freeze({
  ...upstreamCore,
  status: E2D_STATUS.ACTIVATION_PROPOSAL_READY_FOR_IMPLEMENTATION_GOVERNANCE,
  blockers: Object.freeze([]),
  proposalPacketHashSha256: sha256(upstreamCore),
  substantiveReviewDispositionChainValidated: true,
  activationProposalPrepared: true,
  implementationGovernanceRequired: true,
  standardsOrRulesActivated: false,
  formalStandardsConformanceEstablished: false,
  releaseAuthorized: false,
  deploymentAuthorized: false,
  transactionAuthorized: false,
});
check(() => assert.strictEqual(verifySubstantiveReviewActivationProposalIntegrity(upstreamProposal), true));

const empty = createRuleImplementationConformanceEvidencePacket({
  evidencePacketId: 'E2E-EMPTY',
  activationProposalPacket: upstreamProposal,
  policy,
  implementationEvidence: [],
  conformanceEvidence: [],
  preparedByRef: 'e2e-preparer',
  preparedAt: '2026-09-08T11:10:00.000Z',
});
check(() => assert.strictEqual(empty.status, E2E_STATUS.WAITING_FOR_IMPLEMENTATION_EVIDENCE));
check(() => assert.strictEqual(empty.implementationEvidenceComplete, false));
check(() => assert.strictEqual(empty.conformanceEvidenceComplete, false));
check(() => assert.deepStrictEqual(empty.missingImplementationEvidence, ['E2-TAQEEM-REPORT-QA-004']));
check(() => assert.strictEqual(empty.formalStandardsConformanceEstablished, false));
check(() => assert.strictEqual(empty.standardsOrRulesActivated, false));
check(() => assert.strictEqual(verifyRuleImplementationConformanceEvidencePacketIntegrity(empty), true));

const implementationEvidence = [{
  implementationId: 'IMPL-E2E-001',
  candidateId: 'E2-TAQEEM-REPORT-QA-004',
  ruleSetId: 'RULESET-TAQEEM-REPORT-QA-PROPOSAL',
  implementedRuleRefs: ['RULE-REPORT-QA-COMPLETENESS', 'RULE-REPORT-QA-CLARITY'],
  sourceCommitSha: c('1'),
  codeArtifactSha256: h('e'),
  implementationEvidenceRef: 'implementation-evidence-e2e-001',
  implementedByRef: 'implementation-engineer-a',
  implementedAt: '2026-09-08T11:07:00.000Z',
}];
const normalizedImplementation = normalizeImplementation(implementationEvidence[0]);
check(() => assert.strictEqual(normalizedImplementation.sourceCommitSha, c('1')));
check(() => assert.deepStrictEqual(normalizedImplementation.implementedRuleRefs, ['RULE-REPORT-QA-CLARITY', 'RULE-REPORT-QA-COMPLETENESS']));
check(() => assert.strictEqual(/^[a-f0-9]{64}$/.test(normalizedImplementation.implementationRecordHashSha256), true));

const implemented = createRuleImplementationConformanceEvidencePacket({
  evidencePacketId: 'E2E-IMPLEMENTED',
  activationProposalPacket: upstreamProposal,
  policy,
  implementationEvidence,
  conformanceEvidence: [],
  preparedByRef: 'e2e-preparer',
  preparedAt: '2026-09-08T11:10:00.000Z',
});
check(() => assert.strictEqual(implemented.status, E2E_STATUS.WAITING_FOR_CONFORMANCE_EVIDENCE));
check(() => assert.strictEqual(implemented.implementationEvidenceComplete, true));
check(() => assert.strictEqual(implemented.conformanceEvidenceComplete, false));
check(() => assert.deepStrictEqual(implemented.missingConformanceEvidence, ['E2-TAQEEM-REPORT-QA-004']));
check(() => assert.strictEqual(verifyRuleImplementationConformanceEvidencePacketIntegrity(implemented), true));

const conformanceEvidence = [{
  conformanceId: 'CONF-E2E-001',
  candidateId: 'E2-TAQEEM-REPORT-QA-004',
  ruleSetId: 'RULESET-TAQEEM-REPORT-QA-PROPOSAL',
  testedRuleRefs: ['RULE-REPORT-QA-CLARITY', 'RULE-REPORT-QA-COMPLETENESS'],
  testSuiteRef: 'tests/e2e/report-qa-conformance-suite',
  testArtifactSha256: h('f'),
  conformanceEvidenceRef: 'independent-conformance-evidence-e2e-001',
  conformanceArtifactSha256: h('2'),
  verifiedByRef: 'independent-conformance-verifier-b',
  verifiedAt: '2026-09-08T11:08:00.000Z',
  result: 'PASS',
}];
const normalizedConformance = normalizeConformance(conformanceEvidence[0], policy);
check(() => assert.strictEqual(normalizedConformance.result, 'PASS'));
check(() => assert.strictEqual(/^[a-f0-9]{64}$/.test(normalizedConformance.conformanceRecordHashSha256), true));

const ready = createRuleImplementationConformanceEvidencePacket({
  evidencePacketId: 'E2E-READY',
  activationProposalPacket: upstreamProposal,
  policy,
  implementationEvidence,
  conformanceEvidence,
  preparedByRef: 'e2e-preparer',
  preparedAt: '2026-09-08T11:10:00.000Z',
});
check(() => assert.strictEqual(ready.status, E2E_STATUS.RULE_IMPLEMENTATION_EVIDENCE_READY_FOR_EXTERNAL_CONFORMANCE_VALIDATION));
check(() => assert.strictEqual(ready.implementationEvidenceComplete, true));
check(() => assert.strictEqual(ready.conformanceEvidenceComplete, true));
check(() => assert.strictEqual(ready.independentConformanceEvidenceRecorded, true));
check(() => assert.strictEqual(ready.externalConformanceValidationRequired, true));
check(() => assert.strictEqual(ready.formalStandardsConformanceEstablished, false));
check(() => assert.strictEqual(ready.standardsOrRulesActivated, false));
check(() => assert.strictEqual(ready.legalConclusionEstablished, false));
check(() => assert.strictEqual(ready.professionalApplicabilityEstablished, false));
check(() => assert.strictEqual(ready.saudiProfessionalLicensingEstablished, false));
check(() => assert.strictEqual(ready.certifiedValuationAuthorityEstablished, false));
check(() => assert.strictEqual(ready.externalIssuanceAuthorized, false));
check(() => assert.strictEqual(ready.releaseAuthorized, false));
check(() => assert.strictEqual(ready.mergeAuthorized, false));
check(() => assert.strictEqual(ready.deploymentAuthorized, false));
check(() => assert.strictEqual(ready.transactionAuthorized, false));
check(() => assert.strictEqual(verifyRuleImplementationConformanceEvidencePacketIntegrity(ready), true));

// Exact rule coverage is mandatory.
const coverageMismatch = [{ ...implementationEvidence[0], implementedRuleRefs: ['RULE-REPORT-QA-CLARITY'] }];
const heldCoverage = createRuleImplementationConformanceEvidencePacket({
  evidencePacketId: 'E2E-HOLD-COVERAGE',
  activationProposalPacket: upstreamProposal,
  policy,
  implementationEvidence: coverageMismatch,
  conformanceEvidence: [],
  preparedByRef: 'e2e-preparer',
  preparedAt: '2026-09-08T11:10:00.000Z',
});
check(() => assert.strictEqual(heldCoverage.status, E2E_STATUS.HOLD_IMPLEMENTATION_EVIDENCE));
check(() => assert.strictEqual(heldCoverage.blockers.includes('IMPLEMENTATION_RULE_COVERAGE_MISMATCH:E2-TAQEEM-REPORT-QA-004'), true));
check(() => assert.strictEqual(heldCoverage.evidencePacketHashSha256, null));

// Source commit SHA is structurally required.
const badCommit = [{ ...implementationEvidence[0], sourceCommitSha: 'not-a-commit' }];
const heldCommit = createRuleImplementationConformanceEvidencePacket({
  evidencePacketId: 'E2E-HOLD-COMMIT',
  activationProposalPacket: upstreamProposal,
  policy,
  implementationEvidence: badCommit,
  conformanceEvidence: [],
  preparedByRef: 'e2e-preparer',
  preparedAt: '2026-09-08T11:10:00.000Z',
});
check(() => assert.strictEqual(heldCommit.status, E2E_STATUS.HOLD_IMPLEMENTATION_EVIDENCE));
check(() => assert.strictEqual(heldCommit.blockers.some((x) => x.includes('sourceCommitSha must be a 40-character commit SHA')), true));

// Implementation may not self-verify conformance.
const selfVerified = [{ ...conformanceEvidence[0], verifiedByRef: 'implementation-engineer-a' }];
const heldSelf = createRuleImplementationConformanceEvidencePacket({
  evidencePacketId: 'E2E-HOLD-SELF-VERIFY',
  activationProposalPacket: upstreamProposal,
  policy,
  implementationEvidence,
  conformanceEvidence: selfVerified,
  preparedByRef: 'e2e-preparer',
  preparedAt: '2026-09-08T11:10:00.000Z',
});
check(() => assert.strictEqual(heldSelf.status, E2E_STATUS.HOLD_CONFORMANCE_EVIDENCE));
check(() => assert.strictEqual(heldSelf.blockers.includes('IMPLEMENTATION_SELF_VERIFICATION_PROHIBITED:E2-TAQEEM-REPORT-QA-004'), true));

// Conformance must test the exact implemented rule set.
const conformanceMismatch = [{ ...conformanceEvidence[0], testedRuleRefs: ['RULE-REPORT-QA-CLARITY'] }];
const heldConformanceCoverage = createRuleImplementationConformanceEvidencePacket({
  evidencePacketId: 'E2E-HOLD-CONFORMANCE-COVERAGE',
  activationProposalPacket: upstreamProposal,
  policy,
  implementationEvidence,
  conformanceEvidence: conformanceMismatch,
  preparedByRef: 'e2e-preparer',
  preparedAt: '2026-09-08T11:10:00.000Z',
});
check(() => assert.strictEqual(heldConformanceCoverage.status, E2E_STATUS.HOLD_CONFORMANCE_EVIDENCE));
check(() => assert.strictEqual(heldConformanceCoverage.blockers.includes('CONFORMANCE_RULE_COVERAGE_MISMATCH:E2-TAQEEM-REPORT-QA-004'), true));

// A recorded FAIL is blocking.
const failedConformance = [{ ...conformanceEvidence[0], result: 'FAIL' }];
const heldFailure = createRuleImplementationConformanceEvidencePacket({
  evidencePacketId: 'E2E-HOLD-CONFORMANCE-FAIL',
  activationProposalPacket: upstreamProposal,
  policy,
  implementationEvidence,
  conformanceEvidence: failedConformance,
  preparedByRef: 'e2e-preparer',
  preparedAt: '2026-09-08T11:10:00.000Z',
});
check(() => assert.strictEqual(heldFailure.status, E2E_STATUS.HOLD_CONFORMANCE_FAILURE));
check(() => assert.strictEqual(heldFailure.blockers.includes('CONFORMANCE_RESULT_FAIL:E2-TAQEEM-REPORT-QA-004:CONF-E2E-001'), true));
check(() => assert.strictEqual(heldFailure.formalStandardsConformanceEstablished, false));

// INCONCLUSIVE remains evidence but never becomes PASS completeness.
const inconclusive = [{ ...conformanceEvidence[0], result: 'INCONCLUSIVE' }];
const waitingInconclusive = createRuleImplementationConformanceEvidencePacket({
  evidencePacketId: 'E2E-INCONCLUSIVE',
  activationProposalPacket: upstreamProposal,
  policy,
  implementationEvidence,
  conformanceEvidence: inconclusive,
  preparedByRef: 'e2e-preparer',
  preparedAt: '2026-09-08T11:10:00.000Z',
});
check(() => assert.strictEqual(waitingInconclusive.status, E2E_STATUS.WAITING_FOR_CONFORMANCE_EVIDENCE));
check(() => assert.strictEqual(waitingInconclusive.conformanceEvidenceComplete, false));
check(() => assert.deepStrictEqual(waitingInconclusive.missingConformanceEvidence, ['E2-TAQEEM-REPORT-QA-004']));
check(() => assert.strictEqual(verifyRuleImplementationConformanceEvidencePacketIntegrity(waitingInconclusive), true));

// Tampered E2D proposal fails closed.
const tamperedUpstream = JSON.parse(JSON.stringify(upstreamProposal));
tamperedUpstream.activationProposals[0].ruleSetId = 'TAMPERED-RULESET';
const heldUpstream = createRuleImplementationConformanceEvidencePacket({
  evidencePacketId: 'E2E-HOLD-UPSTREAM',
  activationProposalPacket: tamperedUpstream,
  policy,
  implementationEvidence,
  conformanceEvidence,
  preparedByRef: 'e2e-preparer',
  preparedAt: '2026-09-08T11:10:00.000Z',
});
check(() => assert.strictEqual(heldUpstream.status, E2E_STATUS.HOLD_E2D_PROPOSAL));
check(() => assert.strictEqual(heldUpstream.blockers.includes('E2D_ACTIVATION_PROPOSAL_NOT_QUALIFIED'), true));
check(() => assert.strictEqual(heldUpstream.transactionAuthorized, false));

// Tampering with a completed E2E packet is detectable.
const tamperedPacket = JSON.parse(JSON.stringify(ready));
tamperedPacket.implementationEvidence[0].sourceCommitSha = c('9');
check(() => assert.strictEqual(verifyRuleImplementationConformanceEvidencePacketIntegrity(tamperedPacket), false));

console.log(`E2E_RULE_IMPLEMENTATION_CONFORMANCE_EVIDENCE=PASS checks=${checks}`);
