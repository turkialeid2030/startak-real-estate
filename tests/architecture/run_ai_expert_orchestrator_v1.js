'use strict';

const assert = require('assert');
const {
  AI_ROLE,
  AI_STAGE_STATUS,
  buildAiExpertStage,
  validateAiRoleOutput,
} = require('../../src/decision-intelligence/ai-expert-orchestrator');

function readyDecisionQuality(overrides = {}) {
  return {
    caseId: 'CASE-AI-001',
    projectId: 'PROJECT-AI-001',
    status: 'READY_FOR_HUMAN_REVIEW',
    feedback: {
      materialUpstreamChange: false,
      aiOpinion: { status: 'CURRENT' },
    },
    reliability: { overallReliability: 'MODERATE' },
    dueDiligence: {
      nextBestAction: {
        id: 'DD-001',
        priority: 'MODERATE',
        question: 'Confirm lease evidence',
      },
    },
    ...overrides,
  };
}

function dossier(overrides = {}) {
  return {
    caseId: 'CASE-AI-001',
    projectId: 'PROJECT-AI-001',
    dossierStatus: 'READY_ANALYTICAL_CASE',
    aiNarrativeContext: {
      factRefs: [
        { ref: 'EVIDENCE-1' },
        { ref: 'EVIDENCE-2' },
      ],
    },
    ...overrides,
  };
}

function stage(role = AI_ROLE.ANALYST, decisionQuality = readyDecisionQuality(), dossierValue = dossier()) {
  return buildAiExpertStage({
    role,
    caseId: 'CASE-AI-001',
    projectId: 'PROJECT-AI-001',
    contextVersionId: 'CTX-v1',
    evidenceHash: 'evidence-hash-1',
    decisionQuality,
    dossier: dossierValue,
  });
}

(function testReadyAnalystStageIsBounded() {
  const out = stage();
  assert.strictEqual(out.status, AI_STAGE_STATUS.READY_FOR_MODEL_CALL);
  assert.strictEqual(out.modelCallExecuted, false);
  assert.strictEqual(out.transactionAuthorized, false);
  assert.strictEqual(out.mayOverrideDeterministicOutputs, false);
  assert.ok(out.instructions.some((x) => /Do not invent facts/.test(x)));
  assert.deepStrictEqual(out.evidenceRefs, ['EVIDENCE-1', 'EVIDENCE-2']);
})();

(function testRoleInstructionsDiffer() {
  const analyst = stage(AI_ROLE.ANALYST);
  const challenger = stage(AI_ROLE.CHALLENGER);
  const synthesizer = stage(AI_ROLE.SYNTHESIZER);
  assert.ok(analyst.instructions.some((x) => /analytical case/i.test(x)));
  assert.ok(challenger.instructions.some((x) => /counter-case/i.test(x)));
  assert.ok(synthesizer.instructions.some((x) => /Reconcile analyst and challenger/i.test(x)));
})();

(function testStaleContextHoldsStage() {
  const dq = readyDecisionQuality({
    status: 'HOLD_STALE_AI_OPINION',
    feedback: {
      materialUpstreamChange: true,
      aiOpinion: { status: 'STALE_REANALYSIS_REQUIRED' },
    },
  });
  const out = stage(AI_ROLE.ANALYST, dq);
  assert.notStrictEqual(out.status, AI_STAGE_STATUS.READY_FOR_MODEL_CALL);
  assert.strictEqual(out.transactionAuthorized, false);
})();

(function testLowReliabilityHoldsStage() {
  const dq = readyDecisionQuality({
    status: 'HOLD_RELIABILITY',
    reliability: { overallReliability: 'LOW' },
  });
  const out = stage(AI_ROLE.SYNTHESIZER, dq);
  assert.strictEqual(out.status, AI_STAGE_STATUS.HOLD_RELIABILITY);
})();

(function testProfessionalReviewHoldsStage() {
  const out = stage(AI_ROLE.SYNTHESIZER, readyDecisionQuality(), dossier({ dossierStatus: 'PROFESSIONAL_REVIEW_REQUIRED' }));
  assert.strictEqual(out.status, AI_STAGE_STATUS.HOLD_PROFESSIONAL_REVIEW);
})();

(function testAcceptsBoundedOutput() {
  const s = stage();
  const result = validateAiRoleOutput({
    stage: s,
    output: {
      role: AI_ROLE.ANALYST,
      caseId: 'CASE-AI-001',
      projectId: 'PROJECT-AI-001',
      contextVersionId: 'CTX-v1',
      evidenceHash: 'evidence-hash-1',
      narrative: 'The supplied evidence indicates a conditional analytical case with material uncertainty.',
      citedEvidenceRefs: ['EVIDENCE-1'],
      uncertainties: ['Lease evidence requires confirmation.'],
    },
  });
  assert.strictEqual(result.accepted, true);
  assert.strictEqual(result.numericConfidence, null);
  assert.strictEqual(result.transactionAuthorized, false);
})();

(function testRejectsUnknownEvidenceAndNumericConfidence() {
  const s = stage(AI_ROLE.CHALLENGER);
  const result = validateAiRoleOutput({
    stage: s,
    output: {
      role: AI_ROLE.CHALLENGER,
      caseId: 'CASE-AI-001',
      projectId: 'PROJECT-AI-001',
      contextVersionId: 'CTX-v1',
      evidenceHash: 'evidence-hash-1',
      narrative: 'A downside counter-case remains conditional on unresolved evidence.',
      citedEvidenceRefs: ['EVIDENCE-NOT-SUPPLIED'],
      numericConfidence: 92,
    },
  });
  assert.strictEqual(result.accepted, false);
  assert.ok(result.reasonCodes.includes('UNKNOWN_EVIDENCE_REFERENCE'));
  assert.ok(result.reasonCodes.includes('UNCALIBRATED_NUMERIC_CONFIDENCE_NOT_ALLOWED'));
})();

(function testRejectsDecisionLanguageAndAuthorization() {
  const s = stage(AI_ROLE.SYNTHESIZER);
  const result = validateAiRoleOutput({
    stage: s,
    output: {
      role: AI_ROLE.SYNTHESIZER,
      caseId: 'CASE-AI-001',
      projectId: 'PROJECT-AI-001',
      contextVersionId: 'CTX-v1',
      evidenceHash: 'evidence-hash-1',
      narrative: 'BUY the asset based on the current analysis.',
      citedEvidenceRefs: ['EVIDENCE-1'],
      transactionAuthorized: true,
    },
  });
  assert.strictEqual(result.accepted, false);
  assert.ok(result.reasonCodes.includes('PROHIBITED_DECISION_LANGUAGE'));
  assert.ok(result.reasonCodes.includes('TRANSACTION_AUTHORIZATION_NOT_ALLOWED'));
})();

(function testRejectsScopeAndContextMismatch() {
  assert.throws(
    () => buildAiExpertStage({
      role: AI_ROLE.ANALYST,
      caseId: 'CASE-AI-001',
      projectId: 'PROJECT-AI-001',
      contextVersionId: 'CTX-v1',
      evidenceHash: 'hash',
      decisionQuality: readyDecisionQuality({ caseId: 'CASE-OTHER' }),
      dossier: dossier(),
    }),
    /CASE_SCOPE_MISMATCH/
  );

  const s = stage();
  const rejected = validateAiRoleOutput({
    stage: s,
    output: {
      role: AI_ROLE.ANALYST,
      caseId: 'CASE-AI-001',
      projectId: 'PROJECT-AI-001',
      contextVersionId: 'CTX-old',
      evidenceHash: 'evidence-hash-1',
      narrative: 'Conditional analytical narrative.',
      citedEvidenceRefs: [],
    },
  });
  assert.strictEqual(rejected.accepted, false);
  assert.ok(rejected.reasonCodes.includes('STALE_OR_MISMATCHED_CONTEXT'));
})();

console.log('AI_EXPERT_CHALLENGER_ORCHESTRATION_V1=PASS');
