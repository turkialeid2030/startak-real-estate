'use strict';

const assert = require('assert');
const crypto = require('crypto');
const {
  DECISION,
  QUALIFICATION_STATUS,
  EXTERNAL_STATUS,
  REQUIRED_UPSTREAM_STAGES,
  REQUIRED_TECHNICAL_GATES,
  REQUIRED_EXTERNAL_EVIDENCE,
  createUpstreamQualification,
  createTechnicalGateEvidence,
  createExternalEvidenceItem,
  buildReleaseCandidatePack,
} = require('../../src/release/governed-release-candidate.js');

const hash = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const candidateHeadSha = process.env.C30_EXPECTED_HEAD_SHA || 'f'.repeat(40);
const frozenAt = '2026-10-02T00:30:00Z';

const qualifiedHeads = Object.freeze({
  C22_GENERATIVE_ORCHESTRATION: 'dbc5b2ba6c2d8a482e7a8018a7c5a84d2b1e03b4',
  C23_AI_PROVIDER_GATEWAY: 'a7ae9aab9ce4317f5178e25363395abb48231d2b',
  C24_CASE_ORCHESTRATION: '99cf9fdb9f21f71e532c2de3f4f41f129264bb3b',
  C25_SOURCE_READINESS: 'bb13a3f2e69600cb0abffd2c698e6ab21ed300e2',
  C26_OPERATOR_WORKSPACE: '2bbfbdb3c9dfb76fce3100464f7944f3250d86b2',
  C27_OBSERVABILITY: '39542e8b7029d9cb1e5a595f42ee1e3fc7ec64b6',
  C28_INTEGRATION_QUALIFICATION: 'c371c426cd10fac6b6e2e4cc033b770e1417b7d0',
  C29_SHADOW_SIMULATION: '90b4b12f6161908ebbac9eda4fd3636e197f7168',
  C26_INTEGRATED_REVIEW_UI_CLOSURE: '563fc735a44cb2eca5898503329b56dac39c3e90',
});

const upstreamQualifications = REQUIRED_UPSTREAM_STAGES.map((stageId) => createUpstreamQualification({
  stageId,
  gitSha: qualifiedHeads[stageId],
  status: QUALIFICATION_STATUS.PASS,
  verificationRef: `QUALIFIED:${stageId}`,
  verificationEvidenceHashSha256: hash(`qualified:${stageId}:${qualifiedHeads[stageId]}`),
}));

const technicalGates = REQUIRED_TECHNICAL_GATES.map((gateId) => createTechnicalGateEvidence({
  gateId,
  candidateHeadSha,
  status: QUALIFICATION_STATUS.PASS,
  evidenceRef: `CI:${gateId}`,
  evidenceHashSha256: hash(`technical:${gateId}:${candidateHeadSha}`),
  verifiedAt: '2026-10-02T00:20:00Z',
}));

const externalEvidenceOpen = REQUIRED_EXTERNAL_EVIDENCE.map((evidenceId) => createExternalEvidenceItem({
  evidenceId,
  candidateHeadSha,
  status: EXTERNAL_STATUS.NOT_SUPPLIED,
  reasonCode: 'REAL_EXTERNAL_EVIDENCE_NOT_SUPPLIED',
}));

const holdPack = buildReleaseCandidatePack({
  releaseCandidateId: 'STARTAK-C30-RC',
  candidateHeadSha,
  frozenAt,
  upstreamQualifications,
  technicalGates,
  externalEvidence: externalEvidenceOpen,
});

assert.strictEqual(holdPack.decision, DECISION.HOLD);
assert.strictEqual(holdPack.releaseCandidateFrozen, true);
assert.strictEqual(holdPack.mergeHold, true);
assert.strictEqual(holdPack.deploy, 'NO');
assert.strictEqual(holdPack.commercialGoLive, 'HOLD');
assert.strictEqual(holdPack.transactionAuthorized, false);
assert.strictEqual(holdPack.approvalAuthorized, false);
assert.strictEqual(holdPack.publicAiAuthorized, false);
assert.strictEqual(holdPack.productionDeploymentAuthorized, false);
assert.strictEqual(holdPack.canonicalBaselineActivationAuthorized, false);
assert.strictEqual(holdPack.activationAuthorized, false);
assert.strictEqual(
  holdPack.notEvaluatedRegister.filter((item) => item.source === 'EXTERNAL').length,
  REQUIRED_EXTERNAL_EVIDENCE.length,
);
assert.deepStrictEqual(
  holdPack.notEvaluatedRegister.filter((item) => item.source === 'EXTERNAL').map((item) => item.id).sort(),
  [...REQUIRED_EXTERNAL_EVIDENCE].sort(),
);
assert(holdPack.blockerRegister.every((item) => item.decisionEffect === DECISION.HOLD));

const externalEvidenceVerified = REQUIRED_EXTERNAL_EVIDENCE.map((evidenceId) => createExternalEvidenceItem({
  evidenceId,
  candidateHeadSha,
  status: EXTERNAL_STATUS.SUPPLIED_VERIFIED,
  evidenceRef: `REAL:${evidenceId}`,
  evidenceHashSha256: hash(`external:${evidenceId}:${candidateHeadSha}`),
  verifiedByRef: 'INDEPENDENT-REVIEWER',
  verifiedAt: '2026-10-02T00:15:00Z',
}));
const evidenceCompletePack = buildReleaseCandidatePack({
  releaseCandidateId: 'STARTAK-C30-EVIDENCE-COMPLETE',
  candidateHeadSha,
  frozenAt,
  upstreamQualifications,
  technicalGates,
  externalEvidence: externalEvidenceVerified,
});
assert.strictEqual(evidenceCompletePack.decision, DECISION.GO);
assert.strictEqual(evidenceCompletePack.blockerRegister.length, 0);
assert.strictEqual(evidenceCompletePack.activationAuthorized, false);
assert.strictEqual(evidenceCompletePack.productionDeploymentAuthorized, false);
assert.strictEqual(evidenceCompletePack.commercialGoLive, 'HOLD');

const rejectedEvidence = [...externalEvidenceVerified];
rejectedEvidence[0] = createExternalEvidenceItem({
  evidenceId: REQUIRED_EXTERNAL_EVIDENCE[0],
  candidateHeadSha,
  status: EXTERNAL_STATUS.REJECTED,
  evidenceRef: 'SECURITY-REVIEW-REPORT',
  evidenceHashSha256: hash('security-review-rejected'),
  verifiedByRef: 'SECURITY-REVIEWER',
  verifiedAt: '2026-10-02T00:10:00Z',
  reasonCode: 'CRITICAL_SECURITY_FINDING',
});
const rejectedPack = buildReleaseCandidatePack({
  releaseCandidateId: 'STARTAK-C30-NO-GO',
  candidateHeadSha,
  frozenAt,
  upstreamQualifications,
  technicalGates,
  externalEvidence: rejectedEvidence,
});
assert.strictEqual(rejectedPack.decision, DECISION.NO_GO);

const notEvaluatedTechnical = [...technicalGates];
notEvaluatedTechnical[0] = createTechnicalGateEvidence({
  gateId: REQUIRED_TECHNICAL_GATES[0],
  candidateHeadSha,
  status: QUALIFICATION_STATUS.NOT_EVALUATED,
  reasonCode: 'TECHNICAL_EVIDENCE_NOT_AVAILABLE',
});
const technicalHoldPack = buildReleaseCandidatePack({
  releaseCandidateId: 'STARTAK-C30-TECH-HOLD',
  candidateHeadSha,
  frozenAt,
  upstreamQualifications,
  technicalGates: notEvaluatedTechnical,
  externalEvidence: externalEvidenceVerified,
});
assert.strictEqual(technicalHoldPack.decision, DECISION.HOLD);
assert(technicalHoldPack.notEvaluatedRegister.some((item) => item.id === REQUIRED_TECHNICAL_GATES[0]));

assert.throws(
  () => createExternalEvidenceItem({
    evidenceId: REQUIRED_EXTERNAL_EVIDENCE[0],
    candidateHeadSha,
    status: EXTERNAL_STATUS.NOT_SUPPLIED,
    reasonCode: 'MISSING',
    evidenceRef: 'FABRICATED-EVIDENCE',
  }),
  /C30_NOT_SUPPLIED_MUST_NOT_FABRICATE_EVIDENCE/,
);
assert.throws(
  () => createTechnicalGateEvidence({
    gateId: REQUIRED_TECHNICAL_GATES[0],
    candidateHeadSha: 'a'.repeat(64),
    status: QUALIFICATION_STATUS.PASS,
    evidenceRef: 'INVALID-HEAD',
    evidenceHashSha256: hash('invalid-head'),
    verifiedAt: '2026-10-02T00:00:00Z',
  }),
  /C30_CANDIDATE_HEAD_INVALID/,
);

const tamperedTechnical = [...technicalGates];
tamperedTechnical[0] = { ...tamperedTechnical[0], status: QUALIFICATION_STATUS.FAIL };
const tamperPack = buildReleaseCandidatePack({
  releaseCandidateId: 'STARTAK-C30-TAMPER',
  candidateHeadSha,
  frozenAt,
  upstreamQualifications,
  technicalGates: tamperedTechnical,
  externalEvidence: externalEvidenceVerified,
});
assert.strictEqual(tamperPack.decision, DECISION.NO_GO);
assert(tamperPack.blockerRegister.some((item) => item.state === 'INTEGRITY_FAILURE'));

console.log(`C30_RELEASE_CANDIDATE_FREEZE=PASS HEAD=${candidateHeadSha}`);
console.log(`C30_DEFAULT_DECISION=${holdPack.decision}`);
console.log(`C30_EXTERNAL_OPEN=${holdPack.notEvaluatedRegister.filter((item) => item.source === 'EXTERNAL').map((item) => item.id).join(',')}`);
